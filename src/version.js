// Single source of truth for version info
// UPDATE THIS FILE when making changes to the game

export const VERSION = 'v0.5.0';
export const VERSION_NAME = 'difficulty update';

export const CHANGELOG = [
    {
        ver: "v0.5.0",
        date: "2026-02-01",
        items: [
            "- new: floor-based enemy scaling (2x hp/damage per floor)",
            "- new: enemy spawn restrictions by floor",
            "- circler: floor 2+, sniper: floor 3+, rocketeer: floor 4+",
            "- regen now only works during active combat"
        ]
    },
    {
        ver: "v0.4.3",
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
        date: "2026-01-27",
        items: [
            "- new: health crates (green glow, drops hp orbs)",
            "- new: hp orb pickup (spinning green cross)",
            "- crates now have 3 variants: xp, gold, and hp"
        ]
    },

    {
        ver: "v0.4.1",
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
        date: "2026-01-19",
        items: [
            "- high score system with name entry",
            "- leaderboard in main menu",
            "- score display on HUD",
            "- points for kills and room clears"
        ]
    },
    { ver: "v0.1.5", date: "2026-01-15", items: ["shop room added", "treasure room added"] },
    { ver: "v0.1.0", date: "2026-01-10", items: ["core flight physics", "asteroid fields", "basic combat"] }
];
