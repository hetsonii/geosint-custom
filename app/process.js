const yaml = require('js-yaml');
const Ajv = require('ajv');
const fetch = require('node-fetch');
const chokidar = require('chokidar');
const path = require('path');
const logger = require('./logger');
const fileUtils = require('./fileUtils');

const api_key = process.env.MAPS_API_KEY;
const schema = require('./schema.json');

const challengesFile = path.join(__dirname, 'challenges.yml');
const challsJsonFile = path.join(__dirname, 'challs.json');

async function fetchPanoId(lat, lng, name) {
    try {
        const url = `https://maps.googleapis.com/maps/api/streetview/metadata?location=${lat},${lng}&key=${api_key}`;
        const resp = await fetch(url);
        
        if (!resp.ok) {
            logger.error(`Failed to fetch pano ID for ${name}: HTTP ${resp.status}`);
            return null;
        }

        const data = await resp.json();
        if (data.status !== 'OK') {
            logger.error(`No Street View data for ${name} at (${lat}, ${lng})`);
            return null;
        }

        return data.pano_id;
    } catch (err) {
        logger.error(`Error fetching pano ID for ${name}: ${err.message}`);
        return null;
    }
}

async function enrichChallenges(jsonData) {
    const enriched = {};
    
    for (const [comp, challs] of Object.entries(jsonData)) {
        enriched[comp] = {};
        
        for (const [name, properties] of Object.entries(challs)) {
            enriched[comp][name] = { ...properties };
            
            if (properties.pano === null) {
                logger.info(`Fetching pano ID for ${comp}/${name}...`);
                const panoId = await fetchPanoId(properties.lat, properties.lng, name);
                
                if (panoId) {
                    enriched[comp][name].pano = panoId;
                    logger.success(`Retrieved pano ID for ${comp}/${name}: ${panoId}`);
                } else {
                    logger.warn(`Could not retrieve pano ID for ${comp}/${name}`);
                }
            }
        }
    }
    
    return enriched;
}

async function processYamlFile() {
    try {
        logger.info('Processing challenges.yml...');
        
        const yamlData = await fileUtils.readFile(challengesFile);
        const jsonData = yaml.load(yamlData);

        const ajv = new Ajv();
        const validate = ajv.compile(schema);
        const isValid = validate(jsonData);

        if (!isValid) {
            logger.error('YAML validation failed:');
            validate.errors.forEach(err => logger.error(`  ${err.message}`));
            return;
        }

        logger.success('YAML validated successfully');

        const enrichedData = await enrichChallenges(jsonData);
        await fileUtils.writeJSON(challsJsonFile, enrichedData);
        
        logger.success('challs.json written successfully');
    } catch (err) {
        logger.error(`Error processing YAML: ${err.message}`);
    }
}

function watchYamlFile() {
    logger.info(`Watching: ${challengesFile}`);
    
    const watcher = chokidar.watch(challengesFile);
    watcher.on('change', () => {
        logger.info('challenges.yml changed, reprocessing...');
        processYamlFile();
    });
}

async function start() {
    if (process.argv[2] === 'continuous') {
        logger.info('Continuous mode enabled');
        await processYamlFile();
        watchYamlFile();
    } else {
        await processYamlFile();
    }
}

start();