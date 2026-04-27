let allArtifacts = [];
const artifactList = document.getElementById('artifactList');
const detailsModal = new bootstrap.Modal(document.getElementById('artifactDetailsModal'));

window.onload = async () => {
    artifactList.innerHTML = '<div class="text-center py-5"><div class="spinner-border text-info"></div></div>';
    try {
        const res = await fetch('https://genshin.jmp.blue/artifacts');
        const ids = await res.json();
        const promises = ids.map(id => fetch(`https://genshin.jmp.blue/artifacts/${id}`).then(r => r.json()));
        const results = await Promise.all(promises);
        allArtifacts = results.map((art, index) => ({ ...art, id: ids[index] }));
        displayArtifacts(allArtifacts);
    } catch (err) {
        artifactList.innerHTML = `<p class="text-danger text-center">System Error: ${err.message}</p>`;
    }
};

function displayArtifacts(list) {
    artifactList.innerHTML = list.length ? '' : '<p class="text-center text-muted py-5">No artifacts found.</p>';
    list.forEach((art, index) => {
        const row = document.createElement('div');
        row.className = 'dex-row d-flex align-items-center justify-content-between p-3 animate-fade-in mb-2';
        row.innerHTML = `
            <div class="d-flex align-items-center gap-4">
                <span class="text-muted small fw-bold">#${(index + 1).toString().padStart(4, '0')}</span>
                <h5 class="m-0 fw-bold">${art.name}</h5>
            </div>
            <div class="dex-icon-wrapper">
                <img src="https://genshin.jmp.blue/artifacts/${art.id}/flower-of-life" 
                     onerror="this.src='https://via.placeholder.com/100/0b0f1a/3d4451?text=?';" 
                     class="dex-img" alt="${art.name}">
            </div>
        `;
        row.onclick = () => showArtifactDetails(art);
        artifactList.appendChild(row);
    });
}

function showArtifactDetails(art) {
    document.getElementById('artifactName').innerText = art.name;
    document.getElementById('artifactRarity').innerText = '★'.repeat(art.max_rarity);
    document.getElementById('maxRarity').innerText = `${art.max_rarity} Stars`;

    document.getElementById('bonus2').innerText = art['2-piece_bonus'] || "No 2-piece bonus.";
    document.getElementById('bonus4').innerText = art['4-piece_bonus'] || "No 4-piece bonus.";

    const artImg = document.getElementById('artifactImg');
    const imgUrl = `https://genshin.jmp.blue/artifacts/${art.id}/circlet-of-logos`;
    const fallbackUrl = `https://genshin.jmp.blue/artifacts/${art.id}/flower-of-life`;

    artImg.src = imgUrl;
    artImg.onerror = () => {
        if (artImg.src === imgUrl) {
            artImg.src = fallbackUrl;
        } else {
            artImg.src = 'https://via.placeholder.com/400x400/0b0f1a/3d4451?text=NO+IMAGE';
        }
    };

    detailsModal.show();
}

const performSearch = () => {
    const nameQuery = document.getElementById('nameSearch').value.toLowerCase();
    const rarityQuery = document.getElementById('rarityFilter').value;

    const filtered = allArtifacts.filter(art => {
        const matchesName = art.name.toLowerCase().includes(nameQuery);
        const matchesRarity = rarityQuery === "" || art.max_rarity == rarityQuery;
        
        return matchesName && matchesRarity;
    });

    displayArtifacts(filtered);
};

document.getElementById('searchBtn').onclick = performSearch;

// UPDATED CLEAR LOGIC
document.getElementById('clearBtn').onclick = () => {
    document.getElementById('nameSearch').value = '';
    document.getElementById('rarityFilter').selectedIndex = 0; 
    displayArtifacts(allArtifacts);
};

document.getElementById('nameSearch').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') performSearch();
});