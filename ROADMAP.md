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
- new runs choose a balanced ballistic, laser, or missile starter package and
  never roll a drone carrier;
- rocketle and lps now sit near the same ideal starter damage budget as three
  darts, while needlepoint pierces real debris and scales above common rarity;
- swarm hive is a real fourth combat family backed by data-driven drone
  blueprints, per-player ownership, and future-safe upgrade hooks;
- the cockpit separates weapon cooldowns, installed utility cooldowns, and
  exact per-part damage contribution instead of truncating new hardpoints;
- cleared rooms charge a host-authoritative five-second salvage system whose
  one-second clockwise laser sweep destroys remaining crates and asteroids;
- crates and asteroids produce stable destruction fragments that persist
  through room snapshots instead of rerolling glitter every rendered frame;
- the hangar, pickups, shops, treasure caches, and vault prompts use the current
  lowercase cockpit typography and more legible part telemetry;
- patch notes, hangar telemetry, automated gates, live browser checks, and the
  signed macos bundle identify the release as `arsenal: apotheosis`.

### next balance pass

- collect full-run damage, pick-rate, and death-floor data from real playtests;
- tune upgrade values and roster weights from those runs without changing the
  approved family identities;
- add new player parts only with their art, mount behavior, host authority,
  save schema, renderer, and focused mechanic test defined together.

## milestone 9 — hard raster

goal: replace the accidental browser-scaled canvas presentation with a deliberate
pixel renderer: continuously rotated assembled ships, a webgl world compositor,
and a completely independent native-resolution hud.

status: completed locally on 2026-08-08. the owner approved the 3x release pixel
scale after reviewing the normal-size 1x/2x/3x comparison. phases 9.0 through 9.6,
the complete automated gate, browser gameplay and live-resize smoke, signed macos
build, artifact verification, and packaged-app launch smoke all pass.

### problem being fixed

- `imageSmoothingEnabled = false` only controls image sampling. it does not make
  arbitrary canvas transforms, fractional camera coordinates, vector paths, or
  font rendering pixel-perfect.
- the current ship renderer rotates and positions every installed part
  independently. diagonal headings therefore place connected parts on different
  fractional pixels and create unstable edges and visible seams.
- the current `0.6` camera zoom maps a four-unit authored sprite pixel to `2.4`
  screen pixels. no output grid can represent that ratio with equal-sized square
  pixels.
- the canvas buffer follows css dimensions with `dpr = 1`, even on high-dpi or
  fractionally scaled displays. the browser can resample the completed frame a
  second time.
- world and hud currently share the presentation canvas. applying a final shader
  there would also chew up hud text, bars, maps, and cockpit lines.
- the existing smoothing and css-pixelation settings describe only fragments of
  the real pipeline and can claim a crisp result while diagonal ships still look
  wrong.

### approved visual contract

- ship hulls rotate continuously through the full 360 degrees; cached or visibly
  quantized facing directions are not the target.
- the assembled hull is treated as one visual object, so connected parts cannot
  drift apart or acquire different resampling artifacts.
- independently aimed turrets remain independent visual layers.
- the world uses hard pixel sampling with no bilinear blur.
- some crisp pixel crawl at changing diagonal angles is acceptable; blurred edge
  colors, soft seams, and differently scaled source pixels are not.
- hud, minimap, cockpit telemetry, menus, overlays, and html typography do not go
  through the world shader.
- movement, aim input, projectile direction, hitboxes, camera world extent, room
  visibility, multiplayer authority, and simulation timing remain unchanged.
- the compositor is core presentation, not an `eye candy` effect. optional bloom,
  scanlines, graphs, and decorative effects remain controlled by `eye candy`.

### target frame architecture

1. **simulation:** produces the same authoritative world state and continuous
   angles it does now. it knows nothing about pixel grids or webgl.
2. **viewport contract:** owns css size, physical size, device-pixel ratio,
   integer world scale, letterbox/crop remainder, camera projection, and inverse
   pointer mapping in one tested place.
3. **ship assembly cache:** builds one unrotated texture from the complete hull,
   weapon bases, and static utility parts. cache keys include the validated part
   layout and visual variants, never position, aim, cooldown, or gameplay state.
4. **dynamic ship layers:** draw aimed turrets, recoil, shields, core animation,
   damage flashes, and other changing effects separately from the cached hull.
5. **world source surface:** receives rooms, entities, particles, projectiles,
   assembled ships, remote players, enemies, bosses, and world-space effects in
   the existing draw order.
6. **webgl pixel compositor:** uploads the world source, uses nearest sampling,
   snaps sampling to the selected physical pixel grid, preserves palette colors
   and hard alpha boundaries, and presents the world through one full-screen
   pass.
7. **hud surface:** a transparent native-resolution 2d canvas sits above the
   webgl world. `HudRenderer`, minimap, cursor, prompts, cockpit telemetry, and
   debug text draw here without shader sampling.
8. **dom surface:** menus, settings, patch notes, hangar/editor overlays, and
   accessibility-friendly controls remain normal dom above both canvases.

the intended visible stack is:

```text
dom menus and overlays
native-resolution hud canvas
webgl pixel-composited world canvas
window background
```

### ownership and module boundaries

- keep `Renderer` as the small game-facing facade while moving implementation
  details under `engine/rendering/`.
- add a viewport owner for resize, dpr, integer scaling, projection, and input
  conversion. `Input`, `Camera`, and fullscreen handling must consume this owner
  rather than reimplement its ratios.
- add a world-surface owner for the 2d source buffer and frame lifecycle.
- add a webgl compositor owner for context creation, shader compilation, texture
  upload, nearest-neighbor state, presentation, context loss, and fallback.
