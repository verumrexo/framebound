import { Assets } from '../../Assets.js';
import { RemotePlayer } from '../../engine/RemotePlayer.js';
import { Renderer } from '../../engine/Renderer.js';
import { Viewport } from '../../engine/rendering/Viewport.js';
import { Drone } from '../../shared/entities/Drone.js';
import { DRONE_BLUEPRINTS } from '../../shared/combat/DroneBlueprints.js';
import { Portal } from '../../shared/entities/Portal.js';
import { Ship } from '../../shared/entities/Ship.js';
import { TrainingDummy } from '../../shared/entities/TrainingDummy.js';
import { PartsLibrary } from '../../shared/parts/Part.js';
import { EntityRenderer } from '../renderers/EntityRenderer.js';
import { WorldOverlayRenderer } from '../renderers/WorldOverlayRenderer.js';
import { drawProjectile } from '../renderers/ProjectileRenderer.js';
import { VaultRenderer } from '../renderers/VaultRenderer.js';

const FIXED_TIME = 1_700_000_000_000;

export const HARD_RASTER_HEADINGS_DEGREES = Object.freeze([
    0, 22.5, 45, 67.5, 90
]);

export const HARD_RASTER_RENDERER_PATH =
    'EntityRenderer.drawShip>ShipAssemblyRenderer.drawShipAssembly;' +
    'EntityRenderer.drawEnemy>ShipAssemblyRenderer.drawShipAssembly';

const HARD_RASTER_ENTITY_TYPES = Object.freeze([
    'local-ship', 'remote-player', 'modular-enemy', 'boss'
]);

function degreesToRadians(degrees) {
    return degrees * (Math.PI / 180);
}

/**
 * A data-only proof contract so tests can check the exact rotation samples
 * without having to mock a canvas, WebGL, or any sprites.
 */
export function createHardRasterProofScenes() {
    return HARD_RASTER_ENTITY_TYPES.flatMap((entityType, entityIndex) =>
        HARD_RASTER_HEADINGS_DEGREES.map((headingDegrees, headingIndex) => ({
            id: `${entityType}-${headingDegrees}`,
            entityType,
            headingDegrees,
            // Turrets deliberately do not follow the hull heading. These are
            // global aim directions, which is the path the game uses in play.
            turretAimDegrees: (157.5 + entityIndex * 45 + headingIndex * 22.5) % 360
        }))
    );
}

function isHardRasterProofRoute(search = globalThis.window?.location?.search || '') {
    return new URLSearchParams(search).get('visual-gallery') === 'hard-raster';
}

function isShopProofRoute(search = globalThis.window?.location?.search || '') {
    return new URLSearchParams(search).get('visual-gallery') === 'shop';
}

function isDroneFamilyProofRoute(search = globalThis.window?.location?.search || '') {
    return new URLSearchParams(search).get('visual-gallery') === 'drone-family';
}

export function getHardRasterProofScale(search = globalThis.window?.location?.search || '') {
    const requestedScale = Number(new URLSearchParams(search).get('raster-scale'));
    return [1, 2, 3].includes(requestedScale) ? requestedScale : 3;
}

function createSeededRandom(seed = 0x5eedc0de) {
    let state = seed >>> 0;
    return () => {
        state = (state * 1664525 + 1013904223) >>> 0;
        return state / 0x1_0000_0000;
    };
}

function withDeterministicVisuals(draw) {
    const originalNow = Date.now;
    const originalRandom = Math.random;
    Date.now = () => FIXED_TIME;
    Math.random = createSeededRandom();
    try {
        return draw();
    } finally {
        Date.now = originalNow;
        Math.random = originalRandom;
    }
}

function drawLabel(ctx, label, x, y, width) {
    ctx.fillStyle = 'rgba(0, 15, 25, 0.9)';
    ctx.fillRect(x, y, width, 28);
    ctx.strokeStyle = 'rgba(0, 255, 255, 0.35)';
    ctx.strokeRect(x, y, width, 28);
    ctx.fillStyle = '#00ffff';
    ctx.font = "10px 'Press Start 2P'";
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, x + width / 2, y + 15);
}

