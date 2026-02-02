import { Renderer } from './Renderer.js';
import { GameLoop } from './GameLoop.js';
import { Input } from './Input.js';
import { Camera } from './Camera.js';
import { Assets } from '../Assets.js';
import { Projectile } from '../game/entities/Projectile.js';
import { Ship } from '../game/entities/Ship.js';
import { Enemy } from '../game/entities/Enemy.js';
import { PartsLibrary, TILE_SIZE } from '../game/parts/Part.js';
import { Hangar } from '../game/systems/Hangar.js';
import { Designer } from '../game/systems/Designer.js';
import { DevTools } from '../game/systems/DevTools.js';
import { Drone } from '../game/entities/Drone.js';

import { Starfield } from '../game/environment/Starfield.js';
import { Grid } from '../game/environment/Grid.js';
import { LevelGenerator } from '../game/environment/LevelGenerator.js';
import { RoomType } from '../game/environment/RoomType.js';
import { Minimap } from '../game/ui/Minimap.js';
import { XPOrb } from '../game/entities/XPOrb.js';
import { TrainingDummy } from '../game/entities/TrainingDummy.js';
import { Boss } from '../game/entities/Boss.js';
import { Portal } from '../game/entities/Portal.js';
import { GoldOrb } from '../game/entities/GoldOrb.js';
import { HPOrb } from '../game/entities/HPOrb.js';
import { Asteroid } from '../game/entities/Asteroid.js';
import { LootCrate } from '../game/entities/LootCrate.js';
import { ItemPickup } from '../game/entities/ItemPickup.js';
import { Shipwreck } from '../game/entities/Shipwreck.js';
import { SaveManager } from '../game/systems/SaveManager.js';
import { ShipBuilder } from '../game/systems/ShipBuilder.js';
import { AudioManager } from './AudioManager.js';
import { MainMenu } from '../game/ui/MainMenu.js';
import { HighScoreManager } from '../game/systems/HighScoreManager.js';
import { VERSION, VERSION_NAME } from '../version.js';
import { Settings as GameSettings } from '../game/systems/Settings.js';
import { Collision } from '../game/systems/CollisionSystem.js';
import { WeaponSystem } from '../game/systems/WeaponSystem.js';
import { PhysicsSystem } from '../game/systems/PhysicsSystem.js';

import { PlayerController } from '../game/systems/PlayerController.js';
import { Biomes, getRandomBiome } from '../game/environment/Biomes.js';

