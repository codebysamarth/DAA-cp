import React, { useRef, useEffect, useState, useCallback } from 'react';
import { CELL_TYPES, DIRECTIONS } from '../algorithms/graph';
import { Layers, Eye, EyeOff, ZoomIn, ZoomOut, RotateCcw, ShieldCheck, MapPin } from './icons';

function safeRoundRect(ctx, x, y, width, height, radius = 4) {
  if (typeof ctx.roundRect === 'function') {
    ctx.roundRect(x, y, width, height, radius);
  } else {
    const r = Math.min(radius, width / 2, height / 2);
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + width - r, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + r);
    ctx.lineTo(x + width, y + height - r);
    ctx.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
    ctx.lineTo(x + r, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  }
}

export default function WarehouseCanvas({
  grid,
  racks,
  pickStations,
  depots,
  robots = [],
  reservationTable,
  selectedRobotId,
  onSelectRobot,
  showHeatmap,
  setShowHeatmap,
  showPaths,
  setShowPaths,
  currentAlgorithm,
}) {
  const containerRef = useRef(null);
  const canvasRef = useRef(null);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 20, y: 20 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [hoveredCell, setHoveredCell] = useState(null);

  const baseCellSize = 36;
  const cellSize = baseCellSize * zoom;

  // Auto-calculate zoom & pan to fit the entire warehouse grid inside the viewport
  const fitToScreen = useCallback(() => {
    if (!grid || !containerRef.current) return;
    const { clientWidth, clientHeight } = containerRef.current;
    if (!clientWidth || !clientHeight) return;

    const cols = grid[0]?.length || 26;
    const rows = grid.length || 16;

    const padding = 28;
    const availW = clientWidth - padding * 2;
    const availH = clientHeight - padding * 2;

    const optimalCell = Math.min(availW / cols, availH / rows);
    const newZoom = Math.max(0.4, Math.min(1.8, optimalCell / baseCellSize));

    const totalW = cols * baseCellSize * newZoom;
    const totalH = rows * baseCellSize * newZoom;

    const panX = Math.max(12, Math.round((clientWidth - totalW) / 2));
    const panY = Math.max(12, Math.round((clientHeight - totalH) / 2));

    setZoom(newZoom);
    setPan({ x: panX, y: panY });
  }, [grid, baseCellSize]);

  // Keep canvas buffer resolution in sync with container DOM size
  useEffect(() => {
    const syncCanvasSize = () => {
      if (containerRef.current && canvasRef.current) {
        const { clientWidth, clientHeight } = containerRef.current;
        if (clientWidth > 0 && clientHeight > 0) {
          canvasRef.current.width = clientWidth;
          canvasRef.current.height = clientHeight;
        }
      }
    };

    syncCanvasSize();
    fitToScreen();

    window.addEventListener('resize', syncCanvasSize);
    return () => window.removeEventListener('resize', syncCanvasSize);
  }, [fitToScreen]);

  // Auto-fit on scenario change
  useEffect(() => {
    const timer = setTimeout(() => {
      fitToScreen();
    }, 60);
    return () => clearTimeout(timer);
  }, [grid, fitToScreen]);

  // Mouse drag & pan handlers
  const handleMouseDown = (e) => {
    if (e.button === 0) {
      setIsDragging(true);
      setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
    }
  };

  const handleMouseMove = (e) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();

    if (isDragging) {
      setPan({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y,
      });
    }

    const mouseX = e.clientX - rect.left - pan.x;
    const mouseY = e.clientY - rect.top - pan.y;
    const cellX = Math.floor(mouseX / cellSize);
    const cellY = Math.floor(mouseY / cellSize);

    if (grid && cellY >= 0 && cellY < grid.length && cellX >= 0 && cellX < grid[0].length) {
      setHoveredCell({ x: cellX, y: cellY, type: grid[cellY][cellX] });
    } else {
      setHoveredCell(null);
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  // Wheel zoom
  const handleWheel = (e) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.08 : 0.08;
    setZoom((z) => Math.max(0.45, Math.min(2.0, z + delta)));
  };

  const handleCanvasClick = (e) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left - pan.x;
    const mouseY = e.clientY - rect.top - pan.y;
    const clickX = Math.floor(mouseX / cellSize);
    const clickY = Math.floor(mouseY / cellSize);

    const clickedRobot = robots.find(
      (r) => Math.round(r.x) === clickX && Math.round(r.y) === clickY
    );
    if (clickedRobot) {
      onSelectRobot(clickedRobot.id === selectedRobotId ? null : clickedRobot.id);
    } else {
      onSelectRobot(null);
    }
  };

  // Canvas Drawing Routine
  const render = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !grid) return;
    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;

    ctx.clearRect(0, 0, width, height);
    ctx.save();
    ctx.translate(pan.x, pan.y);

    const rows = grid.length;
    const cols = grid[0].length;

    // 1. Draw Grid Cells & Floor Infrastructure
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const x = c * cellSize;
        const y = r * cellSize;
        const type = grid[r][c];

        // Neutral clean tile
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(x, y, cellSize, cellSize);

        ctx.strokeStyle = '#f1f5f9';
        ctx.lineWidth = 1;
        ctx.strokeRect(x, y, cellSize, cellSize);

        // Render infrastructure components
        if (type === CELL_TYPES.RACK) {
          // Modern Storage Pod Shelf
          ctx.fillStyle = '#eff6ff';
          ctx.strokeStyle = '#bfdbfe';
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          safeRoundRect(ctx, x + 3, y + 3, cellSize - 6, cellSize - 6, 4);
          ctx.fill();
          ctx.stroke();

          ctx.fillStyle = '#3b82f6';
          ctx.font = `600 ${Math.max(8, Math.floor(9 * zoom))}px Inter, sans-serif`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText('POD', x + cellSize / 2, y + cellSize / 2);
        } else if (type === CELL_TYPES.PICK_STATION) {
          // Picking Station (Fulfillment Bay)
          ctx.fillStyle = '#ecfdf5';
          ctx.strokeStyle = '#34d399';
          ctx.lineWidth = 2;
          ctx.beginPath();
          safeRoundRect(ctx, x + 2, y + 2, cellSize - 4, cellSize - 4, 6);
          ctx.fill();
          ctx.stroke();

          ctx.fillStyle = '#059669';
          ctx.font = `bold ${Math.max(8, Math.floor(9 * zoom))}px Inter, sans-serif`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText('PICK', x + cellSize / 2, y + cellSize / 2);
        } else if (type === CELL_TYPES.DEPOT) {
          // Charging & Staging Bay
          ctx.fillStyle = '#f8fafc';
          ctx.strokeStyle = '#cbd5e1';
          ctx.lineWidth = 1;
          ctx.strokeRect(x + 2, y + 2, cellSize - 4, cellSize - 4);

          ctx.fillStyle = '#64748b';
          ctx.font = `${Math.max(7, Math.floor(8 * zoom))}px Inter, sans-serif`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText('DEPOT', x + cellSize / 2, y + cellSize / 2);
        } else if (type === CELL_TYPES.BLOCKED) {
          // Simulated Obstacle
          ctx.fillStyle = '#fef2f2';
          ctx.fillRect(x, y, cellSize, cellSize);
          ctx.strokeStyle = '#f87171';
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.moveTo(x, y);
          ctx.lineTo(x + cellSize, y + cellSize);
          ctx.moveTo(x + cellSize, y);
          ctx.lineTo(x, y + cellSize);
          ctx.stroke();
        }
      }
    }

    // 2. Space-Time Congestion Heatmap Overlay
    if (showHeatmap && reservationTable) {
      for (const [key, count] of reservationTable.spatialHeatmap.entries()) {
        const [cx, cy] = key.split(',').map(Number);
        const x = cx * cellSize;
        const y = cy * cellSize;

        const alpha = Math.min(0.55, 0.12 + count * 0.1);
        ctx.fillStyle = count > 3 ? `rgba(239, 68, 68, ${alpha})` : `rgba(245, 158, 11, ${alpha})`;
        ctx.fillRect(x, y, cellSize, cellSize);
      }
    }

    // 3. Multi-Agent Path Trajectories
    if (showPaths && robots) {
      robots.forEach((robot) => {
        if (!robot.path || robot.path.length <= 1) return;

        const isSelected = robot.id === selectedRobotId;
        ctx.strokeStyle = isSelected ? '#4f46e5' : 'rgba(99, 102, 241, 0.35)';
        ctx.lineWidth = isSelected ? 3 : 1.5;
        ctx.setLineDash(isSelected ? [] : [4, 4]);

        ctx.beginPath();
        ctx.moveTo(robot.x * cellSize + cellSize / 2, robot.y * cellSize + cellSize / 2);

        for (let i = 1; i < robot.path.length; i++) {
          const step = robot.path[i];
          ctx.lineTo(step.x * cellSize + cellSize / 2, step.y * cellSize + cellSize / 2);
        }
        ctx.stroke();
        ctx.setLineDash([]);

        // Target waypoint node
        const target = robot.path[robot.path.length - 1];
        if (target) {
          const tx = target.x * cellSize + cellSize / 2;
          const ty = target.y * cellSize + cellSize / 2;
          ctx.fillStyle = isSelected ? '#4f46e5' : '#818cf8';
          ctx.beginPath();
          ctx.arc(tx, ty, isSelected ? 5 : 3.5, 0, 2 * Math.PI);
          ctx.fill();
        }
      });
    }

    // 4. Autonomous Mobile Robots (AMRs)
    if (robots) {
      robots.forEach((robot) => {
        const rx = robot.x * cellSize;
        const ry = robot.y * cellSize;
        const isSelected = robot.id === selectedRobotId;

        // Selection glow ring
        if (isSelected) {
          ctx.strokeStyle = '#4f46e5';
          ctx.lineWidth = 2.5;
          ctx.beginPath();
          ctx.arc(rx + cellSize / 2, ry + cellSize / 2, cellSize / 2 + 3, 0, 2 * Math.PI);
          ctx.stroke();
        }

        // Color coding by operational state
        let strokeColor = '#4f46e5';
        if (robot.state === 'WAITING') {
          strokeColor = '#f59e0b';
        } else if (robot.state === 'CONFLICT') {
          strokeColor = '#ef4444';
        } else if (robot.carryingPod) {
          strokeColor = '#059669';
        }

        ctx.shadowColor = 'rgba(15, 23, 42, 0.12)';
        ctx.shadowBlur = 4;
        ctx.shadowOffsetY = 1.5;

        ctx.fillStyle = '#ffffff';
        ctx.strokeStyle = strokeColor;
        ctx.lineWidth = 2;
        ctx.beginPath();
        const pad = 3.5;
        safeRoundRect(ctx, rx + pad, ry + pad, cellSize - pad * 2, cellSize - pad * 2, 7);
        ctx.fill();
        ctx.stroke();

        ctx.shadowColor = 'transparent';

        // Orientation Heading Pointer
        const centerX = rx + cellSize / 2;
        const centerY = ry + cellSize / 2;
        const dir = DIRECTIONS[robot.heading || 0] || DIRECTIONS[1];

        ctx.fillStyle = strokeColor;
        ctx.beginPath();
        const pointerSize = 4.5;
        const tipX = centerX + dir.dx * (cellSize / 2 - 6);
        const tipY = centerY + dir.dy * (cellSize / 2 - 6);
        const leftX = centerX + dir.dy * pointerSize - dir.dx * pointerSize;
        const leftY = centerY - dir.dx * pointerSize - dir.dy * pointerSize;
        const rightX = centerX - dir.dy * pointerSize - dir.dx * pointerSize;
        const rightY = centerY + dir.dx * pointerSize - dir.dy * pointerSize;

        ctx.moveTo(tipX, tipY);
        ctx.lineTo(leftX, leftY);
        ctx.lineTo(rightX, rightY);
        ctx.closePath();
        ctx.fill();

        // Robot Identifier
        ctx.fillStyle = '#0f172a';
        ctx.font = `bold ${Math.max(8, Math.floor(9.5 * zoom))}px Inter, sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(robot.id.replace('ROBOT-', 'R'), centerX, centerY);
      });
    }

    // 5. Hover Cell Indicator
    if (hoveredCell) {
      ctx.strokeStyle = '#6366f1';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(hoveredCell.x * cellSize, hoveredCell.y * cellSize, cellSize, cellSize);
    }

    ctx.restore();
  }, [
    grid,
    robots,
    pan,
    zoom,
    cellSize,
    hoveredCell,
    showHeatmap,
    showPaths,
    selectedRobotId,
    reservationTable,
  ]);

  useEffect(() => {
    render();
  }, [render]);

  return (
    <div className="flex flex-col bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden w-full h-full">
      {/* 1. Dedicated Top Toolbar Header (Zero Overlap with Grid!) */}
      <div className="bg-slate-50/90 border-b border-slate-200 px-3.5 py-2 flex flex-wrap items-center justify-between gap-2 text-xs font-medium text-slate-700 select-none">
        {/* Left: Floor Coordinates & Live Telemetry Badge */}
        <div className="flex items-center gap-2">
          <span className="flex items-center gap-1 text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200 font-semibold">
            <ShieldCheck className="w-3.5 h-3.5 text-indigo-600" />
            Space-Time Grid
          </span>
          <span className="text-slate-300">|</span>
          <span className="font-mono text-slate-600">
            {grid ? `${grid[0].length}×${grid.length}` : '0×0'}
          </span>
          <span className="text-slate-300">|</span>
          <span className="font-mono text-slate-600">{robots.length} AMRs</span>
          {hoveredCell && (
            <>
              <span className="text-slate-300">|</span>
              <span className="text-slate-600 font-mono text-[11px] bg-white px-1.5 py-0.5 rounded border border-slate-200 flex items-center gap-1">
                <MapPin className="w-3 h-3 text-slate-400" />
                ({hoveredCell.x}, {hoveredCell.y}) • <span className="capitalize">{hoveredCell.type}</span>
              </span>
            </>
          )}
        </div>

        {/* Right: Map View Toggles & Zoom Controls */}
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setShowHeatmap(!showHeatmap)}
            title="Toggle Space-Time Congestion Heatmap"
            className={`px-2.5 py-1 rounded-md text-xs font-medium flex items-center gap-1 transition-colors ${
              showHeatmap
                ? 'bg-amber-100 text-amber-800 border border-amber-300 font-semibold shadow-2xs'
                : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
            }`}
          >
            <Layers className="w-3.5 h-3.5 text-amber-600" />
            Heatmap
          </button>

          <button
            onClick={() => setShowPaths(!showPaths)}
            title="Toggle Multi-Agent Collision-Free Path Trajectories"
            className={`px-2.5 py-1 rounded-md text-xs font-medium flex items-center gap-1 transition-colors ${
              showPaths
                ? 'bg-indigo-100 text-indigo-800 border border-indigo-300 font-semibold shadow-2xs'
                : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
            }`}
          >
            {showPaths ? (
              <Eye className="w-3.5 h-3.5 text-indigo-600" />
            ) : (
              <EyeOff className="w-3.5 h-3.5 text-slate-400" />
            )}
            Paths
          </button>

          <div className="w-px h-4 bg-slate-200 mx-0.5" />

          <button
            onClick={() => setZoom((z) => Math.min(2.0, z + 0.1))}
            title="Zoom In"
            className="p-1 bg-white border border-slate-200 rounded-md text-slate-600 hover:bg-slate-100 transition-colors"
          >
            <ZoomIn className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={() => setZoom((z) => Math.max(0.45, z - 0.1))}
            title="Zoom Out"
            className="p-1 bg-white border border-slate-200 rounded-md text-slate-600 hover:bg-slate-100 transition-colors"
          >
            <ZoomOut className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={fitToScreen}
            title="Fit Entire Warehouse Floor to Screen"
            className="px-2 py-1 bg-white border border-slate-200 rounded-md text-slate-700 hover:bg-slate-100 text-[11px] font-medium flex items-center gap-1 transition-colors"
          >
            <RotateCcw className="w-3 h-3 text-slate-500" />
            Fit
          </button>
        </div>
      </div>

      {/* 2. Main Interactive HTML5 Canvas Viewport */}
      <div
        ref={containerRef}
        onWheel={handleWheel}
        className="relative flex-1 w-full bg-slate-50 overflow-hidden"
      >
        <canvas
          ref={canvasRef}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onClick={handleCanvasClick}
          className="w-full h-full cursor-grab active:cursor-grabbing block"
        />
      </div>

      {/* 3. Bottom Infrastructure Legend */}
      <div className="bg-white border-t border-slate-200 px-4 py-2 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-600 select-none">
        <div className="flex flex-wrap items-center gap-3">
          <span className="font-semibold text-slate-800">Legend:</span>
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded bg-blue-50 border border-blue-300 inline-block" />
            Storage Pod
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded bg-emerald-50 border border-emerald-400 inline-block" />
            Picking Station
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded bg-slate-100 border border-slate-300 inline-block" />
            Depot Bay
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded bg-indigo-600 inline-block" />
            Active AMR
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded bg-amber-500 inline-block" />
            Waiting / Yielding
          </span>
        </div>
        <div className="text-slate-400 font-mono text-[11px]">
          Click robot to inspect • Drag to pan • Scroll to zoom
        </div>
      </div>
    </div>
  );
}
