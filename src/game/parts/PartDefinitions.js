
// Asset is 8x8 scaled by 4 = 32px.
// Border is 1px scaled by 4 = 4px.
// To have single-width walls, we must overlap by the border width (4px).
// So effective tile stride is 32 - 4 = 28.
export const TILE_SIZE = 28;

export const PartType = {
    HULL: 'hull',
    WEAPON: 'weapon',
    THRUSTER: 'thruster',
    ACCELERANT: 'accelerant',
    ROCKET_BAY: 'rocket_bay',
    BOOSTER: 'booster',
    CORE: 'core',
    SHIELD: 'shield'
};

export class PartDef {
    constructor(id, name, type, sprite, stats = {}, width = 1, height = 1) {
        this.id = id;
        this.name = name;
        this.type = type;
        this.sprite = sprite;
        this.width = width;
        this.height = height;
        this.baseSprite = null; // Optional custom base frame
        this.rotationOffset = 0; // Optional rotation offset for turrets
        this.turretDrawOffset = 0; // Optional positional offset for turrets (along aim vector)
        this.stats = {
            hp: 10,
            mass: 1,
            energy: 0,
            ...stats
        };
    }
}
