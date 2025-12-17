const fs = require('fs').promises;
const fsSync = require('fs');
const path = require('path');
const logger = require('../utils/logger');
const paths = require('../config/paths');

class AnalyticsService {
    constructor() {
        this.analyticsDir = path.join(paths.PUBLIC_DIR, 'analytics');
        this.ensureAnalyticsDir();
    }

    ensureAnalyticsDir() {
        if (!fsSync.existsSync(this.analyticsDir)) {
            fsSync.mkdirSync(this.analyticsDir, { recursive: true });
            logger.info('Created analytics directory');
        }
    }

    getAnalyticsFile(comp, name) {
        const sanitizedName = name.replace(/\s+/g, '_');
        return path.join(this.analyticsDir, `${comp}_${sanitizedName}.json`);
    }

    async loadAnalytics(comp, name) {
        try {
            const filePath = this.getAnalyticsFile(comp, name);
            if (!fsSync.existsSync(filePath)) {
                return { guesses: [], totalAttempts: 0, correctGuesses: 0, incorrectGuesses: 0 };
            }
            const content = await fs.readFile(filePath, 'utf8');
            return JSON.parse(content);
        } catch (err) {
            logger.error(`Error loading analytics for ${comp}/${name}: ${err.message}`);
            return { guesses: [], totalAttempts: 0, correctGuesses: 0, incorrectGuesses: 0 };
        }
    }

    async saveAnalytics(comp, name, data) {
        try {
            const filePath = this.getAnalyticsFile(comp, name);
            await fs.writeFile(filePath, JSON.stringify(data, null, 2));
        } catch (err) {
            logger.error(`Error saving analytics for ${comp}/${name}: ${err.message}`);
        }
    }

    async recordGuess(comp, name, lat, lng, isCorrect, distance) {
        try {
            const analytics = await this.loadAnalytics(comp, name);
            
            analytics.guesses.push({
                lat,
                lng,
                isCorrect,
                distance,
                timestamp: Date.now()
            });

            analytics.totalAttempts++;
            if (isCorrect) {
                analytics.correctGuesses++;
            } else {
                analytics.incorrectGuesses++;
            }

            // Keep only last 1000 guesses to prevent file bloat
            if (analytics.guesses.length > 1000) {
                analytics.guesses = analytics.guesses.slice(-1000);
            }

            await this.saveAnalytics(comp, name, analytics);
            logger.verbose(`Recorded guess for ${comp}/${name}: ${isCorrect ? 'correct' : 'incorrect'}`);
        } catch (err) {
            logger.error(`Error recording guess: ${err.message}`);
        }
    }

    async getHeatmapData(comp, name) {
        const analytics = await this.loadAnalytics(comp, name);
        
        // Return only coordinates for heatmap visualization
        return {
            guesses: analytics.guesses.map(g => ({
                lat: g.lat,
                lng: g.lng,
                weight: g.isCorrect ? 10 : 1 // Correct guesses have higher weight
            })),
            stats: {
                total: analytics.totalAttempts,
                correct: analytics.correctGuesses,
                incorrect: analytics.incorrectGuesses,
                successRate: analytics.totalAttempts > 0 
                    ? ((analytics.correctGuesses / analytics.totalAttempts) * 100).toFixed(1)
                    : 0
            }
        };
    }
}

module.exports = new AnalyticsService();