function drawPanel(renderer, panel, index, columns, panelWidth, panelHeight) {
    const column = index % columns;
    const row = Math.floor(index / columns);
    const x = column * panelWidth;
    const y = row * panelHeight;
    const ctx = renderer.ctx;

    ctx.save();
    ctx.beginPath();
    ctx.rect(x + 5, y + 5, panelWidth - 10, panelHeight - 10);
    ctx.clip();
    ctx.strokeStyle = 'rgba(0, 255, 255, 0.18)';
    ctx.strokeRect(x + 5, y + 5, panelWidth - 10, panelHeight - 10);
    ctx.translate(x + panelWidth / 2, y + panelHeight / 2 + 10);
    panel.draw(renderer);
    ctx.restore();

    drawLabel(ctx, panel.label, x + 5, y + 5, panelWidth - 10);
}

function createHardRasterEnemy({ headingRadians, aimRadians, boss = false }) {
    return {
        x: 0,
        y: 0,
        rotation: headingRadians,
        rotationOffset: 0,
        aimAngle: aimRadians,
        radius: boss ? 54 : 38,
        hp: boss ? 750 : 75,
        maxHp: boss ? 1000 : 100,
        isDead: false,
        isWarpingIn: false,
        weaponCooldowns: [],
        random: () => 0.5,
        // Keep this compact enough to judge every 22.5-degree sample, while
        // retaining a real modular hull plus independently aimed weapons.
        shipParts: boss
            ? [
                { x: 0, y: 0, partId: 'core', rotation: 0 },
                { x: -1, y: 0, partId: 'hull', rotation: 0 },
                { x: 1, y: 0, partId: 'hull', rotation: 0 },
                { x: -1, y: -1, partId: 'gun_basic', rotation: 1 },
                { x: 1, y: -1, partId: 'rocketle', rotation: 1 }
            ]
            : [
                { x: 0, y: 0, partId: 'core', rotation: 0 },
                { x: -1, y: 0, partId: 'gun_basic', rotation: 0 },
                { x: 1, y: 0, partId: 'rocketle', rotation: 0 },
                { x: 0, y: 1, partId: 'custom_1767997495375', rotation: 0 }
            ]
    };
}

function createVaultProofRoom(phase, contractId = null) {
    return {
        x: -500,
        y: -500,
        width: 1000,
        height: 1000,
        vaultState: {
            phase,
            contractId,
            elapsed: phase === 'containment' ? 9 : 0
        },
        vaultChests: [
            {
                x: -180,
                y: 60,
                contractId: 'gilded',
                sealed: Boolean(contractId && contractId !== 'gilded'),
                life: 2
            },
            {
                x: 180,
                y: 60,
                contractId: 'blood',
                sealed: Boolean(contractId && contractId !== 'blood'),
                life: 2
            }
        ]
    };
}

function drawHardRasterEntity(renderer, scene) {
    const headingRadians = degreesToRadians(scene.headingDegrees);
    const aimRadians = degreesToRadians(scene.turretAimDegrees);
    const aimDistance = 1000;
    const aimX = Math.cos(aimRadians) * aimDistance;
    const aimY = Math.sin(aimRadians) * aimDistance;

    if (scene.entityType === 'local-ship') {
        const ship = new Ship();
        ship.rotation = headingRadians;
        EntityRenderer.drawShip(renderer, ship, aimX, aimY);
        return;
    }

    if (scene.entityType === 'remote-player') {
        const sourceShip = new Ship();
        const remote = new RemotePlayer('hard-raster-proof');
        remote.x = 0;
        remote.y = 0;
        remote.rotation = headingRadians;
        remote.setShipData(Array.from(sourceShip.getUniqueParts(), part => ({ ...part })));
        EntityRenderer.drawShip(renderer, remote, aimX, aimY);
        return;
    }

    EntityRenderer.drawEnemy(renderer, createHardRasterEnemy({
        headingRadians,
        aimRadians,
        boss: scene.entityType === 'boss'
    }));
}

