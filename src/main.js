import { Input } from './input.js';
import { Player } from './player.js';
import { Enemy } from './enemy.js';
import { ENEMIES, WEAPONS } from './config.js';
import { WALLS, BONFIRE, SPAWNS, CHESTS, CHEST_SIZE, PLAYER_SPAWN } from './world.js';
import { arcHit, resolveCircleRect, separate, dist, clamp } from './utils.js';
import { View } from './scene.js';
import { Hud } from './hud.js';

const canvas = document.getElementById('game');
const input = new Input(canvas);
const view = new View(canvas);
const hud = new Hud();

// Chests carry runtime state; a mimic chest owns a dormant enemy.
const chests = CHESTS.map((c) => ({ ...c, opened: false, openedAt: 0, gone: false, taken: false, enemy: null }));
const enemies = SPAWNS.map((s) => new Enemy(ENEMIES[s.type], s.x, s.y));
for (const c of chests) {
  if (!c.mimic) continue;
  c.enemy = new Enemy(ENEMIES.mimic, c.x, c.y);
  c.enemy.facing = c.facing;
  enemies.push(c.enemy);
}

const game = {
  player: new Player(PLAYER_SPAWN.x, PLAYER_SPAWN.y),
  enemies,
  chests,
  drops: [],
  bloodstain: null,
  banner: null,
  prompt: '',
  restFade: 0,
  hitstop: 0,
  deathTimer: 0,
  time: 0,
};
const { player } = game;

// ?preview runs the simulation without pointer lock (useful for screenshots / debugging)
const PREVIEW = new URLSearchParams(location.search).has('preview');
const LOOK_SENS = 0.0032;
const PITCH_MIN = 0.12, PITCH_MAX = 0.95;

function showBanner(text, dur, opts = {}) {
  game.banner = { text, dur, t: 0, ...opts };
}

// Chest footprint as a collision rect (depth runs along the facing axis).
function chestRect(c) {
  const alongX = Math.abs(Math.cos(c.facing)) > 0.5;
  const w = alongX ? CHEST_SIZE.short : CHEST_SIZE.long;
  const h = alongX ? CHEST_SIZE.long : CHEST_SIZE.short;
  return { x: c.x - w / 2, y: c.y - h / 2, w, h };
}
function obstacles() {
  const list = WALLS.slice();
  for (const c of chests) if (!c.gone) list.push(chestRect(c));
  return list;
}

function toggleLock() {
  if (player.lockTarget) { player.lockTarget = null; return; }
  let best = null, bd = 420;
  for (const e of enemies) {
    if (!e.alive || e.dormant) continue;
    const d = dist(player, e);
    if (d < bd) { bd = d; best = e; }
  }
  player.lockTarget = best;
}

function resetEnemies() {
  for (const e of enemies) e.reset();
  // a mimic that was not killed goes back to sleep and its chest closes again
  for (const c of chests) {
    if (!c.mimic) continue;
    if (c.enemy.alive) { c.opened = false; c.gone = false; }
    else c.gone = true;
  }
}

function rest() {
  player.hp = player.maxHp; player.hpGhost = player.maxHp;
  player.stamina = player.maxStamina; player.fp = player.maxFp; player.estus = player.maxEstus;
  player.lockTarget = null;
  resetEnemies();
  game.restFade = 1.2;
}

function die() {
  game.deathTimer = 0;
  showBanner('YOU DIED', 3.4, { cls: 'death', dark: true });
}

function respawn() {
  // souls stay where you fell; a second death overwrites the stain
  game.bloodstain = player.souls > 0 ? { x: player.x, y: player.y, souls: player.souls } : game.bloodstain;
  player.souls = 0;
  player.respawn(PLAYER_SPAWN.x, PLAYER_SPAWN.y);
  resetEnemies();
  game.restFade = 1.0;
  view.yaw = 0; view.camPos = null;
}

function giveItem(key) {
  if (player.addWeapon(key)) showBanner(`${WEAPONS[key].name} acquired`, 2.4, { cls: 'item' });
  else { player.souls += 100; showBanner('Already owned: 100 souls', 1.8, { cls: 'item' }); }
}

function openChest(c) {
  c.opened = true; c.openedAt = game.time;
  player.startInteract(0.7);
  if (c.mimic) {
    c.gone = true;
    c.enemy.facing = Math.atan2(player.y - c.enemy.y, player.x - c.enemy.x);
    c.enemy.wake();
  } else {
    c.taken = true;
    giveItem(c.item);
  }
}

function nearestInteractable() {
  if (dist(player, BONFIRE) < 64) return { type: 'bonfire', text: 'Rest at bonfire   [E]' };
  for (const c of chests) if (!c.opened && !c.gone && dist(player, c) < 60) return { type: 'chest', chest: c, text: 'Open chest   [E]' };
  return null;
}

