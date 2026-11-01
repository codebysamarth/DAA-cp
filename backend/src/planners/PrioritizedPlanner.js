/**
 * Prioritized Planning engine.
 *
 * Idea: robots plan ONE AT A TIME in priority order. Each robot runs
 * Space-Time A* and then RESERVES its path in the reservation table, so every
 * later robot plans around all earlier robots.
 *
 * The same engine (with different settings) gives three of our algorithms:
 *
 *   setting            Standard PP     RHCR-PP          CA-RHPP (ours)
 *   ----------------   -------------   --------------   ---------------------------
 *   window H           full path       20 steps         20 steps
 *   heuristic          Manhattan       true distance    true distance (BFS cache)
 *   priority order     fixed (id)      fixed (id)       dynamic score (+ aging)
 *   task allocation    greedy          greedy           Hungarian + congestion cost
 *   local repair       no              no               yes (LNS-style)
 *   incremental plan   no              no               yes
 *
 * With `coordinate: false` robots ignore each other  ->  Independent A*.
 * `congestionWeight` > 0 adds a penalty for entering busy cells. We tested it
 * and it lowered throughput, so CA-RHPP keeps it at 0 (see ablation study).
 */
import { SpaceTimeAStar } from '../core/SpaceTimeAStar.js';
import { ReservationTable } from '../core/ReservationTable.js';
import { TrueDistanceHeuristic, ManhattanHeuristic } from '../core/heuristics.js';
import { CELL } from '../core/Grid.js';
import { allocateTasks } from './taskAllocation.js';

// Tuned on 7 scenarios (see README). Waiting only raises priority after a
// 10-tick grace period, so normal queueing does not reshuffle the order.
export const DEFAULT_WEIGHTS = { wait: 3, waitGrace: 10, crowd: 2 };

export class PrioritizedPlanner {
  constructor(grid, cfg) {
    this.grid = grid;
    this.cfg = cfg;
    // 'full' = long enough for any complete path on our maps
    this.H = cfg.horizon === 'full' ? grid.width + grid.height + 10 : cfg.horizon;
    this.replanEvery = cfg.replanEvery;
    this.weights = { ...DEFAULT_WEIGHTS, ...(cfg.weights || {}) };

    this.dist = new TrueDistanceHeuristic(grid); // exact distances (task costs, scores)
    this.heuristic = cfg.heuristic === 'manhattan' ? new ManhattanHeuristic(grid) : this.dist;
    this.astar = new SpaceTimeAStar(grid, this.H);
    this.table = new ReservationTable(grid.N, this.H);
    this.heat = new Float64Array(grid.N);
    this.windowPaths = [];
    this.supportsIncremental = !!cfg.incremental && cfg.coordinate !== false;

    this.stats = { searches: 0, failedPlans: 0, repairsTried: 0, repairsSucceeded: 0 };
    this.repairSeed = 12345;
  }

  get nodesExpanded() { return this.astar.expanded; }

  /* ---------------- Stage 1: task allocation ---------------- */
  assignTasks(sim, isReplanTick) {
    const hung = this.cfg.assignment === 'hungarian';
    allocateTasks(sim, {
      mode: hung ? 'hungarian' : 'greedy',
      reassign: hung && this.cfg.reassign,
      isReplanTick,
      dist: this.dist,
      crowdWeight: hung ? 2 : 0,
      ageWeight: hung ? 0.05 : 0,
      stickiness: 1,
    });
  }

  /* ---------------- Stage 2: priority order ---------------- */
  priorityOrder(sim) {
    const n = sim.robots.length;
    const order = Array.from({ length: n }, (_, i) => i);
    if (this.cfg.priority !== 'dynamic') return order; // fixed: by robot id

    // score(r) = wait * max(0, waitTicks - grace) + crowd * robotsNearby + bonuses
    // (order urgency is handled in task allocation, so it is not repeated here)
    const { wait, waitGrace, crowd } = this.weights;
    const robots = sim.robots;
    const scores = robots.map((r) => {
      let s = 0;
      s += wait * Math.max(0, r.legWait - waitGrace);             // aging: long waits raise priority
      s += crowd * sim.crowdAround(r.cell);                       // clear jams first
      const type = this.grid.type[r.cell];
      if (type === CELL.RACK || type === CELL.STATION) s += 50;   // leave dead-end cells first
      if (!r.task) s -= 100;                                      // idle robots are most flexible
      return s;
    });
    // sort by score (highest first), ties broken by robot id: O(n log n)
    order.sort((a, b) => scores[b] - scores[a] || a - b);
    sim.priorityScores = scores;
    return order;
  }

