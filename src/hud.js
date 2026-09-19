// DOM overlay HUD. All elements live in index.html; this just drives them.
export class Hud {
  constructor() {
    const $ = (s) => document.querySelector(s);
    this.hpBar = $('#vitals .hp'); this.hpFill = $('#vitals .hp .fill'); this.hpGhost = $('#vitals .hp .ghost');
    this.fpBar = $('#vitals .fp'); this.fpFill = $('#vitals .fp .fill');
    this.stBar = $('#vitals .st'); this.stFill = $('#vitals .st .fill');
    this.estus = $('#estus'); this.estusCount = $('#estus .count');
    this.weapon = $('#weapon'); this.weaponName = $('#weapon .name'); this.weaponSkill = $('#weapon .skill'); this.weaponIdx = $('#weapon .idx');
    this.buff = $('#buff');
    this.souls = $('#souls');
    this.boss = $('#boss'); this.bossName = $('#boss .name'); this.bossFill = $('#boss .fill');
    this.prompt = $('#prompt');
    this.banner = $('#banner'); this.bannerText = $('#banner .text');
    this.fade = $('#fade');
    this.markers = $('#markers'); this.reticle = $('#reticle');
    this.click = $('#click');
    this.pool = [];
  }

  marker(i) {
    while (this.pool.length <= i) {
      const d = document.createElement('div');
      d.className = 'marker';
      d.innerHTML = '<div class="fill"></div>';
      this.markers.appendChild(d);
      this.pool.push(d);
    }
    return this.pool[i];
  }

  update(game, view, locked) {
    const p = game.player;

    this.hpBar.style.width = `${p.maxHp * 3}px`;
    this.hpFill.style.width = `${(p.hp / p.maxHp) * 100}%`;
    this.hpGhost.style.width = `${(p.hpGhost / p.maxHp) * 100}%`;
    this.fpBar.style.width = `${p.maxFp * 2.4}px`;
    this.fpFill.style.width = `${(p.fp / p.maxFp) * 100}%`;
    this.fpBar.classList.toggle('flash', p.skillFail > 0);
    this.stBar.style.width = `${p.maxStamina * 2.4}px`;
    this.stFill.style.width = `${Math.max(0, p.stamina / p.maxStamina) * 100}%`;

    this.estusCount.textContent = p.estus;
    this.estus.classList.toggle('empty', p.estus <= 0);

    const w = p.weapon;
    this.weaponName.textContent = w.name;
    this.weaponSkill.textContent = `${w.skill.name} · ${w.skill.fp} FP`;
    this.weaponIdx.textContent = p.weapons.length > 1 ? `${p.weaponIndex + 1}/${p.weapons.length}` : '';
    this.weapon.classList.toggle('nofp', p.fp < w.skill.fp);
    this.buff.style.display = p.buffT > 0 ? 'block' : 'none';
    if (p.buffT > 0) this.buff.textContent = `Warcry  ${Math.ceil(p.buffT)}s`;

    this.souls.textContent = p.souls.toLocaleString();

    const boss = game.enemies.find((e) => e.boss && e.aggro);
    this.boss.classList.toggle('show', !!boss);
    if (boss) { this.bossName.textContent = boss.name; this.bossFill.style.width = `${(boss.hp / boss.maxHp) * 100}%`; }

    this.prompt.textContent = p.alive && game.prompt ? game.prompt : '';

    // banner + fade
    let dark = 0;
    const b = game.banner;
    if (b) {
      const life = b.t / b.dur;
      const alpha = life < 0.15 ? life / 0.15 : life > 0.8 ? (1 - life) / 0.2 : 1;
      this.banner.style.opacity = alpha;
      this.banner.className = b.cls || '';
      this.bannerText.textContent = b.text;
      if (b.dark) dark = 0.65 * alpha;
    } else {
      this.banner.style.opacity = 0;
    }
    this.fade.style.opacity = Math.max(dark, Math.min(1, game.restFade));

    // world-space enemy hp bars
    let n = 0;
    for (const e of game.enemies) {
      if (!e.alive || e.boss || e.dormant || e.hp >= e.maxHp) continue;
      const s = view.project(e.x, e.y, 2.3 * (e.scale ?? 1));
      if (!s) continue;
      const d = this.marker(n++);
      d.style.display = 'block';
      d.style.left = `${s.sx}px`; d.style.top = `${s.sy}px`;
      d.firstChild.style.width = `${(e.hp / e.maxHp) * 100}%`;
    }
    for (let i = n; i < this.pool.length; i++) this.pool[i].style.display = 'none';

    // lock-on reticle
    const t = p.lockTarget;
    const rs = t && t.alive ? view.project(t.x, t.y, 1.1 * (t.scale ?? 1)) : null;
    this.reticle.style.display = rs ? 'block' : 'none';
    if (rs) { this.reticle.style.left = `${rs.sx}px`; this.reticle.style.top = `${rs.sy}px`; }

    this.click.classList.toggle('hidden', locked);
  }
}
