# Ashen — a souls-like prototype

A small 3D souls-like in vanilla JavaScript and Three.js. No build step, no downloaded assets: every texture is generated in a canvas at load.
Dark Souls 3 is the reference for the feel: commit to your actions, read the telegraph, roll through it, punish the recovery.

## Run

ES modules need a local server (double-clicking `index.html` will not work in Chrome).
Three.js is loaded from a CDN, so the first load needs internet.

```
npm start          # python -m http.server 8000
```

Then open http://localhost:8000 and click to grab the mouse. Esc releases it (the game pauses).
Any static server works, e.g. `npx serve .`.

Headless rules check (no browser needed):

```
npm test
```

Open http://localhost:8000/?preview to run the simulation without pointer lock (handy for screenshots).

## Controls

| Input | Action |
| --- | --- |
| WASD | Move, relative to the camera |
| Mouse | Orbit the camera |
| Left click | Light attack |
| Right click | Heavy attack |
| F or Shift | Weapon skill (costs FP) |
| Space | Roll in the held direction. No direction = backstep |
| Q | Toggle lock-on to the nearest enemy |
| E | Open a chest / rest at the bonfire |
| R | Drink Estus (3 charges, refilled at the bonfire) |
| 1-5 or mouse wheel | Switch weapon |
| Esc | Release the mouse |

## Weapons

You start with the Longsword. The other four are in chests around the arena. One chest is not a chest.

| Weapon | Light / Heavy | Skill | FP |
| --- | --- | --- | --- |
| Longsword | Balanced sweep / overhead | **Stance Thrust**: long lunging thrust that always staggers | 12 |
| Greatsword | Slow, wide, heavy hits. Heavy always staggers | **Stomp**: 360° shockwave, low damage, staggers and knocks everything back | 15 |
| Dagger | Very fast, short, low damage | **Quickstep**: instant dash with i-frames the whole way, cheap | 5 |
| Spear | Long narrow thrusts, outranges everything | **Charge**: run forward with the point live, staggers on contact | 14 |
| Battle Axe | Hard-hitting sweeps | **Warcry**: +30% damage for 20 s | 10 |

FP regenerates slowly and refills at the bonfire. Skills queue like attacks and can be roll-cancelled.

## What is in the base

- **Third-person camera.** Orbits with the mouse, pulls in when a wall gets between it and you, snaps behind you on lock-on, shakes on hits.
- **Articulated characters.** Hooded, armoured player with walking legs and a swinging weapon arm. Hollows in rags, an armoured knight with shield and helmet, and a mimic with teeth and a tongue. All primitives, all procedurally textured.
- **Stamina economy.** Attacks, skills and rolls cost stamina. It regenerates only when you are not committed to an action.
- **Attack phases.** Every swing, yours and theirs, is windup -> active -> recovery. Enemies telegraph the windup with a wedge on the ground that turns from yellow to red, and a matching weapon raise.
- **Roll i-frames.** The roll is invulnerable for a window in the middle, not the whole roll. Rolling too early gets you clipped at the end.
- **Input buffering.** Inputs pressed during recovery queue and fire when the action window opens, including roll-cancel out of late recovery and roll attacks.
- **Poise.** Hollows stagger on any hit. The Lothric Knight only staggers on heavies or poise-breaking skills.
- **Chests.** Open with E. Opening leaves you vulnerable for a moment. Opened chests stay open across deaths.
- **Mimic.** Sleeps in one chest. Opening it or hitting it wakes it. It bites hard, hops, and does not respawn once killed. It drops its weapon where it dies. Die while fighting it and it curls back into its chest.
- **Death loop.** Dying drops your souls as a glowing bloodstain. Respawn at the bonfire with enemies reset. Die again before picking it up and it is gone. Weapons are kept.
- **Boss bar** for the knight once he is aggroed, and a "GREAT ENEMY FELLED" banner when he falls.

## Layout

The simulation is 2D on the ground plane (circles, arcs, rectangles). The 3D view is a pure presentation layer on top of it, so gameplay can be tested headlessly.

```
index.html         canvas, HUD markup, Three.js import map
style.css          HUD styling
src/config.js      every tuning number: roll timings, weapons and skills, enemy stats
src/world.js       arena walls, bonfire, spawn points, chests
src/player.js      player state machine (idle / roll / attack / estus / buff / interact / stagger / dead), inventory, FP
src/enemy.js       enemy AI state machine, dormant sleepers, unique enemies
src/utils.js       vector math, arc hit test, circle-vs-rect collision
src/input.js       keyboard + pointer-locked mouse + wheel
src/textures.js    procedural canvas textures: stone, brick, wood, cloth, rags, plate, chainmail
src/models.js      humanoid rig, weapon models, chest, mimic body, item drop
src/scene.js       Three.js scene, rig animation, telegraph wedges, chests, drops, camera
src/hud.js         DOM HUD driver (bars, weapon slot, boss bar, banners, projected markers)
src/main.js        game loop, camera-relative controls, collisions, hits, chests, pickups, death/respawn
test/smoke.mjs     headless combat and weapon checks
```

## Ideas for next steps

- Level up at the bonfire (spend souls on Vigor / Endurance / Attunement).
- Parry and riposte, backstab, shield guard with guard-break.
- Two-handing, weapon upgrades with titanite, armour drops.
- A second area behind a fog gate with a real multi-phase boss.
- Sound and hit sparks. Replace primitive rigs with animated glTF models.
