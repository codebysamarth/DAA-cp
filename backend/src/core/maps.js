/**
 * Warehouse maps, written as plain text so they are easy to read.
 *
 *   .  free aisle cell (robots can drive here)
 *   R  storage rack / pod (a robot may enter ONLY if it is its pickup goal)
 *   S  picking station (orders are delivered here)
 *   D  depot (just a free cell where robots start)
 *   #  wall
 */
export const MAPS = {
  warehouse: {
    name: 'Kiva-style Warehouse',
    description: '2-wide racks with 2-wide aisles, 4 picking stations at the bottom.',
    defaultRobots: 12,
    rows: [
      '.D......D....D...D......D.',
      '..........................',
      '..RR..RR..RR..RR..RR..RR..',
      '..RR..RR..RR..RR..RR..RR..',
      '..RR..RR..RR..RR..RR..RR..',
      '..........................',
      '..RR..RR..RR..RR..RR..RR..',
      '..RR..RR..RR..RR..RR..RR..',
      '..RR..RR..RR..RR..RR..RR..',
      '..........................',
      '..RR..RR..RR..RR..RR..RR..',
      '..RR..RR..RR..RR..RR..RR..',
      '..RR..RR..RR..RR..RR..RR..',
      '..RR..RR..RR..RR..RR..RR..',
      '..........................',
      '....S....S......S....S....',
    ],
  },

  bottleneck: {
    name: 'Bottleneck Corridor',
    description: 'Two zones joined by a 2-cell gap. Stations are only on the east side, so traffic must cross the gap.',
    defaultRobots: 10,
    rows: [
      '...D...D...##...........',
      '...........##...........',
      '..R.R.R.R..##.R.R.R.R...',
      '...........##...........',
      '..R.R.R.R..##.R.R.R.R...',
      '...........##...........',
      '..R.R.R.R.....R.R.R.R...',
      '........................',
      '..R.R.R.R..##.R.R.R.R...',
      '...........##...........',
      '..R.R.R.R..##.R.R.R.R...',
      '...........##...........',
      '...........##...........',
      '...........##...S...S...',
    ],
  },

  narrow: {
    name: 'Narrow-Aisle Warehouse',
    description: '1-wide aisles: robots cannot pass each other inside an aisle. Hardest map for congestion.',
    defaultRobots: 16,
    rows: [
      'D.....D.....D.....D.....D...',
      '............................',
      '.RR.RR.RR.RR.RR.RR.RR.RR.RR.',
      '.RR.RR.RR.RR.RR.RR.RR.RR.RR.',
      '.RR.RR.RR.RR.RR.RR.RR.RR.RR.',
      '.RR.RR.RR.RR.RR.RR.RR.RR.RR.',
      '............................',
      '.RR.RR.RR.RR.RR.RR.RR.RR.RR.',
      '.RR.RR.RR.RR.RR.RR.RR.RR.RR.',
      '.RR.RR.RR.RR.RR.RR.RR.RR.RR.',
      '.RR.RR.RR.RR.RR.RR.RR.RR.RR.',
      '............................',
      '.RR.RR.RR.RR.RR.RR.RR.RR.RR.',
      '.RR.RR.RR.RR.RR.RR.RR.RR.RR.',
      '.RR.RR.RR.RR.RR.RR.RR.RR.RR.',
      '.RR.RR.RR.RR.RR.RR.RR.RR.RR.',
      '............................',
      '...S.....S.....S.....S.....S',
    ],
  },
};
