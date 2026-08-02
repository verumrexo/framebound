# framebound signaling service

this service only exchanges short-lived webrtc connection metadata. it does not
run combat, rooms, rewards, saves, or any other game simulation.

## current deployment

the public relay is:

```text
https://framebound-signaling.onrender.com
```

its signaling-only health response, host code, guest join, and signal relay
passed the hosted smoke test. production browser and desktop builds use this
exact url.

## deploy the free public relay

[`render.yaml`](./render.yaml) defines one free, signaling-only websocket
service in render's frankfurt region. use the deploy button below after the
blueprint is on github:

[![deploy to render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy?repo=https%3A%2F%2Fgithub.com%2Fverumrexo%2Fframebound)

render assigns the service an `https://framebound-signaling-....onrender.com`
url. do not guess the suffix. copy the exact url from render, then verify it:

```sh
npm run signaling:smoke -- https://your-service.onrender.com
```

the free instance can sleep after fifteen idle minutes. the first connection
can take about a minute to wake it. active websocket traffic keeps it awake.
the game session itself remains peer to peer.

after the smoke passes:

1. add the exact url to the github repository variable
   `VITE_SIGNALING_URL`;
2. add `VITE_SIGNALING_URL=https://...` to `.env.production`;
3. rebuild the browser and desktop releases.

## run the production mode locally

install production dependencies and start the same server entry point with
legacy gameplay disabled:

```sh
npm ci --omit=dev
PORT=3000 npm run signaling
```

the hosting platform must support websocket upgrades. its health check is:

```text
GET /health
```

and returns `{"status":"ok","signaling":true,"legacyGameplay":false}`.

`Dockerfile` packages exactly that signaling-only mode for hosts that accept a
container. it exposes port `3000` and includes the same health check. the image
does not copy the desktop shell, browser build, or rust target.

use `CORS_ORIGIN` to restrict the socket origin when the final web and desktop
origins are known. `*` is the current fallback. do not put authoritative game
state, leaderboard secrets, or service-role database keys on this service.

## connect a build

set `VITE_SIGNALING_URL` to the public `https://` service url before building.
github actions reads the same value from the repository variable named
`VITE_SIGNALING_URL`.

the host keeps its session code alive every 30 seconds. abandoned codes expire,
and the registry is intentionally memory-only: a signaling-service restart
invalidates old join codes but cannot lose a game save or mutate a running
direct peer connection.
