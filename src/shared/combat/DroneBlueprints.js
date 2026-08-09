// @ts-check

import { indexDroneSpecs, normalizeDroneBlueprintSpec } from '../parts/DronePartFactory.js';
import {
    DRONE_BLUEPRINT_SPECS_NEEDLE_INTERCEPTOR,
    DRONE_PART_SPECS_NEEDLE_INTERCEPTOR
} from '../parts/drone/DronePartBatchNeedleInterceptor.js';
import {
    DRONE_BLUEPRINT_SPECS_TORCH_LANCE,
    DRONE_PART_SPECS_TORCH_LANCE
} from '../parts/drone/DronePartBatchTorchLance.js';
import {
    DRONE_BLUEPRINT_SPECS_BOMBARD_FLAK,
    DRONE_PART_SPECS_BOMBARD_FLAK
} from '../parts/drone/DronePartBatchBombardFlak.js';
import {
    DRONE_BLUEPRINT_SPECS_BASTION_REPAIR,
    DRONE_PART_SPECS_BASTION_REPAIR
} from '../parts/drone/DronePartBatchBastionRepair.js';
import {
    DRONE_BLUEPRINT_SPECS_RAM_STORM,
    DRONE_PART_SPECS_RAM_STORM
} from '../parts/drone/DronePartBatchRamStorm.js';

const striker = Object.freeze({
    id: 'striker',
    label: 'striker drone',
    hp: 20,
    speed: 220,
    turnRate: 4,
    range: 300,
    optimalDistance: 150,
    projectileType: 'small_laser',
    projectileLifetime: 0.8,
    shotCount: 1,
    spread: 0,
    role: 'attack'
});

const specs = [
    ...DRONE_BLUEPRINT_SPECS_NEEDLE_INTERCEPTOR,
    ...Object.values(DRONE_BLUEPRINT_SPECS_TORCH_LANCE),
    ...DRONE_BLUEPRINT_SPECS_BOMBARD_FLAK,
    ...DRONE_BLUEPRINT_SPECS_BASTION_REPAIR,
    ...Object.values(DRONE_BLUEPRINT_SPECS_RAM_STORM)
].map(normalizeDroneBlueprintSpec);

const partSpecs = [
    ...DRONE_PART_SPECS_NEEDLE_INTERCEPTOR,
    ...Object.values(DRONE_PART_SPECS_TORCH_LANCE),
    ...DRONE_PART_SPECS_BOMBARD_FLAK,
    ...DRONE_PART_SPECS_BASTION_REPAIR,
    ...Object.values(DRONE_PART_SPECS_RAM_STORM)
];

// Keep the catalog assembly data-driven: a blueprint is resolved by id, not
// by a switch hidden inside Drone.
const catalog = indexDroneSpecs(specs, partSpecs);
export const DRONE_BLUEPRINTS = Object.freeze({
    striker,
    ...Object.fromEntries(Object.entries(catalog).map(([id, blueprint]) => [
        id,
        Object.freeze(blueprint)
    ]))
});

export function resolveDroneBlueprint(id) {
    return DRONE_BLUEPRINTS[id] || DRONE_BLUEPRINTS.striker;
}
