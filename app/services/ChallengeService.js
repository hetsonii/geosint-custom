const fs = require('fs').promises;
const fsSync = require('fs');
const yaml = require('js-yaml');
const Ajv = require('ajv');
const fetch = require('node-fetch');
const logger = require('../utils/logger');
const paths = require('../config/paths');
const env = require('../config/environment');
const { INFO_KEYS, DEFAULTS } = require('../config/constants');

class ChallengeService {
    constructor() {
        this.schema = require(paths.SCHEMA_JSON);
        this.ajv = new Ajv();
        this.validate = this.ajv.compile(this.schema);
    }

    async readYaml() {
        try {
            const yamlData = await fs.readFile(paths.CHALLENGES_YAML, 'utf8');
            return yaml.load(yamlData);
        } catch (err) {
            logger.error(`Error reading YAML: ${err.message}`);
            throw err;
        }
    }

    validateChallenges(data) {
        const isValid = this.validate(data);
        if (!isValid) {
            logger.error('YAML validation failed:');
            this.validate.errors.forEach(err => {
                logger.error(`  ${err.instancePath} ${err.message}`);
            });
            return false;
        }
        return true;
    }

    async fetchPanoId(lat, lng) {
        try {
            const url = `https://maps.googleapis.com/maps/api/streetview/metadata?location=${lat},${lng}&key=${env.MAPS_API_KEY}`;
            const resp = await fetch(url);
            
            if (!resp.ok) {
                return null;
            }

            const data = await resp.json();
            if (data.status !== 'OK') {
                return null;
            }

            return data.pano_id;
        } catch (err) {
            logger.error(`Error fetching pano ID: ${err.message}`);
            return null;
        }
    }

    async enrichWithPanoIds(challenges) {
        const enriched = {};
        
        for (const [comp, challs] of Object.entries(challenges)) {
            enriched[comp] = {};
            
            for (const [name, properties] of Object.entries(challs)) {
                enriched[comp][name] = { ...properties };
                
                if (properties.pano === null) {
                    logger.info(`Fetching pano ID for ${comp}/${name}...`);
                    const panoId = await this.fetchPanoId(properties.lat, properties.lng);
                    
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

    async writeChallenges(challenges) {
        try {
            await fs.writeFile(paths.CHALLENGES_JSON, JSON.stringify(challenges, null, 2));
        } catch (err) {
            logger.error(`Error writing challenges JSON: ${err.message}`);
            throw err;
        }
    }

    async loadChallenges() {
        try {
            if (!fsSync.existsSync(paths.CHALLENGES_JSON)) {
                return null;
            }
            
            delete require.cache[require.resolve(paths.CHALLENGES_JSON)];
            return require(paths.CHALLENGES_JSON);
        } catch (err) {
            logger.error(`Error loading challenges: ${err.message}`);
            return null;
        }
    }

    parsePublicInfo(challenges) {
        const publicInfo = {};
        
        for (const [comp, challs] of Object.entries(challenges)) {
            publicInfo[comp] = {};
            for (const [name, properties] of Object.entries(challs)) {
                publicInfo[comp][name] = {};
                for (const key of INFO_KEYS) {
                    publicInfo[comp][name][key] = properties.hasOwnProperty(key) 
                        ? properties[key] 
                        : DEFAULTS[key];
                }
            }
        }
        
        return publicInfo;
    }

    getFlag(comp, name, challenges) {
        const challenge = challenges[comp][name];
        const flagFile = challenge['flag_file'];
        let { flag } = challenge;
        
        if (flagFile) {
            const localPath = flagFile;
            const secretPath = `${paths.SECRETS_DIR}/${flagFile}`;
            
            if (fsSync.existsSync(localPath)) {
                flag = fsSync.readFileSync(localPath, 'utf8').trim();
            } else if (fsSync.existsSync(secretPath)) {
                flag = fsSync.readFileSync(secretPath, 'utf8').trim();
            }
        }
        
        return flag;
    }
}

module.exports = new ChallengeService();