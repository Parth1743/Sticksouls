import { ROLL, ESTUS, WEAPONS, FP_REGEN } from './config.js';
import { norm, clamp, angleDiff } from './utils.js';

// States: idle | roll | attack | estus | buff | interact | stagger | dead
//
// update(dt, ctrl) takes a camera-independent control frame:
//   ctrl = { mx, my, light, heavy, roll, estus, skill, weaponDelta, weaponSelect }
//   mx/my: desired move direction on the ground plane (unit vector or zero), already camera-relative
//   buttons: true on the frame they were pressed
//   weaponDelta: -1 / 0 / +1 to cycle weapons; weaponSelect: index or -1
export class Player {
  constructor(x, y) {
    this.r = 14;
    this.maxHp = 100;
    this.maxStamina = 100;
    this.maxFp = 60;
    this.maxEstus = 3;
    this.speed = 165;
    this.turnRate = 14;   // rad/s while free-moving
    this.souls = 0;
    this.weapons = ['longsword'];
    this.weaponIndex = 0;
    this.respawn(x, y);
  }

  respawn(x, y) {
    this.x = x; this.y = y; this.vx = 0; this.vy = 0;
    this.hp = this.maxHp; this.hpGhost = this.maxHp;
    this.stamina = this.maxStamina; this.fp = this.maxFp; this.estus = this.maxEstus;
    this.state = 'idle'; this.t = 0; this.facing = 0;
    this.attack = null; this.hitSet = new Set();
    this.rollDir = [1, 0]; this.rollDef = ROLL; this.invuln = false;
    this.flash = 0; this.flashColor = '#fff';
    this.staminaDelay = 0; this.queued = null; this.healed = false;
    this.lockTarget = null;
    this.moving = false;
    this.buffT = 0; this.damageMult = 1; this.buffPending = null;
    this.interactT = 0;
    this.skillFail = 0;   // HUD flash timer when FP is short
  }

  get alive() { return this.state !== 'dead'; }
  get weapon() { return WEAPONS[this.weapons[this.weaponIndex]]; }
  get weaponKey() { return this.weapons[this.weaponIndex]; }
  setState(s) { this.state = s; this.t = 0; }

  addWeapon(key) {
    if (this.weapons.includes(key)) return false;
    this.weapons.push(key);
    this.weaponIndex = this.weapons.length - 1;
    return true;
  }
  cycleWeapon(d) { this.weaponIndex = (this.weaponIndex + d + this.weapons.length) % this.weapons.length; }
  selectWeapon(i) { if (i >= 0 && i < this.weapons.length) this.weaponIndex = i; }

  hitboxActive() {
    const a = this.attack;
    return this.state === 'attack' && a && this.t >= a.windup && this.t < a.windup + a.active;
  }

  startRoll(dir, aim, def = ROLL) {
    // no direction held = backstep away from where you are facing
    this.rollDir = dir ?? [-Math.cos(aim), -Math.sin(aim)];
    this.rollDef = def;
    this.stamina -= def.stamina; this.staminaDelay = 0.5;
    this.attack = null;
    this.setState('roll');
  }

  startAttack(atk, aim) {
    this.attack = atk; this.hitSet = new Set();
    this.facing = aim;
    this.stamina -= atk.stamina; this.staminaDelay = 0.6;
    this.setState('attack');
  }

  startSkill(aim, dir) {
    const sk = this.weapon.skill;
    if (this.fp < sk.fp) { this.skillFail = 0.4; return false; }
    this.fp -= sk.fp;
    if (sk.type === 'attack') this.startAttack(sk.attack, aim);
    else if (sk.type === 'dash') this.startRoll(dir, aim, sk.dash);
    else if (sk.type === 'buff') { this.buffPending = sk.buff; this.attack = null; this.setState('buff'); }
    return true;
  }

  startInteract(duration) {
    this.attack = null; this.queued = null;
    this.interactT = duration;
    this.setState('interact');
  }

