/**
 * Stage 1 – Task allocation (shared by all planners).
 *
 *  mode 'greedy'    : baselines. Each free robot takes the nearest open order.
 *  mode 'hungarian' : CA-RHPP.   Optimal assignment with a congestion-aware cost:
 *
 *      cost(r, o) = dist(r, pickup(o))                 travel time (exact BFS distance)
 *                 + crowdWeight * crowd(pickup(o))     robots already working near that shelf
 *                 - ageWeight   * age(o)               old orders first (no order starvation)
 *                 - stickiness  (if r already owns o)  avoids robots swapping orders back and forth
 *
 *  With `reassign` on, robots that have NOT picked their order yet are
 *  re-optimised together with free robots at every replanning step.
 */
import { hungarianAssign, greedyAssign } from '../core/assignment.js';

export function allocateTasks(sim, opts) {
  const { mode, reassign, isReplanTick, dist, crowdWeight = 0, ageWeight = 0, stickiness = 0 } = opts;
  const { robots, grid } = sim;

  const candidates = [];
  for (let i = 0; i < robots.length; i++) {
    const r = robots[i];
    if (!r.task || (reassign && isReplanTick && !r.carrying)) candidates.push(i);
  }
  if (candidates.length === 0) return;

  // Orders that can be (re)assigned: open orders + orders of candidate robots.
  const pool = sim.pending.slice();
  for (const i of candidates) if (robots[i].task) pool.push(robots[i].task);
  if (pool.length === 0) return;

  // crowd(c) = robots whose current goal is within 2 cells of c
  const goals = robots.map((r) => sim.goalOf(r));
  const crowd = (cell) => {
    if (crowdWeight === 0) return 0;
    let count = 0;
    for (const gCell of goals) if (grid.manhattan(gCell, cell) <= 2) count++;
    return count;
  };
  const crowdOfPod = pool.map((o) => crowd(o.pod));

  const cost = candidates.map((i) => {
    const r = robots[i];
    return pool.map((o, j) => {
      let c = dist.h(r.cell, o.pod);
      if (mode === 'hungarian') {
        c += crowdWeight * crowdOfPod[j] - ageWeight * (sim.tick - o.releasedAt);
        if (r.task === o) c -= stickiness;
      }
      return c;
    });
  });

  const choice = mode === 'hungarian' ? hungarianAssign(cost) : greedyAssign(cost);

  const used = new Set();
  candidates.forEach((i, k) => {
    const r = robots[i];
    const newTask = choice[k] >= 0 ? pool[choice[k]] : null;
    if (newTask !== r.task) {
      r.task = newTask;
      r.goalDirty = true;
      if (newTask) r.assignedAt = sim.tick;
    }
    if (newTask) used.add(newTask);
  });
  sim.pending = pool.filter((o) => !used.has(o));
}
