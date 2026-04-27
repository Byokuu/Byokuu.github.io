let allWeapons = [];
const weaponList = document.getElementById('weaponList');
const detailsModal = new bootstrap.Modal(document.getElementById('weaponDetailsModal'));

window.onload = async () => {
    weaponList.innerHTML = '<div class="text-center py-5"><div class="spinner-border text-info"></div></div>';
    try {
        const res = await fetch('https://genshin.jmp.blue/weapons');
        const ids = await res.json();
        const promises = ids.map(id => fetch(`https://genshin.jmp.blue/weapons/${id}`).then(r => r.json()));
        const results = await Promise.all(promises);
        allWeapons = results.map((w, index) => ({ ...w, id: ids[index] }));
        displayWeapons(allWeapons);
    } catch (err) {
        weaponList.innerHTML = `<p class="text-danger text-center">System Error: ${err.message}</p>`;
    }
};

function displayWeapons(list) {
    weaponList.innerHTML = list.length ? '' : '<p class="text-center text-muted py-5">No weapons found.</p>';
    list.forEach((weapon, index) => {
        const row = document.createElement('div');
        row.className = 'dex-row d-flex align-items-center justify-content-between p-3 animate-fade-in mb-2';
        row.innerHTML = `
            <div class="d-flex align-items-center gap-4">
                <span class="text-muted small fw-bold">#${(index + 1).toString().padStart(4, '0')}</span>
                <h5 class="m-0 fw-bold">${weapon.name}</h5>
                <span class="badge bg-dark text-info border border-info border-opacity-25 small">${weapon.type}</span>
            </div>
            <div class="dex-icon-wrapper">
                <img src="https://genshin.jmp.blue/weapons/${weapon.id}/icon" 
                     onerror="this.onerror=null; this.src='https://via.placeholder.com/100/0b0f1a/3d4451?text=?';" 
                     class="dex-img" alt="${weapon.name}">
            </div>
        `;
        row.onclick = () => showWeaponDetails(weapon);
        weaponList.appendChild(row);
    });
}

async function showWeaponDetails(weapon) {
    // 1. Sidebar Stats (Updated with Location)
    document.getElementById('weaponType').innerText = weapon.type;
    document.getElementById('baseAttack').innerText = weapon.baseAttack;
    document.getElementById('subStat').innerText = weapon.subStat || "None";
    document.getElementById('weaponLocation').innerText = weapon.location || "Gacha / Event";

    // 2. Main Header & Rarity
    document.getElementById('weaponName').innerText = weapon.name;
    document.getElementById('weaponRarity').innerText = '★'.repeat(weapon.rarity);

    // 3. Passive Tab
    document.getElementById('passiveName').innerText = weapon.passiveName || "No Passive";
    document.getElementById('passiveDesc').innerText = weapon.passiveDesc || "No description available.";

    // 4. Materials Tab
    const matContainer = document.getElementById('materialContainer');
    matContainer.innerHTML = `
        <div class="talent-card p-3 mb-3">
            <h6 class="text-info small fw-bold mb-2">Ascension Material Group</h6>
            <p class="text-white-50 text-capitalize mb-0">${weapon.ascensionMaterial || "Unknown"}</p>
        </div>
    `;

    // 5. Image Display with Fallback
    const weaponImg = document.getElementById('weaponImg');
    const iconUrl = `https://genshin.jmp.blue/weapons/${weapon.id}/icon`;
    const placeholderUrl = `https://via.placeholder.com/400x600/0b0f1a/3d4451?text=NO+IMAGE`;

    weaponImg.src = iconUrl;
    weaponImg.onerror = () => { weaponImg.src = placeholderUrl; };

    detailsModal.show();
}

// Search Logic
const performSearch = () => {
    const query = document.getElementById('nameSearch').value.toLowerCase();
    const typeFilter = document.getElementById('typeFilter').value;

    const filtered = allWeapons.filter(w => {
        const matchesName = w.name.toLowerCase().includes(query);
        const matchesType = typeFilter === "" || w.type === typeFilter;
        return matchesName && matchesType;
    });
    displayWeapons(filtered);
};

document.getElementById('searchBtn').onclick = performSearch;

document.getElementById('clearBtn').onclick = () => {
    document.getElementById('nameSearch').value = '';
    document.getElementById('typeFilter').value = '';
    displayWeapons(allWeapons);
};

document.getElementById('nameSearch').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') performSearch();
});