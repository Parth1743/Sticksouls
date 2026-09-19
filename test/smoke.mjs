// Headless simulation of the combat rules (no canvas). Run: npm test
import { Player } from '../src/player.js';
import { Enemy } from '../src/enemy.js';
import { ENEMIES, ROLL, WEAPONS } from '../src/config.js';
import { arcHit } from '../src/utils.js';

const STEP = 1 / 120;
let failures = 0;
const check = (cond, msg) => { console.log((cond ? 'PASS ' : 'FAIL ') + msg); if (!cond) failures++; };

// Builds the camera-independent control frame Player.update expects.
class FakeInput {
  constructor() { this.keys = new Set(); this.pressedKeys = new Set(); this.buttons = new Set(); this.select = -1; }
  ctrl() {
    let mx = (this.keys.has('KeyD') ? 1 : 0) - (this.keys.has('KeyA') ? 1 : 0);
    let my = (this.keys.has('KeyS') ? 1 : 0) - (this.keys.has('KeyW') ? 1 : 0);
    const l = Math.hypot(mx, my); if (l) { mx /= l; my /= l; }
    const c = {
      mx, my,
      light: this.buttons.has(0), heavy: this.buttons.has(2),
      skill: this.pressedKeys.has('KeyF'), roll: this.pressedKeys.has('Space'), estus: this.pressedKeys.has('KeyR'),
      weaponDelta: 0, weaponSelect: this.select,
    };
    this.select = -1;
    return c;
  }
  endFrame() { this.pressedKeys.clear(); this.buttons.clear(); }
}

function step(player, enemies, input, seconds) {
  for (let t = 0; t < seconds; t += STEP) {
    player.update(STEP, input.ctrl());
    for (const e of enemies) e.update(STEP, player);
    if (player.hitboxActive()) {
      const a = player.attack;
      for (const e of enemies) {
        if (e.alive && !player.hitSet.has(e) && arcHit(player.x, player.y, player.facing, a.range, a.halfAngle, e.x, e.y, e.r)) {
          player.hitSet.add(e);
          e.takeDamage(Math.round(a.damage * player.damageMult), player.x, player.y, a.knockback, !!a.breakPoise);
        }
      }
    }
    for (const e of enemies) {
      if (e.hitboxActive() && arcHit(e.x, e.y, e.facing, e.attack.range, e.attack.halfAngle, player.x, player.y, player.r)) {
        if (player.takeDamage(e.attack.damage, e.x, e.y, e.attack.knockback)) e.hitDone = true;
      }
    }
    input.endFrame();
  }
}

const LS = WEAPONS.longsword;

// 1. Light attack hits an adjacent hollow and costs stamina
{
  const p = new Player(0, 0), h = new Enemy(ENEMIES.hollow, 40, 0), input = new FakeInput();
  input.buttons.add(0);
  step(p, [h], input, 0.5);
  check(h.hp === h.maxHp - LS.light.damage, `light attack deals ${LS.light.damage} (hollow hp ${h.hp})`);
  check(p.stamina < p.maxStamina, `attack spent stamina (${p.stamina.toFixed(1)})`);
  check(h.state === 'stagger' || h.state === 'chase', `hollow staggered/aggroed (state ${h.state})`);
}

// 2. Light attack does NOT stagger the knight (poise), heavy does
{
  const p = new Player(0, 0), k = new Enemy(ENEMIES.knight, 50, 0), input = new FakeInput();
  input.buttons.add(0);
  step(p, [k], input, 0.2);
  check(k.state !== 'stagger', `light does not stagger knight (state ${k.state})`);
  const p2 = new Player(0, 0), k2 = new Enemy(ENEMIES.knight, 50, 0), in2 = new FakeInput();
  in2.buttons.add(2); k2.cooldown = 5;   // knight is between attacks, so the heavy lands
  step(p2, [k2], in2, 0.75);
  check(k2.hp === k2.maxHp - LS.heavy.damage && k2.state === 'stagger', `heavy hits and staggers knight (hp ${k2.hp}, state ${k2.state})`);
}

// 3. Roll i-frames: rolling at the right moment avoids a hollow swing
{
  const p = new Player(0, 0), h = new Enemy(ENEMIES.hollow, 40, 0), input = new FakeInput();
  let guard = 0;
  while (h.state !== 'windup' && guard++ < 2000) { step(p, [h], input, STEP); }
  check(h.state === 'windup', 'hollow enters windup when in range');
  const remaining = h.attack.windup - h.t;
  step(p, [h], input, Math.max(0, remaining - ROLL.iStart - 0.02));
  input.pressedKeys.add('Space'); input.keys.add('KeyD');
  step(p, [h], input, 0.6);
  check(p.hp === p.maxHp, `rolled through the swing untouched (hp ${p.hp}, hollow ${h.state})`);
}

