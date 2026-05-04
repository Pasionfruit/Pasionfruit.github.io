// Map dimensions
export const MAP_COLS = 30
export const MAP_ROWS = 20
export const TILE_SIZE = 40 // px

// Terrain types
export const TERRAIN = {
  GRASS: 'grass',
  PATH: 'path',
  WATER: 'water',
  SAND: 'sand',
  WALL: 'wall',     // impassable
  PORTAL: 'portal', // zone entrance (also passable)
}

// Character state by terrain
export const TERRAIN_STATE = {
  [TERRAIN.GRASS]: 'run',
  [TERRAIN.PATH]:  'bike',
  [TERRAIN.WATER]: 'swim',
  [TERRAIN.SAND]:  'run',
  [TERRAIN.WALL]:  'run',
  [TERRAIN.PORTAL]:'run',
}

// Portals: tile position + destination label
export const PORTALS = [
  { x: 4,  y: 3,  label: 'Dashboard',  route: '/dashboard',  color: '#f5c842' },
  { x: 24, y: 3,  label: 'Training',   route: '/training',   color: '#42f56f' },
  { x: 4,  y: 16, label: 'Cooking',    route: '/cooking',    color: '#f56942' },
  { x: 24, y: 16, label: 'Portfolio',  route: '/portfolio',  color: '#4287f5' },
]

// g = grass, p = path, w = water, s = sand, x = wall
// Map is 30 cols × 20 rows
// prettier-ignore
const RAW = [
  'wwwwwwwwwwwwwwwwwwwwwwwwwwwwww',
  'wwwwwwwwwwwwwwwwwwwwwwwwwwwwww',
  'wwsssssssssssssssssssssssssssww',
  'wws..ggggggggggggggggggggg..sww',
  'wws.ggggggggggggggggggggggg.sww',
  'wwsgggggggggpppppgggggggggggsw',
  'wwsgggggggggpppppgggggggggggsw',
  'wwsgggggpppppppppppppggggggggsw',
  'wwsgggggpppppppppppppggggggggsw',
  'wwsgggggpppppppppppppggggggggsw',
  'wwsggggggggppppppggggggggggggsw',
  'wwsggggggggppppppggggggggggggsw',
  'wwsgggggpppppppppppppggggggggsw',
  'wwsgggggpppppppppppppggggggggsw',
  'wwsgggggpppppppppppppggggggggsw',
  'wwsgggggggggpppppgggggggggggsw',
  'wws.ggggggggpppppggggggggggg.sww',
  'wws..ggggggggggggggggggggg..sww',
  'wwsssssssssssssssssssssssssssssww',
  'wwwwwwwwwwwwwwwwwwwwwwwwwwwwww',
]

// Build tile grid ensuring it's always MAP_COLS x MAP_ROWS
const CHAR_TO_TERRAIN = {
  'g': TERRAIN.GRASS,
  'p': TERRAIN.PATH,
  'w': TERRAIN.WATER,
  's': TERRAIN.SAND,
  'x': TERRAIN.WALL,
  '.': TERRAIN.GRASS,
  ' ': TERRAIN.GRASS,
}

function buildGrid() {
  const grid = []
  for (let row = 0; row < MAP_ROWS; row++) {
    const rowData = []
    const line = RAW[row] || ''
    for (let col = 0; col < MAP_COLS; col++) {
      const ch = line[col] || 'g'
      rowData.push(CHAR_TO_TERRAIN[ch] ?? TERRAIN.GRASS)
    }
    grid.push(rowData)
  }
  // Overlay portals
  for (const portal of PORTALS) {
    if (grid[portal.y]) grid[portal.y][portal.x] = TERRAIN.PORTAL
  }
  return grid
}

export const MAP_GRID = buildGrid()
