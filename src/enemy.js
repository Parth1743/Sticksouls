import { clamp, angleDiff, norm, rand } from './utils.js';

// States: idle | chase | windup | active | recovery | stagger | dead
// A `sleeper` enemy (mimic) starts dormant and ignores the player until woken or hit.
// A `unique` enemy stays dead once killed.
export class Enemy {
  constructor(cfg, x, y) {
    Object.assign(this, cfg);
    this.spawnX = x; this.spawnY = y;
    this.state = 'idle';
    this.reset();
  }

  reset() {
    if (this.unique && this.state === 'dead') return;   // killed for good
    this.x = this.spawnX; this.y = this.spawnY; this.vx = 0; this.vy = 0;
    this.hp = this.maxHp;
    this.state = 'idle'; this.t = 0; this.facing = 0;
    this.attack = null; this.hitDone = false;
    this.cooldown = 0; this.strafeDir = 1;
    this.flash = 0;
    this.dormant = !!this.sleeper;
  }

  get alive() { return this.state !== 'dead'; }
  get aggro() { return this.alive && !this.dormant && this.state !== 'idle'; }
  setState(s) { this.state = s; this.t = 0; }
  hitboxActive() { return this.state === 'active' && !this.hitDone; }

  wake() {
    if (!this.alive || !this.dormant) return;
    this.dormant = false;
    this.cooldown = 0.4;
    this.setState('chase');
  }

  update(dt, player) {
    if (!this.alive || this.dormant) return;
    this.t += dt;
    this.flash = Math.max(0, this.flash - dt);
    this.cooldown -= dt;

    const dx = player.x - this.x, dy = player.y - this.y;
    const d = Math.hypot(dx, dy);
    const toP = Math.atan2(dy, dx);

    switch (this.state) {
      case 'idle':
        if (player.alive && d < this.aggroRange) this.setState('chase');
        break;

      case 'chase': {
        if (!player.alive) { this.setState('idle'); break; }
        if (d > this.aggroRange * 2.2) { this.setState('idle'); break; }
        this.facing = toP;
        if (d > this.attackRange * 0.85) {
          this.x += Math.cos(toP) * this.speed * dt;
          this.y += Math.sin(toP) * this.speed * dt;
        } else if (this.cooldown <= 0) {
          this.attack = this.attacks[Math.floor(Math.random() * this.attacks.length)];
          this.hitDone = false;
          this.setState('windup');
        } else {
          // circle the player while waiting for the next opening
          const s = toP + Math.PI / 2 * this.strafeDir;
          this.x += Math.cos(s) * this.speed * 0.45 * dt;
          this.y += Math.sin(s) * this.speed * 0.45 * dt;
        }
        break;
      }

      case 'windup': {
        const a = this.attack;
        // tracks the player for most of the windup, then commits
        if (this.t < a.windup * 0.7) {
          const rate = a.tracking * dt;
          this.facing += clamp(angleDiff(this.facing, toP), -rate, rate);
        }
        if (this.t >= a.windup) this.setState('active');
        break;
      }

      case 'active': {
        const a = this.attack;
        this.x += Math.cos(this.facing) * a.lunge * dt;
        this.y += Math.sin(this.facing) * a.lunge * dt;
        if (this.t >= a.active) this.setState('recovery');
        break;
      }

      case 'recovery':
        if (this.t >= this.attack.recovery) {
          this.attack = null;
          this.cooldown = rand(this.cooldownMin, this.cooldownMax);
          this.strafeDir = Math.random() < 0.5 ? -1 : 1;
          this.setState('chase');
        }
        break;

      case 'stagger':
        if (this.t >= 0.45) this.setState('chase');
        break;
    }

    this.x += this.vx * dt; this.y += this.vy * dt;
    const damp = Math.pow(0.002, dt); this.vx *= damp; this.vy *= damp;
  }

  takeDamage(dmg, sx, sy, kb = 120, breakPoise = false) {
    if (!this.alive) return;
    this.hp -= dmg;
    this.flash = 0.15;
    const [nx, ny] = norm(this.x - sx, this.y - sy);
    const kbScale = this.boss ? 0.35 : 1;
    this.vx = nx * kb * kbScale; this.vy = ny * kb * kbScale;
    if (this.hp <= 0) { this.hp = 0; this.dormant = false; this.setState('dead'); return; }
    if (this.dormant) this.wake();
    if (breakPoise || dmg >= this.poise) { this.attack = null; this.setState('stagger'); }
    else if (this.state === 'idle') this.setState('chase');
  }
}
