/**
 * Baseline Algorithms for Fair Benchmark Comparison
 *
 * 1. Independent A*: No reservation table; robots ignore each other (shows collision hazards).
 * 2. Standard Prioritized Planning (PP): Fixed FIFO/ID priority without dynamic adaptation.
 * 3. RHCR-PP (Li et al., AAAI 2021): Rolling-Horizon Collision Resolution with standard prioritized planning.
 * 4. Conflict-Based Search (CBS) (Sharon et al., AIJ 2015): Optimal two-level constraint tree solver (shows exponential branching).
 */

import { planSpaceTimePath } from './spaceTimeAStar.js';
import { manhattanDistance } from './graph.js';

export const ALGORITHM_TYPES = {
  CA_RHPP: 'ca_rhpp',
  RHCR_PP: 'rhcr_pp',
  STANDARD_PP: 'standard_pp',
  CBS: 'cbs',
  INDEPENDENT_A_STAR: 'independent_a_star',
};

export const ALGORITHM_INFO = {
  [ALGORITHM_TYPES.CA_RHPP]: {
    id: ALGORITHM_TYPES.CA_RHPP,
    name: 'CA-RHPP (Our Proposed System)',
    badge: 'Proposed Novelty',
    color: '#4f46e5', // Indigo
    description:
      'Adaptive Congestion-Aware Rolling-Horizon Prioritized Planning with Selective Local Conflict Repair.',
    theoreticalComplexity: 'O(n · H(|V|+|E|) log(H|V|))',
    category: 'Intelligent Adaptive Schedulers',
  },
  [ALGORITHM_TYPES.RHCR_PP]: {
    id: ALGORITHM_TYPES.RHCR_PP,
    name: 'RHCR-PP (Li et al., AAAI 2021)',
    badge: 'Academic SOTA',
    color: '#0284c7', // Sky Blue
    description:
      'Rolling-Horizon Collision Resolution using standard Prioritized Planning. Windowed replanning without adaptive prioritization.',
    theoreticalComplexity: 'O(n · H(|V|+|E|) log(H|V|))',
    category: 'Windowed Multi-Agent Planners',
  },
  [ALGORITHM_TYPES.STANDARD_PP]: {
    id: ALGORITHM_TYPES.STANDARD_PP,
    name: 'Standard Prioritized Planning (PP)',
    badge: 'Industry Classic',
    color: '#059669', // Emerald
    description:
      'Sequential single-agent space-time path planning in fixed arbitrary/FIFO order. Highly prone to starvation.',
    theoreticalComplexity: 'O(n · H(|V|+|E|) log(H|V|))',
    category: 'Decoupled Heuristics',
  },
  [ALGORITHM_TYPES.CBS]: {
    id: ALGORITHM_TYPES.CBS,
    name: 'Conflict-Based Search (CBS)',
    badge: 'Optimal Reference',
    color: '#d97706', // Amber
    description:
      'Sharon et al. (AIJ 2015). High-level constraint tree search. Globally optimal sum-of-costs, but exponential in conflict count.',
    theoreticalComplexity: 'O(2^C · H(|V|+|E|) log(H|V|))',
    category: 'Exact Optimal Solvers',
  },
  [ALGORITHM_TYPES.INDEPENDENT_A_STAR]: {
    id: ALGORITHM_TYPES.INDEPENDENT_A_STAR,
    name: 'Independent A* (No Coordination)',
    badge: 'Uncoordinated Baseline',
    color: '#e11d48', // Rose
    description:
      'Each robot independently computes its shortest path ignoring other robots. Proves why collision-avoidance coordination is essential.',
    theoreticalComplexity: 'O(n · (|V|+|E|) log|V|)',
    category: 'Uncoordinated Reference',
  },
};

/**
 * Classical Greedy Distance Task Allocation
 * Used by standard MAPF baselines (Sharon 2015, Li 2021).
 * Greedily assigns tasks based solely on Euclidean/Manhattan distance,
 * completely ignoring corridor traffic and space-time reservation density.
 */
