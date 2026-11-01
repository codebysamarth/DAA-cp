import { useState } from 'react';
import { api } from '../api.js';
import { LineChart, formatNum } from './charts.jsx';

export default function ScalabilityTab({ info, saved }) {
  const [mapId, setMapId] = useState('warehouse');
  const [counts, setCounts] = useState('4, 8, 12, 16, 20, 24, 28, 32');
  const [live, setLive] = useState(null);
  const [running, setRunning] = useState(null);
  const [error, setError] = useState('');

  async function runLive() {
    setError('');
    const robotCounts = counts.split(',').map((s) => parseInt(s, 10)).filter((n) => n > 0 && n <= 40);
    const merged = { mapId, ticks: 150, algorithms: [], rows: robotCounts.map((robots) => ({ robots })) };
    setLive(merged);
    try {
      for (const a of info.algorithms) {
        setRunning(a.name);
        const res = await api.scalabilityOne({ mapId, robotCounts, ticks: 150, algorithm: a.id });
        merged.algorithms = [...merged.algorithms, a.id];
        res.rows.forEach((row, i) => { merged.rows[i][a.id] = row[a.id]; });
        setLive({ ...merged, rows: merged.rows.map((r) => ({ ...r })) });
      }
    } catch (e) {
      setError(e.message);
    }
    setRunning(null);
  }

  const data = live || saved?.scalability;
  const algo = (id) => info.algorithms.find((a) => a.id === id);
  const series = (key) => (data?.algorithms || []).map((id) => ({
    name: algo(id).short,
    color: algo(id).color,
    points: data.rows.filter((r) => r[id]).map((r) => ({ x: r.robots, y: r[id][key] })),
  }));

  return (
    <>
      <div className="card">
        <h2>Scalability: what happens as the fleet grows?</h2>
        <p className="hint" style={{ marginBottom: 12 }}>
          Each algorithm is run with more and more robots (150 ticks each). This is the experimental check of the
          time complexities on the "How it works" tab.
        </p>
        <div className="controls">
          <label className="field">Map
            <select value={mapId} onChange={(e) => setMapId(e.target.value)}>
              {info.maps.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
            </select>
          </label>
          <label className="field">Robot counts<input style={{ minWidth: 220 }} value={counts} onChange={(e) => setCounts(e.target.value)} /></label>
          <button className="btn primary" onClick={runLive} disabled={!!running}>{running ? `Running ${running}…` : 'Run scalability test now'}</button>
        </div>
        {error && <p className="error" style={{ marginTop: 8 }}>{error}</p>}
      </div>

      {data && data.algorithms.length > 0 && (
        <>
          <div className="callout info">
            <b>How to read this:</b> prioritized planners (RHCR-PP, CA-RHPP) grow roughly linearly with the number of robots,
            because each robot runs one bounded A* search. Standard PP is slower because it plans complete paths instead of a
            20-step window. CBS is capped by its node limit – when it hits the cap it gives up and falls back to PP
            (see the "CBS gave up" column), which is the exponential wall in practice.
          </div>
          <div className="grid-2">
            <div className="card"><LineChart title="Planning time per tick (ms, log scale)" series={series('planMsPerTick')} xLabel="number of robots" yLabel="ms per tick" logY /></div>
            <div className="card"><LineChart title="Orders delivered per 100 ticks" series={series('throughput')} xLabel="number of robots" yLabel="orders / 100 ticks" /></div>
          </div>
          <div className="card table-wrap">
            <h3 style={{ marginBottom: 8 }}>{live ? 'Live run' : 'Saved results'} · {info.maps.find((m) => m.id === data.mapId)?.name}</h3>
            <table>
              <thead>
                <tr><th>Robots</th>{data.algorithms.map((id) => <th key={id} className="num">{algo(id).short}: ms/tick</th>)}<th className="num">CBS gave up / calls</th></tr>
              </thead>
              <tbody>
                {data.rows.map((r) => (
                  <tr key={r.robots}>
                    <td>{r.robots}</td>
                    {data.algorithms.map((id) => <td key={id} className="num">{formatNum(r[id]?.planMsPerTick)}</td>)}
                    <td className="num">{r.cbs ? `${formatNum(r.cbs.cbsGiveUps)} / ${formatNum(r.cbs.cbsCalls)}` : '–'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </>
  );
}
