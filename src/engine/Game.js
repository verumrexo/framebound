import { Renderer } from './Renderer.js';
import { GameLoop } from './GameLoop.js';
import { Input } from './Input.js';
import { Camera } from './Camera.js';
import { Assets } from '../Assets.js';
import { Projectile } from '../game/entities/Projectile.js';
import { Ship } from '../game/entities/Ship.js';
import { Enemy } from '../game/entities/Enemy.js';
import { PartsLibrary, UserPartsLibrary, TILE_SIZE } from '../game/parts/Part.js';
import { Hangar } from '../game/systems/Hangar.js';
import { Designer } from '../game/systems/Designer.js';

import { Starfield } from '../game/environment/Starfield.js';
import { Grid } from '../game/environment/Grid.js';
import { LevelGenerator, RoomType } from '../game/environment/LevelGenerator.js';
import { Minimap } from '../game/ui/Minimap.js';
import { XPOrb } from '../game/entities/XPOrb.js';
import { TrainingDummy } from '../game/entities/TrainingDummy.js';
import { Boss } from '../game/entities/Boss.js';
import { Portal } from '../game/entities/Portal.js';
import { GoldOrb } from '../game/entities/GoldOrb.js';
import { Asteroid } from '../game/entities/Asteroid.js';
import { LootCrate } from '../game/entities/LootCrate.js';
import { ItemPickup } from '../game/entities/ItemPickup.js';
import { Shipwreck } from '../game/entities/Shipwreck.js';
import { SaveManager } from '../game/systems/SaveManager.js';
import { ShipBuilder } from '../game/systems/ShipBuilder.js';
import { AudioManager } from './AudioManager.js';

export class Game {
    constructor(canvas) {
        this.renderer = new Renderer(canvas);
        this.input = new Input(canvas);
        this.camera = new Camera(this.renderer.width, this.renderer.height);
        this.audio = new AudioManager();
        this.camera = new Camera(this.renderer.width, this.renderer.height);
        this.audio = new AudioManager();
        this.loadingPromise = this.loadSounds();
        this.projectiles = [];
        this.enemies = [];
        this.bosses = [];
        this.portals = [];
        this.xpOrbs = [];
        this.xpOrbs = [];
        this.goldOrbs = [];
        this.itemPickups = [];
        this.shipwrecks = [];
        this.asteroids = [];
        this.lootCrates = [];
        this.shopItems = [];
        this.treasureChests = [];
        this.vaultChests = [];
        this.xp = 0;
        this.gold = 0;
        this.level = 1;
        this.xpToNext = 100;
        this.xpToNext = 100;
        this.enemySpawnTimer = 0;
        this.version = "v0.2.0";

        this.starfield = new Starfield(400, 4000, 4000); // Many stars, large area
        this.grid = new Grid(200); // 200px cells

        // Level Generation
        this.levelGen = new LevelGenerator();
        this.rooms = this.levelGen.generate(15);
        this.currentRoom = this.levelGen.getRoom(0, 0);
        this.currentRoom.onEnter(this); // Init start room

        // Check for saved game
        this.hasPendingSave = SaveManager.hasSave();
        if (this.hasPendingSave) {
            console.log('[Save] Found existing save, will prompt to continue');
        }

        // Add initial enemy for testing (Manual add vs Generator add?)
        // The generator adds enemies to rooms, so we might rely on that.
        // But keeping manual one for immediate test if randomgen fails.
        // this.enemies.push(new Enemy(400, -200)); 
        // ^ Commented out to rely on Room generation logic

        this.playerShip = new Ship();
        this.hangar = new Hangar(this);
        this.designer = new Designer(this);
        this.shipBuilder = new ShipBuilder(this);

        // Minimap (Top Right, 200x200)
        // Adjust x/y dynamically in update/draw or set initial here
        this.minimap = new Minimap(this.renderer.width - 220, 20, 200, 0.03);

        // Toggle Hangar with Tab
        window.addEventListener('keydown', (e) => {
            if (this.designer.active) return; // Block tab in designer

            if (e.code === 'Tab') {
                e.preventDefault();
                this.hangar.toggle();
            }

            if (e.key === 'Escape') {
                this.paused = !this.paused;
            }

            if (e.key === 'f' || e.key === 'F') {
                // Spawn Shipwreck nearby
                this.shipwrecks.push(new Shipwreck(this.x + 200, this.y + 200));
            }

            if (e.key === 'g' || e.key === 'G') {
                // Spawn Training Dummy near player
                this.enemies.push(new TrainingDummy(this.x + 200, this.y));
            }

            if (e.key === 'm' || e.key === 'M') {
                // Open Ship Builder (Dev Tool)
                if (!this.hangar.active && !this.designer.active) {
                    this.shipBuilder.toggle();
                }
            }

            // Spawn XP Orb at Cursor for testing
            if (e.code === 'KeyP') { // Original KeyP for XP Orb
                const mouse = this.input.getMousePos();
                const zoom = this.camera.zoom || 1;
                const worldX = (mouse.x / zoom) + this.camera.x;
                const worldY = (mouse.y / zoom) + this.camera.y;
                this.xpOrbs.push(new XPOrb(worldX, worldY, 10));
            }

            if (e.code === 'KeyO') {
                const mouse = this.input.getMousePos();
                const zoom = this.camera.zoom || 1;
                const worldX = (mouse.x / zoom) + this.camera.x;
                const worldY = (mouse.y / zoom) + this.camera.y;
                this.goldOrbs.push(new GoldOrb(worldX, worldY, 1));
            }

            // Spawn Asteroid at Cursor for testing
            if (e.code === 'KeyL') {
                const mouse = this.input.getMousePos();
                const zoom = this.camera.zoom || 1;
                const worldX = (mouse.x / zoom) + this.camera.x;
                const worldY = (mouse.y / zoom) + this.camera.y;

                // Randomize type
                const rType = Math.random();
                let type = 'rock';
                if (rType < 0.3) type = 'crystal_blue';
                else if (rType < 0.6) type = 'crystal_gold';

                this.asteroids.push(new Asteroid(worldX, worldY, 'medium', type));
            }

            // Spawn Loot Crate at Cursor for testing
            if (e.code === 'KeyK') {
                const mouse = this.input.getMousePos();
                const zoom = this.camera.zoom || 1;
                const worldX = (mouse.x / zoom) + this.camera.x;
                const worldY = (mouse.y / zoom) + this.camera.y;

                // Randomize Size
                const sizes = ['1x1', '1x2', '2x2'];
                const size = sizes[Math.floor(Math.random() * sizes.length)];
                this.lootCrates.push(new LootCrate(worldX, worldY, size));
            }
        });

        this.loop = new GameLoop(
            (dt) => this.update(dt),
            () => this.draw()
        );

        // Listen to resize for camera
        window.addEventListener('resize', () => {
            this.camera.resize(window.innerWidth, window.innerHeight);
        });

        // Player State
        // Center in start room (Room unit size is 2000)
        this.x = 1000;
        this.y = 1000;
        this.vx = 0;
        this.vy = 0;
        this.acceleration = 2000;
        this.friction = 0.92;
        this.rotation = 0;
        this.turretAngle = 0;

        this.paused = false;
        this.isGameOver = false;
        this.mouseDownLastFrame = false;
        this.staggerTimer = 0;
        this.coreSpinAngle = 0;
        this.explosions = []; // {x, y, radius, life, maxLife}
        this.notifications = []; // {text, color, life, maxLife}
        this.enemies = [];
        this.bosses = [];
        this.portals = [];
        this.dashCooldown = 0;
        this.dashMaxCooldown = 10;
        this.dashActiveTimer = 0;
        this.dashDuration = 1.5; // 3x longer (was 0.5)
        this.dashPower = 4000;
    }

    start() {
        // Check if we should prompt for continue
        if (this.hasPendingSave) {
            this.showContinuePrompt();
        } else {
            // New Game - Show Start Screen
            this.showStartScreen();
        }
    }

    showStartScreen() {
        const overlay = document.createElement('div');
        overlay.id = 'start-screen';
        overlay.style.cssText = `
            position: fixed;
            top: 0; left: 0; right: 0; bottom: 0;
            background: rgba(0, 0, 0, 0.9);
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            z-index: 2000;
            font-family: 'VT323', monospace;
            color: white;
            transition: opacity 0.5s;
        `;

        overlay.innerHTML = `
            <h1 style="color: #00ffff; font-size: 64px; margin-bottom: 0px; text-shadow: 0 0 20px #00ffff;">frame bound</h1>
            <p style="color: #666; font-size: 20px; margin-bottom: 50px;">v0.2.0 - curséd vaults</p>
            
            <div id="loading-text" style="color: #ffd700; font-size: 24px;">initializing systems...</div>
            
            <button id="btn-start" style="
                display: none;
                padding: 15px 50px; 
                font-size: 32px; 
                background: #00aaee; 
                color: white; 
                border: 2px solid #fff; 
                cursor: pointer; 
                font-family: 'VT323', monospace;
                box-shadow: 0 0 15px #00aaee;
            ">launch mission</button>
        `;

        document.body.appendChild(overlay);

        // Wait for assets, then show button
        this.loadingPromise.then(() => {
            const btn = document.getElementById('btn-start');
            const loading = document.getElementById('loading-text');
            if (btn && loading) {
                loading.style.display = 'none';
                // Show "LAUNCH MISSION"
                btn.style.display = 'block';

                btn.onclick = () => {
                    // Unlock Audio Context (must be in user event)
                    if (this.audio.context.state === 'suspended') {
                        this.audio.context.resume();
                    }

                    // Start Game
                    this.loop.start();
                    this.audio.playMusic('bgm', 0.4);

                    // Fade out
                    overlay.style.opacity = '0';
                    setTimeout(() => overlay.remove(), 500);
                };
            }
        });
    }

    showContinuePrompt() {
        // Create a simple HTML overlay for continue prompt
        const overlay = document.createElement('div');
        overlay.id = 'continue-prompt';
        overlay.style.cssText = `
            position: fixed;
            top: 0; left: 0; right: 0; bottom: 0;
            background: rgba(0, 0, 0, 0.9);
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            z-index: 2000;
            font-family: 'VT323', monospace;
            color: white;
        `;

        overlay.innerHTML = `
            <h1 style="color: #00ff00; font-size: 48px; margin-bottom: 20px;">save found</h1>
            <p style="color: #aaa; font-size: 24px; margin-bottom: 40px;">continue from last checkpoint?</p>
            <div style="display: flex; gap: 20px;">
                <button id="btn-continue" style="padding: 15px 40px; font-size: 24px; background: #00aa00; color: white; border: none; cursor: pointer; font-family: 'VT323', monospace;">continue</button>
                <button id="btn-new" style="padding: 15px 40px; font-size: 24px; background: #aa0000; color: white; border: none; cursor: pointer; font-family: 'VT323', monospace;">new game</button>
            </div>
        `;

        document.body.appendChild(overlay);

        document.getElementById('btn-continue').onclick = () => {
            // Unlock Audio
            if (this.audio.context.state === 'suspended') {
                this.audio.context.resume();
            }

            this.loadFromSave();
            this.loop.start();
            this.audio.playMusic('bgm', 0.4);
            overlay.remove();
        };

        document.getElementById('btn-new').onclick = () => {
            SaveManager.clearSave();
            overlay.remove();
            this.hasPendingSave = false; // logic update
            this.showStartScreen(); // Go to normal start flow
        };
    }

    loadFromSave() {
        const save = SaveManager.load();
        if (!save) {
            console.warn('[Save] No save data found');
            return;
        }

        // Regenerate level with saved seed to get same layout
        if (save.levelSeed !== undefined) {
            this.rooms = this.levelGen.generate(15, save.levelSeed);
        }

        // Restore basic stats
        this.level = save.level;
        this.xp = save.xp;
        this.gold = save.gold;
        this.xpToNext = save.xpToNext;

        // Restore player position
        this.x = save.playerPosition.x;
        this.y = save.playerPosition.y;
        this.rotation = save.playerPosition.rotation;

        // Restore ship HP
        this.playerShip.hp = save.playerShip.hp;
        this.playerShip.maxHp = save.playerShip.maxHp;

        // Restore ship parts
        this.playerShip.parts.clear();
        for (const partData of save.playerShip.parts) {
            this.playerShip.addPart(partData.x, partData.y, partData.partId, partData.rotation);
        }
        this.playerShip.recalculateStats();

        // Restore inventory
        this.hangar.inventory = { ...save.inventory };
        this.hangar.updateUI();

        // Mark visited rooms
        for (const roomKey of save.visitedRooms) {
            const [gx, gy] = roomKey.split(',').map(Number);
            const room = this.levelGen.getRoom(gx, gy);
            if (room) {
                room.visited = true;
                room.cleared = true;
                room.locked = false;
            }
        }

        // Set current room
        const currentRoom = this.levelGen.getRoom(save.currentRoomGrid.x, save.currentRoomGrid.y);
        if (currentRoom) {
            this.currentRoom = currentRoom;
        }

        this.showNotification('save loaded!', '#00ff00');
        console.log('[Save] Game restored from save');
    }

