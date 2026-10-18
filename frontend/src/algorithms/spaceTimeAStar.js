/**
 * Space-Time A* (Single Agent Low-Level Planner)
 * Searches state space S = (x, y, heading, t)
 * Actions:
 * - Forward move: (x + dx, y + dy, heading, t + 1)
 * - Wait in place: (x, y, heading, t + 1)
 * - In-place rotation: (x, y, new_heading, t + 1)
 *
 * Checks space-time reservations to ensure collision-free paths.
 */

import { DIRECTIONS, TURN_PENALTY, isTraversable, manhattanDistance } from './graph.js';

class MinHeap {
  constructor() {
    this.data = [];
  }
  push(item) {
    this.data.push(item);
    this.bubbleUp(this.data.length - 1);
  }
  pop() {
    if (this.data.length === 0) return null;
    const top = this.data[0];
    const bottom = this.data.pop();
    if (this.data.length > 0) {
      this.data[0] = bottom;
      this.sinkDown(0);
    }
    return top;
  }
  isEmpty() {
    return this.data.length === 0;
  }
  bubbleUp(index) {
    while (index > 0) {
      const parentIndex = Math.floor((index - 1) / 2);
      if (this.data[index].f < this.data[parentIndex].f) {
        [this.data[index], this.data[parentIndex]] = [this.data[parentIndex], this.data[index]];
        index = parentIndex;
      } else {
        break;
      }
    }
  }
  sinkDown(index) {
    const length = this.data.length;
    while (true) {
      let left = 2 * index + 1;
      let right = 2 * index + 2;
      let smallest = index;

      if (left < length && this.data[left].f < this.data[smallest].f) {
        smallest = left;
      }
      if (right < length && this.data[right].f < this.data[smallest].f) {
        smallest = right;
      }
      if (smallest !== index) {
        [this.data[index], this.data[smallest]] = [this.data[smallest], this.data[index]];
        index = smallest;
      } else {
        break;
      }
    }
  }
}

/**
 * Plans a collision-free path for a single agent from (startX, startY) to (goalX, goalY)
 * within time horizon [startTime, startTime + maxHorizon]
 */
export function planSpaceTimePath({
  grid,
  startX,
  startY,
  startHeading = 1,
  goalX,
  goalY,
  startTime = 0,
  maxHorizon = 30,
  agentId,
  reservationTable = null,
  congestionBias = 0, // Soft penalty for congested zones
  allowIgnoreReservations = false, // Used for Baseline 1 (Independent A*)
}) {
  const openSet = new MinHeap();
  // Closed set maps "x,y,heading,t" -> best gCost
  const closedSet = new Map();

  const startH = manhattanDistance(startX, startY, goalX, goalY);
  const startNode = {
    x: startX,
    y: startY,
    heading: startHeading,
    t: startTime,
    g: 0,
    h: startH,
    f: startH,
    parent: null,
  };

  openSet.push(startNode);
  let bestPartialNode = startNode;
  let iterations = 0;
  const maxIterations = 5000;

  while (!openSet.isEmpty() && iterations++ < maxIterations) {
    const current = openSet.pop();

    // Check if goal is reached
    if (current.x === goalX && current.y === goalY) {
      return reconstructPath(current);
    }

    // Keep track of best partial path if we hit horizon cutoff
    if (current.h < bestPartialNode.h) {
      bestPartialNode = current;
    }

    // Check horizon limit
    if (current.t >= startTime + maxHorizon) {
      continue;
    }

    const stateKey = `${current.x},${current.y},${current.heading},${current.t}`;
    if (closedSet.has(stateKey) && closedSet.get(stateKey) <= current.g) {
      continue;
    }
    closedSet.set(stateKey, current.g);

    // Expand transitions:
    // Action 1: Forward Movement in current heading
    const dir = DIRECTIONS[current.heading];
    const nextX = current.x + dir.dx;
    const nextY = current.y + dir.dy;
    const nextT = current.t + 1;

    const isPodTarget = nextX === goalX && nextY === goalY;
    if (isTraversable(grid, nextX, nextY, isPodTarget)) {
      // Check reservation table for vertex & edge collision
      let isSafe = true;
      if (reservationTable && !allowIgnoreReservations) {
        const vertexSafe = reservationTable.isVertexFree(nextX, nextY, nextT, agentId);
        const edgeSafe = reservationTable.isEdgeFree(current.x, current.y, nextX, nextY, nextT, agentId);
        isSafe = vertexSafe && edgeSafe;
      }

      if (isSafe) {
        let softCost = 1.0;
        if (congestionBias > 0 && reservationTable) {
          const density = reservationTable.getCongestionDensity(nextX, nextY, 1, nextT, nextT + 3);
          softCost += density * congestionBias;
        }

        const nextG = current.g + softCost;
        const nextH = manhattanDistance(nextX, nextY, goalX, goalY);
        openSet.push({
          x: nextX,
          y: nextY,
          heading: current.heading,
          t: nextT,
          g: nextG,
          h: nextH,
          f: nextG + nextH,
          parent: current,
        });
      }
    }

    // Action 2: Wait in place
    let waitSafe = true;
    if (reservationTable && !allowIgnoreReservations) {
      waitSafe = reservationTable.isVertexFree(current.x, current.y, nextT, agentId);
    }
    if (waitSafe) {
      const waitG = current.g + 1.1; // Slight penalty for waiting over moving
      const waitH = current.h;
      openSet.push({
        x: current.x,
        y: current.y,
        heading: current.heading,
        t: nextT,
        g: waitG,
        h: waitH,
        f: waitG + waitH,
        parent: current,
      });
    }

    // Action 3: Turn in place (Left and Right)
    for (const turnDelta of [-1, 1]) {
      const newHeading = (current.heading + turnDelta + 4) % 4;
      let turnSafe = true;
      if (reservationTable && !allowIgnoreReservations) {
        turnSafe = reservationTable.isVertexFree(current.x, current.y, nextT, agentId);
      }
      if (turnSafe) {
        const turnG = current.g + 1.0 + TURN_PENALTY;
        const turnH = current.h;
        openSet.push({
          x: current.x,
          y: current.y,
          heading: newHeading,
          t: nextT,
          g: turnG,
          h: turnH,
          f: turnG + turnH,
          parent: current,
        });
      }
    }
  }

  // If complete goal not reached within horizon, return best partial path
  return reconstructPath(bestPartialNode);
}

function reconstructPath(node) {
  const path = [];
  let curr = node;
  while (curr) {
    path.unshift({
      x: curr.x,
      y: curr.y,
      heading: curr.heading,
      t: curr.t,
    });
    curr = curr.parent;
  }
  return path;
}
