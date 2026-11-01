/**
 * Windowed Conflict-Based Search (Sharon et al., AIJ 2015), used inside the
 * RHCR rolling-horizon framework.
 *
 * Two levels:
 *  - High level: best-first search over a "constraint tree". Each node holds a
 *    set of constraints + one path per robot; node cost = sum of path costs.
 *  - Low level: Space-Time A* for ONE robot that obeys that robot's constraints.
 *
 * Loop: pop the cheapest node, find the first conflict between two robots
 *  (a, b, cell, t). Split into two children: "a may not be at cell at t" and
 *  "b may not be at cell at t". Replan only the constrained robot in each child.
 *
 * Optimal (minimum sum of costs within the window) but the tree can grow
 * exponentially with the number of conflicts C:  O(2^C) nodes.
 * We therefore stop after MAX_NODES tree nodes or MAX_MS milliseconds and fall back
 * to prioritized planning – exactly the scalability wall the experiments show.
 */
import { SpaceTimeAStar } from '../core/SpaceTimeAStar.js';
import { TrueDistanceHeuristic } from '../core/heuristics.js';
import { MinHeap } from '../core/MinHeap.js';
import { allocateTasks } from './taskAllocation.js';
import { PrioritizedPlanner } from './PrioritizedPlanner.js';

const MAX_NODES = 300;
const MAX_MS = 100;

/** Constraints of ONE robot, in the same interface as the reservation table. */
class AgentConstraints {
  constructor(N, H) {
    this.N = N;
    this.H = H;
    this.vertex = new Set(); // key t*N + cell
    this.edge = new Set();   // key (t*N + from)*N + to
  }
  vertexBlocked(cell, t) { return this.vertex.has(t * this.N + cell); }
  edgeBlocked(from, to, t) { return this.edge.has((t * this.N + from) * this.N + to); }
  canHoldGoal(goal, t) {
    for (let k = t; k <= this.H; k++) if (this.vertex.has(k * this.N + goal)) return false;
    return true;
  }
}

export class CBSPlanner {
  constructor(grid, cfg) {
    this.grid = grid;
    this.cfg = cfg;
    this.H = cfg.horizon;
    this.replanEvery = cfg.replanEvery;
    this.dist = new TrueDistanceHeuristic(grid);
    this.astar = new SpaceTimeAStar(grid, this.H);
    this.supportsIncremental = false;
    // used only when CBS gives up
    this.fallback = new PrioritizedPlanner(grid, {
      horizon: this.H, replanEvery: this.replanEvery, heuristic: 'bfs', priority: 'fixed', assignment: 'greedy',
    });
    this.fallback.dist = this.dist;
    this.fallback.heuristic = this.dist;
    this.stats = { searches: 0, failedPlans: 0, cbsCalls: 0, cbsSolved: 0, cbsGiveUps: 0, cbsNodes: 0 };
  }

  get nodesExpanded() { return this.astar.expanded + this.fallback.astar.expanded; }

  assignTasks(sim, isReplanTick) {
    allocateTasks(sim, { mode: 'greedy', isReplanTick, dist: this.dist });
  }

  lowLevel(sim, i, constraints) {
    this.stats.searches++;
    const r = sim.robots[i];
    return this.astar.search({ start: r.cell, goal: sim.goalOf(r), heuristic: this.dist, constraints });
  }

  /** Build robot i's constraint set by walking up the constraint tree. */
  constraintsOf(node, i) {
    const c = new AgentConstraints(this.grid.N, this.H);
    for (let k = node.con; k; k = k.parent) {
      if (k.agent !== i) continue;
      if (k.from === undefined) c.vertex.add(k.t * this.grid.N + k.cell);
      else c.edge.add((k.t * this.grid.N + k.from) * this.grid.N + k.cell);
    }
    return c;
  }

