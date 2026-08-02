import { io } from 'socket.io-client';

const rawUrl = process.argv[2] || process.env.SIGNALING_URL;
const serviceUrl = parseServiceUrl(rawUrl);
const clients = [];

try {
    const health = await getJson(
        new URL('/health', serviceUrl),
        90_000
    );
    assertHealth(health);

    const host = await connectClient(serviceUrl);
    const guest = await connectClient(serviceUrl);
    clients.push(host, guest);

    const hostedPromise = waitForEvent(host, 'p2p_hosted');
    host.emit('p2p_host');
    const hosted = await hostedPromise;
    if (!/^[A-Z0-9]{6}$/.test(hosted?.code || '')) {
        throw new Error('signaling returned an invalid host code');
    }

    const hostSawGuest = waitForEvent(host, 'p2p_peer_joined');
    const guestJoined = waitForEvent(guest, 'p2p_joined');
    guest.emit('p2p_join', hosted.code);
    const [peer, joined] = await Promise.all([
        hostSawGuest,
        guestJoined
    ]);
    if (joined?.code !== hosted.code || peer?.peerId !== guest.id) {
        throw new Error('host and guest did not join the same session');
    }

    const relayedSignal = waitForEvent(host, 'p2p_signal');
    guest.emit('p2p_signal', {
        code: hosted.code,
        targetId: host.id,
        signal: { candidate: 'framebound-smoke' }
    });
    const relayed = await relayedSignal;
    if (
        relayed?.fromId !== guest.id ||
        relayed?.signal?.candidate !== 'framebound-smoke'
    ) {
        throw new Error('signaling relay changed or dropped the test signal');
    }

    console.log(`signaling smoke passed: ${serviceUrl.origin}`);
} finally {
    for (const client of clients) client.disconnect();
}

function parseServiceUrl(value) {
    if (typeof value !== 'string' || !value.trim()) {
        throw new Error(
            'usage: npm run signaling:smoke -- https://service.example'
        );
    }

    const url = new URL(value.trim());
    const local = ['localhost', '127.0.0.1', '::1'].includes(url.hostname);
    if (url.protocol !== 'https:' && !(local && url.protocol === 'http:')) {
        throw new Error('public signaling smoke urls must use https');
    }
    url.pathname = '/';
    url.search = '';
    url.hash = '';
    return url;
}

async function getJson(url, timeoutMs) {
    const response = await fetch(url, {
        signal: AbortSignal.timeout(timeoutMs)
    });
    if (!response.ok) {
        throw new Error(`health request failed with ${response.status}`);
    }
    return response.json();
}

function assertHealth(value) {
    if (
        value?.status !== 'ok' ||
        value?.signaling !== true ||
        value?.legacyGameplay !== false
    ) {
        throw new Error('service is not running in signaling-only mode');
    }
}

async function connectClient(url) {
    const client = io(url.origin, {
        transports: ['polling', 'websocket'],
        forceNew: true,
        reconnection: false,
        timeout: 30_000
    });
    try {
        await waitForEvent(client, 'connect', 30_000, 'connect_error');
        return client;
    } catch (error) {
        client.disconnect();
        throw error;
    }
}

function waitForEvent(
    emitter,
    event,
    timeoutMs = 15_000,
    errorEvent = 'p2p_error'
) {
    return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
            cleanup();
            reject(new Error(`timed out waiting for ${event}`));
        }, timeoutMs);
        timeout.unref?.();

        const onEvent = value => {
            cleanup();
            resolve(value);
        };
        const onError = error => {
            cleanup();
            reject(new Error(
                typeof error === 'string'
                    ? error
                    : error?.message || `${errorEvent} while waiting for ${event}`
            ));
        };
        const cleanup = () => {
            clearTimeout(timeout);
            emitter.off(event, onEvent);
            emitter.off(errorEvent, onError);
        };

        emitter.once(event, onEvent);
        emitter.once(errorEvent, onError);
    });
}
