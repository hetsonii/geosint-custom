const fs = require('fs');
const https = require('https');
const app = require('./app');
const logger = require('./utils/logger');
const fileUtils = require('./utils/fileUtils');
const challengeService = require('./services/ChallengeService');
const challengeController = require('./controllers/ChallengeController');
const infoRoutes = require('./routes/info.routes');
const { registerChallengeRoutes } = require('./routes/challenge.routes');
const env = require('./config/environment');
const paths = require('./config/paths');

let lastModifiedTime = 0;

function reloadIfChanged() {
    try {
        if (!fileUtils.fileExists(paths.CHALLENGES_JSON)) return;
        
        const stats = fs.statSync(paths.CHALLENGES_JSON);
        const currentModifiedTime = new Date(stats.mtime).getTime();

        if (currentModifiedTime > lastModifiedTime) {
            logger.info("Reloading challenges...");
            
            const challenges = require(paths.CHALLENGES_JSON);
            challengeController.updateChallenges(challenges);
            
            lastModifiedTime = currentModifiedTime;
            logger.success("Challenges reloaded");
        }
    } catch (err) {
        logger.error(`Error reloading challenges: ${err.message}`);
    }
}

async function waitForChallenges() {
    logger.info("Server starting, waiting for challs.json...");

    while (true) {
        if (fileUtils.fileExists(paths.CHALLENGES_JSON)) {
            try {
                const data = fs.readFileSync(paths.CHALLENGES_JSON, 'utf8');
                if (data.trim().length > 0) {
                    const challenges = JSON.parse(data);
                    challengeController.updateChallenges(challenges);
                    lastModifiedTime = new Date(fs.statSync(paths.CHALLENGES_JSON).mtime).getTime();
                    return challenges;
                }
            } catch (err) {
                logger.warn("Waiting for valid JSON in challs.json...");
            }
        }
        await new Promise(resolve => setTimeout(resolve, 1000));
    }
}

function setupRoutes(challenges) {
    // Info routes
    app.use('/', infoRoutes);
    
    // Challenge routes
    const challengeRouter = registerChallengeRoutes(challenges);
    app.use('/', challengeRouter);
    
    // Reload middleware for info.json
    app.use('/info.json', (req, res, next) => {
        reloadIfChanged();
        next();
    });
}

async function startServer() {
    const challenges = await waitForChallenges();
    
    logger.success("challs.json loaded");
    setupRoutes(challenges);

    if (env.SECURE) {
        const options = {
            key: fs.readFileSync(env.HTTPS_KEY),
            cert: fs.readFileSync(env.HTTPS_CERT),
        };
        
        https.createServer(options, app).listen(env.PORT, () => {
            logger.success(`Secure server started on port ${env.PORT}`);
        });
    } else {
        app.listen(env.PORT, () => {
            logger.success(`Server started on port ${env.PORT}`);
        });
    }
}

startServer();