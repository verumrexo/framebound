import '../../tests/setup.js';
import test, { mock } from 'node:test';
import assert from 'node:assert/strict';

let clientsCreated = 0;
mock.module('@supabase/supabase-js', {
    namedExports: {
        createClient: () => {
            clientsCreated += 1;
            return {};
        }
    }
});

const { HighScoreManager } = await import('./HighScoreManager.js');

test('missing leaderboard config fails closed without creating a client', async () => {
    assert.equal(HighScoreManager.isConfigured(), false);
    assert.deepEqual(await HighScoreManager.getHighScores(), []);
    assert.deepEqual(await HighScoreManager.addScore('ace', 10), []);
    assert.equal(await HighScoreManager.isHighScore(10), false);
    assert.equal(clientsCreated, 0);
});