    async loadSounds() {
        // We'll define standard names. User should rename their .wav files to match these or tell us the names!
        const soundList = [
            { name: 'shoot_laser', url: './sounds/laser.wav' },
            { name: 'shoot_rocket', url: './sounds/rocket.wav' },
            { name: 'shoot_mini', url: './sounds/mini.wav' },
            { name: 'explosion', url: './sounds/explosion.wav' },
            { name: 'hit', url: './sounds/hit.wav' },
            { name: 'overheat', url: './sounds/overheat.wav' },
            { name: 'rail_charge', url: './sounds/rail_charge.wav' },
            { name: 'rail', url: './sounds/rail.wav' },
            { name: 'rail_shot', url: './sounds/rail_shot.wav' },
            { name: 'enemy_death1', url: './sounds/enemy_death1.wav' },
            { name: 'enemy_death2', url: './sounds/enemy_death2.wav' },
            { name: 'frame_death', url: './sounds/frame_death.wav' },
            { name: 'shoot_dart', url: './sounds/dart.wav' },
            { name: 'bgm', url: '/sounds/bgm.mp3' }
        ];

        for (const s of soundList) {
            await this.audio.load(s.name, s.url);
        }
    }

    showNotification(text, color = '#00ffff') {
        this.notifications.push({
            text: text.toLowerCase(),
            color,
            life: 3.0,
            maxLife: 3.0
        });
    }

    autoSave() {
        if (SaveManager.save(this)) {
            this.showNotification('progress saved', '#44ff44');
        }
    }

    spawnAsteroidLoot(asteroid) {
        if (asteroid.type === 'crystal_blue') {
            const count = 3 + Math.floor(Math.random() * 3);
            for (let k = 0; k < count; k++) {
                const ox = asteroid.x + (Math.random() - 0.5) * 20;
                const oy = asteroid.y + (Math.random() - 0.5) * 20;
                this.xpOrbs.push(new XPOrb(ox, oy, 10));
            }
        } else if (asteroid.type === 'crystal_gold') {
            const count = 1 + Math.floor(Math.random() * 2);
            for (let k = 0; k < count; k++) {
                const ox = asteroid.x + (Math.random() - 0.5) * 20;
                const oy = asteroid.y + (Math.random() - 0.5) * 20;
                this.goldOrbs.push(new GoldOrb(ox, oy, 1));
            }
        }
        this.audio.play('explosion', { volume: 0.5, pitch: 0.8 });
    }

    spawnCrateLoot(crate) {
        const count = 3 + Math.floor(Math.random() * 3);
        // Variant 0 (Grey/Cyan) = XP
        if (crate.variant === 0) {
            for (let k = 0; k < count; k++) {
                const ox = crate.x + (Math.random() - 0.5) * 20;
                const oy = crate.y + (Math.random() - 0.5) * 20;
                this.xpOrbs.push(new XPOrb(ox, oy, 10));
            }
        } else if (crate.variant === 1) {
            // Variant 1 (Brown/Orange) = Gold Only
            for (let k = 0; k < count; k++) {
                const ox = crate.x + (Math.random() - 0.5) * 20;
                const oy = crate.y + (Math.random() - 0.5) * 20;
                this.goldOrbs.push(new GoldOrb(ox, oy, 1));
            }
        }
    }

    update(dt) {
        if (this.isGameOver) {
            if (this.input.isKeyDown('KeyR')) {
                SaveManager.clearSave(); // Delete save on death
                window.location.reload();
            }
            return;
        }

        if (this.hangar.active) {
            this.hangar.update(dt);
            // If Hangar is active (and thus game paused), we return early.
            // But we might want some background animations? For now, strict pause.
            return;
        }

        if (this.shipBuilder.active) {
            this.shipBuilder.update(dt);
            return;
        }

        // --- PAUSE CHECK ---
        if (this.paused) return;

        // Safety: Prevent NaN Velocity AND Position
        if (isNaN(this.vx)) this.vx = 0;
        if (isNaN(this.vy)) this.vy = 0;

        if (isNaN(this.x) || isNaN(this.y)) {
            console.warn("Position corruption detected! Resetting to spawn.");
            this.x = 1000;
            this.y = 1000;
            this.vx = 0;
            this.vy = 0;
        }

        if (isNaN(this.rotation)) {
            console.warn("Rotation corruption! Resetting.");
            this.rotation = 0;
        }

        const levelBonus = 1 + (this.level - 1) * 0.01;

        // Update Item Pickups & Collection
        for (let i = this.itemPickups.length - 1; i >= 0; i--) {
            const item = this.itemPickups[i];
            item.update(dt, this.playerShip.isDead ? null : { x: this.x, y: this.y });

            if (!this.playerShip.isDead) {
                // Check collision with every part of the ship
                let collected = false;
                for (const partRef of this.playerShip.getUniqueParts()) {
                    const def = PartsLibrary[partRef.partId] || UserPartsLibrary[partRef.partId];
                    if (!def) continue;

                    // Calculate part center (anchor is top-left in grid units relative to center)
                    const w = def.width || 1;
                    const h = def.height || 1;
                    const offsetX = (w - 1) / 2;
                    const offsetY = (h - 1) / 2;

                    const localX = (partRef.x + offsetX) * TILE_SIZE;
                    const localY = (partRef.y + offsetY) * TILE_SIZE;

                    const cos = Math.cos(this.rotation);
                    const sin = Math.sin(this.rotation);

                    // Rotate
                    const partX = this.x + (localX * cos - localY * sin);
                    const partY = this.y + (localX * sin + localY * cos);

                    const dx = partX - item.x;
                    const dy = partY - item.y;

                    // Allow pickup if touching the part's area (using diagonal radius)
                    const partRadius = (Math.sqrt(w * w + h * h) * TILE_SIZE) / 2;
                    const pickupDist = partRadius + item.radius;

                    if (dx * dx + dy * dy < pickupDist * pickupDist) {
                        collected = true;
                        break;
                    }
                }

                if (collected) {
                    // Collect!
                    if (this.hangar.inventory[item.partId] !== undefined) {
                        this.hangar.inventory[item.partId]++;
                    } else {
                        this.hangar.inventory[item.partId] = 1;
                    }
                    this.hangar.updateUI(); // Refresh UI if open? Or just data.

                    // Show Notification
                    const def = PartsLibrary[item.partId] || UserPartsLibrary[item.partId];
                    const name = def ? (def.name || item.partId) : item.partId;
                    this.notifications.push({ text: `+1 ${name}`, life: 2.0, color: '#00ff00' });
                    this.audio.play('hit', { volume: 0.5, pitch: 2.0 });

                    this.itemPickups.splice(i, 1);
                    continue;
                }
            }
        }


        // Dash Logic
        const boosterCount = this.playerShip.stats.boosterCount || 0;

        if (this.dashCooldown > 0) {
            this.dashCooldown -= dt;
        }

        if (boosterCount > 0 && this.input.isKeyDown('ShiftLeft') && this.dashCooldown <= 0) {
            // Cooldown scales with booster count: 10s base, reduced by each booster
            const actualMaxCooldown = Math.max(1.0, this.dashMaxCooldown / boosterCount);
            this.dashActiveTimer = this.dashDuration;
            this.dashCooldown = actualMaxCooldown;
            this.showNotification("dash system pulse", "#00ffff");
        }

        if (this.dashActiveTimer > 0) {
            this.dashActiveTimer -= dt;
            const angle = this.rotation - Math.PI / 2;
            // Higher thrust during dash, but smoother application
            this.vx += Math.cos(angle) * this.dashPower * dt;
            this.vy += Math.sin(angle) * this.dashPower * dt;

            // Limit speed during dash slightly differently or just let physics handle it
            // For a 'longer' dash, we might want to temporarily ignore or reduce friction
        }

        // WASD Movement (Normalized Acceleration)
        let inputX = 0;
        let inputY = 0;
        if (this.input.isKeyDown('KeyW')) inputY -= 1;
        if (this.input.isKeyDown('KeyS')) inputY += 1;
        if (this.input.isKeyDown('KeyA')) inputX -= 1;
        if (this.input.isKeyDown('KeyD')) inputX += 1;

        if (inputX !== 0 || inputY !== 0) {
            const mag = Math.sqrt(inputX * inputX + inputY * inputY);

            // Apply Thruster Boost: 5% per thruster block
            const thrustMultiplier = 1 + (this.playerShip.stats.thrust * 0.05);

            // Out-of-combat acceleration boost
            const isSpawnRoom = this.currentRoom && this.currentRoom.gridX === 0 && this.currentRoom.gridY === 0;
            const outOfCombat = this.currentRoom && (this.currentRoom.cleared ||
                this.currentRoom.type === 'shop' || this.currentRoom.type === 'treasure' || isSpawnRoom);
            const combatBoost = outOfCombat ? 2.0 : 1.0; // 2x acceleration out of combat

            const currentAccel = this.acceleration * thrustMultiplier * levelBonus * combatBoost;

            this.vx += (inputX / mag) * currentAccel * dt;
            this.vy += (inputY / mag) * currentAccel * dt;
        }

        // Shop Item - Mouse Hover Tooltip and E-key Purchase
        const shopMouse = this.input.getMousePos();
        const shopZoom = this.camera.zoom || 1;
        const shopWorldMouseX = (shopMouse.x / shopZoom) + this.camera.x;
        const shopWorldMouseY = (shopMouse.y / shopZoom) + this.camera.y;

        // Track hovered shop item for tooltip
        this.hoveredShopItem = null;
        for (const shopItem of this.shopItems) {
            if (shopItem.purchased) continue;
            const dx = shopWorldMouseX - shopItem.x;
            const dy = shopWorldMouseY - shopItem.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist < shopItem.radius + 20) { // Hovering over item
                this.hoveredShopItem = shopItem;
                break;
            }
        }

        // E-key or Click to purchase hovered item
        const ePressed = this.input.isKeyDown('KeyE') && !this.eKeyLastFrame;
        const clicked = this.input.isMouseDown() && !this.mouseDownLastFrame;
        if ((ePressed || clicked) && this.hoveredShopItem) {
            this.purchaseShopItem(this.hoveredShopItem);
        }

