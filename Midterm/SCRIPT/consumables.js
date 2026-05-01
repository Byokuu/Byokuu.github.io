let allConsumables = [];
const consumableList = document.getElementById('consumableList');
const detailsModal = new bootstrap.Modal(document.getElementById('consumableDetailsModal'));

window.onload = async () => {
    consumableList.innerHTML = '<div class="text-center py-5"><div class="spinner-border text-info"></div></div>';
    try {
        const [foodRes, potionRes] = await Promise.all([
            fetch('https://genshin.jmp.blue/consumables/food'),
            fetch('https://genshin.jmp.blue/consumables/potions')
        ]);

        const foodData = await foodRes.json();
        const potionData = await potionRes.json();

        // Ensure we only map valid items that actually have a name
        const foodItems = Object.keys(foodData)
            .filter(id => foodData[id].name) // Skip items with no name
            .map(id => ({ ...foodData[id], id, category: 'Food' }));

        const potionItems = Object.keys(potionData)
            .filter(id => potionData[id].name) // Skip items with no name
            .map(id => ({ ...potionData[id], id, category: 'Potion' }));

        allConsumables = [...foodItems, ...potionItems];
        displayConsumables(allConsumables);
    } catch (err) {
        console.error("Fetch error:", err);
        consumableList.innerHTML = `<p class="text-danger text-center">System Error: ${err.message}</p>`;
    }
};

function displayConsumables(list) {
    consumableList.innerHTML = list.length ? '' : '<p class="text-center text-muted py-5">No items found.</p>';
    list.forEach((item, index) => {
        const row = document.createElement('div');
        row.className = 'dex-row d-flex align-items-center justify-content-between p-3 animate-fade-in mb-2';
        row.innerHTML = `
            <div class="d-flex align-items-center gap-4">
                <span class="text-muted small fw-bold">#${(index + 1).toString().padStart(4, '0')}</span>
                <h5 class="m-0 fw-bold">${item.name}</h5>
            </div>
            <div class="dex-icon-wrapper">
                <img src="https://genshin.jmp.blue/consumables/${item.category.toLowerCase()}/${item.id}" 
                     onerror="this.src='https://via.placeholder.com/100/0b0f1a/3d4451?text=?';" 
                     class="dex-img" alt="${item.name}">
            </div>
        `;
        row.onclick = () => showItemDetails(item);
        consumableList.appendChild(row);
    });
}

function showItemDetails(item) {
    // 1. Header & Rarity - Added fallback for name
    document.getElementById('itemName').innerText = item.name || "Unknown Item";
    document.getElementById('itemRarity').innerText = '★'.repeat(item.rarity || 0);
    
    // 2. Sidebar Mini Stats
    document.getElementById('itemType').innerText = item.type || item.category || "Consumable";
    
    // Defensive check: ensure gameplayBuff isn't empty or undefined
    const gameplayBuff = item.effect || item.description || "No specific effect listed.";
    document.getElementById('itemEffect').innerText = gameplayBuff;

    // 3. Details Tab (Flavor Text & Proficiency)
    const flavorText = (item.description && item.description !== item.effect) 
        ? item.description 
        : "Standard consumable used for various buffs and recovery.";
    
    document.getElementById('itemDesc').innerText = flavorText;

    // Proficiency (Specialty Dishes) - Added check for item.proficiency AND item.proficiency.cookedBy
    const profContainer = document.getElementById('proficencyContainer');
    if (item.proficiency && Array.isArray(item.proficiency.cookedBy)) {
        profContainer.innerHTML = `
            <div class="talent-card p-3 mt-3 border-start border-info border-3">
                <h6 class="text-info small fw-bold mb-1">SPECIALTY DISH</h6>
                <p class="text-white-50 mb-0 small">Cooked by: ${item.proficiency.cookedBy.join(', ')}</p>
            </div>
        `;
    } else {
        profContainer.innerHTML = '';
    }

    // 4. Recipe / Ingredients Tab - Added Array.isArray check
    const recipeContainer = document.getElementById('recipeContainer');
    if (item.recipe && Array.isArray(item.recipe) && item.recipe.length > 0) {
        recipeContainer.innerHTML = `
            <h6 class="text-info small fw-bold mb-3">CRAFTING MATERIALS</h6>
            ${item.recipe.map(ing => `
                <div class="talent-card p-3 mb-2 d-flex justify-content-between align-items-center">
                    <span class="text-white fw-bold">${ing.item || 'Unknown Ingredient'}</span>
                    <span class="badge bg-dark text-info border border-info border-opacity-25">x${ing.quantity || 1}</span>
                </div>
            `).join('')}
        `;
    } else {
        recipeContainer.innerHTML = `
            <div class="text-center py-4 opacity-50">
                <i class="fa-solid fa-box-open mb-2 display-6"></i>
                <p class="small italic">Obtained via shops, exploration, or events.</p>
            </div>
        `;
    }

    // 5. Image Display with Fallback
    const itemImg = document.getElementById('itemImg');
    const category = (item.category || 'food').toLowerCase();
    const itemId = item.id || item.name?.toLowerCase().replace(/\s+/g, '-');
    
    itemImg.src = `https://genshin.jmp.blue/consumables/${category}/${itemId}`;
    
    itemImg.onerror = () => { 
        itemImg.src = 'https://via.placeholder.com/400x400/0b0f1a/3d4451?text=NO+IMAGE'; 
    };

    // 6. Final Execution
    detailsModal.show();
}

const performSearch = () => {
    const query = document.getElementById('nameSearch').value.toLowerCase().trim();
    const catQuery = document.getElementById('typeFilter').value.trim();

    const filtered = allConsumables.filter(item => {
        const matchesName = item.name?.toLowerCase().includes(query);
        
        // Match category ignoring case (Food vs food)
        const matchesCat = catQuery === "" || 
            item.category.toLowerCase() === catQuery.toLowerCase();
        
        return matchesName && matchesCat;
    });

    displayConsumables(filtered);
};

document.getElementById('searchBtn').onclick = performSearch;
document.getElementById('clearBtn').onclick = () => {
    document.getElementById('nameSearch').value = '';
    document.getElementById('typeFilter').selectedIndex = 0;
    displayConsumables(allConsumables);
};

document.getElementById('nameSearch').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') performSearch();
});