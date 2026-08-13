import '../src/tests/setup.js';
import { PartsLibrary } from '../src/shared/parts/Part.js';
import {
    getBaseWeaponRange,
    getBaseProjectileSpeed,
    getWeaponPayloadMultiplier,
    isDirectWeapon,
    isExplosiveWeapon,
    isMeleeWeapon
} from '../src/shared/combat/ShipBuildProfile.js';

const rows = Object.values(PartsLibrary).map(definition => {
    const stats = definition.stats || {};
    const cells = definition.width * definition.height;
    const shots = Math.max(1, stats.burstCount || 1) * Math.max(1, stats.pelletCount || 1);
    const burstDamage = (stats.damage || 0) * shots;
    const cycle = (stats.cooldown || 0) + (stats.chargeTime || 0);
    const payloadMultiplier = getWeaponPayloadMultiplier(definition);
    const sustainedDamage = cycle > 0 ? burstDamage / cycle : 0;
    const effectiveDamage = sustainedDamage * payloadMultiplier *
        (stats.rampUp ? 1 + (stats.maxRamp || 0) : 1);
    const range = definition.type === 'weapon'
        ? Math.round(getBaseWeaponRange(definition))
        : 0;
    const control = Boolean(stats.hackDuration || stats.activeAbility ||
        stats.projectileType === 'beam_freeze');
    const tracking = stats.projectileType === 'guided_rocket' ||
        stats.projectileType === 'ggbm';
    const area = Boolean(stats.aoeRadius || isExplosiveWeapon(definition));
    const roleBand = control ? 'control' : isMeleeWeapon(definition) || (range > 0 && range < 200)
        ? 'close' : tracking ? 'homing' : area ? 'area' : range >= 500 ? 'long' : 'general';
    const compatibility = [];
    if (isDirectWeapon(definition)) compatibility.push('interceptor', 'gunship');
    if (stats.weaponGroup === 'laser') compatibility.push('bastion');
    if (stats.weaponGroup === 'velocity' || stats.weaponGroup === 'rocket') compatibility.push('siege');
    if (stats.weaponGroup === 'drone') compatibility.push('hive', 'warden');
    if (isMeleeWeapon(definition)) compatibility.push('reaver');
    if (isExplosiveWeapon(definition)) compatibility.push('demolition');
    if (stats.activeAbility || stats.projectileType === 'hack_dart') compatibility.push('phantom', 'disruptor');
    return {
        id: definition.id,
        role: definition.doctrineId ? 'doctrine' : definition.type,
        cells,
        mass: stats.mass || 0,
        hp: stats.hp || 0,
        burst: Number(burstDamage.toFixed(2)),
        dps: Number(sustainedDamage.toFixed(2)),
        effectiveDps: Number(effectiveDamage.toFixed(2)),
        dpsPerCell: Number((effectiveDamage / cells).toFixed(2)),
        range,
        projectileSpeed: definition.type === 'weapon'
            ? Math.round(getBaseProjectileSpeed(definition))
            : 0,
        roleBand,
        traits: [
            area ? 'area' : null,
            tracking ? 'tracking' : null,
            stats.velocityPierceAdd ? 'pierce' : null,
            stats.rampUp ? 'ramp' : null,
            stats.hackDuration || stats.activeAbility ? 'control' : null
        ].filter(Boolean).join(','),
        doctrines: [...new Set(compatibility)].join(','),
        described: Boolean(definition.description?.trim())
    };
});

console.table(rows);
const direct = rows.filter(row => row.dps > 0);
const dart = rows.find(row => row.id === 'gun_basic');
const baseline = dart?.dpsPerCell || 1;
const bands = {
    close: [1.25, 1.4],
    general: [0.9, 1.1],
    long: [0.7, 0.9],
    homing: [0.75, 0.9],
    area: [0.65, 0.85]
};
const outliers = direct.filter(row => {
    const band = bands[row.roleBand];
    if (!band) return false;
    const ratio = row.dpsPerCell / baseline;
    return ratio < band[0] || ratio > band[1];
});
console.log(`\nparts: ${rows.length} // damaging: ${direct.length} // dart baseline: ${baseline} dps/cell`);
console.log(`review outliers: ${outliers.map(row => `${row.id}(${row.roleBand}:${(row.dpsPerCell / baseline).toFixed(2)}x)`).join(', ') || 'none'}`);
