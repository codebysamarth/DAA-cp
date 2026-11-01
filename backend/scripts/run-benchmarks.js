/**
 * Runs the full experiment suite and saves the results to results/report.json
 * (shown in the frontend instantly) and results/REPORT.md (for the project report).
 *
 *   npm run bench
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { compareAlgorithms, scalability, ablation } from '../src/simulation/benchmark.js';
import { ALGORITHMS } from '../src/planners/index.js';
import { MAPS } from '../src/core/maps.js';

const OUT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'results');
const TICKS = 300;
const SEEDS = 3;

const log = (msg) => console.log(`[${new Date().toLocaleTimeString()}] ${msg}`);

const report = { generatedAt: new Date().toISOString(), ticks: TICKS, seeds: SEEDS, compare: [], scalability: null, ablation: null };

for (const mapId of Object.keys(MAPS)) {
  const robots = MAPS[mapId].defaultRobots;
  log(`compare: ${mapId}, ${robots} robots`);
  report.compare.push(compareAlgorithms({ mapId, robots, ticks: TICKS, seeds: SEEDS }));
}

log('scalability: warehouse');
report.scalability = scalability({ mapId: 'warehouse', robotCounts: [4, 8, 12, 16, 20, 24, 28, 32], ticks: 150, seeds: 1 });

log('ablation: 3 scenarios');
report.ablation = ablation({ ticks: TICKS, seeds: SEEDS });

fs.mkdirSync(OUT, { recursive: true });
fs.writeFileSync(path.join(OUT, 'report.json'), JSON.stringify(report, null, 2));

/* ---------- markdown version ---------- */
const name = (id) => ALGORITHMS[id]?.short || id;
let md = `# Benchmark results\n\nGenerated ${report.generatedAt}. ${TICKS} ticks, averaged over ${SEEDS} seeds. Every number comes from actually running the algorithms.\n\n`;
for (const c of report.compare) {
  md += `## ${MAPS[c.mapId].name} (${c.robots} robots)\n\n`;
  md += '| Algorithm | Orders delivered | Avg order time (ticks) | Waiting % | Longest wait | Emergency stops | Plan time / tick (ms) | Nodes expanded |\n|---|---|---|---|---|---|---|---|\n';
  for (const r of c.results) {
    md += `| ${name(r.algorithm)} | ${r.completed} | ${r.avgServiceTime} | ${r.waitPercent} | ${r.worstWaitStreak} | ${r.emergencyStops} | ${r.planMsPerTick} | ${Math.round(r.nodesExpanded)} |\n`;
  }
  md += '\n';
}
md += `## Scalability (warehouse, plan time per tick in ms)\n\n| Robots | ${report.scalability.algorithms.map(name).join(' | ')} |\n|---|${report.scalability.algorithms.map(() => '---').join('|')}|\n`;
for (const row of report.scalability.rows) {
  md += `| ${row.robots} | ${report.scalability.algorithms.map((a) => row[a].planMsPerTick).join(' | ')} |\n`;
}
const scen = report.ablation.scenarios.map((s) => `${s.mapId} ${s.robots}`).join(', ');
md += `\n## Ablation (total over: ${scen})\n\n| Variant | Orders delivered | Waiting % | Longest wait | Plan time / tick (ms) | Nodes expanded |\n|---|---|---|---|---|---|\n`;
for (const r of report.ablation.results) {
  md += `| ${r.name} | ${r.completed} | ${r.waitPercent} | ${r.worstWaitStreak} | ${r.planMsPerTick} | ${r.nodesExpanded} |\n`;
}
fs.writeFileSync(path.join(OUT, 'REPORT.md'), md);
log(`saved results to ${OUT}`);
