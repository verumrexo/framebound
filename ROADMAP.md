# framebound recovery and refactor roadmap

date: 2026-07-25  
source: `AUDIT.md` and the current working tree

## current progress

completed on 2026-07-25:

- restored the missing sprite imports and added construction coverage for every affected entity;
- contained malformed multiplayer packets with bounded validation, constant-time angle normalization, rate limits, player/lobby caps, safe handlers, and clamped room timing;
- replaced the leaking lobby lifecycle with a tested room registry and testable server app;
- aligned lobby-list events, cleaned socket handlers, and bounded the menu's connection polling;
- restored the high-impact pre-migration entity visuals and remote-player rendering;
- verified projectile identities, including green basic shots and long red rockets, with renderer tests;
- added the full test suite to the github pages build, consolidated duplicate biome/collision tests, and documented the supported node/test command;
- passed 89 unique node tests, real socket.io integration tests, `git diff --check`, a production build, and live canvas smoke tests with no browser errors;
- approved host-authoritative peer-to-peer multiplayer as the replacement for the legacy dedicated socket.io server.
- fixed continue so it generates only the saved world and hydrates it once;
- reject incomplete or inaccessible saves before game hydration;
- extracted tested room-transition and game-over lifecycle owners from `Game`;
- smoke-tested saved-run continue plus pause/resume in the live browser.
- added the tauri 2 desktop shell, generated native icons from the existing logo, and bundled the existing game font for offline visual parity;
- built and launched a real macos `Framebound.app`, then verified `npm run desktop` and live page reloads without changing gameplay code.
- extracted shop, treasure, and vault input/reward ownership into a tested `WorldInteractionSystem`;
- made paid vault rewards idempotent so duplicate calls cannot create duplicate loot.
- moved tactical-map teleport cleanup into the tested `RoomTransitionSystem` instead of bypassing room ownership in `Game`.
- extracted floor generation and biome application into a tested `FloorProgressionSystem`;
- fixed floor warps leaking old asteroids, crates, shipwrecks, drops, shops, chests, tooltips, and damage numbers into the new floor.
- extracted item-pickup attraction, part collision, inventory rewards, rarity feedback, and cleanup into a tested `ItemPickupSystem`;
- passed 105 node tests, `git diff --check`, a production build, and a live menu/canvas smoke with no browser errors after the pickup extraction.
- moved portal activation and its exact trigger boundary into `FloorProgressionSystem`;
- removed the dead canvas-era pause handlers and made `PauseMenuController` own paused-frame blocking; live new-run pause/resume still passes;
- extracted xp, gold, and hp orb collection plus existing level-up math into a tested `ResourceOrbSystem`;
- made `NetworkManager` own remote-player interpolation and local-state publication instead of leaking that loop into `Game`.
- moved locked-room clamping and open-edge neighbor probes into the tested `RoomTransitionSystem` without changing the 30px boundary contract.
- fixed exact-center item attraction dividing by zero and corrupting pickup velocity with `NaN`;
- passed 119 node tests, `git diff --check`, and a production build after the room-boundary and pickup-stability batch.
- rewrote the stale `PhysicsSystem` from the active asteroid/crate implementation, then activated it behind exact collision-response tests;
- fixed exact-overlap asteroid and crate/asteroid collisions producing non-finite positions and velocity;
- passed 125 node tests, `git diff --check`, a production build, and a live dev-spawn asteroid/crate smoke with no browser errors after the physics extraction.
- extracted friendly/enemy hive spawning, drone caps, collision, and death cleanup into a tested `DroneSystem`;
- rejected invalid hive spawn geometry instead of constructing `NaN` drones;
- passed 130 node tests, `git diff --check`, a production build, and a live hive-carrier smoke that spawned and ran enemy drones with no browser errors.
- extracted offline enemy updates, remote interpolation, freeze behavior, separation, drops, boss death, score doubling, and portal creation into a tested `EnemyLifecycleSystem`;
- preserved the original boss reward order, including score doubling before same-frame enemy score is awarded;
- passed 140 node tests, a production build, and a live boss-kill smoke that displayed the level-up choices and `portal opened` feedback with no browser errors.
- rewrote the stale `WeaponSystem` from the active runtime and moved cooldowns, charge, stagger, ramp, burst, muzzle, and firing ownership out of `Game`;
- pinned the original charge carryover, rocket-bay burst timing, gamepad auto-fire, hangar click blocking, and intentionally different initial/burst muzzle offsets;
- passed 146 node tests, `git diff --check`, a production build, and a live starter-ship volley smoke that rendered the long red rocket with no browser errors.
- extracted dash timing/force, keyboard and joystick sampling, tracker/velocity aim, ship prediction, and network input publication into a tested `PlayerControlSystem`;
- extracted combat-only regeneration and player-state repair into focused owners;
- fixed infinite position, velocity, and rotation surviving the old `isNaN` guard and corrupting later frames;
- passed 158 node tests, `git diff --check`, a production build, and a live wasd movement smoke with visible speed change and no browser errors.
- moved projectile construction, rocket speed scaling, pellet spacing/delay, beam cadence, recoil, and shot audio into `WeaponSystem`, leaving `Game.spawnProjectile` as a compatibility delegate;
- passed 162 node tests, `git diff --check`, a production build, and a post-delegation live volley smoke that still rendered the starter ship's long red rocket with no browser errors.
- extracted room outlines/tutorials and the full world entity draw stack into a tested `WorldSceneRenderer`;
- pinned world draw order, remote-player fallback, mouse/gamepad turret targets, interaction tooltip arguments, and the final effects layer;
- passed 165 node tests, `git diff --check`, a production build, and a live asteroid/crate/chest scene smoke with correct presentation and no browser errors.
- extracted status bars, minimap/score/fps, dash and minigun indicators, virtual sticks, tooltips, game-over/name-entry overlays, notifications, level-up overlay, and cursor layering into a tested `HudRenderer`;
- reduced `Game.draw()` to loading guards, world presentation, and hud orchestration;
- passed 171 node tests, `git diff --check`, a production build, and live normal-hud, hangar, and pause overlay smokes with no browser errors.
- replaced anonymous window listeners with tested, disposable `GameInputBindings` while preserving separate gameplay/dev shortcut behavior;
- extracted offline/new-run/continue startup, local player construction, seed/world entry, and version-one save hydration into a tested `GameSessionSystem`;
- removed duplicate constructor resets and stale unused movement/pause-era fields without changing final initial state;
- passed 182 node tests, `git diff --check`, a production build, and live tactical-map, dev-tools, hangar, and post-session new-run smokes with no browser errors.
- fixed `Projectile` ignoring its injected random source for pellet speed and erratic rocket/grenade parameters, enabling repeatable seeded projectile state without changing offline distributions;
- moved network enemy-projectile construction and sound selection behind `ProjectileSystem`;
- passed 186 node tests, `git diff --check`, and a production build after the deterministic-projectile cleanup.
- rebuilt the cached tauri macos checkpoint in 29 seconds after the refactor;
- fixed the generated `.app` failing strict bundle-signature verification by ad-hoc signing the complete local bundle after packaging;
- verified the plist, strict bundle signature, sealed resources, application identifier, and packaged-app startup; public developer-id signing and notarization remain release work.
- added reproducible movement, weapon-rate, and projectile-family traces in `GAMEPLAY_PARITY.md`;
- proved the flattened projectile visuals came from migration but the inconsistent explosive-impact matrix predates multiplayer;
- measured the current 150-speed movement cap against pre-multiplayer behavior at 60, 120, and 144 hz, exposed the original per-frame damping bug and duplicate current dash ownership, and left all gameplay changes behind explicit approval gates.
- hardened version-one save validation against malformed parts, rooms, health, coordinates, and inventories before hydration;
- guarded save deletion so blocked browser storage cannot crash death, new-run, or invalid-save cleanup;
- made continue preserve score, floor depth, room count, biome, taint state, and permanent level-up stats, while inferring legacy max-hp upgrades where the old format contains enough evidence;
- fixed the pause menu claiming progress would be saved while never actually calling the save path.
- extracted exact room-frame ordering into `RoomRuntimeSystem` and moved fullscreen-map plus hangar/builder/level-up blocking flow into focused tested owners;
- removed the dead alternate `PlayerController` and tracked `Game.js.bak` after their movement and rendering evidence was captured in git history and `GAMEPLAY_PARITY.md`.
- fixed room-clear autosaves recording the cleared room before its +100 reward, which could permanently drop score after a reload.
- replaced fake-synchronous dynamic room imports with immediate shop, treasure, and vault construction, preserving counts, prices, positions, and rng while removing late-spawn races.
- cancelled delayed vault-wave callbacks when a floor or session replaces its rooms so old-floor enemies cannot spawn into the new world after cleanup.
- reset every run-scoped collection, ship, progression value, overlay, movement field, and biome before same-instance new-run or continue startup, eliminating stale-world carryover.
- mark shipwrecks dead when their final occupied cell is destroyed so empty 400px collision ghosts are removed by the active projectile lifecycle.
- made legacy network disconnect immediate and idempotent, preventing offline startup from rejoining the server and online-menu back from dereferencing a missing socket.
- stopped the settings slider animation timer on pause/menu teardown so escaping the settings screen cannot leave a permanent 60 hz background dom loop.
- guarded and validated audio-setting storage so blocked storage or non-finite saved volumes cannot abort game startup.
- made persistent devtools authentication fail closed when storage is blocked instead of crashing game construction.
- reset hangar and editor owners between same-app runs, preventing devtools infinite parts and stale editor overlays from leaking into a clean run.
- reset active devtools cheats and placement overlays between runs while preserving only the authentication preference.
- synchronized reset devtools checkboxes and spawn controls so the visible debug state matches the cleared runtime state.
- passed 214 node tests, `git diff --check`, and the production build after the lifecycle/storage batch.
- live-smoked online-menu back, pause-settings escape, save/menu/new-run, dev freeze, infinite-parts, and visible debug-control reset in one browser instance.
- added seeded floor-generation invariants for repeatability, grid ownership, route connectivity, boss/vault counts, and negative-coordinate lookup.
- documented that the floor generator ignores its requested room count and always produces the same 9–14-room route; changing floor pacing remains approval-gated.
- fixed loaded-audio fallback checks treating `Map` storage as a plain object, which double-played generic hit audio over real shield-hit audio.
- cancelled pending settings setup as well as its active interval, closing the escape-before-setup race that could resurrect the 60 hz ui loop.
- validated and clamped persisted cursor/game settings before they reach runtime state or settings html.
- escaped leaderboard names and scores before html rendering so direct public-database inserts cannot execute markup in the game menu.
- guarded every legacy client socket handler against malformed container types and non-finite position/shot data before touching game state.
- whitelisted remote-player snapshot fields and input axes before interpolation so forged timestamps or arbitrary server fields cannot poison smoothing state.
- filtered lobby rows, remote ship manifests, dead-enemy ids, part ids, and enemy interpolation fields before legacy client handlers consume them.
- moved protocol validation from the legacy server folder into `shared/` now that both client and server enforce the same boundary.
- bounded client world coordinates, speeds, and damage while normalizing every inbound rotation in constant time, blocking huge-angle hangs and negative-damage state corruption.
- pinned remote-player buffer limits, oldest/latest fallback, state carryover, and shortest-path rotation interpolation for the future p2p transport.
- documented room-clear autosaves occurring before xp/gold drop creation, which can restore a cleared room while deleting its pending rewards under save version 1.
- documented the version-one cleared-boss restore hard-lock: regenerated boss removal is not paired with exit-portal restoration.
- clear held keyboard, mouse, and touch state at session startup so the menu click or a stale joystick cannot move or fire on the first gameplay frame.
- documented the exact version-one checkpoint contract and its broken mid-combat pause-save boundary in `SAVE_FORMAT.md`; version-two behavior remains approval-gated.
- documented stacked same-frame level-ups overwriting earlier upgrade choices; granting every earned choice remains gameplay approval-gated.
- isolated leaderboard escaping from the supabase-backed menu module so its security regression test exits cleanly instead of keeping the node process alive.
- passed 227 node tests, `git diff --check`, the production build, and live online-menu, new-run, movement-input, pause/resume, and console-error smokes after the floor, audio, settings, leaderboard, client-protocol, and remote-interpolation hardening batch.
- extracted the complete active-frame simulation order and every existing early-return boundary into a tested `FrameRuntimeSystem`, reducing `Game.js` from 410 to 338 lines without changing input, movement, weapon, room, camera, or network timing.
- passed 231 node tests, `git diff --check`, the production build, and a live new-run, movement-input, pause, visible-canvas, and console-error smoke after the frame-runtime extraction.
- extracted connecting, uplink-waiting, world presentation, and native-resolution hud ordering into a tested `FramePresentationSystem`, reducing `Game.js` to 310 lines without changing draw order or visual settings.
- passed 234 node tests, `git diff --check`, the production build, and a live menu, new-run, pause, visible-canvas, and console-error smoke after the presentation extraction.
- rejected inherited fake part ids and non-finite geometry at the shared ship-placement boundary instead of letting editor/import data crash or corrupt the ship grid.
- reset the ship-builder tooltip, hover/ghost state, and turret-button presentation between runs, and removed its unnecessary delayed button binding.
- restored the ship editor's advertised `m: close` control, which had been unreachable because the editor paused the game before the tactical-map key guard, and blocked hangar/pause/map shortcuts from opening competing overlays while that editor is active.
- passed 237 node tests, `git diff --check`, the production build, and a live turret-toggle, `m`-close, visible-canvas, and console-error smoke after the editor/ship hardening batch.
- blocked gameplay shortcuts before a local ship exists and while pause, hangar, level-up, game-over, or editor state owns input, preventing main-menu `tab` crashes and competing modal overlays.
- passed the final 239-test suite against the exact source packaged into the current macos app.
- restored `task2.md` as the active idea and feature backlog after the user confirmed its unfinished items still matter.
- compared the shipped entity renderer paths with their pre-migration entity draw sources and restored the missing treasure/vault fallback borders.
- added a deterministic `?visual-gallery` proof surface covering player, enemy, remote player, boss bounds, projectile families, asteroid, crate, orbs, portal, pickup, wreck, chests, shops, drone, and training dummy without changing normal startup.
- visually inspected the rendered gallery at normal play scale with zero browser errors, confirmed normal menu startup still works, passed 240 node tests, `git diff --check`, and the production build.
- cleared milestone 2's local visual-parity exit gate.
- removed the unreliable native confirmation dialog from pause-menu return; the button now saves and returns directly.
- fixed hangar cloning silently dropping valid parts when ship-map insertion order was not core-outward.
- restored booster and accelerant module counting from their real part types, making equipped boosters enable dash again.
- restored the explicitly requested cleared-room `2x` acceleration and speed cap while retaining the current combat movement.
- made local and shared-server dash paths cooperate without applying client dash force twice.
- restored exact boss exit portals in new saves and repaired older visited-boss saves with a centered exit portal.
- removed the obsolete touch joysticks, touch hangar button, touch aiming/fire paths, and mobile ship-builder controls.
- passed 243 node tests and live-smoked hangar open/close plus direct pause-to-menu return without a dialog.
- gave rooms ownership of surviving asteroids, crates, wrecks, loose rewards,
  shops, and chests so revisits and map teleports restore the room instead of
  deleting its debris.
