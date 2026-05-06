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
    const loss5StarCharacters = ["Jean", "Diluc", "Mona", "Keqing", "Qiqi", "Tighnari", "Dehya"];
    const loss5StarWeapons = [
        "Skyward Harp", "Skyward Atlas", "Skyward Spine", "Skyward Pride", 
        "Skyward Blade", "Amos' Bow", "Lost Prayer", 
        "Primordial Jade Winged-Spear", "Wolf's Gravestone", "Aquila Favonia"
    ];

    for (let i = 0; i < pullCount; i++) {
        pity5++;
        pity4++;
        let rolledRarity = 3;

        // Determine Rarity
        if (Math.random() < 0.006 || pity5 >= maxPity) {
            rolledRarity = 5;
            pity5 = 0;
        } else if (Math.random() < 0.051 || pity4 >= 10) {
            rolledRarity = 4;
            pity4 = 0;
        }

        let item;
        if (rolledRarity === 5) {
            // Implement 50/50 Chance[cite: 1]
            const isWin5050 = Math.random() < 0.5;

            if (type === 'character' || type === 'character2') {
                if (isWin5050) {
                    // Won: Get Featured Character[cite: 1]
                    const featuredName = type === 'character' ? featured.banner1.fiveStar : featured.banner2.fiveStar;
                    item = { name: featuredName, rarity: 5 };
                } else {
                    // Lost: Get Random Standard Character[cite: 1, 2]
                    const lostChar = loss5StarCharacters[Math.floor(Math.random() * loss5StarCharacters.length)];
                    item = { name: lostChar, rarity: 5 };
                }
            } 
            else if (type === 'weapon') {
                if (isWin5050) {
                    // Won: Get Featured Weapon[cite: 1]
                    item = { name: featured.weapon, rarity: 5 };
                } else {
                    // Lost: Get Random Standard Weapon[cite: 1, 2]
                    const lostWeapon = loss5StarWeapons[Math.floor(Math.random() * loss5StarWeapons.length)];
                    item = { name: lostWeapon, rarity: 5 };
                }
            } 
            else {
                // Standard Banner pull[cite: 1]
                item = getRandomItem(pools.standard, 5);
            }
        }
        else if (rolledRarity === 4) {
            if (type === 'character' || type === 'character2') {
                if (Math.random() < 0.5) {
                    const lucky4 = featured.banner1.fourStars[Math.floor(Math.random() * 3)];
                    item = { name: lucky4, rarity: 4 };
                } else {
                    item = getRandomItem(pools.character, 4);
                }
            } else {
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
    const overlay = document.getElementById('wishOverlay');
    const star = document.getElementById('starStreak');

    // Perform logic and determine highest rarity for the star color
    const results = performWish(type, isTenPull);
    const highestRarity = Math.max(...results.map(item => item.rarity));

    // Show overlay and set star color (Gold for 5, Purple for 4)
    if (overlay && star) {
        overlay.classList.remove('d-none');
        star.style.background = highestRarity === 5
            ? 'linear-gradient(to bottom, transparent, #ffcc33)'
            : (highestRarity === 4 ? 'linear-gradient(to bottom, transparent, #af89ff)' : 'linear-gradient(to bottom, transparent, #fff)');
    }

    // Wait for animation, then show results and shake screen
    setTimeout(() => {
        if (overlay) overlay.classList.add('d-none');
        document.body.classList.add('shake');

        renderResults(results);
        updatePityDisplay(type);

        setTimeout(() => document.body.classList.remove('shake'), 800);
    }, 800);
}

function renderResults(results) {
    const container = document.getElementById('wishResults');
    if (!container) return;

    container.innerHTML = '';

    results.forEach((item, index) => {
        // 1. Determine Glow and Star Colors
        const rarityClass = `rarity-${item.rarity}`;
        const glowClass = item.rarity === 5 ? 'glow-5' : (item.rarity === 4 ? 'glow-4' : '');
        const starColor = item.rarity === 5 ? '#ffcc33' : item.rarity === 4 ? '#af89ff' : '#9ca3af';

        const card = document.createElement('div');
        card.className = 'col-6 col-md-2 animate-fade-in';

        // 2. Add Staggered Animation Delay (100ms apart)
        card.style.animationDelay = `${index * 0.1}s`;

        card.innerHTML = `
            <div class="akasha-card p-3 text-center ${rarityClass} ${glowClass}" style="height: 100%">
                <div class="small fw-bold text-truncate text-white" title="${item.name}">
                    ${item.name}
                </div>
                <div style="color: ${starColor}">
                    ${'★'.repeat(item.rarity)}
                </div>
            </div>
        `;
        container.appendChild(card);
    });
}

function updatePityDisplay(type) {
    const p5_1 = document.getElementById('pity5Count_1');
    const p4_1 = document.getElementById('pity4Count_1');
    const p5_2 = document.getElementById('pity5Count_2');
    const p4_2 = document.getElementById('pity4Count_2');
    const p5_main = document.getElementById('pity5Count');
    const p4_main = document.getElementById('pity4Count');

    // Sync all pity IDs found on the page
    [p5_1, p5_2, p5_main].forEach(el => { if (el) el.innerText = pity5; });
    [p4_1, p4_2, p4_main].forEach(el => { if (el) el.innerText = pity4; });

    const featured = getFeaturedItems();
    const f4Label1 = document.getElementById('featured4Stars_1');
    const f4Label2 = document.getElementById('featured4Stars_2');
    const name1 = document.getElementById('featuredName');
    const name2 = document.getElementById('featuredName2');

    // Only show "4 STARS: ..." text on character banners
    const isChar = (type === 'character' || type === 'character2');
    const rateUpText = isChar ? "4 STARS: " + featured.banner1.fourStars.join(", ") : "";

    if (f4Label1) f4Label1.innerText = rateUpText;
    if (f4Label2) f4Label2.innerText = rateUpText;

    // Update Banner Titles
    if (type === 'weapon') {
        if (name1) name1.innerText = featured.weapon;
        if (name2) name2.innerText = "";
    } else if (type === 'standard') {
        if (name1) name1.innerText = "Wanderlust Invocation";
        if (name2) name2.innerText = "";
    } else {
        if (name1) name1.innerText = featured.banner1.fiveStar;
        if (name2) name2.innerText = featured.banner2.fiveStar;
    }
}

function switchBanner(bannerId, element) {
    // 1. Hide all banner views
    document.querySelectorAll('.banner-view').forEach(view => {
        view.classList.add('d-none');
    });

    // 2. Show the selected banner
    const selectedBanner = document.getElementById(bannerId);
    if (selectedBanner) {
        selectedBanner.classList.remove('d-none');
    }

    // 3. Update tab visual state
    document.querySelectorAll('.nav-tab').forEach(tab => {
        tab.classList.remove('active');
    });
    element.classList.add('active');
}

window.onload = () => {
    if (window.location.href.includes('weapon')) updatePityDisplay('weapon');
    else if (window.location.href.includes('standard')) updatePityDisplay('standard');
    else updatePityDisplay('character');
};