- add a hud-surface owner that exposes only the native 2d hud context.
- add a ship-assembly renderer/cache beside entity rendering. `Ship` and part
  definitions remain model/data objects and do not create canvases or gl state.
- make `FramePresentationSystem` explicitly sequence `begin world`, world draw,
  world composite, hud clear, and hud draw.
- make renderer selection dependency-injectable so command tests and headless
  simulation do not require webgl.

### implementation sequence

#### 9.0 — freeze visual and behavioral evidence

- capture deterministic player, remote-player, enemy, and boss assemblies at
  cardinal and diagonal headings in the visual gallery.
- capture normal gameplay, hangar, minimap, pause, level-up, and main-menu frames.
- record camera world bounds and mouse-to-world results across representative
  window sizes before changing projection code.
- retain the current canvas path as a temporary compatibility implementation,
  not as a second permanently supported renderer.

gate: the evidence reproduces the diagonal ship defect and the existing hud,
camera, input, and draw-order contracts before extraction begins.

#### 9.1 — separate world and hud without changing pixels

- create stacked world and hud canvases with explicit z-order and pointer-event
  ownership.
- route every world draw to the world surface and every hud draw to the hud
  surface.
- keep the compositor in a pass-through mode so this phase changes architecture,
  not presentation.
- preserve menus, hangar, editor, pause, cursor, screenshots, and resize behavior.

gate: before/after captures are visually equivalent, hud command tests still
pass, input remains accurate, and the game is playable before shader work starts.

#### 9.2 — make viewport and resize math authoritative

- replace the hard-coded `dpr = 1` path with an explicit css/logical/physical
  viewport model.
- choose an integer physical world-pixel scale per window and center any remainder
  smaller than one world pixel without stretching the frame.
- decouple presentation density from camera world extent so changing pixel scale
  cannot zoom gameplay in or out.
- keep camera presentation translation continuous; the hard pixel grid must not
  quantize camera motion or alter authoritative positions.
- route mouse and cursor coordinates through the inverse viewport transform.

gate: resizing, fullscreen changes, retina displays, fractional desktop scaling,
and browser zoom cannot leave stale buffers, shift aim, change visible world
bounds, or introduce a fractional final blit.

#### 9.3 — assemble ships before transforming them

- compose static hull parts and weapon bases into one texture in validated ship
  layout order.
- invalidate only when layout, part rotation, part art, palette, or persistent
  visual damage changes.
- draw recoil, aimed turrets, shields, animated cores, and temporary effects as
  explicit dynamic layers anchored to the same assembly transform.
- use the complete rotated assembly geometry for visual bounds and culling; never
  fall back to the anchor core.
- use the same path for the local player, remote players, enemies, and bosses.

gate: connected parts remain connected at every heading, hangar edits invalidate
the cache immediately, independent turrets still track continuously, and no ship
collision or weapon-origin calculation moves.

#### 9.4 — introduce the webgl pixel compositor

- compile a minimal webgl 2 full-screen vertex/fragment pair with deterministic
  nearest sampling and no implicit mipmaps, filtering, color interpolation, or
  premultiplied-alpha surprises.
- upload only the world source and present it below the untouched hud canvas.
- quantize sample coordinates to the viewport owner's physical world-pixel grid.
- keep continuous ship angles; do not replace them with cached rotation frames.
- handle context loss and restoration without losing a run. if webgl genuinely
  cannot initialize, fall back to the pass-through renderer with one bounded
  warning instead of crashing.
- keep shader source local and compatible with the browser and tauri content
  security policies.

gate: diagonal ships contain no blended edge colors or inter-part seams, full
rotation has no angle stepping, and hud pixels are identical to the separated
pre-shader hud reference.

#### 9.5 — tune the hard-pixel presentation

- compare small integer world-pixel scales in the visual gallery at normal play
  size instead of judging enlarged crops alone.
- select the default using player-ship readability, projectile identity, debris,
  enemy silhouettes, camera motion, and room visibility together.
- prevent pixel-grid changes from altering world scale or simulation coordinates.
- keep palette quantization optional unless it proves it preserves every existing
  family, rarity, biome, warning, and damage color.
- keep bloom and cockpit decoration after hard sampling and behind `eye candy`;
  never soften the base world texture to fake glow.

design checkpoint: the owner approves the normal-scale rendered comparison before
the chosen pixel scale becomes the release default.

#### 9.6 — remove the old presentation path

- delete the obsolete offscreen-resolution and css-pixelation code after the
  compositor has passed parity gates.
- replace misleading settings with truthful controls only if the owner approves
  their player-facing behavior; do not expose raw implementation toggles.
- document the final renderer, surface ownership, fallback, and shader contracts.
- update patch notes only when the new renderer is actually shipped.

gate: there is one production world renderer, one hud surface, no dead smoothing
toggles, no duplicate resize/input math, and no compatibility path silently used
on supported desktop hardware.

### shader requirements

- webgl 2 with `nearest` minification and magnification, clamped edges, no mipmaps,
  and explicit alpha handling.
- source colors must survive sampling exactly unless an approved post-effect is
  active.
- transparent pixels remain transparent and cannot grow dark or bright fringes.
- the pixel grid is derived from physical output size, not frame time or camera
  position, so a stationary scene cannot shimmer.
- shader compilation and link errors include the failing stage in development
  logs but show only one concise fallback notice to players.
- context restore rebuilds programs, buffers, texture state, and viewport state
  without reconstructing or mutating game simulation.
- no shader uniform may contain gameplay authority or feed values back into the
  simulation.

### tests and rendered proof

- unit-test viewport selection, integer remainder placement, camera projection,
  inverse input mapping, dpr changes, and zero/invalid dimensions.
