/* jshint esversion: 6 */
/* jshint node: true */
'use strict';

const ICON_NAMES = [
    'cat.ico', 'gamer.ico', 'hacker.ico', 'pizza.ico', 'taco.ico',
    'galaxy_brain.ico', 'frogchamp.ico', 'hamhands.ico', 'justin.ico', 'caleb.ico'
];

class ChallengeManager {
    constructor() {
        this.map = null;
        this.markers = [];
        this.guessCoordinates = [];
        this.panoWidth = 32;
        this.panoHeight = 16;
        this.heading = 0;
        this.centerLoc = { lat: 0.00, lng: 0.00 };
        this.hasGuess = false;

        const pathParts = this.getPathParts();
        this.compName = pathParts.comp;
        this.challName = pathParts.name;
    }

    getPathParts() {
        const link = document.location.href.split('/');
        const challComp = link[link.length - 1].length === 0 
            ? link[link.length - 2] 
            : link[link.length - 1];
        const [comp, urlName] = challComp.split('-');
        // Convert underscores back to spaces for the actual challenge name
        const name = urlName.replace(/_/g, ' ');
        return { comp, name };
    }

    async loadChallengeInfo() {
        try {
            const response = await fetch('/info.json');
            if (!response.ok) throw new Error('Failed to load challenge info');
            
            const infoJson = await response.json();
            
            if (infoJson[this.compName]?.[this.challName]) {
                const panoInfo = infoJson[this.compName][this.challName];
                
                if (panoInfo.width && panoInfo.height) {
                    this.panoWidth = panoInfo.width;
                    this.panoHeight = panoInfo.height;
                }
                
                if (panoInfo.heading !== undefined) {
                    this.heading = panoInfo.heading;
                }
            }
        } catch (error) {
            console.error('Error loading challenge info:', error);
        }
    }

    initializeUI() {
        document.getElementById('chall-title').innerHTML = `<h2>${this.challName}</h2>`;
        document.getElementById('chall-result').innerHTML = 'Select a location on the map';
    }

    initializeMap() {
        this.map = new google.maps.Map(document.getElementById('map'), {
            center: this.centerLoc,
            zoom: 1,
            streetViewControl: false,
            disableDefaultUI: true,
            draggableCursor: 'crosshair'
        });

        this.addMapControls();
        this.addMapClickListener();
    }

    addMapControls() {
        const zoomControlDiv = document.createElement('div');
        new MapZoomControl(zoomControlDiv, this.map);
        zoomControlDiv.index = 1;
        this.map.controls[google.maps.ControlPosition.TOP_LEFT].push(zoomControlDiv);
    }

    addMapClickListener() {
        google.maps.event.addListener(this.map, 'click', (event) => {
            this.placeMarker(event.latLng);
        });
    }

    getUserIcon() {
        const cookies = document.cookie.split('; ');
        let icon = 'hacker.ico';
        
        for (const cookie of cookies) {
            const [key, value] = cookie.split('=');
            if (key === 'icon' && ICON_NAMES.includes(value)) {
                icon = value;
            }
        }
        
        return icon;
    }

    placeMarker(location) {
        this.clearMarkers();
        this.guessCoordinates = [];

        const marker = new google.maps.Marker({
            position: location,
            map: this.map,
            icon: `/img/icons/${this.getUserIcon()}`,
            animation: google.maps.Animation.DROP
        });

        this.markers.push(marker);
        this.guessCoordinates.push(
            marker.getPosition().lat(),
            marker.getPosition().lng()
        );

        this.enableSubmitButton();
    }

    enableSubmitButton() {
        if (!this.hasGuess) {
            this.hasGuess = true;
            const submitBtn = document.getElementById('submit');
            submitBtn.classList.add('active');
            submitBtn.innerHTML = 'Submit Guess';
        }
    }

    clearMarkers() {
        this.markers.forEach(marker => marker.setMap(null));
        this.markers = [];
    }

    initializePanorama() {
        const pano = document.getElementById('pano');
        const panoOptions = {
            pano: this.challName,
            visible: true,
            panControlOptions: { position: google.maps.ControlPosition.LEFT_CENTER },
            zoomControlOptions: { position: google.maps.ControlPosition.LEFT_CENTER }
        };

        const panorama = new google.maps.StreetViewPanorama(pano, panoOptions);
        panorama.registerPanoProvider(() => this.getCustomPanorama(), { cors: true });
    }

    getCustomPanoramaTileUrl(pano, zoom, tileX, tileY) {
        const origin = document.location.origin;
        // Use underscores for file paths
        const urlName = this.challName.replace(/\s+/g, '_');
        return `${origin}/img/${this.compName}/${urlName}/tile_${tileX}_${tileY}_${zoom}.jpeg`;
    }

    getCustomPanorama() {
        return {
            tiles: {
                tileSize: new google.maps.Size(512, 512),
                worldSize: new google.maps.Size(512 * this.panoWidth, 512 * this.panoHeight),
                centerHeading: this.heading,
                getTileUrl: this.getCustomPanoramaTileUrl.bind(this)
            }
        };
    }