function drawHardRasterPanel(renderer, scene, index, columns, panelWidth, panelHeight) {
    const column = index % columns;
    const row = Math.floor(index / columns);
    const x = column * panelWidth;
    const y = row * panelHeight;
    const ctx = renderer.ctx;

    ctx.save();
    ctx.beginPath();
    ctx.rect(x + 3, y + 3, panelWidth - 6, panelHeight - 6);
    ctx.clip();
    ctx.strokeStyle = 'rgba(0, 255, 255, 0.24)';
    ctx.strokeRect(x + 3, y + 3, panelWidth - 6, panelHeight - 6);
    ctx.translate(x + panelWidth / 2, y + panelHeight / 2 + 8);
    drawHardRasterEntity(renderer, scene);
    ctx.restore();

    drawLabel(
        ctx,
        `${scene.entityType} ${scene.headingDegrees}\u00b0 / aim ${scene.turretAimDegrees}\u00b0`,
        x + 3,
        y + 3,
        panelWidth - 6
    );
}

function renderHardRasterProof(canvas) {
    document.title = 'framebound hard raster proof';
    const rasterScale = getHardRasterProofScale();
    const renderer = new Renderer(canvas, {
        viewport: new Viewport(canvas, { worldPixelScale: rasterScale })
    });
    renderer.clear('#03070c');

    const scenes = createHardRasterProofScenes();
    const columns = HARD_RASTER_HEADINGS_DEGREES.length;
    const rows = HARD_RASTER_ENTITY_TYPES.length;
    const panelWidth = renderer.width / columns;
    const panelHeight = renderer.height / rows;

    withDeterministicVisuals(() => {
        scenes.forEach((scene, index) => drawHardRasterPanel(
            renderer,
            scene,
            index,
            columns,
            panelWidth,
            panelHeight
        ));
    });

    renderer.present();
    canvas.dataset.visualGalleryMode = 'hard-raster';
    canvas.dataset.visualGalleryHeadings = JSON.stringify(HARD_RASTER_HEADINGS_DEGREES);
    canvas.dataset.visualGalleryRendererPath = HARD_RASTER_RENDERER_PATH;
    canvas.dataset.visualGalleryRasterScale = String(rasterScale);
    canvas.dataset.visualGalleryProofComplete = 'true';
    canvas.dataset.visualGalleryReady = 'true';
    return scenes;
}

export function createShopProofItems(centerX = 0, centerY = 0) {
    const offers = [
        {
            type: 'heal',
            name: 'repair kit',
            description: 'restore 50 hp',
            price: 20
        },
        {
            type: 'part',
            name: PartsLibrary.gun_basic.name,
            partId: 'gun_basic',
            description: 'weapon',
            price: 40,
            partDef: PartsLibrary.gun_basic
        },
        {
            type: 'part',
            name: PartsLibrary.railgun.name,
            partId: 'railgun',
            description: 'weapon',
            price: 80,
            partDef: PartsLibrary.railgun
        },
        {
            type: 'part',
            name: PartsLibrary.custom_1768410823264.name,
            partId: 'custom_1768410823264',
            description: 'shield',
            price: 55,
            partDef: PartsLibrary.custom_1768410823264,
            purchased: true
        }
    ];
    return offers.map((data, index) => ({
        x: centerX - 360 + index * 240,
        y: centerY,
        radius: 40,
        life: 0,
        bobOffset: index * 0.45,
        purchased: Boolean(data.purchased),
        data,
        partDef: data.partDef
    }));
}

