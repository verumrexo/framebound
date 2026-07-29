# framebound code audit

date: 2026-07-25  
scope: the current working tree, including the in-progress `game.js` extraction and projectile-renderer restoration

> this is the point-in-time discovery audit. its line counts and test totals are
> intentionally historical evidence; use `ROADMAP.md` for current remediation
> status and verification totals.

## executive verdict

the common offline loop launches and is playable, the production bundle builds, and the current test suite passes. the three migrated entity crashes found by this audit are fixed and covered. projectiles, transient effects, loot drops, cursor rendering, debug rendering, pause control, audio loading, shot dispatch, lobby ownership, and protocol validation now have smaller tested seams.

the immediate multiplayer crash, hard-hang, room-loop leak, cap, handler, and malformed-payload risks are now contained. multiplayer is still not authoritative gameplay: clients can request shots and ship manifests that pass structural validation but are not yet derived from authoritative inventory, cooldowns, or muzzle state. the approved replacement is a host-authoritative peer-to-peer model, not a paid dedicated server. that remaining trust boundary belongs to milestone 5 and must not be mistaken for finished co-op.

the high-impact entity renderer regressions identified here have been restored from the historical implementation and checked on the live canvas. continue-save now generates the saved seed directly and hydrates it once, so the throwaway-world leak is fixed. the next biggest risks are the incomplete version-1 save model, room/entity ownership, gameplay parity, and the remaining visual-gallery coverage. room data is still split between room objects and global arrays.

## verified baseline

| check | result |
| --- | --- |
| full node test discovery | 89 passed, 0 failed |
| production vite build | passed; 139 modules transformed |
| main production chunk | 564.09 kb minified, 151.69 kb gzip |
| source diff whitespace check | passed |
| entity construction probe | drone, portal, and training dummy construct successfully |
| multiplayer integration | real socket.io clients pass lobby lifecycle and malformed-packet snapshot tests |
| browser smoke | entity gallery plus saved-run continue and pause/resume render with no browser errors |
| ci | github pages runs `npm ci`, `npm test`, and `npm run build` |
| `src/engine/Game.js` | 2,661 lines |
| tracked `src/engine/Game.js.bak` | 4,088 lines |

the duplicate biome suite and manual collision harness found by the initial audit have been consolidated into the canonical node test topology.

## remediation status

| finding | status |
| --- | --- |
| a-001 | contained: malformed and huge payloads are rejected or normalized; safe wrappers, rate limits, and integration tests are in place |
| a-002 | fixed: empty rooms are destroyed, switching is cleaned up, and lobby/player caps are enforced |
| a-003 | partially contained: manifests and shots are structurally validated, but full server-owned weapon authority remains open |
| a-007 | partially fixed: continue no longer creates a throwaway world and invalid saves fail cleanly; versioned room/progression hydration remains open |
| a-009 | high-impact paths restored and covered by renderer tests plus live canvas inspection; deterministic side-by-side galleries remain open |
| a-013 | improved: start/continue, room transition, pause, death, restart, malformed saves, and real socket clients now have focused coverage |
| a-012 | remote rendering, handler teardown, lobby event naming, and polling lifetime fixed; reconnect/full resync remains open |
| a-016 | fixed and covered by construction tests |

## approved multiplayer direction — 2026-07-25

`MULTIPLAYER.md` replaces the old dedicated-server destination:

- one player's game instance hosts the authoritative simulation;
- friends join by short code through webrtc;
- a small signaling service only connects peers and does not run gameplay;
- the current socket.io server remains temporary until the peer-to-peer path passes parity and migration tests;
- co-op gameplay rules remain separate approval decisions.

## approved desktop direction — 2026-07-26

`DESKTOP.md` defines the shipping experience:

- macos ships as a normal `.app` and windows as a setup `.exe`;
- players do not start a local server or open a browser;
- tauri 2 wraps the existing vite game instead of forking gameplay code;
- browser tests remain the fast regression path and `tauri dev` adds native-shell hot-reload checks;
- packaged builds are required at checkpoints and releases, not after every edit;
- desktop packaging must preserve the approved gameplay, controls, timing, visuals, and audio.

