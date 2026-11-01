# DAA Project — Presentation & Viva Guide
## Warehouse Robot Path Planning: CA-RHPP

All numbers in this guide come from `npm run bench` (see `backend/results/REPORT.md`).
If faculty asks, you can rerun any experiment live from the dashboard. Nothing is hard-coded.

---

## Team split

| Person | Topic | Dashboard tab |
|---|---|---|
| **Person 1** | Problem, literature, research gaps | 5. How It Works (problem + research basis) |
| **Person 2** | Our algorithm, pseudocode, complexity proofs | 5. How It Works (pipeline, pseudocode, complexity) |
| **Person 3** | Live demo, experiments, viva defence | 1. Live Simulation, 2. Compare, 3. Scalability, 4. Ablation |

---

# Person 1 — Problem & Literature

### The problem in one minute
- Amazon-style warehouses use hundreds of robots that bring shelves/items to picking stations.
- We model the floor as a **grid graph G = (V, E)**. Time is discrete; per step a robot moves to a neighbour cell or waits.
- Orders arrive continuously → **lifelong Multi-Agent Pickup and Delivery (MAPD)**.
- Hard constraints: no two robots in the same cell at the same time (**vertex conflict**), no two robots swapping cells (**swap conflict**).
- Optimal multi-robot path finding is NP-hard, so real systems use fast heuristics.

### Key papers (from our survey of 19 papers)
1. **Wurman et al., AI Magazine 2008 — Kiva Systems**: the industrial system behind Amazon Robotics. No public algorithms.
2. **Sharon et al., AIJ 2015 — Conflict-Based Search (CBS)**: optimal, but the constraint tree can grow exponentially in the number of conflicts.
3. **Li et al., AAAI 2021 — RHCR**: plan only a window of H steps, replan every h steps. Scales to large fleets. **Our main baseline.**
4. **Li et al., AAAI 2022 — MAPF-LNS2**: repair a plan by replanning only a small group of conflicting robots. **Inspired our local repair.**
5. **Chen et al., AAAI 2024 — Traffic Flow Optimisation**: congestion-aware routing. **We tested this idea (see ablation).**
6. **Silver, AIIDE 2005 — Cooperative pathfinding**: prioritized planning with a space-time reservation table.

### Gaps we address (and what we measured)
| Gap in RHCR-style planning | Our change | Measured effect |
|---|---|---|
| A robot that reaches its shelf waits idle until the next replanning step | **Incremental replanning**: replan only that robot | Main source of the **+15% orders** (ablation: −10% without it) |
| Fixed priority order can leave one robot stuck for a long time | **Dynamic priority with aging** + **local repair** | Longest stuck time **90 → 9 ticks** |
| Greedy task allocation (nearest robot first) | **Hungarian algorithm** (optimal matching) | Small throughput change, lower worst-case wait |
| Replanning the whole fleet when one robot is stuck is wasteful | **Local repair** of ≤ 4 robots, ≤ 5 tries | Never makes a plan worse; lowers worst-case wait |

---

# Person 2 — Algorithm & Complexity

### CA-RHPP every tick
1. **Allocate** orders with the **Hungarian algorithm**. Cost = BFS distance + 2·crowd(shelf) − 0.05·age(order).
2. Every h = 5 ticks: **sort robots by priority score**, then each robot runs **windowed Space-Time A*** (H = 20) and reserves its path.
   `score(r) = 3·max(0, wait(r) − 10) + 2·crowd(r) + 50·[in dead-end] − 100·[idle]`
3. Robots that found no path → **local repair** (replan the robot + ≤ 4 blockers, ≤ 5 orders).
4. Between replans: robots with a new goal get an **incremental** single-robot replan.
5. **Safety layer** checks the joint move; collisions are impossible.

### Space-Time A* (one robot)
- State = (cell, t), t ≤ H. Moves: 4 neighbours or wait, cost 1 each.
- Heuristic = exact BFS distance to the goal (admissible and consistent), computed once per goal and cached.
- Stops when the goal is reached and the robot can stay there until H, or when t = H (cost g + h). This is the RHCR windowed objective.
- Swap conflicts are detected with the vertex table alone: move u→v at t is a swap if `owner(v, t−1) = owner(u, t)`.