function renderShopProof(canvas) {
    document.title = 'framebound shop terminal proof';
    const renderer = new Renderer(canvas);
    renderer.clear('#03070c');

    const centerX = renderer.width / 2;
    const centerY = renderer.height * 0.58;
    const items = createShopProofItems(centerX, centerY);
    const ctx = renderer.ctx;
    ctx.save();
    ctx.strokeStyle = 'rgba(85, 255, 194, 0.18)';
    ctx.lineWidth = 4;
    ctx.strokeRect(140, 120, renderer.width - 280, renderer.height - 220);
    ctx.restore();

    items.forEach(item => EntityRenderer.drawShopItem(renderer, item, { credits: 65 }));

    const game = {
        renderer: {
            ctx,
            withWorldOverlay: (_camera, draw) => draw()
        },
        camera: { x: 0, y: 0, zoom: 1 },
        floor: 0,
        rooms: [],
        enemies: [],
        bosses: [],
        network: { otherPlayers: new Map() },
        shopItems: items,
        hoveredShopItem: items[1],
        hoveredTreasureChest: null,
        hoveredVaultChest: null,
        currentRoom: { type: 'shop' },
        playerShip: { hp: 100, maxHp: 100 },
        gold: 65,
        showDamageNumbers: false,
        damageNumbers: []
    };
    withDeterministicVisuals(() => new WorldOverlayRenderer(game).draw());

    renderer.present();
    canvas.dataset.visualGalleryMode = 'shop';
    canvas.dataset.visualGalleryShopStates = 'affordable,affordable,unaffordable,sold';
    canvas.dataset.visualGalleryReady = 'true';

    const proofImage = document.createElement('img');
    proofImage.id = 'visual-gallery-proof';
    proofImage.alt = 'deterministic framebound shop terminal proof';
    proofImage.src = canvas.toDataURL('image/png');
    proofImage.style.position = 'fixed';
    proofImage.style.inset = '0';
    proofImage.style.width = '100vw';
    proofImage.style.height = '100vh';
    proofImage.style.objectFit = 'contain';
    proofImage.style.imageRendering = 'pixelated';
    proofImage.style.background = '#03070c';
    proofImage.style.zIndex = '1';
    document.body.appendChild(proofImage);
    canvas.style.display = 'none';
}

export function createDroneFamilyProofEntries() {
    return Object.values(PartsLibrary)
        .filter(definition => definition.type === 'drone' && definition.id !== 'custom_1769974460678')
        .map(definition => {
            const blueprint = DRONE_BLUEPRINTS[definition.stats.droneType];
            return {
                partId: definition.id,
                carrierLabel: definition.name,
                droneType: blueprint.id,
                droneLabel: blueprint.label,
                partDef: definition
            };
        });
}

function renderDroneFamilyProof(canvas) {
    document.title = 'framebound drone family proof';
    const renderer = new Renderer(canvas);
    renderer.clear('#03070c');
    const entries = createDroneFamilyProofEntries();
    const columns = 5;
    const rows = 2;
    const panelWidth = renderer.width / columns;
    const panelHeight = renderer.height / rows;
    const ctx = renderer.ctx;

    withDeterministicVisuals(() => {
        entries.forEach((entry, index) => {
            const x = index % columns * panelWidth;
            const y = Math.floor(index / columns) * panelHeight;
            ctx.save();
            ctx.strokeStyle = 'rgba(0, 255, 255, 0.22)';
            ctx.strokeRect(x + 6, y + 6, panelWidth - 12, panelHeight - 12);
            ctx.translate(x + panelWidth / 2, y + panelHeight / 2);

            ctx.save();
            ctx.scale(0.62, 0.62);
            entry.partDef.sprite.draw(ctx, -58, 0, 0);
            ctx.restore();

            const drone = new Drone(58, 0, null, 'player', () => 0.5, {
                type: entry.droneType
            });
            ctx.save();
            ctx.scale(2.2, 2.2);
            EntityRenderer.drawDrone(renderer, drone);
            ctx.restore();
            ctx.restore();

            drawLabel(
                ctx,
                `${entry.carrierLabel} // ${entry.droneLabel}`,
                x + 8,
                y + panelHeight - 38,
                panelWidth - 16
            );
        });
    });

    renderer.present();
    canvas.dataset.visualGalleryMode = 'drone-family';
    canvas.dataset.visualGalleryDroneCount = String(entries.length);
    canvas.dataset.visualGalleryReady = 'true';

    const proofImage = document.createElement('img');
    proofImage.id = 'visual-gallery-proof';
    proofImage.alt = 'deterministic framebound drone family proof';
    proofImage.src = canvas.toDataURL('image/png');
    proofImage.style.position = 'fixed';
    proofImage.style.inset = '0';
    proofImage.style.width = '100vw';
    proofImage.style.height = '100vh';
    proofImage.style.objectFit = 'contain';
    proofImage.style.imageRendering = 'pixelated';
    proofImage.style.background = '#03070c';
    proofImage.style.zIndex = '1';
    document.body.appendChild(proofImage);
    canvas.style.display = 'none';
    return entries;
}

