const fs = require('fs').promises;
const fsSync = require('fs');
const logger = require('../utils/logger');
const paths = require('../config/paths');
const tileService = require('./TileService');

class MetadataService {
    async readMetadata(comp, name) {
        try {
            const metaFile = paths.getMetaFile(comp, name);
            if (!fsSync.existsSync(metaFile)) {
                return null;
            }
            const content = await fs.readFile(metaFile, 'utf8');
            return JSON.parse(content);
        } catch (err) {
            logger.warn(`Error reading metadata for ${comp}/${name}: ${err.message}`);
            return null;
        }
    }

    async writeMetadata(comp, name, data) {
        try {
            const metaFile = paths.getMetaFile(comp, name);
            await fs.writeFile(metaFile, JSON.stringify(data, null, 2));
        } catch (err) {
            logger.error(`Error writing metadata for ${comp}/${name}: ${err.message}`);
        }
    }

    async countExistingTiles(comp, name) {
        try {
            const challengeDir = paths.getChallengeDir(comp, name);
            const files = await fs.readdir(challengeDir);
            return files.filter(f => f.startsWith('tile_') && f.endsWith('.jpeg')).length;
        } catch (err) {
            return 0;
        }
    }

    async shouldRefetch(comp, name, currentPano, maxZ) {
        const meta = await this.readMetadata(comp, name);

        if (!meta) {
            logger.info(`No metadata for ${comp}/${name}, fetching tiles...`);
            return true;
        }

        if (meta.pano !== currentPano) {
            logger.info(`Pano ID mismatch for ${comp}/${name} (old: ${meta.pano}, new: ${currentPano}), re-fetching...`);
            return true;
        }

        const expectedTiles = tileService.calculateExpectedTiles(maxZ);
        const existingTiles = await this.countExistingTiles(comp, name);

        if (existingTiles < expectedTiles) {
            logger.warn(`Missing tiles for ${comp}/${name} (${existingTiles}/${expectedTiles}), re-fetching...`);
            return true;
        }

        return false;
    }
}

module.exports = new MetadataService();