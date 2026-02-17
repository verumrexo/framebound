import { test } from 'node:test';
import assert from 'node:assert';
import { Biomes, getRandomBiome } from '../src/game/environment/Biomes.js';

test('getRandomBiome returns a valid biome object', () => {
    const biome = getRandomBiome();
    assert.ok(biome);
    assert.strictEqual(typeof biome, 'object');
});

test('getRandomBiome does not return DEFAULT biome', () => {
    // Run multiple times to ensure randomness doesn't hit DEFAULT accidentally
    for (let i = 0; i < 100; i++) {
        const biome = getRandomBiome();
        assert.notStrictEqual(biome, Biomes.DEFAULT);
        assert.notStrictEqual(biome.name, 'Deep Space');
    }
});

test('getRandomBiome returns a known biome from the list', () => {
    const biome = getRandomBiome();
    const values = Object.values(Biomes);
    assert.ok(values.includes(biome));
});

test('Biomes object structure is valid', () => {
    for (const key in Biomes) {
        const biome = Biomes[key];
        assert.ok(biome.name);
        assert.ok(biome.colors);
        assert.ok(biome.colors.background);
        assert.ok(biome.colors.grid);
        assert.ok(biome.colors.gridMajor);
        assert.ok(biome.colors.stars);
    }
});
