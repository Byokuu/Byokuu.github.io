let allEnemies = [];
const enemyList = document.getElementById('enemyList');
const detailsModal = new bootstrap.Modal(document.getElementById('enemyDetailsModal'));

window.onload = async () => {
    enemyList.innerHTML = '<div class="text-center py-5"><div class="spinner-border text-info"></div></div>';
    try {
        const res = await fetch('https://genshin.jmp.blue/enemies');
        const ids = await res.json();
        const promises = ids.map(id => fetch(`https://genshin.jmp.blue/enemies/${id}`).then(r => r.json()));
        const results = await Promise.all(promises);
        allEnemies = results.map((enemy, index) => ({
            ...enemy,
            id: ids[index],
            originalIndex: index + 1
        }));
        displayEnemies(allEnemies);
    } catch (err) {
        enemyList.innerHTML = `<p class="text-danger text-center">System Error: ${err.message}</p>`;
    }
};

function displayEnemies(list) {
    enemyList.innerHTML = list.length ? '' : '<p class="text-center text-muted py-5">No enemies found.</p>';
    list.forEach((enemy, index) => {
        const row = document.createElement('div');
        row.className = 'dex-row d-flex align-items-center justify-content-between p-3 animate-fade-in mb-2';
        row.innerHTML = `
            <div class="d-flex align-items-center gap-4">
                <span class="text-muted small fw-bold">#${enemy.originalIndex.toString().padStart(4, '0')}</span>
                <h5 class="m-0 fw-bold">${enemy.name}</h5>
            </div>
            <div class="dex-icon-wrapper">
                <img src="https://genshin.jmp.blue/enemies/${enemy.id}/icon" 
                     onerror="this.onerror=null; this.src='https://genshin.jmp.blue/enemies/${enemy.id}/portrait';" 
                     class="dex-img" alt="${enemy.name}">
            </div>
        `;
        row.onclick = () => showEnemyDetails(enemy);
        enemyList.appendChild(row);
    });
}

async function showEnemyDetails(enemy) {
    // 1. Sidebar Stats
    document.getElementById('enemyType').innerText = enemy.type || "Common Enemy";
    document.getElementById('enemyFamily').innerText = enemy.family || "Other";
    document.getElementById('enemyFaction').innerText = enemy.faction || "Wilderness";

    // 2. Main Header
    document.getElementById('enemyName').innerText = enemy.name;

    // 3. Smart Description Logic
    const descContainer = document.getElementById('enemyDesc');
    descContainer.innerHTML = '';

    const multiDescriptions = enemy['elemental-descriptions'] || enemy['descriptions'] || [];
    const hasMultiple = multiDescriptions.length > 0;

    if ((enemy.description === "N/A" || !enemy.description) && hasMultiple) {
        descContainer.innerHTML = multiDescriptions.map(item => {
            const label = item.element || item.name || "Variation";
            const colorClass = (item.element || "").toLowerCase();

            return `
                <div class="element-detail-card mb-3 p-3 bg-dark bg-opacity-25 border-start border-3 ${colorClass ? 'border-' + colorClass : 'border-secondary'}">
                    <h6 class="${colorClass ? 'text-' + colorClass : 'text-info'} fw-bold">${label}</h6>
                    <p class="text-white-50 small mb-0">${item.description}</p>
                </div>
            `;
        }).join('');
    } else {
        descContainer.innerText = enemy.description || "No data available.";
    }

    // 4. Elements Tab (Badges)
    const elementsTabContainer = document.getElementById('enemyElementsContainer');
    elementsTabContainer.innerHTML = '';

    if (enemy.elements && enemy.elements.length > 0) {
        enemy.elements.forEach(el => {
            const badge = document.createElement('span');
            badge.className = `badge-vision ${el.toLowerCase()} px-3 py-2`;
            badge.style.borderRadius = '6px';
            badge.style.fontWeight = 'bold';
            badge.innerText = el;
            elementsTabContainer.appendChild(badge);
        });
    } else {
        elementsTabContainer.innerHTML = '<p class="text-muted small italic">No specific elements.</p>';
    }

    // 5. Drops Tab
    const dropsContainer = document.getElementById('dropsContainer');
    const allDrops = Array.isArray(enemy.drops) ? enemy.drops : [];

    if (allDrops.length > 0) {
        renderModalList('dropsContainer', allDrops, 'rarity');
    } else {
        dropsContainer.innerHTML = '<p class="text-muted small italic p-3">No recorded drops.</p>';
    }

    // 6. Image Display with Fallbacks
    const enemyImg = document.getElementById('enemyImg');
    const portraitUrl = `https://genshin.jmp.blue/enemies/${enemy.id}/portrait`;
    const iconUrl = `https://genshin.jmp.blue/enemies/${enemy.id}/icon`;
    const placeholderUrl = `https://via.placeholder.com/400x600/0b0f1a/3d4451?text=IMAGE+NOT+FOUND`;

    enemyImg.src = portraitUrl;
    enemyImg.onerror = () => {
        if (enemyImg.src === portraitUrl) {
            enemyImg.src = iconUrl;
        } else if (enemyImg.src === iconUrl) {
            enemyImg.src = placeholderUrl;
        }
    };

    detailsModal.show();
}

// Search Logic
const performSearch = () => {
    const nameQuery = document.getElementById('nameSearch').value.toLowerCase();
    const typeQuery = document.getElementById('typeFilter').value; // Matches COMMON/ELITE
    const familyQuery = document.getElementById('familyFilter').value;

    const filtered = allEnemies.filter(enemy => {
        const matchesName = enemy.name.toLowerCase().includes(nameQuery);
        
        // Use optional chaining or defaults to prevent errors if type/family is missing
        const enemyType = enemy.type || "";
        const enemyFamily = enemy.family || "";

        const matchesType = !typeQuery || enemyType === typeQuery;
        const matchesFamily = !familyQuery || enemyFamily === familyQuery;

        return matchesName && matchesType && matchesFamily;
    });

    displayEnemies(filtered);
};

// Universal Renderer
function renderModalList(containerId, items, subLabelKey) {
    const container = document.getElementById(containerId);
    if (!container) return;

    container.innerHTML = items.map(item => {
        const name = typeof item === 'string' ? item : (item.name || item.element || "Unknown Item");
        const description = item.description || "";
        const sub = item[subLabelKey] || "";

        return `
            <div class="talent-card p-3 mb-3">
                <div class="d-flex justify-content-between align-items-center mb-2">
                    <h6 class="m-0 fw-bold text-info small">${name}</h6>
                    ${sub ? `<span class="badge bg-dark text-secondary" style="font-size: 0.65rem;">${sub}</span>` : ''}
                </div>
                ${description ? `<p class="mb-0 small text-white-50 lh-sm">${description}</p>` : ''}
            </div>
        `;
    }).join('');
}

document.getElementById('searchBtn').onclick = performSearch;

document.getElementById('clearBtn').onclick = () => {
    document.getElementById('nameSearch').value = '';
    document.getElementById('typeFilter').value = '';
    document.getElementById('familyFilter').value = '';
    displayEnemies(allEnemies);
};

document.getElementById('nameSearch').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
        e.preventDefault();
        performSearch();
    }
});