let pity5 = 0;
let pity4 = 0;

// Database Pools
const pools = {
    character: {
        5: [
            "Albedo", "Alhaitham", "Arataki Itto", "Arlecchino", "Baizhu", "Chasca", "Chiori",
            "Clorinde", "Cyno", "Dehya", "Diluc", "Emilie", "Eula", "Ganyu", "Hu Tao", "Jean",
            "Kamisato Ayaka", "Kamisato Ayato", "Kaedehara Kazuha", "Keqing", "Klee", "Lyney",
            "Mavuika", "Mona", "Mualani", "Nahida", "Navia", "Neuvillette", "Nilou", "Ororon",
            "Qiqi", "Raiden Shogun", "Sangonomiya Kokomi", "Shenhe", "Sigewinne", "Tartaglia",
            "Tighnari", "Venti", "Wanderer", "Wriothesley", "Xianyun", "Xiao", "Xilonen",
            "Yae Miko", "Yelan", "Yoimiya", "Zhongli"
        ],
        4: [
            "Amber", "Barbara", "Beidou", "Bennett", "Candace", "Charlotte", "Chevreuse",
            "Chongyun", "Collei", "Diona", "Dori", "Faruzan", "Fischl", "Freminet", "Gaming",
            "Gorou", "Kachina", "Kaeya", "Kaveh", "Kirara", "Kujou Sara", "Kuki Shinobu",
            "Layla", "Lisa", "Lynette", "Mika", "Ningguang", "Noelle", "Razor", "Rosaria",
            "Sayu", "Sethos", "Shikanoin Heizou", "Sucrose", "Thoma", "Xiangling", "Xingqiu",
            "Xinyan", "Yanfei", "Yaoyao", "Yun Jin"
        ],
        3: ["Cool Steel", "Debate Club", "Black Tassel", "Sharpshooter's Oath", "Skyrider Sword"]
    },
    weapon: {
        5: [
            "Amos' Bow", "Aquila Favonia", "Beacon of the Reed Sea", "Calamity Queller",
            "Crimson Moon's Semblance", "Elegy for the End", "Engulfing Lightning",
            "Everlasting Moonglow", "Freedom-Sworn", "Haran Geppaku Futsu", "Hunter's Path",
            "Jadefall's Splendor", "Kagura's Verity", "Key of Khaj-Nisut",
            "Light of Foliar Incision", "Lost Prayer to the Sacred Winds", "Memory of Dust",
            "Mistsplitter Reforged", "Polar Star", "Primordial Jade Cutter",
            "Primordial Jade Winged-Spear", "Redhorn Stonethresher", "Skyward Atlas",
            "Skyward Blade", "Skyward Harp", "Skyward Pride", "Skyward Spine",
            "Song of Broken Pines", "Staff of Homa", "Staff of the Scarlet Sands",
            "Summit Shaper", "The First Great Magic", "The Unforged", "Thundering Pulse",
            "Tulaytullah's Remembrance", "Uraku Misugiri", "Verdict", "Vortex Vanquisher",
            "Wolf's Gravestone"
        ],
        4: [
            "Akuoumaru", "Amenoma Kageuchi", "Blackcliff Agate", "Blackcliff Longsword",
            "Blackcliff Pole", "Blackcliff Slasher", "Blackcliff Warbow", "Deathmatch",
            "Dragon's Bane", "Eye of Perception", "Favonius Codex", "Favonius Greatsword",
            "Favonius Lance", "Favonius Sword", "Favonius Warbow", "Hamayumi", "Iron Sting",
            "Lion's Roar", "Lithic Blade", "Lithic Spear", "Luxurious Sea-Lord", "Mappa Mare",
            "Mouun's Moon", "Prototype Amber", "Prototype Archaic", "Prototype Crescent",
            "Prototype Rancour", "Prototype Starglitter", "Rainslasher", "Royal Bow",
            "Royal Greatsword", "Royal Grimoire", "Royal Longsword", "Royal Spear",
            "Rust", "Sacrificial Bow", "Sacrificial Fragments", "Sacrificial Greatsword",
            "Sacrificial Sword", "Serpent Spine", "Solar Pearl", "The Alley Flash",
            "The Bell", "The Black Sword", "The Flute", "The Stringless", "The Viridescent Hunt",
            "The Widsith", "Wavebreaker's Fin", "Whiteblind", "Wine and Song", "Amber", "Barbara",
            "Beidou", "Bennett", "Candace", "Charlotte", "Chevreuse", "Chongyun", "Collei",
            "Diona", "Dori", "Faruzan", "Fischl", "Freminet", "Gaming", "Gorou", "Kachina",
            "Kaeya", "Kaveh", "Kirara", "Kujou Sara", "Kuki Shinobu", "Layla", "Lisa",
            "Lynette", "Mika", "Ningguang", "Noelle", "Razor", "Rosaria", "Sayu", "Sethos",
            "Shikanoin Heizou", "Sucrose", "Thoma", "Xiangling", "Xingqiu", "Xinyan",
            "Yanfei", "Yaoyao", "Yun Jin"
        ],
        3: ["Slingshot", "Raven Bow", "Skyrider Sword", "Magic Guide", "Thrilling Tales of Dragon Slayers"]
    },
    standard: {
        5: ["Jean", "Diluc", "Mona", "Keqing", "Qiqi", "Tighnari", "Dehya", "Skyward Harp", "Skyward Atlas", "Skyward Spine", "Skyward Pride", "Skyward Blade", "Amos' Bow", "Lost Prayer", "Primordial Jade Winged-Spear", "Wolf's Gravestone", "Aquila Favonia"],
        4: ["Amber", "Barbara", "Beidou", "Bennett", "The Widsith", "Favonius Sword", "Sacrificial Fragments"],
        3: ["Slingshot", "Raven Bow", "Skyrider Sword", "Magic Guide", "Thrilling Tales of Dragon Slayers"]
    }
};

