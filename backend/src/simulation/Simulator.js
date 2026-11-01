/**
 * Lifelong warehouse simulation (Multi-Agent Pickup and Delivery).
 *
 * Every tick:
 *   1. release new orders (keep n open orders)
 *   2. assign orders to free robots            (planner Stage 1)
 *   3. replan paths every h ticks              (planner Stages 2-4)
 *      or, for CA-RHPP, replan just the robots whose goal changed
 *   4. move every robot one step through the SAFETY LAYER
 *   5. pick up / deliver, update statistics
 *
 * Safety layer: before moving, check the joint move. A robot that would enter a
 * taken cell or swap with another robot is stopped (emergency stop). Repeated
 * until nothing changes, so the result is ALWAYS collision-free. Each stop is
 * counted: a good planner should almost never need it.
 */
import { loadGrid, CELL } from '../core/Grid.js';
import { createRng } from '../core/random.js';
import { createPlanner } from '../planners/index.js';

export class Simulator {
  constructor({ mapId = 'warehouse', algorithm = 'ca_rhpp', robots = 12, seed = 1, record = false, overrides = {} }) {
    this.grid = loadGrid(mapId);
    this.algorithm = algorithm;
    this.planner = createPlanner(algorithm, this.grid, overrides);
    this.rng = createRng(seed);
    this.record = record;
    this.tick = 0;
    this.lastPlanTick = -Infinity;
    this.needReplan = true;
    this.pending = [];
    this.nextOrderId = 1;
    this.priorityScores = null;

    this.robots = this.spawnRobots(robots);
    this.metrics = {
      completed: 0, serviceTimeSum: 0, waitTicks: 0, maxWaitStreak: 0, emergencyStops: 0,
      fullPlans: 0, incrementalPlans: 0, planMsTotal: 0, planMsMax: 0,
    };
    this.frames = [];
    this.events = [];
    this.series = [];
    if (record) this.saveFrame();
  }

  /* ---------------- setup ---------------- */
  spawnRobots(count) {
    const g = this.grid;
    const free = [];
    for (let c = 0; c < g.N; c++) if (g.type[c] === CELL.FREE && !g.depots.includes(c)) free.push(c);
    const cells = [...g.depots, ...this.rng.shuffle(free)].slice(0, count);
    return cells.map((cell, i) => ({
      id: i, name: `R${String(i + 1).padStart(2, '0')}`, cell,
      task: null, carrying: false, path: [cell],
      legWait: 0, waitStreak: 0, goalDirty: true, assignedAt: 0,
    }));
  }

  goalOf(r) {
    if (!r.task) return r.cell; // no order: park where you are
    return r.carrying ? r.task.station : r.task.pod;
  }

  /** number of robots within 2 cells of `cell` */
  crowdAround(cell) {
    let k = 0;
    for (const r of this.robots) if (this.grid.manhattan(r.cell, cell) <= 2) k++;
    return k - 1;
  }

  /** Keep n open orders. A shelf is skipped while another robot is going to it or standing in it. */
  releaseOrders() {
    const g = this.grid;
    const busy = new Set();
    for (const o of this.pending) busy.add(o.pod);
    for (const r of this.robots) {
      busy.add(r.cell);
      if (r.task && !r.carrying) busy.add(r.task.pod);
    }
    let guard = 0;
    while (this.pending.length < this.robots.length && guard++ < 200) {
      const pod = g.racks[this.rng.int(g.racks.length)];
      if (busy.has(pod)) continue;
      busy.add(pod);
      const station = g.stations[this.rng.int(g.stations.length)];
      this.pending.push({ id: this.nextOrderId++, pod, station, releasedAt: this.tick });
    }
  }

  /* ---------------- one tick ---------------- */
  step() {
    const { planner } = this;
    this.releaseOrders();

    const isReplanTick = this.needReplan || this.tick - this.lastPlanTick >= planner.replanEvery;
    planner.assignTasks(this, isReplanTick);

    const t0 = performance.now();
    if (isReplanTick) {
      const paths = planner.plan(this);
      this.robots.forEach((r, i) => { r.path = paths[i]; r.goalDirty = false; });
      this.lastPlanTick = this.tick;
      this.needReplan = false;
      this.metrics.fullPlans++;
    } else if (planner.supportsIncremental) {
      const offset = this.tick - this.lastPlanTick;
      this.robots.forEach((r, i) => {
        if (!r.goalDirty) return;
        const p = planner.replanSingle(this, i, offset);
        if (p) { r.path = p; r.goalDirty = false; this.metrics.incrementalPlans++; }
      });
    }
    const ms = performance.now() - t0;
    this.metrics.planMsTotal += ms;
    if (ms > this.metrics.planMsMax) this.metrics.planMsMax = ms;

    this.moveRobots();
    this.tick++;
    if (this.record) this.saveFrame();
    if (this.tick % 10 === 0) this.series.push({ t: this.tick, completed: this.metrics.completed });
  }