- unit-test assembly cache keys, invalidation, part ordering, rotated bounds,
  turret anchors, and remote/enemy/boss reuse.
- test compositor initialization, nearest texture state, resize, shader failure,
  context loss/restoration, and pass-through fallback with a controllable gl
  adapter.
- retain renderer-command tests for world and hud ownership and exact draw order.
- add deterministic pixel captures for at least `0`, `22.5`, `45`, `67.5`, and
  `90` degree hull headings plus independently aimed turrets.
- inspect those captures at normal play scale and enlarged nearest-neighbor scale;
  assert that hull edges contain only source palette or transparent pixels.
- compare hud-only captures before and after the shader with zero shader-induced
  differences.
- run resize and aim checks at representative `16:9`, `16:10`, ultrawide, small
  window, retina, and fractional-dpr configurations.
- smoke local player, remote player, enemies, boss, hangar edit, room transition,
  pause, fullscreen map, level-up, and main-menu return in a real browser.
- smoke host and guest rendering through a real peer session so remote assemblies
  and independently aimed weapons use the same path.
- run the complete javascript suite, lint, checked javascript, source hygiene,
  import graph, production build, rust tests, native macos build, strict signature
  verification, packaged-app resize/fullscreen smoke, and console-error check.
- capture gpu timing and sustained frame pacing with a projectile-heavy room at
  `1920x1080` and retina output. performance evidence must compare the same scene
  before and after; an idle menu frame proves nothing.

### failure conditions

- hud, minimap, cursor, or menu text passes through the pixel shader.
- the implementation hides blur by snapping simulation rotation or projectile
  aim.
- changing window size changes camera world extent, ship speed, input aim, or
  collision results.
- connected parts separate, overlap differently, or change mounting geometry.
- local, remote, enemy, and boss ships use visibly different filtering paths.
- webgl loss crashes, pauses permanently, deletes the run, or corrupts saves.
- the fallback becomes the normal path on supported tauri macos or windows builds.
- the shader improves enlarged screenshots while normal play becomes noisy,
  unreadable, or exhausting.
- optional glow, scanlines, or palette work is used to declare the base hard-pixel
  renderer complete.

### milestone exit gate

- a continuously rotating assembled ship stays hard-edged and connected at every
  heading with no cached-angle stepping and no blended diagonal seams;
- the world is presented through the webgl pixel compositor on supported browser
  and desktop builds;
- hud and dom presentation remain outside the shader and match their approved
  reference;
- camera extent, input mapping, movement, weapons, collisions, draw order, saves,
  and multiplayer outcomes match the pre-refactor evidence;
- resize, fullscreen, dpr changes, context loss, and fallback have explicit tested
  outcomes;
- normal-scale visual proof is approved, the full automated gate passes, and the
  macos app is rebuilt and launch-smoked;
- every implementation phase ended in a playable state and can be reverted
  independently.

## milestone 10 — signal forge

goal: put a complete jfxr-powered sound laboratory inside authenticated devtools
so a generated sound can be previewed, assigned to a part or game event with a
click, heard immediately, and restored on the next launch without dragging files,
renaming assets, editing code, or rebuilding the game.

status: authoring tool and runtime foundation completed on 2026-08-08. jfxr
generation, parameter editing, waveform preview, searchable coverage, explicit
custom/default/missing states, per-part and global-event binding, delayed impact
and detonation routing, drone/shield/booster slots, indexeddb persistence, native
desktop mirroring, saved-sound editing, default restoration, and fixed-path pack
promotion are working. the remaining missing-sound pass is creative content: four
unresolved sound identities across five visible target slots are exposed in the
forge and require owner-approved choices rather than invented defaults.

### source and integration decision

- use `jfxr` 0.13.0 from `https://github.com/ttencate/jfxr`, pinned exactly and
  retained under its bsd-3-clause license with attribution.
- lazy-load the standalone synthesizer library only when the sound lab opens. do
  not inherit jfxr's application ui or angularjs stack.
- do not iframe `jfxr.frozenfractal.com`. the desktop navigation guard and content security
  policy correctly reject arbitrary external pages, the tool must work offline,
  and an internet page does not belong inside a privileged desktop webview.
- do not make exporting a wav, opening a file picker, dragging a file, changing a
  filename, or restarting vite part of the normal authoring loop.
- preserve the useful jfxr workflow: presets, randomize, mutate, parameter editing,
  immediate preview, copyable settings, and deterministic wav rendering.
- keep the sound lab behind the existing devtools authentication boundary. it is
  a private authoring surface, not a player-facing settings screen.

### intended five-click workflow

1. open devtools and click **signal forge**.
2. generate, randomize, mutate, or tune a sound and click **preview** as often as
   needed.
3. click **apply**.
4. click a rendered part card or a named global-event card, then click the exact
   event slot when that target has more than one sound.
5. trigger the part or event in the running game and hear the replacement
   immediately.

there is no manual sound id field in the primary workflow. internal ids remain
visible in a small diagnostics area for debugging, not as homework for the owner.

### target-picker behavior

- show every player part from `PartsLibrary` as its real sprite, name, footprint,
  family, and rarity. clicking a card assigns the sound to that part definition,
  so every installed copy uses it.
- filter the available slots by capability instead of showing nonsense choices:
  weapons expose fire, charge, loop, release, impact, and explosion where their
  mechanics support them; shields expose absorb, break, restore, and ready;
  boosters expose engage, sustain, release, and ready; drone carriers expose
  launch, drone fire, drone hit, and drone death.
- support future part mechanics through declared audio capabilities instead of a
  hard-coded list in the devtool ui.
