import * as THREE from 'three';
import { T } from './textures.js';

// All models use local +X as "forward" and +Z as the character's right-hand side.

const steelMat = (color = 0xb8bcc4) => new THREE.MeshStandardMaterial({ color, metalness: 0.85, roughness: 0.3 });
const woodMat = () => new THREE.MeshStandardMaterial({ map: T.wood(), roughness: 0.9 });
const darkMat = () => new THREE.MeshStandardMaterial({ color: 0x2a2624, roughness: 0.8 });

function shadowed(mesh) { mesh.castShadow = true; return mesh; }

// ---------------------------------------------------------------- weapons

// Grip at the origin, business end along +X.
export function weaponModel(kind, opts = {}) {
  const g = new THREE.Group();
  const steel = steelMat(opts.steel);
  const wood = woodMat();
  const dark = darkMat();

  const blade = (len, w, thick = 0.035) => {
    const b = shadowed(new THREE.Mesh(new THREE.BoxGeometry(len, thick, w), steel));
    b.position.x = len / 2 + 0.08;
    return b;
  };
  const guard = (w) => { const m = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.05, w), steel); m.position.x = 0.06; return m; };
  const grip = (len) => { const m = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.028, len, 8), dark); m.rotation.z = Math.PI / 2; m.position.x = -len / 2 + 0.03; return m; };
  const pommel = (len) => { const m = new THREE.Mesh(new THREE.SphereGeometry(0.045, 8, 6), steel); m.position.x = -len + 0.03; return m; };

  switch (kind) {
    case 'greatsword':
      g.add(blade(1.6, 0.18, 0.05), guard(0.5), grip(0.36), pommel(0.36));
      break;
    case 'dagger':
      g.add(blade(0.45, 0.06, 0.025), guard(0.16), grip(0.14), pommel(0.14));
      break;
    case 'spear': {
      const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 2.2, 8), wood);
      shaft.rotation.z = Math.PI / 2; shaft.position.x = 0.6;
      const tip = shadowed(new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.4, 8), steel));
      tip.rotation.z = -Math.PI / 2; tip.position.x = 1.9;
      const collar = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.1, 8), steel);
      collar.rotation.z = Math.PI / 2; collar.position.x = 1.68;
      g.add(shaft, tip, collar);
      break;
    }
    case 'axe': {
      const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 1.1, 8), wood);
      shaft.rotation.z = Math.PI / 2; shaft.position.x = 0.35;
      const head = shadowed(new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.06, 0.42), steel));
      head.position.set(0.86, 0, 0.1);
      const bit = shadowed(new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.05, 0.5), steel));
      bit.position.set(0.98, 0, 0.12);
      g.add(shaft, head, bit);
      break;
    }
    case 'tongue': {
      const pink = new THREE.MeshStandardMaterial({ color: 0xc44a6a, roughness: 0.6 });
      const t = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.09, 1.3, 8), pink);
      t.rotation.z = -Math.PI / 2; t.position.x = 0.65;
      const tip = new THREE.Mesh(new THREE.SphereGeometry(0.1, 8, 6), pink);
      tip.position.x = 1.3;
      g.add(t, tip);
      break;
    }
    case 'sword':
    default:
      g.add(blade(1.0, 0.09), guard(0.32), grip(0.22), pommel(0.22));
  }
  return g;
}

// ---------------------------------------------------------------- humanoid

