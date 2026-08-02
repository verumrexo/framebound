import { createClient } from '@supabase/supabase-js';
import { APP_CONFIG } from '../../engine/AppConfig.js';

let supabase;

export class HighScoreManager {
    static isConfigured() {
        return Boolean(
            APP_CONFIG.supabaseUrl &&
            APP_CONFIG.supabaseAnonKey
        );
    }

    static getClient() {
        if (!this.isConfigured()) return null;
        supabase ??= createClient(
            APP_CONFIG.supabaseUrl,
            APP_CONFIG.supabaseAnonKey
        );
        return supabase;
    }

    static async getHighScores() {
        try {
            const client = this.getClient();
            if (!client) return [];
            const { data, error } = await client
                .from('high_scores')
                .select('name,score')
                .order('score', { ascending: false })
                .limit(10);

            if (error) throw error;

            const scores = (data || []).flatMap(entry => {
                if (
                    typeof entry?.name !== 'string' ||
                    !Number.isSafeInteger(entry?.score) ||
                    entry.score < 0
                ) {
                    return [];
                }
                return [{
                    name: entry.name.slice(0, 5),
                    score: entry.score
                }];
            });
            console.log('[HighScore] Loaded', scores.length, 'scores from Supabase');
            return scores;
        } catch (e) {
            console.error('[HighScore] Failed to load:', e);
            return [];
        }
    }

    static async addScore(name, score) {
        try {
            const client = this.getClient();
            if (!client) return [];
            if (
                typeof name !== 'string' ||
                !Number.isSafeInteger(score) ||
                score < 0
            ) {
                return [];
            }
            const cleanName = name
                .toUpperCase()
                .replace(/[^A-Z0-9 .-]/g, '')
                .substring(0, 5);
            if (!cleanName) return [];

            const { error } = await client
                .from('high_scores')
                .insert([{ name: cleanName, score }]);

            if (error) throw error;

            console.log('[HighScore] Saved score:', cleanName, score);

            // Return updated leaderboard
            return await this.getHighScores();
        } catch (e) {
            console.error('[HighScore] Failed to save:', e);
            return [];
        }
    }

    static async isHighScore(score) {
        try {
            if (!Number.isSafeInteger(score) || score < 0) return false;
            if (!this.isConfigured()) return false;
            const scores = await this.getHighScores();
            if (scores.length < 10) return true;
            return score > scores[scores.length - 1].score;
        } catch (e) {
            console.error('[HighScore] Failed to check:', e);
            return true; // Default to allowing entry on error
        }
    }

}
