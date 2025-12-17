const chokidar = require('chokidar');
const logger = require('../utils/logger');
const paths = require('../config/paths');
const { FILE_WATCH_DEBOUNCE_MS, TILE_DELETE_DEBOUNCE_MS } = require('../config/constants');

class FileWatcherService {
    constructor() {
        this.watchers = [];
    }

    watchChallengesYaml(onChangeCallback) {
        logger.info(`Watching: ${paths.CHALLENGES_YAML}`);
        
        const watcher = chokidar.watch(paths.CHALLENGES_YAML);
        
        watcher.on('change', () => {
            logger.info('challenges.yml changed, reprocessing...');
            setTimeout(onChangeCallback, FILE_WATCH_DEBOUNCE_MS);
        });

        this.watchers.push(watcher);
        return watcher;
    }

    watchChallengesJson(onChangeCallback) {
        logger.info(`Watching: ${paths.CHALLENGES_JSON}`);
        
        const watcher = chokidar.watch(paths.CHALLENGES_JSON, {
            ignoreInitial: false,
        });
        
        watcher.on('add', () => {
            logger.info('challs.json created, processing...');
            setTimeout(onChangeCallback, FILE_WATCH_DEBOUNCE_MS);
        });
        
        watcher.on('change', () => {
            logger.info('challs.json changed, reprocessing...');
            setTimeout(onChangeCallback, FILE_WATCH_DEBOUNCE_MS);
        });

        this.watchers.push(watcher);
        return watcher;
    }

    watchTileDirectory(onDeleteCallback) {
        const watcher = chokidar.watch(paths.IMG_DIR, {
            ignored: /(^|[\/\\])\../,
            persistent: true,
            ignoreInitial: true,
        });

        watcher.on('unlink', (filePath) => {
            if (filePath.includes('tile_') && filePath.endsWith('.jpeg')) {
                logger.warn(`Tile deleted: ${filePath}, triggering re-fetch...`);
                setTimeout(onDeleteCallback, TILE_DELETE_DEBOUNCE_MS);
            }
        });

        watcher.on('unlinkDir', (dirPath) => {
            logger.warn(`Directory deleted: ${dirPath}, triggering re-fetch...`);
            setTimeout(onDeleteCallback, TILE_DELETE_DEBOUNCE_MS);
        });

        this.watchers.push(watcher);
        return watcher;
    }

    closeAll() {
        this.watchers.forEach(watcher => watcher.close());
        this.watchers = [];
    }
}

module.exports = new FileWatcherService();