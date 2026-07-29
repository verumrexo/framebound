import '../src/tests/setup.js';

const { Ship } = await import('../src/shared/entities/Ship.js');
const { PlayerControlSystem } = await import(
    '../src/game/systems/PlayerControlSystem.js'
);

const FRAME_RATES = [60, 120, 144];

const SCENARIOS = [
    {
        id: 'held-combat-1s',
        label: 'held w, combat, level 1, 1s',
        phases: [{ seconds: 1, keys: ['KeyW'] }]
    },
    {
        id: 'coast-after-1s',
        label: 'held w 1s, coast 1s',
        phases: [
            { seconds: 1, keys: ['KeyW'] },
            { seconds: 1, keys: [] }
        ]
    },
    {
        id: 'cleared-room-1s',
        label: 'held w, cleared room, level 1, 1s',
        outOfCombat: true,
        phases: [{ seconds: 1, keys: ['KeyW'] }]
    },
    {
        id: 'level-10-combat-1s',
        label: 'held w, combat, level 10, 1s',
        level: 10,
        phases: [{ seconds: 1, keys: ['KeyW'] }]
    },
    {
        id: 'one-booster-dash',
        label: 'held w+shift, one booster, 1.5s',
        boosterCount: 1,
        phases: [{ seconds: 1.5, keys: ['KeyW', 'ShiftLeft'] }]
    }
];

function speed(state) {
    return Math.hypot(state.vx, state.vy);
}

function distance(state) {
    return Math.hypot(state.x, state.y);
}

function simulateCurrent(hz, scenario) {
    const ship = new Ship();
    ship.x = 0;
    ship.y = 0;
    ship.vx = 0;
    ship.vy = 0;
    ship.rotation = 0;
    ship.stats.thrust = 0;
    ship.stats.totalMass = 5;
    ship.stats.turnSpeed = 0;
    ship.stats.boosterCount = scenario.boosterCount || 0;
    ship.permanentStats.speedMul = 1;
    ship.permanentStats.turnMul = 1;

    let activeKeys = new Set();
    const game = {
        x: 0,
        y: 0,
        vx: 0,
        vy: 0,
        rotation: 0,
        playerShip: ship,
        dashCooldown: 0,
        dashMaxCooldown: 10,
        dashActiveTimer: 0,
        dashDuration: 1.5,
        dashPower: 4000,
        input: { isKeyDown: key => activeKeys.has(key) },
        currentRoom: { cleared: Boolean(scenario.outOfCombat) },
        camera: { x: 0, y: 0, zoom: 1 },
        network: { isConnected: false },
        showNotification: () => {},
        audio: { play: () => {} }
    };
    const controls = new PlayerControlSystem(game);
    const dt = 1 / hz;

    for (const phase of scenario.phases) {
        activeKeys = new Set(phase.keys);
        const frames = Math.round(phase.seconds * hz);
        for (let frame = 0; frame < frames; frame++) {
            controls.updateDash(dt);
            const axes = controls.sampleMovementAxes();
            controls.applyMovement(dt, { x: 0, y: 0 }, axes);
        }
    }

    return {
        x: game.x,
        y: game.y,
        vx: game.vx,
        vy: game.vy,
        speed: speed(game),
        distance: distance(game)
    };
}

function simulateHistorical(hz, scenario) {
    const state = {
        x: 0,
        y: 0,
        vx: 0,
        vy: 0,
        rotation: 0,
        dashCooldown: 0,
        dashActiveTimer: 0
    };
    const boosterCount = scenario.boosterCount || 0;
    const levelBonus = 1 + ((scenario.level || 1) - 1) * 0.01;
    const combatBoost = scenario.outOfCombat ? 2 : 1;
    const thrustMultiplier = 1;
    const dt = 1 / hz;

    for (const phase of scenario.phases) {
        const keys = new Set(phase.keys);
        const frames = Math.round(phase.seconds * hz);

        for (let frame = 0; frame < frames; frame++) {
            if (state.dashCooldown > 0) state.dashCooldown -= dt;
            if (boosterCount > 0 &&
                keys.has('ShiftLeft') &&
                state.dashCooldown <= 0) {
                state.dashActiveTimer = 1.5;
                state.dashCooldown = Math.max(1, 10 / boosterCount);
            }

            if (state.dashActiveTimer > 0) {
                state.dashActiveTimer -= dt;
                const dashAngle = state.rotation - Math.PI / 2;
                state.vx += Math.cos(dashAngle) * 4000 * dt;
                state.vy += Math.sin(dashAngle) * 4000 * dt;
            }

            let inputX = 0;
            let inputY = 0;
            if (keys.has('KeyW')) inputY -= 1;
            if (keys.has('KeyS')) inputY += 1;
            if (keys.has('KeyA')) inputX -= 1;
            if (keys.has('KeyD')) inputX += 1;
            const magnitude = Math.hypot(inputX, inputY);
            if (magnitude > 0) {
                const acceleration =
                    2000 *
                    thrustMultiplier *
                    levelBonus *
                    combatBoost;
                state.vx += (inputX / magnitude) * acceleration * dt;
                state.vy += (inputY / magnitude) * acceleration * dt;
            }

            state.x += state.vx * dt;
            state.y += state.vy * dt;
            state.vx *= 0.92;
            state.vy *= 0.92;

            let maxVelocity = 800 * thrustMultiplier * levelBonus;
            if (state.dashActiveTimer > 0) maxVelocity *= 2.5;
            if (scenario.outOfCombat) maxVelocity *= 2;

            const currentSpeed = Math.hypot(state.vx, state.vy);
            if (currentSpeed > maxVelocity) {
                state.vx = (state.vx / currentSpeed) * maxVelocity;
                state.vy = (state.vy / currentSpeed) * maxVelocity;
            }
        }
    }

    return {
        ...state,
        speed: speed(state),
        distance: distance(state)
    };
}

const rows = [];
for (const scenario of SCENARIOS) {
    for (const hz of FRAME_RATES) {
        const current = simulateCurrent(hz, scenario);
        const historical = simulateHistorical(hz, scenario);
        rows.push({
            scenario: scenario.id,
            label: scenario.label,
            hz,
            currentSpeed: current.speed,
            historicalSpeed: historical.speed,
            currentDistance: current.distance,
            historicalDistance: historical.distance
        });
    }
}

console.log('| scenario | hz | current speed | historical speed | current distance | historical distance |');
console.log('| --- | ---: | ---: | ---: | ---: | ---: |');
for (const row of rows) {
    console.log(
        `| ${row.label} | ${row.hz} | ` +
        `${row.currentSpeed.toFixed(2)} | ${row.historicalSpeed.toFixed(2)} | ` +
        `${row.currentDistance.toFixed(2)} | ${row.historicalDistance.toFixed(2)} |`
    );
}

console.log('\njson:');
console.log(JSON.stringify(rows, null, 2));