- provide separate global-event cards for player, enemies, rooms, rewards,
  environment, hangar, menus, and progression.
- include at least player damage/death/respawn, enemy hit/death, boss death,
  projectile impact, explosion, dash, salvage sweep, room enter/lock/clear,
  portal, chest, shop purchase, part pickup, xp/gold/hp pickup, crate/asteroid
  break, level-up choice, hangar install/remove, and ui confirm/back slots.
- allow selecting an installed part directly in the hangar as a shortcut to its
  definition card, but never store a binding against one transient ship-grid
  instance.
- show the active fallback chain before applying: exact part event, weapon or
  utility family event, global event, packaged default, then silence.

### audio-event architecture

- replace scattered string literals and the private `WEAPON_SOUNDS` table with a
  versioned `SoundEventRegistry` containing stable ids, category, label, allowed
  target types, fallback, default asset, and default playback policy.
- give part definitions declarative audio capabilities and default bindings. new
  mechanics add their slots beside the mechanic instead of patching devtools.
- carry source part id and sound-event intent through projectile impact and other
  delayed effects so a rocket can use its own impact sound after leaving the gun.
- keep sound selection presentation-only. it must not enter simulation snapshots,
  p2p authority, save-state determinism, damage logic, cooldowns, or scoring.
- make `AudioManager` own decoded buffers, active voices, buses, limiter nodes,
  hot replacement, preview isolation, and fallback resolution.
- add explicit `replace`, `preview`, `restore default`, and `stop preview` APIs.
  callers keep requesting semantic events instead of fetching buffers directly.
- audit every existing `audio.play(...)` request against the registry. references
  such as `overheat`, `reload`, `respawn`, and `click_short` currently fail
  silently because they are not present in the startup manifest; the milestone
  must make missing bindings visible in the forge and fail its validation gate.
- retain existing volume, pitch, random pitch, loop, and spam-limiting behavior as
  event defaults or call-site overrides without changing combat cadence.

### generated-sound model

each authored sound stores:

- a stable generated-sound id and editable lowercase display name;
- the pinned jfxr schema version and complete synthesizer parameter document;
- deterministic rendered pcm/wav data for playback parity across jfxr upgrades;
- duration, sample rate, channel count, byte size, peak, and integrated loudness
  metadata where available;
- preview gain, default event gain, pitch, allowed pitch randomization, loop
  points where supported, and spam/voice-limit policy;
- creation and modification time plus the jfxr package version;
- every event binding that currently references the sound.

store both the recipe and rendered audio. the recipe makes later editing possible;
the rendered bytes ensure an upstream synthesizer change cannot quietly alter an
already approved sound.

### instant runtime replacement

- jfxr renders into an in-memory buffer and hands it directly to `AudioManager`.
- applying a binding swaps the decoded buffer atomically. sounds already playing
  finish normally; the next trigger uses the replacement.
- applying never reloads the page, restarts the run, rebuilds vite, or changes
  authoritative game state.
- offer **preview raw**, **preview with event settings**, **test once**, **test
  spam**, and **test in game** actions so a nice isolated zap is not accidentally
  an unbearable minigun sound.
- keep a short bounded undo history for sound edits and binding changes.
- provide one-click **compare default**, **restore default**, **duplicate**, and
  **unbind** operations.
- show a persistent `custom`, `default`, or `missing` badge on every event card.

### persistence without rebuilding

- store generated wav blobs, recipes, and bindings in a versioned indexeddb sound
  pack. localstorage is not suitable for binary audio and its small synchronous
  quota would turn this tool into garbage immediately.
- load the sound pack after packaged defaults and before normal gameplay begins,
  then hot-register valid overrides with `AudioManager`.
- mirror the same validated pack into the tauri application-data directory using
  bounded atomic replacement, the same way native run saves avoid partial files.
- select the newest complete valid browser/native copy on desktop startup and
  repair the stale copy without deleting the good one.
- cap sound duration, individual bytes, total pack bytes, decoded memory, and
  simultaneous preview voices. reject corrupt or absurd entries without blocking
  the rest of the pack.
- include schema migration and a **reset corrupt entry** path. one broken sound
  cannot disable all audio or trap startup.
- runtime sound overrides are local presentation data. multiplayer does not send
  audio blobs or bindings; every peer hears its own installed sound pack.

### promoting an approved sound pack

iteration requires no build. shipping a public app still needs one final build,
because other computers cannot hear files that only exist in the owner's app-data
directory. promotion makes that final packaging automatic instead of manual:

- add **promote pack** in authenticated devtools.
- in a desktop development build, write validated wav files beneath a fixed
  generated-sounds source directory and regenerate one canonical sound-pack
  manifest.
- sanitize every generated filename from the stable sound id. never accept an
  arbitrary path from javascript.
- perform temporary-file plus atomic-replace writes, retain the previous manifest
  on failure, and report exactly which entry failed.
- make browser development export one complete pack artifact as a fallback; it is
  not required for the normal desktop workflow.
- packaged release builds can load promoted defaults but cannot write into their
  signed application bundle.
- keep generated wav files and the manifest deterministic so source control shows
  only real sound changes instead of timestamp or ordering noise.
- include the jfxr license and pinned package version with every promoted source pack.

### sound-lab ui

- open as a large dedicated devtools window, not inside the existing narrow
  spawner sidebar.
- use framebound's lowercase silkscreen/pixelify cockpit styling around the local
  jfxr controls without hiding or renaming synthesis parameters into nonsense.
- group the workspace into generator, waveform/parameter editor, preview meter,
  current sound, target picker, binding inspector, and pack status.
- show a waveform and duration meter, peak/clipping warning, event gain, pitch,
  random pitch, active-voice limit, and approximate packed size.
