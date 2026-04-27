let allDomains = [];
const domainList = document.getElementById('domainList');
const detailsModal = new bootstrap.Modal(document.getElementById('domainDetailsModal'));

window.onload = async () => {
    domainList.innerHTML = '<div class="text-center py-5"><div class="spinner-border text-info"></div></div>';
    try {
        const listRes = await fetch('https://genshin.jmp.blue/domains');
        const domainIds = await listRes.json();

        const requests = domainIds.map(id => fetch(`https://genshin.jmp.blue/domains/${id}`));
        const responses = await Promise.all(requests);
        
        // Filter out any failed requests to prevent "undefined" errors
        const data = await Promise.all(responses.map(res => res.ok ? res.json() : null));
        allDomains = data.filter(d => d !== null);

        displayDomains(allDomains);
    } catch (err) {
        console.error("Domain Fetch Error:", err);
        domainList.innerHTML = `<p class="text-danger text-center">System Error: ${err.message}</p>`;
    }
};

function displayDomains(list) {
    domainList.innerHTML = list.length ? '' : '<p class="text-center text-muted py-5">No domains found.</p>';
    
    list.forEach((domain, index) => {
        // Skip entries that might be malformed (like the "id" or "anemo" ones seen in your screenshots)
        if (!domain.name) return;

        const row = document.createElement('div');
        row.className = 'dex-row d-flex align-items-center justify-content-between p-3 animate-fade-in mb-2 cursor-pointer';
        
        row.innerHTML = `
            <div class="d-flex align-items-center gap-4">
                <span class="text-muted small fw-bold">#${(index + 1).toString().padStart(4, '0')}</span>
                <div>
                    <h5 class="m-0 fw-bold text-white">${domain.name}</h5>
                    <small class="text-info text-uppercase" style="letter-spacing: 1px;">${domain.type || 'Domain'}</small>
                </div>
            </div>
            <div class="d-flex align-items-center gap-3">
                <span class="badge bg-dark border border-secondary small text-capitalize">${domain.nation || 'Unknown'}</span>
                <i class="bi bi-chevron-right text-muted"></i>
            </div>
        `;

        row.onclick = () => showDomainDetails(domain);
        domainList.appendChild(row);
    });
}

function showDomainDetails(domain) {
    document.getElementById('domainName').innerText = domain.name;
    document.getElementById('domainNation').innerText = domain.nation;
    document.getElementById('domainLocation').innerText = domain.location || 'Location Unknown';
    document.getElementById('domainDesc').innerText = domain.description || 'No description available.';

    // Elements
    const elementContainer = document.getElementById('elementContainer');
    elementContainer.innerHTML = (domain.recommendedElements || []).map(el => 
        `<span class="badge bg-info text-dark me-1">${el}</span>`
    ).join('');

    // Requirements (Levels)
    const reqContainer = document.getElementById('requirementsContainer');
    reqContainer.innerHTML = (domain.requirements || []).map(req => `
        <div class="talent-card p-3 mb-2 small bg-black bg-opacity-25 rounded border border-secondary border-opacity-25">
            <div class="d-flex justify-content-between border-bottom border-secondary border-opacity-25 pb-1 mb-2">
                <span class="text-info fw-bold">Level ${req.level}</span>
                <span class="text-white-50 small">AR ${req.adventureRank}</span>
            </div>
            <p class="mb-0 text-muted">Recommended: Lvl ${req.recommendedLevel}</p>
            ${req.leyLineDisorder ? `<div class="mt-2 text-warning italic small" style="font-size: 0.8rem;">${req.leyLineDisorder[0]}</div>` : ''}
        </div>
    `).join('');

    // Rewards logic
    const rewardContainer = document.getElementById('rewardContainer');
    const today = new Date().toLocaleDateString('en-US', { weekday: 'short' }).toLowerCase();
    
    // Find today's rewards or default to the first one available
    const todayRewards = domain.rewards?.find(r => r.day === today) || (domain.rewards ? domain.rewards[0] : null);

    if (todayRewards && todayRewards.details) {
        const lastLevel = todayRewards.details[todayRewards.details.length - 1];
        const drops = lastLevel.drops || lastLevel.items || [];
        
        rewardContainer.innerHTML = `
            <h6 class="text-info small fw-bold mb-3 text-uppercase">Drops Today (${today.toUpperCase()})</h6>
            <div class="d-flex flex-wrap gap-2">
                ${drops.map(d => `<div class="talent-card px-3 py-2 small border-start border-info border-3 bg-black bg-opacity-25">${d.name}</div>`).join('')}
            </div>
        `;
    } else {
        rewardContainer.innerHTML = '<p class="text-muted small">No specific drops listed for today.</p>';
    }

    detailsModal.show();
}

// Search Logic
const performSearch = () => {
    const nameQuery = document.getElementById('nameSearch').value.toLowerCase();
    const nationQuery = document.getElementById('nationFilter').value.toLowerCase();

    const filtered = allDomains.filter(d => {
        const matchesName = d.name.toLowerCase().includes(nameQuery);
        const matchesNation = nationQuery === "" || (d.nation && d.nation.toLowerCase() === nationQuery);
        return matchesName && matchesNation;
    });

    displayDomains(filtered);
};

// Event Listeners
document.getElementById('searchBtn').addEventListener('click', performSearch);
document.getElementById('nameSearch').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') performSearch();
});

document.getElementById('clearBtn').addEventListener('click', () => {
    document.getElementById('nameSearch').value = '';
    document.getElementById('nationFilter').value = '';
    displayDomains(allDomains);
});