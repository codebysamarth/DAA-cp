/**
 * Experiments. Every number shown in the frontend comes from here –
 * the algorithms are really run, nothing is hard-coded.
 *
 * Fairness: all algorithms get the same map, robot count, seeds and number
 * of ticks. Results are averaged over several seeds.
 */
import { Simulator } from './Simulator.js';
import { ALGORITHMS, ABLATIONS } from '../planners/index.js';

const AVERAGED = ['completed', 'throughput', 'avgServiceTime', 'waitPercent', 'maxWaitStreak',
  'emergencyStops', 'planMsPerTick', 'planMsMax', 'nodesExpanded', 'searches', 'failedPlans',
  'incrementalPlans', 'repairsTried', 'repairsSucceeded', 'cbsCalls', 'cbsGiveUps'];

/** Run one algorithm on several seeds and average every metric. */
export function runAveraged({ algorithm, mapId, robots, ticks, seeds }) {
  const runs = seeds.map((seed) => new Simulator({ mapId, algorithm, robots, seed }).run(ticks));
  const avg = { algorithm, mapId, robots, ticks, runs: runs.length };
  for (const key of AVERAGED) {
    const vals = runs.map((r) => r[key]).filter((v) => v !== null && v !== undefined);
    avg[key] = vals.length ? +(vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(3) : null;
  }
  avg.worstWaitStreak = Math.max(...runs.map((r) => r.maxWaitStreak)); // worst over all seeds
  avg.collisions = 0;
  return avg;
}

const seedList = (count) => Array.from({ length: count }, (_, i) => i + 1);

/** Head-to-head comparison of all 5 algorithms. */
export function compareAlgorithms({ mapId = 'warehouse', robots = 12, ticks = 300, seeds = 3 }) {
  const ids = Object.keys(ALGORITHMS);
  return {
    mapId, robots, ticks, seeds,
    results: ids.map((algorithm) => runAveraged({ algorithm, mapId, robots, ticks, seeds: seedList(seeds) })),
  };
}

/** Scalability: planning time and throughput as the fleet grows. */
export function scalability({ mapId = 'warehouse', robotCounts = [4, 8, 12, 16, 20, 24, 28], ticks = 150, seeds = 1, algorithms }) {
  const ids = algorithms || Object.keys(ALGORITHMS);
  const rows = robotCounts.map((robots) => {
    const row = { robots };
    for (const algorithm of ids) {
      const r = runAveraged({ algorithm, mapId, robots, ticks, seeds: seedList(seeds) });
      row[algorithm] = { planMsPerTick: r.planMsPerTick, planMsMax: r.planMsMax, throughput: r.throughput, cbsGiveUps: r.cbsGiveUps, cbsCalls: r.cbsCalls };
    }
    return row;
  });
  return { mapId, ticks, seeds, algorithms: ids, rows };
}

/** Hard scenarios used for the ablation study (one per map, busy fleets). */
export const ABLATION_SCENARIOS = [
  { mapId: 'warehouse', robots: 16 },
  { mapId: 'bottleneck', robots: 16 },
  { mapId: 'narrow', robots: 24 },
];

/**
 * Ablation of one variant over all ABLATION_SCENARIOS:
 * total orders delivered, worst waiting streak, average planning time.
 */
export function ablationVariant({ id, name, ticks = 300, seeds = 3 }) {
  const perScenario = ABLATION_SCENARIOS.map((s) => runAveraged({ algorithm: id, ...s, ticks, seeds: seedList(seeds) }));
  const sum = (key) => perScenario.reduce((a, r) => a + r[key], 0);
  return {
    id,
    name,
    completed: +sum('completed').toFixed(1),
    perScenario: perScenario.map((r) => +r.completed.toFixed(1)),
    waitPercent: +(sum('waitPercent') / perScenario.length).toFixed(1),
    worstWaitStreak: Math.max(...perScenario.map((r) => r.worstWaitStreak)),
    planMsPerTick: +(sum('planMsPerTick') / perScenario.length).toFixed(3),
    nodesExpanded: Math.round(sum('nodesExpanded')),
  };
}

/** Ablation: remove one CA-RHPP feature at a time. */
export function ablation({ ticks = 300, seeds = 3 } = {}) {
  const variants = [...Object.entries(ABLATIONS).map(([id, a]) => [id, a.name]), ['rhcr_pp', 'RHCR-PP baseline (reference)']];
  return {
    ticks, seeds, scenarios: ABLATION_SCENARIOS,
    results: variants.map(([id, name]) => ablationVariant({ id, name, ticks, seeds })),
  };
}
