let allBosses = [];
const bossList = document.getElementById('bossList');
const detailsModal = new bootstrap.Modal(document.getElementById('bossDetailsModal'));

window.onload = async () => {
    bossList.innerHTML = '<div class="text-center py-5"><div class="spinner-border text-info"></div></div>';
    try {
        const res = await fetch('https://genshin.jmp.blue/boss/weekly-boss');
        const ids = await res.json();
        
        const requests = ids.map(id => fetch(`https://genshin.jmp.blue/boss/weekly-boss/${id}`));
        const responses = await Promise.all(requests);
        allBosses = await Promise.all(responses.map(res => res.json()));

        displayBosses(allBosses);
    } catch (err) {
        bossList.innerHTML = `<p class="text-danger text-center">Load Error: ${err.message}</p>`;
    }
};

function displayBosses(list) {
    bossList.innerHTML = list.length ? '' : '<p class="text-center text-muted py-5">No bosses found.</p>';
    list.forEach((boss, index) => {
        const row = document.createElement('div');
        row.className = 'dex-row d-flex align-items-center justify-content-between p-3 animate-fade-in mb-2 cursor-pointer';
        row.innerHTML = `
            <div class="d-flex align-items-center gap-4">
                <span class="text-muted small fw-bold">#${(index + 1).toString().padStart(3, '0')}</span>
                <h5 class="m-0 fw-bold text-white">${boss.name}</h5>
            </div>
            <i class="bi bi-chevron-right text-muted"></i>
        `;
        row.onclick = () => {
            document.getElementById('bossName').innerText = boss.name;
            document.getElementById('bossDesc').innerText = boss.description;
            
            // Render Drops
            document.getElementById('dropsContainer').innerHTML = boss.drops.map(d => `
                <div class="talent-card p-2 border-start border-info border-3 bg-black bg-opacity-25 flex-grow-1" style="min-width: 45%;">
                    <div class="small text-white fw-bold">${d.name}</div>
                    <div class="text-muted" style="font-size: 0.7rem;">${d.source}</div>
                </div>
            `).join('');

            // Render Artifacts
            document.getElementById('artifactsContainer').innerHTML = boss.artifacts.map(a => `
                <span class="badge ${a.max_rarity === 5 ? 'bg-warning text-dark' : 'bg-secondary'} p-2">${a.name}</span>
            `).join('');

            detailsModal.show();
        };
        bossList.appendChild(row);
    });
}

// Search Logic
const performSearch = () => {
    const q = document.getElementById('nameSearch').value.toLowerCase();
    displayBosses(allBosses.filter(b => b.name.toLowerCase().includes(q)));
};

document.getElementById('searchBtn').onclick = performSearch;
document.getElementById('clearBtn').onclick = () => {
    document.getElementById('nameSearch').value = '';
    displayBosses(allBosses);
};
document.getElementById('nameSearch').onkeydown = (e) => e.key === 'Enter' && performSearch();