export function allocateTasksGreedy(robots, tasks) {
  const idleRobots = robots.filter((r) => r.state === 'IDLE' || r.state === 'RETURNING');
  if (idleRobots.length === 0 || !tasks || tasks.length === 0) return [];

  const assignments = [];
  const assignedTaskIds = new Set();
  const assignedRobotIds = new Set();

  for (const robot of idleRobots) {
    if (assignedRobotIds.has(robot.id)) continue;

    let minDistance = Infinity;
    let bestTask = null;

    for (const task of tasks) {
      if (assignedTaskIds.has(task.id)) continue;
      const dist = manhattanDistance(robot.x, robot.y, task.pickupX, task.pickupY);
      if (dist < minDistance) {
        minDistance = dist;
        bestTask = task;
      }
    }

    if (bestTask) {
      assignments.push({ robotId: robot.id, taskId: bestTask.id, task: bestTask });
      assignedTaskIds.add(bestTask.id);
      assignedRobotIds.add(robot.id);
    }
  }

  return assignments;
}

/**
 * 1. Independent A* Planner
 */
export function planIndependentAStar({ grid, robots, horizon = 24 }) {
  const tStart = performance.now();
  const paths = new Map();

  for (const robot of robots) {
    const goalX = robot.targetX;
    const goalY = robot.targetY;

    if (goalX === null || goalX === undefined || (goalX === robot.x && goalY === robot.y)) {
      paths.set(robot.id, [{ x: robot.x, y: robot.y, heading: robot.heading, t: 0 }]);
      continue;
    }

    const path = planSpaceTimePath({
      grid,
      startX: robot.x,
      startY: robot.y,
      startHeading: robot.heading,
      goalX,
      goalY,
      startTime: 0,
      maxHorizon: horizon,
      agentId: robot.id,
      reservationTable: null,
      allowIgnoreReservations: true,
    });

    if (path) {
      paths.set(robot.id, path);
    } else {
      paths.set(robot.id, [{ x: robot.x, y: robot.y, heading: robot.heading, t: 0 }]);
    }
  }

  const durationMs = performance.now() - tStart;
  return { paths, durationMs, conflictTreeNodes: 0 };
}

/**
 * 2. Standard Prioritized Planning (PP)
 */
export function planStandardPP({ grid, robots, reservationTable, horizon = 24 }) {
  const tStart = performance.now();
  const paths = new Map();

  // Clear all reservations
  reservationTable.clear();

  // Fixed order (by robot ID ascending)
  const sortedRobots = [...robots].sort((a, b) => a.id.localeCompare(b.id));

  for (const robot of sortedRobots) {
    const goalX = robot.targetX;
    const goalY = robot.targetY;

    if (goalX === null || goalX === undefined || (goalX === robot.x && goalY === robot.y)) {
      reservationTable.reserveStaticOccupancy(robot.id, robot.x, robot.y, horizon, 0);
      paths.set(robot.id, [{ x: robot.x, y: robot.y, heading: robot.heading, t: 0 }]);
      continue;
    }

    const path = planSpaceTimePath({
      grid,
      startX: robot.x,
      startY: robot.y,
      startHeading: robot.heading,
      goalX,
      goalY,
      startTime: 0,
      maxHorizon: horizon,
      agentId: robot.id,
      reservationTable,
      congestionBias: 0, // Standard PP ignores congestion
    });

    if (path && path.length > 1) {
      reservationTable.commitPath(robot.id, path);
      if (path.length - 1 < horizon) {
        const lastStep = path[path.length - 1];
        reservationTable.reserveStaticOccupancy(robot.id, lastStep.x, lastStep.y, horizon, path.length);
      }
      paths.set(robot.id, path);
    } else {
      // Standstill fallback: in standard prioritized planning, blocked robot stays in place and waits
      reservationTable.reserveStaticOccupancy(robot.id, robot.x, robot.y, horizon, 0);
      paths.set(robot.id, [{ x: robot.x, y: robot.y, heading: robot.heading, t: 0 }]);
    }
  }

  const durationMs = performance.now() - tStart;
  return { paths, durationMs, conflictTreeNodes: 0 };
}

