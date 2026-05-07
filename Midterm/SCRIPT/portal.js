const uidInput = document.getElementById('uidInput');
const searchBtn = document.getElementById('searchBtn');

const themeToggles = [
    document.getElementById('theme-toggle'),
    document.getElementById('theme-toggle-desktop')
];
const body = document.body;

async function fetchByUid() {
    const uid = uidInput.value.trim();
    const searchStatus = document.getElementById('searchStatus');
    const playerHeader = document.getElementById('playerHeader');

    if (!uid) {
        const alertModal = new bootstrap.Modal(document.getElementById('alertModal'));
        document.getElementById('modalMessage').innerText = "Please enter a UID to access the terminal.";
        alertModal.show();
        return;
    }

    // 🌀 Loading state
    searchStatus.innerHTML = '<div class="spinner-border spinner-border-sm text-info me-2"></div><small class="text-info">Synchronizing Akasha...</small>';

    try {
        const enkaRes = await fetch(`https://corsproxy.io/?https://enka.network/api/uid/${uid}/?cachebust=${Date.now()}`);

        if (!enkaRes.ok) {
            const alertModal = new bootstrap.Modal(document.getElementById('alertModal'));
            document.getElementById('modalMessage').innerText = "UID not found. Ensure your profile is public.";
            alertModal.show();
            throw new Error("Access denied.");
        }

        const enkaData = await enkaRes.json();
        const player = enkaData.playerInfo;

        // UPDATE PLAYER NAME & SIGNATURE
        document.getElementById('headerTitle').innerText = player.nickname;
        document.getElementById('headerSubtitle').innerText = player.signature || "No signature set.";

        // SET PLAYER ICON
        const iconContainer = document.querySelector('#playerHeader .player-icon-container');
        iconContainer.innerHTML = `
            <img src="https://enka.network/ui/UI_AvatarIcon_PlayerBoy.png" 
                alt="Aether" class="rounded-circle border border-info border-2" 
                style="width: 100px; height: 100px; object-fit: cover;">
        `;

        // GENERATE STAT BADGES
        const regionMap = { '1': 'CN', '6': 'NA', '7': 'EU', '8': 'ASIA', '9': 'TW' };
        const region = regionMap[uid[0]] || "ASIA";
        
        document.getElementById('headerStats').innerHTML = `
            <div class="akasha-stat-badge bg-primary text-white p-2 rounded small fw-bold">${region}</div>
            <div class="akasha-stat-badge bg-info text-dark p-2 rounded small fw-bold">AR${player.level || 0}</div>
            <div class="akasha-stat-badge bg-dark border border-secondary text-white p-2 rounded small">WL${player.worldLevel || 8}</div>
            <div class="akasha-stat-badge bg-warning text-dark p-2 rounded small">🏆 ${player.finishAchievementNum || 0}</div>
            <div class="akasha-stat-badge bg-secondary text-white p-2 rounded small">🌀 ${player.towerFloorIndex || 0}-${player.towerLevelIndex || 0}</div>
        `;

        // SHOW THE HEADER
        playerHeader.classList.remove('d-none');
        searchStatus.innerHTML = '<small class="text-success fw-bold">✓ Link Established</small>';

    } catch (error) {
        searchStatus.innerHTML = `<small class="text-danger fw-bold">⚠ ${error.message}</small>`;
    }
}

// The "X" Button function
function performFullReset() {
    const playerHeader = document.getElementById('playerHeader');
    if (playerHeader) playerHeader.classList.add('d-none');
    
    uidInput.value = '';
    document.getElementById('searchStatus').innerHTML = '';
}

document.addEventListener('DOMContentLoaded', () => {
    const inputField = document.getElementById('uidInput');
    
    if (inputField) {
        inputField.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                fetchByUid();
            }
        });
    }
});

function applyTheme(theme) {
    const isLight = theme === 'light';
    
    if (isLight) {
        body.classList.add('light-mode');
    } else {
        body.classList.remove('light-mode');
    }

    themeToggles.forEach(btn => {
        if (btn) {
            const icon = btn.querySelector('i');
            const textSpan = btn.querySelector('.theme-text');
            
            if (isLight) {
                icon.classList.replace('fa-moon', 'fa-sun');
                textSpan.textContent = "Dark Mode";
            } else {
                icon.classList.replace('fa-sun', 'fa-moon');
                textSpan.textContent = "Light Mode";
            }
        }
    });
}

// Event listeners and initial load remain the same
themeToggles.forEach(btn => {
    if (btn) {
        btn.addEventListener('click', () => {
            const newTheme = body.classList.contains('light-mode') ? 'dark' : 'light';
            localStorage.setItem('genshin-theme', newTheme);
            applyTheme(newTheme);
        });
    }
});

const savedTheme = localStorage.getItem('genshin-theme') || 'dark';
applyTheme(savedTheme);