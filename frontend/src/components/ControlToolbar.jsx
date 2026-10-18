import {
  Play,
  Pause,
  SkipForward,
  RotateCcw,
  Flame,
  PlusCircle,
  AlertOctagon,
} from './icons';
import { SCENARIOS } from '../algorithms/graph';
import { ALGORITHM_TYPES, ALGORITHM_INFO } from '../algorithms/baselines';

export default function ControlToolbar({
  isRunning,
  onTogglePlay,
  onStepForward,
  onReset,
  speed,
  setSpeed,
  currentScenario,
  onChangeScenario,
  currentAlgorithm,
  onChangeAlgorithm,
  onInjectBlockage,
  onTriggerOrderSurge,
  onAddRobots,
}) {
  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-3 flex flex-wrap items-center justify-between gap-3 text-xs">
      {/* 1. Simulation Playback Controls */}
      <div className="flex items-center gap-1.5">
        <button
          onClick={onTogglePlay}
          className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg font-semibold text-xs transition-all shadow-2xs ${
            isRunning
              ? 'bg-amber-500 hover:bg-amber-600 text-white'
              : 'bg-indigo-600 hover:bg-indigo-700 text-white'
          }`}
        >
          {isRunning ? (
            <>
              <Pause className="w-3.5 h-3.5 fill-current" />
              Pause
            </>
          ) : (
            <>
              <Play className="w-3.5 h-3.5 fill-current" />
              Simulate
            </>
          )}
        </button>

        <button
          onClick={onStepForward}
          disabled={isRunning}
          title="Step Forward Single Tick"
          className="flex items-center gap-1 px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-medium transition-colors disabled:opacity-40"
        >
          <SkipForward className="w-3.5 h-3.5" />
          Step
        </button>

        <button
          onClick={onReset}
          title="Reset Simulation State"
          className="flex items-center gap-1 px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-medium transition-colors"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          Reset
        </button>

        <div className="w-px h-5 bg-slate-200 mx-1" />

        {/* Speed Selector */}
        <div className="flex items-center gap-1 text-slate-500 font-medium">
          <span>Speed:</span>
          {[1, 2, 5, 10].map((s) => (
            <button
              key={s}
              onClick={() => setSpeed(s)}
              className={`px-2 py-1 rounded text-[11px] font-semibold font-mono transition-colors ${
                speed === s
                  ? 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              {s}x
            </button>
          ))}
        </div>
      </div>

      {/* 2. Algorithm & Scenario Selectors */}
      <div className="flex items-center gap-3">
        {/* Scenario Dropdown */}
        <div className="flex items-center gap-1.5">
          <span className="text-slate-500 font-medium">Layout:</span>
          <select
            value={currentScenario}
            onChange={(e) => onChangeScenario(e.target.value)}
            className="bg-slate-50 border border-slate-200 text-slate-800 text-xs rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-500 font-medium"
          >
            {Object.values(SCENARIOS).map((sc) => (
              <option key={sc.id} value={sc.id}>
                {sc.name}
              </option>
            ))}
          </select>
        </div>

        {/* Algorithm Dropdown */}
        <div className="flex items-center gap-1.5">
          <span className="text-slate-500 font-medium">Algorithm:</span>
          <select
            value={currentAlgorithm}
            onChange={(e) => onChangeAlgorithm(e.target.value)}
            className="bg-slate-50 border border-slate-200 text-slate-800 text-xs rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-500 font-semibold"
          >
            {Object.values(ALGORITHM_INFO).map((alg) => (
              <option key={alg.id} value={alg.id}>
                {alg.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* 3. Real-Time Dynamic Stress Events */}
      <div className="flex items-center gap-1.5">
        <button
          onClick={onTriggerOrderSurge}
          title="Inject an immediate burst of customer orders"
          className="flex items-center gap-1 px-2.5 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded-lg text-xs font-medium transition-colors"
        >
          <Flame className="w-3.5 h-3.5 text-blue-600" />
          Surge Demand (+10)
        </button>

        <button
          onClick={onInjectBlockage}
          title="Temporarily block a corridor cell to test adaptive replanning"
          className="flex items-center gap-1 px-2.5 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 rounded-lg text-xs font-medium transition-colors"
        >
          <AlertOctagon className="w-3.5 h-3.5 text-amber-600" />
          Block Aisle
        </button>

        <button
          onClick={onAddRobots}
          title="Add +2 AGVs into the fleet"
          className="flex items-center gap-1 px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-medium transition-colors"
        >
          <PlusCircle className="w-3.5 h-3.5" />
          +2 AMRs
        </button>
      </div>
    </div>
  );
}
