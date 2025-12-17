const challengeService = require('../services/ChallengeService');
const analyticsService = require('../services/AnalyticsService');
const distanceUtil = require('../utils/distance');
const logger = require('../utils/logger');
const env = require('../config/environment');

class ChallengeController {
    constructor() {
        this.challenges = {};
        this.publicInfo = {};
    }

    updateChallenges(challenges) {
        this.challenges = challenges;
        this.publicInfo = challengeService.parsePublicInfo(challenges);
    }

    renderChallengePage(req, res) {
        res.render('chall', { API_KEY: env.MAPS_API_KEY });
    }

    getPublicInfo(req, res) {
        res.json(this.publicInfo);
    }

    async submitGuess(req, res) {
        const { comp, name } = req.params;
        const challenge = this.challenges[comp] && this.challenges[comp][name];
        
        if (!challenge) {
            return res.status(404).send("Challenge not found");
        }

        const { lat: trueLat, lng: trueLng } = challenge;
        const [guessLat, guessLng] = req.body;
        
        const dist = distanceUtil.calculate(
            Number(guessLat), 
            Number(guessLng), 
            trueLat, 
            trueLng
        );

        const isCorrect = distanceUtil.isCorrect(dist);

        // Record analytics
        await analyticsService.recordGuess(
            comp, 
            name, 
            Number(guessLat), 
            Number(guessLng), 
            isCorrect,
            dist
        );

        if (isCorrect) {
            const flag = challengeService.getFlag(comp, name, this.challenges);
            logger.info(`Correct guess for ${comp}/${name} by ${req.ip}`);
            res.json({ 
                success: true, 
                flag: flag,
                distance: dist 
            });
        } else {
            logger.verbose(`Incorrect guess for ${comp}/${name}: ${dist.toFixed(2)}km off`);
            res.json({ 
                success: false, 
                distance: dist 
            });
        }
    }
}

module.exports = new ChallengeController();