## severity

- **p0:** can crash or hang a run/server, block core progression, or cheaply exhaust server resources.
- **p1:** corrupts or diverges game state, breaks a normal progression path, or loses established visual/gameplay behavior.
- **p2:** makes future changes unsafe, creates lifecycle leaks, or leaves important behavior unverified.
- **p3:** maintenance, documentation, or performance debt without an immediate correctness failure.

## findings

### a-001 — p0 — malformed multiplayer packets can crash or hang the server

`src/server/GameRoom.js:84-129` accepts input, shot, and ship payloads without checking their type, size, ranges, or finite numeric values.

- `player_shoot(null)` dereferences `data.partId`.
- `join_game(null)` dereferences `data.parts`.
- a huge finite `aimAngle`, such as `1e308`, reaches the angle-normalization loops in `src/shared/entities/Ship.js:156-170`. subtracting `2π` no longer changes a number at that magnitude, so the loop can run forever and freeze the 60 hz room loop.
- malformed or enormous part manifests can reach unchecked ship-part construction.

there are no safe event wrappers, payload limits, event-rate limits, or malformed-packet tests.

### a-002 — p0 — lobby switching leaks permanent game loops

every `GameRoom` starts its own interval in `src/server/GameRoom.js:31-38`. create-lobby and join-lobby remove a socket from its previous room but do not destroy that room when it becomes empty (`src/server/server.js:38-68`). cleanup only happens on explicit leave or disconnect.

one client can repeatedly create or switch lobbies and accumulate empty 60 hz loops. lobby creation has no rate limit, and the advertised eight-player maximum is not enforced when joining.

### a-016 — p0 — three migrated entities crash when constructed

`Drone`, `Portal`, and `TrainingDummy` construct `new Sprite(...)` without importing `Sprite`:

- `src/shared/entities/Drone.js:37` is reached by player and enemy drone weapons from `src/engine/Game.js:1304` and `1359`;
- `src/shared/entities/Portal.js:10` is reached when a boss dies at `src/engine/Game.js:1539`;
- `src/shared/entities/TrainingDummy.js:24` is reached by the dev spawn action.

the production build does not catch unresolved runtime globals, and no test constructs these entities. the result is a `ReferenceError` when each path is used. the pre-migration entities imported `Sprite`; this is a mechanical restoration, not a creative change.

### a-017 — p1 — the multiplayer migration replaced the original movement contract

the historical offline path used a base acceleration of 2,000, a base speed cap of 800, level scaling, and a 2× out-of-combat movement boost. those values remain documented in `src/shared/Physics.js:1-6` and in commit `0598ee9`.

the active shared `Ship.update()` instead hardcodes:

- acceleration 2,500;
- speed cap 150;
- combat and level multipliers to 1;
- a separate dash state and force.

meanwhile `src/engine/Game.js:712-733` still owns and applies the original dash state before copying velocity into `Ship`, whose update applies dash again at `src/shared/entities/Ship.js:62-79` and `130-135`.

`Ship.update()` also applies `0.92`/`0.96` friction once per rendered update rather than scaling it by `dt`, while `GameLoop` runs updates through `requestAnimationFrame`. drag and acceleration balance therefore vary with refresh rate.

this is not a harmless refactor: acceleration, travel speed, cleared-room pacing, dash, and refresh-rate behavior are different. because movement feel is an explicit product constraint, the fix needs a measured current-versus-historical comparison, characterization tests, an in-game playtest, and confirmation before changing the live constants.

### a-003 — p1 — shooting and ship construction are client-authoritative

`src/server/GameRoom.js:96-131` trusts the client's `partId`, shot position, angle, timing, and complete ship layout.

the server does not prove that:

- the player owns or has installed the requested part;
- the part is a weapon;
- its cooldown has elapsed;
- the muzzle belongs to the player's current ship;
- the angle and position are finite and plausible;
- the player is alive;
- the submitted ship is connected, bounded, affordable, or composed of allowed parts.

