const fs = require("fs");
const https = require("https");
const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');
const logger = require('./logger');

const app = express();
const port = 6958;

app.use((req, res, next) => {
    if (req.path && req.path.startsWith('/img/')) {
        const absPath = path.join(__dirname, 'public', req.path);
        logger.verbose(`Image requested: ${req.path}`);
    }
    return next();
});

app.use(express.static(path.join(__dirname, 'public')));
app.use(bodyParser.json());
app.set('view engine', 'ejs');

const defaults = require(path.join(__dirname, 'defaults.json'));
const info_keys = ["img", "width", "height"];
const challsJsonPath = path.join(__dirname, 'challs.json');

let challsLastModifiedTime = 0;
let coords = {};
let info = {};

function distance(lat1, lon1, lat2, lon2) {
    function toRad(deg) { return deg * Math.PI / 180; }
    if (!isFinite(lat1) || !isFinite(lon1) || !isFinite(lat2) || !isFinite(lon2)) {
        return Number.MAX_VALUE;
    }
    if (lat1 === lat2 && lon1 === lon2) return 0;
    
    const R = 6371;
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) + 
              Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * 
              Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    
    return R * c;
}

function getFlag(comp, name) {
    const challenge = coords[comp][name];
    const file = challenge['flag_file'];
    let { flag } = challenge;
    
    if (file) {
        const secretPath = path.join('/run/secrets/', file);
        if (fs.existsSync(file)) {
            flag = fs.readFileSync(file, 'utf8').trim();
        } else if (fs.existsSync(secretPath)) {
            flag = fs.readFileSync(secretPath, 'utf8').trim();
        }
    }
    
    return flag;
}

function parsePublicInfo(challengeInfo) {
    const newData = {};
    
    for (const [comp, challs] of Object.entries(challengeInfo)) {
        newData[comp] = {};
        for (const [name, properties] of Object.entries(challs)) {
            newData[comp][name] = {};
            for (const property of info_keys) {
                const value = properties.hasOwnProperty(property) 
                    ? properties[property] 
                    : defaults[property];
                newData[comp][name][property] = value;
            }
        }
    }
    
    return newData;
}

function registerRoutes(currentCoords) {
    app.get('/', (req, res) => {
        res.sendFile(path.join(__dirname, 'index.html'));
    });

    app.get('/info.json', (req, res) => {
        reloadIfChanged();
        res.json(info);
    });

    for (const [comp, challs] of Object.entries(currentCoords)) {
        for (const [name] of Object.entries(challs)) {
            app.get(`/${comp}-${name}`, (req, res) => {
                res.render('chall', { API_KEY: process.env.MAPS_API_KEY });
            });

            app.post(`/${comp}-${name}/submit`, (req, res) => {
                const freshChall = coords[comp] && coords[comp][name];
                if (!freshChall) {
                    return res.status(404).send("Challenge not found");
                }

                const { lat: trueLat, lng: trueLng } = freshChall;
                const [guessLat, guessLng] = req.body;
                
                const dist = distance(
                    Number(guessLat), 
                    Number(guessLng), 
                    trueLat, 
                    trueLng
                );

                if (dist === 0 || dist <= 0.05) {
                    const flag = getFlag(comp, name);
                    logger.info(`Correct guess for ${comp}/${name} by ${req.ip}`);
                    res.send("yes, " + flag);
                } else {
                    logger.verbose(`Incorrect guess for ${comp}/${name}: ${dist.toFixed(2)}km off`);
                    res.send("not here");
                }
            });
        }
    }
}

function reloadIfChanged() {
    try {
        if (!fs.existsSync(challsJsonPath)) return;
        
        const stats = fs.statSync(challsJsonPath);
        const currentModifiedTime = new Date(stats.mtime).getTime();

        if (currentModifiedTime > challsLastModifiedTime) {
            logger.info("Reloading challenges...");
            const newData = JSON.parse(fs.readFileSync(challsJsonPath, 'utf8'));
            coords = newData;
            info = parsePublicInfo(coords);
            challsLastModifiedTime = currentModifiedTime;
            logger.success("Challenges reloaded");
        }
    } catch (err) {
        logger.error(`Error reloading challenges: ${err.message}`);
    }
}

async function start() {
    logger.info("Server starting, waiting for challs.json...");

    while (true) {
        if (fs.existsSync(challsJsonPath)) {
            try {
                const data = fs.readFileSync(challsJsonPath, 'utf8');
                if (data.trim().length > 0) {
                    coords = JSON.parse(data);
                    info = parsePublicInfo(coords);
                    challsLastModifiedTime = new Date(fs.statSync(challsJsonPath).mtime).getTime();
                    break;
                }
            } catch (err) {
                logger.warn("Waiting for valid JSON in challs.json...");
            }
        }
        await new Promise(resolve => setTimeout(resolve, 1000));
    }

    logger.success("challs.json loaded");
    registerRoutes(coords);

    if (process.env.SECURE === 'true') {
        const keyPath = process.env.HTTPS_KEY || "server.key";
        const certPath = process.env.HTTPS_CERT || "server.cert";
        
        const options = {
            key: fs.readFileSync(keyPath),
            cert: fs.readFileSync(certPath),
        };
        
        https.createServer(options, app).listen(port, () => {
            logger.success(`Secure server started on port ${port}`);
        });
    } else {
        app.listen(port, () => {
            logger.success(`Server started on port ${port}`);
        });
    }
}

start();