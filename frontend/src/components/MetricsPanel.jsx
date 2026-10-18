import { Activity, Clock, CheckCircle2, TrendingUp, Cpu, ShieldCheck } from './icons';

export default function MetricsPanel({
  stats,
  currentAlgorithm,
  eventLogs = [],
  selectedRobot,
}) {
  return (
    <div className="flex flex-col gap-4">
      {/* Top Real-Time KPI Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {/* KPI 1: Throughput */}
        <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-sm card-hover flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
            <span>Throughput Rate</span>
            <span className="p-1.5 rounded-lg bg-emerald-50 text-emerald-600">
              <TrendingUp className="w-3.5 h-3.5" />
            </span>
          </div>
          <div className="mt-2">
            <div className="text-2xl font-bold text-slate-900 tracking-tight">
              {stats.throughput.toFixed(1)}
              <span className="text-xs font-normal text-slate-500 ml-1">tasks/1k ticks</span>
            </div>
            <div className="text-[11px] text-emerald-600 font-medium mt-0.5 flex items-center gap-1">
              <span>Completed: {stats.completedTasks} orders</span>
            </div>
          </div>
        </div>

        {/* KPI 2: Average Wait Delays */}
        <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-sm card-hover flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
            <span>Avg Wait Delay</span>
            <span className="p-1.5 rounded-lg bg-amber-50 text-amber-600">
              <Clock className="w-3.5 h-3.5" />
            </span>
          </div>
          <div className="mt-2">
            <div className="text-2xl font-bold text-slate-900 tracking-tight">
              {stats.avgWaitTicks.toFixed(1)}
              <span className="text-xs font-normal text-slate-500 ml-1">ticks/trip</span>
            </div>
            <div className="text-[11px] text-amber-600 font-medium mt-0.5">
              Congestion idle time
            </div>
          </div>
        </div>

        {/* KPI 3: Planning Runtime */}
        <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-sm card-hover flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
            <span>Algorithmic Latency</span>
            <span className="p-1.5 rounded-lg bg-indigo-50 text-indigo-600">
              <Cpu className="w-3.5 h-3.5" />
            </span>
          </div>
          <div className="mt-2">
            <div className="text-2xl font-bold text-slate-900 tracking-tight">
              {stats.planningTimeMs.toFixed(1)}
              <span className="text-xs font-normal text-slate-500 ml-1">ms / cycle</span>
            </div>
            <div className="text-[11px] text-indigo-600 font-medium mt-0.5">
              Horizon H=24 steps
            </div>
          </div>
        </div>

        {/* KPI 4: Collision Zero Guarantee */}
        <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-sm card-hover flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
            <span>Collision Assertions</span>
            <span
              className={`p-1.5 rounded-lg ${
                stats.collisionCount === 0 ? 'bg-blue-50 text-blue-600' : 'bg-rose-50 text-rose-600'
              }`}
            >
              <ShieldCheck className="w-3.5 h-3.5" />
            </span>
          </div>
          <div className="mt-2">
            <div
              className={`text-2xl font-bold tracking-tight ${
                stats.collisionCount === 0 ? 'text-slate-900' : 'text-rose-600'
              }`}
            >
              {stats.collisionCount}
              <span className="text-xs font-normal text-slate-500 ml-1">faults</span>
            </div>
            <div
              className={`text-[11px] font-medium mt-0.5 flex items-center gap-1 ${
                stats.collisionCount === 0 ? 'text-emerald-600' : 'text-rose-600 font-semibold'
              }`}
            >
              <CheckCircle2 className="w-3 h-3" />
              {stats.collisionCount === 0 ? '100% Collision-free' : 'Spatiotemporal Conflict!'}
            </div>
          </div>
        </div>
      </div>

      {/* Fleet Status & Live Event Log */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {/* Fleet Distribution Bar */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold text-slate-900 uppercase tracking-wider">
              Fleet Operational State
            </span>
            <span className="text-xs font-mono text-slate-500">
              Total: {stats.fleetActive + stats.fleetIdle + stats.fleetWaiting} AMRs
            </span>
          </div>

          <div className="w-full bg-slate-100 h-3 rounded-full overflow-hidden flex">
            <div
              className="bg-indigo-600 h-full transition-all duration-300"
              style={{
                width: `${(stats.fleetActive / Math.max(1, stats.fleetActive + stats.fleetIdle + stats.fleetWaiting)) * 100}%`,
              }}
              title="Active Carrying/Moving"
            />
            <div
              className="bg-amber-500 h-full transition-all duration-300"
              style={{
                width: `${(stats.fleetWaiting / Math.max(1, stats.fleetActive + stats.fleetIdle + stats.fleetWaiting)) * 100}%`,
              }}
              title="Waiting at Bottleneck"
            />
            <div
              className="bg-slate-300 h-full transition-all duration-300"
              style={{
                width: `${(stats.fleetIdle / Math.max(1, stats.fleetActive + stats.fleetIdle + stats.fleetWaiting)) * 100}%`,
              }}
              title="Idle"
            />
          </div>

          <div className="grid grid-cols-3 gap-2 mt-3 pt-3 border-t border-slate-100 text-xs">
            <div>
              <div className="flex items-center gap-1.5 text-slate-500">
                <span className="w-2 h-2 rounded-full bg-indigo-600" />
                Active
              </div>
              <span className="font-semibold text-slate-800 text-sm">{stats.fleetActive}</span>
            </div>
            <div>
              <div className="flex items-center gap-1.5 text-slate-500">
                <span className="w-2 h-2 rounded-full bg-amber-500" />
                Waiting
              </div>
              <span className="font-semibold text-slate-800 text-sm">{stats.fleetWaiting}</span>
            </div>
            <div>
              <div className="flex items-center gap-1.5 text-slate-500">
                <span className="w-2 h-2 rounded-full bg-slate-300" />
                Idle
              </div>
              <span className="font-semibold text-slate-800 text-sm">{stats.fleetIdle}</span>
            </div>
          </div>
        </div>

        {/* Real-Time Live Activity Event Log */}
        <div className="md:col-span-2 bg-white p-3.5 rounded-xl border border-slate-200 shadow-sm flex flex-col h-40">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
              <Activity className="w-3.5 h-3.5 text-indigo-600" />
              Live Fleet Dispatch & Conflict Log
            </span>
            <span className="text-[11px] text-slate-400 font-mono">Stream Real-Time</span>
          </div>

          <div className="flex-1 overflow-y-auto space-y-1.5 font-mono text-[11px] pr-1">
            {eventLogs.length === 0 ? (
              <div className="text-slate-400 italic py-6 text-center">
                Press Play or Step to start automated warehouse simulation...
              </div>
            ) : (
              eventLogs.slice(-6).reverse().map((log, index) => (
                <div
                  key={index}
                  className={`p-1.5 rounded-md flex items-center justify-between border ${
                    log.type === 'conflict_repair'
                      ? 'bg-amber-50/60 border-amber-200 text-amber-800'
                      : log.type === 'completed'
                      ? 'bg-emerald-50/60 border-emerald-200 text-emerald-800'
                      : log.type === 'assigned'
                      ? 'bg-blue-50/60 border-blue-200 text-blue-800'
                      : 'bg-slate-50 border-slate-200 text-slate-700'
                  }`}
                >
                  <span className="flex items-center gap-1.5">
                    <span className="text-[10px] opacity-60">[{log.time}t]</span>
                    <span>{log.message}</span>
                  </span>
                  <span className="text-[10px] uppercase font-semibold tracking-wider opacity-80">
                    {log.tag || log.type}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