the current server test in `src/server/GameRoom.test.js` calls this path authoritative while explicitly asserting that client coordinates are accepted. that test protects the bug.

ship state also only travels in the opposite direction once. `sendJoinGame()` is called during initial player creation at `src/engine/Game.js:269-271`; later hangar edits replace `playerShip` at `src/game/systems/Hangar.js:311` without an online ship-change protocol. even honest clients and the server therefore disagree after rebuilding.

### a-004 — p1 — online mode is two incompatible games running at once

online clients still generate and enter rooms locally (`src/engine/Game.js:425-445` and `881-907`). connection state only disables local enemy ai (`src/engine/Game.js:1473-1488`).

the client still owns or mutates projectiles, collision, bosses, drops, xp, gold, shops, chests, room locks, death, autosaves, and floor progression. the server independently activates rooms and runs a much smaller simulation. its snapshots do not define room state, boss state, pickups, chests, score, floor progression, or projectile lifecycle.

this creates unavoidable divergence:

- the server sends player hp, but `src/engine/NetworkManager.js:129-141` ignores local hp during reconciliation;
- dead enemies can disappear server-side without a final lifecycle message;
- the client emits `enemy_hit`, but the server has no matching handler;
- unknown enemies in snapshots are ignored instead of spawned;
- online room changes can overwrite the offline save through local autosave;
- reconnect marks the socket connected but does not rejoin a lobby or request a full resync.

### a-005 — p1 — server room activation cannot run the full campaign

the server passes `GameRoom` into client-oriented `Room.onEnter()` at `src/server/GameRoom.js:172-175`, but `GameRoom` does not implement the context that room scripts require.

examples in `src/game/environment/Room.js`:

- shops push into `game.shopItems`;
- treasure rooms push into `game.treasureChests`;
- boss and vault flows call `game.showNotification`;
- rewards and special-room interactions expect other client-only arrays and methods.

the server does not update or broadcast bosses, portals, shops, chests, rewards, or floor transitions. normal co-op progression therefore cannot be authoritative or complete.

### a-006 — p1 — server weapon behavior does not match the game

`src/server/GameRoom.js:96-120` creates one simplified projectile per request. the active client weapon path in `src/engine/Game.js:2636-2680` applies pellets, spread, offsets, speed modifiers, delays, and special projectile behavior.

the server also:

- treats beams like point-circle projectiles instead of line/beam collisions;
- removes expired projectiles without rocket aoe, cluster children, or other on-death behavior;
- does not replicate projectile state;
- uses random projectile motion independently on each process.

`src/shared/entities/Projectile.js:9` accepts an injected random source, but constructor paths at lines 14 and 59-66 still call `Math.random()` directly. seeded client/server generation is therefore not deterministic.

### a-018 — p1 — projectile behavior disagrees across collision paths

projectile behavior is encoded by repeated type-string lists rather than one definition. `src/shared/entities/Projectile.js:26-38` and `87-154` recognize the rocket and grenade families, but collision branches in `src/game/systems/ProjectileSystem.js:28-223` often set `shouldExplode` only for literal `rocket`, or for a different partial subset.

as a result, `rocket_le`, `rocket_he`, guided rockets, `ggbm`, and grenade variants can explode on timeout but disappear without the matching aoe when they hit particular targets. aoe radius at `src/game/systems/ProjectileSystem.js:440-442` is another hardcoded partial type map and ignores part-level `aoeRadius`.

the visual variants are restored; their gameplay definitions still need one canonical projectile-spec table and parity tests for impact, timeout, shield, enemy, boss, asteroid, crate, and shipwreck collisions.

### a-007 — p1 — continue-save hydrates the wrong world

`src/game/ui/MainMenu.js:593-607` calls `startOffline(undefined, true)` and then `loadFromSave()`. `src/engine/Game.js:244-253` ignores `isLoad`, creates a random seed, enters that world, and populates its start room. `loadFromSave()` then regenerates the saved layout without clearing or rebuilding the already-live world arrays.

