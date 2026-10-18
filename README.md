# SmartStock: Enterprise Warehouse Intelligence & Autonomous Fleet Optimization Platform (CA-RHPP)

> **Design and Analysis of Algorithms (DAA) Research Course Project**  
> *An adaptive, congestion-aware, rolling-horizon fleet optimizer with selective local conflict repair for autonomous mobile robots (AMRs/AGVs).*

---

## 🚀 Live Application Preview
The application is running and accessible locally at:
👉 **[http://localhost:5173](http://localhost:5173)**

---

## 🏛️ System Architecture & Algorithm Core

The platform implements **CA-RHPP (Adaptive Congestion-Aware Rolling-Horizon Prioritized Planning with Selective Local Conflict Repair)** to solve the Multi-Agent Pickup and Delivery (MAPD) problem across constrained warehouse topologies.

### 4-Stage Optimization Pipeline:
1. **Stage 1 — Congestion-Aware Multi-Robot Task Allocation (MRTA)**:
   - Matches idle robots to pending customer pickup orders.
   - Cost function penalizes both Euclidean distance and active space-time reservation corridor density:
     $$\text{Cost}(r, \tau) = \text{Dist}(r, \tau) + \alpha \cdot \text{Congestion}(\text{Path}(r, \tau))$$
2. **Stage 2 — Dynamic Adaptive Priority Scoring**:
   - Re-evaluates fleet priority order before each rolling horizon window to prevent low-priority robot starvation:
     $$\text{Score}(r) = w_{\text{wait}} \cdot \tau_{\text{wait}} + w_{\text{urgency}} \cdot \frac{1}{\text{Deadline} - t + 1} + w_{\text{congest}} \cdot \text{BottleneckDegree}(r)$$
3. **Stage 3 — Windowed Space-Time Reservation ($A^*$)**:
   - Plans collision-free paths over time horizon $H = 24$ steps.
   - Enforces discrete reservation tables for vertices $(v, t)$ and directed edges $(u, v, t)$ to eliminate vertex collisions and edge-swaps.
4. **Stage 4 — Selective Local Conflict Repair ($k$-LCR)**:
   - When a robot is obstructed at a bottleneck, extracts only the localized neighborhood of $k$ conflicting robots ($k \ll n$).
   - Iteratively repairs their trajectories within a bounded budget ($R \le 5$ iterations) without recomputing the entire fleet.

---

## 📊 Comparative Baselines Implemented

| Algorithm | Description | Theoretical Time Complexity |
|---|---|---|
| **CA-RHPP (Proposed)** | Congestion-aware dynamic priorities with selective local repair | $\mathcal{O}\big((n + R \cdot k) \cdot H(|V|+|E|) \log(H|V|)\big)$ |
| **RHCR-PP** | Li et al. (AAAI 2021) Rolling-Horizon Collision Resolution | $\mathcal{O}\big(n \cdot H(|V|+|E|) \log(H|V|)\big)$ |
| **Standard PP** | Fixed FIFO / ID sequential prioritized planning | $\mathcal{O}\big(n \cdot H(|V|+|E|) \log(H|V|)\big)$ |
| **CBS** | Sharon et al. (AIJ 2015) Conflict-Based Search (Exact Optimal) | $\mathcal{O}\big(2^C \cdot H(|V|+|E|) \log(H|V|)\big)$ |
| **Independent $A^*$** | Uncoordinated single-agent paths (Collision baseline) | $\mathcal{O}\big(n \cdot (|V|+|E|) \log|V|\big)$ |

---

## 💻 Tech Stack & UI/UX Principles
- **Aesthetic**: Modern enterprise light theme (inspired by Flexport, Linear, AWS Logistics Console). Off-white surfaces (`#f8fafc`), crisp slate borders (`#e2e8f0`), indigo/emerald/amber status tokens. **No dark theme**.
- **Interactive Canvas**: High-performance HTML5 2D canvas with multi-layer overlays (heatmaps, robot path trails, storage pod racks, picking stations).
- **Telemetry & Inspector**: Real-time KPI counters (Throughput, Avg Wait, Planning Latency, Collision-Free Guarantee) and click-to-inspect robot telemetry.
- **DAA Theory Explorer**: Dynamic priority weight tuning sliders, asymptotic Big-O proofs, and pseudocode inspection.

---

## 🛠️ How to Run Locally

```bash
# Navigate to the frontend directory
cd frontend

# Install dependencies (already completed)
npm install

# Start development server
npm run dev

# Or build and run preview
npm run build
npm run preview
```
