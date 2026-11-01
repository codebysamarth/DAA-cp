/**
 * Space-Time Reservation Table.
 *
 * Stores who occupies cell v at time t, for t = 0..H (the planning window).
 * It is one flat Int32Array:  occ[t * N + v] = robotIndex + 1   (0 = free)
 *
 *  - check / reserve / free a (cell, time) pair: O(1), no strings, no hashing.
 *  - memory: O(|V| * H)
 *
 * Two kinds of collision are prevented:
 *  1. Vertex conflict: two robots in the same cell at the same time.
 *  2. Swap (edge) conflict: robots A (u -> v) and B (v -> u) at the same time.
 *     We detect it with the vertex table alone: the move u -> v at time t is a
 *     swap if the robot standing at v at time t-1 is the one standing at u at time t.
 */
export class ReservationTable {
  constructor(N, H) {
    this.N = N;
    this.H = H;
    this.occ = new Int32Array((H + 1) * N);
  }

  clear() {
    this.occ.fill(0);
  }

  /** robot index occupying (cell, t), or -1 */
  owner(cell, t) {
    return this.occ[t * this.N + cell] - 1;
  }

  vertexBlocked(cell, t) {
    return this.occ[t * this.N + cell] !== 0;
  }

  edgeBlocked(from, to, t) {
    const other = this.occ[(t - 1) * this.N + to];
    return other !== 0 && other === this.occ[t * this.N + from];
  }

  /** A robot that reaches its goal at time t must be able to stay there until H. */
  canHoldGoal(goal, t) {
    for (let k = t; k <= this.H; k++) {
      if (this.occ[k * this.N + goal] !== 0) return false;
    }
    return true;
  }

  /**
   * Reserve a path (path[k] = cell at time startT + k).
   * Cells already taken by someone else are skipped (only happens for the
   * "stay in place" fallback of a robot that found no path).
   */
  reservePath(robot, path, startT = 0) {
    const id = robot + 1;
    for (let k = 0; k < path.length; k++) {
      const idx = (startT + k) * this.N + path[k];
      if (this.occ[idx] === 0) this.occ[idx] = id;
    }
  }

  /** Remove a robot's reservations for times >= startT. */
  removePath(robot, path, startT = 0) {
    const id = robot + 1;
    for (let k = 0; k < path.length; k++) {
      const idx = (startT + k) * this.N + path[k];
      if (this.occ[idx] === id) this.occ[idx] = 0;
    }
  }
}