/**
 * 3. RHCR-PP (Li et al., AAAI 2021)
 */
export function planRHCRPP({ grid, robots, reservationTable, horizon = 24 }) {
  const tStart = performance.now();
  const paths = new Map();

  // Clear reservations
  reservationTable.clear();

  // Rolling-horizon sequential planning in order of remaining distance
  const sortedRobots = [...robots].sort((a, b) => {
    const distA = manhattanDistance(a.x, a.y, a.targetX ?? a.x, a.targetY ?? a.y);
    const distB = manhattanDistance(b.x, b.y, b.targetX ?? b.x, b.targetY ?? b.y);
    return distA - distB;
  });

  for (const robot of sortedRobots) {
    const goalX = robot.targetX;
    const goalY = robot.targetY;

    if (goalX === null || goalX === undefined || (goalX === robot.x && goalY === robot.y)) {
      reservationTable.reserveStaticOccupancy(robot.id, robot.x, robot.y, horizon, 0);
      paths.set(robot.id, [{ x: robot.x, y: robot.y, heading: robot.heading, t: 0 }]);
      continue;
    }

    const path = planSpaceTimePath({
      grid,
      startX: robot.x,
      startY: robot.y,
      startHeading: robot.heading,
      goalX,
      goalY,
      startTime: 0,
      maxHorizon: horizon,
      agentId: robot.id,
      reservationTable,
      congestionBias: 0,
    });

    if (path && path.length > 1) {
      reservationTable.commitPath(robot.id, path);
      if (path.length - 1 < horizon) {
        const lastStep = path[path.length - 1];
        reservationTable.reserveStaticOccupancy(robot.id, lastStep.x, lastStep.y, horizon, path.length);
      }
      paths.set(robot.id, path);
    } else {
      reservationTable.reserveStaticOccupancy(robot.id, robot.x, robot.y, horizon, 0);
      paths.set(robot.id, [{ x: robot.x, y: robot.y, heading: robot.heading, t: 0 }]);
    }
  }

  const durationMs = performance.now() - tStart;
  return { paths, durationMs, conflictTreeNodes: 0 };
}

/**
 * 4. Conflict-Based Search (CBS) (Sharon et al., AIJ 2015)
 * Simplified high-level constraint tree solver for demonstration & comparison
 */
