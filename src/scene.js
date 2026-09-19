import * as THREE from 'three';
import { WORLD, WALLS, BONFIRE } from './world.js';
import { WEAPONS } from './config.js';
import { angleDiff } from './utils.js';
import { T, fitted } from './textures.js';
import { makeHumanoid, makeMimicRig, makeChest, makeDrop, setWeapon } from './models.js';

export const S = 0.05;                         // 1 logic unit = 5 cm
const X = (x) => x * S;
const Z = (y) => y * S;
const lerp = (a, b, t) => a + (b - a) * t;
const smooth = (p) => p * p * (3 - 2 * p);

// ---------------------------------------------------------------- helpers

// Box with a repeating texture fitted per face so bricks stay the same size on every wall.
function texturedBox(w, h, d, tex, tile) {
  const face = (fw, fh) => {
    const m = new THREE.MeshStandardMaterial({ map: fitted(tex, fw, fh, tile), roughness: 0.9 });
    m.bumpMap = m.map; m.bumpScale = 0.04;
    return m;
  };
  const mats = [face(d, h), face(d, h), face(w, d), face(w, d), face(w, h), face(w, h)];
  return new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mats);
}

// Normalise player and enemy attack timing into [phase, progress 0..1].
function attackPhase(e) {
  const a = e.attack;
  if (!a) return null;
  if (e.state === 'attack') {
    if (e.t < a.windup) return ['windup', e.t / a.windup];
    if (e.t < a.windup + a.active) return ['active', (e.t - a.windup) / a.active];
    return ['recovery', Math.min(1, (e.t - a.windup - a.active) / a.recovery)];
  }
  if (e.state === 'windup') return ['windup', Math.min(1, e.t / a.windup)];
  if (e.state === 'active') return ['active', Math.min(1, e.t / a.active)];
  if (e.state === 'recovery') return ['recovery', Math.min(1, e.t / a.recovery)];
  return null;
}

// Weapon-arm pose: [rotY (azimuth), rotZ (elevation), offsetX (thrust)]
const REST = [0.3, -1.1, 0];
function armPose(anim, phase, p) {
  const s = smooth(p);
  if (anim === 'overhead') {
    if (phase === 'windup') return [lerp(0.3, 0, s), lerp(-1.1, 2.1, s), 0];
    if (phase === 'active') return [0, lerp(2.1, -0.7, p), 0.1];
    return [lerp(0, 0.3, s), lerp(-0.7, -1.1, s), 0];
  }
  if (anim === 'thrust') {
    if (phase === 'windup') return [lerp(0.3, 0, s), lerp(-1.1, 0, s), lerp(0, -0.35, s)];
    if (phase === 'active') return [0, 0, lerp(-0.35, 0.45, p)];
    return [lerp(0, 0.3, s), lerp(0, -1.1, s), lerp(0.45, 0, s)];
  }
  // sweep
  if (phase === 'windup') return [lerp(0.3, -1.8, s), lerp(-1.1, 0, s), 0];
  if (phase === 'active') return [lerp(-1.8, 1.6, p), 0, 0];
  return [lerp(1.6, 0.3, s), lerp(0, -1.1, s), 0];
}

const LOOKS = {
  player: () => makeHumanoid({ skin: 0xd9b48a, cloth: '#4a3b2c', armor: true, armorColor: '#6a6e78', hood: true }),
  hollow: (e) => makeHumanoid({ skin: 0x9a9a7a, cloth: '#5a4a34', ragged: true, scale: e.scale }),
  knight: (e) => makeHumanoid({ skin: 0x2a2a30, cloth: '#2c3550', armor: true, armorColor: '#5c6c8f', helmet: true, shield: true, scale: e.scale }),
  mimic: () => makeMimicRig(),
};

// ---------------------------------------------------------------- view

