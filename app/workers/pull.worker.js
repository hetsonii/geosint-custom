const logger = require('../utils/logger');
const fileUtils = require('../utils/fileUtils');
const challengeService = require('../services/ChallengeService');
const tileService = require('../services/TileService');
const metadataService = require('../services/MetadataService');
const fileWatcherService = require('../services/FileWatcherService');
const paths = require('../config/paths');

async function processChallenge(comp, name, challenge) {
    const { panoType, pano, lat, lng, maxZ } = challenge;

    if (pano === null) {
        logger.warn(`Skipping ${comp}/${name} (no pano ID)`);
        return;
    }

    const compDir = paths.getCompDir(comp);
    const challengeDir = paths.getChallengeDir(comp, name);

    fileUtils.ensureDirSync(compDir);
    fileUtils.ensureDirSync(challengeDir);

    const shouldRefetch = await metadataService.shouldRefetch(comp, name, pano, maxZ);
    
    if (!shouldRefetch) {
        logger.info(`${comp}/${name} is up to date (pano: ${pano})`);
        return;
    }

    logger.info(`Fetching tiles for ${comp}/${name}...`);
    const startTime = Date.now();

    const { total, success } = await tileService.fetchAllTiles(
        comp, name, panoType, pano, maxZ
    );

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
    
    if (success === total) {
        logger.success(`${comp}/${name}: ${success}/${total} tiles in ${elapsed}s`);
    } else {
        logger.warn(`${comp}/${name}: ${success}/${total} tiles in ${elapsed}s`);
    }

    await metadataService.writeMetadata(comp, name, {
        pano,
        lat,
        lng,
        timestamp: Date.now()
    });
}

async function processAllChallenges() {
    try {
        const challenges = await challengeService.loadChallenges();
        
        if (!challenges) {
            logger.warn('challs.json not found, skipping...');
            return;
        }

        logger.info('Starting tile fetch process...');

        for (const [comp, challs] of Object.entries(challenges)) {
            for (const [name, challenge] of Object.entries(challs)) {
                await processChallenge(comp, name, challenge);
            }
        }

        logger.success('All challenges processed');
    } catch (err) {
        logger.error(`Error processing challenges: ${err.message}`);
    }
}

async function start() {
    if (process.argv[2] === 'continuous') {
        logger.info('Continuous mode enabled');
        
        if (fileUtils.fileExists(paths.CHALLENGES_JSON)) {
            await processAllChallenges();
        } else {
            logger.info('Waiting for challs.json to be created...');
        }
        
        fileWatcherService.watchChallengesJson(processAllChallenges);
        fileWatcherService.watchTileDirectory(processAllChallenges);
    } else {
        await processAllChallenges();
    }
}

start();