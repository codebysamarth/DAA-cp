// Two tiny SVG charts, drawn by hand (no chart library).

/** Horizontal bar chart. data = [{ label, value, color }] */
export function BarChart({ title, data, unit = '', note }) {
  const max = Math.max(...data.map((d) => d.value), 1e-9);
  const rowH = 30;
  const labelW = 110;
  const width = 460;
  const barMax = width - labelW - 70;
  return (
    <div className="chart">
      <h3>{title}</h3>
      {note && <p className="hint">{note}</p>}
      <svg viewBox={`0 0 ${width} ${data.length * rowH + 8}`} role="img" aria-label={title}>
        {data.map((d, i) => {
          const y = i * rowH + 4;
          const w = Math.max(2, (d.value / max) * barMax);
          return (
            <g key={d.label}>
              <text x={labelW - 8} y={y + 17} textAnchor="end" fontSize="12" fill="#344054">{d.label}</text>
              <rect x={labelW} y={y + 4} width={w} height={rowH - 10} rx="4" fill={d.color} />
              <text x={labelW + w + 6} y={y + 17} fontSize="12" fill="#344054" fontWeight="600">
                {formatNum(d.value)}{unit}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

/** Line chart. series = [{ name, color, points: [{ x, y }] }]. logY = logarithmic y axis. */
export function LineChart({ title, series, xLabel, yLabel, logY = false, note }) {
  const W = 560, H = 300, L = 56, R = 16, T = 16, B = 44;
  const all = series.flatMap((s) => s.points);
  if (all.length === 0) return null;
  const xs = all.map((p) => p.x);
  const ys = all.map((p) => Math.max(p.y, logY ? 0.01 : 0));
  const xMin = Math.min(...xs), xMax = Math.max(...xs);
  const tf = (v) => (logY ? Math.log10(Math.max(v, 0.01)) : v);
  const yMin = logY ? Math.floor(Math.log10(Math.min(...ys))) : 0;
  const yMax = logY ? Math.ceil(Math.log10(Math.max(...ys))) : Math.max(...ys) * 1.1 || 1;
  const sx = (x) => L + ((x - xMin) / (xMax - xMin || 1)) * (W - L - R);
  const sy = (y) => T + (1 - (tf(y) - yMin) / (yMax - yMin || 1)) * (H - T - B);

  const yTicks = logY
    ? Array.from({ length: yMax - yMin + 1 }, (_, i) => 10 ** (yMin + i))
    : Array.from({ length: 5 }, (_, i) => (yMax * i) / 4);
  const xTicks = [...new Set(xs)].sort((a, b) => a - b);

  return (
    <div className="chart">
      <h3>{title}</h3>
      {note && <p className="hint">{note}</p>}
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={title}>
        {yTicks.map((v) => (
          <g key={v}>
            <line x1={L} x2={W - R} y1={sy(v)} y2={sy(v)} stroke="#eceef2" />
            <text x={L - 6} y={sy(v) + 4} textAnchor="end" fontSize="11" fill="#667085">{formatNum(v)}</text>
          </g>
        ))}
        {xTicks.map((v) => (
          <text key={v} x={sx(v)} y={H - B + 16} textAnchor="middle" fontSize="11" fill="#667085">{v}</text>
        ))}
        <text x={(L + W - R) / 2} y={H - 6} textAnchor="middle" fontSize="12" fill="#344054">{xLabel}</text>
        <text x={14} y={(T + H - B) / 2} textAnchor="middle" fontSize="12" fill="#344054" transform={`rotate(-90 14 ${(T + H - B) / 2})`}>{yLabel}</text>
        {series.map((s) => (
          <g key={s.name}>
            <polyline fill="none" stroke={s.color} strokeWidth="2.5" points={s.points.map((p) => `${sx(p.x)},${sy(p.y)}`).join(' ')} />
            {s.points.map((p) => <circle key={p.x} cx={sx(p.x)} cy={sy(p.y)} r="3.5" fill={s.color} />)}
          </g>
        ))}
      </svg>
      <div className="legend">
        {series.map((s) => <span key={s.name}><i className="swatch" style={{ background: s.color }} />{s.name}</span>)}
      </div>
    </div>
  );
}

export function formatNum(v) {
  if (v === null || v === undefined || Number.isNaN(v)) return '–';
  if (Math.abs(v) >= 1000) return Math.round(v).toLocaleString();
  if (Math.abs(v) >= 10) return (+v.toFixed(1)).toString();
  return (+v.toFixed(2)).toString();
}