- shipped save version 2 with exact per-room and active-fight snapshots,
  deterministic rng continuation, player/weapon runtime state, strict snapshot
  validation, and in-memory migration for valid version-one saves.
- preserved ungenerated shop, treasure, and vault rooms across continue instead
  of restoring them as permanently empty arrays.
- rebuilt saved ships independently of map insertion order so valid connected
  layouts and weapon cooldown state survive continue.
- moved shop and chest animation updates out of rendering and onto real frame
  time without changing their drawing paths.
- passed 254 node tests, including real socket.io integration tests, after the
  room-ownership and version-two snapshot batch.
- added a bounded versioned p2p protocol, offline loopback transport,
  host-authority session, guest client, resume tokens, full resync, malformed
  packet strikes, and focused authority tests.
- added expiring short-code signaling, member-only offer/answer/ice relays,
  webrtc data-channel links, and a coordinator that keeps signaling separate
  from gameplay traffic.
- integrated host-owned guest movement and weapon intent, prediction-only guest
  frames, authoritative world reconstruction, and strict rejection of
  unapproved transition, interaction, and ship-edit rules.
- moved deploy urls and the public leaderboard key into validated vite
  environment configuration and made missing configuration fail closed.
- blocked peer-hosted runs from public score submission, because a player-hosted
  simulation is not a trusted leaderboard authority.
