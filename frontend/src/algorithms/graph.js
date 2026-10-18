/**
 * Warehouse Graph and Topology Definition
 * Grid Graph G = (V, E) with support for:
 * - Aisles (traversable)
 * - Storage Pod Racks (non-traversable during movement, pick/drop targets)
 * - Workstations / Picking Bays (order fulfillment)
 * - Replenishment / Depots (idle parking and restocking)
 * - Blocked cells (temporary or physical obstacles)
 */

export const CELL_TYPES = {
  EMPTY: 'empty',
  RACK: 'rack',
  PICK_STATION: 'pick_station',
  DEPOT: 'depot',
  BLOCKED: 'blocked',
};

export const DIRECTIONS = [
  { dx: 0, dy: -1, heading: 0, name: 'North' }, // 0: N
  { dx: 1, dy: 0, heading: 1, name: 'East' },   // 1: E
  { dx: 0, dy: 1, heading: 2, name: 'South' },  // 2: S
  { dx: -1, dy: 0, heading: 3, name: 'West' },  // 3: W
];

export const TURN_PENALTY = 0.5; // Turn cost in time ticks

/**
 * Predefined Scenarios
 */
export const SCENARIOS = {
  KIVA_STANDARD: {
    id: 'kiva_standard',
    name: 'Amazon Kiva Fulfillment Grid',
    description: 'Standard grid layout with storage pod blocks, bidirectional perimeter highways, and 4 picking stations.',
    width: 26,
    height: 16,
    defaultRobots: 12,
    generate: (w, h) => {
      const grid = Array(h).fill(null).map(() => Array(w).fill(CELL_TYPES.EMPTY));
      const racks = [];
      const pickStations = [];
      const depots = [];

      // 4 picking stations along the bottom edge
      const stationX = [3, 9, 16, 22];
      stationX.forEach((x, idx) => {
        grid[h - 1][x] = CELL_TYPES.PICK_STATION;
        pickStations.push({ id: `PS-${idx + 1}`, x, y: h - 1, label: `Station ${idx + 1}` });
      });

      // Depots / Charging pads along top edge
      const depotX = [2, 6, 12, 18, 23];
      depotX.forEach((x, idx) => {
        grid[0][x] = CELL_TYPES.DEPOT;
        depots.push({ id: `DEP-${idx + 1}`, x, y: 0 });
      });

      // Storage Rack Pods arranged in 2xN blocks with aisles
      for (let r = 2; r < h - 2; r++) {
        // Skip horizontal cross-aisles at r = 5 and r = 9
        if (r === 5 || r === 9) continue;
        for (let c = 2; c < w - 2; c++) {
          // Columns have 2-wide pods and 2-wide aisles
          // Pods at c in [2,3], [6,7], [10,11], [14,15], [18,19], [22,23]
          const colBlock = c % 4;
          if (colBlock === 2 || colBlock === 3) {
            grid[r][c] = CELL_TYPES.RACK;
            racks.push({
              id: `POD-${racks.length + 1}`,
              x: c,
              y: r,
              sku: `SKU-${1000 + racks.length}`,
              name: `Item Block ${racks.length + 1}`,
              stock: Math.floor(Math.random() * 80) + 20,
            });
          }
        }
      }

      return { grid, racks, pickStations, depots };
    },
  },

  BOTTLENECK_CORRIDOR: {
    id: 'bottleneck_corridor',
    name: 'High-Congestion Bottleneck Corridor',
    description: 'Two large warehouse zones connected solely by a narrow 2-cell central passage. Ideal for stress-testing congestion-aware priority replanning.',
    width: 24,
    height: 14,
    defaultRobots: 10,
    generate: (w, h) => {
      const grid = Array(h).fill(null).map(() => Array(w).fill(CELL_TYPES.EMPTY));
      const racks = [];
      const pickStations = [];
      const depots = [];

      // Dividing wall in the center at x = 11, 12 with narrow gap at y = 6, 7
      for (let y = 0; y < h; y++) {
        if (y !== 6 && y !== 7) {
          grid[y][11] = CELL_TYPES.BLOCKED;
          grid[y][12] = CELL_TYPES.BLOCKED;
        }
      }

      // West zone racks
      for (let r = 2; r < h - 2; r += 2) {
        for (let c = 2; c < 10; c += 2) {
          grid[r][c] = CELL_TYPES.RACK;
          racks.push({ id: `POD-W${racks.length + 1}`, x: c, y: r, sku: `SKU-${2000 + racks.length}`, stock: 50 });
        }
      }

      // East zone racks
      for (let r = 2; r < h - 2; r += 2) {
        for (let c = 14; c < w - 2; c += 2) {
          grid[r][c] = CELL_TYPES.RACK;
          racks.push({ id: `POD-E${racks.length + 1}`, x: c, y: r, sku: `SKU-${3000 + racks.length}`, stock: 50 });
        }
      }

      // Pick stations on the East side
      grid[h - 1][16] = CELL_TYPES.PICK_STATION;
      grid[h - 1][20] = CELL_TYPES.PICK_STATION;
      pickStations.push({ id: 'PS-1', x: 16, y: h - 1, label: 'East Station 1' });
      pickStations.push({ id: 'PS-2', x: 20, y: h - 1, label: 'East Station 2' });

      // Depots on West side
      grid[0][3] = CELL_TYPES.DEPOT;
      grid[0][7] = CELL_TYPES.DEPOT;
      depots.push({ id: 'DEP-1', x: 3, y: 0 });
      depots.push({ id: 'DEP-2', x: 7, y: 0 });

      return { grid, racks, pickStations, depots };
    },
  },

  DENSE_ECOMMERCE: {
    id: 'dense_ecommerce',
    name: 'Dense E-Commerce Sorting Hub',
    description: 'High-density multi-aisle facility featuring 6 workstations and high robot fleet volume.',
    width: 30,
    height: 18,
    defaultRobots: 16,
    generate: (w, h) => {
      const grid = Array(h).fill(null).map(() => Array(w).fill(CELL_TYPES.EMPTY));
      const racks = [];
      const pickStations = [];
      const depots = [];

      // 6 picking stations along bottom
      const pX = [3, 7, 12, 17, 22, 26];
      pX.forEach((x, idx) => {
        grid[h - 1][x] = CELL_TYPES.PICK_STATION;
        pickStations.push({ id: `PS-${idx + 1}`, x, y: h - 1, label: `Station ${idx + 1}` });
      });

      // Depots at top
      const dX = [2, 8, 14, 20, 26];
      dX.forEach((x, idx) => {
        grid[0][x] = CELL_TYPES.DEPOT;
        depots.push({ id: `DEP-${idx + 1}`, x, y: 0 });
      });

      // Dense pod pods
      for (let r = 2; r < h - 2; r++) {
        if (r === 6 || r === 11) continue; // Major crossways
        for (let c = 2; c < w - 2; c++) {
          const mod = c % 5;
          if (mod === 2 || mod === 3) {
            grid[r][c] = CELL_TYPES.RACK;
            racks.push({
              id: `POD-${racks.length + 1}`,
              x: c,
              y: r,
              sku: `SKU-${4000 + racks.length}`,
              stock: Math.floor(Math.random() * 60) + 40,
            });
          }
        }
      }

      return { grid, racks, pickStations, depots };
    },
  },
};

/**
 * Checks if a coordinate is within warehouse bounds and not blocked
 */
export function isTraversable(grid, x, y, isPodAccess = false) {
  if (!grid || y < 0 || y >= grid.length || x < 0 || x >= grid[0].length) {
    return false;
  }
  const cell = grid[y][x];
  if (cell === CELL_TYPES.BLOCKED) return false;
  if (cell === CELL_TYPES.RACK && !isPodAccess) return false;
  return true;
}

/**
 * Admissible Manhattan Distance with optional turn estimate
 */
export function manhattanDistance(x1, y1, x2, y2) {
  return Math.abs(x1 - x2) + Math.abs(y1 - y2);
}
