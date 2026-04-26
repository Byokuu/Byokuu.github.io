const loadBtn = document.getElementById('loadBtn');
const searchBtn = document.getElementById('searchBtn');
const uidInput = document.getElementById('uidInput');
const placeholder = document.getElementById('placeholderText');
const contentCard = document.getElementById('contentCard');
const playerHeader = document.getElementById('playerHeader');
const gallery = document.getElementById('characterGallery');

// Map Enka ID to jmp.blue names
const characterMap = {
    "10000005": "Aether"
};

async function fetchByUid() {
    const uid = uidInput.value.trim();
    const searchStatus = document.getElementById('searchStatus');
    const playerHeader = document.getElementById('playerHeader');
    const gallery = document.getElementById('characterGallery');

    if (!uid) {
        const alertModal = new bootstrap.Modal(document.getElementById('alertModal'));
        document.getElementById('modalMessage').innerText = "Please enter a UID to access the terminal.";
        alertModal.show();
        return;
    }

    searchStatus.innerHTML = '<div class="spinner-border spinner-border-sm text-info me-2"></div><small class="text-info">Synchronizing Akasha...</small>';

    try {
        // Cache-busting fetch to ensure we get the latest snapshot from the proxy
        const enkaRes = await fetch(`https://corsproxy.io/?https://enka.network/api/uid/${uid}/?cachebust=${Date.now()}`);

        if (!enkaRes.ok) {
            const alertModal = new bootstrap.Modal(document.getElementById('alertModal'));
            document.getElementById('modalMessage').innerText = "UID not found. Ensure your profile is public.";
            alertModal.show();
            throw new Error("Access denied.");
        }

        const enkaData = await enkaRes.json();
        const player = enkaData.playerInfo;

        // 1. UPDATE TEXT DATA
        document.getElementById('headerTitle').innerText = player.nickname;
        document.getElementById('headerSubtitle').innerText = player.signature || "BRRRRRR";

        // 2. STATIC AETHER PROFILE
        const iconContainer = document.querySelector('#playerHeader .player-icon-container');

        iconContainer.innerHTML = `
            <img src="https://enka.network/ui/UI_AvatarIcon_PlayerBoy.png" 
                alt="Aether"
                onerror="this.src='https://genshin.jmp.blue/characters/traveler-anemo/icon'">
        `;

        // 3. FULLY DYNAMIC AKASHA BADGES
        const regionMap = { '1': 'CN', '6': 'NA', '7': 'EU', '8': 'ASIA', '9': 'TW' };
        const region = regionMap[uid[0]] || "ASIA";
        const theaterStars = player.theaterInfo ? `${player.theaterInfo.numberOfStars} / 10` : "LOCKED";
        const stygianTime = player.theaterInfo ? `${player.theaterInfo.totalStarsTime}s` : "---";

        document.getElementById('headerStats').innerHTML = `
            <div class="akasha-stat-badge badge-region">${region}</div>
            <div class="akasha-stat-badge badge-rank">AR${player.level || 0}</div>
            <div class="akasha-stat-badge" style="background: #8b5cf6; color: white;">WL${player.worldLevel || 8}</div>
            <div class="akasha-stat-badge badge-achievements">🏆 ${player.finishAchievementNum || 0}</div>
            <div class="akasha-stat-badge badge-spiral">🌀 ${player.towerFloorIndex || 0}-${player.towerLevelIndex || 0}</div>
            <div class="akasha-stat-badge badge-stygian"><span class="me-1">💠</span>${theaterStars}</div>
            <div class="akasha-stat-badge" style="background: #f59e0b; color: white;">⏳ ${stygianTime}</div>
        `;

        // 4. DISPLAY HEADER
        playerHeader.classList.remove('d-none');
        if (gallery) {
            gallery.classList.add('d-none');
        }

        searchStatus.innerHTML = '<small class="text-success fw-bold">✓ Link Established</small>';

    } catch (error) {
        searchStatus.innerHTML = `<small class="text-danger fw-bold">⚠ ${error.message}</small>`;
    }
}

async function fetchRandom() {
    placeholder.innerHTML = '<div class="spinner-border text-primary" role="status"></div>';
    contentCard.classList.add('d-none');

    try {
        const listRes = await fetch('https://genshin.jmp.blue/characters');
        const characters = await listRes.json();
        const randomId = characters[Math.floor(Math.random() * characters.length)];
        fetchCharacter(randomId);
    } catch (error) {
        placeholder.innerHTML = `<div class="alert alert-danger">Error fetching character list.</div>`;
    }
}

