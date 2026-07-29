import { createFrameboundServer } from './ServerApp.js';

const port = process.env.PORT || 3000;
const legacyGameplay = process.env.LEGACY_GAMEPLAY_ENABLED !== 'false';
let roomFactory = null;

if (legacyGameplay) {
    await import('./setup.js');
    const { GameRoom } = await import('./GameRoom.js');
    roomFactory = (id, io, name) => new GameRoom(id, io, name);
}

const server = createFrameboundServer({
    corsOrigin: process.env.CORS_ORIGIN || '*',
    legacyGameplay,
    roomFactory
});

server.start(port).then(address => {
    console.log(`Server running on port ${address.port}`);
}).catch(error => {
    console.error('[Server] Failed to start:', error);
    process.exitCode = 1;
});

let stopping = false;
async function shutdown(signal) {
    if (stopping) return;
    stopping = true;
    console.log(`[Server] ${signal}, shutting down`);
    await server.stop();
    process.exit(0);
}

process.once('SIGTERM', () => shutdown('SIGTERM'));
process.once('SIGINT', () => shutdown('SIGINT'));