  plan(sim) {
    const n = sim.robots.length;
    const N = this.grid.N;
    const t0 = performance.now();
    this.stats.cbsCalls++;

    // root: every robot takes its own shortest path
    const empty = new AgentConstraints(N, this.H);
    const root = { con: null, paths: new Array(n), costs: new Float64Array(n), cost: 0 };
    for (let i = 0; i < n; i++) {
      const res = this.lowLevel(sim, i, empty);
      if (!res) return this.giveUp(sim, 0); // robot is boxed in, CBS cannot start
      root.paths[i] = res.path;
      root.costs[i] = res.cost;
      root.cost += res.cost;
    }

    const nodes = [root];
    const open = new MinHeap();
    open.push(0, root.cost, -this.countConflicts(root.paths));
    let expandedNodes = 0;

    while (open.size > 0) {
      if (expandedNodes >= MAX_NODES || performance.now() - t0 > MAX_MS) break;
      const node = nodes[open.pop()];
      expandedNodes++;
      const conflict = this.firstConflict(node.paths);
      if (!conflict) {
        this.stats.cbsSolved++;
        this.stats.cbsNodes += expandedNodes;
        return node.paths;
      }

      // branch: forbid the conflict for robot a, or for robot b
      for (const side of [0, 1]) {
        const agent = side === 0 ? conflict.a : conflict.b;
        const con = conflict.type === 'vertex'
          ? { agent, cell: conflict.cell, t: conflict.t, parent: node.con }
          : { agent, from: side === 0 ? conflict.u : conflict.v, cell: side === 0 ? conflict.v : conflict.u, t: conflict.t, parent: node.con };
        const child = { con, paths: node.paths.slice(), costs: node.costs.slice(), cost: 0 };
        const res = this.lowLevel(sim, agent, this.constraintsOf(child, agent));
        if (!res) continue;
        child.paths[agent] = res.path;
        child.costs[agent] = res.cost;
        child.cost = node.cost - node.costs[agent] + res.cost;
        nodes.push(child);
        open.push(nodes.length - 1, child.cost, -this.countConflicts(child.paths));
      }
    }

    return this.giveUp(sim, expandedNodes);
  }

  /** tree too big -> prioritized planning instead */
  giveUp(sim, expandedNodes) {
    this.stats.cbsGiveUps++;
    this.stats.cbsNodes += expandedNodes;
    const paths = this.fallback.plan(sim);
    this.stats.failedPlans = this.fallback.stats.failedPlans;
    return paths;
  }

  /**
   * Scan time steps 0..H once, remembering who stands where: O(n * H).
   * (A naive pairwise check would be O(n^2 * H).)
   */
  scan(paths, onConflict) {
    const N = this.grid.N;
    const n = paths.length;
    const at = new Int32Array(N).fill(-1);     // robot at cell at time t
    const prevAt = new Int32Array(N).fill(-1); // robot at cell at time t-1
    for (let t = 0; t <= this.H; t++) {
      for (let i = 0; i < n; i++) {
        const c = paths[i][t];
        if (at[c] !== -1) {
          if (onConflict({ type: 'vertex', a: at[c], b: i, cell: c, t })) return;
        } else at[c] = i;
        if (t > 0) {
          const u = paths[i][t - 1];
          const j = prevAt[c]; // who stood at my new cell one step ago?
          // j < i so each swap is reported once
          if (u !== c && j !== -1 && j < i && paths[j][t] === u) {
            if (onConflict({ type: 'edge', a: i, b: j, u, v: c, t })) return;
          }
        }
      }
      for (let i = 0; i < n; i++) {
        if (t > 0) prevAt[paths[i][t - 1]] = -1;
      }
      for (let i = 0; i < n; i++) {
        prevAt[paths[i][t]] = i;
        at[paths[i][t]] = -1;
      }
    }
  }

  firstConflict(paths) {
    let found = null;
    this.scan(paths, (c) => { found = c; return true; });
    return found;
  }

  countConflicts(paths) {
    let count = 0;
    this.scan(paths, () => { count++; return false; });
    return count;
  }
}