  /* ---------------- safety layer + movement ---------------- */
  moveRobots() {
    const robots = this.robots;
    const n = robots.length;
    const want = robots.map((r) => (r.path.length > 1 ? r.path[1] : r.cell));
    const moving = robots.map((r, i) => want[i] !== r.cell);
    const intended = moving.slice();

    let changed = true;
    while (changed) {
      changed = false;
      const claim = new Map(); // cell -> robot
      for (let i = 0; i < n; i++) if (!moving[i]) claim.set(robots[i].cell, i);
      for (let i = 0; i < n; i++) {
        if (!moving[i]) continue;
        if (claim.has(want[i])) { moving[i] = false; changed = true; } // vertex conflict
        else claim.set(want[i], i);
      }
      const standingAt = new Map(robots.map((r, i) => [r.cell, i]));
      for (let i = 0; i < n; i++) {
        if (!moving[i]) continue;
        const j = standingAt.get(want[i]);
        if (j !== undefined && moving[j] && want[j] === robots[i].cell) { // swap conflict
          moving[i] = false; moving[j] = false; changed = true;
        }
      }
    }

    for (let i = 0; i < n; i++) {
      const r = robots[i];
      if (intended[i] && !moving[i]) {           // emergency stop: plan is now out of date
        this.metrics.emergencyStops++;
        this.needReplan = true;
      } else if (r.path.length > 1) {
        r.path = r.path.slice(1);
      }
      const moved = moving[i];
      if (moved) r.cell = want[i];

      // waiting statistics (only robots that have work to do)
      if (r.task && !moved) {
        r.legWait++;
        r.waitStreak++;
        this.metrics.waitTicks++;
        if (r.waitStreak > this.metrics.maxWaitStreak) this.metrics.maxWaitStreak = r.waitStreak;
      } else r.waitStreak = 0;

      // pick-up / delivery
      if (r.task && !r.carrying && r.cell === r.task.pod) {
        r.carrying = true;
        r.legWait = 0;
        r.goalDirty = true;
        this.log(`${r.name} picked up order #${r.task.id}`);
      } else if (r.task && r.carrying && r.cell === r.task.station) {
        this.metrics.completed++;
        this.metrics.serviceTimeSum += this.tick + 1 - r.task.releasedAt;
        this.log(`${r.name} delivered order #${r.task.id}`);
        r.task = null;
        r.carrying = false;
        r.legWait = 0;
        r.goalDirty = true;
      }
    }
    this.assertNoCollision();
  }

  assertNoCollision() {
    const seen = new Set();
    for (const r of this.robots) {
      if (seen.has(r.cell)) throw new Error(`Collision at cell ${r.cell} (tick ${this.tick})`);
      seen.add(r.cell);
    }
  }

  log(text) {
    if (this.record && this.events.length < 2000) this.events.push({ t: this.tick + 1, text });
  }

  /** compact snapshot for the frontend: [cell, carrying, hasTask, goal, next path cells...] */
  saveFrame() {
    this.frames.push(this.robots.map((r) => [
      r.cell, r.carrying ? 1 : 0, r.task ? 1 : 0, this.goalOf(r), ...r.path.slice(1, 9),
    ]));
  }

  run(ticks) {
    for (let k = 0; k < ticks; k++) this.step();
    return this.summary(ticks);
  }

  summary(ticks) {
    const m = this.metrics;
    const p = this.planner;
    const n = this.robots.length;
    return {
      algorithm: this.algorithm,
      ticks,
      robots: n,
      completed: m.completed,
      throughput: +(m.completed * 100 / ticks).toFixed(2),                     // orders per 100 ticks
      avgServiceTime: m.completed ? +(m.serviceTimeSum / m.completed).toFixed(1) : null,
      waitPercent: +(m.waitTicks * 100 / (n * ticks)).toFixed(1),              // % of robot-time spent waiting
      maxWaitStreak: m.maxWaitStreak,                                          // longest stuck period
      emergencyStops: m.emergencyStops,
      collisions: 0,                                                           // guaranteed by safety layer
      planMsPerTick: +(m.planMsTotal / ticks).toFixed(3),
      planMsMax: +m.planMsMax.toFixed(2),
      fullPlans: m.fullPlans,
      incrementalPlans: m.incrementalPlans,
      nodesExpanded: p.nodesExpanded,
      searches: p.stats.searches,
      failedPlans: p.stats.failedPlans,
      repairsTried: p.stats.repairsTried ?? null,
      repairsSucceeded: p.stats.repairsSucceeded ?? null,
      cbsCalls: p.stats.cbsCalls ?? null,
      cbsGiveUps: p.stats.cbsGiveUps ?? null,
    };
  }
}
