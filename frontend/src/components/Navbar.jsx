import { Box, Layers, BarChart3, Binary, ShieldCheck, FileSpreadsheet } from './icons';

export default function Navbar({ activeTab, setActiveTab, currentAlgorithm, stats }) {
  const navItems = [
    { id: 'floor', label: 'Live Warehouse Fleet', icon: Layers },
    { id: 'benchmark', label: 'Benchmark Suite', icon: BarChart3 },
    { id: 'daa', label: 'DAA Complexity & Theory', icon: Binary },
    { id: 'research', label: 'Research Gaps & Novelty', icon: FileSpreadsheet },
  ];

  return (
    <header className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-2xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Brand Logo & Title */}
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-600 to-blue-500 flex items-center justify-center text-white shadow-sm">
              <Box className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-slate-900 text-base tracking-tight">SmartStock</span>
                <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-200">
                  DAA Research Engine
                </span>
              </div>
              <p className="text-[11px] text-slate-500 font-medium">
                Autonomous Warehouse Traffic Optimizer (CA-RHPP)
              </p>
            </div>
          </div>

          {/* Navigation Tabs */}
          <nav className="hidden md:flex items-center gap-1 bg-slate-100 p-1 rounded-xl">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                    isActive
                      ? 'bg-white text-indigo-700 shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  {item.label}
                </button>
              );
            })}
          </nav>

          {/* System Status Indicators */}
          <div className="hidden lg:flex items-center gap-4 text-xs font-mono">
            <div className="flex items-center gap-1.5 text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200 font-medium">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              <span>0 Collisions</span>
            </div>

            <div className="text-slate-500">
              <span className="text-slate-400">Horizon:</span> <span className="font-bold text-slate-700">H=24</span>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
