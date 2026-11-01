/**
 * Task assignment: which robot should take which order?
 *
 * 1. Greedy nearest-task (used by the baselines)
 *    Each free robot, in id order, takes the nearest open order.
 *    O(r * m) but can be far from optimal: an early robot may "steal"
 *    the order that a later robot was much closer to.
 *
 * 2. Hungarian algorithm (used by CA-RHPP)
 *    Finds the assignment with the MINIMUM TOTAL cost. Written by hand
 *    (Kuhn–Munkres with potentials, shortest augmenting path version).
 *    Time O(r^2 * m) for r robots and m orders (r <= m).
 */

/** Greedy: returns array where result[i] = chosen column for row i, or -1. */
export function greedyAssign(cost) {
  const rows = cost.length;
  if (rows === 0) return [];
  const cols = cost[0].length;
  const taken = new Uint8Array(cols);
  const result = new Array(rows).fill(-1);
  for (let i = 0; i < rows; i++) {
    let best = -1;
    for (let j = 0; j < cols; j++) {
      if (!taken[j] && (best === -1 || cost[i][j] < cost[i][best])) best = j;
    }
    if (best !== -1) { taken[best] = 1; result[i] = best; }
  }
  return result;
}

/**
 * Hungarian algorithm for a rows x cols cost matrix.
 * Returns result[i] = column assigned to row i (or -1 when rows > cols).
 */
export function hungarianAssign(cost) {
  const rows = cost.length;
  if (rows === 0) return [];
  const cols = cost[0].length;
  if (cols === 0) return new Array(rows).fill(-1);

  // The core routine needs rows <= cols; otherwise solve the transposed problem.
  if (rows > cols) {
    const transposed = Array.from({ length: cols }, (_, j) => cost.map((row) => row[j]));
    const colToRow = hungarianCore(transposed);
    const result = new Array(rows).fill(-1);
    colToRow.forEach((row, col) => { if (row >= 0) result[row] = col; });
    return result;
  }
  return hungarianCore(cost);
}

// n <= m. 1-indexed arrays, as in the classic formulation.
function hungarianCore(a) {
  const n = a.length;
  const m = a[0].length;
  const INF = Number.MAX_VALUE;
  const u = new Float64Array(n + 1); // row potentials
  const v = new Float64Array(m + 1); // column potentials
  const p = new Int32Array(m + 1);   // p[j] = row matched to column j
  const way = new Int32Array(m + 1); // previous column on the augmenting path

  for (let i = 1; i <= n; i++) {
    p[0] = i;
    let j0 = 0;
    const minv = new Float64Array(m + 1).fill(INF);
    const used = new Uint8Array(m + 1);
    // Dijkstra-like search for the shortest augmenting path from row i
    do {
      used[j0] = 1;
      const i0 = p[j0];
      let delta = INF;
      let j1 = 0;
      for (let j = 1; j <= m; j++) {
        if (used[j]) continue;
        const reduced = a[i0 - 1][j - 1] - u[i0] - v[j];
        if (reduced < minv[j]) { minv[j] = reduced; way[j] = j0; }
        if (minv[j] < delta) { delta = minv[j]; j1 = j; }
      }
      for (let j = 0; j <= m; j++) {
        if (used[j]) { u[p[j]] += delta; v[j] -= delta; } else minv[j] -= delta;
      }
      j0 = j1;
    } while (p[j0] !== 0);
    // flip the augmenting path
    do {
      const j1 = way[j0];
      p[j0] = p[j1];
      j0 = j1;
    } while (j0 !== 0);
  }

  const result = new Array(n).fill(-1);
  for (let j = 1; j <= m; j++) if (p[j] > 0) result[p[j] - 1] = j - 1;
  return result;
}
