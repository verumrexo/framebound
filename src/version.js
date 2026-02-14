// Single source of truth for version info
// UPDATE THIS FILE when making changes to the game

export const VERSION = '1.0.1 (beta)';
export const VERSION_NAME = 'SYNC_FIX';

export const CHANGELOG = [
    {
        ver: '1.0.1 (beta)',
        name: 'SYNC_FIX',
        date: new Date().toISOString().split('T')[0],
        items: [
            "Fixed Bresenham line algorithm for Asteroid pixelated rendering",
            "Fixed enemy shooting synchronization (server-side projectile speed)",
            "Fixed double-ship bug by filtering local player in NetworkManager",
            "Fixed enemy respawn bug (server sends dead enemy list on join)",
            "Fixed player rubber-banding (Game.js sends position updates)",
            "Added server-side projectile simulation"
        ]
    },
    {
        ver: '1.0.0 (beta)',
        name: 'framebound:uplink',
        date: '2026-02-13',
        items: [
            'CORE: Initial multiplayer protocol implementation (uplink established).',
            'NET: Real-time ship replication (parts, rotation, movement).',
            'NET: Connection established with local relay server.'
        ]
    },
    {
        ver: '0.7.1',
        name: 'Tainted Skies',
        date: '2026-02-03',
        items: [
            'feat: starfield layout randomized on every floor',
            'hotfix: restored biome coloring for starfield & grid',
            'navigation: fullscreen map (M key) with fast travel to visited rooms',
            'environment: starfield overhaul - parallax star layers, star clusters, planets with rings, shooting stars',
            'hotfix: rocket bay logic corrected (now properly boosts Rocket LE)',
            'quality: level-up upgrades now offer 3 unique categories (no more dupes)',
            'anti-cheat: devtools usage permanently "taints" the run, disabling high scores',
            'persistence: taint status is saved and loaded to prevent reload exploits',
            'fix: core spin effect restored (floating point precision fix)',
            'tutorial: added "m: map" instruction to start room'
        ]
    },
    {
        ver: '0.7.0',
        name: 'Core Evolution',
        date: '2026-02-03',
        changes: [
            'level up system: choice-based ship augmentations',
            '30+ unique permanent upgrades across 6 rarity tiers',
            'hangar overhaul: unified part list and augmentation tracker',
            'combat telemetry: fixed fire rate and physics scaling bugs',
            'fix: boss scaling now correctly uses floor level instead of player level',
            'security: devtools auth now disables high score recording',
            'dev tools: added authentication logout mechanism',
            'core stability: resolved critical integrity bar desync',
            'dev tools update: localized mythic force-inject'
        ]
    },
    {
        ver: '0.6.19.4',
        name: 'LOCKED_ON (HOTFIX 4)',
        date: '2026-02-02',
        items: [
            'HOTFIX: Fixed "mirrorAnchorY" crash in Boss Generator.',
            'BALANCE: Bosses now scale properly (F1=1x1 only, F2=Medium Weap limit, F3=Big Weap limit).',
            'BALANCE: Sniper is explicitly banned on Floor 1 & 2 Bosses.'
        ]
    },
    {
        ver: '0.6.19.3',
        name: 'LOCKED_ON (HOTFIX 3)',
        date: '2026-02-02',
        items: [
            'HOTFIX: Added robust save validation; save files with 0 HP are now automatically deleted on load.',
            'HOTFIX: Fixed edge case where "death-refresh" exploit could allow loading a dead state.'
        ]
    },
    {
        ver: '0.6.19.2',
        name: 'LOCKED_ON (HOTFIX 2)',
        date: '2026-02-02',
        items: [
            'HOTFIX: Fixed save-scum exploit; save file is now deleted immediately upon death.',
            'HOTFIX: Reduced audio volumes for hits (0.15).'
        ]
    },
    {
        ver: '0.6.19.1',
        name: 'LOCKED_ON (HOTFIX)',
        date: '2026-02-02',
        items: [
            'HOTFIX: Reduced player hit sound volume by 50% (was very loud).',
            'HOTFIX: Reduced enemy hit sound volume significantly (0.5 -> 0.25).',
            'HOTFIX: Reduced beam hit volumes to prevent ear fatigue.'
        ]
    },
    {
        ver: '0.6.19',
        name: 'LOCKED_ON',
        date: '2026-02-02',
        items: [
            'FIX: Bosses now telegraph heavy attacks (Railgun/Saber) with a charging laser sight.',
            'FIX: Boss aiming locks halfway through charge, allowing players to dodge heavy hits.',
            'NEW: Added numeric HP values to enemy health bars for better clarity.',
            'NEW: Implemented random visual biomes (Neon, Rust, Ice, Toxic, Solar) for floors 2+.'
        ]
    },
    {
        ver: '0.6.18',
        name: 'ACOUSTIC_CHAOS',
        date: '2026-02-02',
        items: [
            'NEW: Mini grenades now spawn 2 tiny grenades on explosion for chain damage.',
            'BUFF: Nova Cluster spawns 10 child grenades (up from 6).',
            'NEW: Nova Cluster weapon now has custom sound (nova.wav).',
            'TWEAK: Beam sounds (rail, rail_shot, rail_charge) use aggressive volume reduction when stacking.',
            'TWEAK: Saber sounds significantly quieter (charge 0.08, fire 0.15, shot 0.15).',
            'TWEAK: Railgun sounds rebalanced (charge 0.4, fire 0.5).',
            'FIX: Railgun beam color changed to red (#ff4444).',
            'FIX: Charge sounds now properly stop when releasing mouse button.',
            'FIX: Saber/Railgun charge sounds no longer stack on rapid clicks (per-part tracking).',
            'NEW: Shipwrecks now appear on minimap as red squares when room is cleared.',
            'FIX: Minimap now filters out rock asteroids, only shows crystals (gold/cyan colors).'
        ]
    },
    {
        ver: '0.6.17',
        name: 'CALIBRATED_BARRELS',
        date: '2026-02-02',
        items: [
            'FIX: Corrected gun barrel alignment by rotating the muzzle offset by the sprite\'s visual angle (aim + orientation).',
            'FIX: Updated Part Designer to calculate barrel positions relative to custom pivots, fixing offset and multi-barrel turrets.',
            'FIX: Resolved drone AI crash where they would attempt to read properties of a null game object during targeting.',
            'NEW: Integrated custom game logo into the main menu for improved branding.',
            'NEW: Minimap now enters Scavenge Mode when a room is cleared, showing all remaining crates and asteroids.',
            'FIX: GGBM missiles now correctly trigger explosions and track targets as intended.',
            'FIX: Rocketle and Rocket HE rockets are now red.',
            'FIX: Dash cooldown UI now correctly updates after using a dash.'
        ]
    },
    {
        ver: '0.6.14',
        name: 'KINETIC_STABILITY',
        date: '2026-02-02',
        items: [
            'FIX: Corrected player movement logic to properly scale with level and thrusters (restored 150/300 baseline).',
            'FIX: Removed duplicate update calls in Game.js which were doubling move speeds.',
            'FIX: Corrected LevelGenerator coordinate mapping to prevent invisible walls during room transitions.',
            'FIX: Corrected Room.js readyWeapon check to handle zero-charge cases.',
            'FIX: Synchronized currentRoom state when loading from save files.'
        ]
    },
    {
        ver: '0.6.13',
        name: 'BOSS_REFORGED',
        date: '2026-02-02',
        items: [
            'REFACTOR: created CollisionSystem.js with unified collision API.',
            'FIX: z-index draw order (asteroids/crates now behind enemies and player ship).',
            'FIX: implemented beam weapon collision with shipwrecks (was missing).',
            'PERF: eliminated array allocation in homing projectile target search.',
            'FIX: removed erroneous friendly fire check (enemy projectiles were hitting other enemies).',
            'FIX: removed duplicate accelerant bonus for lasers (was applying twice).',
            'PERF: removed mosaic pixelation effect (was causing canvas resize every frame).',
            'docs: updated readme.md to reflect v0.6.13 features and style.',
            'FIX: Aligned projectile spawn points with visual rotation offset (fixed "shooting from nowhere").',
            'NEW: Boss parts now use random symmetrical rotations for more varied ship designs.',
            'FIX: Overhauled boss part generation to prevent overlapping parts and ensure symmetry.',
            'FIX: Fixed broken update loop syntax that was causing game-wide lag.',
            'NEW: Added player vulnerability to enemy AOE explosions.',
            'FIX: Standardized projectile AOE damage to respect shooter ownership (no more self-damage).',
            'FIX: Fixed infinite explosion bug (projectiles were not being removed after death).',
            'NEW: added shield collision detection for bosses against player projectiles',
            'FIX: fixed boss self-damage loop (bosses no longer explode themselves with their own rockets)',
            'FIX: Corrected boss orientation to face the player forward along its symmetry axis.',
            'FIX: Updated debug mode to render per-part boxes for bosses instead of lazy circles.',
            'FIX: Replaced boss radius hitbox with accurate per-part hitboxes (OBB collision).',
            'UPDATE: Boss generation is now horizontally symmetrical and uses the full parts library.',
            'NEW: Added "spine link", "angular shard", and "lattice hull" structural parts.',
            'FIX: Initialized player stats in Game constructor to prevent NaN money/xp.',
            'TWEAK: Normalized boss movement and weapon logic to match standard enemies.',
            'FIX: Training Dummy now has proper collision methods (no more crashes).',
            'REFACTOR: Boss.js now extends Enemy class (cleaner code, shared logic).'
        ]
    },
    {
        ver: '0.6.12',
        name: 'NAN_VOID_PATCH',
        date: '2026-02-02',
        items: [
            'CRITICAL FIX: Initialized Game.level to 1 to prevent NaN position corruption loop.',
            'FIX: Added safety checks in Boss constructor for invalid levels.'
        ]
    },
    {
        ver: "v0.6.11",
        name: "titan protocol",
        date: "2026-02-02",
        items: [
            "- synchronized boss entities with modern combat systems",
            "- implemented per-part hitboxes for bosses (no more generic circle)",
            "- added support for 'freeze enemies' debug toggle to bosses",
            "- updated boss health bars to use holographic/segmented style",
            "- bosses now properly handle freeze mechanics and visual taints"
        ]
    },
    {
        ver: "v0.6.10",
        name: "distributed systems",
        date: "2026-02-02",
        items: [
            "- overhauled terminal config with a multi-column grid layout",
            "- integrated damage popup settings into main config",
            "- added persistent combat telemetry settings",
            "- increased settings menu width for better legibility",
            "- enemy health bars now scale in length based on maximum hp"
        ]
    },
    {
        ver: "v0.6.9",
        name: "kinetic feedback",
        date: "2026-02-02",
        items: [
            "- implemented dynamic damage numbers (floating popups)",
            "- added 'additive' vs 'singular' damage number modes in devtools",
            "- redesigned enemy health bars (holographic/segmented style)",
            "- increased health bar size and visibility",
            "- fixed explosion loop crash in renderer",
            "- fixed devtools crash (initialization order)"
        ]
    },
    {
        ver: "v0.6.8",
        name: "sonic architecture",
        date: "2026-02-01",
        items: [
            "- complete audio engine overhaul (leaky bucket limiter)",
            "- fixed audio crashes/silence during intense combat",
            "- balanced volume mixing for high-rate weapons (freeze ray, saber)",
            "- guaranteed 15% volume floor (never fully muted)",
            "- reduced freeze ray tick rate to 10hz (visuals at 50hz)",
            "- fixed visual beam despawn bugs",
            "- optimized sound prioritization for spammy effects",
            "- fixed enemy drones disappearing after hangar",
            "- fixed drone stacking (drone-to-drone separation)",
            "- fixed hive carrier shaking when spawning drones",
            "- implemented per-part hitboxes for enemies",
            "- added 'show hitboxes' debug toggle",
            "- added 'freeze enemies' debug toggle"
        ]
    },
    {
        ver: "v0.6.5",
        name: "security protocols",
        date: "2026-02-01",
        items: [
            "- devtools pin saved persistently (localStorage)",
            "- fixed L-key menu closing issues",
            "- keypad lock requires auth (2519) to access terminal",
            "- improved dev ui event isolation"
        ]
    },
    {
        ver: "v0.6.3",
        name: "calibrated optics",
        date: "2026-02-01",
        items: [
            "- freeze ray hit sounds reduced to comfortable levels",
            "- fixed freeze ray turret pivot placement",
            "- weapon sprites now use correct anchor points"
        ]
    },
    {
        ver: "v0.6.0",
        name: "quality of life",
        date: "2026-02-01",
        items: [
            "- shipwrecks can be one-shot when room is cleared",
            "- enemies now avoid stacking on each other",
            "- cursor settings now persist between sessions",
            "- hp orbs heal 5% of missing hp instead of flat value",
            "- vault rooms now show purple lock icon on minimap",
            "- freeze ray volume reduced by 90%",
            "- saber now shoots full-screen beam (global range)",
            "- added 'e: interact' to tutorial text, shifted left"
        ]
    },
    {
        ver: "v0.5.9",
        name: "quick exit",
        date: "2026-02-01",
        items: [
            "- added escape to skip highscore entry",
            "- skips directly to main menu from death screen"
        ]
    },
    {
        ver: "v0.5.8",
        name: "security measures",
        date: "2026-02-01",
        items: [
            "- added keypad lock to dev terminal",
            "- terminal now requires 4-digit authentication (2519)",
            "- improved dev ui event isolation"
        ]
    },
    {
        ver: "v0.5.7",
        name: "advanced optics",
        date: "2026-02-01",
        items: [
            "- added cursor color customization",
            "- added 'central void' (gap) adjustment for reticles",
            "- added toggleable high-contrast outlines for visibility",
            "- refined cursor drawing for better alignment"
        ]
    },
    {
        ver: "v0.5.6",
        name: "targeting computer",
        date: "2026-02-01",
        items: [
            "- implemented custom cursor system",
            "- added geometry selection (dot, circle, 3-line, 4-line)",
            "- added thickness and length sliders in settings",
            "- cursor now dynamically hides/shows based on game state"
        ]
    },
    {
        ver: "v0.5.5",
        name: "environmental guidance",
        date: "2026-02-01",
        items: [
            "- moved tutorial text to world space",
            "- instructions now appear on the starting room floor",
            "- removed tutorial HUD elements for cleaner UI"
        ]
    },
    {
        ver: "v0.5.4",
        name: "tutorial protocols",
        date: "2026-02-01",
        items: [
            "- added tutorial hints on floor 1",
            "- wasd, mouse, and tab controls displayed in hud"
        ]
    },
    {
        ver: "v0.5.3",
        name: "leaderboard restoration",
        date: "2026-02-01",
        items: [
            "- fixed name entry bug (keyboard input active)",
            "- fixed redundant death check logic",
            "- improved input state management"
        ]
    },
    {
        ver: "v0.5.2",
        name: "floaty restoration",
        date: "2026-02-01",
        items: [
            "- restored floaty/liquid slider behavior",
            "- set default pixel size back to 1",
            "- improved terminal aesthetics for settings"
        ]
    },
    {
        ver: "v0.5.1",
        name: "settings unification",
        date: "2026-02-01",
        items: [
            "- unified settings system (shared between menus)",
            "- new: mosaic, smoothing, and css pixelation toggles",
            "- fixed: pixelation no longer affects UI/text",
            "- pause menu overhaul (resume, settings, main menu)",
            "- default pixel size set to 2"
        ]
    },
    {
        ver: "v0.5.0",
        name: "system scaling",
        date: "2026-02-01",
        items: [
            "- new: floor-based enemy scaling (2x hp/damage per floor)",
            "- new: enemy spawn restrictions by floor",
            "- circler: floor 2+, sniper: floor 3+, rocketeer: floor 4+",
            "- regen now only works during active combat",
            "- new: 'next floor' button in dev tools"
        ]
    },
    {
        ver: "v0.4.3",
        name: "nova cluster",
        date: "2026-01-27",
        items: [
            "- new: barrel position selector in part designer",
            "- new: 'nova cluster' weapon (cluster grenades)",
            "- turret mode now has 'set barrel' option",
            "- custom barrel offset saved in part code",
            "- fixed weapon pivot alignment logic"
        ]
    },
    {
        ver: "v0.4.2",
        name: "health crates",
        date: "2026-01-27",
        items: [
            "- new: health crates (green glow, drops hp orbs)",
            "- new: hp orb pickup (spinning green cross)",
            "- crates now have 3 variants: xp, gold, and hp"
        ]
    },
    {
        ver: "v0.4.1",
        name: "freeze ray",
        date: "2026-01-25",
        items: [
            "- added freeze ray weapon (cyan beam)",
            "- implemented gradual freeze mechanic (3s focus)",
            "- added visual freeze indicators (blue glow)",
            "- added fps counter (bottom right)",
            "- optimized beam fire rate and collision"
        ]
    },
    {
        ver: "v0.4.0",
        name: "heavy enemies",
        date: "2026-01-24",
        items: [
            "- new: 'rocketeer' enemy (heavy 4x rockets, 2x2 rooms)",
            "- new: 'sniper' enemy (long-range, stationary)",
            "- new: 'circler' enemy (fast approach + orbit)",
            "- improved: ship builder UI (repositioned panel)",
            "- improved: burst weapon damage (5.0 DPS)",
            "- improved: part designer (2x4 legendary parts)"
        ]
    },
    {
        ver: "v0.3.1",
        name: "edge performance",
        date: "2026-01-23",
        items: [
            "- hotfix: edge browser performance (outline caching)",
            "- hotfix: removed CSS filters from enemies (4x faster)",
            "- new: pause menu with settings access",
            "- new: in-game audio controls (esc menu)"
        ]
    },
    {
        ver: "v0.3.0",
        name: "visual overhaul",
        date: "2026-01-21",
        items: [
            "- new 'settings' menu (audio controls)",
            "- visual overhaul (glass UI & animations)",
            "- font update (press start 2p)",
            "- live text logo implementation"
        ]
    },
    {
        ver: "v0.2.2.3",
        name: "advanced dev tools",
        date: "2026-01-20",
        items: [
            "- advanced dev tools (spawn, place, infinite)",
            "- physics lag fix (dt capping)",
            "- collision optimization",
            "- updated chest visuals",
            "- unified L-key menu"
        ]
    },
    {
        ver: "v0.2.2.1",
        name: "vault fixes",
        date: "2026-01-19",
        items: [
            "- fixed vault reward logic (payment & fight required)",
            "- fixed vault ambush infinite wave crash",
            "- fixed chest sprite definition crash",
            "- updated chest visuals",
            "- added debug 'I' button for nukes"
        ]
    },
    {
        ver: "v0.2.2",
        name: "high scores",
        date: "2026-01-19",
        items: [
            "- high score system with name entry",
            "- leaderboard in main menu",
            "- score display on HUD",
            "- points for kills and room clears"
        ]
    },
    {
        ver: "v0.1.5",
        name: "special rooms",
        date: "2026-01-15",
        items: ["shop room added", "treasure room added"]
    },
    {
        ver: "v0.1.0",
        name: "alpha launch",
        date: "2026-01-10",
        items: ["core flight physics", "asteroid fields", "basic combat"]
    }
];
