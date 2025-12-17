const express = require('express');
const router = express.Router();
const challengeController = require('../controllers/ChallengeController');

function registerChallengeRoutes(challenges) {
    for (const [comp, challs] of Object.entries(challenges)) {
        for (const [name] of Object.entries(challs)) {
            // Render challenge page
            router.get(`/${comp}-${name}`, 
                challengeController.renderChallengePage.bind(challengeController)
            );

            // Submit guess
            router.post(`/${comp}-${name}/submit`, (req, res) => {
                req.params.comp = comp;
                req.params.name = name;
                challengeController.submitGuess(req, res);
            });
        }
    }
    
    return router;
}

module.exports = { registerChallengeRoutes };