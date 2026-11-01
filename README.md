# SmartStock: Warehouse Robot Path Planning (CA-RHPP)

> Design and Analysis of Algorithms course project.
> Many robots share one warehouse floor and must deliver orders without colliding.
> We compare 4 known algorithms with our own, **CA-RHPP**, using real experiments.

## Run it

Needs Node.js 18 or newer.

```bash
npm run setup     # install frontend packages (the backend has no dependencies)
npm start         # build the frontend and start everything on http://localhost:5000
```

For development, use two terminals: `npm run dev:backend` and `npm run dev:frontend` (then open http://localhost:5173).

```bash
npm test          # unit tests for every hand-written algorithm
npm run bench     # rerun all experiments -> backend/results/REPORT.md
```

## The problem

- Warehouse = grid graph **G = (V, E)**. Robots move one cell per time step, or wait.
- Orders arrive all the time: drive to a shelf, pick the item, deliver it to a picking station (*lifelong Multi-Agent Pickup and Delivery*).
- Two robots may never be in the same cell at the same time, or swap cells in one step.
- Goal: deliver as many orders as possible, plan fast, and never leave a robot stuck.

## Algorithms (all hand-written, no algorithm libraries)

| Algorithm | Idea | Time per replanning step |
|---|---|---|
| Independent A* | Each robot plans alone and ignores the others | O(n · \|V\| log \|V\|) |
| Standard PP | Robots plan full paths one by one in fixed order, using a reservation table | O(n · T\|V\| log(T\|V\|)) |
| RHCR-PP (Li et al., AAAI 2021) | Plan only a 20-step window, replan every 5 ticks | O(n · H\|V\| log(H\|V\|)) |
| Windowed CBS (Sharon et al., AIJ 2015) | Optimal constraint-tree search, gives up after 300 nodes / 100 ms | O(2^C · H\|V\| log(H\|V\|)) |
| **CA-RHPP (ours)** | RHCR + the improvements below | O(n²m + (n + Rk) · H\|V\| log(H\|V\|)) |

**What CA-RHPP adds to RHCR:**

1. **Hungarian task allocation**: optimal robot-to-order matching (instead of greedy), with a cost for crowded shelves and old orders.
2. **Dynamic priority with aging**: robots in crowded spots or dead ends plan first. A robot that has waited more than 10 ticks keeps gaining priority, so no robot starves.
3. **Selective local repair** (idea from MAPF-LNS2, AAAI 2022): if a robot finds no path, replan only it and up to 4 blockers, not the whole fleet.
4. **Incremental replanning**: when one robot gets a new goal between replans, plan only that robot (1 search instead of n).
5. **Fast data structures**: BFS true-distance heuristic cached per goal, integer-indexed reservation table, reusable A* arrays (O(1) reset).

A **safety layer** checks every move before it runs, so collisions are impossible. Every time it has to step in is counted as an "emergency stop".

## Results

All numbers are measured by actually running the algorithms (300 ticks, average of 3 random seeds). Full tables: [backend/results/REPORT.md](backend/results/REPORT.md).

| Map (robots) | RHCR-PP orders | CA-RHPP orders | Gain | Waiting time RHCR-PP → CA-RHPP |
|---|---|---|---|---|
| Kiva-style warehouse (12) | 115.0 | 132.3 | **+15.1%** | 13.9% → 1.6% |
| Bottleneck corridor (10) | 92.3 | 106.0 | **+14.8%** | 14.8% → 3.3% |
| Narrow aisles (16) | 126.0 | 145.0 | **+15.1%** | 12.2% → 2.5% |

- **0 collisions** for every algorithm (safety layer). CA-RHPP needed **0 emergency stops**. Independent A* needed about 3,000.
- **Longest time any robot stood stuck**, on the busy ablation scenarios: RHCR-PP 90 ticks, CA-RHPP 9 ticks.
- **Planning time**: CA-RHPP stays around 1 ms per tick. Standard PP and CBS are 10–40× slower, and CBS gives up more often as the fleet grows.

### Ablation (what each part contributes)

Totals over three busy scenarios (warehouse 16, bottleneck 16, narrow 24 robots):

| Variant | Orders | Longest wait |
|---|---|---|
| CA-RHPP (all features) | 538.7 | 9 |
| − incremental replanning | 484.7 (−10.0%) | 9 |
| − local repair | 537.3 | 13 |
| − dynamic priority | 541.0 | 12 |
| − Hungarian allocation | 539.3 | 11 |
| − BFS heuristic | 534.3 | 14 |
| + congestion cost in A* (rejected) | 349.0 (−35%) | 21 |
| RHCR-PP baseline | 477.7 | 90 |

What this shows: incremental replanning gives most of the extra throughput. Repair, priority and Hungarian allocation mainly keep the worst-case wait low. We also tested a congestion penalty inside A* (inspired by Chen et al., AAAI 2024). It made results much worse, because robots chose to wait instead of entering busy cells, so CA-RHPP does not use it.

## Project structure

```
backend/                     Node.js, zero dependencies
  server.js                  REST API (built-in http module)
  src/core/
    maps.js                  warehouse maps as text
    Grid.js                  grid graph, adjacency lists
    MinHeap.js               binary heap priority queue
    heuristics.js            BFS true-distance + Manhattan heuristics
    ReservationTable.js      space-time reservation table (vertex + swap conflicts)
    SpaceTimeAStar.js        windowed space-time A*
    assignment.js            Hungarian algorithm + greedy assignment
    random.js                seeded RNG + Fisher–Yates shuffle
  src/planners/
    PrioritizedPlanner.js    Standard PP / RHCR-PP / CA-RHPP / Independent A*
    CBSPlanner.js            windowed Conflict-Based Search
    taskAllocation.js        greedy vs Hungarian task allocation
    index.js                 algorithm registry + ablation variants
  src/simulation/
    Simulator.js             lifelong pickup-and-delivery simulation + safety layer
    benchmark.js             comparison, scalability and ablation experiments
  test/algorithms.test.js    correctness tests (node:test)
  scripts/run-benchmarks.js  writes results/report.json and REPORT.md
frontend/                    React + Vite, no UI libraries
  src/components/            5 tabs: simulation, compare, scalability, ablation, theory
```

## Limitations

- Grid world with unit-time moves. No turning or acceleration.
- Prioritized planning is incomplete: in theory it can miss a solution that exists. The safety layer still prevents crashes.
- Simulation only, up to about 40 robots. Weights were tuned on our three maps.