- split the supabase leaderboard client out of the main production chunk,
  reducing it from 578.31 kb to 407.05 kb minified.
- added coverage execution plus native macos/windows desktop artifact workflows;
  the first external github actions run remains required proof.
- added a bounded native desktop save backup under the stable application id;
  startup validates both copies and selects the newer valid webview/native save
  before constructing the game.
- fixed early ice candidates breaking real webrtc negotiation before the remote
  description arrived.
- passed a real two-browser session through short-code signaling, offer/answer,
  ice, direct data-channel connection, hello, full resync, guest input, host
  simulation, and authoritative snapshot return with zero console errors.
- passed a real disconnect/rejoin through the same code with the same player id,
  resume token, and preserved simulation position; extended the grace window
  from an impractical ten seconds to sixty.
- added host keepalive for active codes plus a signaling-only health mode,
  graceful shutdown, and a minimal container definition that excludes the
  desktop/gameplay server.
- documented the leaderboard as casual/untrusted, removed its unused bulk
  delete client, validated public rows and writes, and kept p2p scores disabled.
- removed the unreachable spatial hash and abandoned module hud, then added an
  import-graph gate while retaining the old physics module only as documented
  movement-parity evidence.
- rebuilt, ad-hoc signed, strictly verified, and launched the native macos app
  after adding the native save path.