// opts: { skin, cloth, ragged, armor, armorColor, hood, helmet, shield, scale }
// Returns a rig: group (position + yaw) -> pivot (spin / lean at hip height) -> inner (limbs)
export function makeHumanoid(o) {
  const group = new THREE.Group();
  const pivot = new THREE.Group(); pivot.position.y = 0.9; group.add(pivot);
  const inner = new THREE.Group(); inner.position.y = -0.9; pivot.add(inner);

  const skinMat = new THREE.MeshStandardMaterial({ color: o.skin, roughness: 0.9 });
  const clothMat = new THREE.MeshStandardMaterial({ map: o.ragged ? T.ragged(o.cloth) : T.cloth(o.cloth), roughness: 0.95 });
  const armorMat = o.armor
    ? new THREE.MeshStandardMaterial({ map: T.plate(o.armorColor), metalness: 0.55, roughness: 0.45 })
    : new THREE.MeshStandardMaterial({ map: o.ragged ? T.ragged(o.cloth) : T.chain(o.cloth), roughness: 0.8, metalness: o.ragged ? 0 : 0.3 });
  const dark = darkMat();
  const mats = [skinMat, clothMat, armorMat];

  // legs (origin at hip, mesh hangs down)
  const legGeo = new THREE.CapsuleGeometry(0.11, 0.55, 3, 8);
  const legL = new THREE.Group(); legL.position.set(0, 0.95, -0.15);
  const lm = shadowed(new THREE.Mesh(legGeo, clothMat)); lm.position.y = -0.42;
  const bootL = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.12, 0.2), dark); bootL.position.set(0.06, -0.86, 0);
  legL.add(lm, bootL);
  const legR = legL.clone(); legR.position.z = 0.15;

  // torso + belt
  const torso = shadowed(new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.62, 0.5), armorMat)); torso.position.y = 1.28;
  const belt = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.08, 0.52), dark); belt.position.y = 0.98;
  const shL = new THREE.Mesh(new THREE.SphereGeometry(0.13, 10, 8), armorMat); shL.position.set(0, 1.55, -0.32);
  const shR = shL.clone(); shR.position.z = 0.32;

  // right arm: points along local +X, weapon at the hand
  const armGeo = new THREE.CapsuleGeometry(0.085, 0.5, 3, 8);
  const armR = new THREE.Group(); armR.position.set(0.05, 1.52, 0.34);
  const am = shadowed(new THREE.Mesh(armGeo, clothMat)); am.rotation.z = Math.PI / 2; am.position.x = 0.3;
  const handR = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 6), skinMat); handR.position.x = 0.62;
  const weaponSlot = new THREE.Group(); weaponSlot.position.x = 0.62;
  armR.add(am, handR, weaponSlot);

  // left arm hangs down, optionally with a shield
  const armL = new THREE.Group(); armL.position.set(0.05, 1.52, -0.34);
  const alm = shadowed(new THREE.Mesh(armGeo, clothMat)); alm.position.y = -0.3;
  const handL = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 6), skinMat); handL.position.y = -0.62;
  armL.add(alm, handL);
  if (o.shield) {
    const sh = shadowed(new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.62, 0.46), armorMat));
    sh.position.set(0.14, -0.42, -0.02);
    const boss = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 6), steelMat());
    boss.position.set(0.18, -0.42, -0.02);
    armL.add(sh, boss);
  }

  // head
  const head = new THREE.Group(); head.position.y = 1.8;
  const skull = shadowed(new THREE.Mesh(new THREE.SphereGeometry(0.19, 14, 12), skinMat));
  head.add(skull);
  if (o.hood) {
    const hood = new THREE.Mesh(new THREE.SphereGeometry(0.245, 14, 12, 0, Math.PI * 2, 0, Math.PI * 0.62), clothMat);
    hood.position.set(-0.03, 0.02, 0);
    head.add(hood);
  }
  if (o.helmet) {
    const helm = shadowed(new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.22, 0.34, 12), steelMat(0x4a5060)));
    helm.position.y = 0.06;
    const crest = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.3, 6), steelMat(0x4a5060));
    crest.position.y = 0.36;
    const visor = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.05, 0.3), dark);
    visor.position.set(0.19, 0.03, 0);
    head.add(helm, crest, visor);
  }

  inner.add(legL, legR, torso, belt, shL, shR, armR, armL, head);
  group.scale.setScalar(o.scale ?? 1);
  return { group, pivot, inner, armR, armL, legL, legR, head, weaponSlot, mats, weaponKind: null };
}

export function setWeapon(rig, kind, opts) {
  if (rig.weaponKind === kind) return;
  rig.weaponSlot.clear();
  rig.weaponSlot.add(weaponModel(kind, opts));
  rig.weaponKind = kind;
}

// ---------------------------------------------------------------- chest

