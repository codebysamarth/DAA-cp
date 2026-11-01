import { useEffect, useRef, useState } from 'react';

// Colours of map cells and robots (also used by the legend).
export const COLORS = {
  free: '#ffffff',
  rack: '#cbd5e1',
  station: '#86efac',
  depot: '#e0e7ff',
  wall: '#334155',
  toPickup: '#2563eb',
  carrying: '#f59e0b',
  idle: '#94a3b8',
  waiting: '#dc2626',
};

const CELL_COLOR = { '.': COLORS.free, R: COLORS.rack, S: COLORS.station, D: COLORS.depot, '#': COLORS.wall };

/**
 * Draws the warehouse and the robots for one frame.
 * Robots slide smoothly from `prevFrame` to `frame` using `progress` (0..1).
 * A frame entry is [cell, carrying, hasTask, goal, ...next planned cells].
 */
export default function WarehouseCanvas({ map, frame, prevFrame, progress, robotNames, showPaths, selected, onSelect }) {
  const canvasRef = useRef(null);
  const wrapRef = useRef(null);
  const [width, setWidth] = useState(800);

  // keep the canvas as wide as its container
  useEffect(() => {
    const obs = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width));
    obs.observe(wrapRef.current);
    return () => obs.disconnect();
  }, []);

  const cs = Math.max(8, Math.floor(width / map.width)); // cell size in px
  const W = cs * map.width;
  const H = cs * map.height;

  useEffect(() => {
    const canvas = canvasRef.current;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    const ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const cx = (cell) => (cell % map.width) * cs + cs / 2;
    const cy = (cell) => Math.floor(cell / map.width) * cs + cs / 2;

    // 1. floor
    for (let y = 0; y < map.height; y++) {
      for (let x = 0; x < map.width; x++) {
        const ch = map.rows[y][x];
        ctx.fillStyle = CELL_COLOR[ch] || COLORS.free;
        ctx.fillRect(x * cs, y * cs, cs, cs);
        ctx.strokeStyle = '#eef0f3';
        ctx.strokeRect(x * cs + 0.5, y * cs + 0.5, cs - 1, cs - 1);
        if (ch === 'S') {
          ctx.fillStyle = '#065f46';
          ctx.font = `bold ${Math.floor(cs * 0.45)}px system-ui`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText('S', x * cs + cs / 2, y * cs + cs / 2);
        }
      }
    }
    if (!frame) return;

    // 2. planned paths and goals
    frame.forEach((r, i) => {
      const isSel = selected === i;
      if (!showPaths && !isSel) return;
      const [cell, carrying, hasTask, goal, ...next] = r;
      const color = carrying ? COLORS.carrying : COLORS.toPickup;
      if (next.length && hasTask) {
        ctx.strokeStyle = color;
        ctx.globalAlpha = isSel ? 0.9 : 0.35;
        ctx.lineWidth = isSel ? 3 : 2;
        ctx.beginPath();
        ctx.moveTo(cx(cell), cy(cell));
        for (const c of next) ctx.lineTo(cx(c), cy(c));
        ctx.stroke();
      }
      if (hasTask) {
        ctx.globalAlpha = isSel ? 1 : 0.5;
        ctx.strokeStyle = color;
        ctx.lineWidth = 2;
        const gx = cx(goal), gy = cy(goal), s = cs * 0.3;
        ctx.strokeRect(gx - s, gy - s, 2 * s, 2 * s);
      }
      ctx.globalAlpha = 1;
    });

    // 3. robots (interpolated between previous and current frame)
    frame.forEach((r, i) => {
      const [cell, carrying, hasTask] = r;
      const prevCell = prevFrame ? prevFrame[i][0] : cell;
      const x = cx(prevCell) + (cx(cell) - cx(prevCell)) * progress;
      const y = cy(prevCell) + (cy(cell) - cy(prevCell)) * progress;
      const waiting = hasTask && prevFrame && prevCell === cell;
      ctx.beginPath();
      ctx.arc(x, y, cs * 0.38, 0, Math.PI * 2);
      ctx.fillStyle = carrying ? COLORS.carrying : hasTask ? COLORS.toPickup : COLORS.idle;
      ctx.fill();
      ctx.lineWidth = selected === i ? 3 : 2;
      ctx.strokeStyle = selected === i ? '#111827' : waiting ? COLORS.waiting : '#ffffff';
      ctx.stroke();
      ctx.fillStyle = '#fff';
      ctx.font = `bold ${Math.floor(cs * 0.36)}px system-ui`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(String(i + 1), x, y + 0.5);
    });
  }, [map, frame, prevFrame, progress, showPaths, selected, cs, W, H]);

  // click a robot to select it
  const handleClick = (e) => {
    if (!frame) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const x = Math.floor(((e.clientX - rect.left) / rect.width) * map.width);
    const y = Math.floor(((e.clientY - rect.top) / rect.height) * map.height);
    const idx = frame.findIndex((r) => r[0] === y * map.width + x);
    onSelect(idx === -1 || idx === selected ? null : idx);
  };

  return (
    <div ref={wrapRef}>
      <canvas ref={canvasRef} className="floor" style={{ width: W, height: H }} onClick={handleClick}
        title={robotNames ? 'Click a robot to follow it' : ''} />
    </div>
  );
}
