let allCharacters = [];
const characterList = document.getElementById('characterList');
const detailsModal = new bootstrap.Modal(document.getElementById('detailsModal'));

// Initialize character data
window.onload = async () => {
    characterList.innerHTML = '<div class="text-center py-5"><div class="spinner-border text-info"></div></div>';
    try {
        const res = await fetch('https://genshin.jmp.blue/characters');
        const ids = await res.json();

        const promises = ids.map(id => fetch(`https://genshin.jmp.blue/characters/${id}`).then(r => r.json()));
        const results = await Promise.all(promises);

        allCharacters = results.map((char, index) => ({
            ...char,
            id: ids[index],
            originalIndex: index + 1
        }));
        displayCharacters(allCharacters);
    } catch (err) {
        characterList.innerHTML = `<p class="text-danger text-center">System Error: ${err.message}</p>`;
    }
};

function displayCharacters(list) {
    characterList.innerHTML = list.length ? '' : '<p class="text-center text-muted py-5">No characters match your search.</p>';

    list.forEach((char, index) => {
        // Logic to rename Traveler based on their Element
        let finalName = char.name;
        if (char.name === "Traveler") {
            const element = char.vision || "Adaptive";
            finalName = `${element} Traveler`;
        }

        const row = document.createElement('div');
        row.className = 'dex-row d-flex align-items-center justify-content-between p-3';
        row.innerHTML = `
            <div class="d-flex align-items-center gap-4">
                <span class="text-muted small fw-bold">No ${char.originalIndex.toString().padStart(4, '0')}</span>
                <h5 class="m-0 fw-bold">${finalName}</h5>
            </div>
            <div class="dex-icon-wrapper">
                <img src="https://genshin.jmp.blue/characters/${char.id}/icon" alt="${finalName}" class="dex-img">
            </div>
        `;
        row.onclick = () => showDetails(char, finalName); // Pass the new name to the modal
        characterList.appendChild(row);
    });
}

// Search with 3 distinct filters
document.getElementById('searchBtn').onclick = () => {
    const nameQuery = document.getElementById('nameSearch').value.toLowerCase();
    const elementQuery = document.getElementById('elementFilter').value.toLowerCase();
    const weaponQuery = document.getElementById('weaponFilter').value.toLowerCase();

    const filtered = allCharacters.filter(char => {
        const matchesName = char.name.toLowerCase().includes(nameQuery);
        const matchesElement = elementQuery === "" || char.vision.toLowerCase() === elementQuery;
        const matchesWeapon = weaponQuery === "" || char.weapon.toLowerCase() === weaponQuery;
        return matchesName && matchesElement && matchesWeapon;
    });

    displayCharacters(filtered);
};

document.getElementById('clearBtn').onclick = () => {
    document.getElementById('nameSearch').value = '';
    document.getElementById('elementFilter').value = '';
    document.getElementById('weaponFilter').value = '';
    displayCharacters(allCharacters);
};

function showDetails(char, displayName) {
    // 1. Identify the character's name and element
    const titleName = displayName || char.name;
    const visionType = char.vision.toLowerCase();

    // 2. Update the Header and Side Image 🖼️
    document.getElementById('charName').innerText = titleName;
    document.getElementById('charRarity').innerText = '★'.repeat(char.rarity || 4);

    const charImg = document.getElementById('charImg');
    charImg.src = `https://genshin.jmp.blue/characters/${char.id}/card`;
    charImg.alt = titleName;

    // 3. Populate the Stats Panel 🏛️
    document.getElementById('charNation').innerText = char.nation || "Unknown Nation";
    document.getElementById('charAffiliation').innerText = char.affiliation || "No Affiliation";

    // 4. Set the Badges with the Dynamic Theme 
    document.getElementById('charVision').innerHTML = `
        <span class="badge-vision ${visionType} w-100">${char.vision}</span>`;

    document.getElementById('charWeapon').innerHTML = `
        <span class="badge-weapon w-100">${char.weapon}</span>`;

    // 5. Fill the Profile Tab 📜
    document.getElementById('charDesc').innerText = char.description;

    // 6. Render the Talent Lists into their Containers 📂
    renderModalList('skillsContainer', char.skillTalents, 'unlock');
    renderModalList('passivesContainer', char.passiveTalents, 'unlock');
    renderModalList('constsContainer', char.constellations, 'unlock');

    // 7. Reveal the Dashboard Modal 🔄
    detailsModal.show();
}

function renderModalList(containerId, items, subLabelKey) {
    const container = document.getElementById(containerId);
    if (!items || items.length === 0) {
        container.innerHTML = '<p class="text-muted small">Data not available.</p>';
        return;
    }

    container.innerHTML = items.map(item => `
        <div class="talent-card p-3 mb-3">
            <div class="d-flex justify-content-between align-items-center mb-2">
                <h6 class="m-0 fw-bold text-info small">${item.name}</h6>
                <span class="badge bg-dark text-secondary" style="font-size: 0.65rem;">
                    ${item[subLabelKey] || ''}
                </span>
            </div>
            <p class="mb-0 small text-white-50 lh-sm" style="font-size: 0.85rem;">
                ${item.description || ''}
            </p>
        </div>
    `).join('');
}

const inputs = [document.getElementById('nameSearch'), document.getElementById('elementFilter'), document.getElementById('weaponFilter')];
inputs.forEach(input => {
    input.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            document.getElementById('searchBtn').click();
        }
    });
});