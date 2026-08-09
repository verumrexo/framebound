import '../../tests/setup.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { PartsLibrary } from '../../shared/parts/Part.js';
import {
    getShopAccent,
    getShopActionText,
    getShopCategory,
    getShopHeader,
    getShopItemState,
    getShopStatRows,
    getShopBobY
} from './ShopPresentation.js';

function healItem(overrides = {}) {
    return {
        purchased: false,
        data: {
            type: 'heal',
            name: 'repair kit',
            description: 'restore 50 hp',
            price: 30,
            ...overrides
        }
    };
}

function partItem(partId = 'railgun', overrides = {}) {
    return {
        purchased: false,
        partDef: PartsLibrary[partId],
        data: {
            type: 'part',
            name: PartsLibrary[partId].name,
            description: 'weapon',
            price: 40,
            ...overrides
        }
    };
}

test('shop presentation classifies repair and weapon-family offers', () => {
    const heal = healItem();
    const railgun = partItem();

    assert.equal(getShopCategory(heal), 'frame service');
    assert.equal(getShopCategory(railgun), 'laser weapon');
    assert.equal(getShopAccent(heal), '#55ffc2');
    assert.equal(getShopAccent(railgun), '#35f2ff');
});

test('shop stat rows expose useful compact repair and part telemetry', () => {
    assert.deepEqual(getShopStatRows(healItem()), [
        { label: 'repair', value: '+50 hp' }
    ]);
    assert.deepEqual(getShopStatRows(partItem()), [
        { label: 'hull', value: '80 hp' },
        { label: 'mass', value: '8 t' },
        { label: 'output', value: '15 dmg' },
        { label: 'cycle', value: '6.5s' }
    ]);
});

test('shop states preserve affordability and expose purchased offers as sold', () => {
    const item = healItem();
    assert.equal(getShopItemState(item, 30), 'affordable');
    assert.equal(getShopItemState(item, 29), 'unaffordable');
    assert.match(getShopActionText(item, 29), /need 1g/);
    item.purchased = true;
    assert.equal(getShopItemState(item, 999), 'sold');
    assert.equal(getShopActionText(item, 999), 'sold // already claimed');
    assert.equal(getShopBobY({ y: 100, life: 1, bobOffset: 1, purchased: true }), 100);
});

test('shop header reports shared credits and remaining stock', () => {
    const items = [healItem(), partItem('gun_basic'), { purchased: true }];
    assert.deepEqual(getShopHeader(items, 65), {
        credits: 65,
        stockRemaining: 2,
        stockTotal: 3,
        label: 'shared credits // 65g',
        stockLabel: 'stock // 2/3'
    });
});