function createPanels() {
    const ship = new Ship();
    ship.x = 0;
    ship.y = 0;
    ship.rotation = 0.2;

    const remoteShip = ship.clone();
    remoteShip.x = 0;
    remoteShip.y = 0;
    remoteShip.rotation = -0.4;

    const enemy = {
        x: 0,
        y: 0,
        rotation: -0.2,
        rotationOffset: 0,
        aimAngle: 0.2,
        radius: 35,
        hp: 75,
        maxHp: 100,
        isDead: false,
        isWarpingIn: false,
        shipParts: [
            { x: 0, y: 0, partId: 'core', rotation: 0 },
            { x: -1, y: 0, partId: 'gun_basic', rotation: 0 },
            { x: 1, y: 0, partId: 'gun_basic', rotation: 0 }
        ],
        weaponCooldowns: [],
        random: () => 0.5
    };
    const boss = {
        ...enemy,
        rotation: 0.1,
        hp: 750,
        maxHp: 1000,
        radius: 55,
        shipParts: [
            { x: 0, y: 0, partId: 'core', rotation: 0 },
            { x: -1, y: 0, partId: 'hull', rotation: 0 },
            { x: 1, y: 0, partId: 'hull', rotation: 0 },
            { x: -2, y: 0, partId: 'gun_basic', rotation: 0 },
            { x: 2, y: 0, partId: 'gun_basic', rotation: 0 }
        ]
    };

    const portal = new Portal(0, 0);
    portal.rotation = 0.5;

    const wreckShip = new Ship();
    const wreck = {
        x: 0,
        y: 0,
        rotation: -0.35,
        isDead: false,
        ship: wreckShip
    };

    const drone = new Drone(0, 0, null, 'player', () => 0.5);
    drone.rotation = 0.4;

    const dummy = new TrainingDummy(0, 20);
    dummy.currentDps = 321;

    return [
        {
            label: 'player ship',
            draw: renderer => EntityRenderer.drawShip(
                renderer,
                ship,
                150,
                -40
            )
        },
        {
            label: 'enemy ship + hp',
            draw: renderer => EntityRenderer.drawEnemy(renderer, enemy)
        },
        {
            label: 'remote player',
            draw: renderer => EntityRenderer.drawShip(
                renderer,
                remoteShip,
                130,
                20
            )
        },
        {
            label: 'boss bounds + hp',
            draw: renderer => EntityRenderer.drawEnemy(renderer, boss)
        },
        {
            label: 'projectile families',
            draw: renderer => {
                const types = [
                    'bullet',
                    'laser',
                    'rocket_le',
                    'rocket_he',
                    'cluster_grenade'
                ];
                types.forEach((type, index) => drawProjectile(renderer, {
                    delay: 0,
                    owner: 'player',
                    type,
                    x: -90 + index * 45,
                    y: 0,
                    angle: 0,
                    radius: 3,
                    beamLength: 80,
                    maxLife: 2,
                    life: 1,
                    railStayTime: 1,
                    spinAngle: 0.3
                }));
            }
        },
        {
            label: 'asteroid silhouette',
            draw: renderer => EntityRenderer.drawAsteroid(renderer, {
                x: 0,
                y: 0,
                rotation: 0.25,
                type: 'crystal_blue',
                isDead: false,
                isBroken: false,
                radius: 45,
                vertices: [
                    { x: -45, y: -15 },
                    { x: -15, y: -45 },
                    { x: 35, y: -30 },
                    { x: 45, y: 20 },
                    { x: 5, y: 45 },
                    { x: -40, y: 25 }
                ],
                random: () => 0.5
            })
        },
        {
            label: 'loot crate',
            draw: renderer => EntityRenderer.drawLootCrate(renderer, {
                x: 0,
                y: 0,
                rotation: 0.2,
                width: 64,
                height: 64,
                wTiles: 2,
                hTiles: 2,
                isOpened: false,
                baseColor: '#506070',
                detailColor: '#304050',
                lightColor: '#00ffff',
                random: () => 0.5
            })
        },
        {
            label: 'xp / gold / hp',
            draw: renderer => {
                EntityRenderer.drawOrb(renderer, {
                    x: -60,
                    y: 0,
                    radius: 5,
                    color: '#00ffff',
                    pulseAngle: 0.5,
                    isDead: false
                });
                EntityRenderer.drawOrb(renderer, {
                    x: 0,
                    y: 0,
                    radius: 10,
                    color: '#ffd700',
                    rotation: 1,
                    isDead: false
                });
                EntityRenderer.drawOrb(renderer, {
                    x: 60,
                    y: 0,
                    radius: 10,
                    color: '#44ff44',
                    rotation: 0.5,
                    isDead: false
                });
            }
        },
        {
            label: 'exit portal',
            draw: renderer => EntityRenderer.drawPortal(renderer, portal)
        },
        {
            label: 'part pickup',
            draw: renderer => EntityRenderer.drawItemPickup(renderer, {
                x: 0,
                y: 0,
                life: 0,
                bobOffset: 0,
                isDead: false,
                def: PartsLibrary.rocketle
            })
        },
        {
            label: 'shipwreck',
            draw: renderer => EntityRenderer.drawShipwreck(renderer, wreck)
        },
        {
            label: 'treasure cache',
            draw: renderer => {
                EntityRenderer.drawTreasureChest(renderer, {
                    x: 0,
                    y: 0,
                    life: 0,
                    bobOffset: 0,
                    rotation: 0,
                    opened: false,
                    sprite: Assets.TreasureChest
                });
            }
        },
        ...[
            ['vault // offer', 'offer', null],
            ['vault // containment', 'containment', 'blood'],
            ['vault // reward', 'reward', 'gilded'],
            ['vault // completed', 'completed', 'gilded']
        ].map(([label, phase, contractId]) => ({
            label,
            draw: renderer => {
                renderer.ctx.save();
                renderer.ctx.scale(0.18, 0.18);
                VaultRenderer.draw(
                    renderer,
                    createVaultProofRoom(phase, contractId),
                    true
                );
                renderer.ctx.restore();
            }
        })),
        {
            label: 'shop heal / part',
            draw: renderer => {
                EntityRenderer.drawShopItem(renderer, {
                    x: -55,
                    y: 0,
                    life: 0,
                    bobOffset: 0,
                    radius: 24,
                    purchased: false,
                    data: { type: 'heal', price: 20 }
                });
                EntityRenderer.drawShopItem(renderer, {
                    x: 55,
                    y: 0,
                    life: 0,
                    bobOffset: 0,
                    radius: 24,
                    purchased: false,
                    data: { type: 'part', price: 40 },
                    partDef: PartsLibrary.gun_basic
                });
            }
        },
        {
            label: 'combat drone',
            draw: renderer => EntityRenderer.drawDrone(renderer, drone)
        },
        {
            label: 'training dummy',
            draw: renderer => EntityRenderer.drawTrainingDummy(
                renderer,
                dummy
            )
        }
    ];
}

