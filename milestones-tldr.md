# framebound milestones — the short version

updated: 2026-08-03

this is the human-readable project map. the detailed engineering contracts live
in [`ROADMAP.md`](ROADMAP.md). unfinished ideas remain in [`task2.md`](task2.md).

## status legend

- **done:** implemented and locally verified.
- **mostly done:** the important local work is finished; external or multi-device
  proof remains.
- **planned:** designed in the roadmap, but implementation has not started.
- **decision needed:** gameplay or creative rules require approval before coding.

## permanent project goals

- preserve framebound's original movement, controls, gameplay, visuals, and feel
  unless a change is discussed and approved first.
- keep the game playable after every meaningful change.
- keep breaking `game.js` and other god objects into focused owners instead of
  growing new piles of spaghetti.
- support new parts and mechanics through data, explicit systems, saves,
  multiplayer authority, rendering, audio, and tests together.
- keep all player-facing writing lowercase.
- make starting the game a normal double-click `.app` or `.exe` experience.
- keep browser development and hot reload for fast testing; rebuilding the native
  app is a release checkpoint, not the edit loop.
- use free host-authoritative peer-to-peer multiplayer with short join codes.
- keep private developer tools useful without turning them into player-facing
  clutter.
- ask before changing balance, encounter rules, rewards, progression, or other
  creative gameplay decisions.

## completed foundation

### milestone 0 — trustworthy baseline

**status: done**

made the original game reproducible and testable before the larger refactor.
restored missing entities, protected projectile identities, cleaned the test
topology, and established repeatable browser/build checks.

### milestone 1 — contain legacy multiplayer

**status: done**

stopped the old socket.io prototype from crashing or leaking rooms while its
replacement was built. added validation, limits, cleanup, rate protection, and
deterministic server tests. this is compatibility scaffolding, not the multiplayer
future.

### milestone 2 — restore visual parity

**status: done**

restored the entity and projectile presentation lost during the multiplayer
migration. player, enemy, boss, projectile, debris, chest, portal, pickup, drone,
and wreck visuals now have a deterministic gallery for regression checks.

important: this preserved the original art, but it did not solve the deeper
pixel-grid and diagonal-rotation problem. that is milestone 9.

### milestone 3 — saves and room ownership

**status: done**

rooms now own their debris, rewards, chests, shops, enemies, and encounter state.
save version 2 preserves exact room/run state, supports old-save migration, and
fixes disappearing debris, parts, and boss portals across revisits and continue.

### milestone 4 — make `game.js` an orchestrator

**status: done**

split session flow, room runtime, interactions, weapons, movement, enemies,
drones, hud, input, saves, and frame sequencing into focused tested systems.
`game.js` now connects owners instead of implementing the entire universe badly.

## large systems that are usable but not completely externally proven

### milestone 5 — host-authoritative p2p co-op

**status: mostly done; deferred external proof**

the game now hosts co-op from a player's machine and uses a free signaling service
only to introduce peers. the host owns gameplay outcomes; guests send input and
receive authoritative state.

implemented rules include:

- short-code host/join flow with no port forwarding;
- shared xp and gold;
- private ships, inventories, upgrades, and purchases;
- nearest-player pickups and enemy aggro;
- host-controlled pause and room progression;
- death, spectating, team wipe, reconnect, and boss-kill resurrection;
- guest movement, dash, weapons, shields, drones, enemies, rewards, and room state;
- four-player cap and no host migration.

still open:

- real packaged testing across two physical devices and difficult network types;
- optional turn-relay decision if direct connections fail too often;
- final public multiplayer parity proof.

this can wait until another device is available.

### milestone 6 — desktop apps

**status: mostly done; release polish deferred**

framebound has a tauri desktop shell and a locally built, ad-hoc-signed macos app.
windows packaging and launch checks exist in ci.

still open:

- packaged two-device multiplayer proof;
- hands-on windows gameplay smoke;
- public developer-id signing, notarization, and installer polish.

none of that blocks personal macos development.

### milestone 7 — hardening and release cleanup

**status: mostly done**

added coverage requirements, linting, checked javascript, source hygiene, content
security, native navigation restrictions, dependency auditing, bundle splitting,
version checks, and release workflows.

still open:

- external supabase policy verification;
- remaining public-release proof tied to milestones 5 and 6.

this is maintenance/release work, not the fun thing to do next.

## current gameplay release

### milestone 8 — arsenal: apotheosis

**status: done locally; human balance runs still needed**

turned ballistic, laser, missile, and drone equipment into real build families.
added family-aware level-ups, mechanical upgrade paths, enemy roles, balanced
starter packages, exact damage telemetry, separate weapon/utility buses, persistent
debris, improved hangar/pickup ui, and the cleared-room salvage laser sweep.

