import { useState } from 'react';
import { api } from '../api.js';
import { BarChart, formatNum } from './charts.jsx';

const EXPLAIN = {
  ca_rhpp: 'The full algorithm.',
  no_hungarian: 'Robots take the nearest order (greedy) instead of the optimal Hungarian assignment.',
  no_dynamic: 'Robots plan in fixed id order instead of by priority score.',
  no_repair: 'Robots that find no path just wait; no local repair.',
  no_incremental: 'A robot with a new goal waits for the next replanning step (like RHCR).',
  manhattan: 'A* uses Manhattan distance instead of the cached BFS true distance.',
  with_congestion: 'Extra cost for entering busy cells inside A*. We tried this idea and it made results worse, so CA-RHPP does not use it.',
  rhcr_pp: 'The baseline we improve on, for reference.',
};

export default function AblationTab({ info, saved }) {
  const [live, setLive] = useState(null);
  const [running, setRunning] = useState(null);
  const [error, setError] = useState('');

  async function runLive() {
    setError('');
    const results = [];
    setLive({ results: [] });
    try {
      for (const v of info.ablations) {
        setRunning(v.name);
        results.push(await api.ablationOne({ variant: v.id, ticks: 300, seeds: 2 }));
        setLive({ results: [...results] });
      }
    } catch (e) {
      setError(e.message);
    }
    setRunning(null);
  }

  const data = live || saved?.ablation;
  const rows = data?.results || [];
  const full = rows.find((r) => r.id === 'ca_rhpp');
  const scen = info.ablationScenarios.map((s) => `${info.maps.find((m) => m.id === s.mapId)?.name} (${s.robots} robots)`).join(', ');

  return (
    <>
      <div className="card">
        <h2>Ablation study: which part of CA-RHPP actually helps?</h2>
        <p className="hint" style={{ margin: '4px 0 12px' }}>
          We switch off ONE feature at a time and measure again. Numbers are totals over three busy scenarios: {scen}.
        </p>
        <button className="btn primary" onClick={runLive} disabled={!!running}>{running ? `Running: ${running}…` : 'Run ablation now'}</button>
        {error && <p className="error" style={{ marginTop: 8 }}>{error}</p>}
      </div>

      {rows.length > 0 && (
        <>
          <div className="callout info">
            <b>What the numbers say:</b> incremental replanning is responsible for most of the extra throughput.
            Local repair, dynamic priority and Hungarian allocation change throughput only a little, but they keep the
            <b> longest wait</b> of any robot low (no starvation). The congestion penalty inside A* was a bad idea:
            robots preferred waiting over entering busy cells.
          </div>
          <div className="card table-wrap">
            <h3 style={{ marginBottom: 8 }}>{live ? 'Live run (2 seeds)' : `Saved results (${data.seeds} seeds, ${data.ticks} ticks)`}</h3>
            <table>
              <thead>
                <tr>
                  <th>Variant</th><th className="num">Orders delivered</th><th className="num">vs full</th>
                  <th className="num">Waiting %</th><th className="num">Longest wait</th><th className="num">Plan ms / tick</th>
                  <th className="num">A* nodes</th><th>What changes</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className={r.id === 'ca_rhpp' ? 'ours' : ''}>
                    <td>{r.name}</td>
                    <td className="num">{formatNum(r.completed)}</td>
                    <td className="num">{full && r.id !== 'ca_rhpp' ? pct(r.completed, full.completed) : ''}</td>
                    <td className="num">{formatNum(r.waitPercent)}</td>
                    <td className="num">{formatNum(r.worstWaitStreak)}</td>
                    <td className="num">{formatNum(r.planMsPerTick)}</td>
                    <td className="num">{formatNum(r.nodesExpanded)}</td>
                    <td style={{ whiteSpace: 'normal', minWidth: 260 }} className="hint">{EXPLAIN[r.id]}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="grid-2">
            <div className="card">
              <BarChart title="Orders delivered" data={rows.map((r) => ({ label: shortName(r), value: r.completed, color: r.id === 'ca_rhpp' ? '#4f46e5' : r.id === 'rhcr_pp' ? '#0284c7' : '#94a3b8' }))} />
            </div>
            <div className="card">
              <BarChart title="Longest wait of any robot (ticks)" data={rows.map((r) => ({ label: shortName(r), value: r.worstWaitStreak, color: r.id === 'ca_rhpp' ? '#4f46e5' : r.id === 'rhcr_pp' ? '#0284c7' : '#94a3b8' }))} />
            </div>
          </div>
        </>
      )}
    </>
  );
}

function shortName(r) {
  return { ca_rhpp: 'Full', no_hungarian: '−Hungarian', no_dynamic: '−Priority', no_repair: '−Repair', no_incremental: '−Incremental', manhattan: '−BFS h', with_congestion: '+Congestion', rhcr_pp: 'RHCR-PP' }[r.id] || r.id;
}

function pct(a, b) {
  const d = ((a - b) / b) * 100;
  return `${d >= 0 ? '+' : ''}${d.toFixed(1)}%`;
}
