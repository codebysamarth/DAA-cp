// Static explanation page: problem, our algorithm, pseudocode, complexity, sources.

const PSEUDOCODE_MAIN = `CA-RHPP  (runs every tick t)
  H = 20   // planning window        h = 5   // replan period

  1. ALLOCATE (Hungarian)
       free = robots without an order   (+ robots not yet at their shelf, if t mod h = 0)
       cost[r][o] = dist(r, shelf(o)) + 2*crowd(shelf(o)) - 0.05*age(o)
       assign = HUNGARIAN(cost)                          // O(r^2 m)

  2. IF t mod h = 0  OR  an emergency stop happened:     // full replan
       table.clear()
       order = robots sorted by score(r) descending      // O(n log n)
         score(r) = 3*max(0, wait(r) - 10) + 2*crowd(r) + 50*[r in dead-end] - 100*[r idle]
       FOR r IN order:
           path[r] = SPACE_TIME_ASTAR(r, goal(r), table)  // O(H|V| log(H|V|))
           IF path[r] = NONE: path[r] = stay; failed.add(r)
           table.reserve(path[r])
       FOR f IN failed: LOCAL_REPAIR(f)                   // O(R*k) searches
     ELSE:                                                // incremental
       FOR r whose goal just changed:
           table.remove(rest of path[r])
           path[r] = SPACE_TIME_ASTAR(r, goal(r), table, start time = t - lastPlan)
           table.reserve(path[r])

  3. MOVE every robot one step through the safety layer   // O(n) per pass`;

const PSEUDOCODE_ASTAR = `SPACE_TIME_ASTAR(start, goal, table, t0)
  h(v) = BFS distance from v to goal                      // cached per goal
  open = MinHeap{ (start, t0) with f = h(start) }
  WHILE open not empty:
      (v, t) = open.pop()                                 // smallest f = g + h
      IF v = goal AND table.free(goal, t..H):  RETURN path
      IF t = H:                                RETURN path   // end of window, cost g + h(v)
      FOR u IN neighbours(v) + {v}:                       // 4 moves + wait
          IF table.taken(u, t+1) OR swap(v -> u, t+1): skip
          relax (u, t+1) with g + 1
  RETURN NONE`;

const PSEUDOCODE_REPAIR = `LOCAL_REPAIR(f)                                           // idea from MAPF-LNS2
  B = robots occupying f's cell or its neighbours at t = 1..2   (|B| <= k = 4)
  group = {f} ∪ B ;  remove their paths from the table
  REPEAT up to R = 5 times with a different order of group:
      plan every robot of group with SPACE_TIME_ASTAR
      IF all succeed: KEEP new paths; RETURN
  restore old paths                                          // never makes things worse`;

const HAND_WRITTEN = [
  ['Binary min-heap (priority queue)', 'backend/src/core/MinHeap.js', 'push / pop O(log n)'],
  ['Breadth-First Search (true-distance heuristic)', 'backend/src/core/heuristics.js', 'O(|V| + |E|) per goal, cached'],
  ['Space-Time A*', 'backend/src/core/SpaceTimeAStar.js', 'O(H|V| log(H|V|))'],
  ['Space-time reservation table', 'backend/src/core/ReservationTable.js', 'O(1) check / reserve'],
  ['Hungarian algorithm (Kuhn–Munkres)', 'backend/src/core/assignment.js', 'O(r² m)'],
  ['Greedy assignment (baseline)', 'backend/src/core/assignment.js', 'O(r m)'],
  ['Prioritized planning + local repair', 'backend/src/planners/PrioritizedPlanner.js', 'O(n · A*)'],
  ['Conflict-Based Search', 'backend/src/planners/CBSPlanner.js', 'O(2^C · A*)'],
  ['Fisher–Yates shuffle, Mulberry32 RNG', 'backend/src/core/random.js', 'O(n), O(1)'],
];

const SOURCES = [
  ['Li et al., "Lifelong MAPF in Large-Scale Warehouses" (RHCR), AAAI 2021', 'Rolling-horizon framework (window H, replan every h). Our main baseline.'],
  ['Sharon et al., "Conflict-Based Search", Artificial Intelligence 2015', 'Optimal baseline (CBS).'],
  ['Li et al., "MAPF-LNS2", AAAI 2022', 'Replan only a small neighbourhood of conflicting robots → our local repair.'],
  ['Chen et al., "Traffic Flow Optimisation for Lifelong MAPF", AAAI 2024', 'Congestion-aware routing. We tested a congestion cost in A*; it hurt in our setting, so it is off.'],
  ['Kuhn (1955) / Munkres (1957), Hungarian method', 'Optimal task assignment.'],
  ['Silver, "Cooperative Pathfinding", AIIDE 2005', 'Space-time reservation table and prioritized planning.'],
];