- provide searchable categories and part families, but make the common weapon,
  impact, pickup, room, and ui events reachable without searching.
- pause gameplay input while the forge owns keyboard shortcuts. space previews
  the sound instead of firing; escape closes the current picker before the forge.
- stop preview voices and release forge-only listeners when the window closes.
- preserve the current run and resume it exactly where it was.

### safety and quality rules

- run previews through a dedicated gain and hard limiter before the master bus so
  randomize cannot produce an ear-murdering spike.
- warn on clipping, excessive dc offset, inaudible output, invalid loop points,
  excessive duration, and large decoded memory.
- never normalize or otherwise alter the approved waveform silently. offer a
  deliberate normalize action with before/after preview.
- bound randomize and mutate generation time and make cancellation immediate.
- prevent overlapping previews from stacking without limit.
- accept only the pinned jfxr parameter schema and generated pcm/wav data in the
  primary workflow. arbitrary uploaded audio is outside this milestone.
- do not add external network permissions, remote scripts, `unsafe-eval`, broad
  filesystem access, or arbitrary tauri write paths.
- opening or using the forge does not taint a run because audio is cosmetic, but
  devtools gameplay cheats retain their existing taint behavior.

### implementation sequence

#### 10.0 — inventory every sound event

- replace the startup array with the versioned registry while preserving every
  currently audible default, volume, pitch, randomization, loop, and spam rule.
- find missing referenced sounds, unused wav files, duplicate aliases, dynamic
  part mappings, and events that currently have no sound call at all.
- add a generated audit view showing bound, missing, unused, and overridden slots.

gate: every runtime sound request resolves through the registry, existing audio
parity tests pass, and missing references can no longer fail silently.

#### 10.1 — hot replacement and persistent sound packs

- add bounded generated-sound validation, indexeddb storage, desktop mirroring,
  startup recovery, migration, and atomic `AudioManager` replacement.
- build a tiny test harness that synthesizes a known buffer, binds it, triggers
  the event, reloads the page, and proves the same bytes are active.

gate: a generated test sound applies and survives restart without touching the
source sound directory or rebuilding.

#### 10.2 — local jfxr workbench

- isolate the pinned jfxr synthesizer behind a framebound adapter and retain its license.
- adapt preset, randomize, mutate, parameter editing, preview, deterministic
  render, and recipe serialization behind a framebound-owned adapter.
- lazy-load the editor and synthesis code only after authenticated devtools opens
  the forge.

gate: the forge creates, edits, previews, closes, reopens, and reproduces the same
sound offline with no leaked listeners, voices, or timers.

#### 10.3 — click-to-bind parts and events

- render capability-aware part and global-event cards.
- connect apply, undo, compare, restore, test, and binding-status flows.
- integrate the hangar shortcut and delayed projectile/utility event resolution.

gate: the owner can generate a sound, click apply, click dart `fire`, resume, and
hear the dart use it immediately; the same flow works for one utility and one
global room or pickup event.

#### 10.4 — promote and package

- add the constrained desktop promotion command, canonical generated manifest,
  deterministic wav output, attribution, and browser pack fallback.
- teach normal startup to layer promoted defaults, local overrides, and packaged
  fallbacks in a documented order.

gate: a promoted pack survives a clean production build and fresh app-data
directory, while unpromoted experimentation remains local.

#### 10.5 — complete the missing-sound pass

- use the forge to fill missing weapon, utility, drone, enemy, environment, room,
  reward, hangar, and ui slots.
- approve sounds by hearing them in their real cadence and gameplay context, not
  by previewing each one alone.
- update patch notes only after the tool and promoted pack actually ship.

design checkpoint: sound selection is creative work. the tool may expose and
accelerate decisions, but it must not silently generate and approve the final
sound identity of parts, enemies, or events.

### tests and live proof

- validate unique event ids, valid fallback chains, valid part capabilities,
  existing asset reachability, and zero unregistered runtime sound requests.
- test recipe and sound-pack bounds, migration, corruption isolation, newest-copy
  recovery, quota failure, atomic desktop writes, filename sanitization, and
  refusal to write outside the generated-sounds directory.
- test immediate replacement, active-voice completion, preview cleanup, limiter
  routing, restore default, undo, loop handling, spam limits, and suspended audio
  context recovery.
- test that forge shortcuts cannot move, shoot, pause, open the map, or edit the
  hangar underneath the window.
- browser-smoke generate, preview, bind, trigger, reload, restore, and corrupt-one
  entry recovery with zero console errors.
- desktop-smoke the same flow in the packaged macos app using application-data
  persistence and in `tauri dev` using constrained promotion.
- verify a clean profile loads promoted defaults and an existing profile layers
  local overrides without mutating saves.
- run the complete javascript, lint, checked-javascript, source-hygiene, csp,
  production-build, rust, native-signature, and packaged-startup gates.
- inspect memory and active audio-node counts after repeated open/close, randomize,
  preview-spam, and one hundred hot replacements.

### milestone exit gate

- devtools opens a local offline jfxr sound lab with no iframe or external runtime
  dependency;
- generated sounds preview safely and bind to visible parts or semantic game
  events without manual ids, filenames, file movement, source edits, or rebuilds;
- the next real event trigger uses the new sound immediately;
- bindings and rendered audio survive browser and desktop restart with corruption
  containment and bounded storage;
- every runtime sound request is registered, missing and unused sounds are visible,
  and new part mechanics can declare new audio slots without editing devtools ui;
- undo, compare, restore default, limiter protection, preview cleanup, and fallback
  behavior are tested;
- promoted packs produce deterministic source assets and ship correctly after the
  one final release build;
