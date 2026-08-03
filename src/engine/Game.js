import { Renderer } from './Renderer.js';
import { GameLoop } from './GameLoop.js';
import { Input } from './Input.js';
import { Camera } from './Camera.js';
import { Hangar } from '../game/systems/Hangar.js';
import { Designer } from '../game/systems/Designer.js';
import { DevTools } from '../game/systems/DevTools.js';

import { Starfield } from '../game/environment/Starfield.js';
import { Grid } from '../game/environment/Grid.js';
import { LevelGenerator } from '../game/environment/LevelGenerator.js';
import { Minimap } from '../game/ui/Minimap.js';
import { FullscreenMap } from '../game/ui/FullscreenMap.js';
import { SaveManager } from '../game/systems/SaveManager.js';
import { LevelUpManager } from '../game/systems/LevelUpManager.js';

import { ShipBuilder } from '../game/systems/ShipBuilder.js';
import { AudioManager } from './AudioManager.js';
import { MainMenu } from '../game/ui/MainMenu.js';
import { VERSION, VERSION_NAME } from '../version.js';
import { Settings as GameSettings } from '../game/systems/Settings.js';
import { Biomes } from '../game/environment/Biomes.js';
import { NetworkManager } from './NetworkManager.js';
import { GameInputBindings } from './GameInputBindings.js';
import { WorldSceneRenderer } from '../game/renderers/WorldSceneRenderer.js';
import { HudRenderer } from '../game/renderers/HudRenderer.js';
import { loadGameSounds } from '../game/systems/GameAudio.js';
import { PauseMenuController } from '../game/ui/PauseMenuController.js';
import { TransientEffectsSystem } from '../game/systems/TransientEffectsSystem.js';
import { LootDropSystem } from '../game/systems/LootDropSystem.js';
import { ProjectileSystem } from '../game/systems/ProjectileSystem.js';
import { WeaponSystem } from '../game/systems/WeaponSystem.js';
import { RoomTransitionSystem } from '../game/systems/RoomTransitionSystem.js';
import { GameOverController } from '../game/systems/GameOverController.js';
import { WorldInteractionSystem } from '../game/systems/WorldInteractionSystem.js';
import { FloorProgressionSystem } from '../game/systems/FloorProgressionSystem.js';
import { ItemPickupSystem } from '../game/systems/ItemPickupSystem.js';
import { ResourceOrbSystem } from '../game/systems/ResourceOrbSystem.js';
import { PhysicsSystem } from '../game/systems/PhysicsSystem.js';
import { DroneSystem } from '../game/systems/DroneSystem.js';
import { EnemyLifecycleSystem } from '../game/systems/EnemyLifecycleSystem.js';
import { PlayerControlSystem } from '../game/systems/PlayerControlSystem.js';
import { PlayerRecoverySystem } from '../game/systems/PlayerRecoverySystem.js';
import { PlayerStateGuard } from '../game/systems/PlayerStateGuard.js';
import { GameSessionSystem } from '../game/systems/GameSessionSystem.js';
import { RoomRuntimeSystem } from '../game/systems/RoomRuntimeSystem.js';
import { FullscreenMapInputSystem } from '../game/systems/FullscreenMapInputSystem.js';
import { GameplayOverlaySystem } from '../game/systems/GameplayOverlaySystem.js';
import { FrameRuntimeSystem } from '../game/systems/FrameRuntimeSystem.js';
import { FramePresentationSystem } from '../game/renderers/FramePresentationSystem.js';
import { PeerNetworkManager } from './PeerNetworkManager.js';
import { CombatTelemetry } from '../game/systems/CombatTelemetry.js';
import { SalvageSweepSystem } from '../game/systems/SalvageSweepSystem.js';

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
        this.worldScene = new WorldSceneRenderer(this);
        this.hud = new HudRenderer(this);
        this.input = new Input(canvas);
        this.camera = new Camera(this.renderer.width, this.renderer.height);
        this.audio = new AudioManager();
        this.mainMenu = new MainMenu(this);
        this.loadingPromise = loadGameSounds(this.audio);
        this.projectiles = [];
        this.explosions = [];
        this.notifications = [];
        this.effects = new TransientEffectsSystem(this);
        this.lootDrops = new LootDropSystem(this);
        this.projectileSystem = new ProjectileSystem(this);
        this.weaponSystem = new WeaponSystem(this);
        this.roomTransitions = new RoomTransitionSystem(this);
        this.roomRuntime = new RoomRuntimeSystem(this, {
            transitions: this.roomTransitions
        });
        this.gameOverController = new GameOverController(this);
        this.worldInteractions = new WorldInteractionSystem(this);
        this.drones = [];
        this.droneSystem = new DroneSystem(this);
        this.enemies = [];
        this.bosses = [];
        this.enemyLifecycle = new EnemyLifecycleSystem(this);
        this.portals = [];
        this.xpOrbs = [];
        this.goldOrbs = [];
        this.hpOrbs = [];
        this.resourceOrbs = new ResourceOrbSystem(this);
        this.itemPickups = [];
        this.itemPickupSystem = new ItemPickupSystem(this);
        this.shipwrecks = [];
        this.asteroids = [];
        this.lootCrates = [];
        this.physicsSystem = new PhysicsSystem(this);
        this.playerControls = new PlayerControlSystem(this);
        this.playerRecovery = new PlayerRecoverySystem(this);
        this.playerStateGuard = new PlayerStateGuard(this);
        this.shopItems = [];
        this.treasureChests = [];
        this.vaultChests = [];
        this.dashCooldown = 0;
        this.dashMaxCooldown = 10;
        this.dashActiveTimer = 0;
        this.dashDuration = 1.5;
        this.dashPower = 4000;
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

        this.starfield = new Starfield(4000, 4000); // Parallax starfield
        this.grid = new Grid(200); // 200px cells

        // Initial Biome
        this.floorProgression = new FloorProgressionSystem(this);
        this.session = new GameSessionSystem(this);
        this.applyBiome(Biomes.DEFAULT);

        // Level Generation
        this.levelGen = new LevelGenerator();
        // this.rooms = ... (Deferred to startGame)

        // Check for saved game
        this.hasPendingSave = SaveManager.hasSave();
        if (this.hasPendingSave) {
            console.log('[Save] Found existing save, will prompt to continue');
        }

        this.playerShip = null; // Initialized by NetworkManager on 'init'
        this.hangar = new Hangar(this);
        this.designer = new Designer(this);
        this.shipBuilder = new ShipBuilder(this);
        this.levelUpManager = new LevelUpManager(this);

        // Minimap (Top Right, 200x200)
        // Adjust x/y dynamically in update/draw or set initial here
        this.minimap = new Minimap(this.renderer.width - 220, 20, 200, 0.03);
        this.fullscreenMap = new FullscreenMap(this);
        this.fullscreenMapOpen = false;
        this.fullscreenMapInput = new FullscreenMapInputSystem(this);

        this.networkManager = new NetworkManager(this);
        this.peerNetwork = new PeerNetworkManager(this);

        this.damageNumbers = [];
        this.combatTelemetry = new CombatTelemetry();
        this.salvageSweep = new SalvageSweepSystem(this);
        this.showDamageNumbers = true;
        this.damageNumberMode = 'singular';

        // Dev Tools
        this.devTools = new DevTools(this);
        this.gameSettings = new GameSettings(this);
        this.pauseOverlay = null;
        this.showPauseSettings = false;
        this.pauseMenu = new PauseMenuController(this);
        this.gameplayOverlays = new GameplayOverlaySystem(this);
        this.frameRuntime = new FrameRuntimeSystem(this);
        this.framePresentation = new FramePresentationSystem(this);

        this.loop = new GameLoop(
            (dt) => this.update(dt),
            () => this.draw()
        );

        // FPS Counter
        this.lastFpsTime = 0;
        this.frameCount = 0;
        this.fps = 0;

        this.paused = false;
        this.isGameOver = false;
        this.isSpectating = false;
        this.mouseDownLastFrame = false;
        this.coreSpinAngle = 0;

        // High Score System
        this.nameEntry = '';
        this.nameEntryActive = false;

        // Multiplayer
        this.network = this.networkManager;

        this.inputBindings = new GameInputBindings(this);
        this.inputBindings.attach();
    }

    startOffline(seed, isLoad = false) {
        return this.session.startOffline(seed, isLoad);
    }

    createLocalPlayer(data) {
        return this.session.createLocalPlayer(data);
    }

    start() {
        // Always show main menu - it handles save detection internally
        this.mainMenu.show();
    }



    loadFromSave(save = null, { regenerateLevel = true } = {}) {
        return this.session.loadFromSave(save, { regenerateLevel });
    }

    showNotification(text, color = '#00ffff') {
        this.effects.showNotification(text, color);
    }

    teleportToRoom(room) {
        return this.roomTransitions.teleportToRoom(room);
    }

    spawnDamageNumber(x, y, amount, isPlayer = false, source = null) {
        this.effects.spawnDamageNumber(x, y, amount, isPlayer, source);
    }

    autoSave() {
        if (SaveManager.save(this)) {
            this.showNotification('progress saved', '#44ff44');
        }
    }

    spawnAsteroidLoot(asteroid) {
        this.lootDrops.spawnAsteroidLoot(asteroid);
    }

    spawnCrateLoot(crate) {
        this.lootDrops.spawnCrateLoot(crate);
    }

    spawnEnemyProjectile(data) {
        return this.projectileSystem.spawnEnemyProjectile(data);
    }

    startGame(seed, { enterStartRoom = true } = {}) {
        return this.session.startGame(seed, { enterStartRoom });
    }

    update(dt) {
        this.frameRuntime.update(dt);
    }

    draw() {
        this.framePresentation.draw();
    }

    togglePause() {
        this.pauseMenu.toggle();
    }



    async nextLevel() {
        return this.floorProgression.nextLevel();
    }

    purchaseShopItem(shopItem) {
        this.worldInteractions.purchaseShopItem(shopItem);
    }

    openTreasureChest(chest) {
        this.worldInteractions.openTreasureChest(chest);
    }

    tryActivateVaultChest(chest) {
        this.worldInteractions.tryActivateVaultChest(chest);
    }

    triggerVaultAmbush(chest) {
        this.worldInteractions.triggerVaultAmbush(chest);
    }

    spawnExplosion(x, y, radius = 50, duration = 0.5, color = '#ffaa44') {
        this.effects.spawnExplosion(x, y, radius, duration, color);
    }

    openVaultChest(chest) {
        this.worldInteractions.openVaultChest(chest);
    }

    applyBiome(biome) {
        this.floorProgression.applyBiome(biome);
    }
    spawnProjectile(def, fireX, fireY, angle, partRef = null) {
        return this.weaponSystem.spawnProjectile(def, fireX, fireY, angle, partRef);
    }
}
