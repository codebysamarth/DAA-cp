/**
 * REST API server – uses only Node's built-in `http` module (no Express).
 *
 *   GET  /api/info          maps + algorithm descriptions
 *   POST /api/simulate      run one algorithm, return every frame for the animation
 *   POST /api/compare       compare algorithms (all, or one if `algorithm` is given)
 *   POST /api/scalability   planning time vs number of robots
 *   POST /api/ablation      CA-RHPP with one feature removed at a time
 *   GET  /api/results       saved results from `npm run bench`
 *
 * In production it also serves the built frontend (../frontend/dist).
 */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { MAPS } from './src/core/maps.js';
import { loadGrid } from './src/core/Grid.js';
import { Simulator } from './src/simulation/Simulator.js';
import { runAveraged, compareAlgorithms, scalability, ablation, ablationVariant, ABLATION_SCENARIOS } from './src/simulation/benchmark.js';
import { ALGORITHMS, ABLATIONS, algorithmInfo } from './src/planners/index.js';

const PORT = process.env.PORT || 5000;
const ROOT = path.dirname(fileURLToPath(import.meta.url));
const DIST = path.join(ROOT, '..', 'frontend', 'dist');
const RESULTS = path.join(ROOT, 'results', 'report.json');

/* ---------- input validation ---------- */
const clamp = (v, lo, hi, def) => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.max(lo, Math.min(hi, Math.round(n))) : def;
};
function mapIdOf(body) {
  if (!MAPS[body.mapId]) throw new HttpError(400, `Unknown map "${body.mapId}"`);
  return body.mapId;
}
function algorithmOf(id, allowAblation = false) {
  if (ALGORITHMS[id] || (allowAblation && ABLATIONS[id])) return id;
  throw new HttpError(400, `Unknown algorithm "${id}"`);
}
class HttpError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

/* ---------- route handlers ---------- */
const routes = {
  'GET /api/info': () => ({
    maps: Object.entries(MAPS).map(([id, m]) => {
      const g = loadGrid(id);
      return { id, name: m.name, description: m.description, defaultRobots: m.defaultRobots, width: g.width, height: g.height, rows: m.rows };
    }),
    algorithms: algorithmInfo(),
    ablations: [...Object.entries(ABLATIONS).map(([id, a]) => ({ id, name: a.name })), { id: 'rhcr_pp', name: 'RHCR-PP baseline (reference)' }],
    ablationScenarios: ABLATION_SCENARIOS,
  }),

  'POST /api/simulate': (body) => {
    const mapId = mapIdOf(body);
    const algorithm = algorithmOf(body.algorithm);
    const robots = clamp(body.robots, 1, 40, MAPS[mapId].defaultRobots);
    const ticks = clamp(body.ticks, 10, 1000, 300);
    const seed = clamp(body.seed, 1, 1e6, 1);
    const sim = new Simulator({ mapId, algorithm, robots, seed, record: true });
    const summary = sim.run(ticks);
    return {
      mapId, algorithm, robots, ticks, seed, summary,
      robotNames: sim.robots.map((r) => r.name),
      frames: sim.frames,   // frames[t][robot] = [cell, carrying, hasTask, goal, ...next cells]
      events: sim.events,
      series: sim.series,
    };
  },

  'POST /api/compare': (body) => {
    const mapId = mapIdOf(body);
    const robots = clamp(body.robots, 1, 40, MAPS[mapId].defaultRobots);
    const ticks = clamp(body.ticks, 50, 1000, 300);
    const seeds = clamp(body.seeds, 1, 5, 2);
    if (body.algorithm) {
      const algorithm = algorithmOf(body.algorithm);
      return runAveraged({ algorithm, mapId, robots, ticks, seeds: Array.from({ length: seeds }, (_, i) => i + 1) });
    }
    return compareAlgorithms({ mapId, robots, ticks, seeds });
  },

  'POST /api/scalability': (body) => {
    const mapId = mapIdOf(body);
    const ticks = clamp(body.ticks, 50, 500, 150);
    const robotCounts = (Array.isArray(body.robotCounts) ? body.robotCounts : [4, 8, 12, 16, 20, 24, 28])
      .map((n) => clamp(n, 1, 40, 4)).slice(0, 10);
    const algorithms = body.algorithm ? [algorithmOf(body.algorithm)] : undefined;
    return scalability({ mapId, robotCounts, ticks, seeds: 1, algorithms });
  },

  // runs over the 3 fixed ablation scenarios (see benchmark.js)
  'POST /api/ablation': (body) => {
    const ticks = clamp(body.ticks, 50, 1000, 300);
    const seeds = clamp(body.seeds, 1, 5, 2);
    if (body.variant) {
      const id = algorithmOf(body.variant, true);
      const name = ABLATIONS[id]?.name || 'RHCR-PP baseline (reference)';
      return ablationVariant({ id, name, ticks, seeds });
    }
    return ablation({ ticks, seeds });
  },

  'GET /api/results': () => {
    if (!fs.existsSync(RESULTS)) throw new HttpError(404, 'No saved results yet. Run "npm run bench" in backend/.');
    return JSON.parse(fs.readFileSync(RESULTS, 'utf8'));
  },
};

/* ---------- plumbing ---------- */
function readJson(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (chunk) => {
      data += chunk;
      if (data.length > 1e6) reject(new HttpError(413, 'Request too large'));
    });
    req.on('end', () => {
      try { resolve(data ? JSON.parse(data) : {}); } catch { reject(new HttpError(400, 'Invalid JSON')); }
    });
  });
}

function send(res, status, body, type = 'application/json') {
  res.writeHead(status, { 'Content-Type': type, 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type' });
  res.end(type === 'application/json' ? JSON.stringify(body) : body);
}

const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.json': 'application/json' };

function serveStatic(req, res) {
  if (!fs.existsSync(DIST)) {
    return send(res, 200, 'Backend is running. Start the frontend with "npm run dev" in frontend/, or build it with "npm run build".', 'text/plain');
  }
  const urlPath = decodeURIComponent(req.url.split('?')[0]);
  let file = path.normalize(path.join(DIST, urlPath));
  if (!file.startsWith(DIST)) return send(res, 403, 'Forbidden', 'text/plain');
  if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) file = path.join(DIST, 'index.html');
  send(res, 200, fs.readFileSync(file), MIME[path.extname(file)] || 'application/octet-stream');
}

const server = http.createServer(async (req, res) => {
  if (req.method === 'OPTIONS') return send(res, 204, '', 'text/plain');
  const route = routes[`${req.method} ${req.url.split('?')[0]}`];
  if (!route) {
    if (req.url.startsWith('/api/')) return send(res, 404, { error: 'Not found' });
    return serveStatic(req, res);
  }
  const t0 = performance.now();
  try {
    const body = req.method === 'POST' ? await readJson(req) : {};
    const result = route(body);
    send(res, 200, result);
    console.log(`${req.method} ${req.url} ${Math.round(performance.now() - t0)} ms`);
  } catch (err) {
    const status = err.status || 500;
    if (status === 500) console.error(err);
    send(res, status, { error: err.message });
  }
});

server.listen(PORT, () => {
  console.log(`SmartStock backend running on http://localhost:${PORT}`);
});
