const challengeService = require('../services/ChallengeService');
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

    submitGuess(req, res) {
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

        if (distanceUtil.isCorrect(dist)) {
            const flag = challengeService.getFlag(comp, name, this.challenges);
            logger.info(`Correct guess for ${comp}/${name} by ${req.ip}`);
            res.send("yes, " + flag);
        } else {
            logger.verbose(`Incorrect guess for ${comp}/${name}: ${dist.toFixed(2)}km off`);
            res.send("not here");
        }
    }
}

module.exports = new ChallengeController();