async function fetchCharacter(characterId) {
    const cardSlot = document.getElementById('characterCardSlot');
    const placeholder = document.getElementById('placeholderText');

    try {
        const detailRes = await fetch(`https://genshin.jmp.blue/characters/${characterId}`);
        if (!detailRes.ok) throw new Error("Character not found");
        const data = await detailRes.json();

        const visionType = data.vision.toLowerCase();
        const nationType = (data.nation || 'outlander').toLowerCase();

        // Ensure the contentCard is visible within the slot
        const contentCard = document.getElementById('contentCard');

        // Update Content
        document.getElementById('charName').innerText = data.name;
        document.getElementById('charTitle').innerText = data.title || "Teyvat Adventurer";

        const rarityContainer = document.getElementById('charRarity');
        rarityContainer.innerHTML = '';
        for (let i = 0; i < (data.rarity || 4); i++) {
            rarityContainer.innerHTML += '★';
        }

        document.getElementById('charVision').innerText = data.vision;
        document.getElementById('charVision').className = `badge rounded-pill badge-vision me-2 bg-${visionType}`;

        // Apply Element Glow
        contentCard.className = `character-card glow-${visionType}`;

        document.getElementById('charWeapon').innerText = data.weapon;
        document.getElementById('charDesc').innerText = data.description;
        document.getElementById('charNation').innerText = data.nation || "Unknown";
        document.getElementById('charNation').className = `fw-bold nation-${nationType}`;
        document.getElementById('charAffiliation').innerText = data.affiliation || "Unknown";

        // Set Image
        document.getElementById('charImg').src = `https://genshin.jmp.blue/characters/${characterId}/card`;

        // Render detailed lists
        renderList('skillsContainer', data.skillTalents, 'unlock');
        renderList('passivesContainer', data.passiveTalents, 'unlock');
        renderList('constsContainer', data.constellations, 'unlock');

        // Toggle Visibility
        if (placeholder) placeholder.classList.add('d-none');
        contentCard.classList.remove('d-none');
        contentCard.classList.add('animate-fade-in');

        // 2. SMOOTH SCROLL (Bonus for UX)
        contentCard.scrollIntoView({ behavior: 'smooth', block: 'center' });

    } catch (error) {
        console.error(error);
        if (placeholder) placeholder.innerHTML = `<div class="alert alert-danger">Character data not available.</div>`;
    }
}

function renderList(containerId, items, subLabelKey) {
    const container = document.getElementById(containerId);
    container.innerHTML = '';
    if (!items || items.length === 0) {
        container.innerHTML = '<p class="text-muted">Data not available for this character.</p>';
        return;
    }
    items.forEach(item => {
        const div = document.createElement('div');
        div.className = 'talent-item';
        div.innerHTML = `
                    <p class="mb-1 fw-bold text-white">${item.name}</p>
                    <p class="mb-2" style="font-size: 0.8rem; color: #7aa2f7;">${item[subLabelKey] || ''}</p>
                    <p class="mb-0 text-secondary" style="font-size: 0.9rem;">${(item.description || '').replace(/\n/g, '<br>')}</p>
                `;
        container.appendChild(div);
    });
}

// Function to clear character cards, headers, and input
function performFullReset() {
    document.getElementById('contentCard').classList.add('d-none');
    document.getElementById('playerHeader').classList.add('d-none');
    
    // Clear UID search specific elements
    const gallery = document.getElementById('characterGallery');
    if (gallery) {
        gallery.innerHTML = ''; 
        gallery.classList.add('d-none');
    }

    const placeholder = document.getElementById('placeholderText');
    if (placeholder) {
        placeholder.innerHTML = 'Search a UID or click Random to begin...'; 
        placeholder.classList.remove('d-none');
    }

    uidInput.value = '';
    document.getElementById('searchStatus').innerHTML = '';
}

// Event Listeners
document.getElementById('clearSearch').addEventListener('click', performFullReset);
document.getElementById('resetAll').addEventListener('click', performFullReset);
loadBtn.addEventListener('click', fetchRandom);
searchBtn.addEventListener('click', fetchByUid);
uidInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') fetchByUid(); });