export function renderVisualGallery(canvas) {
    if (isHardRasterProofRoute()) {
        return renderHardRasterProof(canvas);
    }
    if (isShopProofRoute()) {
        return renderShopProof(canvas);
    }
    if (isDroneFamilyProofRoute()) {
        return renderDroneFamilyProof(canvas);
    }

    document.title = 'framebound visual parity gallery';
    const renderer = new Renderer(canvas);
    renderer.clear('#03070c');

    const columns = 4;
    const panels = createPanels();
    const rows = Math.ceil(panels.length / columns);
    const panelWidth = renderer.width / columns;
    const panelHeight = renderer.height / rows;
    const originalNow = Date.now;

    Date.now = () => FIXED_TIME;
    try {
        panels.forEach((panel, index) => drawPanel(
            renderer,
            panel,
            index,
            columns,
            panelWidth,
            panelHeight
        ));
    } finally {
        Date.now = originalNow;
    }

    // Gallery panels are world pixels too; make the compositor boundary explicit
    // before exporting the evidence image.
    renderer.present();
    canvas.dataset.visualGalleryReady = 'true';

    const proofImage = document.createElement('img');
    proofImage.id = 'visual-gallery-proof';
    proofImage.alt = 'deterministic framebound visual parity gallery';
    proofImage.src = canvas.toDataURL('image/png');
    proofImage.hidden = true;
    document.body.appendChild(proofImage);
}