// ROTATION LOGIC
function getFeaturedItems() {
    const startDate = new Date("2026-01-01").getTime();
    const now = new Date().getTime();
    const daysPassed = Math.floor((now - startDate) / (1000 * 60 * 60 * 24));
    const rotationIndex = Math.floor(daysPassed / 15);

    const char5List = pools.character[5];
    const char4List = pools.character[4];
    const weapon5List = pools.weapon[5];

    // Select 3 rotating 4-stars for character banners
    const rotating4Stars = [
        char4List[(rotationIndex * 3) % char4List.length],
        char4List[(rotationIndex * 3 + 1) % char4List.length],
        char4List[(rotationIndex * 3 + 2) % char4List.length]
    ];

    return {
        banner1: {
            fiveStar: char5List[rotationIndex % char5List.length],
            fourStars: rotating4Stars
        },
        banner2: {
            fiveStar: char5List[(rotationIndex + 1) % char5List.length],
            fourStars: rotating4Stars
        },
        weapon: weapon5List[rotationIndex % weapon5List.length]
    };
}

// CORE LOGIC
function performWish(type, isTenPull = false) {
    const results = [];
    const pullCount = isTenPull ? 10 : 1;
    const maxPity = type === 'weapon' ? 80 : 90;
    const featured = getFeaturedItems();

    for (let i = 0; i < pullCount; i++) {
        pity5++;
        pity4++;
        let rolledRarity = 3;

        if (Math.random() < 0.006 || pity5 >= maxPity) {
            rolledRarity = 5;
            pity5 = 0;
        } else if (Math.random() < 0.051 || pity4 >= 10) {
            rolledRarity = 4;
            pity4 = 0;
        }

        let item;
        if (rolledRarity === 5) {
            if (type === 'character') item = { name: featured.banner1.fiveStar, rarity: 5 };
            else if (type === 'character2') item = { name: featured.banner2.fiveStar, rarity: 5 };
            else if (type === 'weapon') item = { name: featured.weapon, rarity: 5 };
            else item = getRandomItem(pools.standard, 5);
        }
        else if (rolledRarity === 4) {
            // Character banners use the 3 rotating 4-stars
            if (type === 'character' || type === 'character2') {
                const banner = type === 'character' ? featured.banner1 : featured.banner2;
                const lucky4 = banner.fourStars[Math.floor(Math.random() * banner.fourStars.length)];
                item = { name: lucky4, rarity: 4 };
            } else {
                // Weapon and Standard pull from their general 4-star pools
                const poolRef = (type === 'standard') ? pools.standard : pools.weapon;
                item = getRandomItem(poolRef, 4);
            }
        }
        else {
            const poolRef = (type === 'standard') ? pools.standard : (type === 'weapon' ? pools.weapon : pools.character);
            item = getRandomItem(poolRef, 3);
        }
        results.push(item);
    }
    return results;
}

function getRandomItem(pool, rarity) {
    const items = pool[rarity];
    const pickedName = items[Math.floor(Math.random() * items.length)];
    return { name: pickedName, rarity: rarity };
}

// UI HANDLING
function handleGachaPull(type, isTenPull) {
    const results = performWish(type, isTenPull);
    renderResults(results);
    updatePityDisplay(type);
}

function renderResults(results) {
    const container = document.getElementById('wishResults');
    if (!container) return;

    container.innerHTML = '';
    results.forEach(item => {
        const rarityClass = `rarity-${item.rarity}`;
        const starColor = item.rarity === 5 ? '#ffcc33' : item.rarity === 4 ? '#af89ff' : '#7aa2f7';

        const card = document.createElement('div');
        card.className = 'col-6 col-md-2 animate-fade-in';
        card.innerHTML = `
            <div class="category-card p-3 text-center ${rarityClass}">
                <div class="small fw-bold text-truncate" title="${item.name}">${item.name}</div>
                <div style="color: ${starColor}">${'★'.repeat(item.rarity)}</div>
            </div>
        `;
        container.appendChild(card);
    });
}

function updatePityDisplay(type) {
    const p5 = document.getElementById('pity5Count');
    const p4 = document.getElementById('pity4Count');
    const maxPityLabel = document.getElementById('maxPity');
    
    // Labels for the 5-star names
    const featuredNameLabel = document.getElementById('featuredName');
    const featuredNameLabel2 = document.getElementById('featuredName2');
    
    // Label for the 4-star rate-ups
    const featured4Label = document.getElementById('featured4Stars');

    // Update Numerical Pity
    if (p5) p5.innerText = pity5;
    if (p4) p4.innerText = pity4;
    if (maxPityLabel) maxPityLabel.innerText = type === 'weapon' ? '80' : '90';

    const featured = getFeaturedItems();

    // 1. Update 5-Star Name Labels
    if (type === 'weapon') {
        if (featuredNameLabel) featuredNameLabel.innerText = featured.weapon;
    } else {
        if (featuredNameLabel) featuredNameLabel.innerText = featured.banner1.fiveStar;
        if (featuredNameLabel2) featuredNameLabel2.innerText = featured.banner2.fiveStar;
    }

    // 2. Update 4-Star Rate-Up Labels
    if (featured4Label) {
        if (type === 'character' || type === 'character2') {
            featured4Label.innerText = "Rate Up: " + featured.banner1.fourStars.join(", ");
        } else {
            featured4Label.innerText = "";
        }
    }
}

window.onload = () => {
    if (window.location.href.includes('weapon')) updatePityDisplay('weapon');
    else if (window.location.href.includes('standard')) updatePityDisplay('standard');
    else updatePityDisplay('character');
};