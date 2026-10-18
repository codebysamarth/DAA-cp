import React, { useState } from 'react';
import { Layers, CheckCircle2 } from './icons';

export default function DaaExplorer({
  priorityWeights,
  setPriorityWeights,
  reservationTable,
}) {
  const [activeTab, setActiveTab] = useState('complexity');

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 flex flex-col gap-6">
      {/* Header and Tab Navigation */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-indigo-600" />
            <h2 className="text-base font-bold text-slate-900 tracking-tight">
              Design & Analysis of Algorithms (DAA) Theoretical Inspector
            </h2>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Formal computational complexity proofs, state-space formulations, pseudocode, and dynamic priority tuning.
          </p>
        </div>

        <div className="flex items-center bg-slate-100 p-1 rounded-lg text-xs font-semibold">
          <button
            onClick={() => setActiveTab('complexity')}
            className={`px-3 py-1.5 rounded-md transition-colors ${
              activeTab === 'complexity'
                ? 'bg-white text-indigo-700 shadow-2xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Complexity Analysis
          </button>
          <button
            onClick={() => setActiveTab('tuning')}
            className={`px-3 py-1.5 rounded-md transition-colors ${
              activeTab === 'tuning'
                ? 'bg-white text-indigo-700 shadow-2xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Priority Weights Tuning
          </button>
          <button
            onClick={() => setActiveTab('pseudocode')}
            className={`px-3 py-1.5 rounded-md transition-colors ${
              activeTab === 'pseudocode'
                ? 'bg-white text-indigo-700 shadow-2xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Algorithm Pseudocode
          </button>
        </div>
      </div>

      {/* Tab 1: Computational Complexity Analysis */}
      {activeTab === 'complexity' && (
        <div className="space-y-6 text-xs text-slate-700">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
              <h3 className="font-bold text-slate-900 text-sm mb-2 flex items-center gap-1.5">
                <Layers className="w-4 h-4 text-indigo-600" />
                State-Space & Graph Dimensions
              </h3>
              <p className="text-slate-600 leading-relaxed mb-3">
                Let warehouse grid graph be $G = (V, E)$, with $n$ active robots, planning horizon $H$ time steps, and $m$ tasks.
              </p>
              <ul className="space-y-2 font-mono text-[11px] text-slate-800 bg-white p-3 rounded-lg border border-slate-200">
                <li>• Expanded Vertices: $|V'| = |V| \times H$</li>
                <li>• Expanded Directed Edges: $|E'| = (|V| + |E|) \times H$</li>
                <li>• Single-Agent Space-Time A*: $O(H(|V| + |E|) \log(H|V|))$</li>
                <li>• Fleet Sequential Planning: $O(n \cdot H(|V| + |E|) \log(H|V|))$</li>
              </ul>
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
              <h3 className="font-bold text-slate-900 text-sm mb-2 flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                CA-RHPP Asymptotic Bound
              </h3>
              <p className="text-slate-600 leading-relaxed mb-3">
                For selective local conflict repair with neighborhood size $k$ and maximum repair budget $R$:
              </p>
              <div className="bg-white p-3 rounded-lg border border-slate-200 font-mono text-[11px] space-y-1.5">
                <div className="font-bold text-indigo-700 text-xs">
                  T_total = O(n·m + (n + R·k)·H(|V|+|E|) log(H|V|))
                </div>
                <div className="text-slate-500 text-[10px]">
                  Since R &le; 5 and k &le; 4 are small bounded constants:
                </div>
                <div className="font-semibold text-emerald-700">
                  T_asymptotic = O(n · H(|V|+|E|) log(H|V|))  [STRICTLY LINEAR IN n]
                </div>
              </div>
            </div>
          </div>

          {/* Theoretical Big-O Comparison Table */}
          <div>
            <h4 className="font-bold text-slate-900 text-xs uppercase tracking-wider mb-2">
              Theoretical Asymptotic Comparison Matrix
            </h4>
            <div className="overflow-x-auto border border-slate-200 rounded-xl">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-700 font-semibold">
                  <tr>
                    <th className="py-2.5 px-3">Algorithm</th>
                    <th className="py-2.5 px-3">Worst-Case Time Complexity</th>
                    <th className="py-2.5 px-3">Space Complexity</th>
                    <th className="py-2.5 px-3">Optimality Class</th>
                    <th className="py-2.5 px-3">Scalability Bound</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-mono text-[11px]">
                  <tr className="bg-indigo-50/40 font-semibold">
                    <td className="py-2.5 px-3 text-indigo-900 font-sans">CA-RHPP (Proposed)</td>
                    <td className="py-2.5 px-3 text-indigo-700">O((n + Rk)·H(|V|+|E|) log(H|V|))</td>
                    <td className="py-2.5 px-3">O(|V|·H + n·H)</td>
                    <td className="py-2.5 px-3 font-sans text-emerald-700">Bounded Suboptimal</td>
                    <td className="py-2.5 px-3 font-sans">n &ge; 500+</td>
                  </tr>
                  <tr>
                    <td className="py-2.5 px-3 font-sans">RHCR-PP (Li 2021)</td>
                    <td className="py-2.5 px-3">O(n·H(|V|+|E|) log(H|V|))</td>
                    <td className="py-2.5 px-3">O(|V|·H + n·H)</td>
                    <td className="py-2.5 px-3 font-sans text-slate-600">Suboptimal</td>
                    <td className="py-2.5 px-3 font-sans">n &approx; 200</td>
                  </tr>
                  <tr>
                    <td className="py-2.5 px-3 font-sans">CBS (Sharon 2015)</td>
                    <td className="py-2.5 px-3 text-rose-600">O(2^C · H(|V|+|E|) log(H|V|))</td>
                    <td className="py-2.5 px-3 text-rose-600">O(2^C · n·H)</td>
                    <td className="py-2.5 px-3 font-sans text-emerald-700">Globally Optimal</td>
                    <td className="py-2.5 px-3 font-sans text-rose-600">n &le; 25 (Exponential)</td>
                  </tr>
                  <tr>
                    <td className="py-2.5 px-3 font-sans">Standard PP</td>
                    <td className="py-2.5 px-3">O(n·H(|V|+|E|) log(H|V|))</td>
                    <td className="py-2.5 px-3">O(|V|·H + n·H)</td>
                    <td className="py-2.5 px-3 font-sans text-slate-600">Suboptimal (Starvation)</td>
                    <td className="py-2.5 px-3 font-sans">n &approx; 50</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: Priority Weights Tuning */}
      {activeTab === 'tuning' && (
        <div className="space-y-4 text-xs text-slate-700">
          <p className="text-slate-600">
            Dynamically adjust the priority weighting coefficients. These directly influence robot queue ordering at every rolling horizon cycle:
          </p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Weight 1: Wait Time */}
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 flex flex-col gap-3">
              <div className="flex justify-between items-center">
                <span className="font-semibold text-slate-900">w₁: Wait Time Factor</span>
                <span className="font-mono font-bold text-indigo-600 text-sm">
                  {priorityWeights.wait.toFixed(1)}
                </span>
              </div>
              <input
                type="range"
                min="0.5"
                max="3.0"
                step="0.1"
                value={priorityWeights.wait}
                onChange={(e) =>
                  setPriorityWeights({ ...priorityWeights, wait: parseFloat(e.target.value) })
                }
                className="w-full accent-indigo-600"
              />
              <p className="text-[11px] text-slate-500">
                Increases priority for robots that have been delayed by obstacles to prevent starvation.
              </p>
            </div>

            {/* Weight 2: Deadline Urgency */}
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 flex flex-col gap-3">
              <div className="flex justify-between items-center">
                <span className="font-semibold text-slate-900">w₂: Task Urgency</span>
                <span className="font-mono font-bold text-indigo-600 text-sm">
                  {priorityWeights.urgency.toFixed(1)}
                </span>
              </div>
              <input
                type="range"
                min="0.5"
                max="3.0"
                step="0.1"
                value={priorityWeights.urgency}
                onChange={(e) =>
                  setPriorityWeights({ ...priorityWeights, urgency: parseFloat(e.target.value) })
                }
                className="w-full accent-indigo-600"
              />
              <p className="text-[11px] text-slate-500">
                Prioritizes customer orders close to their SLA fulfillment window.
              </p>
            </div>

            {/* Weight 3: Congestion Density */}
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 flex flex-col gap-3">
              <div className="flex justify-between items-center">
                <span className="font-semibold text-slate-900">w₃: Corridor Congestion</span>
                <span className="font-mono font-bold text-indigo-600 text-sm">
                  {priorityWeights.congestion.toFixed(1)}
                </span>
              </div>
              <input
                type="range"
                min="0.2"
                max="2.5"
                step="0.1"
                value={priorityWeights.congestion}
                onChange={(e) =>
                  setPriorityWeights({ ...priorityWeights, congestion: parseFloat(e.target.value) })
                }
                className="w-full accent-indigo-600"
              />
              <p className="text-[11px] text-slate-500">
                Favors agents actively clearing dense bottleneck corridors over open aisles.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Tab 3: Pseudocode Viewer */}
      {activeTab === 'pseudocode' && (
        <div className="bg-slate-900 text-slate-100 p-4 rounded-xl font-mono text-[11px] overflow-x-auto leading-relaxed border border-slate-800 shadow-inner">
          <div className="text-emerald-400 font-bold mb-2">
            // Algorithm: CA-RHPP (Adaptive Congestion-Aware Rolling-Horizon Prioritized Planning)
          </div>
          <pre>{`Input: Warehouse Graph G=(V,E), Fleet of n robots R, Rolling Horizon H, Replanning Step h
Output: Collision-free space-time trajectories for all robots

1: while warehouse_operating do
2:    // STAGE 1: Congestion-Aware Task Allocation
3:    for each idle robot r in R do
4:       best_task = argmin_{task} [ Dist(r, task) + alpha * Congestion(Path(r, task)) ]
5:       Assign task to robot r
6:    end for
7:
8:    // STAGE 2: Dynamic Priority Scoring
9:    for each robot r in R do
10:      Priority(r) = w1 * WaitTime(r) + w2 * Urgency(r) + w3 * CongestionDegree(r)
11:   end for
12:   Sort robots R descending by Priority(r)
13:
14:   // STAGE 3: Space-Time Windowed Reservation
15:   Clear ReservationTable for interval [t, t + H]
16:   failed_agents = []
17:   for each robot r in Sorted(R) do
18:      path = SpaceTime_AStar(r.pos, r.goal, ReservationTable, max_horizon=H)
19:      if path found then
20:         ReservationTable.commit(r.id, path)
21:      else
22:         failed_agents.append(r)
23:      end if
24:   end for
25:
26:   // STAGE 4: Selective Local Conflict Repair (LCR)
27:   for each blocked_robot in failed_agents do
28:      k_conflicting = IdentifyBlockingNeighbors(blocked_robot, ReservationTable, max_k=4)
29:      ReservationTable.clearAgents(k_conflicting + [blocked_robot])
30:      ReplanNeighborhood(k_conflicting + [blocked_robot], max_iterations=R)
31:   end for
32:
33:   Execute first h steps of planned trajectories on physical/simulated robots
34:   Advance current time t = t + h
35: end while`}</pre>
        </div>
      )}
    </div>
  );
}