export class View {
  constructor(canvas) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.35;

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x06060a);
    this.scene.fog = new THREE.FogExp2(0x06060a, 0.022);

    this.camera = new THREE.PerspectiveCamera(55, 1, 0.1, 200);
    this.yaw = 0; this.pitch = 0.42; this.dist = 7.5;
    this.camPos = null; this.shake = 0; this.time = 0;
    this.ray = new THREE.Raycaster();

    this.rigs = new Map();
    this.chests = new Map();
    this.drops = [];
    this.wedgeGeos = new Map();
    this.wallMeshes = [];

    this.buildWorld();
    this.buildLights();
    this.resize();
    window.addEventListener('resize', () => this.resize());
  }

  resize() {
    this.renderer.setSize(window.innerWidth, window.innerHeight, false);
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
  }

  buildWorld() {
    const stone = T.stone();
    stone.repeat.set(WORLD.w * S / 4, WORLD.h * S / 4);
    const floorMat = new THREE.MeshStandardMaterial({ map: stone, roughness: 0.95 });
    floorMat.bumpMap = stone; floorMat.bumpScale = 0.06;
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(WORLD.w * S, WORLD.h * S), floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.position.set(X(WORLD.w / 2), 0, Z(WORLD.h / 2));
    floor.receiveShadow = true;
    this.scene.add(floor);

    const brick = T.brick();
    for (const w of WALLS) {
      const outer = w.w >= 1000 || w.h >= 1000;
      const h = outer ? 3.2 : 5;
      const m = texturedBox(w.w * S, h, w.h * S, brick, 2);
      m.position.set(X(w.x + w.w / 2), h / 2, Z(w.y + w.h / 2));
      m.castShadow = true; m.receiveShadow = true;
      this.scene.add(m);
      this.wallMeshes.push(m);
    }

    // bonfire
    const bf = new THREE.Group();
    bf.position.set(X(BONFIRE.x), 0, Z(BONFIRE.y));
    const ash = new THREE.Mesh(new THREE.SphereGeometry(0.7, 12, 8), new THREE.MeshStandardMaterial({ color: 0x3a332c, roughness: 1 }));
    ash.scale.y = 0.25; ash.receiveShadow = true;
    const swordMat = new THREE.MeshStandardMaterial({ color: 0x8e8a80, metalness: 0.7, roughness: 0.4 });
    const sword = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.05, 1.9, 6), swordMat);
    sword.position.set(0.05, 0.95, 0); sword.rotation.z = -0.15;
    const cross = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.05, 0.05), swordMat);
    cross.position.set(0.02, 1.3, 0); cross.rotation.z = -0.15;
    bf.add(ash, sword, cross);
    this.flames = [];
    const flameColors = [0xffe07a, 0xff9a3c, 0xe6501e];
    for (let k = 0; k < 3; k++) {
      const f = new THREE.Mesh(new THREE.ConeGeometry(0.22 - k * 0.04, 0.8 + k * 0.25, 8),
        new THREE.MeshBasicMaterial({ color: flameColors[k], transparent: true, opacity: 0.85 - k * 0.2 }));
      f.position.y = 0.45 + k * 0.1;
      bf.add(f); this.flames.push(f);
    }
    this.fireLight = new THREE.PointLight(0xff9a3c, 70, 30, 2);
    this.fireLight.position.y = 1.2;
    bf.add(this.fireLight);
    this.scene.add(bf);

    // bloodstain
    this.stain = new THREE.Group();
    const disk = new THREE.Mesh(new THREE.CircleGeometry(0.5, 20), new THREE.MeshBasicMaterial({ color: 0xb8ffb0, transparent: true, opacity: 0.8 }));
    disk.rotation.x = -Math.PI / 2; disk.position.y = 0.04;
    this.stainLight = new THREE.PointLight(0x9cff9c, 10, 8, 2);
    this.stainLight.position.y = 0.8;
    this.stain.add(disk, this.stainLight);
    this.stain.visible = false;
    this.scene.add(this.stain);
  }

  buildLights() {
    this.scene.add(new THREE.HemisphereLight(0x33405e, 0x0c0c10, 1.3));
    const moon = new THREE.DirectionalLight(0x8090c0, 1.5);
    moon.position.set(X(WORLD.w / 2) - 30, 45, Z(WORLD.h / 2) - 25);
    moon.target.position.set(X(WORLD.w / 2), 0, Z(WORLD.h / 2));
    moon.castShadow = true;
    moon.shadow.mapSize.set(2048, 2048);
    const sc = moon.shadow.camera;
    sc.left = -48; sc.right = 48; sc.top = 36; sc.bottom = -36; sc.near = 1; sc.far = 150;
    moon.shadow.bias = -0.0005;
    this.scene.add(moon, moon.target);
  }

  // ---------------------------------------------------------------- rigs

  rigFor(e, isPlayer = false) {
    let rig = this.rigs.get(e);
    if (!rig) {
      rig = isPlayer ? LOOKS.player() : (LOOKS[e.look] || LOOKS.hollow)(e);
      rig.wedge = this.makeWedge();
      this.scene.add(rig.group, rig.wedge.holder);
      this.rigs.set(e, rig);
    }
    return rig;
  }

  makeWedge() {
    const mat = new THREE.MeshBasicMaterial({ color: 0xffcc44, transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false });
    const mesh = new THREE.Mesh(new THREE.RingGeometry(0.2, 1, 8, 1, -0.5, 1), mat);
    mesh.rotation.x = -Math.PI / 2; mesh.position.y = 0.03; mesh.visible = false;
    const holder = new THREE.Group(); holder.add(mesh);
    return { mesh, holder, key: '' };
  }

  wedgeGeo(range, halfAngle) {
    const key = `${range}|${halfAngle.toFixed(4)}`;
    let g = this.wedgeGeos.get(key);
    if (!g) {
      g = new THREE.RingGeometry(0.25, range * S, 32, 1, -halfAngle, halfAngle * 2);
      this.wedgeGeos.set(key, g);
    }
    return [key, g];
  }

  syncRig(rig, e, isPlayer) {
    const visible = isPlayer || (e.alive && !e.dormant);
    rig.group.visible = visible;
    rig.wedge.mesh.visible = false;
    if (!visible) return;

    rig.group.position.set(X(e.x), 0, Z(e.y));
    if (isPlayer) setWeapon(rig, WEAPONS[e.weaponKey].model);
    else if (e.weapon) setWeapon(rig, e.weapon, { steel: e.look === 'hollow' ? 0x6e6a5e : undefined });

    let yaw = e.facing;
    let [ay, az, ax] = REST;
    const baseY = rig.mimic ? 0.4 : 0.9;
    rig.pivot.rotation.set(0, 0, 0);
    rig.pivot.position.y = baseY;

    const ph = attackPhase(e);
    if (ph) [ay, az, ax] = armPose(e.attack.anim || 'sweep', ph[0], ph[1]);

    // locomotion
    const walking = isPlayer ? (e.moving && e.state === 'idle') : e.state === 'chase';
    const gait = walking ? Math.sin(this.time * (rig.mimic ? 16 : 10)) : 0;
    if (rig.mimic) {
      rig.mimicLegs.forEach((l, i) => { l.rotation.z = gait * 0.7 * (i % 2 ? 1 : -1); });
      if (walking) rig.pivot.position.y = baseY + Math.abs(gait) * 0.18;
    } else {
      rig.legL.rotation.z = gait * 0.65;
      rig.legR.rotation.z = -gait * 0.65;
      rig.armL.rotation.z = gait * 0.4;
      if (walking) { rig.pivot.rotation.z = -0.06; rig.pivot.position.y = baseY + Math.abs(gait) * 0.05; }
    }

    if (e.state === 'roll') {
      yaw = Math.atan2(e.rollDir[1], e.rollDir[0]);
      if (e.rollDef && e.rollDef.dash) {
        rig.pivot.rotation.z = -0.5;                        // quickstep: low lean, no somersault
      } else {
        rig.pivot.rotation.z = -Math.PI * 2 * (e.t / e.rollDef.duration);
        rig.pivot.position.y = 0.7;
      }
      [ay, az, ax] = [0.3, -0.6, 0];
    } else if (e.state === 'stagger') {
      rig.pivot.rotation.z = 0.4 * Math.sin(Math.min(1, e.t / 0.42) * Math.PI);
    } else if (e.state === 'estus') {
      rig.pivot.rotation.z = 0.15;
      [ay, az, ax] = [0.6, 0.9, 0];
    } else if (e.state === 'buff') {
      rig.pivot.rotation.z = 0.12;
      [ay, az, ax] = [0, 1.5, 0];                           // weapon raised for the warcry
    } else if (e.state === 'interact') {
      rig.pivot.rotation.z = -0.35;
      [ay, az, ax] = [0.3, -0.6, 0];
    } else if (!e.alive) {
      rig.pivot.rotation.z = Math.PI / 2 * 0.95;
      rig.pivot.position.y = 0.35;
    }

    rig.group.rotation.y = -yaw;
    rig.armR.rotation.set(0, ay, az);
    rig.armR.position.x = (rig.mimic ? 0.3 : 0.05) + ax;

    // hit flash / warcry glow
    const f = e.flash > 0 ? Math.min(1, e.flash * 4) : 0;
    for (const m of rig.mats) {
      if (f > 0) { m.emissive.set(e.flashColor || '#ffffff'); m.emissiveIntensity = f * 1.4; }
      else if (isPlayer && e.buffT > 0) { m.emissive.set('#ff6a20'); m.emissiveIntensity = 0.18 + Math.sin(this.time * 8) * 0.06; }
      else m.emissiveIntensity = 0;
    }

    // telegraph wedge on the ground
    if (ph && (ph[0] === 'windup' || ph[0] === 'active') && e.alive) {
      const a = e.attack, w = rig.wedge;
      const [key, geo] = this.wedgeGeo(a.range, a.halfAngle);
      if (w.key !== key) { w.mesh.geometry = geo; w.key = key; }
      w.mesh.visible = true;
      w.holder.position.set(X(e.x), 0, Z(e.y));
      w.holder.rotation.y = -e.facing;
      const m = w.mesh.material;
      if (isPlayer) {
        m.color.set(a.breakPoise ? 0xbfe0ff : 0xdde6ff);
        m.opacity = ph[0] === 'active' ? 0.35 : 0.08;
      } else if (ph[0] === 'windup') {
        const p = ph[1];
        m.color.setRGB(lerp(0.55, 1.0, p), lerp(0.8, 0.15, p), 0.15);
        m.opacity = 0.12 + 0.4 * p;
      } else {
        m.color.set(0xff4030);
        m.opacity = 0.7;
      }
    }
  }

  // ---------------------------------------------------------------- chests + drops

  syncChests(game) {
    for (const c of game.chests) {
      let m = this.chests.get(c.id);
      if (!m) {
        m = makeChest();
        m.group.position.set(X(c.x), 0, Z(c.y));
        m.group.rotation.y = -c.facing;
        this.scene.add(m.group);
        this.chests.set(c.id, m);
      }
      m.group.visible = !c.gone;
      const p = c.opened ? smooth(Math.min(1, (game.time - c.openedAt) / 0.6)) : 0;
      m.lidPivot.rotation.z = 1.9 * p;
      m.glow.visible = c.opened && !c.mimic && p > 0.5 && !c.taken;
    }
  }

  syncDrops(game) {
    while (this.drops.length < game.drops.length) {
      const d = makeDrop();
      this.scene.add(d.group);
      this.drops.push(d);
    }
    this.drops.forEach((d, i) => {
      const src = game.drops[i];
      d.group.visible = !!src;
      if (!src) return;
      d.group.position.set(X(src.x), 0, Z(src.y));
      d.orb.position.y = 0.5 + Math.sin(this.time * 3 + i) * 0.08;
      d.orb.rotation.y = this.time;
      d.light.intensity = 5 + Math.sin(this.time * 5) * 1.5;
    });
  }

  // ---------------------------------------------------------------- camera

  updateCamera(game, dt) {
    const p = game.player, t = p.lockTarget;
    const locked = t && t.alive;
    if (locked) {
      const want = Math.atan2(t.y - p.y, t.x - p.x);
      this.yaw += angleDiff(this.yaw, want) * Math.min(1, 5 * dt);
    }
    const focus = new THREE.Vector3(X(p.x), 1.2, Z(p.y));
    if (locked) focus.lerp(new THREE.Vector3(X(t.x), 1.2, Z(t.y)), 0.25);

    const cp = Math.cos(this.pitch), sp = Math.sin(this.pitch);
    const dir = new THREE.Vector3(-Math.cos(this.yaw) * cp, sp, -Math.sin(this.yaw) * cp).normalize();
    let dist = this.dist;

    // pull the camera in if a wall sits between it and the player
    this.ray.set(focus, dir);
    this.ray.far = dist;
    const hit = this.ray.intersectObjects(this.wallMeshes, false)[0];
    if (hit) dist = Math.max(1.2, hit.distance - 0.4);

    const want = focus.clone().addScaledVector(dir, dist);
    if (!this.camPos) this.camPos = want.clone();
    this.camPos.lerp(want, 1 - Math.exp(-(hit ? 30 : 14) * dt));

    const sh = this.shake * 0.02;
    this.shake = Math.max(0, this.shake - dt * 30);
    this.camera.position.set(
      this.camPos.x + (Math.random() - 0.5) * sh,
      Math.max(0.4, this.camPos.y + (Math.random() - 0.5) * sh),
      this.camPos.z);
    this.camera.lookAt(focus);
  }

  sync(game, dt) {
    this.time += dt;
    this.syncRig(this.rigFor(game.player, true), game.player, true);
    for (const e of game.enemies) this.syncRig(this.rigFor(e), e, false);
    this.syncChests(game);
    this.syncDrops(game);

    const flick = 1 + Math.sin(this.time * 9) * 0.06 + Math.sin(this.time * 23) * 0.05;
    this.flames.forEach((f, k) => { f.scale.set(flick, flick + Math.sin(this.time * 15 + k) * 0.08, flick); f.rotation.y = this.time * (1.5 + k); });
    this.fireLight.intensity = 70 * flick;

    const b = game.bloodstain;
    this.stain.visible = !!b;
    if (b) {
      this.stain.position.set(X(b.x), 0, Z(b.y));
      this.stainLight.intensity = 8 + Math.sin(this.time * 4) * 4;
    }

    this.updateCamera(game, dt);
  }

  // World logic position + height (m) -> screen px, or null if behind the camera.
  project(x, y, h) {
    const v = new THREE.Vector3(X(x), h, Z(y)).project(this.camera);
    if (v.z > 1) return null;
    return { sx: (v.x + 1) / 2 * window.innerWidth, sy: (1 - v.y) / 2 * window.innerHeight };
  }

  render() { this.renderer.render(this.scene, this.camera); }
}
