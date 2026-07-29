import { describe, it } from 'node:test';
import assert from 'node:assert';
import { Biomes, getRandomBiome } from './Biomes.js';

describe('Biomes Module', () => {
    it('should export a Biomes object with valid structure', () => {
        assert.ok(Biomes, 'Biomes object should be exported');
        assert.ok(Biomes.DEFAULT, 'Biomes should have a DEFAULT entry');

        // Ensure there are other biomes besides DEFAULT
        const keys = Object.keys(Biomes);
        assert.ok(keys.length > 1, 'Biomes should contain more than just DEFAULT');

        // Check structure of each biome
        for (const key of keys) {
            const biome = Biomes[key];
            assert.ok(biome.name, `Biome ${key} should have a name`);
            assert.ok(biome.colors, `Biome ${key} should have colors`);
            assert.ok(biome.colors.background, `Biome ${key} should have background color`);
            assert.ok(biome.colors.grid, `Biome ${key} should have grid color`);
            assert.ok(biome.colors.gridMajor, `Biome ${key} should have a major-grid color`);
            assert.ok(biome.colors.stars, `Biome ${key} should have a star color`);
        }
    });

    it('should return a random biome that is not DEFAULT', () => {
        // Run multiple times to ensure randomness doesn't break and never returns DEFAULT
        for (let i = 0; i < 50; i++) {
            const biome = getRandomBiome();
            assert.ok(biome, 'getRandomBiome should return a defined object');
            assert.notDeepStrictEqual(biome, Biomes.DEFAULT, 'getRandomBiome should not return DEFAULT biome');
            assert.ok(biome.name, 'Returned biome should have a name');
            assert.ok(biome.colors, 'Returned biome should have colors');
        }
    });

    it('should return a valid biome even if called many times', () => {
        const biome = getRandomBiome();
        const validBiomes = Object.values(Biomes).filter(b => b !== Biomes.DEFAULT);
        assert.ok(validBiomes.includes(biome), 'Returned biome should be one of the defined non-DEFAULT biomes');
    });
});