  update(dt, c) {
    if (!this.alive) return;
    this.t += dt;
    this.flash = Math.max(0, this.flash - dt);
    this.skillFail = Math.max(0, this.skillFail - dt);
    if (this.hpGhost > this.hp) this.hpGhost = Math.max(this.hp, this.hpGhost - 70 * dt);
    else this.hpGhost = this.hp;
    if (this.buffT > 0 && (this.buffT -= dt) <= 0) this.damageMult = 1;

    const mx = c.mx || 0, my = c.my || 0;
    const moving = mx !== 0 || my !== 0;
    this.moving = moving;

    // weapon switching is instant and allowed whenever you are alive
    if (c.weaponDelta) this.cycleWeapon(c.weaponDelta);
    if (c.weaponSelect >= 0) this.selectWeapon(c.weaponSelect);

    // Aim: lock-on target if any, otherwise where you are moving, otherwise where you already face.
    let aim;
    if (this.lockTarget && this.lockTarget.alive) {
      aim = Math.atan2(this.lockTarget.y - this.y, this.lockTarget.x - this.x);
    } else if (moving) {
      aim = Math.atan2(my, mx);
    } else {
      aim = this.facing;
    }

    // Input buffer: DS3 queues the next action pressed during recovery.
    if (c.light) this.queued = { type: 'attack', atk: 'light', t: 0.3 };
    if (c.heavy) this.queued = { type: 'attack', atk: 'heavy', t: 0.3 };
    if (c.skill) this.queued = { type: 'skill', t: 0.3, dir: moving ? [mx, my] : null };
    if (c.roll) this.queued = { type: 'roll', t: 0.3, dir: moving ? [mx, my] : null };
    if (c.estus) this.queued = { type: 'estus', t: 0.3 };
    if (this.queued && (this.queued.t -= dt) <= 0) this.queued = null;

    const a0 = this.attack, rd = this.rollDef;
    const canRoll = this.state === 'idle'
      || (this.state === 'attack' && this.t >= a0.windup + a0.active + a0.recovery * 0.5)   // roll-cancel late recovery
      || (this.state === 'roll' && this.t >= rd.duration * 0.8);
    const canAttack = this.state === 'idle'
      || (this.state === 'attack' && this.t >= a0.windup + a0.active + a0.recovery * 0.7)   // chain into next swing
      || (this.state === 'roll' && this.t >= rd.duration * 0.65);                            // roll attack

    if (this.queued) {
      const q = this.queued;
      if (q.type === 'roll' && canRoll && this.stamina > 0) {
        this.startRoll(q.dir ?? (moving ? [mx, my] : null), aim); this.queued = null;
      } else if (q.type === 'attack' && canAttack && this.stamina > 0) {
        this.startAttack(this.weapon[q.atk], aim); this.queued = null;
      } else if (q.type === 'skill' && canAttack && this.stamina > 0) {
        this.startSkill(aim, q.dir ?? (moving ? [mx, my] : null)); this.queued = null;
      } else if (q.type === 'estus' && this.state === 'idle') {
        if (this.estus > 0) { this.estus--; this.healed = false; this.setState('estus'); }
        this.queued = null;
      }
    }

    switch (this.state) {
      case 'idle': {
        this.invuln = false;
        const rate = this.turnRate * dt;
        this.facing += clamp(angleDiff(this.facing, aim), -rate, rate);
        this.x += mx * this.speed * dt; this.y += my * this.speed * dt;
        break;
      }

      case 'roll': {
        const rd = this.rollDef;   // re-read: a skill dash may have just replaced the roll definition
        const p = this.t / rd.duration;
        const sp = rd.speed * (1 - 0.7 * p);
        this.x += this.rollDir[0] * sp * dt; this.y += this.rollDir[1] * sp * dt;
        this.invuln = this.t >= rd.iStart && this.t <= rd.iEnd;
        if (this.t >= rd.duration) { this.invuln = false; this.rollDef = ROLL; this.setState('idle'); }
        break;
      }

      case 'attack': {
        const a = this.attack;   // re-read: the buffered input above may have just started a swing
        this.invuln = false;
        if (this.t < a.windup) {
          // limited tracking during windup: you can adjust, but not spin 180
          const rate = (this.lockTarget ? 6 : 4) * dt;
          this.facing += clamp(angleDiff(this.facing, aim), -rate, rate);
        } else if (this.t < a.windup + a.active) {
          this.x += Math.cos(this.facing) * a.lunge * dt;
          this.y += Math.sin(this.facing) * a.lunge * dt;
        }
        if (this.t >= a.windup + a.active + a.recovery) { this.attack = null; this.setState('idle'); }
        break;
      }

      case 'estus':
        this.invuln = false;
        this.x += mx * this.speed * 0.35 * dt; this.y += my * this.speed * 0.35 * dt;
        if (!this.healed && this.t >= ESTUS.healAt) {
          this.healed = true;
          this.hp = Math.min(this.maxHp, this.hp + ESTUS.heal);
          this.flash = 0.35; this.flashColor = '#e9b44c';
        }
        if (this.t >= ESTUS.duration) this.setState('idle');
        break;

      case 'buff': {
        this.invuln = false;
        const b = this.buffPending;
        if (b && this.t >= b.duration * 0.6) {
          this.damageMult = b.mult; this.buffT = b.length;
          this.flash = 0.4; this.flashColor = '#ff8a3c';
          this.buffPending = null;
        }
        if (this.t >= (b ? b.duration : 0.8)) this.setState('idle');
        break;
      }

      case 'interact':
        this.invuln = false;
        if (this.t >= this.interactT) this.setState('idle');
        break;

      case 'stagger':
        this.invuln = false;
        if (this.t >= 0.4) this.setState('idle');
        break;
    }

    // knockback velocity with heavy damping
    this.x += this.vx * dt; this.y += this.vy * dt;
    const damp = Math.pow(0.002, dt); this.vx *= damp; this.vy *= damp;

    // stamina and FP regenerate only when not committed to an action
    if (this.state === 'idle' || this.state === 'estus' || this.state === 'stagger' || this.state === 'interact') {
      this.staminaDelay -= dt;
      if (this.staminaDelay <= 0) this.stamina = Math.min(this.maxStamina, this.stamina + 40 * dt);
      this.fp = Math.min(this.maxFp, this.fp + FP_REGEN * dt);
    }
  }

  // Returns true if the hit connected (false when i-framed).
  takeDamage(dmg, sx, sy, kb = 160) {
    if (!this.alive || this.invuln) return false;
    this.hp -= dmg;
    this.flash = 0.25; this.flashColor = '#ff5a4a';
    const [nx, ny] = norm(this.x - sx, this.y - sy);
    this.vx = nx * kb; this.vy = ny * kb;
    this.attack = null; this.queued = null; this.buffPending = null;
    if (this.hp <= 0) { this.hp = 0; this.setState('dead'); }
    else this.setState('stagger');
    return true;
  }
}
