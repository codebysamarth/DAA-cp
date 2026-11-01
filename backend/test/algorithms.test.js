/**
 * Correctness tests for every hand-written algorithm.
 * Run with:  npm test     (uses Node's built-in test runner, no libraries)
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { MinHeap } from '../src/core/MinHeap.js';
import { Grid, loadGrid } from '../src/core/Grid.js';
import { TrueDistanceHeuristic, ManhattanHeuristic } from '../src/core/heuristics.js';
import { ReservationTable } from '../src/core/ReservationTable.js';
import { SpaceTimeAStar } from '../src/core/SpaceTimeAStar.js';
import { hungarianAssign, greedyAssign } from '../src/core/assignment.js';
import { createRng } from '../src/core/random.js';
import { Simulator } from '../src/simulation/Simulator.js';
import { ALGORITHMS } from '../src/planners/index.js';

test('MinHeap pops values in sorted order', () => {
  const rng = createRng(7);
  const heap = new MinHeap();
  const values = Array.from({ length: 500 }, () => rng.int(1000));
  values.forEach((v, i) => heap.push(i, v, 0));
  const out = [];
  while (heap.size) out.push(values[heap.pop()]);
  assert.deepEqual(out, [...values].sort((a, b) => a - b));
});

test('BFS heuristic is exact and never smaller than Manhattan', () => {
  const grid = loadGrid('warehouse');
  const bfs = new TrueDistanceHeuristic(grid);
  const man = new ManhattanHeuristic(grid);
  const goal = grid.stations[0];
  for (let c = 0; c < grid.N; c++) {
    if (!grid.isDrivable(c)) continue;
    assert.ok(bfs.h(c, goal) >= man.h(c, goal));
  }
  // walking around a rack block costs more than the straight-line distance
  const g = new Grid(['....', '.RR.', '....']);
  const h = new TrueDistanceHeuristic(g);
  assert.equal(h.h(g.width * 1 + 0, g.width * 1 + 3), 5); // (0,1) -> (3,1) must go around
});

test('Space-time A* finds a shortest path when the map is empty of robots', () => {
  const grid = loadGrid('warehouse');
  const bfs = new TrueDistanceHeuristic(grid);
  const astar = new SpaceTimeAStar(grid, 60);
  const rng = createRng(3);
  const free = [];
  for (let c = 0; c < grid.N; c++) if (grid.isDrivable(c)) free.push(c);
  for (let k = 0; k < 50; k++) {
    const s = free[rng.int(free.length)];
    const g = free[rng.int(free.length)];
    const res = astar.search({ start: s, goal: g, heuristic: bfs, constraints: new ReservationTable(grid.N, 60) });
    assert.ok(res.reachedGoal);
    assert.equal(res.cost, bfs.h(s, g));
  }
});

test('Reservation table blocks vertex and swap conflicts', () => {
  const table = new ReservationTable(10, 5);
  table.reservePath(0, [1, 2, 3]); // robot 0: cell 1 at t0, 2 at t1, 3 at t2
  assert.equal(table.vertexBlocked(2, 1), true);
  assert.equal(table.vertexBlocked(2, 2), false);
  assert.equal(table.edgeBlocked(2, 1, 1), true);  // 2 -> 1 at t1 would swap with robot 0
  assert.equal(table.edgeBlocked(5, 6, 1), false);
  table.removePath(0, [1, 2, 3]);
  assert.equal(table.vertexBlocked(2, 1), false);
});

test('A* plans around a reserved robot', () => {
  const g = new Grid(['.....', '.....']);
  const bfs = new TrueDistanceHeuristic(g);
  const astar = new SpaceTimeAStar(g, 10);
  const table = new ReservationTable(g.N, 10);
  table.reservePath(0, new Array(11).fill(2)); // a robot parked at (2,0)
  const res = astar.search({ start: 0, goal: 4, heuristic: bfs, constraints: table });
  assert.ok(res.reachedGoal);
  assert.ok(!res.path.includes(2));
  assert.equal(res.cost, 6); // 4 steps + 2 to go around via row 1
});

function bruteForceMin(cost) {
  const n = cost.length;
  const m = cost[0].length;
  let best = Infinity;
  const used = new Array(m).fill(false);
  const rec = (i, sum) => {
    if (i === n) { best = Math.min(best, sum); return; }
    for (let j = 0; j < m; j++) {
      if (used[j]) continue;
      used[j] = true;
      rec(i + 1, sum + cost[i][j]);
      used[j] = false;
    }
  };
  rec(0, 0);
  return best;
}

test('Hungarian algorithm matches brute force; greedy can be worse', () => {
  const rng = createRng(11);
  for (let trial = 0; trial < 200; trial++) {
    const n = 1 + rng.int(5);
    const m = n + rng.int(3);
    const cost = Array.from({ length: n }, () => Array.from({ length: m }, () => rng.int(20)));
    const assign = hungarianAssign(cost);
    assert.equal(new Set(assign).size, n); // every robot gets a different order
    const total = assign.reduce((s, j, i) => s + cost[i][j], 0);
    assert.equal(total, bruteForceMin(cost));
  }
  // classic counter-example for greedy
  const cost = [[1, 2], [2, 100]];
  const g = greedyAssign(cost);
  const h = hungarianAssign(cost);
  assert.equal(cost[0][g[0]] + cost[1][g[1]], 101);
  assert.equal(cost[0][h[0]] + cost[1][h[1]], 4);
});

test('Hungarian handles more robots than orders', () => {
  const assign = hungarianAssign([[5], [1], [3]]);
  assert.deepEqual(assign, [-1, 0, -1]);
});

for (const algorithm of Object.keys(ALGORITHMS)) {
  test(`${algorithm}: 200 ticks on every map with zero collisions`, () => {
    for (const mapId of ['warehouse', 'bottleneck', 'narrow']) {
      const sim = new Simulator({ mapId, algorithm, robots: 10, seed: 5 });
      const s = sim.run(200); // Simulator throws if two robots ever share a cell
      assert.equal(s.collisions, 0);
      if (algorithm !== 'independent') assert.ok(s.completed > 0, `${algorithm} delivered nothing on ${mapId}`);
    }
  });
}

test('Coordinated planners almost never need the emergency stop', () => {
  for (const algorithm of ['rhcr_pp', 'ca_rhpp']) {
    const s = new Simulator({ mapId: 'warehouse', algorithm, robots: 12, seed: 2 }).run(300);
    assert.ok(s.emergencyStops <= 3, `${algorithm} had ${s.emergencyStops} emergency stops`);
  }
});