    async submitGuess() {
        if (!this.hasGuess) return;

        try {
            const response = await fetch(`${document.location.href}/submit`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(this.guessCoordinates)
            });

            const result = await response.text();
            this.handleSubmitResponse(result);
        } catch (error) {
            console.error('Error submitting guess:', error);
            UIManager.showToast('Error submitting guess', 'error');
        }
    }

    handleSubmitResponse(response) {
        if (response.startsWith('yes')) {
            const flag = response.replace('yes, ', '');
            UIManager.showSuccessModal(flag);
            UIManager.triggerConfetti();
            document.getElementById('chall-result').innerHTML = '✓ Correct!';
        } else {
            UIManager.showToast('Incorrect guess. Try again!', 'error');
            UIManager.shakeElement(document.getElementById('map-box'));
            document.getElementById('chall-result').innerHTML = '✗ Try again';
        }
    }
}

class MapZoomControl {
    constructor(controlDiv, map) {
        this.map = map;
        this.createControls(controlDiv);
    }

    createControls(controlDiv) {
        controlDiv.style.padding = '10px';

        const wrapper = document.createElement('div');
        wrapper.style.cssText = `
            background: rgba(26, 31, 58, 0.9);
            border: 1px solid rgba(0, 240, 255, 0.3);
            border-radius: 8px;
            backdrop-filter: blur(10px);
        `;

        const zoomIn = this.createButton('+');
        const zoomOut = this.createButton('-');

        zoomIn.addEventListener('click', () => {
            this.map.setZoom(this.map.getZoom() + 1);
            this.updateButtonStates(zoomIn, zoomOut);
        });

        zoomOut.addEventListener('click', () => {
            this.map.setZoom(this.map.getZoom() - 1);
            this.updateButtonStates(zoomIn, zoomOut);
        });

        wrapper.appendChild(zoomIn);
        wrapper.appendChild(zoomOut);
        controlDiv.appendChild(wrapper);

        this.zoomIn = zoomIn;
        this.zoomOut = zoomOut;
    }

    createButton(text) {
        const button = document.createElement('div');
        button.textContent = text;
        button.style.cssText = `
            width: 30px;
            height: 30px;
            display: flex;
            align-items: center;
            justify-content: center;
            color: #00f0ff;
            font-size: 20px;
            font-weight: bold;
            cursor: pointer;
            transition: all 0.3s ease;
        `;

        button.addEventListener('mouseenter', () => {
            button.style.background = 'rgba(0, 240, 255, 0.2)';
        });

        button.addEventListener('mouseleave', () => {
            button.style.background = 'transparent';
        });

        return button;
    }

    updateButtonStates(zoomIn, zoomOut) {
        const zoom = this.map.getZoom();
        zoomIn.style.opacity = zoom >= 22 ? '0.3' : '1';
        zoomOut.style.opacity = zoom <= 0 ? '0.3' : '1';
    }
}

class UIManager {
    static showToast(message, type = 'success') {
        const existingToast = document.querySelector('.toast');
        if (existingToast) {
            existingToast.remove();
        }

        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        
        const title = document.createElement('div');
        title.className = 'toast-title';
        title.textContent = type === 'success' ? '✓ Success' : '✗ Error';
        
        const msg = document.createElement('div');
        msg.className = 'toast-message';
        msg.textContent = message;
        
        toast.appendChild(title);
        toast.appendChild(msg);
        document.body.appendChild(toast);

        setTimeout(() => toast.classList.add('show'), 10);
        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => toast.remove(), 400);
        }, 3000);
    }

    static showSuccessModal(flag) {
        const modal = document.createElement('div');
        modal.id = 'flag-modal';
        modal.className = 'show';
        
        modal.innerHTML = `
            <div class="modal-content">
                <div class="modal-title">Challenge Solved!</div>
                <div class="modal-flag">${flag}</div>
                <button class="modal-close" onclick="this.closest('#flag-modal').remove()">
                    Close
                </button>
            </div>
        `;
        
        document.body.appendChild(modal);

        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.remove();
            }
        });
    }

    static triggerConfetti() {
        if (typeof confetti !== 'function') {
            console.warn('Confetti library not loaded');
            return;
        }

        // Multiple bursts for more dramatic effect
        const duration = 3000;
        const animationEnd = Date.now() + duration;
        const defaults = { 
            startVelocity: 30, 
            spread: 360, 
            ticks: 60, 
            zIndex: 10002,
            colors: ['#00f0ff', '#bd00ff', '#00ff88', '#ff006e', '#ffdd00']
        };

        function randomInRange(min, max) {
            return Math.random() * (max - min) + min;
        }

        const interval = setInterval(function() {
            const timeLeft = animationEnd - Date.now();

            if (timeLeft <= 0) {
                return clearInterval(interval);
            }

            const particleCount = 50 * (timeLeft / duration);

            // Launch from left and right
            confetti({
                ...defaults,
                particleCount,
                origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 }
            });
            confetti({
                ...defaults,
                particleCount,
                origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 }
            });
        }, 250);

        // Initial big burst
        confetti({
            particleCount: 100,
            spread: 70,
            origin: { y: 0.6 },
            colors: ['#00f0ff', '#bd00ff', '#00ff88', '#ff006e', '#ffdd00'],
            zIndex: 10002
        });
    }

    static shakeElement(element) {
        element.classList.add('shake');
        setTimeout(() => element.classList.remove('shake'), 500);
    }
}

// Global submit function for button onclick
function submit() {
    if (window.challengeManager) {
        window.challengeManager.submitGuess();
    }
}

// Initialize challenge
async function initialize() {
    window.challengeManager = new ChallengeManager();
    await window.challengeManager.loadChallengeInfo();
    window.challengeManager.initializeUI();
    window.challengeManager.initializeMap();
    window.challengeManager.initializePanorama();
}