- gameplay, saves, p2p authority, timing, and player-facing menus remain unchanged;
- the complete automated gate and live browser/native authoring smokes pass.

## milestone 11 — cursed vaults: blood contract

goal: replace the current pair of glowing treasure chests with a distinct,
readable, replayable cursed-vault set piece whose price, danger, presentation,
reward, persistence, and co-op ownership all express one approved risk/reward
contract.

status: implemented locally on 2026-08-08. the approved first release uses one
exclusive gilded/blood choice, no hidden permanent curse, shared gold or a
survivable payer-owned blood sacrifice, an eighteen-second containment assault,
and a payer-owned three-part cache. automated, save, snapshot, renderer, audio,
and packaged-app gates pass; live two-device feel acceptance remains external.

### current-state diagnosis

- a vault is an optional one-cell side room with at most one generated per floor
  and a flat thirty-percent branch attempt from a combat room.
- the room contains two instances of the normal treasure-chest sprite placed two
  hundred units apart. gold or red glow is doing nearly all the visual work.
- one chest asks for gold and one asks for hp. both costs multiply by `1.5` every
  floor; the strict `hp > cost` rule can make the blood option unusable before the
  room itself stops spawning.
- paying starts three timed waves containing four, five, and six enemies. every
  enemy receives `1.5x` hp, but the room does not otherwise create a unique
  encounter.
- activating either contract marks both chests as visually locked during combat,
  but only the paid chest records payment. after clearing, the other chest can be
  purchased to start another complete ambush, so the apparent choice is not an
  actual choice.
- completion drops three unrestricted random parts. there is no reward preview,
  curse identity, build-aware selection, vault-exclusive pool, pity rule, or
  protection from three useless duplicates.
- the room has no dedicated geometry, machinery, hazards, phase telegraphs,
  environmental storytelling, entrance sequence, completion sequence, or stable
  destruction state.
- notifications still describe a generic ambush and generic loot instead of a
  cursed contract.
- delayed waves use a real-time timeout beside room state. cancellation exists,
  but active encounter phase and countdown are not modeled as first-class state.
- saves remember chest flags and ordinary room state, but not a complete explicit
  contract/phase/reward decision that can prove exact mid-vault recovery.
- co-op can host-authoritatively activate the chest, but payment ownership,
  confirmation, reward ownership, dead-player participation, and simultaneous
  interaction behavior are not designed as a coherent vault contract.

### non-negotiable presentation contract

- entering a cursed vault must be recognizable before reading a tooltip. room
  silhouette, floor markings, machinery, lighting, palette, and sound carry the
  identity together.
- reuse framebound's neon outline language, pixelated typography, lowercase text,
  top-down readability, and current biome colors; do not paste a gothic fantasy
  room into the cockpit aesthetic.
- blood and gilded contracts must be distinguishable through shape, animation,
  iconography, and spatial treatment in addition to red versus gold color.
- every dangerous phase has a readable telegraph at normal play scale. decoration
  cannot hide projectiles, enemies, exits, pickups, or the player's ship.
- the room begins quiet, visibly commits when a contract is accepted, escalates
  through the encounter, and reaches an unmistakable stable completed state.
- destruction and completion effects use authored fragments and deterministic
  animation, not per-frame glitter noise.
- prompts, countdowns, warnings, contract text, and rewards use the current fonts
  and lowercase language.
- `eye candy` may remove secondary particles, graphs, and decorative animation;
  contract state, telegraphs, hazards, and reward readability are never optional.

### design checkpoint 11.a — what is the contract

the following must be chosen with the owner before gameplay code starts:

1. **exclusive choice:** selecting gilded or blood permanently seals the other
   contract for that vault.
2. **double debt:** both contracts remain possible, but the second price and
   encounter mutate because the player already robbed the first.
3. **single changing altar:** one altar rolls a clearly previewed price, curse,
   encounter, and reward package instead of presenting two fixed chests.

recommended starting point: exclusive choice. it creates an actual decision,
keeps the room short enough not to become compulsory floor homework, and makes
balancing one reward budget possible. this is a recommendation, not approval.

the checkpoint must also decide whether `cursed` means:

- only an upfront sacrifice plus dangerous encounter;
- a temporary encounter modifier that ends when the vault opens;
- a run-long drawback attached to a stronger reward;
- or a mixture where every contract previews its exact drawback before payment.

no hidden permanent curse is allowed. if a consequence survives the room, the
player sees it before accepting.

### design checkpoint 11.b — price and reward ownership

- decide whether gilded cost uses shared team gold or the activating player's
  private entitlement. current co-op gold is shared, but rewards and builds are
  private; the vault cannot quietly invent a third ownership rule.
- decide whether blood cost is flat hp, percent current hp, percent maximum hp,
  temporary maximum-hp loss, or another explicit sacrifice.
- decide whether payment can kill, leave one hp, or require a displayed safety
  margin. the current strict-survival rule is not automatically retained.
- decide whether one player can commit the team immediately, whether the room uses
  a short cancellable confirmation, or whether every living player must confirm.
- decide whether the reward belongs to the payer, becomes a private choice for
  each living player, drops into nearest-player pickup rules, or uses a new
  contract-specific allocation.
- decide what dead spectators receive if the vault is completed and whether vault
  completion can resurrect anyone. boss-kill resurrection remains unchanged
  unless explicitly expanded.
- define a floor-aware price budget against real player hp, expected gold, room
  depth, and reward value instead of continuing exponential numbers by habit.

### design checkpoint 11.c — encounter families

the system should support data-driven encounter definitions, but the first set is
chosen from approved candidates rather than dumping every idea into one room:

- **containment:** destroy curse pylons while enemies are strengthened by the
  surviving network.
