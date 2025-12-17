const fs = require('fs').promises;
const fsSync = require('fs');
const path = require('path');

async function ensureDir(dirPath) {
    try {
        await fs.mkdir(dirPath, { recursive: true });
    } catch (err) {
        if (err.code !== 'EEXIST') throw err;
    }
}

async function writeFile(filePath, data) {
    await fs.writeFile(filePath, data);
}

async function readFile(filePath) {
    return await fs.readFile(filePath, 'utf8');
}

function fileExists(filePath) {
    return fsSync.existsSync(filePath);
}

async function writeJSON(filePath, data) {
    await writeFile(filePath, JSON.stringify(data, null, 2));
}

async function readJSON(filePath) {
    const content = await readFile(filePath);
    return JSON.parse(content);
}

async function listFiles(dirPath) {
    try {
        return await fs.readdir(dirPath);
    } catch (err) {
        return [];
    }
}

function countTilesExpected(maxZ) {
    let count = 0;
    for (let z = 0; z <= maxZ; z++) {
        count += (2 ** z) * (2 ** (z - 1));
    }
    return count;
}

async function countTilesExisting(imgDir) {
    const files = await listFiles(imgDir);
    return files.filter(f => f.startsWith('tile_') && f.endsWith('.jpeg')).length;
}

module.exports = {
    ensureDir,
    writeFile,
    readFile,
    fileExists,
    writeJSON,
    readJSON,
    listFiles,
    countTilesExpected,
    countTilesExisting,
};