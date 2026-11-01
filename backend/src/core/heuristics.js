/**
 * Heuristics for A*.
 *
 * 1. Manhattan distance  h(v) = |dx| + |dy|
 *    - admissible, but ignores racks and walls, so A* explores many useless cells.
 *
 * 2. True distance (our optimisation, also used by RHCR implementations)
 *    - one Breadth-First Search backwards from the goal gives the exact
 *      obstacle-aware distance from EVERY cell to that goal: O(|V| + |E|).
 *    - the table is cached per goal, so each goal is computed only once
 *      for the whole simulation. After that h(v) is a single array lookup.
 *    - it is the perfect heuristic when there are no other robots, so A*
 *      walks almost straight to the goal.
 */
import { CELL } from './Grid.js';

export const UNREACHABLE = 1e9;

export class TrueDistanceHeuristic {
  constructor(grid) {
    this.grid = grid;
    this.cache = new Map(); // goal id -> Int32Array of distances
    this.bfsRuns = 0;
  }

  /** Distance table to `goal` (BFS on first request, cached afterwards). */
  table(goal) {
    let dist = this.cache.get(goal);
    if (dist) return dist;

    const { grid } = this;
    dist = new Int32Array(grid.N).fill(UNREACHABLE);
    const queue = new Int32Array(grid.N); // array-based queue: O(1) push/pop
    let head = 0;
    let tail = 0;
    dist[goal] = 0;
    queue[tail++] = goal;

    while (head < tail) {
      const v = queue[head++];
      // Robots cannot drive THROUGH a rack, so a rack cell (other than the goal)
      // gets a distance but is never expanded further.
      if (v !== goal && grid.type[v] === CELL.RACK) continue;
      for (const u of grid.neighbours[v]) {
        if (dist[u] === UNREACHABLE) {
          dist[u] = dist[v] + 1;
          queue[tail++] = u;
        }
      }
    }
    this.cache.set(goal, dist);
    this.bfsRuns++;
    return dist;
  }

  h(cell, goal) {
    return this.table(goal)[cell];
  }
}

export class ManhattanHeuristic {
  constructor(grid) {
    this.grid = grid;
  }

  h(cell, goal) {
    return this.grid.manhattan(cell, goal);
  }
}
