const express = require('express');
const router = express.Router();
const challengeController = require('../controllers/ChallengeController');

function sanitizeName(name) {
    // Replace spaces with underscores for URL compatibility
    return name.replace(/\s+/g, '_');
}

function registerChallengeRoutes(challenges) {
    for (const [comp, challs] of Object.entries(challenges)) {
        for (const [name] of Object.entries(challs)) {
            const urlName = sanitizeName(name);
            
            // Render challenge page
            router.get(`/${comp}-${urlName}`, (req, res) => {
                req.params.comp = comp;
                req.params.name = name; // Use original name with spaces
                challengeController.renderChallengePage(req, res);
            });

            // Submit guess
            router.post(`/${comp}-${urlName}/submit`, (req, res) => {
                req.params.comp = comp;
                req.params.name = name; // Use original name with spaces
                challengeController.submitGuess(req, res);
            });
        }
    }
    
    return router;
}

module.exports = { registerChallengeRoutes };