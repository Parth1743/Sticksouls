export const WORLD = { w: 1600, h: 1100 };

export const WALLS = [
  // outer bounds
  { x: 0, y: 0, w: 1600, h: 40 }, { x: 0, y: 1060, w: 1600, h: 40 },
  { x: 0, y: 0, w: 40, h: 1100 }, { x: 1560, y: 0, w: 40, h: 1100 },
  // ruined pillars / rubble
  { x: 560, y: 260, w: 90, h: 90 }, { x: 880, y: 640, w: 90, h: 90 },
  { x: 620, y: 820, w: 220, h: 50 }, { x: 300, y: 200, w: 50, h: 160 },
  // gate wall into the knight's arena (gap 440..660)
  { x: 1180, y: 40, w: 40, h: 400 }, { x: 1180, y: 660, w: 40, h: 400 },
];

export const BONFIRE = { x: 180, y: 560, r: 20 };

export const SPAWNS = [
  { type: 'hollow', x: 520, y: 420 },
  { type: 'hollow', x: 780, y: 560 },
  { type: 'hollow', x: 560, y: 900 },
  { type: 'knight', x: 1400, y: 550 },
];

// Chests. facing = direction the lid opens toward. A mimic chest hides an enemy that drops the item instead.
export const CHESTS = [
  { id: 'c1', x: 420, y: 250, facing: Math.PI / 2, item: 'greatsword' },
  { id: 'c2', x: 1000, y: 960, facing: -Math.PI / 2, item: 'axe' },
  { id: 'c3', x: 1480, y: 120, facing: Math.PI, item: 'dagger' },
  { id: 'c4', x: 760, y: 340, facing: Math.PI / 2, item: 'spear', mimic: true },
];
// Chest footprint in logic units (1.3 m x 0.7 m).
export const CHEST_SIZE = { long: 26, short: 14 };

// beside the fire, so the camera does not start looking through the flame
export const PLAYER_SPAWN = { x: BONFIRE.x + 60, y: BONFIRE.y + 95 };