- bounded unanswered joins and stalled direct negotiations, capped reconnect
  attempts, restored the legacy network facade after terminal peer failures,
  closed signaling sockets deterministically, and retried fire intent after
  temporary data-channel backpressure instead of silently losing it.
- made native desktop saves replace through a synced temporary file, recover a
  complete interrupted write, reject oversized replacements without destroying
  the previous save, and covered the file path with three rust tests.
- removed arbitrary javascript execution from pasted designer part code,
  replaced it with a bounded literal-only parser, and removed `unsafe-eval`
  from the browser/desktop content security policy.
- passed 307 node tests, the built-in coverage run, workflow yaml validation,
  release-version alignment, import-graph validation, three rust tests plus
  `cargo check`,
  production builds, real browser p2p smokes, and packaged macos startup after
  the p2p and release-hardening foundation.
- added a source-hygiene gate that syntax-checks every runtime module, forbids
  dynamic javascript execution, and verifies restrictive browser and native
  content security policies.
- pinned the release toolchain to node 22.12+ so the local and ci critical-code
  coverage thresholds use the same supported node flags.
- required at least 80% line, 60% branch, and 70% function coverage across the
  shared multiplayer protocol, host simulation, peer replication, save
  hydration, room snapshots, and peer connection owners; the current measured
  result is 88.04% lines, 74.23% branches, and 79.95% functions.
- added the source-hygiene and critical-coverage gates to both web and desktop
  github actions workflows; the first external pushed run remains required
  proof.
- restricted native top-level navigation to the packaged app origin and the
  exact local development server, preventing remote pages from replacing the
  game inside its save-capable webview.
- made the critical-coverage include globs portable across unix and windows
  shells instead of relying on single-quote behavior that `cmd.exe` does not
  implement.
- archive the macos ci app with `ditto` before artifact upload so executable
  permissions, resource metadata, and the verified bundle signature survive
  download.
- made boss-kill resurrection and final-team-wipe state converge immediately:
  the host flushes one last authoritative death snapshot before game-over can
  pause networking.
- replaced the player-facing legacy lobby-browser entry point with p2p
  **host game** and **join game** flows; hosts wait with a short code and both
  sides start only after authoritative synchronization.
- disconnect peer sessions when backing out of online setup or returning to the
  main menu, instead of leaving signaling and direct links alive behind the ui.
- passed 323 node tests, the 88.13% critical-line coverage gate, source hygiene,
  import/version checks, production build, strict macos signature verification,
  and packaged-app startup after the death-convergence batch.
- removed the unreachable legacy lobby browser, direct-server input, polling
  timers, and callbacks from `MainMenu`; the legacy socket transport remains
  only as a contained test/migration fallback.
- fixed `aimAngle: null` being coerced to zero by shared ship movement, which
  made slow ordinary ships rotate north instead of holding their heading.
- contained oversized authoritative snapshots and data-channel close/send
  races at the host-session boundary so one peer cannot throw through and crash
  the host simulation frame.
- moved shared menu-button styling out of replaceable menu markup so the p2p
  and patch-note screens cannot fall back to browser-default controls.
- refreshed the current patch notes, rendered every historical entry in
  lowercase, and kept version/date headers readable without changing gameplay.
- passed 331 node tests, the critical coverage gate, source hygiene, import
  audit, production build, rendered browser checks, strict macos signature
  verification, and packaged-app launch/quit after the menu and patch-note
  cleanup.
- added a bounded native two-instance smoke bridge that accepts only host/guest
  roles, validates join and resume values, and writes diagnostics only beneath
  the system temp directory.
- disabled macos webview background suspension after packaged proof showed the
  host stopped processing signaling when the guest took focus.
- proved two packaged macos instances reach signaling and exchange offer,
  answer, and server-reflexive ice candidates. the final same-mac data channel
  remains blocked with no local host candidate; the timeout is consistent with
  this router lacking a nat hairpin path. a second device or optional turn relay
  is still required for the native parity gate.
- implemented the approved co-op ownership contract: shared xp and gold,
  buyer-owned shop rewards, private builds and inventories, nearest-player
  pickups and aggro, team transitions, host pause, four-player cap, host
  departure, individual spectating, team wipe, and boss-kill resurrection.
- extended the original ship simulation to guests without changing its values:
  booster dash, cleared-room speed, regeneration, asteroid and crate
  collisions, weapons, shields, and hive modules now run through host
  authority for every player.
- gave friendly drones a persistent player owner, made them follow the ship
  whose hive deployed them, and made enemy drones target the nearest living
  player.
- queued a bounded set of ordered guest interactions and ship edits when the
  reliable data channel reports temporary backpressure, instead of silently
  losing purchases, chest actions, or hangar changes.
- contained webkit data-channel send/close races inside the transport and route
  unexpected channel loss through the bounded guest reconnect path instead of
  crashing or leaving a frozen connected session.
- replaced the windows native save delete-then-rename path with a backup,
  replace, and restore-on-failure sequence; startup also recovers a complete
  leftover backup when both the primary and temporary files are missing.
