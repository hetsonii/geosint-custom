'use strict';

const ICON_NAMES = [
    'cat', 'gamer', 'hacker', 'pizza', 'taco', 
    'galaxy_brain', 'frogchamp', 'hamhands', 'justin', 'caleb'
];

class IconManager {
    constructor() {
        this.selectedIcon = this.loadSelectedIcon();
    }

    loadSelectedIcon() {
        const cookies = document.cookie.split('; ');
        for (const cookie of cookies) {
            const [key, value] = cookie.split('=');
            if (key === 'icon' && ICON_NAMES.includes(value)) {
                return value;
            }
        }
        return ICON_NAMES[2]; // Default to 'hacker'
    }

    saveSelectedIcon(iconName) {
        document.cookie = `icon=${iconName}.ico; path=/; max-age=31536000`;
        this.selectedIcon = iconName;
    }

    selectIcon(iconElement) {
        // Remove selected class from all icons
        document.querySelectorAll('#icon').forEach(icon => {
            icon.classList.remove('selected');
        });

        // Add selected class to clicked icon
        iconElement.classList.add('selected');

        // Extract icon name and save
        const iconSrc = iconElement.src.split('/').pop();
        const iconName = iconSrc.replace('.ico', '');
        this.saveSelectedIcon(iconName);
    }

    render() {
        const iconsDiv = document.getElementById('icons');
        if (!iconsDiv) return;

        ICON_NAMES.forEach(iconName => {
            const icon = document.createElement('img');
            icon.id = 'icon';
            icon.src = `/img/icons/${iconName}.ico`;
            icon.alt = iconName;
            icon.title = iconName;
            
            if (iconName === this.selectedIcon) {
                icon.classList.add('selected');
            }

            icon.addEventListener('click', () => this.selectIcon(icon));
            iconsDiv.appendChild(icon);
        });
    }
}

class ChallengeCard {
    constructor(comp, name, info) {
        this.comp = comp;
        this.name = name;
        this.info = info;
    }

    createCardElement() {
        const button = document.createElement('button');
        button.id = 'chall-card';
        button.setAttribute('aria-label', `Challenge: ${this.name}`);

        // Set background image if available
        if (this.info.img) {
            button.style.backgroundImage = `url('/img/${this.comp}/${this.name}/${this.info.img}')`;
        }

        // Create card content
        const content = document.createElement('div');
        content.className = 'card-content';

        const title = document.createElement('div');
        title.className = 'card-title';
        title.textContent = this.name;

        content.appendChild(title);
        button.appendChild(content);

        // Add click handler
        button.addEventListener('click', () => {
            window.location.href = `/${this.comp}-${this.name}`;
        });

        return button;
    }
}

class ChallengeGrid {
    constructor() {
        this.competitions = {};
    }

    async loadChallenges() {
        try {
            const response = await fetch('/info.json');
            if (!response.ok) {
                throw new Error('Failed to load challenges');
            }
            this.competitions = await response.json();
            return true;
        } catch (error) {
            console.error('Error loading challenges:', error);
            return false;
        }
    }

    renderCompetition(comp, challenges) {
        const challSelectDiv = document.createElement('div');
        challSelectDiv.id = 'chall-select';

        // Competition title
        const title = document.createElement('h3');
        title.id = 'chall-title';
        title.textContent = comp;
        challSelectDiv.appendChild(title);

        // Cards container
        const cardsDiv = document.createElement('div');
        cardsDiv.id = 'cards';

        Object.entries(challenges).forEach(([name, info]) => {
            const card = new ChallengeCard(comp, name, info);
            cardsDiv.appendChild(card.createCardElement());
        });

        challSelectDiv.appendChild(cardsDiv);
        return challSelectDiv;
    }

    render() {
        const compsDiv = document.getElementById('competitions');
        if (!compsDiv) return;

        compsDiv.innerHTML = ''; // Clear existing content

        Object.entries(this.competitions).forEach(([comp, challenges]) => {
            const compElement = this.renderCompetition(comp, challenges);
            compsDiv.appendChild(compElement);
        });
    }
}

// Initialize application
async function initializeApp() {
    // Load and render challenges
    const challengeGrid = new ChallengeGrid();
    const loaded = await challengeGrid.loadChallenges();
    
    if (loaded) {
        challengeGrid.render();
    } else {
        console.error('Failed to load challenges');
    }

    // Initialize and render icons
    const iconManager = new IconManager();
    iconManager.render();
}

// Run on page load
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeApp);
} else {
    initializeApp();
}