  /* ---------------- Stage 3: windowed space-time planning ---------------- */
  plan(sim) {
    const { robots } = sim;
    const n = robots.length;
    this.table.clear();
    this.heat.fill(0);
    const order = this.priorityOrder(sim);
    const paths = new Array(n);
    const failed = [];

    for (const i of order) {
      const res = this.planRobot(sim, i, 0);
      if (res) {
        paths[i] = res.path;
      } else {
        paths[i] = this.stayPath(robots[i].cell, 0);
        failed.push(i);
      }
      this.commit(i, paths[i], 0);
    }

    // Stage 4: selective local repair of robots that found no path
    if (this.cfg.localRepair) {
      for (const f of failed) this.localRepair(sim, f, paths);
    }
    this.stats.failedPlans += this.countFailed(paths, robots);

    this.windowPaths = paths;
    return paths;
  }

  planRobot(sim, i, startT) {
    const r = sim.robots[i];
    this.stats.searches++;
    return this.astar.search({
      start: r.cell,
      goal: sim.goalOf(r),
      heuristic: this.heuristic,
      constraints: this.cfg.coordinate === false ? null : this.table,
      startT,
      heat: this.cfg.congestionWeight > 0 ? this.heat : null,
      heatWeight: this.cfg.congestionWeight || 0,
    });
  }

  /** reserve a path and add it to the congestion heat map */
  commit(i, path, startT) {
    if (this.cfg.coordinate === false) return;
    this.table.reservePath(i, path, startT);
    if (this.cfg.congestionWeight > 0) {
      let prev = -1;
      for (const c of path) { if (c !== prev) this.heat[c] += 1; prev = c; }
    }
  }

  stayPath(cell, startT) {
    return new Array(this.H - startT + 1).fill(cell);
  }

  /** a robot "failed" if its path is a forced stay that collides with a reservation */
  countFailed(paths, robots) {
    if (this.cfg.coordinate === false) return 0;
    let count = 0;
    for (let i = 0; i < paths.length; i++) {
      const p = paths[i];
      for (let t = 1; t < p.length; t++) {
        if (this.table.owner(p[t], t) !== i) { count++; break; }
      }
    }
    return count;
  }

  /**
   * Stage 4 – Selective Local Repair (idea from MAPF-LNS2, Li et al. AAAI 2022).
   * Instead of replanning all n robots, take only the failed robot f and the
   * k <= 4 robots that block it, and replan just this small group in a few
   * different orders (R <= 5 tries). Accept only if EVERY robot in the group
   * gets a valid path; otherwise roll back.  Cost: O(R * k) searches, not O(n).
   */
  localRepair(sim, f, paths) {
    const K = 4;
    const R = 5;
    const robots = sim.robots;
    const start = robots[f].cell;
    this.stats.repairsTried++;

    // robots occupying f's cell or its neighbours at t = 1..2 block every escape
    const blockers = [];
    const cells = [start, ...this.grid.neighbours[start]];
    for (const c of cells) {
      for (let t = 1; t <= 2; t++) {
        const o = this.table.owner(c, t);
        if (o >= 0 && o !== f && !blockers.includes(o) && blockers.length < K) blockers.push(o);
      }
    }
    if (blockers.length === 0) return false;

    const group = [f, ...blockers];
    const oldPaths = group.map((i) => paths[i]);
    for (const i of group) this.table.removePath(i, paths[i], 0);

    for (let attempt = 0; attempt < R; attempt++) {
      // try 1: f first; then rotations; then pseudo-random orders
      let tryOrder;
      if (attempt < group.length) tryOrder = group.slice(attempt).concat(group.slice(0, attempt));
      else tryOrder = this.shuffle(group);

      const newPaths = new Map();
      let ok = true;
      for (const i of tryOrder) {
        const res = this.planRobot(sim, i, 0);
        if (!res) { ok = false; break; }
        newPaths.set(i, res.path);
        this.table.reservePath(i, res.path, 0);
      }
      if (ok) {
        for (const [i, p] of newPaths) paths[i] = p;
        this.stats.repairsSucceeded++;
        return true;
      }
      for (const [i, p] of newPaths) this.table.removePath(i, p, 0);
    }

    // roll back
    group.forEach((i, k) => { paths[i] = oldPaths[k]; this.table.reservePath(i, oldPaths[k], 0); });
    return false;
  }

  shuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      this.repairSeed = (this.repairSeed * 1103515245 + 12345) % 2147483648;
      const j = this.repairSeed % (i + 1);
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  /**
   * Incremental replanning (CA-RHPP).
   * When ONE robot gets a new goal in the middle of a window (e.g. it just
   * picked up its pod), RHCR makes it wait for the next full replanning step.
   * We instead replan only that robot against the existing reservations:
   * 1 search instead of n, and the robot does not stand idle.
   */
  replanSingle(sim, i, offset) {
    const old = this.windowPaths[i];
    if (!old || offset >= this.H) return null;
    const oldRest = old.slice(offset);
    this.table.removePath(i, oldRest, offset);
    const res = this.planRobot(sim, i, offset);
    if (!res) {
      this.table.reservePath(i, oldRest, offset);
      return null;
    }
    this.table.reservePath(i, res.path, offset);
    this.windowPaths[i] = old.slice(0, offset).concat(res.path);
    return res.path;
  }
}
