async function manager() {
    return (await import('./HighScoreManager.js')).HighScoreManager;
}

export const HighScoreGateway = Object.freeze({
    async getHighScores() {
        return (await manager()).getHighScores();
    },

    async addScore(name, score) {
        return (await manager()).addScore(name, score);
    },

    async isHighScore(score) {
        return (await manager()).isHighScore(score);
    },
});
