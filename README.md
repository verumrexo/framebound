# framebound:uplink 

**v1.0.1 (beta) protocol:uplink** 

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
[play it here or whatever](https://verumrexo.github.io/framebound/) (it's on github pages, obviously)

### controls
- **wasd**: move (please don't ask how to use keys)
- **mouse**: aim your feelings at the enemies
- **left click**: fire
- **shift**: boost away from your problems
- **e**: talk to things / open chests
- **tab**: look at your inventory (hangar)
- **l**: dev terminal (you probably don't have the PIN anyway 🙄)

## running a server (for you and your friends)

want to host your own galaxy? fine. here's how you do it.

### requirements
- [Node.js](https://nodejs.org/) (v16+ because we aren't cavemen)
- a terminal (cmd, bash, powershell, whatever)

### instructions
1. **clone the repo**: `git clone https://github.com/verumrexo/framebound.git`
2. **install dependencies**: `npm install`
3. **start everything**: `npm start`

this command runs both the backend server and the frontend client concurrently.

### running a standalone server
if you only want to run the server (e.g. for hosting):
`npm run server`

the server will start on port `3000` by default. you should see something like:
`Server running on port 3000`

### connecting
- **local play**: use `npm start`. the game will automatically connect to `localhost:3000`.

- **hosting for friends (advanced: port forwarding)**:
    - forward port `3000` (TCP) on your router to your computer.
    - friends join via the `direct connect` input in the lobby menu using your public IP (e.g., `ws://123.45.67.89:3000`).

- **hosting for friends (easy: no port forwarding)**:
    - if you are on a **mobile hotspot**, university wifi, or can't access your router, use a tunnel.
    - **option 1: localtunnel (easiest)**
        1. install global: `npm install -g localtunnel`
        2. start your server: `npm run server`
        3. in a new terminal, run: `lt --port 3000`
        4. copy the url (e.g., `https://gorge-ous-ant.loca.lt`).
        5. friends open the game (on github pages or locally), go to **online lobby**, and paste that url into the **direct connect** box.

    - **option 2: ngrok**
        1. download [ngrok](https://ngrok.com/).
        2. run `ngrok http 3000`.
        3. give the forwarding url to your friends for the **direct connect** box.

- **deployment**: set the `VITE_SERVER_URL` environment variable in your frontend deployment (e.g., Vercel, Netlify) to your server's public URL (e.g., `wss://your-server.com`).
