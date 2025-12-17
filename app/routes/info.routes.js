const express = require('express');
const router = express.Router();
const challengeController = require('../controllers/ChallengeController');
const paths = require('../config/paths');

router.get('/', (req, res) => {
    res.sendFile(paths.ROOT_DIR + '/index.html');
});

router.get('/info.json', (req, res) => {
    challengeController.getPublicInfo(req, res);
});

module.exports = router;