const fs = require('fs');
const fetch = require('node-fetch');
const logger = require('../utils/logger');
const paths = require('../config/paths');
const { TILE_BATCH_SIZE, MAX_FETCH_RETRIES, RETRY_DELAY_MS, FILE_WRITE_DELAY_MS, PANO_TYPE } = require('../config/constants');

class TileService {
    constructor() {
        this.pendingWrites = [];
    }

    buildTileUrl(panoType, pano, x, y, z) {
        if (panoType === PANO_TYPE.LEGACY) {
            return `https://lh3.ggpht.com/p/${pano}=x${x}-y${y}-z${z}`;
        }
        return `https://streetviewpixels-pa.googleapis.com/v1/tile?cb_client=maps_sv.tactile&panoid=${pano}&output=tile&x=${x}&y=${y}&zoom=${z}&nbt=1&fover=2`;
    }

    async fetchWithRetry(url, retries = 0) {
        try {
            const resp = await fetch(url);
            if (!resp.ok) {
                throw new Error(`HTTP ${resp.status}`);
            }
            return resp;
        } catch (err) {
            if (retries < MAX_FETCH_RETRIES) {
                logger.verbose(`Retry ${retries + 1}/${MAX_FETCH_RETRIES} for tile`);
                await new Promise(resolve => setTimeout(resolve, RETRY_DELAY_MS));
                return this.fetchWithRetry(url, retries + 1);
            }
            throw err;
        }
    }

    async saveTile(x, y, z, comp, name, resp) {
        const contentType = resp.headers.get("content-type");
        
        if (contentType && contentType.includes("application/json")) {
            logger.error(`Invalid content type for ${comp}/${name} tile (${x},${y},${z})`);
            return false;
        }

        return new Promise((resolve) => {
            resp.blob()
                .then(blob => blob.arrayBuffer())
                .then(ab => {
                    const fileName = paths.getTileFile(comp, name, x, y, z);
                    const fileStream = fs.createWriteStream(fileName);
                    fileStream.write(new Uint8Array(ab));
                    fileStream.end();
                    logger.verbose(`Saved ${comp}/${name} tile (${x},${y},${z})`);
                    resolve(true);
                })
                .catch(error => {
                    logger.error(`Error saving ${comp}/${name} tile (${x},${y},${z}): ${error.message}`);
                    resolve(false);
                });
        });
    }

    async fetchTile(x, y, z, comp, name, panoType, pano) {
        try {
            const url = this.buildTileUrl(panoType, pano, x, y, z);
            const resp = await this.fetchWithRetry(url);
            return await this.saveTile(x, y, z, comp, name, resp);
        } catch (err) {
            // HTTP 400 means tile doesn't exist at this coordinate - this is normal
            if (err.message.includes('HTTP 400')) {
                logger.verbose(`Tile not available for ${comp}/${name} (${x},${y},${z})`);
            } else {
                logger.error(`Failed to fetch ${comp}/${name} tile (${x},${y},${z}): ${err.message}`);
            }
            return false;
        }
    }

    async fetchAllTiles(comp, name, panoType, pano, maxZ) {
        let totalTiles = 0;
        let successCount = 0;
        const pendingFetches = [];

        for (let z = 0; z <= maxZ; z++) {
            for (let x = 0; x < 2 ** z; x++) {
                for (let y = 0; y < 2 ** (z - 1); y++) {
                    totalTiles++;
                    
                    const fetchPromise = this.fetchTile(x, y, z, comp, name, panoType, pano)
                        .then(success => {
                            if (success) successCount++;
                        });

                    pendingFetches.push(fetchPromise);

                    if (pendingFetches.length >= TILE_BATCH_SIZE) {
                        await Promise.all(pendingFetches);
                        pendingFetches.length = 0;
                    }
                }
            }
        }

        if (pendingFetches.length > 0) {
            await Promise.all(pendingFetches);
        }

        // Wait for file streams to finish
        await new Promise(resolve => setTimeout(resolve, FILE_WRITE_DELAY_MS));

        return { total: totalTiles, success: successCount };
    }

    calculateExpectedTiles(maxZ) {
        let count = 0;
        for (let z = 0; z <= maxZ; z++) {
            count += (2 ** z) * (2 ** (z - 1));
        }
        return count;
    }
}

module.exports = new TileService();