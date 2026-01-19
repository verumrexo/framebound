import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://icbhgzetssqssefoirug.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImljYmhnemV0c3Nxc3NlZm9pcnVnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg4MjM4NzAsImV4cCI6MjA4NDM5OTg3MH0.OHtHxXat3gspzOVBPpwfXX2czNcMeSCcnmHrK_xOY40';
const supabase = createClient(supabaseUrl, supabaseKey);

export class HighScoreManager {
    static async getHighScores() {
        try {
            const { data, error } = await supabase
                .from('high_scores')
                .select('*')
                .order('score', { ascending: false })
                .limit(10);

            if (error) throw error;

            console.log('[HighScore] Loaded', data?.length || 0, 'scores from Supabase');
            return data || [];
        } catch (e) {
            console.error('[HighScore] Failed to load:', e);
            return [];
        }
    }

    static async addScore(name, score) {
        try {
            const cleanName = name.toUpperCase().substring(0, 5);

            const { error } = await supabase
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
            const scores = await this.getHighScores();
            if (scores.length < 10) return true;
            return score > scores[scores.length - 1].score;
        } catch (e) {
            console.error('[HighScore] Failed to check:', e);
            return true; // Default to allowing entry on error
        }
    }

    static async clearScores() {
        try {
            const { error } = await supabase
                .from('high_scores')
                .delete()
                .neq('id', 0); // Delete all rows

            if (error) throw error;
            console.log('[HighScore] Cleared all scores');
        } catch (e) {
            console.error('[HighScore] Failed to clear:', e);
        }
    }
}
