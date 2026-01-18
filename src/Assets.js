import { Sprite } from './engine/Sprite.js';

// 0: Empty, 1: Green (Frame/Gun)
const COLORS = { 1: '#26d426' }; // Lighter green for visibility

// Recreated "Hollow Square" base
// 8x8 grid? Let's try to match the look.
// It looked like a thick border.
const BASE_DATA = [
    0, 1, 1, 1, 1, 1, 1, 0,
    1, 0, 0, 0, 0, 0, 0, 1,
    1, 0, 0, 0, 0, 0, 0, 1,
    1, 0, 0, 0, 0, 0, 0, 1,
    1, 0, 0, 0, 0, 0, 0, 1,
    1, 0, 0, 0, 0, 0, 0, 1,
    1, 0, 0, 0, 0, 0, 0, 1,
    0, 1, 1, 1, 1, 1, 1, 0,
];

// Peashooter: A rectangular gun.
// Looks like a simple barrel.
const TURRET_DATA = [
    0, 0, 0, 0, 0, 0, 0, 0,
    0, 1, 1, 1, 0, 0, 0, 0,
    0, 1, 1, 1, 1, 1, 1, 1, // Barrel extending Right
    0, 1, 1, 1, 1, 1, 1, 1,
    0, 1, 1, 1, 0, 0, 0, 0,
    0, 0, 0, 0, 0, 0, 0, 0,
];

export const AssetsData = {
    PlayerBase: BASE_DATA,
    Peashooter: TURRET_DATA,
    BigHull: new Array(15 * 15).fill(1), // Solid block for now 
    LongHull: new Array(8 * 15).fill(1) // 1x2 Vertical Block
};

export const Assets = {
    PlayerBase: new Sprite(BASE_DATA, 8, 8, 4, COLORS), // 8x8 pixels, scaled up 4x
    Peashooter: new Sprite(TURRET_DATA, 8, 6, 4, COLORS),
    BigHull: new Sprite(AssetsData.BigHull, 15, 15, 4, COLORS), // 15x15 
    LongHull: new Sprite(AssetsData.LongHull, 8, 15, 4, COLORS) // 8x15 (1x2)
};
