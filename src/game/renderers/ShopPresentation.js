import { WEAPON_FAMILIES } from '../../shared/combat/WeaponFamilies.js';
import { PartType } from '../../shared/parts/PartDefinitions.js';
import { UI_COLORS } from '../ui/UiTheme.js';

const TYPE_ACCENTS = Object.freeze({
    [PartType.HULL]: UI_COLORS.cyan,
    [PartType.WEAPON]: UI_COLORS.cyanBright,
    [PartType.THRUSTER]: UI_COLORS.mint,
    [PartType.ACCELERANT]: UI_COLORS.green,
    [PartType.ROCKET_BAY]: UI_COLORS.orange,
    [PartType.BOOSTER]: UI_COLORS.greenBright,
    [PartType.DRONE]: '#57d8ff',
    [PartType.SHIELD]: '#a58cff',
    [PartType.CORE]: '#7cf7ff'
});

const TYPE_LABELS = Object.freeze({
    [PartType.HULL]: 'hull plating',
    [PartType.WEAPON]: 'weapon system',
    [PartType.THRUSTER]: 'thruster',
    [PartType.ACCELERANT]: 'accelerant',
    [PartType.ROCKET_BAY]: 'missile bay',
    [PartType.BOOSTER]: 'booster',
    [PartType.DRONE]: 'drone system',
    [PartType.SHIELD]: 'shield system',
    [PartType.CORE]: 'core module'
});

const WEAPON_LABELS = Object.freeze({
    velocity: 'ballistic weapon',
    laser: 'laser weapon',
    rocket: 'missile weapon',
    drone: 'drone weapon',
    utility: 'utility weapon'
});

function lower(value, fallback = '') {
    return String(value ?? fallback).toLowerCase();
}

function formatNumber(value) {
    if (!Number.isFinite(value)) return '—';
    return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

function addRow(rows, label, value) {
    if (value === undefined || value === null || value === '') return;
    rows.push({ label, value: String(value) });
}

export function getShopAccent(item) {
    if (item?.data?.type === 'heal') return UI_COLORS.mint;
    const family = item?.partDef?.stats?.weaponGroup;
    if (family && WEAPON_FAMILIES[family]) return WEAPON_FAMILIES[family].color;
    return TYPE_ACCENTS[item?.partDef?.type] || UI_COLORS.amber;
}

export function getShopCategory(item) {
    if (item?.data?.type === 'heal') return 'frame service';
    const family = item?.partDef?.stats?.weaponGroup;
    if (family && WEAPON_LABELS[family]) return WEAPON_LABELS[family];
    return TYPE_LABELS[item?.partDef?.type] || lower(item?.data?.description, 'part');
}

export function getShopStatRows(item, maxRows = 4) {
    if (item?.data?.type === 'heal') return [{ label: 'repair', value: '+50 hp' }];

    const stats = item?.partDef?.stats || {};
    const rows = [];
    addRow(rows, 'hull', stats.hp ? `${formatNumber(stats.hp)} hp` : null);
    addRow(rows, 'mass', stats.mass ? `${formatNumber(stats.mass)} t` : null);

    if (stats.weaponGroup) {
        addRow(rows, 'output', stats.damage ? `${formatNumber(stats.damage)} dmg` : null);
        addRow(rows, 'cycle', stats.cooldown ? `${formatNumber(stats.cooldown)}s` : null);
    } else if (stats.thrust) {
        addRow(rows, 'thrust', formatNumber(stats.thrust));
    } else if (stats.regen) {
        addRow(rows, 'regen', `${formatNumber(stats.regen)} hp/s`);
    } else if (stats.shieldRadiusScale) {
        addRow(rows, 'field', `${formatNumber(stats.shieldRadiusScale)}x radius`);
    } else if (stats.droneCapacity) {
        addRow(rows, 'capacity', formatNumber(stats.droneCapacity));
    }

    return rows.slice(0, maxRows);
}

export function getShopItemState(item, credits = Number.POSITIVE_INFINITY) {
    if (item?.purchased) return 'sold';
    return Number(credits) >= Number(item?.data?.price || 0)
        ? 'affordable'
        : 'unaffordable';
}

export function getShopStateLabel(state) {
    if (state === 'sold') return 'sold';
    if (state === 'unaffordable') return 'credit shortfall';
    return 'available';
}

export function getShopActionText(item, credits = Number.POSITIVE_INFINITY) {
    const state = getShopItemState(item, credits);
    if (state === 'sold') return 'sold // already claimed';
    if (state === 'unaffordable') {
        const shortfall = Math.max(0, Number(item?.data?.price || 0) - Number(credits || 0));
        return `credit shortfall // need ${shortfall}g`;
    }
    return '[e] / click // authorize purchase';
}

export function getShopHeader(items = [], credits = 0) {
    const offers = Array.isArray(items) ? items : [];
    const stockTotal = offers.length;
    const stockRemaining = offers.filter(item => !item?.purchased).length;
    return {
        credits: Number.isFinite(Number(credits)) ? Number(credits) : 0,
        stockRemaining,
        stockTotal,
        label: `shared credits // ${Number.isFinite(Number(credits)) ? Number(credits) : 0}g`,
        stockLabel: `stock // ${stockRemaining}/${stockTotal}`
    };
}

export function getShopBobY(item, amplitude = 6) {
    if (item?.purchased) return Number(item?.y || 0);
    return Number(item?.y || 0) + Math.sin(
        (Number(item?.life) || 0) * 2 + (Number(item?.bobOffset) || 0)
    ) * amplitude;
}
