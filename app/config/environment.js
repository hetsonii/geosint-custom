module.exports = {
    NODE_ENV: process.env.NODE_ENV || 'development',
    PORT: process.env.PORT || 6958,
    
    // Google Maps API
    MAPS_API_KEY: process.env.MAPS_API_KEY,
    
    // Logging
    LOG_LEVEL: process.env.LOG_LEVEL || 'summary',
};