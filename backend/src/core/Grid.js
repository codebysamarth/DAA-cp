/**
 * Grid graph G = (V, E) built from a text map.
 *
 * Every cell gets one integer id:  id = y * width + x.
 * Using integers (not "x,y" strings) makes every lookup an O(1) array access.
 */
import { MAPS } from './maps.js';

export const CELL = { FREE: 0, RACK: 1, STATION: 2, WALL: 3 };

// 4-connected moves: up, right, down, left
const DX = [0, 1, 0, -1];
const DY = [-1, 0, 1, 0];

export class Grid {
  constructor(rows) {
    this.height = rows.length;
    this.width = rows[0].length;
    this.N = this.width * this.height; // |V|
    this.type = new Uint8Array(this.N);
    this.racks = [];
    this.stations = [];
    this.depots = [];

    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        const id = y * this.width + x;
        const ch = rows[y][x];
        if (ch === '#') this.type[id] = CELL.WALL;
        else if (ch === 'R') { this.type[id] = CELL.RACK; this.racks.push(id); }
        else if (ch === 'S') { this.type[id] = CELL.STATION; this.stations.push(id); }
        else {
          this.type[id] = CELL.FREE;
          if (ch === 'D') this.depots.push(id);
        }
      }
    }

    // Adjacency list: neighbours[id] = ids of the (up to 4) non-wall cells next to it.
    // Built once, so search never recomputes x/y bounds.
    this.neighbours = new Array(this.N);
    for (let id = 0; id < this.N; id++) {
      const list = [];
      if (this.type[id] !== CELL.WALL) {
        const x = id % this.width;
        const y = (id - x) / this.width;
        for (let d = 0; d < 4; d++) {
          const nx = x + DX[d];
          const ny = y + DY[d];
          if (nx < 0 || ny < 0 || nx >= this.width || ny >= this.height) continue;
          const nid = ny * this.width + nx;
          if (this.type[nid] !== CELL.WALL) list.push(nid);
        }
      }
      this.neighbours[id] = list;
    }
  }

  /** Robots may drive through free cells and stations. Racks only as a goal. */
  isDrivable(id) {
    const t = this.type[id];
    return t === CELL.FREE || t === CELL.STATION;
  }

  x(id) { return id % this.width; }
  y(id) { return Math.floor(id / this.width); }

  manhattan(a, b) {
    return Math.abs(this.x(a) - this.x(b)) + Math.abs(this.y(a) - this.y(b));
  }
}

const gridCache = new Map();

/** Returns the (cached) Grid for a map id. */
export function loadGrid(mapId) {
  const map = MAPS[mapId];
  if (!map) throw new Error(`Unknown map "${mapId}"`);
  if (!gridCache.has(mapId)) gridCache.set(mapId, new Grid(map.rows));
  return gridCache.get(mapId);
}
