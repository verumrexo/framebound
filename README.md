<div align="center">
  <img src="./src/assets/logo.png" alt="framebound" width="760">

  <p>a fast top-down space roguelike about movement, scavenging, and building a ship out of whatever survives.</p>

  [![web build](https://github.com/verumrexo/framebound/actions/workflows/deploy.yml/badge.svg)](https://github.com/verumrexo/framebound/actions/workflows/deploy.yml)
  [![desktop builds](https://github.com/verumrexo/framebound/actions/workflows/desktop.yml/badge.svg)](https://github.com/verumrexo/framebound/actions/workflows/desktop.yml)
  [![version](https://img.shields.io/badge/version-1.2.0--beta-78ff96)](./package.json)

  [play the browser preview](https://verumrexo.github.io/framebound/) ·
  [roadmap](./ROADMAP.md) ·
  [active idea backlog](./task2.md)
</div>

## build a ship. try not to lose it.

framebound drops you into a hostile, room-based space run with a small ship and
bad odds. clear rooms, collect parts, rebuild your ship, buy upgrades, and push
through the floor boss without turning your lovingly assembled death machine
into drifting scrap.

- momentum-based movement with boost and dash
- modular ship building with individual weapons, engines, armor, and utility parts
- distinct projectile families, from green basic shots to long red rockets
- seeded floors with combat rooms, shops, treasure rooms, vaults, wrecks, and bosses
- persistent room debris and versioned run saves
- xp, upgrades, gold, shops, loot, drones, and cursed vault encounters
- offline play plus host-authoritative peer-to-peer co-op in active development

## play

### browser preview

[play framebound on github pages](https://verumrexo.github.io/framebound/).

the browser build is the quickest public preview. offline play is the stable
reference experience.

### desktop

framebound already runs as a native tauri shell:

- macos: `Framebound.app`
- windows: installer `.exe`

desktop artifacts are built and verified in github actions, but public signed
installers are not released yet. the current macos development app is ad-hoc
signed; apple developer-id signing and notarization are still required before a
proper public download. see [desktop status](./DESKTOP.md).

## controls

| input | action |
| --- | --- |
| `w` `a` `s` `d` | move |
| mouse | aim |
| left click | fire |
| `shift` | boost or dash |
| `e` | interact |
| `tab` | open the hangar |
| `m` | open the floor map |
| `esc` | pause |

## online co-op

the intended flow is deliberately simple:

1. click **online play**;
2. one player hosts and receives a short code;
3. up to three friends enter that code;
4. gameplay travels directly between the players.

the host owns the simulation and save. xp and gold are shared, while parts,
builds, upgrades, health pickups, and purchased shop rewards stay personal.
dead players spectate and resurrect when the floor boss dies. if the host
leaves, the run ends.

the public signaling relay is live and the browser connection path passes.
full second-device desktop gameplay proof is still open, and restrictive
networks may need a future relay. the honest technical version lives in
[multiplayer status](./MULTIPLAYER.md).

## project status

framebound is in active beta development.

- the original gameplay and visual identity remain the source of truth;
- large systems are being extracted from the old `game.js` without rewriting
  the feel;
- bugs and technical debt are fixed behind regression coverage;
- creative or balance changes require an explicit design decision first.

current execution work is tracked in the [technical roadmap](./ROADMAP.md).
unfinished feature ideas remain active in [task2](./task2.md).

## development

### requirements

- node.js 22.12 or newer
- rust and cargo for desktop builds

### quick start

```sh
git clone https://github.com/verumrexo/framebound.git
cd framebound
npm install
npm run dev
```

vite serves the game with hot reload. no gameplay server is required for
offline development.

### useful commands

| command | purpose |
| --- | --- |
| `npm run dev` | start the browser development build |
| `npm test` | run the canonical regression suite |
| `npm run build` | create the production web build |
| `npm run lint` | run correctness-focused javascript linting |
| `npm run typecheck` | check the gradual typed javascript boundary |
| `npm run desktop` | launch the native desktop shell with hot reload |
| `npm run desktop:build` | build and verify the current platform artifact |
| `npm run signaling:smoke` | verify the configured signaling relay |

`npm start` also launches the legacy socket.io gameplay server. that path only
exists as a development fallback while peer-to-peer co-op reaches full parity.

copy `.env.example` to `.env.local` only when local signaling, legacy server, or
leaderboard configuration is needed. never put private keys in a `VITE_*`
variable; browser builds expose them.

## documentation

- [desktop packaging and release status](./DESKTOP.md)
- [peer-to-peer multiplayer design](./MULTIPLAYER.md)
- [signaling deployment](./SIGNALING.md)
- [save format and migration rules](./SAVE_FORMAT.md)
- [gameplay parity traces](./GAMEPLAY_PARITY.md)
- [part mechanics architecture](./PARTS.md)
- [leaderboard trust model](./LEADERBOARD.md)
- [technical audit](./AUDIT.md)
- [technical roadmap](./ROADMAP.md)
- [active feature and idea backlog](./task2.md)