- routed host map fast-travel through the same authoritative team movement as
  room exits, preventing peers from being left at stale world coordinates.
- separated charged-weapon telegraph noise from enemy gameplay rng and routed
  every enemy weapon spread through the injected source, removing a host
  framerate dependency from authoritative combat.
- replaced direct loot-scatter and cluster-child randomness with injected
  system boundaries while preserving the existing default distributions.
- stopped enemy and boss ai on the targetless final team-wipe frame, preventing
  undefined player coordinates from corrupting authoritative enemy state before
  the death snapshot.
- made health orbs heal the player who collects them and made shared xp issue
  one host-validated private upgrade choice to every player, keeping the shared
  simulation paused until the connected crew has selected.
- ignored the local pnpm package-store cache and added a platform-aware desktop
  artifact verifier that checks macos bundle identity, version, executable
  permissions, mach-o format, and icon plus windows nsis filename, size, and
  portable-executable header before ci upload.
- passed 376 node tests including real localhost signaling/socket.io cases,
  source hygiene across 110 runtime modules, import-graph and whitespace
  checks, a 173-module production build, strict macos signature verification,
  and packaged-app launch/quit after the approved co-op parity batch.
- narrowed leaderboard reads to the two displayed columns and rejected
  malformed or unsafe-integer public scores before they reach menu code.
- replaced the custom-seed and developer keypad inline handlers that the
  browser and native content security policies blocked with normal event
  bindings, then extended source hygiene to reject inline html handlers.
- made rust compiler warnings fail native shell builds without adding another
  package or changing game code.
- passed 378 node tests, the 87.85% critical-line coverage gate, source
  hygiene, import and whitespace checks, a real custom-seed browser click with
  no console errors, eight rust tests, a 173-module production build, strict
  macos signature verification, and packaged-app launch/quit after the keypad
  and leaderboard hardening batch.
- cleared the run-active flag when pause-menu return stops the game loop,
  preventing tab, escape, or map shortcuts from reopening stale gameplay ui
  behind the main menu.
- re-passed all 378 node tests and the critical coverage gate, then verified an
  isolated new-run, pause, main-menu, and stopped-shortcut sequence in a real
  browser with no leaked overlays or console errors.
- contained synchronous host/join startup exceptions and broken coordinator or
  signaling cleanup inside `PeerNetworkManager`, always restoring the legacy
  network facade instead of throwing through the menu click.
- released the provisional paused run when host creation fails immediately,
  leaving the online screen usable for another attempt.
- passed 381 node tests and the 87.94% critical-line coverage gate after the
  online startup and cleanup failure batch.
- released provisional host state when signaling closes asynchronously before
  a code exists and contained secondary signaling teardown failures inside the
  same close boundary.
- passed 383 node tests and the 87.99% critical-line coverage gate after the
  asynchronous host-close cleanup batch.
- cleared stale guest host identity after a failed direct link, gave every
  signaling retry a fresh join timeout, and made reconnect rejection or
  exceptions terminate cleanly instead of waiting forever.
- passed 384 node tests and the 88.04% critical-line coverage gate after the
  bounded reconnect batch.
- cleared host authority state and canceled suspended-player expiry timers when
  the host session ends, instead of retaining dead simulations for the reconnect
  grace window.
- contained guest hello-send and host authority-attachment failures inside the
  connection coordinator, preserving bounded retries and keeping one rejected
  peer from ending the host session.
- passed 388 node tests and the 88.47% critical-line coverage gate after the
  host-session lifecycle batch.
- added a bounded guest authority-ready deadline after the direct data channel
  opens; missing or invalid full state now reaches the existing retry path
  instead of leaving the join screen synchronizing forever.
- passed 389 node tests and the 88.40% critical-line coverage gate after the
  authority-ready timeout batch.
- activated the existing ping/pong protocol as a pause-safe host heartbeat and
  added a guest authority watchdog, so silent half-open links enter bounded
  reconnect instead of freezing indefinitely.
- pinned delayed pong handling, dropped snapshots, out-of-order snapshots, and
  stale watchdog callbacks with deterministic fault tests; newer host ticks
  always win and healthy replacement timers cannot be killed by old callbacks.
- passed 392 node tests and the 88.98% critical-line coverage gate after the
  silent-link and deterministic network-fault batch.
- fixed the release-version gate so the redesigned readme badge and equivalent
  node-version wording stay aligned without restoring stale banner copy.
- added correctness-focused eslint, a strict checked-javascript boundary for
  part definitions, runtime part-library validation, and regression tests that
  reject corrupt definitions before a run starts.
- updated vulnerable development and network dependencies through compatible
  versions; the complete npm audit now reports zero known vulnerabilities.

- github actions run `30706641165` proved the clean-install, test, coverage,
  source, native-save, and macos/windows artifact gates on 2026-08-01.

## objective

recover the original framebound cleanly: preserve the offline game, restore anything flattened by the multiplayer migration, make failures reproducible, and then reduce `game.js` one proven boundary at a time.

multiplayer work is split into two categories:

1. containment and correctness work that does not choose new gameplay rules;
2. authority decisions that need approval because they define co-op behavior.

## approved multiplayer architecture

the destination is peer-to-peer host authority, documented in `MULTIPLAYER.md`.

- one player's game instance hosts the authoritative session;
- friends join with a short code over webrtc data channels;
- a tiny signaling service only introduces peers and does not run gameplay;
- no paid, always-running framebound game server is required;
- the current socket.io server is a temporary migration and test harness, not the shipping architecture;
- the co-op contract is approved; implementation and parity proof are tracked
  in milestone 5.

## approved desktop target

the shipping target is a normal double-clickable macos `.app` and windows `.exe`, documented in `DESKTOP.md`.