the result is a saved room graph paired with entities from the random start that was created immediately before it.

the version-1 save schema also:

- does not save or restore `floor`;
- reads `save.score`, but does not write `score`;
- does not preserve permanent level-up stats or restore `isTainted`;
- records only visited room coordinates, then restores every visited room as cleared and unlocked;
- does not preserve room entities, remaining enemies, pickups, opened chests, purchases, debris, or ambush state;
- has no migration path beyond deleting a version mismatch;
- calls `localStorage` without a guard in `SaveManager.hasSave()`, even though load failures are guarded.

### a-008 — p1 — room and entity ownership is inconsistent

rooms own metadata and some entity lists, while `Game` owns global arrays used by update and rendering. transition code at `src/engine/Game.js:881-901` clears asteroids, crates, shipwrecks, and explosions, but intentionally keeps pickups and orbs. shops, treasure chests, vault chests, portals, and other room-bound state are not handled consistently.

revisiting and teleporting can therefore leak entities between rooms or return to a room whose generated state cannot be reconstructed. this same ownership ambiguity is what makes save hydration and multiplayer synchronization brittle.

shipwreck lifetime has a related leak: `src/shared/entities/Shipwreck.js:261-330` removes destroyed parts but never marks an emptied wreck dead, while the active projectile loop only removes wrecks when `wreck.isDead` is set.

floor transition is directly incomplete too. `src/engine/Game.js:2463-2478` clears combat arrays but retains asteroids, loot crates, shipwrecks, item pickups, shops, and both chest collections before generating the next floor.

### a-009 — p1 — visual parity is not fully restored

the projectile renderer has been restored to the pre-migration visual language and now has focused tests for basic shots, lasers, rockets, beams, and grenades. the broader renderer migration is unfinished.

`src/game/renderers/EntityRenderer.js` still contains simplified or omitted paths:

- enemy weapon placement uses an approximation;
- enemy charge telegraphs are omitted;
- enemy health bounds are simplified;
- loot-crate detail is omitted;
- asteroid rendering is replaced with a simple filled polygon;
- drone rendering is minimal;
- gold and hp pickups are routed through the xp-orb renderer and lose their original coin/ring and rotating-cross identities;
- item drops lose their preferred base sprite, scale, glow, and fallback;
- the training dummy's name and dps overlay are gone;
- portals and some world entities use placeholder-style paths.

the pre-migration entity draw methods remain available in git history and should be used as the parity reference. tests can protect geometry and palette, but screenshots and playtesting are still required because a green unit suite cannot prove the original look or feel.

### a-010 — p2 — rendering mutates gameplay-facing state

`src/engine/Game.js:2018-2027` calls `update(0.016)` on shop items and chests from inside `draw()`.

their animation and any future stateful update behavior therefore depend on render frequency, continue while draw is called outside the normal update cadence, and are decoupled from the actual `dt`. updates belong in `update(dt)`; draw should be read-only.

### a-019 — p1 — two offered level-up upgrades currently do nothing

`src/game/systems/LevelUpManager.js:132-151` writes `velocityRateAdd` and `laserRateAdd` into permanent ship stats. the active cooldown calculation at `src/engine/Game.js:1004-1012` reads neither value.

the abandoned `WeaponSystem` contains the intended formula, but activating that entire stale class would introduce unrelated behavior. the active calculation should be covered and corrected directly, with a save/continue test for permanent upgrades.

### a-011 — p2 — `game.js` is smaller, but it is still the main risk surface

`src/engine/Game.js` remains a 2,728-line owner of mode lifecycle, player movement, weapons, rooms, physics, interactions, economy, progression, ui, networking glue, and most entity updates. it has 41 imports, over 100 instance properties, a 1,466-line `update()`, and a 532-line `draw()`.

the constructor initializes several fields more than once:

- player position and velocity at lines 106-110 and 212-219;
- explosions and notifications at lines 71-72 and 226-227;
- score, floor, level, and game-over state in multiple blocks.

