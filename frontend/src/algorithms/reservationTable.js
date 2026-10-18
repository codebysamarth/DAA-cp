/**
 * Space-Time Reservation Table
 * Maintains collision-free occupancy records for vertices (x, y, t)
 * and directed edges (u -> v, t) to eliminate:
 * 1. Vertex Conflicts: Two agents occupying the same cell at time t.
 * 2. Edge-Swap Conflicts: Two agents crossing the same edge in opposite directions at the same step.
 */

export class SpaceTimeReservationTable {
  constructor() {
    // Map: "x,y,t" -> agentId
    this.vertexReservations = new Map();
    // Map: "fromX,fromY->toX,toY,t" -> agentId
    this.edgeReservations = new Map();
    // Agent paths registry: agentId -> Array<{ x, y, t, heading }>
    this.agentPaths = new Map();
    // Spatial density tracking: "x,y" -> reservation count (for fast heatmap)
    this.spatialHeatmap = new Map();
  }

  clear() {
    this.vertexReservations.clear();
    this.edgeReservations.clear();
    this.agentPaths.clear();
    this.spatialHeatmap.clear();
  }

  vertexKey(x, y, t) {
    return `${x},${y},${t}`;
  }

  edgeKey(fromX, fromY, toX, toY, t) {
    return `${fromX},${fromY}->${toX},${toY},${t}`;
  }

  isVertexFree(x, y, t, currentAgentId = null) {
    const key = this.vertexKey(x, y, t);
    const occupant = this.vertexReservations.get(key);
    return occupant === undefined || occupant === currentAgentId;
  }

  isEdgeFree(fromX, fromY, toX, toY, t, currentAgentId = null) {
    // Edge swap: check if another agent moves from (toX, toY) to (fromX, fromY) at time t
    const reverseKey = this.edgeKey(toX, toY, fromX, fromY, t);
    const occupant = this.edgeReservations.get(reverseKey);
    return occupant === undefined || occupant === currentAgentId;
  }

  reserveVertex(x, y, t, agentId) {
    this.vertexReservations.set(this.vertexKey(x, y, t), agentId);
    const spatialKey = `${x},${y}`;
    this.spatialHeatmap.set(spatialKey, (this.spatialHeatmap.get(spatialKey) || 0) + 1);
  }

  reserveEdge(fromX, fromY, toX, toY, t, agentId) {
    this.edgeReservations.set(this.edgeKey(fromX, fromY, toX, toY, t), agentId);
  }

  /**
   * Commit a planned multi-step trajectory for an agent
   */
  commitPath(agentId, path) {
    this.clearAgent(agentId);
    this.agentPaths.set(agentId, path);

    for (let i = 0; i < path.length; i++) {
      const step = path[i];
      this.reserveVertex(step.x, step.y, step.t, agentId);

      if (i > 0) {
        const prev = path[i - 1];
        if (prev.x !== step.x || prev.y !== step.y) {
          this.reserveEdge(prev.x, prev.y, step.x, step.y, step.t, agentId);
        }
      }
    }
  }

  /**
   * Reserves an agent's occupancy in a fixed vertex (x, y) across a time horizon.
   * Guarantees that stationary, parked, or waiting AMRs prevent other robots from colliding with them.
   */
  reserveStaticOccupancy(agentId, x, y, maxHorizon = 24, startT = 0) {
    const steps = [];
    for (let t = startT; t <= maxHorizon; t++) {
      this.reserveVertex(x, y, t, agentId);
      steps.push({ x, y, t, heading: 0 });
    }
    const existing = this.agentPaths.get(agentId);
    if (existing && startT > 0) {
      this.agentPaths.set(agentId, [...existing.slice(0, startT), ...steps]);
    } else {
      this.agentPaths.set(agentId, steps);
    }
  }

  /**
   * Clears an agent's reservations from the table (used during selective local repair or rerouting)
   */
  clearAgent(agentId) {
    const existingPath = this.agentPaths.get(agentId);
    if (!existingPath) return;

    for (let i = 0; i < existingPath.length; i++) {
      const step = existingPath[i];
      this.vertexReservations.delete(this.vertexKey(step.x, step.y, step.t));

      const spatialKey = `${step.x},${step.y}`;
      const count = this.spatialHeatmap.get(spatialKey) || 0;
      if (count <= 1) {
        this.spatialHeatmap.delete(spatialKey);
      } else {
        this.spatialHeatmap.set(spatialKey, count - 1);
      }

      if (i > 0) {
        const prev = existingPath[i - 1];
        this.edgeReservations.delete(this.edgeKey(prev.x, prev.y, step.x, step.y, step.t));
      }
    }

    this.agentPaths.delete(agentId);
  }

  /**
   * Calculate local congestion density around a coordinate over a time window
   * Used by CA-RHPP's Congestion-Aware Task Allocator and Priority Scorer
   */
  getCongestionDensity(cx, cy, radius = 2, fromTime = 0, toTime = 20) {
    let count = 0;
    for (let dx = -radius; dx <= radius; dx++) {
      for (let dy = -radius; dy <= radius; dy++) {
        const x = cx + dx;
        const y = cy + dy;
        for (let t = fromTime; t <= toTime; t++) {
          if (this.vertexReservations.has(this.vertexKey(x, y, t))) {
            count++;
          }
        }
      }
    }
    return count;
  }

  /**
   * Identifies all agents that conflict with a given trajectory
   */
  findConflictingAgents(path, myAgentId) {
    const conflicting = new Set();
    for (let i = 0; i < path.length; i++) {
      const step = path[i];
      const occupant = this.vertexReservations.get(this.vertexKey(step.x, step.y, step.t));
      if (occupant !== undefined && occupant !== myAgentId) {
        conflicting.add(occupant);
      }
      if (i > 0) {
        const prev = path[i - 1];
        const swapOccupant = this.edgeReservations.get(this.edgeKey(step.x, step.y, prev.x, prev.y, step.t));
        if (swapOccupant !== undefined && swapOccupant !== myAgentId) {
          conflicting.add(swapOccupant);
        }
      }
    }
    return Array.from(conflicting);
  }
}
