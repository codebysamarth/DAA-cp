import { X, Battery, MapPin, Compass, Clock, Award, PackageCheck } from './icons';
import { DIRECTIONS } from '../algorithms/graph';

export default function RobotInspector({ robot, onClose, onPriorityBoost }) {
  if (!robot) return null;

  const dirName = DIRECTIONS[robot.heading || 0]?.name || 'North';

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-lg p-4 flex flex-col gap-3 animate-in fade-in duration-200">
      <div className="flex items-center justify-between pb-2 border-b border-slate-100">
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-full bg-indigo-600 animate-pulse" />
          <h3 className="font-bold text-slate-900 text-sm">{robot.id} Telemetry & Planning State</h3>
        </div>
        <button
          onClick={onClose}
          className="text-slate-400 hover:text-slate-600 p-1 rounded-md transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="grid grid-cols-2 gap-2 text-xs">
        <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-100 flex items-center gap-2">
          <MapPin className="w-4 h-4 text-indigo-500" />
          <div>
            <div className="text-slate-400 text-[10px] uppercase font-semibold">Coordinates</div>
            <div className="font-mono font-bold text-slate-800">
              ({robot.x}, {robot.y})
            </div>
          </div>
        </div>

        <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-100 flex items-center gap-2">
          <Compass className="w-4 h-4 text-blue-500" />
          <div>
            <div className="text-slate-400 text-[10px] uppercase font-semibold">Orientation</div>
            <div className="font-bold text-slate-800">{dirName}</div>
          </div>
        </div>

        <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-100 flex items-center gap-2">
          <Clock className="w-4 h-4 text-amber-500" />
          <div>
            <div className="text-slate-400 text-[10px] uppercase font-semibold">Wait Idle Ticks</div>
            <div className="font-mono font-bold text-slate-800">{robot.waitTicks} ticks</div>
          </div>
        </div>

        <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-100 flex items-center gap-2">
          <Battery className="w-4 h-4 text-emerald-500" />
          <div>
            <div className="text-slate-400 text-[10px] uppercase font-semibold">Battery / Health</div>
            <div className="font-bold text-slate-800">98% Nominal</div>
          </div>
        </div>
      </div>

      {/* Dynamic Priority Score Breakdown */}
      <div className="bg-indigo-50/60 p-3 rounded-lg border border-indigo-100">
        <div className="flex items-center justify-between text-xs font-semibold text-indigo-900 mb-2">
          <span className="flex items-center gap-1.5">
            <Award className="w-3.5 h-3.5 text-indigo-600" />
            Dynamic Priority Score
          </span>
          <span className="font-mono text-sm font-bold text-indigo-600">
            {robot.priorityScore?.total?.toFixed(1) || '10.0'}
          </span>
        </div>

        <div className="space-y-1.5 text-[11px] text-slate-600 font-mono">
          <div className="flex justify-between">
            <span>Wait Time Weight (w₁ × wait):</span>
            <span className="font-medium text-slate-900">
              +{(robot.priorityScore?.breakdown?.waitScore || robot.waitTicks * 1.5).toFixed(1)}
            </span>
          </div>
          <div className="flex justify-between">
            <span>Deadline Urgency (w₂ × 1/Δt):</span>
            <span className="font-medium text-slate-900">
              +{(robot.priorityScore?.breakdown?.urgencyScore || 0).toFixed(1)}
            </span>
          </div>
          <div className="flex justify-between">
            <span>Corridor Congestion Factor (w₃):</span>
            <span className="font-medium text-slate-900">
              +{(robot.priorityScore?.breakdown?.congestionScore || 0).toFixed(1)}
            </span>
          </div>
        </div>

        <button
          onClick={() => onPriorityBoost(robot.id)}
          className="mt-2.5 w-full py-1.5 text-xs font-medium bg-white hover:bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-md transition-all shadow-2xs"
        >
          Boost AMR Priority (+20 pts)
        </button>
      </div>

      {/* Current Task Info */}
      <div className="border-t border-slate-100 pt-2 text-xs">
        <div className="font-semibold text-slate-700 flex items-center gap-1.5 mb-1.5">
          <PackageCheck className="w-3.5 h-3.5 text-emerald-600" />
          Active Mission Assignment
        </div>
        {robot.currentTask ? (
          <div className="bg-slate-50 p-2 rounded-md font-mono text-[11px] space-y-1">
            <div className="flex justify-between">
              <span className="text-slate-400">Order:</span>
              <span className="font-bold text-slate-800">{robot.currentTask.id}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Target Pod:</span>
              <span className="text-slate-800">
                ({robot.currentTask.pickupX}, {robot.currentTask.pickupY})
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Workstation:</span>
              <span className="text-slate-800">
                ({robot.currentTask.dropoffX}, {robot.currentTask.dropoffY})
              </span>
            </div>
          </div>
        ) : (
          <div className="text-slate-400 italic text-[11px]">No active payload. AGV is currently idle.</div>
        )}
      </div>
    </div>
  );
}