// Camera-relative WASD -> ground-plane move vector, plus this frame's button presses.
function buildControls() {
  const fwd = (input.isDown('KeyW') ? 1 : 0) - (input.isDown('KeyS') ? 1 : 0);
  const side = (input.isDown('KeyD') ? 1 : 0) - (input.isDown('KeyA') ? 1 : 0);
  const fx = Math.cos(view.yaw), fz = Math.sin(view.yaw);   // camera forward on the ground (logic x, y)
  let mx = fwd * fx - side * fz;
  let my = fwd * fz + side * fx;
  const l = Math.hypot(mx, my);
  if (l > 0) { mx /= l; my /= l; }
  let weaponSelect = -1;
  for (let i = 0; i < 5; i++) if (input.wasPressed(`Digit${i + 1}`)) weaponSelect = i;
  return {
    mx, my,
    light: input.mouseWasPressed(0),
    heavy: input.mouseWasPressed(2),
    skill: input.wasPressed('KeyF') || input.wasPressed('ShiftLeft'),
    roll: input.wasPressed('Space'),
    estus: input.wasPressed('KeyR'),
    weaponDelta: (input.wasPressed('WheelDown') ? 1 : 0) - (input.wasPressed('WheelUp') ? 1 : 0),
    weaponSelect,
  };
}

function update(dt) {
  game.time += dt;
  if (game.banner && (game.banner.t += dt) >= game.banner.dur) game.banner = null;
  game.restFade = Math.max(0, game.restFade - dt * 1.6);

  if (game.hitstop > 0) { game.hitstop -= dt; return; }   // input is not consumed during hitstop

  if (!player.alive) {
    game.deathTimer += dt;
    if (game.deathTimer >= 3.4) respawn();
    input.endFrame();
    return;
  }

  if (input.wasPressed('KeyQ')) toggleLock();
  if (player.lockTarget && (!player.lockTarget.alive || dist(player, player.lockTarget) > 520)) player.lockTarget = null;

  player.update(dt, buildControls());
  for (const e of enemies) e.update(dt, player);

  // collisions: bodies vs walls/chests, bodies vs bodies
  const obs = obstacles();
  for (let i = 0; i < 2; i++) {
    for (const w of obs) {
      resolveCircleRect(player, w);
      for (const e of enemies) if (e.alive && !e.dormant) resolveCircleRect(e, w);
    }
    for (let a = 0; a < enemies.length; a++) {
      if (!enemies[a].alive || enemies[a].dormant) continue;
      separate(player, enemies[a], player.state === 'roll' ? 0.2 : 0.5);
      for (let b = a + 1; b < enemies.length; b++) if (enemies[b].alive && !enemies[b].dormant) separate(enemies[a], enemies[b]);
    }
  }

  // player swing connects
  if (player.hitboxActive()) {
    const a = player.attack;
    for (const e of enemies) {
      if (!e.alive || player.hitSet.has(e)) continue;
      if (arcHit(player.x, player.y, player.facing, a.range, a.halfAngle, e.x, e.y, e.r)) {
        player.hitSet.add(e);
        const dmg = Math.round(a.damage * player.damageMult);
        e.takeDamage(dmg, player.x, player.y, a.knockback, !!a.breakPoise);
        game.hitstop = a.name === 'heavy' ? 0.07 : 0.04;
        view.shake = Math.max(view.shake, a.name === 'heavy' ? 6 : 3);
        if (!e.alive) {
          player.souls += e.souls;
          if (player.lockTarget === e) player.lockTarget = null;
          if (e.drop) game.drops.push({ x: e.x, y: e.y, item: e.drop });
          if (e.boss) showBanner('GREAT ENEMY FELLED', 3.2);
        }
      }
    }
  }

  // enemy swings connect (rolling through with i-frames leaves the hitbox live, so timing matters)
  for (const e of enemies) {
    if (!e.hitboxActive()) continue;
    const a = e.attack;
    if (arcHit(e.x, e.y, e.facing, a.range, a.halfAngle, player.x, player.y, player.r)) {
      if (player.takeDamage(a.damage, e.x, e.y, a.knockback)) {
        e.hitDone = true;
        view.shake = Math.max(view.shake, 9);
        game.hitstop = 0.05;
        if (!player.alive) die();
      }
    }
  }

  // pickups
  if (game.bloodstain && dist(player, game.bloodstain) < player.r + 14) {
    player.souls += game.bloodstain.souls;
    game.bloodstain = null;
    showBanner('SOULS RETRIEVED', 1.8, { cls: 'souls' });
  }
  for (let i = game.drops.length - 1; i >= 0; i--) {
    if (dist(player, game.drops[i]) < player.r + 14) {
      giveItem(game.drops[i].item);
      game.drops.splice(i, 1);
    }
  }

  // interaction: bonfire or chest
  const it = nearestInteractable();
  game.prompt = it ? it.text : '';
  if (it && player.state === 'idle' && input.wasPressed('KeyE')) {
    if (it.type === 'bonfire') rest();
    else openChest(it.chest);
  }

  input.endFrame();
}

// fixed-step simulation, per-frame camera + render
const STEP = 1 / 120;
let last = performance.now(), acc = 0;

function frame(now) {
  const dtFrame = Math.min(0.1, (now - last) / 1000);
  last = now;

  const active = input.locked || PREVIEW;
  if (active) {
    const [dx, dy] = input.consumeMouseDelta();
    if (!(player.lockTarget && player.lockTarget.alive)) view.yaw += dx * LOOK_SENS;
    view.pitch = clamp(view.pitch + dy * 0.0025, PITCH_MIN, PITCH_MAX);
    acc += dtFrame;
    while (acc >= STEP) { update(STEP); acc -= STEP; }
  } else {
    // paused while the mouse is free
    acc = 0;
    input.consumeMouseDelta();
    input.endFrame();
  }

  view.sync(game, dtFrame);
  hud.update(game, view, active);
  view.render();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
