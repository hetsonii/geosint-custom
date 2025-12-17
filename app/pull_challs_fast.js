const fs = require('fs');
const fetch = require('node-fetch');
const chokidar = require('chokidar');
const path = require('path');
const logger = require('./logger');
const fileUtils = require('./fileUtils');

const challsJsonPath = path.join(__dirname, 'challs.json');
const BATCH_SIZE = 15;

async function saveStreetViewTile(x, y, z, comp, name, imgDir, resp) {
    const contentType = resp.headers.get("content-type");
    if (contentType && contentType.indexOf("application/json") !== -1 && contentType.indexOf("application/json") !== 0) {
        logger.error(`Invalid content from ${comp}/${name} Tile (${x}, ${y}, ${z})`);
    } else {
        resp.blob().then(blob => blob.arrayBuffer())
            .then(ab => {
                const fileName = path.join(imgDir, `tile_${x}_${y}_${z}.jpeg`);
                const fileStream = fs.createWriteStream(fileName);
                fileStream.write(new Uint8Array(ab));
                fileStream.end();
                logger.verbose(`Saved ${comp}/${name} tile (${x},${y},${z})`);
            }).catch(error => {
                logger.error(`Error saving ${comp}/${name} tile (${x},${y},${z}): ${error.message}`);
            });
    }
}

async function fetchTilesForChallenge(comp, name, panoType, pano, maxZ, imgDir) {
    let totalTiles = 0;
    let fetchedCount = 0;
    const pendingFetches = [];

    for (let z = 0; z <= maxZ; z++) {
        for (let x = 0; x < 2 ** z; x++) {
            for (let y = 0; y < 2 ** (z - 1); y++) {
                totalTiles++;
                
                const url = panoType === 0
                    ? `https://lh3.ggpht.com/p/${pano}=x${x}-y${y}-z${z}`
                    : `https://streetviewpixels-pa.googleapis.com/v1/tile?cb_client=maps_sv.tactile&panoid=${pano}&output=tile&x=${x}&y=${y}&zoom=${z}&nbt=1&fover=2`;

                const fetchPromise = fetch(url)
                    .then(resp => {
                        saveStreetViewTile(x, y, z, comp, name, imgDir, resp);
                        fetchedCount++;
                    })
                    .catch(err => {
                        logger.error(`Failed to fetch ${comp}/${name} tile (${x},${y},${z}): ${err.message}`);
                    });

                pendingFetches.push(fetchPromise);

                // Process in batches to avoid overwhelming the API
                if (pendingFetches.length >= BATCH_SIZE) {
                    await Promise.all(pendingFetches);
                    pendingFetches.length = 0;
                }
            }
        }
    }

    // Wait for remaining fetches
    if (pendingFetches.length > 0) {
        await Promise.all(pendingFetches);
    }

    // Give file streams time to finish writing
    await new Promise(resolve => setTimeout(resolve, 1000));

    return { total: totalTiles, fetched: fetchedCount };
}

async function shouldRefetch(imgDir, metaFile, currentPano, maxZ) {
    if (!fileUtils.fileExists(metaFile)) {
        logger.info(`No metadata found, fetching tiles...`);
        return true;
    }

    try {
        const meta = await fileUtils.readJSON(metaFile);
        
        if (meta.pano !== currentPano) {
            logger.info(`Pano ID mismatch (old: ${meta.pano}, new: ${currentPano}), re-fetching...`);
            return true;
        }

        const expectedTiles = fileUtils.countTilesExpected(maxZ);
        const existingTiles = await fileUtils.countTilesExisting(imgDir);

        if (existingTiles < expectedTiles) {
            logger.warn(`Missing tiles (${existingTiles}/${expectedTiles}), re-fetching...`);
            return true;
        }

        return false;
    } catch (err) {
        logger.warn(`Error reading metadata: ${err.message}, re-fetching...`);
        return true;
    }
}

async function processChallenge(comp, name, challenge) {
    const { panoType, pano, lat, lng, maxZ } = challenge;

    if (pano === null) {
        logger.warn(`Skipping ${comp}/${name} (no pano ID)`);
        return;
    }

    const compDir = path.join(__dirname, 'public', 'img', comp);
    const imgDir = path.join(compDir, name);
    const metaFile = path.join(imgDir, '.meta');

    // Create directories synchronously to ensure they exist before fetching
    if (!fs.existsSync(compDir)) {
        fs.mkdirSync(compDir, { recursive: true });
    }
    if (!fs.existsSync(imgDir)) {
        fs.mkdirSync(imgDir, { recursive: true });
    }

    if (!(await shouldRefetch(imgDir, metaFile, pano, maxZ))) {
        logger.info(`${comp}/${name} is up to date (pano: ${pano})`);
        return;
    }

    logger.info(`Fetching tiles for ${comp}/${name}...`);
    const startTime = Date.now();

    const { total, fetched } = await fetchTilesForChallenge(
        comp, name, panoType, pano, maxZ, imgDir
    );

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
    
    if (fetched === total) {
        logger.success(`${comp}/${name}: ${fetched}/${total} tiles in ${elapsed}s`);
    } else {
        logger.warn(`${comp}/${name}: ${fetched}/${total} tiles in ${elapsed}s`);
    }

    const metaData = { pano, lat, lng, timestamp: Date.now() };
    await fileUtils.writeJSON(metaFile, metaData);
}

async function processAllChallenges(challenges) {
    logger.info('Starting tile fetch process...');

    for (const [comp, challs] of Object.entries(challenges)) {
        for (const [name, challenge] of Object.entries(challs)) {
            await processChallenge(comp, name, challenge);
        }
    }

    logger.success('All challenges processed');
}

function watchForChanges() {
    logger.info(`Watching: ${challsJsonPath}`);
    
    const challsWatcher = chokidar.watch(challsJsonPath, {
        ignoreInitial: false,
    });
    
    challsWatcher.on('add', () => {
        logger.info('challs.json created, processing...');
        setTimeout(() => loadAndProcess(), 500);
    });
    
    challsWatcher.on('change', () => {
        logger.info('challs.json changed, reprocessing...');
        setTimeout(() => loadAndProcess(), 500);
    });

    const imgDir = path.join(__dirname, 'public', 'img');
    const imgWatcher = chokidar.watch(imgDir, {
        ignored: /(^|[\/\\])\../,
        persistent: true,
        ignoreInitial: true,
    });

    imgWatcher.on('unlink', (filePath) => {
        if (filePath.includes('tile_') && filePath.endsWith('.jpeg')) {
            logger.warn(`Tile deleted: ${filePath}, triggering re-fetch...`);
            setTimeout(() => loadAndProcess(), 1000);
        }
    });

    imgWatcher.on('unlinkDir', (dirPath) => {
        logger.warn(`Directory deleted: ${dirPath}, triggering re-fetch...`);
        setTimeout(() => loadAndProcess(), 1000);
    });
}

async function loadAndProcess() {
    try {
        if (!fileUtils.fileExists(challsJsonPath)) {
            logger.warn('challs.json not found, skipping...');
            return;
        }

        delete require.cache[require.resolve(challsJsonPath)];
        const challenges = require(challsJsonPath);
        await processAllChallenges(challenges);
    } catch (err) {
        logger.error(`Error processing challenges: ${err.message}`);
    }
}

async function start() {
    if (process.argv[2] === 'continuous') {
        logger.info('Continuous mode enabled');
        
        if (fileUtils.fileExists(challsJsonPath)) {
            await loadAndProcess();
        } else {
            logger.info('Waiting for challs.json to be created...');
        }
        
        watchForChanges();
    } else {
        await loadAndProcess();
    }
}

start();