// All tuning numbers live here. Times in seconds, distances in logic units (1 unit = 5 cm in the 3D view), speeds in units/s.

export const ROLL = {
  duration: 0.55,
  speed: 360,
  iStart: 0.04,   // i-frames open shortly after the roll starts...
  iEnd: 0.34,     // ...and close before the roll ends (DS3 mid-roll ~13 frames)
  stamina: 18,
};

export const ESTUS = { duration: 1.1, healAt: 0.6, heal: 55 };

export const FP_REGEN = 2.5;   // FP per second while not committed to an action

// An attack is: windup (telegraph, can be tracked) -> active (hitbox live, lunge) -> recovery (punish window)
// anim: 'sweep' | 'overhead' | 'thrust' drives the 3D arm animation only.
// breakPoise: staggers regardless of the target's poise.

// Weapons. Each has a light and heavy attack plus a skill (weapon art) that costs FP.
// skill.type: 'attack' (an attack def), 'dash' (a special roll), 'buff' (damage multiplier for a while)
export const WEAPONS = {
  longsword: {
    name: 'Longsword', model: 'sword',
    light: { name: 'light', anim: 'sweep', windup: 0.16, active: 0.12, recovery: 0.34, range: 60, halfAngle: Math.PI / 3, damage: 26, stamina: 15, lunge: 70, knockback: 120 },
    heavy: { name: 'heavy', anim: 'overhead', windup: 0.50, active: 0.16, recovery: 0.60, range: 70, halfAngle: Math.PI / 2.4, damage: 58, stamina: 32, lunge: 110, knockback: 280 },
    skill: { name: 'Stance Thrust', fp: 12, type: 'attack',
      attack: { name: 'skill', anim: 'thrust', windup: 0.30, active: 0.15, recovery: 0.45, range: 90, halfAngle: Math.PI / 6, damage: 44, stamina: 20, lunge: 300, knockback: 220, breakPoise: true } },
  },
  greatsword: {
    name: 'Greatsword', model: 'greatsword',
    light: { name: 'light', anim: 'sweep', windup: 0.32, active: 0.16, recovery: 0.55, range: 80, halfAngle: Math.PI / 2.2, damage: 48, stamina: 26, lunge: 60, knockback: 220 },
    heavy: { name: 'heavy', anim: 'overhead', windup: 0.70, active: 0.18, recovery: 0.80, range: 88, halfAngle: Math.PI / 3, damage: 95, stamina: 42, lunge: 90, knockback: 380, breakPoise: true },
    skill: { name: 'Stomp', fp: 15, type: 'attack',
      attack: { name: 'skill', anim: 'overhead', windup: 0.45, active: 0.10, recovery: 0.55, range: 80, halfAngle: Math.PI, damage: 22, stamina: 18, lunge: 0, knockback: 450, breakPoise: true } },
  },
  dagger: {
    name: 'Dagger', model: 'dagger',
    light: { name: 'light', anim: 'sweep', windup: 0.08, active: 0.08, recovery: 0.20, range: 44, halfAngle: Math.PI / 3.5, damage: 15, stamina: 9, lunge: 50, knockback: 60 },
    heavy: { name: 'heavy', anim: 'thrust', windup: 0.25, active: 0.10, recovery: 0.35, range: 50, halfAngle: Math.PI / 5, damage: 34, stamina: 16, lunge: 120, knockback: 100 },
    skill: { name: 'Quickstep', fp: 5, type: 'dash',
      dash: { duration: 0.28, speed: 620, iStart: 0, iEnd: 0.28, stamina: 8, dash: true } },
  },
  spear: {
    name: 'Spear', model: 'spear',
    light: { name: 'light', anim: 'thrust', windup: 0.20, active: 0.12, recovery: 0.40, range: 95, halfAngle: Math.PI / 7, damage: 28, stamina: 16, lunge: 60, knockback: 140 },
    heavy: { name: 'heavy', anim: 'thrust', windup: 0.45, active: 0.14, recovery: 0.55, range: 105, halfAngle: Math.PI / 7, damage: 52, stamina: 28, lunge: 160, knockback: 260 },
    skill: { name: 'Charge', fp: 14, type: 'attack',
      attack: { name: 'skill', anim: 'thrust', windup: 0.25, active: 0.60, recovery: 0.50, range: 80, halfAngle: Math.PI / 5, damage: 38, stamina: 24, lunge: 330, knockback: 300, breakPoise: true } },
  },
  axe: {
    name: 'Battle Axe', model: 'axe',
    light: { name: 'light', anim: 'sweep', windup: 0.22, active: 0.13, recovery: 0.42, range: 62, halfAngle: Math.PI / 3, damage: 34, stamina: 19, lunge: 70, knockback: 180 },
    heavy: { name: 'heavy', anim: 'overhead', windup: 0.55, active: 0.15, recovery: 0.60, range: 68, halfAngle: Math.PI / 3, damage: 70, stamina: 34, lunge: 110, knockback: 320 },
    skill: { name: 'Warcry', fp: 10, type: 'buff',
      buff: { duration: 0.8, mult: 1.3, length: 20 } },
  },
};

