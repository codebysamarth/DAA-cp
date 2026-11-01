/**
 * Windowed Space-Time A*  (the single-robot path planner used by every algorithm)
 *
 * State  = (cell, t)            t = 0..H   (H = planning window)
 * Moves  = go to one of the 4 neighbours, or WAIT in place; every move takes 1 time step.
 * Cost   = 1 per time step (+ an optional congestion penalty when entering a busy cell).
 *
 * Search ends when the robot
 *   (a) reaches its goal AND can stay there until H, or
 *   (b) reaches the end of the window (t = H). Then total cost = g + h(cell),
 *       i.e. "time used so far + exact remaining distance". This is the
 *       windowed objective of RHCR (Li et al., AAAI 2021).
 *
 * Optimisations (why it is fast):
 *   - States are integers  id = t * N + cell, stored in typed arrays.
 *   - Arrays are allocated ONCE and reused. A "generation stamp" marks which
 *     entries belong to the current search, so we never clear the arrays: O(1) reset.
 *   - Heap-based open list (hand-written MinHeap), lazy deletion of stale entries.
 *
 * Complexity per search: O(|S| log |S|) with |S| = H * |V|  (each state expanded once,
 * at most 5 successors, each heap operation O(log |S|)).
 */
import { MinHeap } from './MinHeap.js';
import { UNREACHABLE } from './heuristics.js';

export class SpaceTimeAStar {
  constructor(grid, H) {
    this.grid = grid;
    this.H = H;
    const size = (H + 1) * grid.N;
    this.g = new Float64Array(size);
    this.parent = new Int32Array(size);
    this.seen = new Uint32Array(size);   // == generation if g/parent are valid
    this.closed = new Uint32Array(size); // == generation if already expanded
    this.generation = 0;
    this.heap = new MinHeap();
    this.expanded = 0; // total nodes expanded (for analysis)
  }

  /**
   * @param start      start cell
   * @param goal       goal cell
   * @param heuristic  object with h(cell, goal)
   * @param constraints  null, or object with vertexBlocked / edgeBlocked / canHoldGoal
   * @param startT     time the robot is at `start` (used for incremental replanning)
   * @param heat       optional Float64Array: extra cost for entering each cell
   * @param heatWeight weight of that extra cost
   * @returns { path: cells for t = startT..H, cost, reachedGoal } or null if no move is possible
   */
  search({ start, goal, heuristic, constraints = null, startT = 0, heat = null, heatWeight = 0 }) {
    const { grid, H, g, parent, seen, closed, heap } = this;
    const N = grid.N;
    const gen = ++this.generation;
    heap.clear();

    const s0 = startT * N + start;
    g[s0] = 0;
    parent[s0] = -1;
    seen[s0] = gen;
    heap.push(s0, heuristic.h(start, goal), 0);

    while (heap.size > 0) {
      const s = heap.pop();
      if (closed[s] === gen) continue; // stale duplicate
      closed[s] = gen;
      this.expanded++;

      const t = Math.floor(s / N);
      const v = s - t * N;

      // (a) goal reached and the robot can park there  /  (b) end of window
      const atGoal = v === goal && (!constraints || constraints.canHoldGoal(v, t));
      if (atGoal || t === H) {
        return { path: this.buildPath(s, startT), cost: g[s] + (atGoal ? 0 : heuristic.h(v, goal)), reachedGoal: atGoal };
      }

      const nt = t + 1;
      const nbs = grid.neighbours[v];
      // successor k = -1 means WAIT, otherwise move to nbs[k]
      for (let k = -1; k < nbs.length; k++) {
        const u = k < 0 ? v : nbs[k];
        if (u !== v && u !== goal && !grid.isDrivable(u)) continue; // racks only as goal
        const hu = heuristic.h(u, goal);
        if (hu >= UNREACHABLE) continue;
        if (constraints) {
          if (constraints.vertexBlocked(u, nt)) continue;
          if (u !== v && constraints.edgeBlocked(v, u, nt)) continue;
        }
        const ns = nt * N + u;
        if (closed[ns] === gen) continue;
        const stepCost = 1 + (heat && u !== v ? heatWeight * heat[u] : 0);
        const ng = g[s] + stepCost;
        if (seen[ns] !== gen || ng < g[ns]) {
          seen[ns] = gen;
          g[ns] = ng;
          parent[ns] = s;
          heap.push(ns, ng + hu, ng);
        }
      }
    }
    return null; // every first move is blocked
  }

  /** Follow parent pointers back, then pad with the last cell up to time H (robot parks). */
  buildPath(s, startT) {
    const N = this.grid.N;
    const cells = [];
    for (let cur = s; cur !== -1; cur = this.parent[cur]) cells.push(cur % N);
    cells.reverse();
    const last = cells[cells.length - 1];
    while (cells.length < this.H - startT + 1) cells.push(last);
    return cells;
  }
}