still open:

- long real runs to tune upgrade values, enemy weights, and late-floor balance;
- new player parts and drone variants;
- further enemy/content expansion after the supporting mechanics are designed.

the code foundation is ready for new mechanics. new parts still need their art,
mounting, behavior, authority, save, renderer, audio, and tests defined together.

## active and upcoming milestones

### milestone 9 — hard raster

**status: done locally**

replace browser-scaled canvas rendering with a deliberate pixel pipeline:

- separate world, native-resolution hud, and dom layers;
- assemble a ship before rotating it so connected parts stay connected;
- keep continuous 360-degree hull and turret movement;
- present the world through a webgl hard-pixel shader;
- fix device-pixel ratio, fractional resize, camera, and pointer mapping;
- leave hud, minimap, menus, and typography outside the shader;
- project enemy health bars, damage numbers, prompts, labels, and tooltips onto
  the native overlay without changing their world anchors;
- preserve gameplay, hitboxes, aiming, camera extent, and multiplayer state.

creative checkpoint: 3x was approved as the release pixel grid after the
normal-scale comparison.

implemented and locally verified:

- separate webgl world, native-resolution hud, and dom surfaces;
- authoritative resize, dpr, input, and camera-presentation math;
- whole-assembly ship caches with independently aimed turrets;
- shared rendering for local ships, remote ships, enemies, and bosses;
- nearest-only webgl2 compositor with context-loss and safe fallback coverage;
- deterministic 1x/2x/3x proof scenes at five continuous hull headings.
- an enforced dead-cells-style boundary: physical scene graphics use the world
  compositor; every informational ui element uses the native overlay or hud.

the obsolete graphics toggles and compatibility renderer were removed, patch
notes were updated, and the signed macos app passed artifact and launch checks.

### milestone 10 — signal forge

**status: core done; final sound coverage and sound design remain**

core implemented: a private offline jfxr sound laboratory in devtools:

- generate, mutate, tune, and preview sounds inside framebound;
- click apply, then click a visible part or semantic game event;
- hear the replacement on the next trigger without moving files or rebuilding;
- persist generated audio and bindings across restarts;
- provide undo, compare-default, restore, clipping protection, and spam tests;
- automatically expose sound capabilities from new part mechanics;
- promote an approved pack into deterministic release assets with one action.

the current audio audit already found requested sounds that never load, including
`overheat`, `reload`, `respawn`, and `click_short`. the milestone begins by
replacing scattered strings with one validated sound-event registry.

creative checkpoint: the tool accelerates sound design but never silently chooses
the final sound identity of a part, enemy, room, or event.

### milestone 11 — cursed vaults: blood contract

**status: implemented locally; live balance and two-device feel proof remain**

the old glowing chests and wall-clock waves are gone. the first cursed-vault
release now has:

- one exclusive gilded or blood contract; choosing one physically seals the other;
- linear shared-gold pricing or a survivable 28% payer-frame sacrifice;
- an eighteen-second simulation-time containment assault with co-op spawn scaling;
- a mechanical reliquary, contract terminals, pylons, gates, phase telegraphs,
  lowercase native hud, minimap states, and optional secondary eye candy;
- one stored unique three-part reward roll owned by the payer;
- exact payment, phase, participant, spawn, reward, claim, save, and reconnect state;
- semantic signal-forge slots for every important vault sound.

still needs human proof:

- real-run tuning of price, duration, enemy pressure, and reward value;
- a two-device payer/reconnect/claim playtest when another machine exists;
- future encounter variants only after their mechanics are approved.

## recommended next conversation

pick one:

1. **hard raster:** start the renderer evidence and world/hud split.
2. **signal forge:** start the audio-event audit and hot-replacement storage.
3. **cursed vaults:** make the contract, curse, ownership, encounter, and visual
   choices before implementation.
4. **new parts:** design their art and mechanics against the arsenal foundation.

milestones 5, 6, and 7 can remain parked until external hardware or public release
work matters again.

## detailed references

- [`ROADMAP.md`](ROADMAP.md) — full milestones, phases, gates, and failure cases.
- [`PARTS.md`](PARTS.md) — part families and requirements for new mechanics.
- [`MULTIPLAYER.md`](MULTIPLAYER.md) — approved co-op ownership and authority.
- [`SAVE_FORMAT.md`](SAVE_FORMAT.md) — save and room snapshot contracts.
- [`GAMEPLAY_PARITY.md`](GAMEPLAY_PARITY.md) — preserved movement and weapon
  behavior evidence.
- [`task2.md`](task2.md) — unfinished ideas and future feature backlog.
