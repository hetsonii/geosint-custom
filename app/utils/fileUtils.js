const fs = require('fs').promises;
const fsSync = require('fs');

async function ensureDir(dirPath) {
    try {
        await fs.mkdir(dirPath, { recursive: true });
    } catch (err) {
        if (err.code !== 'EEXIST') throw err;
    }
}

function ensureDirSync(dirPath) {
    if (!fsSync.existsSync(dirPath)) {
        fsSync.mkdirSync(dirPath, { recursive: true });
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

module.exports = {
    ensureDir,
    ensureDirSync,
    writeFile,
    readFile,
    fileExists,
    writeJSON,
    readJSON,
    listFiles,
};