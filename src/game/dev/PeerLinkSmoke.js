import {
    WebRtcPeerLink
} from '../../shared/multiplayer/WebRtcPeerLink.js';

export async function runPeerLinkSmoke({ timeoutMs = 10_000 } = {}) {
    const host = new WebRtcPeerLink({
        initiator: true,
        iceServers: []
    });
    const guest = new WebRtcPeerLink({
        initiator: false,
        iceServers: []
    });
    let hostSignalQueue = Promise.resolve();
    let guestSignalQueue = Promise.resolve();

    host.onSignal = signal => {
        guestSignalQueue = guestSignalQueue.then(async () => {
            const response = await guest.acceptSignal(signal);
            if (response) await host.acceptSignal(response);
        });
    };
    guest.onSignal = signal => {
        hostSignalQueue = hostSignalQueue.then(() =>
            host.acceptSignal(signal)
        );
    };

    try {
        const result = await withTimeout(
            openAndExchange(host, guest),
            timeoutMs
        );
        await hostSignalQueue;
        await guestSignalQueue;
        return result;
    } finally {
        host.close();
        guest.close();
    }
}

async function openAndExchange(host, guest) {
    let hostTransport;
    let guestTransport;
    const opened = new Promise(resolve => {
        const check = () => {
            if (hostTransport && guestTransport) {
                resolve([hostTransport, guestTransport]);
            }
        };
        host.onTransport = transport => {
            hostTransport = transport;
            check();
        };
        guest.onTransport = transport => {
            guestTransport = transport;
            check();
        };
    });

    const offer = await host.createOffer();
    const answer = await guest.acceptSignal(offer);
    await host.acceptSignal(answer);

    const [hostChannel, guestChannel] = await opened;
    return new Promise((resolve, reject) => {
        guestChannel.onMessage(message => {
            if (message === 'framebound-ping') {
                guestChannel.send('framebound-pong');
            }
        });
        hostChannel.onMessage(message => {
            if (message === 'framebound-pong') {
                resolve({
                    connected: true,
                    roundTrip: true
                });
            }
        });
        if (!hostChannel.send('framebound-ping')) {
            reject(new Error('peer channel refused the smoke message'));
        }
    });
}

function withTimeout(promise, delay) {
    return new Promise((resolve, reject) => {
        const handle = setTimeout(() => {
            reject(new Error('peer link smoke timed out'));
        }, delay);
        promise.then(
            value => {
                clearTimeout(handle);
                resolve(value);
            },
            error => {
                clearTimeout(handle);
                reject(error);
            }
        );
    });
}
