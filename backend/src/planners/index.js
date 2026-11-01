/**
 * All algorithms in one place: name, settings, complexity, source paper.
 *
 * Symbols used in the complexity column:
 *   n = robots, m = open orders, |V| = grid cells, H = planning window,
 *   C = conflicts (CBS), k = repair group size (<= 4), R = repair tries (<= 5)
 */
import { PrioritizedPlanner } from './PrioritizedPlanner.js';
import { CBSPlanner } from './CBSPlanner.js';

const WINDOW = 20;      // H: plan 20 steps ahead
const REPLAN_EVERY = 5; // h: replan every 5 ticks

const CA_RHPP_CONFIG = {
  horizon: WINDOW,
  replanEvery: REPLAN_EVERY,
  heuristic: 'bfs',
  priority: 'dynamic',
  assignment: 'hungarian',
  reassign: true,
  // A congestion penalty inside A* was tested and made results WORSE
  // (robots preferred waiting over entering busy cells). See the ablation table.
  congestionWeight: 0,
  localRepair: true,
  incremental: true,
};

export const ALGORITHMS = {
  independent: {
    name: 'Independent A*',
    short: 'Indep. A*',
    color: '#e11d48',
    source: 'Hart, Nilsson & Raphael (1968)',
    idea: 'Every robot plans its own shortest path and ignores the others. Shows why coordination is needed: the safety layer has to emergency-stop robots all the time.',
    time: 'O(n · |V| log |V|) per replan',
    space: 'O(|V|)',
    optimal: 'Optimal per robot, not collision-free',
    config: { horizon: 'full', replanEvery: REPLAN_EVERY, heuristic: 'manhattan', priority: 'fixed', assignment: 'greedy', coordinate: false },
  },
  standard_pp: {
    name: 'Standard Prioritized Planning',
    short: 'Standard PP',
    color: '#059669',
    source: 'Erdmann & Lozano-Pérez (1987); Silver (2005)',
    idea: 'Robots plan full paths one by one in a fixed order (robot id). Later robots avoid earlier ones using a space-time reservation table.',
    time: 'O(n · T|V| log(T|V|)),  T = full path length',
    space: 'O(T · |V|)',
    optimal: 'Suboptimal, incomplete',
    config: { horizon: 'full', replanEvery: REPLAN_EVERY, heuristic: 'manhattan', priority: 'fixed', assignment: 'greedy' },
  },
  rhcr_pp: {
    name: 'RHCR with PP',
    short: 'RHCR-PP',
    color: '#0284c7',
    source: 'Li et al., AAAI 2021',
    idea: 'Rolling horizon: only resolve collisions for the next H = 20 steps, replan every h = 5 ticks. Fixed priority order, greedy task allocation.',
    time: 'O(n · H|V| log(H|V|)) per replan',
    space: 'O(H · |V|)',
    optimal: 'Suboptimal, incomplete',
    config: { horizon: WINDOW, replanEvery: REPLAN_EVERY, heuristic: 'bfs', priority: 'fixed', assignment: 'greedy' },
  },
  cbs: {
    name: 'Windowed CBS',
    short: 'CBS',
    color: '#d97706',
    source: 'Sharon et al., AIJ 2015 (inside RHCR)',
    idea: 'Optimal two-level search: a constraint tree over conflicts, A* per robot. Best path quality, but the tree grows exponentially, so it gives up after 300 nodes / 100 ms and falls back to PP.',
    time: 'O(2^C · H|V| log(H|V|)) per replan',
    space: 'O(2^C · n · H)',
    optimal: 'Optimal within the window (if it finishes)',
    config: { horizon: WINDOW, replanEvery: REPLAN_EVERY },
  },
  ca_rhpp: {
    name: 'CA-RHPP (ours)',
    short: 'CA-RHPP',
    color: '#4f46e5',
    source: 'This project',
    idea: 'RHCR + Hungarian congestion-aware task allocation + dynamic priorities with aging + selective local repair + incremental replanning, on top of a cached BFS true-distance heuristic.',
    time: 'O(n²m + n log n + (n + Rk) · H|V| log(H|V|)) per replan',
    space: 'O(H · |V| + G · |V|),  G = distinct goals cached',
    optimal: 'Suboptimal, starvation-free by aging',
    config: CA_RHPP_CONFIG,
  },
};

/** Ablation study: CA-RHPP with one improvement switched off at a time. */
export const ABLATIONS = {
  ca_rhpp: { name: 'CA-RHPP (all features)', config: CA_RHPP_CONFIG },
  no_hungarian: { name: '− Hungarian allocation (greedy instead)', config: { ...CA_RHPP_CONFIG, assignment: 'greedy', reassign: false } },
  no_dynamic: { name: '− dynamic priority (fixed order)', config: { ...CA_RHPP_CONFIG, priority: 'fixed' } },
  no_repair: { name: '− local repair', config: { ...CA_RHPP_CONFIG, localRepair: false } },
  no_incremental: { name: '− incremental replanning', config: { ...CA_RHPP_CONFIG, incremental: false } },
  manhattan: { name: '− BFS heuristic (Manhattan instead)', config: { ...CA_RHPP_CONFIG, heuristic: 'manhattan' } },
  with_congestion: { name: '+ congestion cost in A* (tested, rejected)', config: { ...CA_RHPP_CONFIG, congestionWeight: 0.3 } },
};

/** Create a planner object for an algorithm id (or ablation id). */
export function createPlanner(id, grid, overrides = {}) {
  const entry = ALGORITHMS[id] || ABLATIONS[id];
  if (!entry) throw new Error(`Unknown algorithm "${id}"`);
  const cfg = { ...entry.config, ...overrides };
  return id === 'cbs' ? new CBSPlanner(grid, cfg) : new PrioritizedPlanner(grid, cfg);
}

/** Public info for the frontend (no functions). */
export function algorithmInfo() {
  return Object.entries(ALGORITHMS).map(([id, a]) => ({
    id, name: a.name, short: a.short, color: a.color, source: a.source,
    idea: a.idea, time: a.time, space: a.space, optimal: a.optimal,
  }));
}
