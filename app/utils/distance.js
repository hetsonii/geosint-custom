const { EARTH_RADIUS_KM, GUESS_THRESHOLD_KM } = require('../config/constants');

function toRad(deg) {
    return deg * Math.PI / 180;
}

function calculate(lat1, lng1, lat2, lng2) {
    if (!isFinite(lat1) || !isFinite(lng1) || !isFinite(lat2) || !isFinite(lng2)) {
        return Number.MAX_VALUE;
    }
    
    if (lat1 === lat2 && lng1 === lng2) {
        return 0;
    }
    
    const dLat = toRad(lat2 - lat1);
    const dLng = toRad(lng2 - lng1);
    
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) + 
              Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * 
              Math.sin(dLng / 2) * Math.sin(dLng / 2);
    
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    
    return EARTH_RADIUS_KM * c;
}

function isCorrect(distance) {
    return distance === 0 || distance <= GUESS_THRESHOLD_KM;
}

module.exports = {
    calculate,
    isCorrect,
};