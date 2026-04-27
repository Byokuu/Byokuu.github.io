let allMaterials = [];
const materialList = document.getElementById('materialList');
const detailsModal = new bootstrap.Modal(document.getElementById('materialDetailsModal'));

const categories = [
    "boss-material", "character-ascension", "character-experience", 
    "common-ascension", "cooking-ingredients", "local-specialties", 
    "talent-book", "talent-boss", "weapon-ascension", "weapon-experience"
];

window.onload = async () => {
    materialList.innerHTML = '<div class="text-center py-5"><div class="spinner-border text-info"></div></div>';
    try {
        const requests = categories.map(cat => fetch(`https://genshin.jmp.blue/materials/${cat}`));
        const responses = await Promise.all(requests);
        const dataResults = await Promise.all(responses.map(res => res.json()));

        allMaterials = [];
        dataResults.forEach((data, index) => {
            const rawCat = categories[index];
            const categoryLabel = rawCat.replace(/-/g, ' ');
            let items = [];

            if (Array.isArray(data)) {
                items = data.map(id => ({
                    id: id,
                    name: id.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' '),
                    category: categoryLabel,
                    rawCategory: rawCat
                }));
            } 
            else if (data.items && Array.isArray(data.items)) {
                items = data.items.map(itemObj => ({
                    ...itemObj,
                    id: itemObj.id || itemObj.name.toLowerCase().replace(/\s+/g, '-'),
                    category: categoryLabel,
                    rawCategory: rawCat
                }));
            } 
            else {
                items = Object.keys(data).filter(key => key !== 'id').map(id => {
                    const baseData = typeof data[id] === 'object' ? data[id] : { name: data[id] };
                    return {
                        ...baseData,
                        id: id,
                        name: baseData.name || id.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' '),
                        category: categoryLabel,
                        rawCategory: rawCat
                    };
                });
            }
            allMaterials = [...allMaterials, ...items];
        });

        allMaterials = allMaterials.filter(m => m.id !== 'items' && m.id !== 'id');
        displayMaterials(allMaterials);
    } catch (err) {
        console.error("Material Fetch Error:", err);
        materialList.innerHTML = `<p class="text-danger text-center">System Error: ${err.message}</p>`;
    }
};

function displayMaterials(list) {
    materialList.innerHTML = list.length ? '' : '<p class="text-center text-muted py-5">No materials found.</p>';
    
    list.forEach((item, index) => {
        const row = document.createElement('div');
        row.className = 'dex-row d-flex align-items-center justify-content-between p-3 animate-fade-in mb-2';
        
        const displayName = item.name || item.id.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');

        row.innerHTML = `
            <div class="d-flex align-items-center gap-4">
                <span class="text-muted small fw-bold">#${(index + 1).toString().padStart(4, '0')}</span>
                <h5 class="m-0 fw-bold text-white">${displayName}</h5>
                <span class="badge bg-dark text-info border border-info border-opacity-25 small text-capitalize">${item.category}</span>
            </div>
            <div class="dex-icon-wrapper">
                <img src="https://genshin.jmp.blue/materials/${item.rawCategory}/${item.id}" 
                     class="dex-img" 
                     alt="${displayName}">
            </div>
        `;

        // THE SECRET SAUCE: Waterfall loading
        const img = row.querySelector('.dex-img');
        img.onerror = function() {
            // If the first URL (base) fails, try the /icon URL
            if (!this.src.includes('/icon')) {
                this.src = `https://genshin.jmp.blue/materials/${item.rawCategory}/${item.id}/icon`;
            } else {
                // If even /icon fails, use your placeholder
                this.src = 'https://via.placeholder.com/100/0b0f1a/3d4451?text=?';
                this.onerror = null; // Kill the listener to prevent loops
            }
        };

        row.onclick = () => showMaterialDetails(item);
        materialList.appendChild(row);
    });
}

function showMaterialDetails(item) {
    document.getElementById('itemName').innerText = item.name || "Unknown Material";
    document.getElementById('itemRarity').innerText = '★'.repeat(item.rarity || 0);
    document.getElementById('itemType').innerText = item.category;
    document.getElementById('itemSource').innerText = item.source || "Found in the wild or via drops.";
    document.getElementById('itemDesc').innerText = item.description || "No flavor text available.";

    const sourceContainer = document.getElementById('sourceContainer');
    let sourceHTML = '';

    if (item.sources && item.sources.length > 0) {
        sourceHTML += `<h6 class="text-info small fw-bold mb-3">OBTAINED FROM</h6>`;
        item.sources.forEach(src => {
            sourceHTML += `<div class="talent-card p-3 mb-2 text-white small">${src}</div>`;
        });
    }

    if (item.locations && item.locations.length > 0) {
        sourceHTML += `<h6 class="text-info small fw-bold mt-4 mb-3">LOCATIONS</h6>`;
        item.locations.forEach(loc => {
            sourceHTML += `<div class="talent-card p-3 mb-2 text-info small border-start border-info border-3">${loc}</div>`;
        });
    }

    sourceContainer.innerHTML = sourceHTML || '<p class="text-muted italic">Discovery details unavailable.</p>';

    const itemImg = document.getElementById('itemImg');
    itemImg.src = `https://genshin.jmp.blue/materials/${item.rawCategory}/${item.id}`;
    itemImg.onerror = function() {
        if (!this.src.includes('/icon')) {
            this.src = `https://genshin.jmp.blue/materials/${item.rawCategory}/${item.id}/icon`;
        } else {
            this.src = 'https://via.placeholder.com/400x400/0b0f1a/3d4451?text=NO+IMAGE';
            this.onerror = null;
        }
    };

    detailsModal.show();
}

const performSearch = () => {
    const query = document.getElementById('nameSearch').value.toLowerCase().trim();
    const catQuery = document.getElementById('typeFilter').value;

    const filtered = allMaterials.filter(item => {
        const matchesName = (item.name || "").toLowerCase().includes(query);
        const matchesCat = catQuery === "" || item.rawCategory === catQuery;
        return matchesName && matchesCat;
    });
    displayMaterials(filtered);
};

document.getElementById('searchBtn').onclick = performSearch;
document.getElementById('clearBtn').onclick = () => {
    document.getElementById('nameSearch').value = '';
    document.getElementById('typeFilter').selectedIndex = 0;
    displayMaterials(allMaterials);
};

document.getElementById('nameSearch').addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
        event.preventDefault();
        performSearch();
    }
});