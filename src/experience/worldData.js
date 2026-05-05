export const ZONE_ENTER_RADIUS = 6

export const ZONES = [
  { id: 'dashboard', label: 'Dashboard', position: [-22, 0, -22], color: '#f5c842' },
  { id: 'training',  label: 'Training',  position: [ 22, 0, -22], color: '#22c55e' },
  { id: 'cooking',   label: 'Cooking',   position: [-22, 0,  22], color: '#f97316' },
  { id: 'portfolio', label: 'Portfolio', position: [ 22, 0,  22], color: '#4287f5' },
]

export const TREE_POSITIONS = [
  [-10, 0, -10], [-8, 0, -15], [-15, 0, -8], [-17, 0, -17], [-6, 0, -19],
  [ 10, 0, -10], [ 8, 0, -15], [ 15, 0, -8], [ 17, 0, -17], [ 6, 0, -19],
  [-10, 0,  10], [-8, 0,  15], [-15, 0,  8], [-17, 0,  17], [-6, 0,  19],
  [ 10, 0,  10], [ 8, 0,  15], [ 15, 0,  8], [ 17, 0,  17], [ 6, 0,  19],
  [-31, 0, -31], [ 31, 0, -31], [-31, 0,  31], [ 31, 0,  31],
  [-31, 0,   0], [ 31, 0,   0], [  0, 0, -31], [  0, 0,  31],
  [-26, 0, -10], [ 26, 0, -10], [-26, 0,  10], [ 26, 0,  10],
]

export const BUILDING_LAYOUTS = [
  { position: [-10, 0, -10], size: [3.0, 4.0, 3.0], color: '#1e2e3e' },
  { position: [ 11, 0, -11], size: [2.5, 6.5, 2.5], color: '#2a1e3a' },
  { position: [-10, 0,  10], size: [4.0, 3.0, 3.5], color: '#1e3a2a' },
  { position: [ 10, 0,  11], size: [3.0, 5.0, 3.0], color: '#3a2e1e' },
  { position: [-20, 0,  -1], size: [2.0, 4.5, 2.0], color: '#1e2e3e' },
  { position: [ 20, 0,   1], size: [2.5, 3.5, 2.5], color: '#2a2e3e' },
  { position: [  1, 0, -20], size: [2.0, 5.0, 2.0], color: '#1e2a3e' },
  { position: [ -1, 0,  20], size: [3.0, 3.0, 2.0], color: '#2e3a1e' },
]

export const LAMP_POSITIONS = [
  // Horizontal road (Z=0) – north side z=-4.5
  [-30, 0, -4.5], [-15, 0, -4.5], [15, 0, -4.5], [30, 0, -4.5],
  // Horizontal road (Z=0) – south side z=+4.5
  [-30, 0,  4.5], [-15, 0,  4.5], [15, 0,  4.5], [30, 0,  4.5],
  // Vertical road (X=0) – west side x=-4.5
  [-4.5, 0, -30], [-4.5, 0, -15], [-4.5, 0, 15], [-4.5, 0, 30],
  // Vertical road (X=0) – east side x=+4.5
  [ 4.5, 0, -30], [ 4.5, 0, -15], [ 4.5, 0, 15], [ 4.5, 0, 30],
]

export const COLLISION_OBSTACLES = [
  ...TREE_POSITIONS.map(([x, , z]) => ({ type: 'circle', x, z, radius: 0.95 })),
  ...LAMP_POSITIONS.map(([x, , z]) => ({ type: 'circle', x, z, radius: 0.7 })),
  ...BUILDING_LAYOUTS.map(({ position, size }) => ({
    type: 'box',
    x: position[0],
    z: position[2],
    halfX: size[0] / 2 + 0.45,
    halfZ: size[2] / 2 + 0.45,
  })),
]