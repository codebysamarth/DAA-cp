/**
 * CA-RHPP / ACRH-LCR
 * (Adaptive Congestion-Aware Rolling-Horizon Prioritized Planning with Selective Local Conflict Repair)
 *
 * Core Novelty Pipeline:
 * 1. Stage 1: Congestion-Aware Task Allocation (matches idle AGVs to tasks with path traffic penalty)
 * 2. Stage 2: Dynamic Priority Scoring (prevents starvation, reorders based on urgency & wait times)
 * 3. Stage 3: Windowed Space-Time Planning with Reservation Table
 * 4. Stage 4: Selective Local Conflict Repair (extracts k conflicting agents and repairs them in R passes)
 */

import { planSpaceTimePath } from './spaceTimeAStar.js';
import { manhattanDistance } from './graph.js';

export class CARHPPPlanner {
  constructor({
    horizon = 24,
    executionWindow = 8,
    priorityWeights = { wait: 1.5, urgency: 1.2, congestion: 0.8 },
    maxRepairIterations = 5,
    maxNeighborhoodSize = 4,
  } = {}) {
    this.horizon = horizon;
    this.executionWindow = executionWindow;
    this.priorityWeights = priorityWeights;
    this.maxRepairIterations = maxRepairIterations;
    this.maxNeighborhoodSize = maxNeighborhoodSize;

    // Analytics counters
    this.metrics = {
      totalPlanningTimeMs: 0,
      totalPlanningCycles: 0,
      lastCycleTimeMs: 0,
      localRepairsTriggered: 0,
      totalWaitTicksPrevented: 0,
      averagePriorityScores: [],
    };
  }