`src/game/systems/PhysicsSystem.js`, `PlayerController.js`, and `WeaponSystem.js` exist but are not imported by the active game. they are stale alternatives, not safe drop-in extractions. `WeaponSystem` even decrements a stagger timer twice in one update path. the canonical behavior is still the inline implementation in `Game.js`.

some new modules are only file-level extractions, not ownership boundaries. for example, `ProjectileSystem` keeps the entire `Game` object and invokes extracted code with `updateProjectiles.call(this.game, dt)`. that is still useful as an intermediate seam, but it should not be mistaken for decoupled architecture.

future extraction must start with characterization tests and move the active code, not wire in these abandoned classes because their names look convenient.

### a-012 — p2 — remote-player presentation and network lifecycle are incomplete

`src/engine/Game.js:2011-2015` renders remote players through the generic ship renderer instead of `RemotePlayer.draw()`, dropping remote-specific presentation such as its health bar. because `drawShip()` defaults its missing target to `(0, 0)`, remote turrets also aim at world origin. reconnect does not rejoin or resync, old room-specific socket handlers are not removed, and revisiting rooms can stack duplicate handlers.

the server emits `lobby_list_update`, while the client listens for `lobby_list`. the main-menu connection poll at `src/game/ui/MainMenu.js:359-369` has no timeout or teardown.

### a-013 — p2 — tests protect seams, not the game loop

the newly extracted modules have useful focused tests, but important behavior has no integration coverage:

- game construction, start, update, draw, pause, death, and next-floor lifecycle;
- movement, boost, collision response, recoil, cooldown, spread, and burst timing;
- save/continue hydration;
- room enter, leave, revisit, teleport, and special-room flows;
- two-client lobby, combat, disconnect, reconnect, and resync;
- malformed multiplayer payloads and rate limits;
- renderer parity beyond projectiles.

the github pages workflow builds but does not test. there is no lint, type checking, coverage threshold, or browser smoke gate.

### a-014 — p2 — leaderboard trust is external and unverified

`src/game/systems/HighScoreManager.js` writes scores directly from the browser through a public supabase anon key. an anon key is not itself a secret, but the integrity of the leaderboard depends entirely on external row-level-security policies that are not represented or tested in this repository.

the client can submit arbitrary scores, and `clearScores()` attempts a broad delete. if the remote policies allow those operations, the leaderboard is forgeable or destructively writable. this needs an explicit rls review or a trusted server submission path before scores can be called authoritative.

### a-015 — p3 — repository and build hygiene are stale

- the production entry chunk is above vite's 500 kb warning threshold;
- dynamic imports for `Part.js` and `TreasureChest.js` cannot split because the same modules are statically imported elsewhere;
- `docs/archive/task2-historical.md` preserves the old malformed escaped roadmap as historical input; completed work moved to `ROADMAP.md`, and its unchecked creative ideas remain unapproved;
- readme and package versions disagree;
- a 4,088-line `Game.js.bak` is tracked beside the live file and can be mistaken for source;
- no single document currently defines the authoritative architecture or online/offline ownership boundary.

## what is already worth keeping

- the basic offline loop runs, even though movement parity still needs recovery.
- deterministic level generation already provides a useful seed boundary.
- collision utilities are shared and have direct tests.
- the current extraction batch creates useful transitional seams without redesigning gameplay.
- projectile visuals now have explicit palette and geometry regression tests.
- save loading handles corrupt json and storage-read failures without trapping the menu.
- the project installs and builds through the checked-in node package definition.

## constraints for all fixes

- preserve offline movement, controls, timing, visuals, balance, and overall feel.
- make renderer restoration match the historical game; do not redesign it.
- keep the game playable after every landed change.
- add characterization coverage before moving active gameplay logic.
- do not treat multiplayer policy choices as refactoring. shared versus individual loot, revive rules, death handling, and floor-transition ownership require explicit design approval.
- do not use passing unit tests as proof of visual or gameplay parity; run the game and inspect it.
