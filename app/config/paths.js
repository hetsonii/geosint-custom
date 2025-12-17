const path = require('path');

const ROOT_DIR = path.join(__dirname, '..');
const PUBLIC_DIR = path.join(ROOT_DIR, 'public');
const VIEWS_DIR = path.join(ROOT_DIR, 'views');
const SECRETS_DIR = '/run/secrets';

function sanitizeName(name) {
    // Replace spaces with underscores for filesystem compatibility
    return name.replace(/\s+/g, '_');
}

module.exports = {
    ROOT_DIR,
    PUBLIC_DIR,
    VIEWS_DIR,
    SECRETS_DIR,
    
    // Data files
    CHALLENGES_YAML: path.join(ROOT_DIR, 'challenges.yml'),
    CHALLENGES_JSON: path.join(ROOT_DIR, 'challs.json'),
    SCHEMA_JSON: path.join(ROOT_DIR, 'schema.json'),
    
    // Image directories
    IMG_DIR: path.join(PUBLIC_DIR, 'img'),
    
    // Helper functions
    getCompDir: (comp) => path.join(PUBLIC_DIR, 'img', comp),
    getChallengeDir: (comp, name) => path.join(PUBLIC_DIR, 'img', comp, sanitizeName(name)),
    getMetaFile: (comp, name) => path.join(PUBLIC_DIR, 'img', comp, sanitizeName(name), '.meta'),
    getTileFile: (comp, name, x, y, z) => path.join(PUBLIC_DIR, 'img', comp, sanitizeName(name), `tile_${x}_${y}_${z}.jpeg`),
};