        // Track hovered treasure chest for tooltip
        this.hoveredTreasureChest = null;
        for (const chest of this.treasureChests) {
            if (chest.opened) continue;
            const dx = shopWorldMouseX - chest.x;
            const dy = shopWorldMouseY - chest.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist < chest.radius + 20) {
                this.hoveredTreasureChest = chest;
                break;
            }
        }

        // E-key or Click to open hovered chest
        if ((ePressed || clicked) && this.hoveredTreasureChest && !this.hoveredTreasureChest.opened) {
            this.openTreasureChest(this.hoveredTreasureChest);
        }

        // Track hovered Vault Chest
        this.hoveredVaultChest = null;
        for (const chest of this.vaultChests) {
            if (chest.opened) continue;
            const dx = shopWorldMouseX - chest.x;
            const dy = shopWorldMouseY - chest.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist < chest.radius + 20) {
                this.hoveredVaultChest = chest;
                break;
            }
        }

        // Interact with Vault Chest
        if ((ePressed || clicked) && this.hoveredVaultChest) {
            this.tryActivateVaultChest(this.hoveredVaultChest);
        }

        this.eKeyLastFrame = this.input.isKeyDown('KeyE');

        // Apply Physics
        this.x += this.vx * dt;
        this.y += this.vy * dt;

        // Friction and Max Speed
        this.vx *= this.friction;
        this.vy *= this.friction;

        // Apply Thruster Boost to Max Speed as well
        const baseMaxVelocity = 800;
        let maxVelocity = baseMaxVelocity * (1 + (this.playerShip.stats.thrust * 0.05)) * levelBonus;

        // Increase Max Speed during dash
        if (this.dashActiveTimer > 0) {
            maxVelocity *= 2.5;
        }

        // Out-of-combat speed boost (room cleared, non-combat room, or spawn room)
        const isSpawnRoom = this.currentRoom && this.currentRoom.gridX === 0 && this.currentRoom.gridY === 0;
        const isOutOfCombat = this.currentRoom && (this.currentRoom.cleared ||
            this.currentRoom.type === 'shop' || this.currentRoom.type === 'treasure' || isSpawnRoom);
        if (isOutOfCombat) {
            maxVelocity *= 2.0; // 2x speed boost when not in combat
        }

        const currentSpeed = Math.sqrt(this.vx * this.vx + this.vy * this.vy);
        if (currentSpeed > maxVelocity) {
            this.vx = (this.vx / currentSpeed) * maxVelocity;
            this.vy = (this.vy / currentSpeed) * maxVelocity;
        }

        // Turret Aiming
        const mouse = this.input.getMousePos();
        // Adjust for Zoom: World = (Screen / Zoom) + CameraPos
        const zoom = this.camera.zoom || 1;
        const worldMouseX = (mouse.x / zoom) + this.camera.x;
        const worldMouseY = (mouse.y / zoom) + this.camera.y;

        // Calculate Ship Rotation based on movement
        const currentSpeedWrapper = Math.sqrt(this.vx * this.vx + this.vy * this.vy);

        let targetRotation = null;

        // Check for 'Cursor Tracker' part
        const hasTracker = Array.from(this.playerShip.parts.values()).some(p => p.partId === 'custom_1768410456823');

        if (hasTracker) {
            targetRotation = Math.atan2(worldMouseY - this.y, worldMouseX - this.x) + Math.PI / 2;
        } else if (currentSpeedWrapper > 50) { // Threshold to prevent jitter
            // 0 is Up for the ship sprite, but atan2 0 is Right.
            // movement East (vx>0, vy=0) -> atan2=0. Ship should rot -90? 
            // Wait, previous code was atan2 + PI/2. 
            // East -> 0 + 1.57 = 1.57 (Down?). 
            // Let's trust the old code: atan2(vy, vx) + Math.PI / 2

            // Allow smooth turning
            targetRotation = Math.atan2(this.vy, this.vx) + Math.PI / 2;
        }

        if (targetRotation !== null) {
            // Shortest path
            let diff = targetRotation - this.rotation;
            while (diff < -Math.PI) diff += Math.PI * 2;
            while (diff > Math.PI) diff -= Math.PI * 2;

            // Turn Rate scales with mass (Core mass = 5)
            const baseTurnRate = 5.0;
            const currentMass = this.playerShip.stats.totalMass || 5;
            const turnRate = Math.max(0.5, baseTurnRate * (5 / currentMass)) + (this.playerShip.stats.turnSpeed || 0);
            const maxStep = turnRate * dt;

            if (Math.abs(diff) > maxStep) {
                this.rotation += Math.sign(diff) * maxStep;
            } else {
                this.rotation = targetRotation;
            }
        }

        // Room / Level Logic
        if (this.currentRoom) {
            this.currentRoom.checkAmbushStatus(this);
        }

        const playerRoom = this.levelGen.getRoomAtWorldPos(this.x, this.y);
        if (playerRoom && playerRoom !== this.currentRoom) {
            // Player moved to a new room
            // Only allow transition if current room is UNLOCKED
            if (!this.currentRoom.locked) {
                // Auto-save BEFORE entering new room (so player respawns outside)
                if (!playerRoom.visited && this.playerShip) {
                    this.autoSave();
                }

                // Cleanup entities from old room (despawn everything)
                this.asteroids = [];
                this.lootCrates = [];
                this.shipwrecks = [];
                this.explosions = [];
                // Keep itemPickups/orbs? User said "asteroids and boxes... debris". 
                // Usually better to keep loot drops, but "despawn them all from old room" could mean everything.
                // Let's safe keep pickups/orbs for now as they are "loot", separate from "boxes".

                this.currentRoom = playerRoom;
                this.currentRoom.onEnter(this);
            }
        }

        if (this.currentRoom) {
            this.currentRoom.update(this);

            // Wall Collision / Lockdown / World Bounds
            const r = this.currentRoom;
            const margin = 30; // buffer from wall

            if (r.locked) {
                // Strict Lockdown (Cannot exit room)
                if (this.x < r.x + margin) { this.x = r.x + margin; this.vx = 0; }
                else if (this.x > r.x + r.width - margin) { this.x = r.x + r.width - margin; this.vx = 0; }

                if (this.y < r.y + margin) { this.y = r.y + margin; this.vy = 0; }
                else if (this.y > r.y + r.height - margin) { this.y = r.y + r.height - margin; this.vy = 0; }
            } else {
                // World Bounds Check (Cannot flow into void)
                // Check Left
                if (this.x < r.x + margin) {
                    const neighbor = this.levelGen.getRoomAtWorldPos(r.x - 10, this.y);
                    if (!neighbor) { this.x = r.x + margin; this.vx = 0; }
                }
                // Check Right
                else if (this.x > r.x + r.width - margin) {
                    const neighbor = this.levelGen.getRoomAtWorldPos(r.x + r.width + 10, this.y);
                    if (!neighbor) { this.x = r.x + r.width - margin; this.vx = 0; }
                }

                // Check Top
                if (this.y < r.y + margin) {
                    const neighbor = this.levelGen.getRoomAtWorldPos(this.x, r.y - 10);
                    if (!neighbor) { this.y = r.y + margin; this.vy = 0; }
                }
                // Check Bottom
                else if (this.y > r.y + r.height - margin) {
                    const neighbor = this.levelGen.getRoomAtWorldPos(this.x, r.y + r.height + 10);
                    if (!neighbor) { this.y = r.y + r.height - margin; this.vy = 0; }
                }
            }
        }

        // Core Spin (1 rotation per second)
        this.coreSpinAngle += Math.PI * 2 * dt;

        // Shooting
        const isMouseDown = this.input.isMouseDown();
        const CELL_STRIDE = TILE_SIZE;
        const accelerantBonus = (1 + (this.playerShip.stats.accelerantCount || 0) * 0.05);

        // Collect all weapons and find min cooldown
        // Also update Shield Cooldowns
        for (const part of this.playerShip.getUniqueParts()) {
            if (part.shieldCooldown > 0) {
                part.shieldCooldown -= dt;
            }
        }

        // Collect all weapons grouped by definition ID (Class)
        const weaponGroups = {};

        for (const partRef of this.playerShip.getUniqueParts()) {
            const def = PartsLibrary[partRef.partId] || UserPartsLibrary[partRef.partId];
            if (!def || def.type !== 'weapon') continue;

            // Initialize or decay ramp level for miniguns
            if (def.stats.rampUp) {
                if (partRef.rampLevel === undefined) partRef.rampLevel = 0;
                if (partRef.peakMeter === undefined) partRef.peakMeter = 0;

                // New: Unstoppable Peak Countdown
                if (partRef.peakMeter > 0) {
                    partRef.peakMeter -= dt;
                    if (partRef.peakMeter <= 0) {
                        partRef.cooldown = def.stats.overheatCooldown || 7;
                        partRef.rampLevel = 0;
                        this.audio.play('overheat', { volume: 0.7 });
                    }
                }

                // Spin-down decay (only when not firing and not in peak)
                if (!isMouseDown && partRef.peakMeter <= 0) {
                    partRef.rampLevel = Math.max(0, partRef.rampLevel - dt * 2.0);
                }
            }

            // Charging Logic
            if (partRef.chargeLeft > 0) {
                partRef.chargeLeft -= dt;
                if (partRef.chargeLeft <= 0) {
                    partRef.chargeReady = true;
                }
            }
            const rampFactor = (def.stats.rampUp && partRef.rampLevel) ? (1 + partRef.rampLevel) : 1;
            let currentFireRateMul = levelBonus;
            if (def.stats.weaponGroup === 'laser') {
                currentFireRateMul *= accelerantBonus;
            }
            const adjCooldown = (def.stats.cooldown || 0.15) / rampFactor / currentFireRateMul;

            // Always update existing cooldowns
            if (!partRef.cooldown) partRef.cooldown = 0;
            if (partRef.cooldown > 0) partRef.cooldown -= dt;

            if (!weaponGroups[def.id]) {
                weaponGroups[def.id] = {
                    def: def,
                    weapons: [],
                    minBaseCooldown: adjCooldown
                };
            } else {
                weaponGroups[def.id].minBaseCooldown = Math.min(weaponGroups[def.id].minBaseCooldown, adjCooldown);
            }
            weaponGroups[def.id].weapons.push({ partRef, def, adjCooldown });
        }

        if (!this.staggerTimers) this.staggerTimers = {};

        if (isMouseDown && !this.designer.active) {

            // Shop click detection
            if (this.shopButtonRects && this.shopButtonRects.length > 0 && !this.mouseDownLastFrame) {
                const mousePos = this.input.getMousePos();
                for (const btn of this.shopButtonRects) {
                    if (mousePos.x >= btn.x && mousePos.x <= btn.x + btn.w &&
                        mousePos.y >= btn.y && mousePos.y <= btn.y + btn.h) {
                        if (btn.canAfford) {
                            this.purchaseShopItem(btn.index);
                        }
                        return; // Don't fire weapons when clicking shop
                    }
                }
            }

            // Process EACH group independently
            for (const [groupId, group] of Object.entries(weaponGroups)) {

                // Initialize stagger timer for this group if missing
                if (this.staggerTimers[groupId] === undefined) this.staggerTimers[groupId] = 0;

                // Calculate stagger for THIS group: 0.2s or faster if many guns
                // User said "0.2 sec waiting time" per class.
                const count = group.weapons.length;
                const staggerInterval = Math.min(0.2, group.minBaseCooldown / count);

                this.staggerTimers[groupId] -= dt;

                let safety = 0;
                while (this.staggerTimers[groupId] <= 0 && safety < 50) {
                    safety++;

                    // Find ready weapon in THIS group
                    const readyWeapon = group.weapons.find(w => w.partRef.cooldown <= 0 && w.partRef.chargeLeft === undefined && !w.partRef.chargeReady);
                    const chargedWeapon = group.weapons.find(w => w.partRef.chargeReady);

                    if (readyWeapon || chargedWeapon) {
                        const activeWeapon = chargedWeapon || readyWeapon;
                        const { partRef, def, adjCooldown } = activeWeapon;

                        // Start Charge if applicable
                        if (!chargedWeapon && def.stats.chargeTime && !partRef.chargeLeft) {
                            partRef.chargeLeft = def.stats.chargeTime;
                            if (def.stats.projectileType === 'saber') {
                                partRef.chargeSound = this.audio.play('rail_charge', { volume: 0.3, pitch: 1.5 });
                            } else {
                                partRef.chargeSound = this.audio.play('rail_charge', { volume: 0.5 });
                            }
                            break; // Stop loop for this weapon until it's charged
                        }

                        if (chargedWeapon) {
                            partRef.chargeLeft = undefined;
                            partRef.chargeReady = false;

                            if (partRef.chargeSound) {
                                try { partRef.chargeSound.stop(); } catch (e) { }
                                partRef.chargeSound = null;
                            }

                            const pitch = def.stats.projectileType === 'saber' ? 1.5 : 1.0;
                            this.audio.play('rail', { volume: 0.7, pitch: pitch });
                        }
                        const isRotated = ((partRef.rotation || 0) % 2 !== 0);
                        const w = isRotated ? def.height : def.width;
                        const h = isRotated ? def.width : def.height;
                        const localCX = (partRef.x + (w - 1) / 2) * CELL_STRIDE;
                        const localCY = (partRef.y + (h - 1) / 2) * CELL_STRIDE;
                        const cos = Math.cos(this.rotation);
                        const sin = Math.sin(this.rotation);
                        const finalX = this.x + (localCX * cos - localCY * sin);
                        const finalY = this.y + (localCX * sin + localCY * cos);
                        const angle = Math.atan2(worldMouseY - finalY, worldMouseX - finalX);
                        let barrelLen = (h > 1.5) ? CELL_STRIDE * 1.3 : CELL_STRIDE * 0.6;
                        barrelLen += (def.turretDrawOffset || 0);
                        const fireX = finalX + Math.cos(angle) * barrelLen;
                        const fireY = finalY + Math.sin(angle) * barrelLen;

                        let bCount = def.stats.burstCount || 0;
                        if (def.stats.weaponGroup === 'rocket') {
                            const rocketBonus = (this.playerShip.stats.rocketBayCount || 0);
                            if (bCount > 0 || rocketBonus > 0) {
                                partRef.burstLeft = (bCount || 1) + rocketBonus;
                                partRef.burstTimer = 0;
                            }
                        } else if (bCount > 0) {
                            partRef.burstLeft = bCount;
                            partRef.burstTimer = 0;
                        }

                        if (partRef.burstLeft > 0) {
                            // Handled via burst logic
                        } else {
                            const pCount = def.stats.pelletCount || 1;
                            const pSpread = def.stats.spread || 0;
                            const pInterval = def.stats.pelletInterval || 0;
                            for (let i = 0; i < pCount; i++) {
                                const finalAngle = angle + (Math.random() - 0.5) * pSpread;
                                let pX = fireX;
                                let pY = fireY;
                                if (pCount > 1 && def.stats.barrelSpacing) {
                                    const perpX = Math.cos(angle + Math.PI / 2);
                                    const perpY = Math.sin(angle + Math.PI / 2);
                                    const offset = (i - (pCount - 1) / 2) * def.stats.barrelSpacing;
                                    pX += perpX * offset;
                                    pY += perpY * offset;
                                }
                                const p = new Projectile(pX, pY, finalAngle, def.stats.projectileType || 'bullet', 600, 'player', def.stats.damage || 10);
                                if (def.stats.projectileType === 'railgun') p.isBeam = true; // Safety
                                // Randomize interval between 0.01 and 0.03 (50%-150% of 0.02 base)
                                p.delay = i * pInterval * (0.5 + Math.random());
                                this.projectiles.push(p);
                            }

                            // Play Sound
                            let snd = 'shoot_laser';
                            if (def.stats.weaponGroup === 'rocket') snd = 'shoot_rocket';
                            if (def.stats.projectileType === 'mini_bullet') snd = 'shoot_mini';
                            if (def.stats.projectileType === 'railgun' || def.stats.projectileType === 'saber') snd = 'rail_shot';
                            if (def.id === 'gun_basic') snd = 'shoot_dart';

                            const isSaber = def.stats.projectileType === 'saber';
                            this.audio.play(snd, {
                                volume: snd === 'rail_shot' ? (isSaber ? 0.7 : 1.0) : (snd === 'shoot_mini' ? 0.4 : 0.6),
                                pitch: isSaber ? 1.4 : 1.0,
                                randomizePitch: 0.2
                            });
                        }

                        if (def.stats.rampUp) {
                            if (partRef.peakMeter > 0) {
                                partRef.cooldown = adjCooldown;
                            } else {
                                partRef.rampLevel = Math.min(def.stats.maxRamp || 2.0, (partRef.rampLevel || 0) + (def.stats.rampRate || 0.5));
                                if (partRef.rampLevel >= (def.stats.maxRamp || 2.0)) {
                                    partRef.peakMeter = def.stats.peakDuration || 5;
                                }
                                partRef.cooldown = adjCooldown;
                            }
                        } else {
                            partRef.cooldown = adjCooldown;
                        }
                        this.staggerTimers[groupId] += staggerInterval;
                    } else {
                        // Group empty/waiting
                        if (this.staggerTimers[groupId] < 0) this.staggerTimers[groupId] = 0;
                        break;
                    }
                }
            }
        } else {
            // Reset timers slightly so they are ready next click
            for (const key in this.staggerTimers) {
                if (this.staggerTimers[key] < 0) this.staggerTimers[key] = 0;
            }
        }

        // Process Weapon Bursts
        for (const partRef of this.playerShip.getUniqueParts()) {
            if (partRef.burstLeft > 0) {
                partRef.burstTimer -= dt;
                if (partRef.burstTimer <= 0) {
                    const def = PartsLibrary[partRef.partId] || UserPartsLibrary[partRef.partId];
                    if (def) {
                        const isRotated = ((partRef.rotation || 0) % 2 !== 0);
                        const pw = isRotated ? def.height : def.width;
                        const ph = isRotated ? def.width : def.height;
                        const localCX = (partRef.x + (pw - 1) / 2) * CELL_STRIDE;
                        const localCY = (partRef.y + (ph - 1) / 2) * CELL_STRIDE;
                        const cos = Math.cos(this.rotation);
                        const sin = Math.sin(this.rotation);
                        const finalX = this.x + (localCX * cos - localCY * sin);
                        const finalY = this.y + (localCX * sin + localCY * cos);

                        // Use mouse position for burst aiming (updated each shot)
                        const angle = Math.atan2(worldMouseY - finalY, worldMouseX - finalX);
                        let barrelLen = (ph > 1.5) ? CELL_STRIDE * 1.3 : CELL_STRIDE * 0.6;
                        barrelLen += (def.turretDrawOffset || 0);
                        const fireX = finalX + Math.cos(angle) * barrelLen;
                        const fireY = finalY + Math.sin(angle) * barrelLen;

                        const pCount = def.stats.pelletCount || 1;
                        const pSpread = def.stats.spread || 0;
                        const pInterval = def.stats.pelletInterval || 0;
                        for (let i = 0; i < pCount; i++) {
                            const finalAngle = angle + (Math.random() - 0.5) * pSpread;
                            let pX = fireX;
                            let pY = fireY;
                            if (pCount > 1 && def.stats.barrelSpacing) {
                                const perpX = Math.cos(angle + Math.PI / 2);
                                const perpY = Math.sin(angle + Math.PI / 2);
                                const offset = (i - (pCount - 1) / 2) * def.stats.barrelSpacing;
                                pX += perpX * offset;
                                pY += perpY * offset;
                            }
                            const p = new Projectile(pX, pY, finalAngle, def.stats.projectileType || 'bullet', 600, 'player', def.stats.damage || 10);
                            // Randomize interval between 0.01 and 0.03 (50%-150% of 0.02 base)
                            p.delay = i * pInterval * (0.5 + Math.random());
                            this.projectiles.push(p);
                        }

                        partRef.burstLeft--;
                        let interval = def.stats.burstInterval || 0.1;
                        if (def.stats.weaponGroup === 'rocket' && this.playerShip.stats.rocketBayCount > 0) {
                            interval /= (1 + this.playerShip.stats.rocketBayCount);
                        }
                        partRef.burstTimer = interval;

                        // Play Sound for Burst
                        let snd = 'shoot_laser';
                        if (def.stats.weaponGroup === 'rocket') snd = 'shoot_rocket';
                        if (def.stats.projectileType === 'mini_bullet') snd = 'shoot_mini';
                        if (def.stats.projectileType === 'railgun' || def.stats.projectileType === 'saber') snd = 'rail_shot';
                        if (def.id === 'gun_basic') snd = 'shoot_dart';

                        const isSaber = def.stats.projectileType === 'saber';
                        this.audio.play(snd, {
                            volume: snd === 'rail_shot' ? (isSaber ? 0.7 : 1.0) : (snd === 'shoot_mini' ? 0.4 : 0.6),
                            pitch: isSaber ? 1.4 : 1.0,
                            randomizePitch: 0.2
                        });
                    } else {
                        partRef.burstLeft = 0;
                    }
                }
            }
        }

        // Update Projectiles
        for (let i = this.projectiles.length - 1; i >= 0; i--) {
            const p = this.projectiles[i];
            p.update(dt, this);

            if (p.owner === 'player') {
                for (const enemy of this.enemies) {
                    if (enemy.isDead) continue;

                    if (p.isBeam) {
                        // Beam Collision (Hitscan)
                        // Translate and rotate enemy into beam space
                        const tdx = enemy.x - p.x;
                        const tdy = enemy.y - p.y;
                        const bx = tdx * Math.cos(-p.angle) - tdy * Math.sin(-p.angle);
                        const by = tdx * Math.sin(-p.angle) + tdy * Math.cos(-p.angle);

                        const hitRange = (p.radius || 10) + (enemy.radius || 20);
                        if (bx > 0 && bx < p.beamLength && Math.abs(by) < hitRange) {
                            const now = Date.now();
                            const lastHit = p.targetHits.get(enemy) || 0;
                            if (now - lastHit > 150) { // Damage tick every 150ms
                                enemy.takeDamage(p.damage);
                                p.targetHits.set(enemy, now);
                                this.audio.play('hit', { volume: 0.3, pitch: 1.3, randomizePitch: 0.1 });
                            }
                        }
                    } else if (this.bosses.length > 0 && p.owner === 'player') {
                        // Beam vs Boss
                        for (const boss of this.bosses) {
                            if (boss.isDead) continue;

                            // Transform boss relative to beam start
                            const tdx = boss.x - p.x;
                            const tdy = boss.y - p.y;

                            // Rotate by -angle to align with X axis
                            const bx = tdx * Math.cos(-p.angle) - tdy * Math.sin(-p.angle);
                            const by = tdx * Math.sin(-p.angle) + tdy * Math.cos(-p.angle);

                            const hitRange = (p.radius || 10) + (boss.radius || 60);
                            if (bx > 0 && bx < p.beamLength && Math.abs(by) < hitRange) {
                                const now = Date.now();
                                const lastHit = p.targetHits.get(boss) || 0;
                                if (now - lastHit > 150) {
                                    boss.takeDamage(p.damage);
                                    p.targetHits.set(boss, now);
                                    this.audio.play('hit', { volume: 0.4, pitch: 0.7 });
                                }
                            }
                        }
                    } else {
                        // Standard Projectile Collision
                        const dx = p.x - enemy.x;
                        const dy = p.y - enemy.y;
                        const distSq = dx * dx + dy * dy;
                        const minDist = (p.radius || 4) + (enemy.radius || 20);
                        if (distSq < minDist * minDist) {
                            enemy.takeDamage(p.damage);
                            this.audio.play('hit', { volume: 0.5, pitch: 1.3, randomizePitch: 0.1 });
                            p.isDead = true;
                            if (p.type === 'rocket') p.shouldExplode = true;
                        }
                    }
                }

                // Boss Collision
                if (this.bosses.length > 0) {
                    for (const boss of this.bosses) {
                        if (boss.isDead) continue;
                        if (p.isBeam) {
                            // Beam Logic
                            const tdx = boss.x - p.x;
                            const tdy = boss.y - p.y;
                            const bx = tdx * Math.cos(-p.angle) - tdy * Math.sin(-p.angle);
                            const by = tdx * Math.sin(-p.angle) + tdy * Math.cos(-p.angle);

                            const hitRange = (p.radius || 10) + (boss.radius || 60);
                            if (bx > 0 && bx < p.beamLength && Math.abs(by) < hitRange) {
                                const now = Date.now();
                                const lastHit = p.targetHits.get(boss) || 0;
                                if (now - lastHit > 150) {
                                    boss.takeDamage(p.damage);
                                    p.targetHits.set(boss, now);
                                    this.audio.play('hit', { volume: 0.4, pitch: 0.7 });
                                }
                            }
                        } else {
                            // Standard Logic
                            // Check rough radius first
                            const dx = p.x - boss.x;
                            const dy = p.y - boss.y;
                            if (Math.hypot(dx, dy) < boss.radius + p.radius) {
                                boss.takeDamage(p.damage);
                                this.audio.play('hit', { volume: 0.8, pitch: 0.8 });
                                p.isDead = true;
                                if (p.type === 'rocket') p.shouldExplode = true;
                            }
                        }
                    }
                }

                // Shipwreck Collision
                for (let i = this.shipwrecks.length - 1; i >= 0; i--) {
                    const wreck = this.shipwrecks[i];
                    if (wreck.isDead) continue;

                    // Simple distance check first
                    const dx = p.x - wreck.x;
                    const dy = p.y - wreck.y;
                    // Approximate radius for optimization (wreck is composed of parts)
                    // Let's say 200px max?
                    if (dx * dx + dy * dy > 400 * 400) continue;

                    if (p.isBeam) {
                        // TODO: Beam vs Wreck parts
                        // For now skip or implement simplified
                    } else {
                        // Check collision with wreck parts
                        const hitResult = wreck.takeDamage(p.damage, p.x, p.y);
                        if (hitResult) {
                            // Hit something (maybe empty space though?)
                            // takeDamage returns { destroyed: bool, partId... } if it hit a part

                            // If hitResult is object and has property destroyed
                            if (hitResult.destroyed !== undefined) {
                                // Real hit
                                p.isDead = true;
                                if (p.type === 'rocket') p.shouldExplode = true;
                                this.audio.play('hit', { volume: 0.4, pitch: 0.8 });

                                if (hitResult.destroyed && hitResult.shouldDrop) {
                                    // Drop Item
                                    this.itemPickups.push(new ItemPickup(hitResult.x, hitResult.y, hitResult.partId));
                                    this.audio.play('explosion', { volume: 0.4, pitch: 1.2 });
                                } else if (hitResult.destroyed) {
                                    // Just sound if destroyed but no drop
                                    this.audio.play('explosion', { volume: 0.3, pitch: 1.5 });
                                }
                            }
                        }
                    }

                    if (wreck.isDead) {
                        this.shipwrecks.splice(i, 1);
                    }
                }

                // Asteroid Collision
                for (const asteroid of this.asteroids) {
                    if (asteroid.isDead || asteroid.isBroken) continue;

                    if (p.isBeam) {
                        // Beam Logic vs Asteroid
                        const tdx = asteroid.x - p.x;
                        const tdy = asteroid.y - p.y;
                        const bx = tdx * Math.cos(-p.angle) - tdy * Math.sin(-p.angle);
                        const by = tdx * Math.sin(-p.angle) + tdy * Math.cos(-p.angle);
                        const hitRange = (p.radius || 10) + asteroid.radius;

                        if (bx > 0 && bx < p.beamLength && Math.abs(by) < hitRange) {
                            const now = Date.now();
                            const lastHit = p.targetHits.get(asteroid) || 0;
                            if (now - lastHit > 150) {
                                if (asteroid.takeDamage(p.damage)) {
                                    this.spawnAsteroidLoot(asteroid);
                                }
                                p.targetHits.set(asteroid, now);
                                this.audio.play('hit', { volume: 0.3, pitch: 0.5 }); // Lower pitch for rock
                            }
                        }
                    } else {
                        // Standard Projectile
                        const dx = asteroid.x - p.x;
                        const dy = asteroid.y - p.y;
                        const distSq = dx * dx + dy * dy;
                        const minDist = (p.radius || 4) + asteroid.radius;

                        if (distSq < minDist * minDist) {
                            if (asteroid.takeDamage(p.damage)) {
                                this.spawnAsteroidLoot(asteroid);
                            }
                            p.isDead = true;
                            if (p.type === 'rocket') p.shouldExplode = true;
                            this.audio.play('hit', { volume: 0.4, pitch: 0.5 });
                        }
                    }
                }

                // Loot Crate Collision (Projectile)
                for (const crate of this.lootCrates) {
                    if (crate.isOpened) continue; // Ignore opened crates for projectiles

                    if (p.isBeam) {
                        const tdx = crate.x - p.x;
                        const tdy = crate.y - p.y;
                        const bx = tdx * Math.cos(-p.angle) - tdy * Math.sin(-p.angle);
                        const by = tdx * Math.sin(-p.angle) + tdy * Math.cos(-p.angle);
                        const hitRange = (p.radius || 10) + crate.radius;

                        if (bx > 0 && bx < p.beamLength && Math.abs(by) < hitRange) {
                            const now = Date.now();
                            const lastHit = p.targetHits.get(crate) || 0;
                            if (now - lastHit > 150) {
                                if (crate.takeDamage(p.damage)) {
                                    // Opened!
                                    this.spawnCrateLoot(crate);
                                }
                                p.targetHits.set(crate, now);
                                this.audio.play('hit', { volume: 0.3, pitch: 1.2 }); // Metal hit
                            }
                        }
                    } else {
                        const dx = crate.x - p.x;
                        const dy = crate.y - p.y;
                        const distSq = dx * dx + dy * dy;
                        const minDist = (p.radius || 4) + crate.radius;

                        if (distSq < minDist * minDist) {
                            if (crate.takeDamage(p.damage)) {
                                // Opened!
                                this.spawnCrateLoot(crate);
                            } else {
                                // Hit Spin
                                crate.rotSpeed += (Math.random() - 0.5) * 3;
                            }
                            p.isDead = true;
                            if (p.type === 'rocket') p.shouldExplode = true;
                            this.audio.play('hit', { volume: 0.3, pitch: 1.2 });
                        }
                    }
                }
            } else {
                // Enemy projectile hitting player
                let hitResult = false;
                const CELL_STRIDE = TILE_SIZE;
                const shipCos = Math.cos(this.rotation);
                const shipSin = Math.sin(this.rotation);
                const pRadius = p.radius || 4;
                const cellRadius = CELL_STRIDE / 2;
                // Standard check dist, but if it's a shield we might need larger check?
                // Actually, we iterate keys. Collision logic: 'distSq < checkDist'.
                // If shield is huge, we should intercept even if projectile is far from center?
                // But the loop iterates *cells*.
                // A large shield covers only its cells technically, unless we assume the shield is an area effect around the part.
                // The prompt implies the part *emits* a shield.
                // If the shield is larger than the part, we need to check collision against the shield radius.
                // But we don't know it's a shield until we get the part def.
                // So we should check collision with standard radius, AND potentially "near misses" if they hit the shield radius?
                // Or simpler: Iterate parts, check if shield, use shield radius for collision.
                // AND check hull collision.

                // Let's modify the loop slightly to check Part-based collision radius.

                // Iterate over every occupied cell
                for (const key of this.playerShip.parts.keys()) {
                    const [cx, cy] = key.split(',').map(Number);
                    const rx = cx * CELL_STRIDE;
                    const ry = cy * CELL_STRIDE;

                    const worldCellX = this.x + (rx * shipCos - ry * shipSin);
                    const worldCellY = this.y + (rx * shipSin + ry * shipCos);

                    let isHit = false;

                    if (p.isBeam) {
                        const tdx = worldCellX - p.x;
                        const tdy = worldCellY - p.y;
                        const bx = tdx * Math.cos(-p.angle) - tdy * Math.sin(-p.angle);
                        const by = tdx * Math.sin(-p.angle) + tdy * Math.cos(-p.angle);

                        // We need the part definition to know effective radius
                        const partRef = this.playerShip.parts.get(key);
                        const def = PartsLibrary[partRef.partId] || UserPartsLibrary[partRef.partId];
                        let effectiveRadius = cellRadius;
                        if (def.type === 'shield' && (!partRef.shieldCooldown || partRef.shieldCooldown <= 0)) {
                            effectiveRadius *= (def.stats.shieldRadiusScale || 1.4);
                        }

                        if (bx > 0 && bx < p.beamLength && Math.abs(by) < (effectiveRadius + pRadius)) {
                            const now = Date.now();
                            const lastHit = p.targetHits.get(key) || 0;
                            if (now - lastHit > 150) {
                                isHit = true;
                                p.targetHits.set(key, now);
                            }
                        }
                    } else {
                        const dx = p.x - worldCellX;
                        const dy = p.y - worldCellY;
                        const distSq = dx * dx + dy * dy;

                        const partRef = this.playerShip.parts.get(key);
                        const def = PartsLibrary[partRef.partId] || UserPartsLibrary[partRef.partId];
                        let effectiveRadius = cellRadius;
                        if (def.type === 'shield' && (!partRef.shieldCooldown || partRef.shieldCooldown <= 0)) {
                            effectiveRadius *= (def.stats.shieldRadiusScale || 1.4);
                        }

                        const hitDist = effectiveRadius + pRadius;

                        if (distSq < hitDist * hitDist) {
                            isHit = true;
                        }
                    }

                    if (isHit) {
                        // Check if this part is a SHIELD
                        const partRef = this.playerShip.parts.get(key);
                        const def = PartsLibrary[partRef.partId] || UserPartsLibrary[partRef.partId];

                        if (def.type === 'shield') {
                            if (!partRef.shieldCooldown || partRef.shieldCooldown <= 0) {
                                // BLOCK!
                                partRef.shieldCooldown = def.stats.shieldCooldown || 3.0;
                                this.audio.play('shield_hit', { volume: 0.8 }); // Assuming sound exists or standard hit
                                if (!this.audio.sounds.shield_hit) this.audio.play('hit', { pitch: 1.5 }); // Fallback

                                // Visual Effect
                                this.explosions.push({ x: worldCellX, y: worldCellY, radius: 25, life: 0.3, maxLife: 0.3, color: '#00ffff' });

                                if (!p.isBeam) p.isDead = true;
                                hitResult = false; // Blocked!
                                break; // Stop checking other parts for this projectile
                            }
                        }

                        hitResult = true;
                        break;
                    }
                }

                // Enemy projectile vs Asteroids
                if (!p.isDead) {
                    for (const asteroid of this.asteroids) {
                        if (asteroid.isDead || asteroid.isBroken) continue;
                        const dx = asteroid.x - p.x;
                        const dy = asteroid.y - p.y;
                        const distSq = dx * dx + dy * dy;
                        const minDist = (p.radius || 4) + asteroid.radius;
                        if (distSq < minDist * minDist) {
                            if (asteroid.takeDamage(p.damage || 5)) {
                                this.spawnAsteroidLoot(asteroid);
                            }
                            p.isDead = true;
                            break;
                        }
                    }
                }

                // Enemy projectile vs Loot Crates
                if (!p.isDead) {
                    for (const crate of this.lootCrates) {
                        if (crate.isOpened) continue;
                        const dx = crate.x - p.x;
                        const dy = crate.y - p.y;
                        const distSq = dx * dx + dy * dy;
                        const minDist = (p.radius || 4) + crate.radius;
                        if (distSq < minDist * minDist) {
                            if (crate.takeDamage(p.damage || 5)) {
                                this.spawnCrateLoot(crate);
                            }
                            p.isDead = true;
                            break;
                        }
                    }
                }

                if (hitResult) {
                    this.playerShip.takeDamage(p.damage || 5);
                    this.audio.play('hit', { volume: 0.8, pitch: 0.7, randomizePitch: 0.1 });
                    if (!p.isBeam) p.isDead = true;
                }
            }

            if (p.shouldExplode) {
                const aoe = 60;
                this.explosions.push({ x: p.x, y: p.y, radius: aoe, life: 0.4, maxLife: 0.4 });
                this.audio.play('explosion', { volume: 0.6, randomizePitch: 0.4 });

                // AOE Damage
                for (const enemy of this.enemies) {
                    if (enemy.isDead) continue;
                    const dx = p.x - enemy.x;
                    const dy = p.y - enemy.y;
                    const distSq = dx * dx + dy * dy;
                    if (distSq < (aoe + (enemy.radius || 20)) ** 2) {
                        enemy.takeDamage(20);
                    }
                }

                // Check Boss Collision
                for (const boss of this.bosses) {
                    if (boss.isDead) continue;
                    const dx = boss.x - p.x;
                    const dy = boss.y - p.y;
                    if (dx * dx + dy * dy < (boss.radius + 10) * (boss.radius + 10)) {
                        boss.takeDamage(p.damage);
                        p.isDead = true;
                        if (!boss.isDead) { // Flash only if still alive
                            boss.flash = 5;
                        }
                    }
                }

                // Check Asteroid Collision (Projectile)
                for (const asteroid of this.asteroids) {
                    if (asteroid.isDead) continue;
                    const dx = asteroid.x - p.x;
                    const dy = asteroid.y - p.y;
                    if (dx * dx + dy * dy < asteroid.radius * asteroid.radius) {
                        asteroid.takeDamage(p.damage);
                        p.isDead = true;

                        // Drop checking on death
                        if (asteroid.isDead) {
                            if (asteroid.type === 'crystal_blue') {
                                const count = 3 + Math.floor(Math.random() * 3);
                                for (let i = 0; i < count; i++) {
                                    const ox = asteroid.x + (Math.random() - 0.5) * 20;
                                    const oy = asteroid.y + (Math.random() - 0.5) * 20;
                                    this.xpOrbs.push(new XPOrb(ox, oy, 10));
                                }
                            } else if (asteroid.type === 'crystal_gold') {
                                const count = 1 + Math.floor(Math.random() * 2);
                                for (let i = 0; i < count; i++) {
                                    const ox = asteroid.x + (Math.random() - 0.5) * 20;
                                    const oy = asteroid.y + (Math.random() - 0.5) * 20;
                                    this.goldOrbs.push(new GoldOrb(ox, oy, 1));
                                }
                            }
                        }
                    }
                }
            }

            if (p.isDead) this.projectiles.splice(i, 1);
        }

        // Update Portals
        for (const p of this.portals) {
            p.update(dt);
            const dx = this.x - p.x;
            const dy = this.y - p.y;
            if (Math.hypot(dx, dy) < p.radius + 80) {
                this.nextLevel();
                return;
            }
        }

        // Update Explosions
        for (let i = this.explosions.length - 1; i >= 0; i--) {
            const exp = this.explosions[i];
            exp.life -= dt;
            if (exp.life <= 0) this.explosions.splice(i, 1);
        }

        // Update Enemies
        let anyDead = false;
        for (const enemy of this.enemies) {
            enemy.update(dt, this.x, this.y, this.projectiles, this.asteroids, this.lootCrates);
            if (enemy.isDead) anyDead = true;
        }

        // Update Bosses
        let bossDead = false;
        for (const boss of this.bosses) {
            boss.update(dt, this.x, this.y, this.projectiles);
            if (boss.isDead) bossDead = true;
        }

        if (bossDead) {
            for (let i = this.bosses.length - 1; i >= 0; i--) {
                const boss = this.bosses[i];
                if (boss.isDead) {
                    // Massive Explosion
                    this.explosions.push({ x: boss.x, y: boss.y, life: 1.0, maxLife: 1.0, size: 200 });
                    // Spawn Portal
                    this.portals.push(new Portal(boss.x, boss.y));
                    this.showNotification("portal opened", '#aa00ff');

                    // Spawn many XP Orbs
                    for (let k = 0; k < 10; k++) {
                        this.xpOrbs.push(new XPOrb(boss.x + (Math.random() - 0.5) * 100, boss.y + (Math.random() - 0.5) * 100, 50));
                    }
                    this.bosses.splice(i, 1);
                }
            }
        }

        if (anyDead) {
            for (let i = this.enemies.length - 1; i >= 0; i--) {
                const enemy = this.enemies[i];
                if (enemy.isDead) {
                    // Spawn XP drops
                    const dropCount = enemy.type === 'striker' ? 3 : 2; // Default 2 XP orbs
                    for (let j = 0; j < dropCount; j++) {
                        const ox = enemy.x + (Math.random() - 0.5) * 20;
                        const oy = enemy.y + (Math.random() - 0.5) * 20;
                        this.xpOrbs.push(new XPOrb(ox, oy, 10));
                    }
                    // Spawn Gold Orb (1 per enemy)
                    this.goldOrbs.push(new GoldOrb(enemy.x, enemy.y, 1));

                    const deathSound = Math.random() > 0.5 ? 'enemy_death1' : 'enemy_death2';
                    this.audio.play(deathSound, { volume: 0.5, randomizePitch: 0.2 });
                    this.enemies.splice(i, 1);
                }
            }
        }

        const isRoomCleared = this.currentRoom && this.currentRoom.cleared;

        // Update XP Orbs
        for (let i = this.xpOrbs.length - 1; i >= 0; i--) {
            const orb = this.xpOrbs[i];
            if (isRoomCleared) orb.forced = true; // Auto-magnetize when room cleared
            const collected = orb.update(dt, this.x, this.y);
            if (collected) {
                this.xp += orb.value;
                this.xpOrbs.splice(i, 1);

                // Level up check
                if (this.xp >= this.xpToNext) {
                    this.xp -= this.xpToNext;
                    this.level++;
                    this.xpToNext = Math.floor(this.xpToNext * 1.2 + 50);

                    this.showNotification(`CORE UPGRADED: LEVEL ${this.level}`, '#00ffff');
                    this.showNotification(`SYSTEM EFFICIENCY +1%`, '#44ff44');
                }
            }
        }

        // Update Gold Orbs
        for (let i = this.goldOrbs.length - 1; i >= 0; i--) {
            const orb = this.goldOrbs[i];
            if (isRoomCleared) orb.forced = true; // Auto-magnetize when room cleared
            const collected = orb.update(dt, this.x, this.y);
            if (collected) {
                this.gold += orb.value;
                this.goldOrbs.splice(i, 1);
                // Optional: Play coin sound
            }
        }

        // Death Check
        if (this.playerShip.isDead) {
            if (!this.isGameOver) {
                this.audio.play('frame_death', { volume: 1.0 });
                this.isGameOver = true;
            }
        } else {
            // Apply Regeneration
            if (this.playerShip.hp < this.playerShip.maxHp) {
                this.playerShip.hp += (this.playerShip.stats.regen || 0) * levelBonus * dt;
                if (this.playerShip.hp > this.playerShip.maxHp) {
                    this.playerShip.hp = this.playerShip.maxHp;
                }
            }
        }

        // Update Asteroids & Player Collision
        for (let i = this.asteroids.length - 1; i >= 0; i--) {
            const asteroid = this.asteroids[i];
            asteroid.update(dt);

            // Player vs Asteroid (Per-Part Collision)
            if (!asteroid.isDead && !asteroid.isBroken) {
                let hit = false;
                const parts = this.playerShip.getUniqueParts();
                const tileSize = TILE_SIZE;

                // We cache rotation math for the ship
                const cos = Math.cos(this.rotation);
                const sin = Math.sin(this.rotation);

                for (const part of parts) {
                    // Part Local Pos (centered on ship 0,0) varies by tiles. 
                    // Example: x=1, y=0 is 1 tile right.
                    // We assume parts x,y are grid coordinates. 
                    // Need to center the tile? Usually grid 0,0 is center of ship 0,0.
                    // Let's assume part.x * tilesize is the center of the part.

                    const localX = part.x * tileSize;
                    const localY = part.y * tileSize;

                    // Rotate
                    const rX = localX * cos - localY * sin;
                    const rY = localX * sin + localY * cos;

                    const worldX = this.x + rX;
                    const worldY = this.y + rY;

                    if (isNaN(worldX) || isNaN(worldY)) continue; // Skip invalid parts

                    const dx = worldX - asteroid.x;
                    const dy = worldY - asteroid.y;
                    const distSq = dx * dx + dy * dy;

                    // Collision Radius: Asteroid Radius + Part Radius (approx half tile)
                    const minDist = asteroid.radius + (tileSize / 2);

                    if (distSq < minDist * minDist) {
                        // HIT!
                        let dist = Math.sqrt(distSq);
                        let nx, ny;

                        if (dist < 0.1) {
                            // Centers overlap perfectly (rare but causes NaN)
                            nx = 1;
                            ny = 0;
                        } else {
                            nx = dx / dist;
                            ny = dy / dist;
                        }

                        const push = 3000; // Strong physics bump

                        // Apply to Ship
                        // We push the whole ship away based on this contact normal
                        this.vx += nx * push * dt;
                        this.vy += ny * push * dt;

                        // Positional Correction (Anti-Stuck)
                        this.x += nx * 2;
                        this.y += ny * 2;

                        // Push asteroid
                        asteroid.vx -= nx * push * 0.5 * dt;
                        asteroid.vy -= ny * push * 0.5 * dt;

                        this.camera.shake = 5;
                        console.log("Part Collision Detected!");
                        hit = true;
                        break; // Handle one collision per frame per asteroid is enough
                    }
                }
            }



            // Keep asteroid within valid room bounds
            if (this.currentRoom) {
                const r = this.currentRoom;
                const margin = asteroid.radius;
                if (asteroid.x < r.x + margin) { asteroid.x = r.x + margin; asteroid.vx = Math.abs(asteroid.vx); }
                else if (asteroid.x > r.x + r.width - margin) { asteroid.x = r.x + r.width - margin; asteroid.vx = -Math.abs(asteroid.vx); }

                if (asteroid.y < r.y + margin) { asteroid.y = r.y + margin; asteroid.vy = Math.abs(asteroid.vy); }
                else if (asteroid.y > r.y + r.height - margin) { asteroid.y = r.y + r.height - margin; asteroid.vy = -Math.abs(asteroid.vy); }
            }

            if (asteroid.isDead) {
                this.asteroids.splice(i, 1);
            } else {
                // Asteroid vs Asteroid
                for (let j = i - 1; j >= 0; j--) {
                    const other = this.asteroids[j];
                    if (other.isDead) continue;

                    const dx = other.x - asteroid.x;
                    const dy = other.y - asteroid.y;
                    const distSq = dx * dx + dy * dy;
                    const minDist = asteroid.radius + other.radius;

                    if (distSq < minDist * minDist) {
                        const dist = Math.sqrt(distSq);
                        const nx = dx / dist;
                        const ny = dy / dist;
                        const push = 100; // Soft bounce

                        const pen = (minDist - dist) / 2;
                        asteroid.x -= nx * pen;
                        asteroid.y -= ny * pen;
                        other.x += nx * pen;
                        other.y += ny * pen;

                        asteroid.vx -= nx * push * dt;
                        asteroid.vy -= ny * push * dt;
                        other.vx += nx * push * dt;
                        other.vy += ny * push * dt;
                    }
                }
            }
        }


        // Update Loot Crates & Collision
        for (let i = this.lootCrates.length - 1; i >= 0; i--) {
            const crate = this.lootCrates[i];
            crate.update(dt);

            // Keep crate within valid room bounds
            if (this.currentRoom) {
                const r = this.currentRoom;
                const margin = crate.radius;
                if (crate.x < r.x + margin) { crate.x = r.x + margin; crate.vx = Math.abs(crate.vx); }
                else if (crate.x > r.x + r.width - margin) { crate.x = r.x + r.width - margin; crate.vx = -Math.abs(crate.vx); }

                if (crate.y < r.y + margin) { crate.y = r.y + margin; crate.vy = Math.abs(crate.vy); }
                else if (crate.y > r.y + r.height - margin) { crate.y = r.y + r.height - margin; crate.vy = -Math.abs(crate.vy); }
            }

            // Player vs Crate (Collision)
            if (!crate.isOpened) {
                const parts = this.playerShip.getUniqueParts();
                const tileSize = TILE_SIZE;
                const cos = Math.cos(this.rotation);
                const sin = Math.sin(this.rotation);

                for (const part of parts) {
                    const localX = part.x * tileSize;
                    const localY = part.y * tileSize;
                    const rX = localX * cos - localY * sin;
                    const rY = localX * sin + localY * cos;
                    const worldX = this.x + rX;
                    const worldY = this.y + rY;

                    if (isNaN(worldX) || isNaN(worldY)) continue;

                    const dx = worldX - crate.x;
                    const dy = worldY - crate.y;
                    const distSq = dx * dx + dy * dy;
                    const minDist = crate.radius + (tileSize / 2);

                    if (distSq < minDist * minDist) {
                        // HIT!
                        let dist = Math.sqrt(distSq);
                        let nx, ny;
                        if (dist < 0.1) { nx = 1; ny = 0; }
                        else { nx = dx / dist; ny = dy / dist; }

                        const push = 2000;

                        this.vx += nx * push * dt;
                        this.vy += ny * push * dt;
                        this.x += nx * 2;
                        this.y += ny * 2;

                        // Transfer player momentum to crate (stronger push)
                        const playerSpeed = Math.sqrt(this.vx * this.vx + this.vy * this.vy);
                        const impactForce = Math.max(100, playerSpeed * 1.5);
                        crate.vx -= nx * impactForce;
                        crate.vy -= ny * impactForce;

                        // Hit Spin
                        crate.rotSpeed += (Math.random() - 0.5) * 8;

                        break;
                    }
                }

                // Crate vs Crate
                for (let j = i - 1; j >= 0; j--) {
                    const other = this.lootCrates[j];
                    // Skip if both are opened (debris doesn't collide with debris?)
                    // Let's say debris stays solid to crates
                    if (other.isOpened && crate.isOpened) continue;

                    const dx = other.x - crate.x;
                    const dy = other.y - crate.y;
                    const distSq = dx * dx + dy * dy;
                    const minDist = crate.radius + other.radius; // Circle approx

                    if (distSq < minDist * minDist) {
                        const dist = Math.sqrt(distSq);
                        const nx = dx / dist;
                        const ny = dy / dist;
                        const pen = (minDist - dist) / 2;

                        // Separate
                        crate.x -= nx * pen;
                        crate.y -= ny * pen;
                        other.x += nx * pen;
                        other.y += ny * pen;

                        // Bounce
                        const push = 200; // Elasticity
                        crate.vx -= nx * push * dt;
                        crate.vy -= ny * push * dt;
                        other.vx += nx * push * dt;
                        other.vy += ny * push * dt;

                        // Spin
                        crate.rotSpeed += (Math.random() - 0.5) * 2;
                        other.rotSpeed -= (Math.random() - 0.5) * 2;
                    }
                }

                // Crate vs Asteroid
                for (const asteroid of this.asteroids) {
                    if (asteroid.isDead || asteroid.isBroken) continue; // Ignore debris

                    const dx = asteroid.x - crate.x;
                    const dy = asteroid.y - crate.y;
                    const distSq = dx * dx + dy * dy;
                    const minDist = crate.radius + asteroid.radius;

                    if (distSq < minDist * minDist) {
                        const dist = Math.sqrt(distSq);
                        const nx = dx / dist;
                        const ny = dy / dist;
                        const pen = (minDist - dist) / 2;

                        // Separate
                        crate.x -= nx * pen;
                        crate.y -= ny * pen;
                        asteroid.x += nx * pen;
                        asteroid.y += ny * pen;

                        // Bounce
                        const push = 1000; // Heavy impact
                        crate.vx -= nx * push * dt;
                        crate.vy -= ny * push * dt;
                        asteroid.vx += nx * push * 0.1 * dt; // Asteroids are heavy
                        asteroid.vy += ny * push * 0.1 * dt;

                        crate.rotSpeed += (Math.random() - 0.5) * 5;
                    }
                }
            }
        }

        // Update Notifications
        for (let i = this.notifications.length - 1; i >= 0; i--) {
            this.notifications[i].life -= dt;
            if (this.notifications[i].life <= 0) this.notifications.splice(i, 1);
        }

        this.camera.follow({ x: this.x, y: this.y });
        this.camera.update(dt);
        this.mouseDownLastFrame = isMouseDown;
    }

    draw() {
        this.renderer.clear('#000'); // OLED Black

        // Draw Starfield (Screen Space / Parallax)
        this.starfield.draw(this.renderer, this.x, this.y);

        this.renderer.withCamera(this.camera, () => {
            // Draw Background Grid (World Space)
            this.grid.draw(this.renderer, this.camera);

            if (this.rooms) {
                for (const room of this.rooms) {
                    // Determine color: Locked=Red, Cleared/Safe=Green/Gray
                    const isCurrent = (room === this.currentRoom);
                    let color = '#444';

                    if (room.locked) color = '#ff3333';       // Red when locked
                    else if (isCurrent) color = '#44ff44';    // Green when active (safe)
                    else if (room.cleared) color = '#666';    // Gray when visited/cleared

                    const lw = (room.locked || isCurrent) ? 8 : 4; // Much thicker lines

                    // Draw Rect
                    this.renderer.ctx.strokeStyle = color;
                    this.renderer.ctx.lineWidth = lw;
                    this.renderer.ctx.strokeRect(room.x, room.y, room.width, room.height);

                    // Fill slightly if current
                    if (isCurrent) {
                        this.renderer.ctx.fillStyle = room.locked ? 'rgba(255, 0, 0, 0.15)' : 'rgba(0, 255, 0, 0.05)';
                        this.renderer.ctx.fillRect(room.x, room.y, room.width, room.height);
                    }
                }
            }
        });

        this.renderer.withCamera(this.camera, () => {

            const shipCos = Math.cos(this.rotation);
            const shipSin = Math.sin(this.rotation);
            const CELL_STRIDE = TILE_SIZE;

            const mouse = this.input.getMousePos();
            const zoom = this.camera.zoom || 1;
            const worldMouseX = (mouse.x / zoom) + this.camera.x;
            const worldMouseY = (mouse.y / zoom) + this.camera.y;

            // SHIP DRAWING MOVED DOWN


            // Draw Enemies
            this.enemies.forEach(e => e.draw(this.renderer));
            this.bosses.forEach(b => b.draw(this.renderer));
            this.shipwrecks.forEach(s => s.draw(this.renderer));
            this.portals.forEach(p => p.draw(this.renderer));
            this.asteroids.forEach(a => a.draw(this.renderer));

            // Draw Loot Crates (Before Orbs so debris is behind tokens)
            this.lootCrates.forEach(c => c.draw(this.renderer));

            // Draw XP Orbs
            this.xpOrbs.forEach(o => o.draw(this.renderer));
            this.goldOrbs.forEach(o => o.draw(this.renderer));
            this.itemPickups.forEach(i => i.draw(this.renderer));

            // Draw Shop Items
            this.shopItems.forEach(s => {
                if (!s.purchased) {
                    s.update(0.016); // Approximate dt for animation
                    s.draw(this.renderer);
                }
            });

            // Draw Shop Item Tooltip (for hovered item)
            if (this.hoveredShopItem && !this.hoveredShopItem.purchased) {
                const canAfford = this.gold >= this.hoveredShopItem.data.price;
                this.hoveredShopItem.drawTooltip(this.renderer, canAfford);
            }

            // Draw Treasure Chests
            this.treasureChests.forEach(chest => {
                if (!chest.opened) {
                    chest.update(0.016);
                    chest.draw(this.renderer);
                }
            });

            // Draw Vault Chests
            if (this.vaultChests) {
                this.vaultChests.forEach(chest => {
                    chest.update(0.016); // Always update for spin animation
                    chest.draw(this.renderer);
                });
            }

            // Draw Treasure Chest Tooltip (for hovered chest)
            if (this.hoveredTreasureChest && !this.hoveredTreasureChest.opened) {
                this.hoveredTreasureChest.drawTooltip(this.renderer, true);
            }

            // Draw Vault Chest Tooltip
            if (this.hoveredVaultChest && !this.hoveredVaultChest.opened) {
                this.hoveredVaultChest.drawTooltip(this.renderer, this.playerShip); // Pass player for cost check
            }

            // Draw Projectiles (Late render for visibility over debris)
            this.projectiles.forEach(p => p.draw(this.renderer));

            // Draw Player Ship (On top of debris/crates/asteroids, but below explosions maybe?)
            if (!this.playerShip.isDead) {
                for (const partRef of this.playerShip.getUniqueParts()) {
                    const def = PartsLibrary[partRef.partId] || UserPartsLibrary[partRef.partId];
                    if (!def) continue;

                    const isRotated = ((partRef.rotation || 0) % 2 !== 0);
                    const w = isRotated ? def.height : def.width;
                    const h = isRotated ? def.width : def.height;

                    const localCX = (partRef.x + (w - 1) / 2) * CELL_STRIDE;
                    const localCY = (partRef.y + (h - 1) / 2) * CELL_STRIDE;

                    const worldPartX = this.x + (localCX * shipCos - localCY * shipSin);
                    const worldPartY = this.y + (localCX * shipSin + localCY * shipCos);

                    if (def.type === 'weapon') {
                        // Draw base
                        if (def.baseSprite) {
                            def.baseSprite.draw(this.renderer.ctx, worldPartX, worldPartY, this.rotation + (partRef.rotation || 0) * (Math.PI / 2));
                        } else if ((w === 1 && h === 2) || (w === 2 && h === 1)) {
                            Assets.LongHull.draw(this.renderer.ctx, worldPartX, worldPartY, this.rotation + (partRef.rotation || 0) * (Math.PI / 2));
                        } else {
                            Assets.PlayerBase.draw(this.renderer.ctx, worldPartX, worldPartY, this.rotation);
                        }

                        // Draw turret (aimed)
                        const angle = Math.atan2(worldMouseY - worldPartY, worldMouseX - worldPartX);
                        const drawOffset = def.turretDrawOffset || 0;
                        const drawX = worldPartX + Math.cos(angle) * drawOffset;
                        const drawY = worldPartY + Math.sin(angle) * drawOffset;

                        def.sprite.draw(this.renderer.ctx, drawX, drawY, angle + (def.rotationOffset || 0), 0.5, 0.5, 'rgba(255,255,255,0.4)');

                        // Railgun & Saber Charge Effect
                        if ((partRef.chargeLeft > 0 || partRef.chargeReady) && (def.stats.projectileType === 'railgun' || def.stats.projectileType === 'saber')) {
                            const pct = partRef.chargeReady ? 1.0 : (1.0 - (partRef.chargeLeft / def.stats.chargeTime));
                            let barrelLen = (h > 1.5) ? CELL_STRIDE * 1.3 : CELL_STRIDE * 0.6;
                            barrelLen += (def.turretDrawOffset || 0);
                            const tipX = worldPartX + Math.cos(angle) * barrelLen;
                            const tipY = worldPartY + Math.sin(angle) * barrelLen;

                            const isSaber = def.stats.projectileType === 'saber';
                            const baseRadius = isSaber ? 5 : 15;
                            const radius = 5 + pct * baseRadius + Math.sin(Date.now() * 0.01) * 2;
                            this.renderer.ctx.save();
                            this.renderer.ctx.globalAlpha = 0.5 + Math.random() * 0.3;
                            this.renderer.drawCircle(tipX, tipY, radius, '#00ffff');
                            this.renderer.ctx.globalAlpha = 0.8;
                            this.renderer.drawCircle(tipX, tipY, radius * 0.5, '#ffffff');
                            this.renderer.ctx.restore();
                        }
                    } else {
                        // Draw static part
                        def.sprite.draw(this.renderer.ctx, worldPartX, worldPartY, this.rotation + (partRef.rotation || 0) * (Math.PI / 2));

                        // Shield Visual
                        if (def.type === 'shield' && (!partRef.shieldCooldown || partRef.shieldCooldown <= 0)) {
                            // Draw nice pulsing blue shield overlay
                            const pulse = 1.0 + Math.sin(Date.now() * 0.005) * 0.1;
                            const scale = def.stats.shieldRadiusScale || 1.4;
                            const radius = (CELL_STRIDE / 2) * scale * pulse;

                            this.renderer.ctx.save();
                            this.renderer.ctx.fillStyle = 'rgba(0, 200, 255, 0.15)'; // Dim blue
                            this.renderer.ctx.strokeStyle = 'rgba(0, 255, 255, 0.4)';
                            this.renderer.ctx.lineWidth = 2; // Pixelized look

                            // Pixelated circle (approx) or Rect? User said "round, but pixelized"
                            this.renderer.ctx.beginPath();
                            this.renderer.ctx.arc(worldPartX, worldPartY, radius, 0, Math.PI * 2);
                            this.renderer.ctx.fill();
                            this.renderer.ctx.stroke();
                            this.renderer.ctx.restore();
                        }
                    }

                    // Special Core Effect
                    if (def.id === 'core' && def.coreEffectSprite) {
                        def.coreEffectSprite.draw(this.renderer.ctx, worldPartX, worldPartY, this.coreSpinAngle);
                    }
                }
            }

            // Draw Explosions
            for (const exp of this.explosions) {
                const alpha = exp.life / exp.maxLife;
                this.renderer.ctx.save();
                this.renderer.ctx.globalAlpha = alpha * 0.5;
                this.renderer.drawCircle(exp.x, exp.y, exp.radius * (1.2 - alpha), '#ffaa44');
                this.renderer.ctx.restore();
            }
        });

        // UI
        if (!this.hangar.active && !this.shipBuilder.active && !this.isGameOver) {
            // Health Bar (Stylish)
            const hpPct = this.playerShip.hp / this.playerShip.maxHp;
            const hpCurrent = Math.ceil(this.playerShip.hp);
            const hpMax = this.playerShip.maxHp;

            // Background
            this.renderer.drawRect(20, 20, 240, 24, 'rgba(255, 0, 0, 0.15)');
            this.renderer.ctx.strokeStyle = 'rgba(255, 0, 0, 0.3)';
            this.renderer.ctx.lineWidth = 1;
            this.renderer.ctx.strokeRect(20, 20, 240, 24);

            // Fill
            this.renderer.drawRect(20, 20, 240 * hpPct, 24, '#ff3333');

            // Text Overlays
            this.renderer.ctx.fillStyle = 'white';
            this.renderer.ctx.font = "20px 'VT323'";
            this.renderer.ctx.textAlign = 'left';
            this.renderer.ctx.fillText(`integrity`, 25, 38);

            this.renderer.ctx.textAlign = 'right';
            this.renderer.ctx.fillText(`${hpCurrent}/${hpMax}`, 255, 38);

            // Percentage (Stylish Badge)
            const badgeX = 270;
            this.renderer.drawRect(badgeX, 20, 50, 24, 'rgba(255, 255, 255, 0.1)');
            this.renderer.ctx.strokeStyle = 'white';
            this.renderer.ctx.strokeRect(badgeX, 20, 50, 24);
            this.renderer.ctx.textAlign = 'center';
            this.renderer.ctx.fillText(`${Math.ceil(hpPct * 100)}%`, badgeX + 25, 38);
            this.renderer.ctx.textAlign = 'left'; // Reset

            this.renderer.drawRect(20, 50, 150, 24, 'rgba(0, 255, 0, 0.2)');
            this.renderer.ctx.fillStyle = 'white';
            this.renderer.ctx.fillText("tab for hangar", 25, 67);

            // XP Bar
            const xpPct = this.xp / this.xpToNext;
            const barY = 85;
            this.renderer.drawRect(20, barY, 200, 12, '#112244'); // Deep blue background
            this.renderer.drawRect(20, barY, 200 * xpPct, 12, '#00ffff'); // Cyan fill
            this.renderer.ctx.fillStyle = '#00ffff';
            this.renderer.ctx.font = "18px 'VT323'";
            this.renderer.ctx.fillText(`level ${this.level} - core experience`, 20, barY + 28);

            // Gold Display (Styled)
            const goldY = barY + 35;
            const goldX = 20;
            const goldW = 100;
            const goldH = 22;

            this.renderer.drawRect(goldX, goldY, goldW, goldH, 'rgba(255, 170, 0, 0.1)');
            this.renderer.ctx.strokeStyle = '#ffaa00';
            this.renderer.ctx.lineWidth = 1;
            this.renderer.ctx.strokeRect(goldX, goldY, goldW, goldH);

            this.renderer.ctx.fillStyle = '#ffaa00'; // Gold Color
            this.renderer.ctx.textAlign = 'left';
            this.renderer.ctx.font = "16px 'VT323'";
            this.renderer.ctx.fillText(`$ ${this.gold}`, goldX + 10, goldY + 16);

            // Speed Meter
            const speed = Math.sqrt(this.vx * this.vx + this.vy * this.vy);
            const speedY = goldY + 30;

            this.renderer.ctx.fillStyle = '#00ff00';
            this.renderer.ctx.font = "16px 'VT323'";
            this.renderer.ctx.fillText(`SPEED: ${Math.floor(speed)}`, 20, speedY + 16);

            // Dash Cooldown Indicator
            const boosterCount = this.playerShip.stats.boosterCount || 0;
            if (boosterCount > 0) {
                if (this.dashCooldown > 0) {
                    const dashPct = this.dashCooldown / this.dashMaxCooldown;
                    const dy = 135;
                    this.renderer.drawRect(20, dy, 100, 8, '#222');
                    this.renderer.drawRect(20, dy, 100 * (1 - dashPct), 8, '#00ffff');
                    this.renderer.ctx.fillStyle = '#00ffff';
                    this.renderer.ctx.font = "14px 'VT323'";
                    this.renderer.ctx.fillText(`dash prep: ${Math.ceil(this.dashCooldown)}s`, 20, dy + 22);
                } else {
                    this.renderer.ctx.fillStyle = '#00ffff';
                    this.renderer.ctx.font = "14px 'VT323'";
                    this.renderer.ctx.fillText("dash ready [shift]", 20, 155);
                }
            }

            // Draw Minimap
            if (this.minimap) {
                this.minimap.x = this.renderer.width - 220; // Keep anchored right
                this.minimap.draw(this.renderer, this);
            }

            // Version & Seed (Bottom Left)
            this.renderer.ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
            this.renderer.ctx.font = "14px 'VT323'";
            this.renderer.ctx.textAlign = 'left';
            const seedText = this.levelGen ? `seed: ${this.levelGen.seed}` : '';
            this.renderer.ctx.fillText(`${this.version} [curséd vaults] | ${seedText}`, 20, this.renderer.height - 20);

            // (Old overlay UI removed - shop is now in-world)

            // Minigun Peak/Ramp Indicator at Cursor
            let topMinigun = null;
            let topPriority = -1; // 2: Peak, 1: Overheat, 0: Ramp

            for (const part of this.playerShip.getUniqueParts()) {
                const def = PartsLibrary[part.partId] || UserPartsLibrary[part.partId];
                if (def && def.stats.rampUp) {
                    let priority = -1;
                    if (part.peakMeter > 0) priority = 2;
                    else if (part.cooldown > 0 && part.rampLevel === 0) priority = 1;
                    else if (part.rampLevel > 0) priority = 0;

                    if (priority > topPriority) {
                        topPriority = priority;
                        topMinigun = { part, def };
                    } else if (priority === topPriority && topMinigun) {
                        // Tie breaker: harder ramp or lower peak/cd
                        if (priority === 2 && part.peakMeter < topMinigun.part.peakMeter) topMinigun = { part, def };
                        if (priority === 0 && part.rampLevel > topMinigun.part.rampLevel) topMinigun = { part, def };
                    }
                }
            }

            if (topMinigun) {
                const { part, def } = topMinigun;
                const mouse = this.input.getMousePos();
                const ctx = this.renderer.ctx;

                ctx.save();
                ctx.translate(mouse.x, mouse.y);

                // Outer faint ring for orientation
                ctx.beginPath();
                ctx.arc(0, 0, 35, 0, Math.PI * 2);
                ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
                ctx.lineWidth = 2;
                ctx.stroke();

                if (part.peakMeter > 0) {
                    // Burning through Peak shots
                    const pct = part.peakMeter / (def.stats.peakDuration || 5);
                    ctx.beginPath();
                    ctx.arc(0, 0, 35, -Math.PI / 2, -Math.PI / 2 + (Math.PI * 2 * pct));
                    const pulse = Math.sin(Date.now() * 0.01) * 0.5 + 0.5;
                    ctx.strokeStyle = `rgba(255, ${150 + pulse * 105}, 0, 1)`;
                    ctx.lineWidth = 6;
                    ctx.stroke();

                    ctx.fillStyle = ctx.strokeStyle;
                    ctx.font = "bold 14px 'VT323'";
                    ctx.textAlign = 'center';
                    ctx.fillText("peak", 0, -45);
                    ctx.font = "12px 'VT323'";
                    ctx.fillText(`${(part.peakMeter).toFixed(1)}s`, 0, 48);
                } else if (part.cooldown > 1 && part.rampLevel === 0) {
                    // Overheating
                    const maxCD = def.stats.overheatCooldown || 7;
                    const pct = part.cooldown / maxCD;
                    ctx.beginPath();
                    ctx.arc(0, 0, 35, -Math.PI / 2, -Math.PI / 2 + (Math.PI * 2 * pct));
                    ctx.strokeStyle = 'rgba(255, 50, 0, 0.8)';
                    ctx.lineWidth = 4;
                    ctx.stroke();

                    ctx.fillStyle = '#ff3300';
                    ctx.font = "bold 14px 'VT323'";
                    ctx.textAlign = 'center';
                    ctx.fillText("overheat", 0, -45);
                } else if (part.rampLevel > 0) {
                    // Ramping up
                    const pct = part.rampLevel / (def.stats.maxRamp || 29);
                    ctx.beginPath();
                    ctx.arc(0, 0, 35, -Math.PI / 2, -Math.PI / 2 + (Math.PI * 2 * pct));
                    ctx.strokeStyle = '#26d426';
                    ctx.lineWidth = 4;
                    ctx.stroke();
                }

                ctx.restore();
            }
        } else if (this.hangar.active) {
            this.hangar.draw(this.renderer);
        } else if (this.shipBuilder.active) {
            this.shipBuilder.draw(this.renderer);
        } else if (this.isGameOver) {
            this.renderer.ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
            this.renderer.ctx.fillRect(0, 0, this.renderer.width, this.renderer.height);
            this.renderer.ctx.fillStyle = 'red';
            this.renderer.ctx.font = "bold 64px 'VT323'";
            this.renderer.ctx.textAlign = 'center';
            this.renderer.ctx.fillText("frame destroyed", this.renderer.width / 2, this.renderer.height / 2 - 20);
            this.renderer.ctx.fillStyle = 'white';
            this.renderer.ctx.font = "32px 'VT323'";
            this.renderer.ctx.fillText("press r to restart", this.renderer.width / 2, this.renderer.height / 2 + 40);
            this.renderer.ctx.textAlign = 'left';
        }


        // --- TOOLTIP LOGIC ---
        // Check for mouse hover over ItemPickups
        if (!this.hangar.active && !this.isGameOver) {
            const mousePos = this.input.getMousePos();
            const zoom = this.camera.zoom || 1;
            // Use same formula as line 1594-1595
            const worldMouseX = (mousePos.x / zoom) + this.camera.x;
            const worldMouseY = (mousePos.y / zoom) + this.camera.y;

            let hoveredItem = null;

            // Check Pickups
            for (const item of this.itemPickups) {
                if (item.isDead) continue;
                const dx = worldMouseX - item.x;
                const dy = worldMouseY - (item.y + (Math.sin(item.life * 5 + item.bobOffset) * 4));
                // Hitbox is roughly 30px
                if (dx * dx + dy * dy < 40 * 40) {
                    hoveredItem = item;
                    break;
                }
            }

            if (hoveredItem && hoveredItem.def) {
                // Lazily create global tooltip if not exists
                if (!this.gameTooltip) {
                    this.gameTooltip = document.createElement('div');
                    this.gameTooltip.style.cssText = `
                        position: absolute;
                        background: rgba(0, 20, 40, 0.95);
                        border: 1px solid #44ccff;
                        padding: 15px;
                        color: white;
                        font-family: 'VT323', monospace;
                        pointer-events: none;
                        z-index: 1000;
                        display: none;
                        box-shadow: 0 0 10px rgba(0,0,0,0.5);
                        min-width: 200px;
                     `;
                    document.body.appendChild(this.gameTooltip);
                }

                this.gameTooltip.style.display = 'block';
                // Position near mouse but ensure it doesn't go off screen
                this.gameTooltip.style.left = (mousePos.x + 15) + 'px';
                this.gameTooltip.style.top = (mousePos.y + 15) + 'px';

                // Use the static helper from Hangar class
                Hangar.updateTooltip(this.gameTooltip, hoveredItem.def);

            } else {
                if (this.gameTooltip) this.gameTooltip.style.display = 'none';
            }
        } else {
            // Hide tooltip when in hangar or game over
            if (this.gameTooltip) this.gameTooltip.style.display = 'none';
        }

        // Draw Notifications (Bottom Center)
        if (this.notifications.length > 0) {
            this.renderer.ctx.save();
            this.renderer.ctx.textAlign = 'center';
            this.renderer.ctx.font = "24px 'VT323'";

            let y = this.renderer.height - 100;
            for (let i = 0; i < this.notifications.length; i++) {
                const n = this.notifications[i];
                const alpha = Math.min(1, n.life * 2); // Fade out
                this.renderer.ctx.globalAlpha = alpha;
                this.renderer.ctx.fillStyle = n.color;

                // Shadow for readability
                this.renderer.ctx.shadowBlur = 4;
                this.renderer.ctx.shadowColor = 'black';

                this.renderer.ctx.fillText(n.text, this.renderer.width / 2, y);
                y -= 30; // Stack upwards
            }
            this.renderer.ctx.restore();
        }
    }



    async nextLevel() {
        this.level++;
        this.showNotification(`WARPING TO LEVEL ${this.level}...`, '#aa00ff');

        // Reset Logic
        this.projectiles = [];
        this.enemies = [];
        this.bosses = [];
        this.portals = [];
        this.explosions = [];
        this.xpOrbs = [];
        this.goldOrbs = [];

        // Regenerate
        this.rooms = this.levelGen.generate(15 + this.level * 2);

        // Reset Player Pos
        this.currentRoom = this.levelGen.getRoom(0, 0);
        this.x = 1000;
        this.y = 1000;
        this.vx = 0;
        this.vy = 0;

        this.currentRoom.onEnter(this);
    }

    drawShopUI() {
        const ctx = this.renderer.ctx;
        const items = this.currentRoom.shopItems;
        if (!items || items.length === 0) return;

        const centerX = this.renderer.width / 2;
        const startY = 100;
        const itemW = 200;
        const itemH = 100;
        const gap = 20;
        const totalW = items.length * itemW + (items.length - 1) * gap;
        const startX = centerX - totalW / 2;

        // Store button rects for click detection
        this.shopButtonRects = [];

        // Title
        ctx.fillStyle = '#ffd700';
        ctx.font = "bold 36px 'VT323'";
        ctx.textAlign = 'center';
        ctx.fillText('⚒️ SHOP - Choose One ⚒️', centerX, 60);

        // Items
        for (let i = 0; i < items.length; i++) {
            const item = items[i];
            const x = startX + i * (itemW + gap);
            const y = startY;

            const canAfford = this.gold >= item.price;
            const bgColor = canAfford ? 'rgba(50, 50, 50, 0.9)' : 'rgba(30, 20, 20, 0.9)';
            const borderColor = canAfford ? '#ffd700' : '#555';

            // Background
            ctx.fillStyle = bgColor;
            ctx.fillRect(x, y, itemW, itemH);
            ctx.strokeStyle = borderColor;
            ctx.lineWidth = 2;
            ctx.strokeRect(x, y, itemW, itemH);

            // Icon & Name
            ctx.fillStyle = canAfford ? '#fff' : '#666';
            ctx.font = "bold 20px 'VT323'";
            ctx.textAlign = 'center';
            ctx.fillText(item.name, x + itemW / 2, y + 25);

            // Description
            ctx.font = "14px 'VT323'";
            ctx.fillStyle = canAfford ? '#aaa' : '#555';
            ctx.fillText(item.description, x + itemW / 2, y + 50);

            // Price
            ctx.fillStyle = canAfford ? '#ffd700' : '#ff4444';
            ctx.font = "bold 18px 'VT323'";
            ctx.fillText(`💰 ${item.price}g`, x + itemW / 2, y + 80);

            // Store rect for click
            this.shopButtonRects.push({ x, y, w: itemW, h: itemH, item, index: i, canAfford });
        }

        ctx.textAlign = 'left';
    }

    purchaseShopItem(shopItem) {
        if (!shopItem || shopItem.purchased) return;

        const item = shopItem.data;
        if (this.gold < item.price) {
            this.showNotification("not enough gold!", '#ff4444');
            return;
        }

        // Deduct gold
        this.gold -= item.price;

        // Apply effect
        if (item.type === 'heal') {
            // Heal is instant
            const healAmount = 50;
            this.playerShip.hp = Math.min(this.playerShip.hp + healAmount, this.playerShip.maxHp);
            this.showNotification(`+${healAmount} HP!`, '#44ff44');
        } else if (item.type === 'part') {
            // Spawn ItemPickup at shop item location for manual pickup
            const pickup = new ItemPickup(shopItem.x, shopItem.y, item.partId);
            this.itemPickups.push(pickup);
            this.showNotification(`Unlocked: ${item.name}! Pick it up.`, '#ffd700');
        }

        // Mark item as purchased
        shopItem.purchased = true;

        // Mark room shop as used (one purchase only)
        if (this.currentRoom) {
            this.currentRoom.shopUsed = true;
        }
    }

    openTreasureChest(chest) {
        if (!chest || chest.opened) return;

        // Get all available parts
        const allParts = [];
        for (const id of Object.keys(PartsLibrary)) {
            if (id !== 'core') allParts.push({ id, def: PartsLibrary[id] });
        }
        for (const id of Object.keys(UserPartsLibrary)) {
            if (!id.startsWith('treasure_')) allParts.push({ id, def: UserPartsLibrary[id] });
        }

        if (allParts.length === 0) {
            this.showNotification("Chest is empty!", '#ff4444');
            chest.opened = true;
            return;
        }

        // Pick a random part
        const randomPart = allParts[Math.floor(Math.random() * allParts.length)];

        // Mark chest as opened
        chest.opened = true;

        // Spawn ItemPickup at chest location for manual pickup
        const pickup = new ItemPickup(chest.x, chest.y, randomPart.id);
        this.itemPickups.push(pickup);

        // Show notification
        const partName = randomPart.def.name || randomPart.id;
        this.showNotification(`Chest opened! Pick up: ${partName}`, '#ffd700');
        this.audio.play('hit', { volume: 0.6 });
    }

    tryActivateVaultChest(chest) {
        if (chest.ambushActive) return; // Busy

        if (this.currentRoom && this.currentRoom.cleared && !chest.locked) {
            // Reward Phase (ambush cleared)
            this.openVaultChest(chest);
        } else if (!chest.locked && !chest.opened) {
            // Payment Phase
            if (chest.costType === 'gold') {
                if (this.gold >= chest.costAmount) {
                    this.gold -= chest.costAmount;
                    this.triggerVaultAmbush(chest);
                } else {
                    this.showNotification("Not enough Gold!", '#ff0000');
                }
            } else if (chest.costType === 'hp') {
                if (this.playerShip.hp > chest.costAmount) {
                    this.playerShip.hp -= chest.costAmount;
                    this.triggerVaultAmbush(chest);
                } else {
                    this.showNotification("Not enough Health!", '#ff0000');
                }
            }
        }
    }

    triggerVaultAmbush(chest) {
        // Trigger room ambush
        if (this.currentRoom) {
            this.currentRoom.startAmbush(this);
        }
    }

    openVaultChest(chest) {
        chest.opened = true;
        this.showNotification("VAULT LOOT ACQUIRED!", '#00ff00');
        this.audio.play('hit', { volume: 0.8, pitch: 0.5 });
        this.addExplosion(chest.x, chest.y, 80, 0.8);

        // Drop 3 items
        const count = 3;

        // Get non-core parts
        const possibleParts = [];
        for (const id of Object.keys(PartsLibrary)) {
            if (id !== 'core') possibleParts.push(id);
        }
        for (const id of Object.keys(UserPartsLibrary)) {
            if (!id.startsWith('treasure_')) possibleParts.push(id);
        }

        for (let i = 0; i < count; i++) {
            if (possibleParts.length > 0) {
                const randId = possibleParts[Math.floor(Math.random() * possibleParts.length)];
                // Offset slightly
                const ox = chest.x + (Math.random() - 0.5) * 60;
                const oy = chest.y + (Math.random() - 0.5) * 60;
                this.itemPickups.push(new ItemPickup(ox, oy, randId));
            }
        }
    }
}
