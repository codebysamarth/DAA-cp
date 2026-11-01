import { useState } from 'react';
import { api } from '../api.js';
import { BarChart, formatNum } from './charts.jsx';

// Table columns: key, title, lower-is-better?
const COLUMNS = [
  ['completed', 'Orders delivered', false],
  ['avgServiceTime', 'Avg order time (ticks)', true],
  ['waitPercent', 'Waiting %', true],
  ['worstWaitStreak', 'Longest wait (ticks)', true],
  ['emergencyStops', 'Emergency stops', true],
  ['collisions', 'Collisions', true],
  ['planMsPerTick', 'Plan time / tick (ms)', true],
  ['planMsMax', 'Slowest replan (ms)', true],
  ['nodesExpanded', 'A* nodes expanded', true],
  ['cbsGiveUps', 'CBS gave up', true],
];

export default function CompareTab({ info, saved }) {
  const savedList = saved?.compare || [];
  const [mapId, setMapId] = useState(savedList[0]?.mapId || 'warehouse');
  const [robots, setRobots] = useState(12);
  const [ticks, setTicks] = useState(300);
  const [seeds, setSeeds] = useState(2);
  const [live, setLive] = useState(null); // { mapId, robots, ticks, seeds, results }
  const [running, setRunning] = useState(null);
  const [error, setError] = useState('');

  function changeMap(id) {
    setMapId(id);
    setRobots(info.maps.find((m) => m.id === id).defaultRobots);
    setLive(null);
  }

  async function runLive() {
    setError('');
    const params = { mapId, robots, ticks, seeds };
    const results = [];
    setLive({ ...params, results: [] });
    try {
      for (const a of info.algorithms) {
        setRunning(a.name);
        results.push(await api.compareOne({ ...params, algorithm: a.id }));
        setLive({ ...params, results: [...results] }); // table fills in one algorithm at a time
      }
    } catch (e) {
      setError(e.message);
    }
    setRunning(null);
  }

  const shown = live || savedList.find((c) => c.mapId === mapId) || savedList[0];
  const mapName = (id) => info.maps.find((m) => m.id === id)?.name || id;

  return (
    <>
      <div className="card">
        <div className="card-head">
          <div>
            <h2>Compare all 5 algorithms</h2>
            <p className="hint">Same map, same robots, same orders, same random seeds for every algorithm. Nothing is hard-coded: the backend really runs each algorithm.</p>
          </div>
        </div>
        <div className="controls">
          <label className="field">Map
            <select value={mapId} onChange={(e) => changeMap(e.target.value)}>
              {info.maps.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
            </select>
          </label>
          <label className="field">Robots<input type="number" min="1" max="40" value={robots} onChange={(e) => setRobots(+e.target.value)} /></label>
          <label className="field">Ticks<input type="number" min="50" max="1000" step="50" value={ticks} onChange={(e) => setTicks(+e.target.value)} /></label>
          <label className="field">Seeds (runs averaged)<input type="number" min="1" max="5" value={seeds} onChange={(e) => setSeeds(+e.target.value)} /></label>
          <button className="btn primary" onClick={runLive} disabled={!!running}>{running ? `Running ${running}…` : 'Run comparison now'}</button>
        </div>
        {error && <p className="error" style={{ marginTop: 8 }}>{error}</p>}
      </div>

      {shown && shown.results.length > 0 ? (
        <Results info={info} data={shown} label={live ? 'Live run' : `Saved results (npm run bench, ${saved.generatedAt?.slice(0, 10)})`} mapName={mapName(shown.mapId)} />
      ) : (
        !running && <div className="card hint">No saved results found. Click "Run comparison now" (or run <code>npm run bench</code> in backend/).</div>
      )}
    </>
  );
}

function Results({ info, data, label, mapName }) {
  const algo = (id) => info.algorithms.find((a) => a.id === id);
  const rows = data.results;
  const coordinated = rows.filter((r) => r.algorithm !== 'independent'); // best = among collision-avoiding planners
  const best = {};
  for (const [key, , lower] of COLUMNS) {
    const vals = coordinated.map((r) => r[key]).filter((v) => v !== null && v !== undefined);
    if (vals.length) best[key] = lower ? Math.min(...vals) : Math.max(...vals);
  }

  const ours = rows.find((r) => r.algorithm === 'ca_rhpp');
  const baselines = coordinated.filter((r) => r.algorithm !== 'ca_rhpp');
  const bestBase = baselines.length ? baselines.reduce((a, b) => (b.completed > a.completed ? b : a)) : null;

  const chartData = (key) => rows.map((r) => ({ label: algo(r.algorithm)?.short || r.algorithm, value: r[key] ?? 0, color: algo(r.algorithm)?.color || '#999' }));

  return (
    <>
      {ours && bestBase && (
        <div className="callout">
          <b>Result on {mapName}, {data.robots} robots:</b> CA-RHPP delivered <b>{formatNum(ours.completed)}</b> orders vs{' '}
          <b>{formatNum(bestBase.completed)}</b> for the best baseline ({algo(bestBase.algorithm)?.short}) —{' '}
          <b>{pct(ours.completed, bestBase.completed)}</b>. Robots waited <b>{ours.waitPercent}%</b> of the time instead of{' '}
          <b>{bestBase.waitPercent}%</b>, with <b>{ours.collisions}</b> collisions.
        </div>
      )}
      <div className="card">
        <div className="card-head">
          <h3>{label} · {mapName} · {data.robots} robots · {data.ticks} ticks · {data.seeds} seed(s)</h3>
          <span className="hint">green = best among coordinated planners</span>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr><th>Algorithm</th>{COLUMNS.map(([k, t]) => <th key={k} className="num">{t}</th>)}</tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.algorithm} className={r.algorithm === 'ca_rhpp' ? 'ours' : ''}>
                  <td><span className="dot" style={{ background: algo(r.algorithm)?.color }} />{algo(r.algorithm)?.name}</td>
                  {COLUMNS.map(([k]) => (
                    <td key={k} className={`num ${r.algorithm !== 'independent' && r[k] === best[k] ? 'best' : ''}`}>{formatNum(r[k])}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="hint" style={{ marginTop: 8 }}>
          <b>Emergency stops</b> = times the safety layer had to stop a robot because the plan would have crashed.
          Independent A* would crash constantly without it. <b>Longest wait</b> = longest time one robot stood still while it had work (starvation).
        </p>
      </div>
      <div className="grid-2">
        <div className="card"><BarChart title="Orders delivered (higher is better)" data={chartData('completed')} /></div>
        <div className="card"><BarChart title="Waiting time % (lower is better)" data={chartData('waitPercent')} unit="%" /></div>
        <div className="card"><BarChart title="Planning time per tick, ms (lower is better)" data={chartData('planMsPerTick')} unit=" ms" /></div>
        <div className="card"><BarChart title="A* nodes expanded (lower is better)" data={chartData('nodesExpanded')} /></div>
      </div>
    </>
  );
}

function pct(a, b) {
  if (!b) return '–';
  const d = ((a - b) / b) * 100;
  return `${d >= 0 ? '+' : ''}${d.toFixed(1)}%`;
}