- **collection:** enemies drop volatile charges that must be delivered to the
  vault while fighting.
- **survival:** hold the chamber through a short continuous assault with visible
  phase timing instead of three identical kill-all waves.
- **execution:** one elite assembled from editable enemy parts is supported by a
  small role-driven escort.
- **pursuit:** the contract marks one player and changes pressure as the mark moves
  or latches, without breaking the existing circling-latch enemy rule.
- **fracture:** portions of the arena become hazardous through clearly telegraphed
  sweeps or fields while normal enemies continue attacking.

the first release should ship a small strong set, not six half-working gimmicks.
every encounter family declares its duration target, spawn budget, enemy roster,
objective, failure conditions, telegraphs, cleanup, reward multiplier, and co-op
scaling in data.

### room and prop architecture

- create a dedicated vault-room layout owner instead of adding more branches to
  generic `Room.draw` and `Room.startAmbush`.
- define stable authored anchors for entrance, contract altar, sealed reliquary,
  pylons, spawn gates, objective zones, hazards, reward emergence, and decoration.
- keep collision geometry separate from decorative art and expose a devtools
  overlay for every vault anchor, hazard, spawn lane, and blocked cell.
- support multiple layout blueprints selected by seeded generation while keeping
  the contract altar and exits readable.
- validate layouts against ship assembly bounds, enemy sizes, projectile lanes,
  camera framing, teleport entry points, and co-op player count.
- make vault-specific props first-class room-owned entities with deterministic
  ids, update ownership, rendering, collision policy, snapshot state, and cleanup.
- allow enemy bodies used by vault encounters to remain editable part blueprints;
  encounter behavior references a role or blueprint id rather than hard-coded
  sprite geometry.
- never make one specific part size, starter loadout, dash range, or weapon family
  mandatory to navigate or complete the room.

### contract and encounter state model

replace loose chest booleans with one versioned vault state machine:

```text
dormant
offer visible
commit countdown
contract paid
sealing
encounter active
phase transition
reward ready
claimed
completed
```

- cancellation before payment returns to `offer visible`; cancellation after the
  irreversible commit follows the approved contract rule.
- every transition is idempotent and host-authoritative.
- time is simulation time, not an untracked wall-clock timeout.
- state records contract id, payer, payment result, sealed alternatives, encounter
  definition, phase, phase time, objective progress, deterministic rng state,
  living spawned ids, prop/hazard state, reward roll, reward ownership, claimed
  state, and completion state.
- revisiting, tactical-map teleport, save/continue, guest reconnect, and full
  resync reconstruct the exact visible and interactive phase.
- reward generation occurs once and is stored before presentation. reconnecting,
  clicking twice, or crashing between victory and pickup cannot reroll or duplicate
  it.

### system ownership

- `VaultDefinitionRegistry` owns contract, encounter, layout, price, reward, and
  presentation references as validated data.
- `VaultEncounterSystem` owns the state machine, simulation-time phases,
  objectives, spawns, hazards, completion, cancellation, and cleanup.
- `VaultEconomy` computes previewable prices and validates/commits payment exactly
  once against the approved solo and co-op rules.
- `VaultRewardSystem` creates and assigns the stored reward exactly once.
- `VaultRenderer` owns room props, contract state, objective telegraphs, and
  completion presentation while normal enemies/projectiles keep their existing
  renderers.
- `VaultHud` owns the compact contract preview, commit countdown, current
  objective, phase progress, and reward claim prompt.
- `Room` owns and snapshots the vault systems but does not implement their
  mechanics.
- `WorldInteractionSystem` sends a semantic vault intent and receives a result;
  it does not deduct resources, spawn waves, or roll rewards itself.
- host simulation owns all outcomes. guests may preview and request interaction
  but cannot pay, advance phases, create enemies, or claim rewards locally.

### visual and audio direction

- build the room around a sealed mechanical reliquary rather than two floating
  treasure boxes.
- use a restrained cursed palette derived from current colors: poisoned mint,
  ultraviolet, blood red, oxidized gold, cold cyan, and near-black, with contract
  colors reserved for meaningful state.
- let floor circuits, containment rings, shutters, pylons, warning chevrons, and
  the altar animate from encounter state instead of playing arbitrary loops.
- show cost physically: gilded conduits drain toward the altar; blood routing
  pulls from the activating ship into the chamber.
- telegraph spawn gates and hazards before they become dangerous.
- give reward emergence weight: unlock sequence, reliquary opening, stable light,
  and readable private ownership marker where applicable.
- define semantic sound slots for offer reveal, contract hover, commit countdown,
  gold payment, blood payment, seal, phase start, objective progress, hazard
  warning, failure, unlock, reward reveal, and claim.
- milestone 10's signal forge can author those sounds later, but the vault rework
  cannot depend on signal forge completion. temporary packaged defaults must use
  the same semantic slots.
- build the room correctly in the current renderer and provide a hard-raster
  reference for milestone 9; neither milestone blocks the other's architecture.

### rewards and balance requirements

- calculate the current gold/hp price curves, enemy hp budget, expected encounter
  time, damage risk, and three-random-part reward value across every floor before
  replacing numbers.
- define a reward budget shared by every contract, then spend it through rarity,
  choice count, exclusivity, build relevance, and curse severity.
- avoid fake choice: displayed alternatives must differ materially and the player
  must know what category of reward is being risked.
- prevent empty pools, core parts, invalid definitions, impossible placements,
  and accidental duplicate unique parts.
- decide whether vault-exclusive parts exist only when their mechanics and art are
  designed. the rework does not invent placeholder exclusives to fill a table.
- provide bad-luck protection appropriate to the approved reward form without
  guaranteeing an optimal build.
