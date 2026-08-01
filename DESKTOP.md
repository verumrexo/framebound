# framebound desktop direction

date approved: 2026-07-26  
status: development shell, locally valid macos bundle, and passing macos/windows artifact ci; native windows execution, distribution signing, and notarization remain open

## player experience

the shipped game must start like a normal game:

- macos: double-click `Framebound.app`;
- windows: double-click `Framebound.exe` or use its installer shortcut;
- no terminal, local server, browser tab, port, or copied localhost link;
- offline play starts without a network connection;
- online play exposes **host game** and **join game** inside the game.

the browser build remains a development and preview surface. it is not the intended installation experience.

## implementation choice

use tauri 2 as a thin desktop shell around the existing vite game.

- keep the javascript game and canvas renderer as the source of truth;
- do not fork gameplay into a desktop-only implementation;
- do not bundle the legacy socket.io game server;
- keep peer-to-peer multiplayer inside the same app through webrtc;
- isolate native integration behind a small adapter so browser tests still run.

electron is the fallback only if a real webview incompatibility blocks the game. shipping an extra chromium and node runtime is unnecessary unless testing proves tauri cannot preserve the existing behavior.

## development and testing

desktop packaging does not replace the fast development loop:

1. run focused and full node tests;
2. use vite in a browser for fast gameplay and canvas smoke tests;
3. run `npm run desktop` for desktop-shell checks with hot reload;
4. build installable artifacts only at checkpoints, release candidates, and after native-wrapper changes.

on macos, the build scripts apply an ad-hoc signature to the complete `.app`
bundle after tauri packages it. this makes the local artifact internally valid
and double-clickable, but it is not an apple developer-id signature and is not
notarized for public distribution.

while `npm run desktop` stays open, saving javascript, html, or css refreshes the app window. rust recompiles only when the small native shell changes.

one-time developer setup requires rust and `npm install`. the tauri cli is a prebuilt project dependency; do not compile it globally with `cargo install`.

## save storage

the desktop shell mirrors the validated version-two run save to
`run-save-v2.json` inside tauri's platform app-data directory for the stable
application id `com.verumrexo.framebound`. startup compares that native file
with the webview copy and keeps the newer valid save. the shell returns bounded
primary, temporary, and backup candidates in that order, and the same strict
javascript save validator selects the first usable native candidate. corrupt or
oversized native files are rejected before the menu is built. native writes are
synced to a temporary file before replacement. windows replacement also keeps
the previous primary as a short-lived backup and restores it when the final
rename fails.

an existing save in the framebound desktop webview is mirrored automatically.
saves from a separate chrome/safari/firefox browser profile are not imported;
silently rummaging through random browser storage would be both fragile and
creepy.

browser and desktop checks are both required because macos and windows use different system webviews.

the browser and tauri shells both enforce a content security policy that blocks
dynamic javascript evaluation, embedded frames, plugins, and base-url
rewriting. the native policy additionally permits tauri's `ipc:` connection
scheme so the three bounded save commands keep working. a native navigation
guard allows only the packaged app origin and the exact local development
origin; remote pages cannot replace the game inside its privileged webview.

desktop-specific smoke coverage must include:

- launch, quit, restart, and offline startup;
- backgrounding the native host without suspending signaling or simulation;
- save location, save persistence, and malformed-save recovery;
- keyboard, mouse, focus, pointer lock, resizing, fullscreen, and high-dpi rendering;
- audio startup and suspend/resume;
- host/join webrtc connectivity between real app instances;
- clear connection failure without hanging the game.

## release artifacts

- macos builds produce a signed and notarized `.app`, normally distributed in a `.dmg`;
- windows builds produce a signed setup `.exe`, with `.msi` optional;
- macos artifacts are built and smoke-tested on macos;
- windows artifacts are built and smoke-tested on windows;
- ci may produce unsigned internal artifacts before signing is configured, but they are not public releases.

the current local macos artifact is ad-hoc signed for development only. public
release still requires developer-id signing, notarization, and a distribution
container.

`.github/workflows/desktop.yml` builds unsigned internal macos `.app` and windows
nsis `.exe` artifacts on their native runners. the macos app is zipped with
`ditto` before upload so its executable permissions, resource forks, and bundle
signature survive artifact download. those jobs are configuration, not proof:
the first pushed run still has to pass before either platform is claimed as
verified.

`npm run desktop:build` now verifies the artifact before returning. macos
verification checks bundle identity, release version, executable permissions,
mach-o format, icon presence, and the later strict signature gate. windows
verification requires exactly one versioned nsis installer with a real portable
executable header before ci can upload it. this catches broken packaging; it
does not replace native launch and gameplay smoke tests.

the app shell is allowed to change packaging, native menus, file locations, and window lifecycle. it is not allowed to change movement, controls, timing, visuals, audio, gameplay, or balance without approval.