- use tauri 2 as a thin shell around the existing vite game;
- players do not start a server, open a browser, or follow a localhost link;
- offline play works with no network connection;
- online host/join lives inside the app and uses the approved peer-to-peer architecture;
- browser tests remain the fast regression surface, while `tauri dev` covers the native shell with hot reload;
- installable artifacts are built at checkpoints and releases, not after every source edit.

## rules of the road

- every change ends with a playable build.
- one ownership boundary moves at a time.
- current behavior gets a characterization test before extraction so accidental changes are visible.
- the last known pre-migration offline behavior and visuals are the parity reference; the current build does not get to redefine the original by accident.
- renderer changes require a visual comparison, not just unit tests.
- no balance, movement, controls, effects-density, content, or economy redesign is implied by this roadmap.
- dead modules are evidence, not architecture. active code is the source of truth.

## release gate used after every batch

1. run the focused tests for the changed boundary;
2. run the full node suite;
3. run `git diff --check`;
4. run the production vite build;
5. launch the real game and smoke the affected path;
6. compare movement, weapon timing, controls, audio, and visuals when the batch can touch them;
7. for networking, run a two-client test plus malformed-packet cases.
8. once the desktop shell lands, run `tauri dev` for wrapper-sensitive batches and packaged-app smoke at release checkpoints.

## milestone 0 — freeze a trustworthy baseline

goal: make the current playable state reproducible before changing another major owner.

addresses: a-013 and a-016.

### work

- restore the missing `Sprite` imports for drones, portals, and training dummies, then add construction tests for all three.
- review and checkpoint the current extraction batch as one coherent change.
- keep the restored `ProjectileRenderer` and its palette/geometry tests.
- add tests to the github pages workflow before deployment.
- consolidate duplicate biome and collision suites into one test topology.
- document the supported node version and one canonical command for tests.
- add small game-harness helpers so lifecycle tests do not need a real browser for every assertion.
- keep the original idea backlog active in `task2.md` while tracking approved technical execution in this roadmap.

### exit gate

- clean install, tests, and production build pass in ci;
- offline start, one room transition, pause/resume, death/restart, and continue-menu paths are smoke-tested;
- drone weapons, boss death/portal creation, and training-dummy spawn no longer throw;
- the working tree contains no accidental generated package store or test-created dependency stubs.

## milestone 1 — contain legacy multiplayer failures

goal: keep the current socket.io prototype from crashing, hanging, or cheaply exhausting its process while the peer-to-peer replacement is built. this is safety work, not the final architecture.

addresses: a-001, a-002, part of a-012.

status: cleared locally on 2026-07-25; replacement architecture remains milestone 5.

### work

- define schemas for every inbound socket event.
- reject null, non-object, oversized, non-finite, and out-of-range fields.
- normalize angles in constant time before they reach ship logic.
- cap part counts, coordinate ranges, string lengths, lobby count, and players per lobby.
- rate-limit lobby creation, joins, input, shots, and other client events.
- wrap socket handlers so one bad payload cannot escape into the room loop.
- destroy a previous room immediately when lobby switching leaves it empty.
- make handler registration idempotent and remove old handlers on room changes.
- align `lobby_list` event names and add polling timeout/teardown.
- clamp server `dt` so an event-loop stall cannot launch physics into orbit.
- add fuzz-style malformed-packet tests and deterministic room-leak tests.

### exit gate

- null, huge, repeated, and malformed events cannot throw or stall;
- repeated lobby switching leaves no empty room intervals;
- the eight-player limit is enforced;
- valid existing clients still connect, move, and shoot with unchanged feel.

## milestone 2 — restore visual parity completely

goal: remove the remaining simplified migration renderers and preserve the original presentation.

addresses: a-009 and the visual part of a-012.

status: cleared locally on 2026-07-27 with command tests and the deterministic visual gallery.

### work

- compare every current `EntityRenderer` path with the last pre-migration entity draw method in git history.
- restore enemy weapon placement, charge telegraphs, health bounds, and boss-specific presentation.
- restore loot-crate geometry and detail.
- restore asteroid silhouettes, line work, color variants, rotation, and damage presentation.
- restore drones, shipwrecks, portals, gold/hp pickups, item drops, shop items, chests, and remote-player presentation where the migration lost behavior.
- keep entity update and renderer code separate while preserving exact output.
- add renderer-command tests for stable geometry/palette contracts.
- create deterministic visual-gallery states for side-by-side browser inspection.

### exit gate

- no placeholder, `simplified`, `omitted`, or `needed` renderer comments remain for shipped entities;
- visual galleries match the historical reference at normal play scale;
- all projectile types remain distinct;
- normal gameplay smoke confirms no draw-order, camera, cursor, or ui regression.

## gameplay parity checkpoint — approval before behavior changes

goal: recover bounded gameplay behavior lost or disconnected during migration without inventing new balance.

addresses: a-017, a-018, and a-019.

### work

- make one projectile-spec table own family membership, impact behavior, aoe, lifetime, speed, and deterministic randomness.
- compare every rocket and grenade variant's current impact/timeout behavior with the pre-migration implementation.
- present the exact behavior differences before changing live damage or aoe.
- make `velocityRateAdd` and `laserRateAdd` affect the active cooldown formula, using the historical formula as the reference.
- capture deterministic current and historical movement traces: acceleration, time to speed cap, held-input drag, coast decay, cleared-room travel, turn response, and dash distance at 60, 120, and 144 hz.
- present those movement differences and confirm the parity target.
- restore the approved movement contract and make one object own dash state.

### exit gate

- every projectile family has impact, timeout, shield, enemy, boss, asteroid, crate, and wreck tests;
- level-up rate choices produce the documented cooldown change and survive save/continue;
- movement, dash, and cleared-room travel match the approved historical reference in traces and playtesting;
- no unrelated weapon balance or movement redesign sneaks into the batch.