- scale co-op pressure through encounter budget and objectives, not by multiplying
  every enemy's hp until the room becomes wet concrete.
- collect contract selection, completion, damage taken, clear time, reward choice,
  floor, player count, and failure data in local development telemetry.

### implementation sequence

#### 11.0 — freeze and audit the existing vault

- capture current room generation, both payment paths, first and second ambush,
  all three waves, reward claim, revisit, save/continue, and host/guest behavior.
- measure prices, survivability, enemy budget, clear time, and reward value by
  floor.
- add characterization tests for the accidental second-contract behavior before
  the design checkpoint decides whether to preserve or remove it.

gate: the existing mechanics and defects are reproducible and no new rule has
been smuggled in under visual cleanup.

#### 11.1 — approve the contract

- present concise rendered room/layout concepts plus the contract, curse,
  payment, reward, co-op, and encounter-family choices above.
- choose one initial layout language and a deliberately small first encounter set.
- record the approved contract in a dedicated vault design document.

gate: the owner approves the normal-scale room concept and exact gameplay rules
before production art, balance, or encounter implementation begins.

#### 11.2 — extract authoritative vault state

- introduce the registries, state machine, economy, rewards, snapshots, and peer
  protocol while temporarily driving the old chest visuals and old encounter.
- migrate valid version-two room snapshots into the new dormant, active, reward,
  or completed state without deleting runs.
- replace wall-clock wave callbacks with simulation-time phases.

gate: old presentation remains playable while duplicate payment, reward reroll,
reconnect divergence, and incomplete snapshot state are impossible.

#### 11.3 — build layouts, props, and presentation

- implement the approved layout blueprints, reliquary, altar, contract states,
  pylons/props, telegraphs, lower-case ui, minimap state, and deterministic effects.
- validate normal-scale clarity with starter, large, asymmetric, and co-op ships.

gate: the vault is unmistakable on entry, every state reads without debug text,
and visuals do not alter collision or obscure combat.

#### 11.4 — implement approved encounters and rewards

- add only the approved encounter families, objective behavior, co-op scaling,
  price rules, curse rules, reward budget, ownership, and claim flow.
- reuse editable enemy-part blueprints and role behavior rather than welding art
  into encounter code.

gate: every contract completes, fails, saves, resumes, reconnects, and rewards
exactly as approved in solo and four-player host-authoritative simulation.

#### 11.5 — balance and ship

- run seeded floor sweeps plus real human runs, then tune price, duration, spawn
  budget, telegraph time, and reward value from evidence.
- add final sounds through semantic slots, update patch notes, and rebuild the
  desktop app only after design and parity approval.

gate: players sometimes reject the vault for rational build/run reasons, accept
it for understandable upside, and never need hidden wiki knowledge to predict the
contract.

### tests and rendered proof

- test vault generation count, reachability, layout anchors, spawn lanes, collision
  clearance, seeded selection, and every floor/biome combination.
- test all state transitions, repeated intents, simultaneous peer intents,
  insufficient payment, disconnect during commit, death during payment, team wipe,
  host departure, cancellation, phase timeout, objective completion, and cleanup.
- test exact save/continue and room-snapshot restore at every state-machine phase.
- test reward roll-once, ownership, private visibility where applicable, claim,
  reconnect, unclaimed revisit, duplicate click, and corrupt snapshot rejection.
- test that non-vault rooms retain their current generation, pacing, clear rules,
  rewards, debris, salvage sweep, and transitions.
- render deterministic galleries for every layout, contract state, phase,
  telegraph, hazard, completion, reward state, minimap marker, and `eye candy`
  setting.
- browser-smoke both contracts, every shipped encounter family, pause, resize,
  save/menu/continue, tactical-map revisit, and normal gameplay afterward.
- peer-smoke two players paying, fighting, dying, spectating, reconnecting, and
  claiming according to the approved ownership rules.
- run the full javascript, coverage, lint, checked-javascript, source-hygiene,
  import, production-build, rust, native-build, signature, and packaged-app gates.

### failure conditions

- the vault remains two recolored normal chests in an ordinary empty room.
- `cursed` is only a larger hp multiplier or a surprise permanent penalty.
- a tooltip or color alone carries information required to survive the encounter.
- exponential prices create options that are technically displayed but normally
  impossible to buy.
- the room becomes mandatory because its reward dominates every ordinary route.
- difficulty scaling turns into enemy-health inflation or unreadable projectile
  spam.
- different peers see different contract, phase, objective, reward, or ownership
  state.
- save/continue rerolls payment, encounter, curse, or reward.
- leaving, teleporting, changing floor, or ending a run leaks vault timers,
  enemies, hazards, props, audio loops, or ui into another room.
- room art assumes one ship footprint and clips or traps valid assemblies.
- renderer or signal-forge milestones are treated as excuses to leave the vault
  half-playable.

### milestone exit gate

- cursed vaults have an approved contract, curse, payment, co-op, encounter, and
  reward identity documented outside implementation code;
- the room has dedicated readable layouts, props, stateful presentation,
  telegraphs, lowercase ui, minimap state, and semantic audio hooks;
- payment, phase progression, failure, completion, reward generation, and claim
  are host-authoritative, idempotent, deterministic where required, and exactly
  restorable;
- the fake-choice and exponential-cost defects are resolved according to the
  approved design;
- every shipped encounter is meaningfully different, normal-scale readable, and
  balanced against its reward without becoming compulsory;
- solo and co-op browser smokes, save/reconnect/revisit proof, full automated
  gates, and the packaged macos smoke all pass;
- non-vault gameplay, movement, weapons, parts, rooms, saves, and presentation
  remain unchanged outside explicitly approved vault rules.

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