// Front (opening side) faces +X, hinge at the back. Returns { group, lidPivot, glow, teeth }
export function makeChest({ teeth = false } = {}) {
  const g = new THREE.Group();
  const wood = woodMat();
  const iron = steelMat(0x3b3b40);
  const D = 0.7, W = 1.3, H = 0.5;

  const base = shadowed(new THREE.Mesh(new THREE.BoxGeometry(D, H, W), wood));
  base.position.y = H / 2; base.receiveShadow = true;
  g.add(base);
  for (const z of [-0.42, 0.42]) {
    const band = new THREE.Mesh(new THREE.BoxGeometry(D + 0.02, H + 0.02, 0.08), iron);
    band.position.set(0, H / 2, z);
    g.add(band);
  }
  const inside = new THREE.Mesh(new THREE.BoxGeometry(D - 0.1, 0.06, W - 0.1), new THREE.MeshStandardMaterial({ color: teeth ? 0x4a0d12 : 0x1a1410, roughness: 1 }));
  inside.position.y = H - 0.02;
  g.add(inside);

  const glow = new THREE.Mesh(new THREE.SphereGeometry(0.12, 10, 8), new THREE.MeshBasicMaterial({ color: 0xffd27a }));
  glow.position.y = H + 0.1; glow.visible = false;
  g.add(glow);

  const lidPivot = new THREE.Group(); lidPivot.position.set(-D / 2, H, 0);
  const lid = shadowed(new THREE.Mesh(new THREE.BoxGeometry(D, 0.16, W), wood));
  lid.position.set(D / 2, 0.08, 0);
  const lidBand = new THREE.Mesh(new THREE.BoxGeometry(D + 0.02, 0.18, 0.08), iron);
  lidBand.position.set(D / 2, 0.08, -0.42);
  const lidBand2 = lidBand.clone(); lidBand2.position.z = 0.42;
  const latch = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.14, 0.12), iron);
  latch.position.set(D + 0.01, 0.02, 0);
  lidPivot.add(lid, lidBand, lidBand2, latch);
  g.add(lidPivot);

  const teethGroup = new THREE.Group();
  if (teeth) {
    const bone = new THREE.MeshStandardMaterial({ color: 0xe8e2d0, roughness: 0.6 });
    for (let k = 0; k < 9; k++) {
      const z = -0.55 + k * 0.1375;
      const lower = new THREE.Mesh(new THREE.ConeGeometry(0.035, 0.16, 5), bone);
      lower.position.set(D / 2 - 0.04, H + 0.06, z);
      const upper = new THREE.Mesh(new THREE.ConeGeometry(0.035, 0.16, 5), bone);
      upper.rotation.x = Math.PI; upper.position.set(D - 0.04, -0.08, z);
      lidPivot.add(upper);
      teethGroup.add(lower);
    }
    const eyeMat = new THREE.MeshBasicMaterial({ color: 0xffd040 });
    for (const z of [-0.25, 0.25]) {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 6), eyeMat);
      eye.position.set(D / 2 - 0.1, H - 0.1, z);
      teethGroup.add(eye);
    }
    g.add(teethGroup);
  }
  return { group: g, lidPivot, glow, teeth: teethGroup };
}

// A mimic uses the chest as its body. Rig interface matches makeHumanoid where it matters.
export function makeMimicRig() {
  const group = new THREE.Group();
  const pivot = new THREE.Group(); pivot.position.y = 0.4; group.add(pivot);
  const inner = new THREE.Group(); inner.position.y = -0.4; pivot.add(inner);
  const chest = makeChest({ teeth: true });
  chest.lidPivot.rotation.z = 1.7;
  inner.add(chest.group);
  // tongue arm at the front of the mouth
  const armR = new THREE.Group(); armR.position.set(0.3, 0.45, 0);
  const weaponSlot = new THREE.Group();
  armR.add(weaponSlot);
  inner.add(armR);
  // stubby legs
  const legMat = new THREE.MeshStandardMaterial({ color: 0x3a2a1a, roughness: 0.9 });
  const legs = [];
  for (const [x, z] of [[-0.25, -0.5], [-0.25, 0.5], [0.25, -0.5], [0.25, 0.5]]) {
    const l = new THREE.Group(); l.position.set(x, 0.08, z);
    const m = new THREE.Mesh(new THREE.CapsuleGeometry(0.06, 0.3, 3, 6), legMat); m.position.y = -0.05;
    l.add(m); inner.add(l); legs.push(l);
  }
  const mats = [chest.group.children[0].material];
  return { group, pivot, inner, armR, armL: null, legL: legs[0], legR: legs[1], head: null, weaponSlot, mats, weaponKind: null, mimicLegs: legs, mimic: true };
}

// Glowing pickup for a dropped item.
export function makeDrop() {
  const g = new THREE.Group();
  const orb = new THREE.Mesh(new THREE.SphereGeometry(0.16, 12, 10), new THREE.MeshBasicMaterial({ color: 0xffe2a0, transparent: true, opacity: 0.9 }));
  orb.position.y = 0.5;
  const light = new THREE.PointLight(0xffc860, 6, 6, 2);
  light.position.y = 0.8;
  g.add(orb, light);
  return { group: g, orb, light };
}
