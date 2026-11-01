# Benchmark results

Generated 2026-11-01T16:52:48.370Z. 300 ticks, averaged over 3 seeds. Every number comes from actually running the algorithms.

## Kiva-style Warehouse (12 robots)

| Algorithm | Orders delivered | Avg order time (ticks) | Waiting % | Longest wait | Emergency stops | Plan time / tick (ms) | Nodes expanded |
|---|---|---|---|---|---|---|---|
| Indep. A* | 12.333 | 28 | 88.1 | 289 | 3140.333 | 0.098 | 30850 |
| Standard PP | 112.333 | 48.967 | 13.733 | 5 | 0 | 2.817 | 1543722 |
| RHCR-PP | 115 | 48.167 | 13.9 | 5 | 0 | 0.24 | 99445 |
| CBS | 113.667 | 48.233 | 13.967 | 5 | 0 | 5.66 | 1678972 |
| CA-RHPP | 132.333 | 44.6 | 1.633 | 8 | 0 | 0.318 | 129091 |

## Bottleneck Corridor (10 robots)

| Algorithm | Orders delivered | Avg order time (ticks) | Waiting % | Longest wait | Emergency stops | Plan time / tick (ms) | Nodes expanded |
|---|---|---|---|---|---|---|---|
| Indep. A* | 6 | 21.233 | 92.733 | 300 | 2772.333 | 0.118 | 30197 |
| Standard PP | 92.333 | 38.467 | 14.067 | 6 | 0 | 2.896 | 1175618 |
| RHCR-PP | 92.333 | 38.933 | 14.767 | 5 | 0.333 | 0.193 | 113468 |
| CBS | 92 | 38.833 | 14.7 | 5 | 0 | 6.192 | 1676694 |
| CA-RHPP | 106 | 45.167 | 3.333 | 12 | 0 | 0.356 | 142935 |

## Narrow-Aisle Warehouse (16 robots)

| Algorithm | Orders delivered | Avg order time (ticks) | Waiting % | Longest wait | Emergency stops | Plan time / tick (ms) | Nodes expanded |
|---|---|---|---|---|---|---|---|
| Indep. A* | 12 | 27.3 | 88.333 | 294 | 4225 | 0.139 | 50973 |
| Standard PP | 124.667 | 54.233 | 12.333 | 8 | 0.333 | 4.951 | 2021194 |
| RHCR-PP | 126 | 54.133 | 12.167 | 10 | 1.333 | 0.282 | 97252 |
| CBS | 124.667 | 54.4 | 12.533 | 10 | 3.667 | 5.026 | 1118011 |
| CA-RHPP | 145 | 52.833 | 2.467 | 9 | 0 | 0.314 | 122145 |

## Scalability (warehouse, plan time per tick in ms)

| Robots | Indep. A* | Standard PP | RHCR-PP | CBS | CA-RHPP |
|---|---|---|---|---|---|
| 4 | 0.019 | 0.366 | 0.042 | 2.032 | 0.057 |
| 8 | 0.074 | 1.956 | 0.102 | 5.277 | 0.116 |
| 12 | 0.094 | 3.522 | 0.237 | 6.704 | 0.343 |
| 16 | 0.206 | 6.488 | 0.234 | 4.779 | 0.33 |
| 20 | 0.545 | 13.546 | 1.178 | 11.373 | 0.766 |
| 24 | 0.318 | 11.619 | 0.544 | 4.872 | 0.84 |
| 28 | 0.261 | 13.903 | 0.731 | 6.052 | 1.105 |
| 32 | 0.267 | 17.185 | 0.965 | 6.694 | 1.304 |

## Ablation (total over: warehouse 16, bottleneck 16, narrow 24)

| Variant | Orders delivered | Waiting % | Longest wait | Plan time / tick (ms) | Nodes expanded |
|---|---|---|---|---|---|
| CA-RHPP (all features) | 538.7 | 4.9 | 9 | 0.568 | 760592 |
| − Hungarian allocation (greedy instead) | 539.3 | 4.8 | 11 | 0.527 | 730956 |
| − dynamic priority (fixed order) | 541 | 5.5 | 12 | 0.569 | 762546 |
| − local repair | 537.3 | 5.1 | 13 | 0.529 | 767624 |
| − incremental replanning | 484.7 | 15 | 9 | 0.478 | 620168 |
| − BFS heuristic (Manhattan instead) | 534.3 | 5.7 | 14 | 0.668 | 779226 |
| + congestion cost in A* (tested, rejected) | 349 | 18.8 | 21 | 0.948 | 1054450 |
| RHCR-PP baseline (reference) | 477.7 | 15.9 | 90 | 0.412 | 678183 |
