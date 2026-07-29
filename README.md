# framebound:uplink 

**v1.1.0 (beta) system:authority**

congrats, you found the source code for the only space roguelike that won't make your computer scream for mercy. it's built with vanilla javascript and vite because we actually care about performance, unlike some people.

## what's actually in here?
- **physics that doesn't suck**: drift, boost, and crash into asteroids like a pro.
- **ship building**: stop flying a bucket. find parts and actually build something that looks like it belongs in space.
- **bosses that fight back**: they're symmetrical, they have actual hitboxes now (revolutionary, i know), and they will absolutely wreck you.
- **weaponry for every vibe**: freeze rays, global-range sabers, cluster grenades. choose how you want to ruin an alien's day.
- **economy (cringe, but necessary)**: gold, xp, shops, and crates. go buy some friends or something.
- **cursed vaults**: high risk, high reward. if you die in an ambush room, don't come crying to me.
- **custom cursors**: because the default white arrow is for boomers.

## how to play (if you can)

the current [github pages build](https://verumrexo.github.io/framebound/) is a browser preview.

the approved shipping target is a normal macos `.app` and windows `.exe`: double-click, play, no terminal, no local server, no localhost ritual. the development shell is implemented; signed public installers are not shipped yet. see [`DESKTOP.md`](./DESKTOP.md).

### controls
- **wasd**: move (please don't ask how to use keys)
- **mouse**: aim your feelings at the enemies
- **left click**: fire
- **shift**: boost away from your problems
- **e**: talk to things / open chests
- **tab**: look at your inventory (hangar)
- **l**: dev terminal (you probably don't have the PIN anyway 🙄)

## multiplayer status

the old socket.io gameplay server remains only as a development/test fallback.
the player-facing online menu now uses the p2p host/join path, but co-op is not
release-complete yet.

the approved direction is peer-to-peer multiplayer:

- click **host game**;
- receive a short join code;
- friends enter the code;
- the host game instance runs the authoritative session;
- no paid, always-running game server.

this is documented in [`MULTIPLAYER.md`](./MULTIPLAYER.md). the real browser
transport/resync flow and host/join-code menu pass locally. the approved co-op
contract is implemented locally: shared xp/gold, private builds, buyer-owned
shop rewards, team transitions, four players, host pause, guest combat parity,
nearest-player aggro, spectating, and boss-kill resurrection. health-orb and
level-up ownership still need the final rule, and public builds still need a
deployed signaling url. yeah, honesty in a readme. disgusting.

the tiny websocket handshake service has a signaling-only production mode and
health endpoint documented in [`SIGNALING.md`](./SIGNALING.md). a render
blueprint and hosted-relay smoke test are included; connecting the render
account and copying its assigned url are the remaining account-bound steps.

## development

everything below is developer tooling. players should never need it once the desktop build ships.

### requirements
- [Node.js](https://nodejs.org/) (22.12+; the release and coverage gates use Node 22 features)
- [Rust](https://rustup.rs/) (the prebuilt Tauri CLI is installed by `npm install`)
- a terminal (cmd, bash, powershell, whatever)

### desktop development

run this once and leave the window open:

`npm run desktop`

editing and saving the javascript, html, or css refreshes the Framebound app window automatically. this is the normal testing loop; it does not rebuild the installable app every time.

build a platform release only when needed:

- current platform: `npm run desktop:build`
- macos `.app` only: `npm run desktop:build:app`

the local macos bundle is written to `src-tauri/target/release/bundle/macos/Framebound.app`.
the macos build command ad-hoc signs that local bundle so it passes strict
bundle verification. public developer-id signing and notarization are still
release work, so don't upload the dev build and call it shipped. obviously.

### instructions
1. **clone the repo**: `git clone https://github.com/verumrexo/framebound.git`
2. **install dependencies**: `npm install`
3. **run the regression suite**: `npm test`
4. **start everything**: `npm start`

this command runs both the backend server and the frontend client concurrently.

`npm test` is the canonical test command. it runs the unit, integration, malformed-packet, and real socket.io lobby tests on node 20.19+ or 22.12+.

`npm run test:coverage` runs the same suite with node's source coverage report.

copy `.env.example` to `.env.local` when local server, signaling, or leaderboard
configuration is needed. production public values live in `.env.production`;
secret service-role keys never belong in vite variables because the browser can
read every `VITE_*` value.

the public score board is deliberately documented as casual/untrusted in
[`LEADERBOARD.md`](./LEADERBOARD.md); p2p runs cannot submit to it.

### legacy multiplayer test server

the temporary socket.io server can still be run for development:

`npm run server`

the server will start on port `3000` by default. you should see something like:
`Server running on port 3000`

`npm start` runs that legacy server beside vite. do not treat this as the final hosting guide; it will be retired after the webrtc path passes the browser and desktop release gates.

## troubleshooting

if you encounter `ERR_MODULE_NOT_FOUND`, run `npm install` before starting the development server.