## milestone 3 — repair save and room ownership

goal: make a room a coherent piece of state that can be entered, left, revisited, saved, and restored.

addresses: a-007, a-008, and a-010.

status: cleared locally on 2026-07-28 with version-two exact snapshots and
version-one migration.

### work

- stop `continueGame()` from generating a throwaway random world.
- define an explicit load flow: validate save, generate saved seed, hydrate room state, hydrate player state, enter current room, then start simulation.
- define a version-2 save schema with migration from version 1.
- save floor and score consistently.
- preserve permanent level-up stats and the tainted-run flag.
- preserve separate room flags for visited, cleared, locked, ambush, purchases, and opened rewards.
- give each room authoritative ownership of its room-bound entities.
- expose one room-runtime API that activates, suspends, serializes, and restores those entities.
- make transition, revisit, teleport, death, and next-floor paths use that API.
- clear or transfer every floor-scoped collection explicitly during `nextLevel()`.
- move shop/chest updates out of `draw()` and use the real `dt`.
- guard all storage access, including `hasSave()`.

### characterization tests before implementation

- save and continue in the start room, a combat room, shop, treasure room, vault room, and boss room;
- reload preserves seed, floor, score, player build, hp, inventory, room, and cleared/opened state;
- revisit and teleport do not leak old-room entities;
- invalid and old saves fail or migrate without trapping the menu.

### exit gate

- continue restores one coherent world with no throwaway entities;
- room-bound objects never appear in the wrong room;
- save version 1 has a documented migration or a deliberate, user-approved retirement path;
- offline movement, combat, rewards, and room pacing are unchanged.

## milestone 4 — turn `game.js` into an orchestrator

goal: reduce ownership safely after state and room boundaries are stable.

addresses: a-011, a-013, and the remaining part of a-010.

status: cleared locally on 2026-07-27; `Game` now composes and sequences focused owners.

### extraction order

1. **session state:** menu, loading, offline, online, paused, game over, and transitioning.
2. **world runtime:** active room, room-bound collections, floor lifecycle, and save hooks.
3. **interaction system:** shops, treasure chests, vault chests, portals, and prompts.
4. **weapon runtime:** port the active inline cooldown, burst, stagger, recoil, spread, and projectile-dispatch behavior behind tests.
5. **movement/environment physics:** port the active ship, wall, asteroid, crate, and debris behavior behind feel-sensitive tests.
6. **drone and enemy lifecycle:** ownership, death, drops, and cleanup.
7. **hud renderer:** minimap, bars, module cooldowns, notifications, and overlays.

### implementation notes

- keep the rewritten active `PhysicsSystem` and `WeaponSystem`; the stale alternate `PlayerController` has been removed.
- remove duplicate constructor initialization as each owner is introduced.
- keep `Game` responsible for sequencing owners, not implementing their internals.
- do not chase an arbitrary line-count target. the end state is successful when ownership is obvious and integration paths remain readable.
- `Game.js.bak` has been removed after historical renderer and behavior references were captured.

### exit gate

- `Game.update()` and `Game.draw()` read as orchestration;
- every extracted owner has focused tests plus at least one integration test through `Game`;
- movement, boost, recoil, cooldown, burst timing, collisions, camera, and draw order match the baseline;
- each extraction is independently playable and revertible.

## milestone 5 — build host-authoritative peer-to-peer multiplayer

goal: replace split-brain multiplayer and the paid-server assumption with one versioned shared simulation hosted by a player's game instance.

addresses: a-003 through a-006 and the rest of a-012.

status: protocol, host authority, signaling, direct webrtc, reconnect, and real
two-browser round trips are locally verified. the host/join-code menu now uses
that p2p path instead of the legacy lobby browser. the approved co-op contract
is implemented and covered locally, including private builds and purchases,
team transitions, host pause, guest movement/combat parity, drone ownership,
nearest-player aggro, death/spectating, and boss-kill resurrection. health orbs
heal their collector, and shared xp now gives every player a private upgrade
choice while the team waits. a public signaling deployment url and
second-device packaged route proof remain open. the free render signaling
service is live and its public health, host, join, and relay smoke passes.

### protocol foundation

- version messages and define spawn, despawn, snapshot, hit, death, room-state, reward, full-resync, and error events.
- attach host simulation ticks and guest input sequence numbers.
- acknowledge inputs so reconciliation can replay only unprocessed commands.
- make reconnect rejoin the host session and request a complete authoritative snapshot.
- keep the protocol transport-independent so offline loopback, temporary socket.io tests, and webrtc use the same messages.

### shared simulation

- host derives installed weapons from the validated ship.
- ship edits use a validated host protocol and resync every peer instead of replacing local state silently.
- host derives muzzle positions, aim constraints, cooldowns, pellets, spread, beams, rockets, explosions, clusters, status effects, and damage.
- remove stray `Math.random()` calls from deterministic entities and inject a scoped random source.
- host owns enemy, boss, projectile, pickup, chest, room-lock, reward, death, and floor state.
- online clients predict local movement and presentation only; authoritative corrections decide outcomes.
- keep offline mode on the same shared simulation primitives without requiring a network connection.

### peer connection

- use a host-and-guests webrtc data-channel layout.
- add a replaceable signaling adapter for short-lived join codes and offer/answer exchange.
- use stun for direct connectivity and report a clear failure when a direct route cannot be established.
- do not require a paid turn relay for the zero-cost first version.
- expire abandoned signaling sessions and never store authoritative game state there.
- replace the lobby browser with explicit **host game** and **join game** flows.
  (implemented; production builds use the deployed render signaling url.)
- keep the legacy socket.io transport only until peer-to-peer parity and migration tests pass.

### tests