### Complexity (write on the board)
- Time-expanded graph: |S| = H·|V| states, each with ≤ 5 successors.
- One A* search with a binary heap: **O(H|V| log(H|V|))**.
- Hungarian: **O(n²m)**. Priority sort: **O(n log n)**. Repair: ≤ R·k = 20 extra searches per failed robot.
- Full replan: **O(n²m + n log n + (n + R·k)·H|V| log(H|V|)) = O(n·H|V| log(H|V|))** when k, R are constants and n, m are small compared with H|V|.
- Space: reservation table **O(H·|V|)**, heuristic cache **O(G·|V|)** for G distinct goals.
- CBS by contrast: up to **2^C** constraint-tree nodes, each needing an A* search.

### Correctness arguments
- **No collisions**: the safety layer only turns moves into waits. Waiting robots stand on distinct cells (true at the previous tick). It repeats until there is no vertex or swap conflict, and it always terminates because each pass only removes moves.
- **No starvation (aging)**: once a robot has waited more than 10 ticks, its score grows by 3 per waiting tick, so it eventually has the highest score and plans first. The top-priority robot sees an empty reservation table, so it always gets its best window path.
- **Repair never hurts**: new paths are accepted only if every robot in the group gets a valid path; otherwise the old paths are restored.

---

# Person 3 — Demo, Experiments, Viva

### Live demo script
1. **Tab 1**: click *Run simulation* (CA-RHPP, warehouse, 12 robots). Point out the planned paths, the orange robots carrying orders, red rings for waiting. Click a robot to follow it.
2. Switch the algorithm to **Independent A\*** → robots jam and the emergency-stop counter explodes (~3,000). This shows why coordination is needed.
3. **Tab 2**: show the saved comparison. Optional: click *Run comparison now* to rerun live.
4. **Tab 3**: scalability chart. Prioritized planners grow roughly linearly with n; CBS gives up more and more often.
5. **Tab 4**: ablation. Explain which part helps and why the congestion penalty was rejected.

### Results to quote (300 ticks, 3 seeds)
| Map | RHCR-PP | CA-RHPP | Gain |
|---|---|---|---|
| Kiva-style warehouse, 12 robots | 115.0 orders | 132.3 orders | +15.1% |
| Bottleneck corridor, 10 robots | 92.3 | 106.0 | +14.8% |
| Narrow aisles, 16 robots | 126.0 | 145.0 | +15.1% |

Waiting time drops from 12–15% of robot time to 2–3%. Zero collisions for every algorithm. CA-RHPP needs zero emergency stops.

### Likely questions
**Q: Are these numbers real?**
Yes. The backend runs every algorithm on the same map, robots, orders and seeds. Any table can be rerun live, and `npm test` checks the algorithms (e.g. Hungarian is compared against brute force on 200 random cases).

**Q: Why not just use CBS? It is optimal.**
CBS is optimal within the window but its constraint tree grows exponentially. In our scalability test it hits the 300-node / 100 ms limit in about half of the replanning steps with 8 robots and in almost all of them from 16 robots up, and then falls back to prioritized planning. Its throughput is no better than RHCR-PP, and it plans 10–40× slower than CA-RHPP.

**Q: How do you prevent swap collisions?**
In the reservation table: a move u→v at time t is blocked if the robot at v at time t−1 is the robot at u at time t. The safety layer checks the same condition before executing a move.

**Q: CA-RHPP spends more time planning per tick than RHCR-PP. Why?**
It does extra incremental replans and the Hungarian step. That costs fractions of a millisecond per tick, and in exchange it delivers ~15% more orders.

**Q: Your congestion idea did not work?**
Right. A penalty for entering busy cells made robots wait instead of moving and lost 35% throughput. We measured it, report it in the ablation, and switched it off. Congestion is still used in task allocation (crowd term), where it does not hurt.

**Q: Limitations?**
Grid world with unit moves (no turning or acceleration). Prioritized planning is incomplete in theory. Simulation only, up to about 40 robots. Weights tuned on our three maps.