export const WEAPON_ORDER = ['longsword', 'greatsword', 'dagger', 'spear', 'axe'];

export const ENEMIES = {
  hollow: {
    name: 'Hollow Soldier', look: 'hollow', weapon: 'sword', r: 13, maxHp: 80, speed: 100, aggroRange: 240, attackRange: 52,
    poise: 10,                 // any hit >= poise staggers
    cooldownMin: 0.5, cooldownMax: 1.4, souls: 60, color: '#8a7f6a', boss: false, scale: 0.95,
    attacks: [
      { anim: 'sweep', windup: 0.55, active: 0.14, recovery: 0.75, range: 58, halfAngle: Math.PI / 3, damage: 18, lunge: 80, tracking: 4, knockback: 160 },
      { anim: 'thrust', windup: 0.32, active: 0.12, recovery: 0.55, range: 52, halfAngle: Math.PI / 3.5, damage: 12, lunge: 40, tracking: 6, knockback: 100 },
    ],
  },
  knight: {
    name: 'Lothric Knight', look: 'knight', weapon: 'greatsword', r: 18, maxHp: 340, speed: 115, aggroRange: 300, attackRange: 72,
    poise: 50,                 // only heavies stagger him
    cooldownMin: 0.35, cooldownMax: 1.0, souls: 600, color: '#5c6c8f', boss: true, scale: 1.25,
    attacks: [
      { anim: 'overhead', windup: 0.85, active: 0.16, recovery: 0.95, range: 82, halfAngle: Math.PI / 3, damage: 42, lunge: 60, tracking: 3.5, knockback: 280 },
      { anim: 'thrust', windup: 0.50, active: 0.28, recovery: 0.85, range: 62, halfAngle: Math.PI / 4, damage: 30, lunge: 400, tracking: 5, knockback: 220 },
      { anim: 'sweep', windup: 0.40, active: 0.14, recovery: 0.50, range: 76, halfAngle: Math.PI / 1.6, damage: 24, lunge: 30, tracking: 4, knockback: 200 },
    ],
  },
  // Sleeps inside a chest until opened or hit. Does not respawn once killed; drops its item.
  mimic: {
    name: 'Mimic', look: 'mimic', weapon: 'tongue', r: 16, maxHp: 240, speed: 135, aggroRange: 260, attackRange: 62,
    poise: 30, sleeper: true, unique: true, drop: 'spear',
    cooldownMin: 0.3, cooldownMax: 0.9, souls: 400, color: '#6b4a2a', boss: false, scale: 1,
    attacks: [
      { anim: 'thrust', windup: 0.70, active: 0.15, recovery: 0.90, range: 72, halfAngle: Math.PI / 4, damage: 55, lunge: 220, tracking: 5, knockback: 350 },
      { anim: 'sweep', windup: 0.40, active: 0.12, recovery: 0.60, range: 60, halfAngle: Math.PI / 2, damage: 28, lunge: 80, tracking: 4, knockback: 220 },
    ],
  },
};
