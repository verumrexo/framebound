# framebound development roadmap

active idea and feature backlog. preserve every item until it is finished or
explicitly removed. gameplay and creative implementation details still require
approval before code changes.

## parts & weapons

- [x] freezer - slows/freezes enemies
- [x] cluster grenade - multi-split explosive
- [ ] warp gate - teleportation utility
- [ ] mine placer - deploys proximity mines
- [ ] drone maker - spawns combat drones
- [ ] captain seat - passive command buffs
- [ ] beam sword - melee energy weapon
- [ ] shrapnel grenade - scattering explosive
- [ ] decoy - distraction device
- [ ] stealth - cloaking device
- [ ] hack dart - disable/control enemies
- [ ] auto aim - targeting assistance
- [ ] prism - beam splitter
- [ ] emp - area disable
- [ ] fmj - armor piercing rounds

## core gameplay

- [x] enemy variety - striker, rocketeer, sniper, circler
- [x] fix boss insta-kill (add telegraphing)
- [ ] implement boss phases & attacks (symmetry/hitboxes done)
  - [x] nerf railgun aim (charge delay + telegraph)
  - [x] fix boss scaling bug
- [x] level up system overhaul
- [x] implement devtools logout & high score blocking
- [ ] biome system - visual themes per level
- [ ] parts falling off when shot - visual debris on damage
- [ ] full screen map - view the entire floor
- [ ] custom seeds - manual floor generation control

## polish & feel

- [x] particle effects
- [x] screen shake
- [x] sound effects
- [x] ui improvements
- [x] hp numbers inside hp bars
- [x] random biomes per floor overhaul

## balance

- [x] difficulty scaling per floor
- [ ] meta progression - unlock system
- [ ] economy balance - gold/xp/shop
- [ ] part stat balancing

## technical

- [x] renderer cleanup
- [x] game.js modularization
- [x] collision system unified
- [x] z-index draw order fixed
- [x] room transition bug fixed
- [ ] starfield.js overhaul
- [ ] save system overhaul - persistent asteroids/boxes
- [x] add "m: map" to tutorial text in `game.js`
- [x] bump version to 0.7.1 in `version.js`

## content

- [ ] more room types
- [ ] rare events
- [ ] achievements
- [ ] daily challenges
