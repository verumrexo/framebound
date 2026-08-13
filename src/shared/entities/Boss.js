import { Enemy } from './Enemy.js';

// Compatibility name for callers that still keep bosses in a separate array.
// Bosses now use the exact same authored blueprint and tactical runtime as every
// other hostile; this class deliberately contains no procedural ship generator.
export class Boss extends Enemy {
    constructor(x, y, level, randomGen = null, type = null, options = {}) {
        if (!type && !options.blueprint) {
            throw new Error('boss creation requires an authored enemy blueprint');
        }
        super(x, y, type || options.blueprint.id, level, randomGen, options.id, options);
        this.level = level || 1;
        this.isBoss = true;
        this.encounterRole = 'boss';
    }
}
