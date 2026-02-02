# Framebound - Development Roadmap

## 🎯 High-Impact Features

### More Part Variety
- [x] **Freezer** - Weapon that slows/freezes enemies
- [ ] **Warp Gate** - Teleportation utility
- [ ] **Mine Placer** - Deploys proximity mines
- [ ] **Drone Maker** - Spawns autonomous combat drones
- [ ] **Captain Seat** - Passive buffs command module
- [ ] **Beam Sword** - Melee energy weapon
- [ ] **Shrapnel Grenade** - Scattering explosive
- [x] **Cluster Grenade** - Multi-split explosive
- [ ] **Decoy** - Distraction device
- [ ] **Stealth** - Cloaking device
- [ ] **Hack Dart** - Disable/control enemies
- [ ] **Auto Aim** - Targeting assistance
- [ ] **Prism** - Beam splitter
- [ ] **EMP** - Area disable effect

### core gameplay
- [x] **enemy variety** - new enemy types (striker, rocketeer, sniper, circler)
- [/] **boss improvements** - dynamic phases and special attacks (partially finished: symmetry & hitboxes done)
    - [x] nerf railgun aim (add charge delay & lock-on telegraph)
- [ ] **level up system overhaul**
- [ ] **biome system** - visual themes and enemy sets per level

## 🎨 Polish & Feel
- [x] **Particle Effects** - Explosions, trails, sparks
- [x] **Screen Shake** - Impact feedback
- [x] **Sound Effects** - Complete audio engine, prioritizing, and limiting
- [x] **UI Improvements** - Glass aesthetics, tooltips, responsive layout

## ⚖️ Balance & Progression
- [ ] **Meta Progression** - Unlock system between runs
- [x] **Difficulty Scaling** - HP/Damage tuning per floor (active in v0.5.0)
- [ ] **Economy Balance** - Gold/XP and Shop pricing
- [ ] **Part Balancing** - Stat review

## 🐛 Quality of Life
- [x] **Tutorial/Help** - In-game floor text guide
- [x] **Settings Menu** - Unified Audio & Graphics controls
- [ ] **Save System Improvements** - Slots/Auto-save indicators
- [x] **Performance** - Edge browser fixes, object pooling, limiters

## 🔧 Technical Debt (Code Cleanup Sprint)

### renderer.js
- [x] **mosaic effect canvas resize** - removed entirely

### game.js
- [x] **cleanup main update loop** - extracted `updateProjectiles`, `WeaponSystem`, `PhysicsSystem`, `PlayerController`
 modularization
- [x] **duplicate fire-rate logic** - same code block copy-pasted twice (lines ~1005-1010)
- [x] **homing projectile garbage** - fixed by iterating separately instead of spreading

### collision systems
- [x] **unify collision math** - `CollisionSystem.js` integrated, `Game.updateProjectiles` and `PhysicsSystem.js` refactored.

### rendering
- [x] **z-index draw order** - fixed: asteroids/crates now draw behind enemies and ship
- [ ] **starfield.js overhaul** - needs visual upgrade

### gameplay
- [ ] **level up system** - basically non-existent, needs implementation
- [ ] **biome system** - different room themes/visuals
- [x] **FIX: Room Transition** - "cant enter next room" bug (Synchronized save loading + Key format fix)

### persistence
- [ ] **save system overhaul** - asteroids and boxes should persist in same positions on restart

## 🎲 Content Expansion
- [ ] **More Room Types** - Puzzle/Challenge rooms
- [ ] **Rare Events** - Random encounters
- [ ] **Achievements** - Milestones
- [ ] **Daily Challenges** - Seeded runs