export default function TheoryTab({ info }) {
  return (
    <>
      <div className="card">
        <h2>The problem</h2>
        <ul className="plain">
          <li>The warehouse is a grid graph <b>G = (V, E)</b>; each free cell is a vertex, neighbouring cells are joined by an edge.</li>
          <li><b>n robots</b> move in discrete time steps. In one step a robot moves to a neighbouring cell or waits.</li>
          <li>Orders arrive all the time: drive to a <b>shelf</b>, pick the item, bring it to a <b>picking station</b>. This is <i>lifelong Multi-Agent Pickup and Delivery</i>.</li>
          <li><b>Rules:</b> two robots may never be in the same cell at the same time (vertex conflict) or swap cells in one step (swap conflict).</li>
          <li><b>Goal:</b> deliver as many orders as possible, with short planning time, and no robot stuck for long.</li>
        </ul>
      </div>

      <div className="card">
        <h2 style={{ marginBottom: 10 }}>Our algorithm: CA-RHPP</h2>
        <p className="hint" style={{ marginBottom: 10 }}>Congestion-Aware Rolling-Horizon Prioritized Planning. Built on RHCR, with these changes:</p>
        <div className="steps">
          <Step n="1" title="Hungarian task allocation">Optimal robot→order matching instead of greedy nearest-first. Cost also counts crowding near the shelf and how old the order is.</Step>
          <Step n="2" title="Dynamic priority">Robots plan in order of a score: robots in crowded spots or dead-ends go first; a robot that has waited more than 10 ticks keeps gaining priority (aging → no starvation).</Step>
          <Step n="3" title="Windowed space-time A*">Each robot plans only 20 steps ahead around the reserved paths of higher-priority robots. Heuristic = exact BFS distance, cached per goal.</Step>
          <Step n="4" title="Selective local repair">If a robot finds no path, replan only it and ≤ 4 blockers in ≤ 5 orders, not the whole fleet.</Step>
          <Step n="5" title="Incremental replanning">When one robot gets a new goal between replans, plan just that robot (1 search instead of n). Biggest throughput gain in the ablation study.</Step>
          <Step n="6" title="Safety layer">Every move is checked before execution, so collisions are impossible even if a plan is wrong. Each intervention is counted.</Step>
        </div>
      </div>

      <div className="card">
        <h2 style={{ marginBottom: 10 }}>Pseudocode</h2>
        <h3 style={{ marginBottom: 6 }}>Main loop</h3>
        <pre className="code">{PSEUDOCODE_MAIN}</pre>
        <h3 style={{ margin: '14px 0 6px' }}>Space-Time A* (single robot)</h3>
        <pre className="code">{PSEUDOCODE_ASTAR}</pre>
        <h3 style={{ margin: '14px 0 6px' }}>Local repair</h3>
        <pre className="code">{PSEUDOCODE_REPAIR}</pre>
      </div>

      <div className="card">
        <h2 style={{ marginBottom: 8 }}>Complexity analysis</h2>
        <p className="hint" style={{ marginBottom: 10 }}>
          n = robots, m = open orders, |V| = cells, H = window (20), C = conflicts, k ≤ 4 repair group, R ≤ 5 repair tries.
        </p>
        <div className="table-wrap">
          <table>
            <thead><tr><th>Algorithm</th><th>Time per replanning step</th><th>Space</th><th>Optimality</th><th>Source</th></tr></thead>
            <tbody>
              {info.algorithms.map((a) => (
                <tr key={a.id} className={a.id === 'ca_rhpp' ? 'ours' : ''}>
                  <td><span className="dot" style={{ background: a.color }} />{a.name}</td>
                  <td className="mono">{a.time}</td><td className="mono">{a.space}</td><td>{a.optimal}</td><td>{a.source}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="callout info" style={{ marginTop: 12 }}>
          <b>Why CA-RHPP is linear in n:</b> one Space-Time A* search explores at most H·|V| states, each with ≤ 5 successors,
          and every heap operation costs O(log(H|V|)), so one search is <span className="mono">O(H|V| log(H|V|))</span>.
          A full replan runs n searches plus at most R·k = 20 repair searches per failed robot, Hungarian costs
          <span className="mono"> O(n²m)</span> and sorting priorities <span className="mono">O(n log n)</span>.
          With k and R constant and n, m small next to H|V|, the search term dominates:
          <span className="mono"> O(n · H|V| log(H|V|))</span>. Between replans, incremental planning costs only one search per
          robot whose goal changed. CBS instead may build a constraint tree with 2<sup>C</sup> nodes.
        </div>
      </div>

      <div className="grid-2">
        <div className="card">
          <h3 style={{ marginBottom: 8 }}>Everything is written by hand (no algorithm libraries)</h3>
          <div className="table-wrap">
            <table>
              <thead><tr><th>Algorithm / data structure</th><th>File</th><th>Cost</th></tr></thead>
              <tbody>{HAND_WRITTEN.map(([a, f, c]) => <tr key={a}><td>{a}</td><td className="mono">{f}</td><td className="mono">{c}</td></tr>)}</tbody>
            </table>
          </div>
          <p className="hint" style={{ marginTop: 8 }}>The backend has zero npm dependencies (only Node's built-in <code>http</code>). Correctness is checked by unit tests: <code>npm test</code>.</p>
        </div>
        <div className="card">
          <h3 style={{ marginBottom: 8 }}>Research basis</h3>
          <ul className="plain">{SOURCES.map(([s, why]) => <li key={s}><b>{s}</b><br /><span className="hint">{why}</span></li>)}</ul>
          <h3 style={{ margin: '14px 0 6px' }}>Limitations (be honest in the viva)</h3>
          <ul className="plain hint">
            <li>Grid world, unit-time moves, no robot turning or acceleration.</li>
            <li>Prioritized planning is incomplete: in theory it can fail to find a solution that exists. The safety layer still prevents crashes.</li>
            <li>Results are from our simulator with up to ~40 robots, not a real warehouse.</li>
            <li>Weights were tuned on our 3 maps; other layouts may need re-tuning.</li>
          </ul>
        </div>
      </div>
    </>
  );
}

function Step({ n, title, children }) {
  return (
    <div className="step">
      <b><span className="num">{n}</span>{title}</b>
      <p>{children}</p>
    </div>
  );
}
