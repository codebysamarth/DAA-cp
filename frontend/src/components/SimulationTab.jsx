import { useEffect, useMemo, useRef, useState } from 'react';
import { api } from '../api.js';
import WarehouseCanvas, { COLORS } from './WarehouseCanvas.jsx';
import { formatNum } from './charts.jsx';

const SPEEDS = [1, 3, 6, 12, 24]; // ticks per second

export default function SimulationTab({ info }) {
  const [mapId, setMapId] = useState('warehouse');
  const [algorithm, setAlgorithm] = useState('ca_rhpp');
  const [robots, setRobots] = useState(12);
  const [ticks, setTicks] = useState(300);
  const [seed, setSeed] = useState(1);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [frameIdx, setFrameIdx] = useState(0);
  const [progress, setProgress] = useState(1);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(6);
  const [showPaths, setShowPaths] = useState(true);
  const [selected, setSelected] = useState(null);

  const map = info.maps.find((m) => m.id === (result?.mapId || mapId));
  const algo = info.algorithms.find((a) => a.id === (result?.algorithm || algorithm));

  async function run() {
    setLoading(true);
    setError('');
    setPlaying(false);
    try {
      const res = await api.simulate({ mapId, algorithm, robots, ticks, seed });
      setResult(res);
      setFrameIdx(0);
      setProgress(1);
      setSelected(null);
      setPlaying(true);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  // run once on first load so the page is never empty
  useEffect(() => { run(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // animation loop: advance `progress`, step to the next frame when it reaches 1
  const speedRef = useRef(speed);
  useEffect(() => { speedRef.current = speed; }, [speed]);
  const progressRef = useRef(0);
  useEffect(() => {
    if (!playing || !result) return;
    let last = performance.now();
    let raf;
    const loop = (now) => {
      progressRef.current += ((now - last) / 1000) * speedRef.current;
      last = now;
      if (progressRef.current >= 1) {
        progressRef.current = 0;
        setFrameIdx((i) => Math.min(i + 1, result.frames.length - 1));
      }
      setProgress(progressRef.current);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [playing, result]);

  // stop at the last frame
  useEffect(() => {
    if (result && frameIdx >= result.frames.length - 1) setPlaying(false);
  }, [frameIdx, result]);

  // orders delivered up to each tick (for the live counter)
  const deliveredUpTo = useMemo(() => {
    if (!result) return [];
    const arr = new Array(result.frames.length).fill(0);
    for (const e of result.events) if (e.text.includes('delivered') && e.t < arr.length) arr[e.t]++;
    for (let t = 1; t < arr.length; t++) arr[t] += arr[t - 1];
    return arr;
  }, [result]);

  const frame = result?.frames[frameIdx];
  const prevFrame = frameIdx > 0 ? result?.frames[frameIdx - 1] : null;
  const shownProgress = playing ? progress : 1;

  let moving = 0, waiting = 0, carrying = 0;
  if (frame) {
    frame.forEach((r, i) => {
      if (r[1]) carrying++;
      if (!prevFrame || !r[2]) return;
      if (prevFrame[i][0] === r[0]) waiting++;
      else moving++;
    });
  }

  const s = result?.summary;
  const visibleEvents = result ? result.events.filter((e) => e.t <= frameIdx).slice(-40).reverse() : [];
  const cellXY = (c) => `(${c % map.width}, ${Math.floor(c / map.width)})`;

  return (
    <>
      <div className="card">
        <div className="controls">
          <label className="field">Warehouse map
            <select value={mapId} onChange={(e) => { setMapId(e.target.value); setRobots(info.maps.find((m) => m.id === e.target.value).defaultRobots); }}>
              {info.maps.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
            </select>
          </label>
          <label className="field">Algorithm
            <select value={algorithm} onChange={(e) => setAlgorithm(e.target.value)}>
              {info.algorithms.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          </label>
          <label className="field">Robots
            <input type="number" min="1" max="40" value={robots} onChange={(e) => setRobots(+e.target.value)} />
          </label>
          <label className="field">Ticks
            <input type="number" min="10" max="1000" step="50" value={ticks} onChange={(e) => setTicks(+e.target.value)} />
          </label>
          <label className="field">Random seed
            <input type="number" min="1" value={seed} onChange={(e) => setSeed(+e.target.value)} />
          </label>
          <button className="btn primary" onClick={run} disabled={loading}>{loading ? 'Running…' : 'Run simulation'}</button>
        </div>
        {algo && <p className="hint" style={{ marginTop: 10 }}><b style={{ color: algo.color }}>{algo.name}:</b> {algo.idea}</p>}
        {error && <p className="error" style={{ marginTop: 8 }}>{error}</p>}
      </div>

      {result && map && (
        <div className="sim-layout">
          <div className="card">
            <WarehouseCanvas map={map} frame={frame} prevFrame={prevFrame} progress={shownProgress}
              robotNames={result.robotNames} showPaths={showPaths} selected={selected} onSelect={setSelected} />
            <div className="player">
              <button className="btn" onClick={() => {
                if (!playing && frameIdx >= result.frames.length - 1) setFrameIdx(0); // replay from start
                setPlaying(!playing);
              }}>{playing ? 'Pause' : 'Play'}</button>
              <button className="btn" onClick={() => { setPlaying(false); setFrameIdx((i) => Math.min(i + 1, result.frames.length - 1)); }}>Step +1</button>
              <input type="range" min="0" max={result.frames.length - 1} value={frameIdx}
                onChange={(e) => { setPlaying(false); setFrameIdx(+e.target.value); }} />
              <span className="mono">tick {frameIdx}/{result.frames.length - 1}</span>
              <label className="field" style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>Speed
                <select value={speed} onChange={(e) => setSpeed(+e.target.value)}>
                  {SPEEDS.map((v) => <option key={v} value={v}>{v} ticks/s</option>)}
                </select>
              </label>
              <label style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                <input type="checkbox" checked={showPaths} onChange={(e) => setShowPaths(e.target.checked)} /> Show planned paths
              </label>
            </div>
            <div className="legend">
              <span><i className="swatch" style={{ background: COLORS.toPickup, borderRadius: '50%' }} />going to shelf</span>
              <span><i className="swatch" style={{ background: COLORS.carrying, borderRadius: '50%' }} />carrying to station</span>
              <span><i className="swatch" style={{ background: COLORS.idle, borderRadius: '50%' }} />idle</span>
              <span><i className="swatch" style={{ background: '#fff', borderColor: COLORS.waiting, borderWidth: 2, borderRadius: '50%' }} />red ring = waiting</span>
              <span><i className="swatch" style={{ background: COLORS.rack }} />shelf (rack)</span>
              <span><i className="swatch" style={{ background: COLORS.station }} />picking station</span>
              <span><i className="swatch" style={{ background: COLORS.wall }} />wall</span>
              <span>□ = robot's goal · line = next 8 planned steps</span>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div className="card">
              <h3 style={{ marginBottom: 10 }}>Right now (tick {frameIdx})</h3>
              <div className="metrics">
                <Metric label="Orders delivered" value={deliveredUpTo[frameIdx]} />
                <Metric label="Moving" value={moving} />
                <Metric label="Waiting" value={waiting} />
                <Metric label="Carrying" value={carrying} />
              </div>
            </div>
            <div className="card">
              <h3 style={{ marginBottom: 10 }}>Whole run ({s.ticks} ticks)</h3>
              <div className="metrics">
                <Metric label="Orders delivered" value={s.completed} sub={`${s.throughput} per 100 ticks`} />
                <Metric label="Collisions" value={s.collisions} sub="guaranteed 0" />
                <Metric label="Emergency stops" value={s.emergencyStops} sub="planner mistakes" />
                <Metric label="Waiting time" value={`${s.waitPercent}%`} sub={`longest: ${s.maxWaitStreak} ticks`} />
                <Metric label="Plan time / tick" value={`${formatNum(s.planMsPerTick)} ms`} sub={`max ${formatNum(s.planMsMax)} ms`} />
                <Metric label="A* nodes expanded" value={formatNum(s.nodesExpanded)} sub={`${s.searches} searches`} />
              </div>
            </div>
            <div className="card">
              {selected !== null && frame ? (
                <>
                  <h3>Robot {result.robotNames[selected]}</h3>
                  <p className="hint" style={{ marginTop: 4 }}>
                    at {cellXY(frame[selected][0])} ·{' '}
                    {frame[selected][1] ? 'carrying order to station' : frame[selected][2] ? 'driving to shelf' : 'idle'}
                    {frame[selected][2] ? ` · goal ${cellXY(frame[selected][3])}` : ''}
                  </p>
                </>
              ) : <p className="hint">Click a robot on the map to follow it.</p>}
            </div>
            <div className="card">
              <h3 style={{ marginBottom: 6 }}>Event log</h3>
              <div className="log mono">
                {visibleEvents.length === 0 && <div className="hint">No events yet.</div>}
                {visibleEvents.map((e, k) => <div key={k}><span className="t">t={e.t}</span>{e.text}</div>)}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function Metric({ label, value, sub }) {
  return (
    <div className="metric">
      <div className="label">{label}</div>
      <div className="value">{value}</div>
      {sub && <div className="sub">{sub}</div>}
    </div>
  );
}
