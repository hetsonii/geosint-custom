const logger = require('../utils/logger');
const challengeService = require('../services/ChallengeService');
const fileWatcherService = require('../services/FileWatcherService');

async function processChallenges() {
    try {
        logger.info('Processing challenges.yml...');
        
        const yamlData = await challengeService.readYaml();
        
        if (!challengeService.validateChallenges(yamlData)) {
            return;
        }

        logger.success('YAML validated successfully');

        const enrichedData = await challengeService.enrichWithPanoIds(yamlData);
        await challengeService.writeChallenges(enrichedData);
        
        logger.success('challs.json written successfully');
    } catch (err) {
        logger.error(`Error processing challenges: ${err.message}`);
    }
}

async function start() {
    if (process.argv[2] === 'continuous') {
        logger.info('Continuous mode enabled');
        await processChallenges();
        fileWatcherService.watchChallengesYaml(processChallenges);
    } else {
        await processChallenges();
    }
}

start();