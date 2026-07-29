import '../../tests/setup.js';
import test, { mock } from 'node:test';
import assert from 'node:assert/strict';

const inserted = [];
const selected = [];
const rows = [
    { id: 1, name: 'TOOLONG', score: 50 },
    { id: 2, name: '<bad>', score: 'nope' },
    { id: 3, name: 'HUGE', score: Number.MAX_VALUE }
];
const query = {
    select(columns) {
        selected.push(columns);
        return this;
    },
    order() {
        return this;
    },
    async limit() {
        return { data: rows, error: null };
    },
    async insert(entries) {
        inserted.push(...entries);
        return { error: null };
    }
};

mock.module('../../engine/AppConfig.js', {
    namedExports: {
        APP_CONFIG: {
            supabaseUrl: 'https://scores.example.test',
            supabaseAnonKey: 'public-key'
        }
    }
});
mock.module('@supabase/supabase-js', {
    namedExports: {
        createClient: () => ({
            from: () => query
        })
    }
});

const { HighScoreManager } = await import('./HighScoreManager.js');

test('leaderboard reads reject malformed public rows', async () => {
    assert.deepEqual(await HighScoreManager.getHighScores(), [{
        name: 'TOOLO',
        score: 50
    }]);
    assert.deepEqual(selected, ['name,score']);
});

test('leaderboard writes accept only bounded names and safe integer scores', async () => {
    assert.deepEqual(await HighScoreManager.addScore('a<script>', 10), [{
        name: 'TOOLO',
        score: 50
    }]);
    assert.deepEqual(inserted, [{ name: 'ASCRI', score: 10 }]);

    assert.deepEqual(await HighScoreManager.addScore('', 10), []);
    assert.deepEqual(await HighScoreManager.addScore('ace', Infinity), []);
    assert.deepEqual(await HighScoreManager.addScore('ace', 1.5), []);
    assert.deepEqual(
        await HighScoreManager.addScore('ace', Number.MAX_VALUE),
        []
    );
    assert.equal(await HighScoreManager.isHighScore(1.5), false);
    assert.equal(inserted.length, 1);
});
