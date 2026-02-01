// Single source of truth for version info
// UPDATE THIS FILE when making changes to the game

export const VERSION = 'v0.5.8';
export const VERSION_NAME = 'security measures';

export const CHANGELOG = [
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
