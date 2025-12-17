module.exports = {
    // Tile fetching
    TILE_BATCH_SIZE: 15,
    MAX_FETCH_RETRIES: 1,
    RETRY_DELAY_MS: 1000,
    FILE_WRITE_DELAY_MS: 1000,
    
    // File watching
    FILE_WATCH_DEBOUNCE_MS: 500,
    TILE_DELETE_DEBOUNCE_MS: 1000,
    
    // Distance calculation
    GUESS_THRESHOLD_KM: 0.05,
    EARTH_RADIUS_KM: 6371,
    
    // Pano types
    PANO_TYPE: {
        LEGACY: 0,
        MODERN: 1,
    },
    
    // Info keys for public display
    INFO_KEYS: ['img', 'width', 'height'],
    
    // Default values
    DEFAULTS: {
        img: 'tile_2_1_0.jpeg',
        width: 32,
        height: 16,
    },
};