export function planCBS({ grid, robots, horizon = 20, maxNodes = 60 }) {
  const tStart = performance.now();
  let conflictTreeNodes = 0;

  // Root node: plan unconstrained path for each agent
  const rootPaths = new Map();
  for (const robot of robots) {
    const goalX = robot.targetX ?? robot.x;
    const goalY = robot.targetY ?? robot.y;
    const p = planSpaceTimePath({
      grid,
      startX: robot.x,
      startY: robot.y,
      startHeading: robot.heading,
      goalX,
      goalY,
      startTime: 0,
      maxHorizon: horizon,
      agentId: robot.id,
      reservationTable: null,
      allowIgnoreReservations: true,
    });
    rootPaths.set(robot.id, p);
  }

  // Find first conflict
  const rootConflict = findFirstConflict(rootPaths);
  if (!rootConflict) {
    return { paths: rootPaths, durationMs: performance.now() - tStart, conflictTreeNodes: 1 };
  }

  // Queue of constraint tree nodes
  const queue = [
    {
      constraints: [],
      paths: rootPaths,
      cost: calculateSumOfCosts(rootPaths),
    },
  ];

  let bestSolution = rootPaths;

  while (queue.length > 0 && conflictTreeNodes < maxNodes) {
    conflictTreeNodes++;
    queue.sort((a, b) => a.cost - b.cost);
    const currentCT = queue.shift();

    const conflict = findFirstConflict(currentCT.paths);
    if (!conflict) {
      bestSolution = currentCT.paths;
      break;
    }

    // Branch on conflict: agentA cannot be at (x, y, t) OR agentB cannot be at (x, y, t)
    for (const agentId of [conflict.agentA, conflict.agentB]) {
      const newConstraints = [...currentCT.constraints, { agentId, x: conflict.x, y: conflict.y, t: conflict.t }];
      // Replan for this agent under constraints
      const newPaths = new Map(currentCT.paths);
      const robot = robots.find((r) => r.id === agentId);
      if (robot) {
        const goalX = robot.targetX ?? robot.x;
        const goalY = robot.targetY ?? robot.y;

        // Custom reservation table with constraints
        const constrainedTable = {
          isVertexFree: (x, y, t, id) => {
            return !newConstraints.some((c) => c.agentId === id && c.x === x && c.y === y && c.t === t);
          },
          isEdgeFree: () => true,
        };

        const replanned = planSpaceTimePath({
          grid,
          startX: robot.x,
          startY: robot.y,
          startHeading: robot.heading,
          goalX,
          goalY,
          startTime: 0,
          maxHorizon: horizon,
          agentId,
          reservationTable: constrainedTable,
        });

        if (replanned) {
          newPaths.set(agentId, replanned);
          queue.push({
            constraints: newConstraints,
            paths: newPaths,
            cost: calculateSumOfCosts(newPaths),
          });
        }
      }
    }
  }

  // If timed out and conflicts remain, safeguard unresolved agents by holding them in place
  const remainingConflict = findFirstConflict(bestSolution);
  if (remainingConflict) {
    const safePaths = new Map(bestSolution);
    const conflictedRobot = robots.find((r) => r.id === remainingConflict.agentB);
    if (conflictedRobot) {
      safePaths.set(conflictedRobot.id, [{ x: conflictedRobot.x, y: conflictedRobot.y, heading: conflictedRobot.heading, t: 0 }]);
    }
    bestSolution = safePaths;
  }

  const durationMs = performance.now() - tStart;
  return { paths: bestSolution, durationMs, conflictTreeNodes };
}

function findFirstConflict(pathsMap) {
  const agentIds = Array.from(pathsMap.keys());
  for (let i = 0; i < agentIds.length; i++) {
    const idA = agentIds[i];
    const pathA = pathsMap.get(idA) || [];
    if (pathA.length === 0) continue;

    for (let j = i + 1; j < agentIds.length; j++) {
      const idB = agentIds[j];
      const pathB = pathsMap.get(idB) || [];
      if (pathB.length === 0) continue;

      const maxLen = Math.max(pathA.length, pathB.length);
      for (let t = 0; t < maxLen; t++) {
        const stepA = t < pathA.length ? pathA[t] : pathA[pathA.length - 1];
        const stepB = t < pathB.length ? pathB[t] : pathB[pathB.length - 1];

        // Vertex conflict
        if (stepA.x === stepB.x && stepA.y === stepB.y) {
          return { agentA: idA, agentB: idB, x: stepA.x, y: stepA.y, t };
        }
        // Edge swap conflict
        if (t > 0 && t < pathA.length && t < pathB.length) {
          const prevA = pathA[t - 1];
          const prevB = pathB[t - 1];
          if (stepA.x === prevB.x && stepA.y === prevB.y &&
              prevA.x === stepB.x && prevA.y === stepB.y) {
            return { agentA: idA, agentB: idB, x: stepA.x, y: stepA.y, t };
          }
        }
      }
    }
  }
  return null;
}

function calculateSumOfCosts(pathsMap) {
  let sum = 0;
  for (const path of pathsMap.values()) {
    sum += path ? path.length : 100;
  }
  return sum;
}