export class Game {
    constructor(canvas) {
        // Graphics Settings
        this.graphics = {
            gridOpacity: 0.15,
            bloom: true
        };

        // Default Cursor Settings
        this.cursorSettings = {
            shape: '4-lines',
            thickness: 2,
            length: 15,
            gap: 3,
            color: '#00ffff',
            outline: true
        };

        this.renderer = new Renderer(canvas);
        this.renderer.setSmoothing(false); // Default to clean pixel art
        this.input = new Input(canvas);
        this.camera = new Camera(this.renderer.width, this.renderer.height);
        this.audio = new AudioManager();
        this.mainMenu = new MainMenu(this);
        this.loadingPromise = this.loadSounds();
        this.projectiles = [];
        this.drones = [];
        this.enemies = [];
        this.bosses = [];
        this.portals = [];
        this.xpOrbs = [];
        this.goldOrbs = [];
        this.hpOrbs = [];
        this.itemPickups = [];
        this.shipwrecks = [];
        this.asteroids = [];
        this.lootCrates = [];
        this.shopItems = [];
        this.treasureChests = [];
        this.vaultChests = [];
        this.notifications = []; // {text, color, life, maxLife}

        this.version = VERSION;
        this.versionName = VERSION_NAME;

        // Player Stats
        this.score = 0;
        this.gold = 0;
        this.xp = 0;
        this.level = 1;
        this.xpToNext = 100;
        this.floor = 1;

        this.x = 1000;
        this.y = 1000;
        this.vx = 0;
        this.vy = 0;
        this.rotation = 0;

        this.starfield = new Starfield(400, 4000, 4000); // Many stars, large area
        this.grid = new Grid(200); // 200px cells

        // Initial Biome
        this.applyBiome(Biomes.DEFAULT);

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
                if (this.isGameOver) return;
                this.togglePause();
            }
        });

        this.damageNumbers = [];
        this.showDamageNumbers = true;
        this.damageNumberMode = 'singular';

        // Dev Tools
        this.devTools = new DevTools(this);
        this.settings = new GameSettings(this);
        this.weaponSystem = new WeaponSystem();
        this.physicsSystem = new PhysicsSystem();
        this.playerController = new PlayerController();


        this.pauseOverlay = null;
        this.showPauseSettings = false;

        window.addEventListener('keydown', (e) => {
            if (e.code === 'KeyL') {
                if (this.nameEntryActive) return;
                this.devTools.toggle();
            }
        });

        this.loop = new GameLoop(
            (dt) => this.update(dt),
            () => this.draw()
        );

        // FPS Counter
        this.lastFpsTime = 0;
        this.frameCount = 0;
        this.fps = 0;

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
        this.explosions = []; // {x, y, radius, life, maxLife}
        this.dashPower = 4000;

        // Leveling Separation
        this.floor = 1; // Dungeon Depth
        this.level = 1; // Player Level

        // High Score System
        this.score = 0;
        this.isGameOver = false;
        this.nameEntry = '';
        this.nameEntryActive = false;
    }

    start() {
        // Always show main menu - it handles save detection internally
        this.mainMenu.show();
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
        this.score = save.score || 0;
        this.xp = save.xp;
        this.gold = save.gold;
        this.xpToNext = save.xpToNext;

        // Restore player position
        this.x = save.playerPosition.x;
        this.y = save.playerPosition.y;
        this.rotation = save.playerPosition.rotation;

        // Resolve current room based on position
        this.currentRoom = this.levelGen.getRoomAtWorldPos(this.x, this.y);
        if (this.currentRoom) {
            console.log(`[Save] Loaded into room: ${this.currentRoom.gridX}, ${this.currentRoom.gridY}`);
            this.currentRoom.visited = true;
        } else {
            // Fallback to start room if space is empty (unlikely but safe)
            this.currentRoom = this.levelGen.getRoom(0, 0);
        }

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
        const soundList = [
            // Music
            { name: 'bgm', url: './sounds/bgm.mp3' },

            // Weapons (per-part)
            { name: 'shoot_dart', url: './sounds/dart.wav' },
            { name: 'shoot_scattr', url: './sounds/scattr.wav' },
            { name: 'shoot_lps', url: './sounds/lps.wav' },
            { name: 'shoot_ggbm', url: './sounds/ggbm.wav' },
            { name: 'shoot_rocketle', url: './sounds/rocketle.wav' },
            { name: 'shoot_minigun', url: './sounds/minigun.wav' },
            { name: 'shoot_lsr', url: './sounds/lsr.wav' },
            { name: 'shoot_rocket_he', url: './sounds/rocket_he.wav' },
            { name: 'shoot_sniper', url: './sounds/sniper.wav' },
            { name: 'rail_charge', url: './sounds/rail_charge.wav' },
            { name: 'rail', url: './sounds/rail.wav' },
            { name: 'rail_shot', url: './sounds/rail_shot.wav' },
            { name: 'nova', url: './sounds/nova.wav' },

            // Combat
            { name: 'hit', url: './sounds/hit.wav' },
            { name: 'explosion', url: './sounds/explosion.wav' },
            { name: 'shield_hit', url: './sounds/shield_hit.wav' },
            { name: 'dash', url: './sounds/dash.wav' },
            { name: 'enemy_death1', url: './sounds/enemy_death1.wav' },
            { name: 'enemy_death2', url: './sounds/enemy_death2.wav' },
            { name: 'frame_death', url: './sounds/frame_death.wav' },

            // Pickups
            { name: 'xp_pickup', url: './sounds/xp_pickup.wav' },
            { name: 'gold_pickup', url: './sounds/gold_pickup.wav' },
            { name: 'item_pickup', url: './sounds/item_pickup.wav' },
            { name: 'crate_break', url: './sounds/crate_break.wav' },
            { name: 'asteroid_break', url: './sounds/asteroid_break.wav' }
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

    spawnDamageNumber(x, y, amount, isPlayer = false) {
        if (!this.showDamageNumbers) return;

        if (this.damageNumberMode === 'additive') {
            // Find existing damage number nearby that isn't too old
            const existing = this.damageNumbers.find(d =>
                d.isPlayer === isPlayer &&
                Math.hypot(d.x - x, d.y - y) < 60 &&
                d.life > d.maxLife * 0.4
            );

            if (existing) {
                existing.amount += amount;
                existing.life = existing.maxLife; // Refresh life
                existing.scale = 1.6; // Pulse size
                existing.x = (existing.x + x) / 2; // Move toward new hit
                existing.y = (existing.y + y) / 2;
                return;
            }
        }

        this.damageNumbers.push({
            x, y,
            amount,
            isPlayer,
            life: 1.2,
            maxLife: 1.2,
            vx: (Math.random() - 0.5) * 40,
            vy: -80 - Math.random() * 40,
            scale: 1.0
        });
    }

    applyBiome(biome) {
        console.log(`[Biome] Applying: ${biome.name}`);
        this.currentBiome = biome;

        // Apply colors
        this.renderer.setBackgroundColor(biome.colors.background);
        this.grid.setColor(biome.colors.grid);
        this.starfield.setColor(biome.colors.stars);

        // Notify user
        this.showNotification(`entering ${biome.name}`, biome.colors.grid);
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
        this.audio.play('asteroid_break', { volume: 0.5, randomizePitch: 0.2 });
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
        } else if (crate.variant === 2) {
            // Variant 2 (Green) = HP
            for (let k = 0; k < count; k++) {
                const ox = crate.x + (Math.random() - 0.5) * 20;
                const oy = crate.y + (Math.random() - 0.5) * 20;
                this.hpOrbs.push(new HPOrb(ox, oy, 10));
            }
        }
        this.audio.play('crate_break', { volume: 0.5, randomizePitch: 0.2 });
    }

    updateProjectiles(dt) {
        // Update Projectiles
        for (let i = this.projectiles.length - 1; i >= 0; i--) {
            const p = this.projectiles[i];
            p.update(dt, this);

            if (p.owner === 'player') {
                if (!p.isVisualOnly) { // High-rate visual beams don't do collision
                    // Enemy Collision
                    for (const enemy of this.enemies) {
                        if (enemy.isDead) continue;

                        // Check shields first (non-beam projectiles only)
                        if (!p.isBeam) {
                            const shieldResult = enemy.checkShieldHit(p.x, p.y);
                            if (shieldResult.hit) {
                                p.isDead = true;
                                if (p.type === 'rocket' || p.type === 'rocket_le' || p.type === 'rocket_he' || p.type === 'guided_rocket' || p.type === 'ggbm' || p.type === 'mini_grenade' || p.type === 'cluster_grenade') p.shouldExplode = true;
                                this.audio.play('shield_hit', { volume: 0.5, pitch: 1.2 });
                                this.spawnExplosion(shieldResult.shieldX, shieldResult.shieldY, 15, 0.3, '#00ffff');
                                continue; // Skip body collision for this enemy
                            }
                        }

                        if (p.isBeam) {
                            if (Collision.beamCircle(p.x, p.y, p.angle, p.beamLength, p.radius || 10, enemy.x, enemy.y, enemy.radius || 20)) {
                                const now = Date.now();
                                const lastHit = p.targetHits.get(enemy) || 0;
                                if (now - lastHit > 100) {
                                    enemy.takeDamage(p.damage, p.type);
                                    this.spawnDamageNumber(enemy.x, enemy.y, p.damage);
                                    p.targetHits.set(enemy, now);
                                    const isFreeze = p.type === 'beam_freeze';
                                    const hitVol = isFreeze ? 0.05 : 0.3;
                                    this.audio.play('hit', { volume: hitVol, pitch: 1.3, randomizePitch: 0.1, isSpammy: isFreeze });
                                }
                            }
                        } else {
                            // Per-part collision check
                            const hitResult = enemy.checkPartHit(p.x, p.y, p.radius || 4);
                            if (hitResult.hit) {
                                enemy.takeDamage(p.damage, p.type);
                                this.spawnDamageNumber(p.x, p.y, p.damage);
                                this.audio.play('hit', { volume: 0.5, pitch: 1.3, randomizePitch: 0.1 });
                                p.isDead = true;
                                if (p.type === 'rocket' || p.type === 'rocket_le' || p.type === 'rocket_he' || p.type === 'guided_rocket' || p.type === 'ggbm' || p.type === 'mini_grenade' || p.type === 'cluster_grenade') p.shouldExplode = true;
                            }
                        }
                    }

                    // Boss Collision
                    for (const boss of this.bosses) {
                        if (boss.isDead) continue;
                        if (p.isBeam) {
                            if (Collision.beamCircle(p.x, p.y, p.angle, p.beamLength, p.radius || 10, boss.x, boss.y, boss.radius || 60)) {
                                const now = Date.now();
                                const lastHit = p.targetHits.get(boss) || 0;
                                if (now - lastHit > 100) {
                                    boss.takeDamage(p.damage, p.type);
                                    this.spawnDamageNumber(boss.x, boss.y, p.damage);
                                    p.targetHits.set(boss, now);
                                    const isFreeze = p.type === 'beam_freeze';
                                    const hitVol = isFreeze ? 0.08 : 0.4;
                                    this.audio.play('hit', { volume: hitVol, pitch: 0.7, isSpammy: isFreeze });
                                }
                            }
                        } else {
                            // Check Boss Shields
                            const shieldResult = boss.checkShieldHit(p.x, p.y);
                            if (shieldResult.hit) {
                                this.audio.play('shield_hit', { volume: 0.8, pitch: 0.8 });
                                p.isDead = true;
                                if (p.type === 'rocket' || p.type === 'rocket_le' || p.type === 'rocket_he' || p.type === 'guided_rocket' || p.type === 'ggbm') p.shouldExplode = true;
                                break;
                            }

                            const hitResult = boss.checkPartHit(p.x, p.y, p.radius || 4);
                            if (hitResult.hit) {
                                boss.takeDamage(p.damage, p.type);
                                this.spawnDamageNumber(p.x, p.y, p.damage);
                                this.audio.play('hit', { volume: 0.8, pitch: 0.8 });
                                p.isDead = true;
                                if (p.type === 'rocket' || p.type === 'rocket_le' || p.type === 'rocket_he' || p.type === 'guided_rocket' || p.type === 'ggbm') p.shouldExplode = true;
                                break;
                            }
                        }
                    }

                    // Shipwreck Collision
                    for (let j = this.shipwrecks.length - 1; j >= 0; j--) {
                        const wreck = this.shipwrecks[j];
                        if (wreck.isDead) continue;
                        const dx = p.x - wreck.x;
                        const dy = p.y - wreck.y;
                        if (dx * dx + dy * dy > 400 * 400) continue;

                        if (p.isBeam) {
                            if (Collision.beamCircle(p.x, p.y, p.angle, p.beamLength, p.radius || 10, wreck.x, wreck.y, wreck.radius || 60)) {
                                const now = Date.now();
                                const lastHit = p.targetHits.get(wreck) || 0;
                                if (now - lastHit > 100) {
                                    const hitResult = wreck.takeDamage(p.damage, wreck.x, wreck.y);
                                    p.targetHits.set(wreck, now);
                                    const isFreeze = p.type === 'beam_freeze';
                                    this.audio.play('hit', { volume: isFreeze ? 0.05 : 0.3, pitch: 0.8, isSpammy: isFreeze });
                                    if (hitResult && hitResult.destroyed && hitResult.shouldDrop) {
                                        this.itemPickups.push(new ItemPickup(hitResult.x, hitResult.y, hitResult.partId));
                                        this.audio.play('explosion', { volume: 0.4, pitch: 1.2 });
                                    }
                                }
                            }
                        } else {
                            const hitResult = wreck.takeDamage(p.damage, p.x, p.y);
                            if (hitResult && hitResult.destroyed !== undefined) {
                                p.isDead = true;
                                if (p.type === 'rocket' || p.type === 'rocket_le' || p.type === 'rocket_he' || p.type === 'guided_rocket' || p.type === 'ggbm') p.shouldExplode = true;
                                this.audio.play('hit', { volume: 0.4, pitch: 0.8 });
                                if (hitResult.destroyed && hitResult.shouldDrop) {
                                    this.itemPickups.push(new ItemPickup(hitResult.x, hitResult.y, hitResult.partId));
                                    this.audio.play('explosion', { volume: 0.4, pitch: 1.2 });
                                } else if (hitResult.destroyed) {
                                    this.audio.play('explosion', { volume: 0.3, pitch: 1.5 });
                                }
                            }
                        }
                        if (wreck.isDead) this.shipwrecks.splice(j, 1);
                    }

                    // Asteroid Collision
                    for (const asteroid of this.asteroids) {
                        if (asteroid.isDead || asteroid.isBroken) continue;
                        if (p.isBeam) {
                            if (Collision.beamCircle(p.x, p.y, p.angle, p.beamLength, p.radius || 10, asteroid.x, asteroid.y, asteroid.radius)) {
                                const now = Date.now();
                                const lastHit = p.targetHits.get(asteroid) || 0;
                                if (now - lastHit > 100) {
                                    if (asteroid.takeDamage(p.damage)) this.spawnAsteroidLoot(asteroid);
                                    p.targetHits.set(asteroid, now);
                                    const isFreeze = p.type === 'beam_freeze';
                                    const hitVol = isFreeze ? 0.05 : 0.3;
                                    this.audio.play('hit', { volume: hitVol, pitch: 0.5, isSpammy: isFreeze });
                                }
                            }
                        } else {
                            if (Collision.circleCircle(p.x, p.y, p.radius || 4, asteroid.x, asteroid.y, asteroid.radius)) {
                                if (asteroid.takeDamage(p.damage)) this.spawnAsteroidLoot(asteroid);
                                p.isDead = true;
                                if (p.type === 'rocket' || p.type === 'rocket_le' || p.type === 'rocket_he' || p.type === 'guided_rocket' || p.type === 'ggbm') p.shouldExplode = true;
                                this.audio.play('hit', { volume: 0.4, pitch: 0.5 });
                            }
                        }
                    }

                    // Loot Crate Collision
                    for (const crate of this.lootCrates) {
                        if (crate.isOpened) continue;
                        if (p.isBeam) {
                            if (Collision.beamCircle(p.x, p.y, p.angle, p.beamLength, p.radius || 10, crate.x, crate.y, crate.radius)) {
                                const now = Date.now();
                                const lastHit = p.targetHits.get(crate) || 0;
                                if (now - lastHit > 100) {
                                    if (crate.takeDamage(p.damage)) this.spawnCrateLoot(crate);
                                    p.targetHits.set(crate, now);
                                    const isFreeze = p.type === 'beam_freeze';
                                    const hitVol = isFreeze ? 0.05 : 0.3;
                                    this.audio.play('hit', { volume: hitVol, pitch: 1.2, isSpammy: isFreeze });
                                }
                            }
                        } else {
                            if (Collision.circleCircle(p.x, p.y, p.radius || 4, crate.x, crate.y, crate.radius)) {
                                if (crate.takeDamage(p.damage)) this.spawnCrateLoot(crate);
                                else crate.rotSpeed += (Math.random() - 0.5) * 3;
                                p.isDead = true;
                                if (p.type === 'rocket' || p.type === 'rocket_le' || p.type === 'rocket_he' || p.type === 'guided_rocket' || p.type === 'ggbm') p.shouldExplode = true;
                                this.audio.play('hit', { volume: 0.3, pitch: 1.2 });
                            }
                        }
                    }

                    // Player projectile hitting Enemy Drones
                    for (const drone of this.drones) {
                        if (drone.isDead || drone.owner === p.owner) continue; // Check owner to prevent friendly fire
                        if (p.isBeam) {
                            if (Collision.beamCircle(p.x, p.y, p.angle, p.beamLength, p.radius || 10, drone.x, drone.y, drone.radius || 8)) {
                                const now = Date.now();
                                const lastHit = p.targetHits.get(drone) || 0;
                                if (now - lastHit > 100) {
                                    drone.takeDamage(p.damage);
                                    p.targetHits.set(drone, now);
                                    const isFreeze = p.type === 'beam_freeze';
                                    this.audio.play('hit', { volume: isFreeze ? 0.1 : 0.3, pitch: 1.5, isSpammy: isFreeze });
                                }
                            }
                        } else {
                            if (Collision.circleCircle(p.x, p.y, p.radius || 4, drone.x, drone.y, drone.radius || 8)) {
                                drone.takeDamage(p.damage);
                                p.isDead = true;
                                if (p.type === 'rocket' || p.type === 'rocket_le' || p.type === 'rocket_he' || p.type === 'guided_rocket' || p.type === 'ggbm' || p.type === 'mini_grenade' || p.type === 'cluster_grenade') p.shouldExplode = true;
                                this.audio.play('hit', { volume: 0.3, pitch: 1.5 });
                                break;
                            }
                        }
                    }
                }
            } else {
                let hitResult = false;
                // Enemy projectile hitting Drones
                for (const drone of this.drones) {
                    if (drone.isDead || drone.owner === p.owner) continue; // Prevent Friendly Fire
                    if (Collision.circleCircle(p.x, p.y, p.radius || 4, drone.x, drone.y, drone.radius || 8)) {
                        drone.takeDamage(p.damage);
                        p.isDead = true;
                        if (p.type === 'rocket' || p.type === 'rocket_le' || p.type === 'rocket_he' || p.type === 'guided_rocket' || p.type === 'ggbm' || p.type === 'mini_grenade' || p.type === 'cluster_grenade') p.shouldExplode = true;
                        hitResult = false; // Projectile consumed by drone
                        this.audio.play('hit', { volume: 0.2, pitch: 1.8 });
                        break;
                    }
                }

                if (!p.isDead) {
                    // Enemy projectile hitting player (using new checkCollision)
                    const beamProps = p.isBeam ? { angle: p.angle, length: p.beamLength } : {};
                    const col = this.playerShip.checkCollision(this.x, this.y, this.rotation, p.x, p.y, p.radius || 4, p.isBeam, beamProps);

                    if (col.hit) {
                        if (col.blocked) {
                            // Shield Blocked
                            this.audio.play('shield_hit', { volume: 0.8 });
                            if (!this.audio.sounds.shield_hit) this.audio.play('hit', { pitch: 1.5 });
                            this.spawnExplosion(col.worldX, col.worldY, 25, 0.3, '#00ffff');
                            if (!p.isBeam) p.isDead = true;
                            hitResult = false;
                        } else {
                            hitResult = true; // Damage applied below
                        }
                    }
                } // End !p.isDead wrapper

                // Enemy projectile vs Asteroids
                if (!p.isDead) {
                    for (const asteroid of this.asteroids) {
                        if (asteroid.isDead || asteroid.isBroken) continue;
                        if (Collision.circleCircle(p.x, p.y, p.radius || 4, asteroid.x, asteroid.y, asteroid.radius)) {
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
                        if (Collision.circleCircle(p.x, p.y, p.radius || 4, crate.x, crate.y, crate.radius)) {
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
                    this.spawnDamageNumber(this.x, this.y, p.damage || 5, true);
                    this.audio.play('hit', { volume: 0.8, pitch: 0.7, randomizePitch: 0.1 });
                    if (!p.isBeam) p.isDead = true;
                }
            } // End else (enemy projectiles)

            // --- Handle On-Death Effects (Explosions/Splitting) ---
            if (p.isDead) {
                if (p.shouldExplode) {
                    // --- AOE Damage (Respect Ownership) ---
                    const radius = p.type === 'ggbm' ? 60 : (p.type === 'cluster_grenade' ? 50 : (p.type === 'mini_grenade' ? 25 : (p.type === 'tiny_grenade' ? 15 : 40)));
                    const life = p.type === 'ggbm' ? 0.6 : 0.4;
                    const color = (p.type === 'cluster_grenade' || p.type === 'mini_grenade' || p.type === 'tiny_grenade') ? '#44ff44' : '#ffaa00';
                    this.spawnExplosion(p.x, p.y, radius, life, color);
                    this.audio.play('explosion', { volume: 0.3, pitch: 1.2 });

                    if (p.owner === 'player') {
                        // AOE Damage to Enemies
                        for (const enemy of this.enemies) {
                            if (enemy.isDead) continue;
                            const dx = p.x - enemy.x;
                            const dy = p.y - enemy.y;
                            const distSq = dx * dx + dy * dy;
                            if (distSq < (radius + (enemy.radius || 20)) ** 2) {
                                const aoeDmg = Math.ceil(p.damage * 0.5);
                                enemy.takeDamage(aoeDmg, p.type);
                                this.spawnDamageNumber(enemy.x, enemy.y, aoeDmg);
                            }
                        }

                        // AOE Damage to Bosses
                        for (const boss of this.bosses) {
                            if (boss.isDead) continue;
                            const dx = p.x - boss.x;
                            const dy = p.y - boss.y;
                            const distSq = dx * dx + dy * dy;
                            if (distSq < (radius + (boss.radius || 60)) ** 2) {
                                const aoeDmg = Math.ceil(p.damage * 0.5);
                                boss.takeDamage(aoeDmg, p.type);
                                this.spawnDamageNumber(boss.x, boss.y, aoeDmg);
                                if (!boss.isDead) boss.flash = 5;
                            }
                        }
                    } else {
                        // Enemy Proj AOE vs Player
                        const dx = p.x - this.x;
                        const dy = p.y - this.y;
                        const distSq = dx * dx + dy * dy;
                        const playerRad = 20; // Approx
                        if (distSq < (radius + playerRad) ** 2) {
                            const aoeDmg = Math.ceil((p.damage || 10) * 0.5);
                            this.playerShip.takeDamage(aoeDmg);
                            this.spawnDamageNumber(this.x, this.y, aoeDmg, true);
                        }
                    }

                    // Cluster Grenade: Spawn child grenades
                    if (p.type === 'cluster_grenade') {
                        const childCount = p.clusterCount || 10;
                        for (let c = 0; c < childCount; c++) {
                            const childAngle = (c / childCount) * Math.PI * 2 + (Math.random() - 0.5) * 0.3;
                            const childProj = new Projectile(p.x, p.y, childAngle, 'mini_grenade', 250, p.owner, p.damage * 0.5);
                            childProj.life = 0.8 + Math.random() * 0.4; // Short fuse
                            this.projectiles.push(childProj);
                        }
                        this.audio.play('explosion', { volume: 0.5, pitch: 0.8 });
                    }

                    // Mini Grenade: Spawn 2 tiny outward grenades
                    if (p.type === 'mini_grenade') {
                        for (let c = 0; c < 2; c++) {
                            const childAngle = p.angle + (c === 0 ? -0.8 : 0.8) + (Math.random() - 0.5) * 0.4;
                            const childProj = new Projectile(p.x, p.y, childAngle, 'tiny_grenade', 180, p.owner, p.damage * 0.4);
                            childProj.life = 0.4 + Math.random() * 0.2; // Very short fuse
                            this.projectiles.push(childProj);
                        }
                    }
                }
                this.projectiles.splice(i, 1);
            }
        }
    }

    update(dt) {
        // Consolidate mouse/input state for the frame
        let isMouseDown = this.input.isMouseDown();
        const mouse = this.input.getMousePos();
        const mouseClicked = isMouseDown && !this.mouseDownLastFrame;

        // --- DEATH CHECK ---
        if (this.playerShip.isDead && !this.isGameOver) {
            console.log('[Death] Ship died! Setting up name entry');
            this.isGameOver = true;
            this.paused = true;
            this.audio.play('frame_death', { volume: 0.7 });

            // Check if this is a high score (async)
            HighScoreManager.isHighScore(this.score).then(isHigh => {
                if (isHigh) {
                    this.nameEntryActive = true;
                    this.nameEntry = '';
                    console.log('[Death] Score qualifies for leaderboard!');
                } else {
                    console.log('[Death] Score does not qualify for leaderboard');
                }
            });
        }

        if (this.isGameOver && !this.nameEntryActive) {
            if (this.input.isKeyDown('KeyR')) {
                SaveManager.clearSave(); // Delete save on death
                window.location.reload();
            }
            this.mouseDownLastFrame = isMouseDown;
            this.input.clearPressed();
            return;
        }

        // Name Entry Input Handling
        if (this.nameEntryActive) {
            for (const key of this.input.keysPressed) {
                if (key === 'Enter') {
                    if (this.nameEntry.length > 0) {
                        const finalName = this.nameEntry;
                        this.nameEntryActive = false;
                        HighScoreManager.addScore(finalName, this.score).then(() => {
                            console.log('[Score] Submitted name:', finalName);
                        });
                    }
                } else if (key === 'Escape') {
                    this.nameEntryActive = false;
                    SaveManager.clearSave();
                    window.location.reload();
                } else if (key === 'Backspace') {
                    this.nameEntry = this.nameEntry.slice(0, -1);
                } else if (this.nameEntry.length < 5) {
                    let char = '';
                    if (key.startsWith('Key')) char = key.charAt(3);
                    else if (key.startsWith('Digit')) char = key.charAt(5);
                    else if (key === 'Space') char = ' ';
                    else if (key === 'Minus') char = '-';
                    else if (key === 'Period') char = '.';

                    if (char) {
                        this.nameEntry += char.toLowerCase();
                    }
                }
            }
            this.input.clearPressed();
            this.mouseDownLastFrame = isMouseDown;
            return;
        }

        // --- UPDATE DAMAGE NUMBERS ---
        for (let i = this.damageNumbers.length - 1; i >= 0; i--) {
            const d = this.damageNumbers[i];
            d.life -= dt;
            if (d.life <= 0) {
                this.damageNumbers.splice(i, 1);
                continue;
            }
            d.x += d.vx * dt;
            d.y += d.vy * dt;
            d.vy += 200 * dt; // Gravity
            if (d.scale > 1.0) d.scale -= dt * 3.0;
            if (d.scale < 1.0) d.scale = 1.0;
        }

        if (this.hangar.active) {
            this.hangar.update(dt);
            this.mouseDownLastFrame = isMouseDown;
            this.input.clearPressed();
            return;
        }

        if (this.shipBuilder.active) {
            this.shipBuilder.update(dt);
            this.mouseDownLastFrame = isMouseDown;
            this.input.clearPressed();
            return;
        }

        // --- PAUSE MENU INTERACTION ---
        if (this.paused) {

            // Pause Settings Interaction
            if (this.showPauseSettings) {
                // Slider interaction
                if (this.pauseSettingsSliders && isMouseDown) {
                    for (const slider of this.pauseSettingsSliders) {
                        if (mouse.y >= slider.y - 10 && mouse.y <= slider.y + slider.height + 10) {
                            if (mouse.x >= slider.x && mouse.x <= slider.x + slider.width) {
                                const newValue = Math.max(0, Math.min(1, (mouse.x - slider.x) / slider.width));

                                if (slider.type === 'master') {
                                    this.audio.setMasterVolume(newValue);
                                } else if (slider.type === 'music') {
                                    this.audio.setMusicVolume(newValue);
                                } else if (slider.type === 'sfx') {
                                    this.audio.setSfxVolume(newValue);
                                }
                            }
                        }
                    }
                }

                // Back button
                if (mouseClicked && this.pauseSettingsBackButton) {
                    const btn = this.pauseSettingsBackButton;
                    if (mouse.x >= btn.x && mouse.x <= btn.x + btn.width &&
                        mouse.y >= btn.y && mouse.y <= btn.y + btn.height) {
                        this.showPauseSettings = false;
                    }
                }
            } else {
                // Pause menu button clicks
                if (mouseClicked && this.pauseButtons) {
                    for (const btn of this.pauseButtons) {
                        if (mouse.x >= btn.x && mouse.x <= btn.x + btn.width &&
                            mouse.y >= btn.y && mouse.y <= btn.y + btn.height) {
                            btn.action();
                            break;
                        }
                    }
                }
            }

            this.mouseDownLastFrame = isMouseDown;
            return; // Don't update game while paused
        }

        // --- PAUSE CHECK ---
        if (this.paused) return;

        // --- Player Controller (Movement & Rotation) ---
        this.playerController.update(this, dt);

        // --- Weapon System (Firing) ---
        this.weaponSystem.update(this, dt);

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
                // Optimization: Broad-phase AABB/Radius check first
                const shipRadius = 300; // Approximate max ship size buffer
                const dxGlobal = this.x - item.x;
                const dyGlobal = this.y - item.y;
                if (dxGlobal * dxGlobal + dyGlobal * dyGlobal > shipRadius * shipRadius) {
                    continue; // Too far from ship center, skip detailed part check
                }

                // Check collision with every part of the ship
                let collected = false;
                for (const partRef of this.playerShip.getUniqueParts()) {
                    const def = PartsLibrary[partRef.partId];
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
                    const def = PartsLibrary[item.partId];
                    const name = def ? (def.name || item.partId) : item.partId;

                    let color = '#00ff00'; // Common
                    if (def && def.rarity === 'rare') color = '#0088ff';
                    if (def && def.rarity === 'epic') color = '#aa00ff';

                    this.notifications.push({ text: `+1 ${name}`, life: 2.0, color: color });
                    this.audio.play('item_pickup', { volume: 0.5 });

                    this.itemPickups.splice(i, 1);
                    continue;
                }
            }
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

        // Room / Level Logic
        if (this.currentRoom) {
            this.currentRoom.checkAmbushStatus(this);
        }

        const playerRoom = this.levelGen.getRoomAtWorldPos(this.x, this.y);
        if (playerRoom && playerRoom !== this.currentRoom) {
            // Player moved to a new room
            // Only allow transition if current room is UNLOCKED
            if (!this.currentRoom.locked) {
                console.log('Transitioning to room:', playerRoom.gridX, playerRoom.gridY);
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
                // World Bounds Check (Unlocked)
                if (this.x < r.x + margin) {
                    const neighbor = this.levelGen.getRoomAtWorldPos(r.x - 10, this.y);
                    if (!neighbor) { this.x = r.x + margin; this.vx = 0; }
                    else { console.log('Transition Point (Left)'); }
                }
                else if (this.x > r.x + r.width - margin) {
                    const neighbor = this.levelGen.getRoomAtWorldPos(r.x + r.width + 10, this.y);
                    if (!neighbor) { this.x = r.x + r.width - margin; this.vx = 0; }
                    else { console.log('Transition Point (Right)'); }
                }

                if (this.y < r.y + margin) {
                    const neighbor = this.levelGen.getRoomAtWorldPos(this.x, r.y - 10);
                    if (!neighbor) { this.y = r.y + margin; this.vy = 0; }
                    else { console.log('Transition Point (Top)'); }
                }
                else if (this.y > r.y + r.height - margin) {
                    const neighbor = this.levelGen.getRoomAtWorldPos(this.x, r.y + r.height + 10);
                    if (!neighbor) { this.y = r.y + r.height - margin; this.vy = 0; }
                    else { console.log('Transition Point (Bottom)'); }
                }
            }
        }

        // Core Spin (1 rotation per second)
        this.coreSpinAngle += Math.PI * 2 * dt;



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

        // Update Drones (Friendly)
        const droneLimit = 8;
        if (this.drones.length < droneLimit) {
            // Check for Spawner Parts
            const now = Date.now();
            for (const part of this.playerShip.getUniqueParts()) {
                if (part.partId === 'custom_1769974460678') { // Drone Maker ID
                    if (!part.lastDroneSpawn || now - part.lastDroneSpawn > 5000) {
                        // Spawn
                        const def = PartsLibrary[part.partId];
                        const shipCos = Math.cos(this.rotation);
                        const shipSin = Math.sin(this.rotation);
                        // Calc world pos of part
                        const isRotated = ((part.rotation || 0) % 2 !== 0);
                        const w = isRotated ? def.height : def.width;
                        const h = isRotated ? def.width : def.height;
                        const localCX = (part.x + (w - 1) / 2) * TILE_SIZE;
                        const localCY = (part.y + (h - 1) / 2) * TILE_SIZE;
                        const worldPartX = this.x + (localCX * shipCos - localCY * shipSin);
                        const worldPartY = this.y + (localCX * shipSin + localCY * shipCos);

                        if (isNaN(worldPartX) || isNaN(worldPartY)) {
                            console.error('[Game] Player Drone NaN!', {
                                x: this.x, y: this.y,
                                localCX, localCY,
                                w, h,
                                TILE_SIZE: TILE_SIZE, // Check if this is 28
                                rot: this.rotation
                            });
                        }

                        this.drones.push(new Drone(worldPartX, worldPartY, part));
                        this.showNotification("drone deployed", "#00ffff");
                        this.audio.play('reload', { volume: 0.5, pitch: 2.0 });

                        part.lastDroneSpawn = now;
                        if (this.drones.length >= droneLimit) break;
                    }
                }
            }
        }

        // Enemy Drone Spawning
        for (const enemy of this.enemies) {
            if (enemy.isDead || !enemy.shipParts) continue;

            // Check for Swarm Hive parts on this enemy
            for (const part of enemy.shipParts) {
                if (part.partId === 'custom_1769974460678') { // Drone Maker ID
                    const now = Date.now();
                    // Enemy spawn rate 2000ms for testing (was 5000)
                    if (!part.lastDroneSpawn || now - part.lastDroneSpawn > 2000) {
                        // Limit enemy drones logic
                        const enemyDroneCount = this.drones.filter(d => d.owner === 'enemy').length;
                        if (enemyDroneCount >= 12) break; // Increased hard limit slightly

                        const def = PartsLibrary[part.partId];
                        const shipCos = Math.cos(enemy.rotation);
                        const shipSin = Math.sin(enemy.rotation);

                        const isRotated = ((part.rotation || 0) % 2 !== 0);
                        const w = isRotated ? def.height : def.width;
                        const h = isRotated ? def.width : def.height;
                        const localCX = (part.x + (w - 1) / 2) * TILE_SIZE;
                        const localCY = (part.y + (h - 1) / 2) * TILE_SIZE;
                        const worldPartX = enemy.x + (localCX * shipCos - localCY * shipSin);
                        const worldPartY = enemy.y + (localCX * shipSin + localCY * shipCos);

                        // DEBUG SPAWN MATH
                        if (isNaN(worldPartX) || isNaN(worldPartY)) {
                            console.error('[Game] Drone Spawn NaN!', {
                                enemyX: enemy.x,
                                enemyY: enemy.y,
                                enemyRot: enemy.rotation,
                                shipCos,
                                shipSin,
                                localCX,
                                localCY,
                                partX: part.x,
                                partY: part.y,
                                width: w,
                                height: h,
                                TILE_SIZE: TILE_SIZE
                            });
                        }

                        const newDrone = new Drone(worldPartX, worldPartY, part, 'enemy');
                        newDrone.spawnerEnemy = enemy; // Track spawner to avoid collision
                        this.drones.push(newDrone);
                        this.showNotification("ENEMY DRONE SPAWNED", "#ff00ff");

                        part.lastDroneSpawn = now;
                    }
                }
            }
        }

        this.updateEntities(dt);
        this.updateProjectiles(dt);

        const isRoomCleared = this.currentRoom && this.currentRoom.cleared;

        // Update XP Orbs
        for (let i = this.xpOrbs.length - 1; i >= 0; i--) {
            const orb = this.xpOrbs[i];
            if (isRoomCleared) orb.forced = true; // Auto-magnetize when room cleared
            const collected = orb.update(dt, this.x, this.y);
            if (collected) {
                this.xp += orb.value;
                this.audio.play('xp_pickup', { volume: 0.3, randomizePitch: 0.2 });
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
                this.audio.play('gold_pickup', { volume: 0.4, randomizePitch: 0.15 });
                this.goldOrbs.splice(i, 1);
            }
        }

        // Update HP Orbs
        for (let i = this.hpOrbs.length - 1; i >= 0; i--) {
            const orb = this.hpOrbs[i];
            if (isRoomCleared) orb.forced = true; // Auto-magnetize when room cleared
            const collected = orb.update(dt, this.x, this.y);
            if (collected) {
                const missingHp = this.playerShip.maxHp - this.playerShip.hp;
                const healAmount = Math.max(1, Math.ceil(missingHp * 0.05)); // 5% of missing HP
                this.playerShip.hp = Math.min(this.playerShip.hp + healAmount, this.playerShip.maxHp);
                this.showNotification(`+${healAmount} hp`, '#44ff44');
                this.audio.play('gold_pickup', { volume: 0.5, pitch: 1.2, randomizePitch: 0.15 });
                this.hpOrbs.splice(i, 1);
            }
        }

        // (Death check moved to start of update() method)
        if (!this.playerShip.isDead) {
            // Apply Regeneration - only during combat (enemies/bosses alive)
            const hasActiveEnemies = this.enemies.length > 0 || this.bosses.some(b => !b.isDead);
            if (this.playerShip.hp < this.playerShip.maxHp && hasActiveEnemies) {
                this.playerShip.hp += (this.playerShip.stats.regen || 0) * levelBonus * dt;
                if (this.playerShip.hp > this.playerShip.maxHp) {
                    this.playerShip.hp = this.playerShip.maxHp;
                }
            }
        }

        this.physicsSystem.update(this, dt);


        // Update Notifications
        for (let i = this.notifications.length - 1; i >= 0; i--) {
            this.notifications[i].life -= dt;
            if (this.notifications[i].life <= 0) this.notifications.splice(i, 1);
        }

        this.camera.follow({ x: this.x, y: this.y });
        this.camera.update(dt);
        this.mouseDownLastFrame = isMouseDown;
        this.input.clearPressed();
    }

    updateEntities(dt) {
        // --- Drones ---
        for (let i = this.drones.length - 1; i >= 0; i--) {
            const d = this.drones[i];

            d.update(dt, this);

            // Drone Collisions
            for (const ast of this.asteroids) {
                const dx = d.x - ast.x;
                const dy = d.y - ast.y;
                const distSq = dx * dx + dy * dy;
                const minD = (d.radius || 8) + (ast.radius || 20);
                if (distSq < minD * minD) {
                    const dist = Math.sqrt(distSq);
                    const pen = (minD - dist) * 0.5;
                    const nx = dx / dist; const ny = dy / dist;
                    d.x += nx * pen; d.y += ny * pen;
                    ast.vx -= nx * 2; ast.vy -= ny * 2;
                }
            }

            // Drone Separation
            for (const other of this.drones) {
                if (other === d) continue;
                const dx = d.x - other.x;
                const dy = d.y - other.y;
                const distSq = dx * dx + dy * dy;
                const minD = (d.radius || 8) + (other.radius || 8);
                if (distSq < minD * minD && distSq > 0.001) {
                    const dist = Math.sqrt(distSq);
                    const pen = (minD - dist) * 0.5;
                    const nx = dx / dist; const ny = dy / dist;
                    d.x += nx * pen; d.y += ny * pen;
                    other.x -= nx * pen; other.y -= ny * pen;
                }
            }

            if (d.isDead) { // Check if drone died (time or damage)
                this.spawnExplosion(d.x, d.y, 20, 0.4, '#00ffff');
                this.drones.splice(i, 1);
            }
        }

        // --- Enemies ---
        let anyDead = false;
        for (const enemy of this.enemies) {
            if (!(this.devTools && this.devTools.freezeEnemies)) {
                enemy.audio = this.audio; // Injext Audio
                enemy.update(dt, this.x, this.y, this.projectiles, this.asteroids, this.lootCrates, this.enemies, this.currentRoom);
            }
            if (enemy.isDead) anyDead = true;
        }

        // Enemy Separation
        for (let i = 0; i < this.enemies.length; i++) {
            const e1 = this.enemies[i];
            if (e1.isDead) continue;
            for (let j = i + 1; j < this.enemies.length; j++) {
                const e2 = this.enemies[j];
                if (e2.isDead) continue;
                const dx = e1.x - e2.x;
                const dy = e1.y - e2.y;
                const distSq = dx * dx + dy * dy;
                const minD = (e1.radius || 20) + (e2.radius || 20);
                if (distSq < minD * minD && distSq > 0.001) {
                    const dist = Math.sqrt(distSq);
                    const pen = (minD - dist) * 0.5;
                    const nx = dx / dist; const ny = dy / dist;
                    e1.x += nx * pen; e1.y += ny * pen;
                    e2.x -= nx * pen; e2.y -= ny * pen;
                }
            }
        }

        // --- Bosses ---
        let bossDead = false;
        for (const boss of this.bosses) {
            boss.audio = this.audio; // Injext Audio
            boss.update(dt, this.x, this.y, this.projectiles);
            if (boss.isDead) bossDead = true;
        }

        // Cleanup Dead Bosses
        if (bossDead) {
            for (let i = this.bosses.length - 1; i >= 0; i--) {
                const boss = this.bosses[i];
                if (boss.isDead) {
                    this.spawnExplosion(boss.x, boss.y, 200, 1.0);
                    this.audio.play('explosion', { volume: 0.8, pitch: 0.5 });
                    this.audio.play('enemy_death1', { volume: 0.8, pitch: 0.5 });
                    this.portals.push(new Portal(boss.x, boss.y));
                    this.showNotification("portal opened", '#aa00ff');
                    for (let k = 0; k < 10; k++) {
                        this.xpOrbs.push(new XPOrb(boss.x + (Math.random() - 0.5) * 100, boss.y + (Math.random() - 0.5) * 100, 50));
                    }
                    this.score *= 2;
                    this.showNotification(`SCORE DOUBLED! ${this.score}`, '#ffff00');
                    this.bosses.splice(i, 1);
                }
            }
        }

        // Cleanup Dead Enemies
        if (anyDead) {
            for (let i = this.enemies.length - 1; i >= 0; i--) {
                const enemy = this.enemies[i];
                if (enemy.isDead) {
                    const dropCount = enemy.type === 'striker' ? 3 : 2;
                    for (let j = 0; j < dropCount; j++) {
                        this.xpOrbs.push(new XPOrb(enemy.x + (Math.random() - 0.5) * 20, enemy.y + (Math.random() - 0.5) * 20, 10));
                    }
                    this.goldOrbs.push(new GoldOrb(enemy.x, enemy.y, 1));
                    const deathSound = Math.random() > 0.5 ? 'enemy_death1' : 'enemy_death2';
                    this.audio.play(deathSound, { volume: 0.5, randomizePitch: 0.2 });
                    const points = enemy.type === 'striker' ? 50 : 10;
                    this.score += points;
                    this.enemies.splice(i, 1);
                }
            }
        }
    }

    draw() {
        this.renderer.clear('#000'); // OLED Black

        // Draw Starfield (Screen Space / Parallax)
        this.starfield.draw(this.renderer, this.x, this.y);

        this.renderer.withCamera(this.camera, () => {
            // Draw Background Grid (World Space)
            const alpha = Math.max(0.02, this.graphics.gridOpacity);
            this.grid.draw(this.renderer, this.camera, alpha);

            if (this.rooms) {
                for (const room of this.rooms) {
                    const isCurrent = (room === this.currentRoom);
                    let color = '#444';
                    if (room.locked) color = '#ff3333';
                    else if (isCurrent) color = '#44ff44';
                    else if (room.cleared) color = '#666';

                    const lw = (room.locked || isCurrent) ? 8 : 4;
                    this.renderer.ctx.strokeStyle = color;
                    this.renderer.ctx.lineWidth = lw;
                    this.renderer.ctx.strokeRect(room.x, room.y, room.width, room.height);

                    if (isCurrent) {
                        this.renderer.ctx.fillStyle = room.locked ? 'rgba(255, 0, 0, 0.15)' : 'rgba(0, 255, 0, 0.05)';
                        this.renderer.ctx.fillRect(room.x, room.y, room.width, room.height);
                    }

                    // Tutorial
                    if (this.floor === 1 && room.gridX === 0 && room.gridY === 0) {
                        const ctx = this.renderer.ctx;
                        ctx.save();
                        ctx.textAlign = 'center';
                        ctx.font = "bold 24px 'Press Start 2P'";
                        ctx.fillStyle = 'rgba(0, 255, 255, 0.4)';
                        const centerX = room.x + room.width / 2;
                        const centerY = room.y + room.height / 2;
                        ctx.fillText("wasd: move", centerX - 100, centerY - 150);
                        ctx.fillText("l-click: shoot", centerX - 100, centerY - 80);
                        ctx.fillText("e: interact", centerX - 100, centerY - 10);
                        ctx.fillText("tab: hangar", centerX - 100, centerY + 60);
                        ctx.restore();
                    }
                }
            }

            const shipCos = Math.cos(this.rotation);
            const shipSin = Math.sin(this.rotation);
            const CELL_STRIDE = TILE_SIZE;
            const mouse = this.input.getMousePos();
            const zoom = this.camera.zoom || 1;
            let worldMouseX = (mouse.x / zoom) + this.camera.x;
            let worldMouseY = (mouse.y / zoom) + this.camera.y;

            if (this.input.joysticks && this.input.joysticks.right.active) {
                const v = this.input.joysticks.right.vector;
                const farDist = 2000;
                worldMouseX = this.x + v.x * farDist;
                worldMouseY = this.y + v.y * farDist;
            }

            // Environment (drawn first, behind entities)
            this.asteroids.forEach(a => a.draw(this.renderer));
            this.lootCrates.forEach(c => c.draw(this.renderer));
            this.shipwrecks.forEach(s => s.draw(this.renderer));
            this.portals.forEach(p => p.draw(this.renderer));

            // Pickups (small, behind ships)
            this.xpOrbs.forEach(o => o.draw(this.renderer));
            this.goldOrbs.forEach(o => o.draw(this.renderer));
            this.hpOrbs.forEach(o => o.draw(this.renderer));
            this.itemPickups.forEach(i => i.draw(this.renderer));

            // Ships (on top of environment)
            this.enemies.forEach(e => e.draw(this.renderer));
            // Player ship is drawn below after hitbox debug (was duplicated here incorrectly)
            this.bosses.forEach(b => b.draw(this.renderer));

            this.shopItems.forEach(s => { if (!s.purchased) { s.update(0.016); s.draw(this.renderer); } });
            if (this.hoveredShopItem && !this.hoveredShopItem.purchased) {
                this.hoveredShopItem.drawTooltip(this.renderer, this.gold >= this.hoveredShopItem.data.price);
            }

            this.treasureChests.forEach(chest => { if (!chest.opened) { chest.update(0.016); chest.draw(this.renderer); } });
            if (this.hoveredTreasureChest && !this.hoveredTreasureChest.opened) this.hoveredTreasureChest.drawTooltip(this.renderer, true);

            if (this.vaultChests) {
                this.vaultChests.forEach(chest => { chest.update(0.016); chest.draw(this.renderer); });
            }
            if (this.hoveredVaultChest && !this.hoveredVaultChest.opened) {
                this.hoveredVaultChest.drawTooltip(this.renderer, this.playerShip);
            }

            this.projectiles.forEach(p => p.draw(this.renderer));
            this.drones.forEach(d => d.draw(this.renderer));

            // Debug Hitboxes
            if (this.devTools && this.devTools.showHitboxes) {
                const ctx = this.renderer.ctx;
                ctx.save();
                ctx.lineWidth = 2;
                const drawRotatedRect = (cx, cy, w, h, angle) => {
                    ctx.save(); ctx.translate(cx, cy); ctx.rotate(angle);
                    ctx.strokeRect(-w / 2, -h / 2, w, h); ctx.restore();
                };

                ctx.strokeStyle = '#ff0000';
                for (const enemy of this.enemies) {
                    if (enemy.isDead) continue;
                    if (enemy.shipParts && enemy.shipParts.length > 0) {
                        const sAngle = enemy.rotation + (enemy.rotationOffset || 0);
                        const sCos = Math.cos(sAngle), sSin = Math.sin(sAngle);
                        for (const part of enemy.shipParts) {
                            const def = PartsLibrary[part.partId]; if (!def) continue;
                            const isRot = ((part.rotation || 0) % 2 !== 0);
                            const w = (isRot ? def.height : def.width) * TILE_SIZE;
                            const h = (isRot ? def.width : def.height) * TILE_SIZE;
                            const lx = (part.x + (isRot ? def.height : def.width) / 2 - 0.5) * TILE_SIZE;
                            const ly = (part.y + (isRot ? def.width : def.height) / 2 - 0.5) * TILE_SIZE;
                            drawRotatedRect(enemy.x + (lx * sCos - ly * sSin), enemy.y + (lx * sSin + ly * sCos), w, h, sAngle);
                        }
                    } else {
                        ctx.beginPath(); ctx.arc(enemy.x, enemy.y, enemy.radius || 20, 0, Math.PI * 2); ctx.stroke();
                    }
                }

                ctx.strokeStyle = '#ff8800';
                for (const boss of this.bosses) {
                    if (boss.isDead) continue;
                    if (boss.shipParts && boss.shipParts.length > 0) {
                        const sAngle = boss.rotation + (boss.rotationOffset || 0);
                        const sCos = Math.cos(sAngle), sSin = Math.sin(sAngle);
                        for (const part of boss.shipParts) {
                            const def = PartsLibrary[part.partId]; if (!def) continue;
                            const isRot = ((part.rotation || 0) % 2 !== 0);
                            const w = (isRot ? def.height : def.width) * TILE_SIZE;
                            const h = (isRot ? def.width : def.height) * TILE_SIZE;
                            const lx = (part.x + (isRot ? def.height : def.width) / 2 - 0.5) * TILE_SIZE;
                            const ly = (part.y + (isRot ? def.width : def.height) / 2 - 0.5) * TILE_SIZE;
                            drawRotatedRect(boss.x + (lx * sCos - ly * sSin), boss.y + (lx * sSin + ly * sCos), w, h, sAngle);
                        }
                    } else {
                        ctx.beginPath(); ctx.arc(boss.x, boss.y, boss.radius || 60, 0, Math.PI * 2); ctx.stroke();
                    }
                }

                for (const drone of this.drones) {
                    if (drone.isDead) continue;
                    ctx.strokeStyle = drone.owner === 'player' ? '#00ffff' : '#ff00ff';
                    const size = (drone.radius || 8) * 2;
                    drawRotatedRect(drone.x, drone.y, size, size, drone.rotation);
                }

                ctx.strokeStyle = '#00ff00';
                for (const part of this.playerShip.getUniqueParts()) {
                    const def = PartsLibrary[part.partId]; if (!def) continue;
                    const isRot = ((part.rotation || 0) % 2 !== 0);
                    const w = (isRot ? def.height : def.width) * TILE_SIZE;
                    const h = (isRot ? def.width : def.height) * TILE_SIZE;
                    const lx = (part.x + (isRot ? def.height : def.width) / 2 - 0.5) * TILE_SIZE;
                    const ly = (part.y + (isRot ? def.width : def.height) / 2 - 0.5) * TILE_SIZE;
                    drawRotatedRect(this.x + (lx * shipCos - ly * shipSin), this.y + (lx * shipSin + ly * shipCos), w, h, this.rotation);
                }
                ctx.restore();
            }

            // Draw Player Ship
            if (!this.playerShip.isDead) {
                this.playerShip.draw(this.renderer, this.x, this.y, this.rotation, worldMouseX, worldMouseY);
            }

            // Draw Explosions
            for (const exp of this.explosions) {
                const alpha = exp.life / exp.maxLife;
                this.renderer.ctx.save();
                this.renderer.ctx.globalAlpha = alpha * 0.5;
                this.renderer.drawCircle(exp.x, exp.y, exp.radius * (1.2 - alpha), '#ffaa44');
                this.renderer.ctx.restore();
            }

            // Draw Damage Numbers (World Space)
            if (this.showDamageNumbers) {
                const ctx = this.renderer.ctx;
                ctx.save();
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';

                for (const d of this.damageNumbers) {
                    const alpha = Math.min(1.0, d.life * 2.0); // Quick fade at end
                    const color = d.isPlayer ? '#ff4444' : '#00ffff';
                    const size = Math.floor(12 * d.scale);

                    ctx.font = `${size}px 'Press Start 2P'`;

                    // Black glow/outline
                    ctx.shadowBlur = 4;
                    ctx.shadowColor = 'black';
                    ctx.fillStyle = 'black';
                    ctx.fillText(Math.ceil(d.amount), d.x + 2, d.y + 2);

                    ctx.shadowBlur = 0;
                    ctx.globalAlpha = alpha;
                    ctx.fillStyle = color;
                    ctx.fillText(Math.ceil(d.amount), d.x, d.y);
                }
                ctx.restore();
            }
        });

        // Present World (Applies Mosaic/Resolution Scale here)
        // Everything drawn after this will be at native resolution and non-pixelated.
        this.renderer.present();

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
            this.renderer.ctx.font = "8px 'Press Start 2P'";
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

            // HANGAR BUTTON (Bottom Right - Mobile Only)
            if (this.input.isTouch) {
                const hangarBtnX = this.renderer.width - 120;
                const hangarBtnY = this.renderer.height - 60;
                this.hangarButtonRect = { x: hangarBtnX, y: hangarBtnY, w: 100, h: 40 };

                this.renderer.drawRect(hangarBtnX, hangarBtnY, 100, 40, 'rgba(0, 255, 0, 0.1)');
                this.renderer.ctx.strokeStyle = '#00ffff';
                this.renderer.ctx.lineWidth = 1;
                this.renderer.ctx.strokeRect(hangarBtnX, hangarBtnY, 100, 40);

                this.renderer.ctx.fillStyle = '#00ffff';
                this.renderer.ctx.font = "8px 'Press Start 2P'";
                this.renderer.ctx.textAlign = 'center';
                this.renderer.ctx.fillText("hangar", hangarBtnX + 50, hangarBtnY + 26);
                this.renderer.ctx.textAlign = 'left'; // Reset
            } else {
                this.hangarButtonRect = null;
            }

            // XP Bar
            const xpPct = this.xp / this.xpToNext;
            const barY = 85;
            this.renderer.drawRect(20, barY, 200, 12, '#112244'); // Deep blue background
            this.renderer.drawRect(20, barY, 200 * xpPct, 12, '#00ffff'); // Cyan fill
            this.renderer.ctx.fillStyle = '#00ffff';
            this.renderer.ctx.font = "10px 'Press Start 2P'";
            this.renderer.ctx.fillText(`lvl ${this.level} | floor ${this.floor}`, 20, barY + 28);

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
            this.renderer.ctx.font = "8px 'Press Start 2P'";
            this.renderer.ctx.fillText(`$ ${this.gold}`, goldX + 10, goldY + 16);

            // Speed Meter
            const speed = Math.sqrt(this.vx * this.vx + this.vy * this.vy);
            const speedY = goldY + 30;

            this.renderer.ctx.fillStyle = '#00ff00';
            this.renderer.ctx.font = "8px 'Press Start 2P'";
            this.renderer.ctx.textAlign = 'left';
            this.renderer.ctx.fillText(`speed: ${Math.floor(speed)}`, 20, speedY + 16);

            // Dash Cooldown Indicator

            // Dash Cooldown Indicator
            const boosterCount = this.playerShip.stats.boosterCount || 0;
            if (boosterCount > 0) {
                const ctrl = this.playerController;
                if (ctrl.dashCooldown > 0) {
                    const dashPct = ctrl.dashCooldown / ctrl.dashMaxCooldown;
                    const dy = 135;
                    this.renderer.drawRect(20, dy, 100, 8, '#222');
                    this.renderer.drawRect(20, dy, 100 * (1 - dashPct), 8, '#00ffff');
                    this.renderer.ctx.fillStyle = '#00ffff';
                    this.renderer.ctx.font = "8px 'Press Start 2P'";
                    this.renderer.ctx.fillText(`dash prep: ${Math.ceil(ctrl.dashCooldown)}s`, 20, dy + 22);
                } else {
                    this.renderer.ctx.fillStyle = '#00ffff';
                    this.renderer.ctx.font = "8px 'Press Start 2P'";
                    this.renderer.ctx.fillText("dash ready [shift]", 20, 155);
                }
            }

            // Draw Minimap
            if (this.minimap) {
                this.minimap.x = this.renderer.width - 220; // Keep anchored right
                this.minimap.draw(this.renderer, this);
            }

            // Score Display (Below Minimap - drawn AFTER minimap to avoid clip issues)
            this.renderer.ctx.fillStyle = '#ffff00';
            this.renderer.ctx.font = "8px 'Press Start 2P'";
            this.renderer.ctx.textAlign = 'right';
            this.renderer.ctx.fillText(`score: ${this.score}`, this.renderer.width - 20, 220);
            this.renderer.ctx.textAlign = 'left'; // Reset

            // FPS Counter
            const now = performance.now();
            this.frameCount++;
            if (now - this.lastFpsTime >= 500) {
                this.fps = Math.round((this.frameCount * 1000) / (now - this.lastFpsTime));
                this.frameCount = 0;
                this.lastFpsTime = now;
            }
            this.renderer.ctx.fillStyle = '#00ff00';
            this.renderer.ctx.font = "8px 'Press Start 2P'";
            this.renderer.ctx.textAlign = 'right';
            this.renderer.ctx.fillText(`fps: ${this.fps}`, this.renderer.width - 20, this.renderer.height - 20);
            this.renderer.ctx.textAlign = 'left';

            // Version & Seed (Bottom Left)
            this.renderer.ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
            this.renderer.ctx.font = "8px 'Press Start 2P'";
            this.renderer.ctx.textAlign = 'left';
            const seedText = this.levelGen ? `seed: ${this.levelGen.seed}` : '';
            this.renderer.ctx.fillText(`${this.version} [${this.versionName}] | ${seedText}`, 20, this.renderer.height - 20);

            // (Old overlay UI removed - shop is now in-world)

            // Draw Virtual Joysticks
            if (this.input.joysticks) {
                const ctx = this.renderer.ctx;
                for (const side of ['left', 'right']) {
                    const stick = this.input.joysticks[side];
                    if (stick.active) {
                        ctx.beginPath();
                        ctx.arc(stick.origin.x, stick.origin.y, 50, 0, Math.PI * 2);
                        ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
                        ctx.lineWidth = 4;
                        ctx.stroke();

                        ctx.beginPath();
                        ctx.arc(stick.current.x, stick.current.y, 25, 0, Math.PI * 2);
                        ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
                        ctx.fill();
                    }
                }
            }

            // Minigun Peak/Ramp Indicator at Cursor
            let topMinigun = null;
            let topPriority = -1; // 2: Peak, 1: Overheat, 0: Ramp

            for (const part of this.playerShip.getUniqueParts()) {
                const def = PartsLibrary[part.partId];
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
                    ctx.font = "bold 10px 'Press Start 2P'";
                    ctx.textAlign = 'center';
                    ctx.fillText("peak", 0, -45);
                    ctx.font = "6px 'Press Start 2P'";
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
                    ctx.font = "bold 10px 'Press Start 2P'";
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
        } else if (this.isGameOver && !this.nameEntryActive) {
            // Simple death screen (no high score)
            this.renderer.ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
            this.renderer.ctx.fillRect(0, 0, this.renderer.width, this.renderer.height);
            this.renderer.ctx.fillStyle = 'red';
            this.renderer.ctx.font = "bold 36px 'Press Start 2P'";
            this.renderer.ctx.textAlign = 'center';
            this.renderer.ctx.fillText("frame destroyed", this.renderer.width / 2, this.renderer.height / 2 - 80);
            this.renderer.ctx.fillStyle = '#ffff00';
            this.renderer.ctx.font = "20px 'Press Start 2P'";
            this.renderer.ctx.fillText(`FINAL SCORE: ${this.score}`, this.renderer.width / 2, this.renderer.height / 2);
            this.renderer.ctx.fillStyle = 'white';
            this.renderer.ctx.font = "20px 'Press Start 2P'";
            this.renderer.ctx.fillText("press r to restart", this.renderer.width / 2, this.renderer.height / 2 + 60);
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
                        font-family: 'Press Start 2P', monospace;
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
            this.renderer.ctx.font = "12px 'Press Start 2P'";

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



        // Name Entry Screen (Game Over)
        if (this.nameEntryActive) {
            console.log('[Draw] Name Entry Active! Entry:', this.nameEntry);
            const ctx = this.renderer.ctx;

            // Dark overlay
            ctx.fillStyle = 'rgba(0, 0, 0, 0.85)';
            ctx.fillRect(0, 0, this.renderer.width, this.renderer.height);

            // Title
            ctx.fillStyle = '#ff4444';
            ctx.font = "24px 'Press Start 2P'";
            ctx.textAlign = 'center';
            ctx.fillText('game over', this.renderer.width / 2, this.renderer.height / 2 - 150);

            // Score
            ctx.fillStyle = '#ffff00';
            ctx.font = "16px 'Press Start 2P'";
            ctx.fillText(`final score: ${this.score}`, this.renderer.width / 2, this.renderer.height / 2 - 80);

            // High Score Message
            ctx.fillStyle = '#00ff00';
            ctx.font = "16px 'Press Start 2P'";
            ctx.fillText('new high score!', this.renderer.width / 2, this.renderer.height / 2 - 30);

            // Name Entry Prompt
            ctx.fillStyle = '#ffffff';
            ctx.font = "8px 'Press Start 2P'";
            ctx.fillText('enter your name (5 chars)', this.renderer.width / 2, this.renderer.height / 2 + 20);

            // Name Entry Box
            const boxWidth = 300;
            const boxHeight = 60;
            const boxX = this.renderer.width / 2 - boxWidth / 2;
            const boxY = this.renderer.height / 2 + 40;

            ctx.strokeStyle = '#00ff00';
            ctx.lineWidth = 2;
            ctx.strokeRect(boxX, boxY, boxWidth, boxHeight);

            // Current Name
            ctx.fillStyle = '#00ff00';
            ctx.font = "16px 'Press Start 2P'";
            const displayName = this.nameEntry + '_'.repeat(5 - this.nameEntry.length);
            ctx.fillText(displayName, this.renderer.width / 2, boxY + 42);

            // Instructions
            ctx.fillStyle = '#aaaaaa';
            ctx.font = "8px 'Press Start 2P'";
            ctx.fillText('press enter to submit', this.renderer.width / 2, boxY + 90);
            ctx.fillText('press esc to skip', this.renderer.width / 2, boxY + 110);
            this.renderer.present();
        }

        // Draw Custom Cursor (Last layer)
        this.drawCustomCursor();
    }

    drawCustomCursor() {
        if (this.hangar.active || this.shipBuilder.active || this.paused) {
            this.renderer.canvas.style.cursor = 'default';
            return;
        }

        // Hide OS cursor in game
        this.renderer.canvas.style.cursor = 'none';

        const mouse = this.input.getMousePos();
        const ctx = this.renderer.ctx;
        const settings = this.cursorSettings;

        ctx.save();
        ctx.translate(mouse.x, mouse.y);
        ctx.lineCap = 'square';

        const drawShape = (color, thickness, offset = 0) => {
            ctx.strokeStyle = color;
            ctx.lineWidth = thickness;

            const len = settings.length + offset;
            const gap = settings.gap + offset;

            switch (settings.shape) {
                case 'dot':
                    ctx.fillStyle = color;
                    ctx.fillRect(-(thickness / 2 + offset), -(thickness / 2 + offset), thickness + offset * 2, thickness + offset * 2);
                    break;
                case 'circle':
                    ctx.beginPath();
                    ctx.arc(0, 0, (len + gap) / 2, 0, Math.PI * 2);
                    ctx.stroke();
                    break;
                case '3-lines':
                    for (let i = 0; i < 3; i++) {
                        const angle = (i * Math.PI * 2 / 3) - Math.PI / 2;
                        ctx.beginPath();
                        ctx.moveTo(Math.cos(angle) * gap, Math.sin(angle) * gap);
                        ctx.lineTo(Math.cos(angle) * (gap + len), Math.sin(angle) * (gap + len));
                        ctx.stroke();
                    }
                    break;
                case '4-lines':
                default:
                    ctx.beginPath(); // Top
                    ctx.moveTo(0, -gap); ctx.lineTo(0, -(gap + len));
                    ctx.stroke();
                    ctx.beginPath(); // Bottom
                    ctx.moveTo(0, gap); ctx.lineTo(0, gap + len);
                    ctx.stroke();
                    ctx.beginPath(); // Left
                    ctx.moveTo(-gap, 0); ctx.lineTo(-(gap + len), 0);
                    ctx.stroke();
                    ctx.beginPath(); // Right
                    ctx.moveTo(gap, 0); ctx.lineTo(gap + len, 0);
                    ctx.stroke();
                    break;
            }
        };

        // Draw Outline First
        if (settings.outline) {
            drawShape('#000000', settings.thickness + 2, 1);
        }

        // Draw Primary
        drawShape(settings.color, settings.thickness);

        ctx.restore();
    }

    togglePause() {
        if (this.isGameOver) return;
        this.paused = !this.paused;
        if (this.paused) {
            this.showPauseMenu();
        } else {
            this.hidePauseMenu();
        }
    }

    showPauseMenu() {
        if (this.pauseOverlay) return;

        this.pauseOverlay = document.createElement('div');
        this.pauseOverlay.id = 'pause-menu';
        this.pauseOverlay.style.cssText = `
            position: fixed;
            top: 0; left: 0; right: 0; bottom: 0;
            background: rgba(0, 0, 0, 0.85);
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            z-index: 10000;
            font-family: 'Press Start 2P', cursive;
            color: white;
            transition: opacity 0.3s;
        `;

        document.body.appendChild(this.pauseOverlay);
        this.renderPauseContent();

        // Stop propagation
        this.pauseOverlay.onmousedown = (e) => e.stopPropagation();
        this.pauseOverlay.onclick = (e) => e.stopPropagation();
    }

    renderPauseContent() {
        if (!this.pauseOverlay) return;

        if (this.showPauseSettings) {
            this.settings.render(this.pauseOverlay, () => {
                this.showPauseSettings = false;
                this.renderPauseContent();
            });
            return;
        }

        this.pauseOverlay.innerHTML = `
            <h2 style="color: #00ffff; margin-bottom: 50px; font-size: 32px; text-shadow: 0 0 10px #00ffff; text-transform: lowercase;">paused</h2>
            
            <div style="display: flex; flex-direction: column; gap: 20px; width: 300px;">
                <button id="btn-resume" class="pause-btn">resume</button>
                <button id="btn-pause-settings" class="pause-btn">settings</button>
                <button id="btn-main-menu" class="pause-btn" style="margin-top: 20px; border-color: rgba(255,0,0,0.3);">main menu</button>
            </div>

            <style>
                .pause-btn {
                    padding: 15px;
                    font-size: 14px;
                    background: rgba(0, 40, 60, 0.6);
                    border: 1px solid rgba(0, 255, 255, 0.2);
                    color: #00ffff;
                    cursor: pointer;
                    font-family: 'Press Start 2P', cursive;
                    text-transform: lowercase;
                    transition: all 0.2s;
                }
                .pause-btn:hover {
                    background: rgba(0, 255, 255, 0.2);
                    border-color: #00ffff;
                    color: white;
                }
                #btn-main-menu:hover {
                    border-color: #ff3333;
                    background: rgba(255, 0, 0, 0.1);
                }
            </style>
        `;

        setTimeout(() => {
            const btnResume = document.getElementById('btn-resume');
            const btnSettings = document.getElementById('btn-pause-settings');
            const btnMenu = document.getElementById('btn-main-menu');

            if (btnResume) btnResume.onclick = () => this.togglePause();
            if (btnSettings) btnSettings.onclick = () => {
                this.showPauseSettings = true;
                this.renderPauseContent();
            };
            if (btnMenu) btnMenu.onclick = () => {
                if (confirm('return to main menu? progress will be saved.')) {
                    this.hidePauseMenu();
                    this.paused = false;
                    this.loop.stop();
                    this.audio.stopMusic();
                    this.mainMenu.show();
                }
            };
        }, 0);
    }

    hidePauseMenu() {
        if (this.pauseOverlay) {
            this.pauseOverlay.remove();
            this.pauseOverlay = null;
            this.showPauseSettings = false;
        }
    }



    async nextLevel() {
        this.floor++;

        // Change Biome
        if (this.floor > 1) {
            this.applyBiome(getRandomBiome());
        } else {
            this.applyBiome(Biomes.DEFAULT);
        }

        this.showNotification(`WARPING TO FLOOR ${this.floor}...`, '#aa00ff');

        // Reset Logic
        this.projectiles = [];
        this.enemies = [];
        this.drones = [];
        this.bosses = [];
        this.portals = [];
        this.explosions = [];
        this.xpOrbs = [];
        this.goldOrbs = [];
        this.hpOrbs = [];

        // Regenerate
        this.goldOrbs = [];

        // Regenerate (Use Floor for difficulty/size)
        this.rooms = this.levelGen.generate(15 + this.floor * 2);

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
        ctx.font = "bold 16px 'Press Start 2P'";
        ctx.textAlign = 'center';
        ctx.fillText('âš’ï¸ SHOP - Choose One âš’ï¸', centerX, 60);

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
            ctx.font = "bold 10px 'Press Start 2P'";
            ctx.textAlign = 'center';
            ctx.fillText(item.name, x + itemW / 2, y + 25);

            // Description
            ctx.font = "8px 'Press Start 2P'";
            ctx.fillStyle = canAfford ? '#aaa' : '#555';
            ctx.fillText(item.description, x + itemW / 2, y + 50);

            // Price
            ctx.fillStyle = canAfford ? '#ffd700' : '#ff4444';
            ctx.font = "bold 10px 'Press Start 2P'";
            ctx.fillText(`ðŸ’° ${item.price}g`, x + itemW / 2, y + 80);

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

        // Reward Phase: Room is clear AND the chest was recently 'unlocked' by an ambush
        // If it's a vault room that hasn't started an ambush yet, chest.locked is false, 
        // but it hasn't been paid for.
        if (this.currentRoom && this.currentRoom.cleared && !chest.locked && chest.wasPaid) {
            this.openVaultChest(chest);
        } else if (!chest.locked && !chest.opened && !chest.wasPaid) {
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
        chest.wasPaid = true;
        if (this.currentRoom) {
            this.currentRoom.startAmbush(this);
        }
    }

    spawnExplosion(x, y, radius = 50, duration = 0.5, color = '#ffaa44') {
        this.explosions.push({
            x: x,
            y: y,
            radius: radius,
            life: duration,
            maxLife: duration,
            color: color
        });
    }

    openVaultChest(chest) {
        chest.opened = true;
        this.showNotification("VAULT LOOT ACQUIRED!", '#00ff00');
        this.audio.play('hit', { volume: 0.8, pitch: 0.5 });
        this.spawnExplosion(chest.x, chest.y, 80, 0.8);

        // Drop 3 items
        const count = 3;

        // Get non-core parts
        const possibleParts = [];
        for (const id of Object.keys(PartsLibrary)) {
            if (id !== 'core') possibleParts.push(id);
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

