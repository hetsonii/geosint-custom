const fs = require('fs');
const fetch = require('node-fetch');
const logger = require('../utils/logger');
const paths = require('../config/paths');
const { TILE_BATCH_SIZE, MAX_FETCH_RETRIES, RETRY_DELAY_MS, FILE_WRITE_DELAY_MS, PANO_TYPE } = require('../config/constants');

class TileService {
    constructor() {
        this.pendingWrites = [];
        this.sessionToken = null;
    }

    async getSessionToken(apiKey) {
        if (this.sessionToken) return this.sessionToken;

        logger.info('Requesting Map Tiles API session token...');

        const resp = await fetch(
            `https://tile.googleapis.com/v1/createSession?key=${apiKey}`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ mapType: 'streetview', language: 'en-US', region: 'US' })
            }
        );

        if (!resp.ok) {
            const body = await resp.text();
            throw new Error(`Failed to create session token: HTTP ${resp.status} - ${body}`);
        }

        const data = await resp.json();
        this.sessionToken = data.session;
        logger.success(`Session token obtained (expires: ${new Date(data.expiry * 1000).toISOString()})`);
        return this.sessionToken;
    }

    buildTileUrl(panoType, pano, x, y, z, session, apiKey) {
        if (panoType === PANO_TYPE.LEGACY) {
            return `https://lh3.ggpht.com/p/${pano}=x${x}-y${y}-z${z}`;
        }
        return `https://tile.googleapis.com/v1/streetview/tiles/${z}/${x}/${y}?session=${session}&key=${apiKey}&panoId=${pano}`;
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

    async fetchTile(x, y, z, comp, name, panoType, pano, session, apiKey) {
        try {
            const url = this.buildTileUrl(panoType, pano, x, y, z, session, apiKey);
            const resp = await this.fetchWithRetry(url);
            return await this.saveTile(x, y, z, comp, name, resp);
        } catch (err) {
            if (err.message.includes('HTTP 400') || err.message.includes('HTTP 404')) {
                logger.verbose(`Tile not available for ${comp}/${name} (${x},${y},${z})`);
            } else {
                logger.error(`Failed to fetch ${comp}/${name} tile (${x},${y},${z}): ${err.message}`);
            }
            return false;
        }
    }

    async fetchAllTiles(comp, name, panoType, pano, maxZ, apiKey) {
        const session = await this.getSessionToken(apiKey);

        let totalTiles = 0;
        let successCount = 0;
        const pendingFetches = [];

        for (let z = 0; z <= maxZ; z++) {
            for (let x = 0; x < 2 ** z; x++) {
                for (let y = 0; y < Math.max(1, 2 ** (z - 1)); y++) {
                    totalTiles++;

                    const fetchPromise = this.fetchTile(x, y, z, comp, name, panoType, pano, session, apiKey)
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
            count += (2 ** z) * Math.max(1, 2 ** (z - 1));
        }
        return count;
    }
}

module.exports = new TileService();