- two real peers, first through the browser harness and then through desktop app instances, hosting, joining, moving, fighting, changing rooms, disconnecting, and reconnecting;
- forged weapon, position, cooldown, ship, reward, and death packets are rejected;
- beam, rocket, grenade, freeze, pellet, and burst results match the shared offline behavior;
- full resync reconstructs the same visible world on both clients.
- latency, jitter, dropped packets, strict-nat connection failure, and host departure have explicit tested outcomes.

### design checkpoint

the co-op contract is approved in `MULTIPLAYER.md`, including collector-owned
health orbs and individual upgrade choices from shared xp.

### exit gate

- the host process owns every gameplay outcome;
- client prediction cannot create rewards, damage, weapons, or progression;
- both peers converge after normal latency, packet loss, and reconnect;
- host and join work through short codes without port forwarding or a paid game server;
- approved co-op rules are documented and tested.

## milestone 6 — ship desktop apps

goal: make starting framebound a double-click instead of a tiny sysadmin exercise.

status: the local arm64 macos app is built, ad-hoc signed, structurally and
strictly verified, and launch-smoked. windows artifact structure is now enforced
on its native ci runner, and a bounded launch/quit smoke executes the real
windows binary there. packaged two-instance multiplayer, native windows gameplay
smoke, public signing, and notarization remain open.

### work

- scaffold a thin tauri 2 shell without forking game code.
- make desktop development use vite hot reload through `tauri dev`.
- define stable native save paths and migrate existing browser saves only when a safe migration is designed.
- verify input, focus, fullscreen, high-dpi rendering, audio, and window lifecycle on macos and windows.
- verify offline startup and two-instance webrtc host/join in packaged apps.
- add os-specific ci jobs for macos and windows artifacts.
- configure application identity, icons, signing, macos notarization, and windows installer metadata.
- keep the browser build available for fast regression tests and web preview.

### exit gate

- a player can install and launch framebound without a terminal, browser, or local server;
- `.app` and setup `.exe` artifacts pass their native-os smoke suites;
- offline saves survive restart and upgrades;
- desktop multiplayer passes the same authority and resync gates as the browser harness;
- movement, controls, timing, visuals, audio, and gameplay match the approved baseline.

## milestone 7 — hardening and release cleanup

goal: make the stable architecture cheap to maintain and honest to ship.

addresses: a-013 through a-015.

status: critical coverage, source hygiene, content security, native navigation,
version alignment, environment configuration, bundle splitting, import cleanup,
artifact validation, correctness linting, gradual checked javascript, runtime
dependency auditing, and architecture docs are implemented locally. the
existing release gates passed github actions run `30706641165`; external
supabase policy proof remains open.

### work

- add linting and a lightweight type-safety strategy, either checked jsdoc or a gradual typescript boundary.
- keep new part mechanics behind typed definitions, focused runtime owners, host authority, persistence, rendering, and parity tests as documented in `PARTS.md`.
- track coverage for shared simulation, save hydration, and network protocol code.
- verify supabase rls externally; move score submission behind a trusted server if scores are meant to be authoritative.
- configure deploy-specific urls and public keys through environment files with documented examples.
- split the main bundle only after ownership boundaries make useful chunks possible.
- reconcile package, readme, menu, and release versions.
- remove dead modules, stale backups, and obsolete comments once their useful history is captured.
- document the final offline and online architecture.

### exit gate

- ci runs tests and build on every change;
- no critical behavior relies on undocumented external policy;
- docs describe the code that actually ships;
- release smoke covers offline and two-client online play.

## milestone 8 — arsenal: apotheosis

goal: make parts, weapon families, level-ups, and enemy roles reinforce one
build system instead of behaving like unrelated stat buckets.

status: cleared locally on 2026-08-03 for framebound v1.2.0-beta. final balance
still depends on longer human runs, because a green test suite cannot tell us
whether floor six feels fun or like tax fraud.

### shipped foundation

- ballistic, laser, and missile upgrades now affect real cooldown and damage
  paths in offline and host-authoritative co-op simulation;
- level-up cards are filtered against each player's installed weapon families;
- ballistic pierce, laser chaining, and missile blast-radius evolution create
  distinct mechanical directions instead of three differently colored damage
  percentages;
- permanent arsenal stats migrate through old saves, room snapshots, and peer
  snapshots without deleting old runs;
- enemy hp and damage use separate long-run curves instead of doubling every
  floor;
- enemy bodies and tuning live in editable part blueprints, while room spawn
  selection lives in a separate roster module;
- interceptor, repair tender, and bulwark roles enter the roster gradually;
- devtools can spawn every new enemy independently for layout and behavior
  iteration;
- the repair tender has a visible repair pulse, and enemy body parts can be
  rearranged without rewriting its support behavior;
- patch notes, hangar telemetry, automated gates, live browser checks, and the
  signed macos bundle identify the release as `arsenal: apotheosis`.

### next balance pass

- collect full-run damage, pick-rate, and death-floor data from real playtests;
- tune upgrade values and roster weights from those runs without changing the
  approved family identities;
- add new player parts only with their art, mount behavior, host authority,
  save schema, renderer, and focused mechanic test defined together.

## priority queue

the next concrete batches, in order:

1. restore the three missing entity imports and add construction tests;
2. multiplayer packet validation and room-loop cleanup;
3. full entity-renderer historical parity pass;
4. projectile, level-up, and movement parity checkpoint;
5. save/continue integration tests and load-flow repair;
6. room-runtime ownership;
7. one `game.js` extraction at a time;
8. add the thin tauri development shell and prove a local macos `.app`;
9. host-authoritative peer-to-peer multiplayer, after the co-op design checkpoint;
10. signed macos and windows release packaging after desktop multiplayer parity.

content ideas from `task2.md` remain active backlog. warp gates, mines, extra
drones, stealth, meta progression, balance changes, new rooms, achievements,
and daily challenges stay preserved and will be designed with the user before
implementation.
