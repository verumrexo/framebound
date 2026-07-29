import { Assets } from '../../Assets.js';
import { Renderer } from '../../engine/Renderer.js';
import { Drone } from '../../shared/entities/Drone.js';
import { Portal } from '../../shared/entities/Portal.js';
import { Ship } from '../../shared/entities/Ship.js';
import { TrainingDummy } from '../../shared/entities/TrainingDummy.js';
import { PartsLibrary } from '../../shared/parts/Part.js';
import { EntityRenderer } from '../renderers/EntityRenderer.js';
import { drawProjectile } from '../renderers/ProjectileRenderer.js';

const FIXED_TIME = 1_700_000_000_000;

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
            label: 'treasure / vault',
            draw: renderer => {
                EntityRenderer.drawTreasureChest(renderer, {
                    x: -55,
                    y: 0,
                    life: 0,
                    bobOffset: 0,
                    rotation: 0,
                    opened: false,
                    sprite: Assets.TreasureChest
                });
                EntityRenderer.drawVaultChest(renderer, {
                    x: 55,
                    y: 0,
                    life: 0,
                    bobOffset: 0,
                    rotation: 0.3,
                    opened: false,
                    ambushActive: true,
                    costType: 'hp',
                    sprite: Assets.TreasureChest
                });
            }
        },
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
    document.title = 'framebound visual parity gallery';
    const renderer = new Renderer(canvas);
    renderer.setSmoothing(false);
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

    canvas.dataset.visualGalleryReady = 'true';

    const proofImage = document.createElement('img');
    proofImage.id = 'visual-gallery-proof';
    proofImage.alt = 'deterministic framebound visual parity gallery';
    proofImage.src = canvas.toDataURL('image/png');
    proofImage.hidden = true;
    document.body.appendChild(proofImage);
}