// 4. Standing still gets you hit, and enough hits kill you
{
  const p = new Player(0, 0), h = new Enemy(ENEMIES.hollow, 40, 0), input = new FakeInput();
  step(p, [h], input, 1.5);
  check(p.hp < p.maxHp, `standing still takes damage (hp ${p.hp})`);
  step(p, [h], input, 20);
  check(!p.alive && p.hp === 0, `player dies to repeated hits (alive=${p.alive})`);
  check(h.state === 'idle', `enemy disengages after the player dies (state ${h.state})`);
}

// 5. Estus heals and consumes a charge; stamina regenerates when idle
{
  const p = new Player(0, 0), input = new FakeInput();
  p.hp = 30; p.stamina = 10; p.staminaDelay = 0;
  input.pressedKeys.add('KeyR');
  step(p, [], input, 1.2);
  check(p.hp === 85 && p.estus === 2, `estus healed to ${p.hp} and left ${p.estus} charges`);
  check(p.stamina > 10, `stamina regenerated to ${p.stamina.toFixed(1)}`);
}

// 6. Weapons: pickup, switching, and the greatsword's Stomp breaks poise for cheap damage
{
  const p = new Player(0, 0), k = new Enemy(ENEMIES.knight, 50, 0), input = new FakeInput();
  check(p.addWeapon('greatsword') && p.weaponKey === 'greatsword', `picking up a weapon equips it (${p.weapon.name})`);
  check(!p.addWeapon('greatsword'), 'duplicate pickup is rejected');
  input.select = 0; step(p, [], input, STEP);
  check(p.weaponKey === 'longsword', 'number key selects weapon slot 1');
  input.select = 1; step(p, [], input, STEP);
  k.cooldown = 5;
  const fp0 = p.fp;
  input.pressedKeys.add('KeyF');
  step(p, [k], input, 0.7);
  const stomp = WEAPONS.greatsword.skill;
  check(Math.abs((fp0 - p.fp) - stomp.fp) < 2, `skill spent about ${stomp.fp} FP (fp ${p.fp.toFixed(1)})`);
  check(k.state === 'stagger' && k.hp === k.maxHp - stomp.attack.damage, `Stomp staggers knight despite low damage (hp ${k.hp}, state ${k.state})`);
}

// 7. Skill is refused without FP
{
  const p = new Player(0, 0), input = new FakeInput();
  p.fp = 2;
  input.pressedKeys.add('KeyF');
  step(p, [], input, 0.2);
  check(p.state === 'idle' && p.skillFail > 0, 'Stance Thrust refused with 2 FP');
}

// 8. Dagger Quickstep is invulnerable for its whole duration
{
  const p = new Player(0, 0), h = new Enemy(ENEMIES.hollow, 40, 0), input = new FakeInput();
  p.addWeapon('dagger');
  let guard = 0;
  while (h.state !== 'windup' && guard++ < 2000) step(p, [h], input, STEP);
  const remaining = h.attack.windup - h.t;
  step(p, [h], input, Math.max(0, remaining - 0.05));
  input.pressedKeys.add('KeyF'); input.keys.add('KeyD');
  step(p, [h], input, STEP);
  check(p.state === 'roll' && p.invuln && p.rollDef.dash, 'Quickstep starts with immediate i-frames');
  step(p, [h], input, 0.5);
  check(p.hp === p.maxHp, `Quickstep dodged the swing (hp ${p.hp})`);
}

// 9. Warcry buffs damage
{
  const p = new Player(0, 0), h = new Enemy(ENEMIES.hollow, 40, 0), input = new FakeInput();
  p.addWeapon('axe'); h.cooldown = 10;
  input.pressedKeys.add('KeyF');
  step(p, [h], input, 0.9);
  check(p.damageMult > 1 && p.buffT > 0, `Warcry active (x${p.damageMult}, ${p.buffT.toFixed(1)}s)`);
  input.buttons.add(0);
  step(p, [h], input, 0.5);
  const expect = Math.round(WEAPONS.axe.light.damage * WEAPONS.axe.skill.buff.mult);
  check(h.hp === h.maxHp - expect, `buffed axe light deals ${expect} (hollow hp ${h.hp})`);
}

// 10. Mimic sleeps until hit, and stays dead after a reset
{
  const p = new Player(0, 0), m = new Enemy(ENEMIES.mimic, 40, 0), input = new FakeInput();
  step(p, [m], input, 1.0);
  check(m.dormant && m.state === 'idle' && p.hp === p.maxHp, 'dormant mimic ignores the player');
  input.buttons.add(0);
  step(p, [m], input, 0.4);
  check(!m.dormant && m.hp < m.maxHp, `hitting the mimic wakes it (hp ${m.hp}, state ${m.state})`);
  m.hp = 1; m.takeDamage(5, 0, 0);
  m.reset();
  check(!m.alive, 'unique mimic does not respawn on reset');
  const m2 = new Enemy(ENEMIES.mimic, 40, 0); m2.wake(); m2.reset();
  check(m2.dormant && m2.alive, 'living mimic goes back to sleep on reset');
}

console.log(failures === 0 ? '\nALL PASS' : `\n${failures} FAILURE(S)`);
process.exit(failures ? 1 : 0);