  /**
   * Stage 1: Congestion-Aware Task Allocation
   * Matches idle robots to pending tasks, scoring distance + predicted corridor congestion
   */
  allocateTasks(robots, pendingTasks, reservationTable) {
    const idleRobots = robots.filter((r) => r.state === 'IDLE');
    if (idleRobots.length === 0 || pendingTasks.length === 0) return [];

    const assignments = [];
    const assignedTaskIds = new Set();
    const assignedRobotIds = new Set();

    for (const robot of idleRobots) {
      if (assignedRobotIds.has(robot.id)) continue;

      let bestTask = null;
      let minCost = Infinity;

      for (const task of pendingTasks) {
        if (assignedTaskIds.has(task.id)) continue;

        // Base Euclidean/Manhattan distance
        const dist = manhattanDistance(robot.x, robot.y, task.pickupX, task.pickupY);

        // Path corridor congestion density estimate
        const midX = Math.floor((robot.x + task.pickupX) / 2);
        const midY = Math.floor((robot.y + task.pickupY) / 2);
        const corridorCongestion = reservationTable.getCongestionDensity(midX, midY, 2, 0, 15);

        // Active aisle occupancy: check how many robots are already operating in this aisle column
        const aisleOccupancy = robots.filter(
          (r) => r.state !== 'IDLE' && Math.abs(r.x - task.pickupX) <= 1
        ).length;

        // Combined allocation cost with Aisle Load Balancing
        const cost = dist + 2.0 * corridorCongestion + 3.5 * aisleOccupancy;

        if (cost < minCost) {
          minCost = cost;
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
   * Stage 2: Dynamic Priority Scoring
   * Calculates dynamic score:
   * Score = w_wait * (waitTime) + w_urgency * (urgency) + w_congest * (corridorFactor)
   */
  calculatePriorityScore(robot, reservationTable, currentTime) {
    const w = this.priorityWeights;
    const waitScore = robot.waitTicks * w.wait;

    // Task urgency: closer to deadline yields higher priority
    let urgencyScore = 0;
    if (robot.currentTask && robot.currentTask.deadline) {
      const remainingTime = Math.max(1, robot.currentTask.deadline - currentTime);
      urgencyScore = (100 / remainingTime) * w.urgency;
    }

    // Bottleneck / congestion factor around current robot position
    const localDensity = reservationTable.getCongestionDensity(robot.x, robot.y, 2, 0, 10);
    const congestionScore = localDensity * w.congestion;

    // Station clearance bonus: an AMR clearing a station or returning to depot must exit first
    const clearanceBonus = robot.state === 'RETURNING' ? 35 : 0;

    return {
      total: waitScore + urgencyScore + congestionScore + clearanceBonus + (robot.priorityBonus || 0),
      breakdown: { waitScore, urgencyScore, congestionScore, clearanceBonus },
    };
  }

  /**
   * Main Planning Cycle: Plans or replans paths for the fleet
   */
  planFleet({
    grid,
    robots,
    reservationTable,
    currentTime,
    enableLocalRepair = true,
    enableCongestionBias = true,
  }) {
    const tStart = performance.now();

    // 1. Calculate dynamic priorities and sort robots descending
    const robotScores = robots.map((robot) => {
      const { total, breakdown } = this.calculatePriorityScore(robot, reservationTable, currentTime);
      return { robot, score: total, breakdown };
    });

    robotScores.sort((a, b) => b.score - a.score);

    // Save score metrics for inspector
    this.metrics.averagePriorityScores = robotScores.map((rs) => ({
      id: rs.robot.id,
      score: rs.score.toFixed(1),
      wait: rs.robot.waitTicks,
      breakdown: rs.breakdown,
    }));

    // Clear reservations for all robots that need planning
    for (const rs of robotScores) {
      reservationTable.clearAgent(rs.robot.id);
    }

    const failedAgents = [];
    const plannedPaths = new Map();

    // 2. Stage 3: Sequential Windowed Space-Time Planning
    for (const { robot } of robotScores) {
      let goalX = robot.targetX;
      let goalY = robot.targetY;

      // If robot has no target or is already at its target, it parks/waits safely
      if (goalX === null || goalX === undefined || (goalX === robot.x && goalY === robot.y)) {
        reservationTable.reserveStaticOccupancy(robot.id, robot.x, robot.y, this.horizon, 0);
        plannedPaths.set(robot.id, [{ x: robot.x, y: robot.y, heading: robot.heading, t: 0 }]);
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
        maxHorizon: this.horizon,
        agentId: robot.id,
        reservationTable,
        congestionBias: enableCongestionBias ? 0.4 : 0,
      });

      if (!path || path.length <= 1) {
        failedAgents.push(robot);
        // While waiting/repairing, reserve its static cell so other AMRs do not collide with it
        reservationTable.reserveStaticOccupancy(robot.id, robot.x, robot.y, this.horizon, 0);
        plannedPaths.set(robot.id, [{ x: robot.x, y: robot.y, heading: robot.heading, t: 0 }]);
      } else {
        reservationTable.commitPath(robot.id, path);
        // Reserve terminal position for remaining horizon steps so trailing robots don't collide
        if (path.length - 1 < this.horizon) {
          const lastStep = path[path.length - 1];
          reservationTable.reserveStaticOccupancy(
            robot.id,
            lastStep.x,
            lastStep.y,
            this.horizon,
            path.length
          );
        }
        plannedPaths.set(robot.id, path);
      }
    }

    // 3. Stage 4: Selective Local Conflict Repair (LCR)
    // If any high-priority agent is blocked or failed, extract local neighborhood and repair
    if (enableLocalRepair && failedAgents.length > 0) {
      this.metrics.localRepairsTriggered++;
      for (const failedRobot of failedAgents) {
        this.executeLocalRepair({
          failedRobot,
          grid,
          reservationTable,
          plannedPaths,
          robotScores,
        });
      }
    }

    // Record metrics
    const tEnd = performance.now();
    const cycleDuration = tEnd - tStart;
    this.metrics.lastCycleTimeMs = cycleDuration;
    this.metrics.totalPlanningTimeMs += cycleDuration;
    this.metrics.totalPlanningCycles++;

    return plannedPaths;
  }

  /**
   * Stage 4: Selective Local Conflict Repair Implementation
   * Extracts k conflicting agents and iteratively repairs their trajectories
   */
  executeLocalRepair({ failedRobot, grid, reservationTable, plannedPaths, robotScores }) {
    let goalX = failedRobot.targetX ?? failedRobot.x;
    let goalY = failedRobot.targetY ?? failedRobot.y;

    // Plan an unconstrained path to find which agents are physically blocking it
    const directPath = planSpaceTimePath({
      grid,
      startX: failedRobot.x,
      startY: failedRobot.y,
      startHeading: failedRobot.heading,
      goalX,
      goalY,
      startTime: 0,
      maxHorizon: this.horizon,
      agentId: failedRobot.id,
      reservationTable: null, // Unconstrained
      allowIgnoreReservations: true,
    });

    if (!directPath) return;

    // Find up to k conflicting agents along this ideal trajectory
    const conflictingAgentIds = reservationTable
      .findConflictingAgents(directPath, failedRobot.id)
      .slice(0, this.maxNeighborhoodSize);

    if (conflictingAgentIds.length === 0) return;

    // Neighborhood to repair: [failedRobot, ...conflictingAgents]
    const neighborhoodIds = [failedRobot.id, ...conflictingAgentIds];

    // Backup current trajectories for rollback safety
    const backupPaths = new Map();
    for (const id of neighborhoodIds) {
      if (plannedPaths.has(id)) {
        backupPaths.set(id, plannedPaths.get(id));
      }
    }

    // Attempt repair iterations
    let repairSuccess = false;
    const candidatePaths = new Map();

    for (let iter = 0; iter < this.maxRepairIterations; iter++) {
      // Clear reservations for this neighborhood to test new ordering/routing
      for (const id of neighborhoodIds) {
        reservationTable.clearAgent(id);
      }
      candidatePaths.clear();

      // Prioritize the blocked/failed robot first
      const order = iter % 2 === 0 ? [...neighborhoodIds].reverse() : [...neighborhoodIds];
      let allPlanned = true;

      for (const id of order) {
        const robotObj = robotScores.find((r) => r.robot.id === id)?.robot;
        if (!robotObj) continue;

        const gX = robotObj.targetX ?? robotObj.x;
        const gY = robotObj.targetY ?? robotObj.y;

        const path = planSpaceTimePath({
          grid,
          startX: robotObj.x,
          startY: robotObj.y,
          startHeading: robotObj.heading,
          goalX: gX,
          goalY: gY,
          startTime: 0,
          maxHorizon: this.horizon,
          agentId: id,
          reservationTable,
          congestionBias: 0.2,
        });

        if (path && path.length > 1) {
          reservationTable.commitPath(id, path);
          if (path.length - 1 < this.horizon) {
            const lastStep = path[path.length - 1];
            reservationTable.reserveStaticOccupancy(id, lastStep.x, lastStep.y, this.horizon, path.length);
          }
          candidatePaths.set(id, path);
        } else {
          allPlanned = false;
          break;
        }
      }

      if (allPlanned) {
        repairSuccess = true;
        for (const [id, path] of candidatePaths.entries()) {
          plannedPaths.set(id, path);
        }
        break;
      }
    }

    // If repair failed to find collision-free paths for all, cleanly rollback
    if (!repairSuccess) {
      for (const id of neighborhoodIds) {
        reservationTable.clearAgent(id);
      }
      for (const id of neighborhoodIds) {
        const prev = backupPaths.get(id);
        if (prev && prev.length > 1) {
          reservationTable.commitPath(id, prev);
          if (prev.length - 1 < this.horizon) {
            const lastStep = prev[prev.length - 1];
            reservationTable.reserveStaticOccupancy(id, lastStep.x, lastStep.y, this.horizon, prev.length);
          }
          plannedPaths.set(id, prev);
        } else {
          // Stationary wait: stay in current cell safely
          const robotObj = robotScores.find((r) => r.robot.id === id)?.robot;
          const rx = robotObj ? robotObj.x : 0;
          const ry = robotObj ? robotObj.y : 0;
          reservationTable.reserveStaticOccupancy(id, rx, ry, this.horizon, 0);
          plannedPaths.set(id, [{ x: rx, y: ry, heading: robotObj?.heading || 0, t: 0 }]);
        }
      }
    }
  }
}
