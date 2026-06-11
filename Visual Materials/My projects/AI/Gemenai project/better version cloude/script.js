// State
let allPlaces = JSON.parse(localStorage.getItem('mapfolio_places')) || [];
let triageData = JSON.parse(localStorage.getItem('mapfolio_triage')) || {};
let customFolders = JSON.parse(localStorage.getItem('mapfolio_folders')) || ["Want to Go", "Done"];
let customCategories = JSON.parse(localStorage.getItem('mapfolio_custom_categories')) || [];
let activePlace = null;
let activeFolderFilter = null;
let map = null;
let markers = [];
let clusterGroup = null;
let tripState = { active: false, days: [], activeDay: 0, label: '' };
let savedTrips = JSON.parse(localStorage.getItem('mapfolio_trips')) || [];
let foldersShowAll = false;
const FOLDERS_VISIBLE_LIMIT = 5;

// ADD THIS LINE HERE TO DEFINE THE FILE UPLOADER ELEMENT:
const fileUpload = document.getElementById('file-upload');

const categoryConfig = {
    'City / Region':       { emoji: '🏙️', cssClass: 'cat-City' },
    'Hotel':               { emoji: '🏨', cssClass: 'cat-Hotel' },
    'Restaurant':          { emoji: '🍽️', cssClass: 'cat-Restaurant' },
    'Café / Bar':          { emoji: '☕', cssClass: 'cat-Cafe' },
    'Museum / Gallery':    { emoji: '🏛️', cssClass: 'cat-Museum' },
    'Monument / Landmark': { emoji: '🗽', cssClass: 'cat-Monument' },
    'Activity':            { emoji: '🧗', cssClass: 'cat-Activity' },
    'Beach':               { emoji: '🏖️', cssClass: 'cat-Beach' },
    'Nature':              { emoji: '🌿', cssClass: 'cat-Nature' },
    'Viewpoint':           { emoji: '🌄', cssClass: 'cat-Viewpoint' },
    'Market':              { emoji: '🧺', cssClass: 'cat-Market' },
    'Spa / Wellness':      { emoji: '🧖', cssClass: 'cat-Spa' },
    'Entertainment':       { emoji: '🎭', cssClass: 'cat-Entertainment' },
    'Shopping':            { emoji: '🛍️', cssClass: 'cat-Shopping' },
    'Parking / Fuel':      { emoji: '🅿️', cssClass: 'cat-Parking' },
    'Toilets':             { emoji: '🚻', cssClass: 'cat-Toilets' },
    'Other':               { emoji: '✨', cssClass: 'cat-Other' }
};

// Resolve category config — built-in or custom
function getCatConf(categoryName) {
    if (categoryConfig[categoryName]) return categoryConfig[categoryName];
    const custom = customCategories.find(c => c.name === categoryName);
    if (custom) return { emoji: custom.emoji, cssClass: 'cat-Custom' };
    return categoryConfig['Other'];
}

// Whole-word match (unicode-aware) — prevents "spa" matching "España",
// "bar" matching "Barcelona", "inn" matching "Innsbruck", etc.
function textHasWord(text, word) {
    const esc = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return new RegExp(`(?<![\\p{L}\\p{N}])${esc}(?![\\p{L}\\p{N}])`, 'iu').test(text);
}

// Auto-category keyword detection
const CATEGORY_RULES = [
        { cat: 'Hotel',               words: ['hotel','inn','hostel','auberge','b&b','bed and breakfast','lodge','motel','guesthouse','pension','resort','riad'] },
        { cat: 'Restaurant',          words: ['restaurant','restaurante','ristorante','brasserie','bistro','pizzeria','trattoria','sushi','steakhouse','tavern','eatery','diner','grill','cantina','bodega','kebab','burger','noodle','ramen','barbeque','bbq','creperie','crêperie','winery','brewery','lunch','lunchroom'] },
        { cat: 'Café / Bar',          words: ['café','cafe','coffee','tea room','tearoom','patisserie','pâtisserie','bakery','boulangerie','bar','pub','tavern','cocktail','lounge','wine bar','brasserie café','kiosk','brunch','breakfast'] },
        { cat: 'Museum / Gallery',    words: ['museum','musée','gallery','galerie','exhibition','art center','moma','louvre','tate','guggenheim','kunsthalle'] },
        { cat: 'Monument / Landmark', words: ['castle','château','palace','cathedral','church','basilica','abbey','chapel','mosque','temple','synagogue','monument','memorial','statue','tower','fort','ruins','archaeological','heritage'] },
        { cat: 'Activity',            words: ['hiking','kayak','surf','dive','climb','zipline','tour','walk','cycle','bike','ski','snowboard','escape room','cooking class','workshop','boat','sailing'] },
        { cat: 'Beach',               words: ['beach','plage','strand','cove','bay','costa','praia'] },
        { cat: 'Nature',              words: ['park','garden','forest','lake','waterfall','canyon','valley','reserve','national park','botanical','jardin','nature'] },
        { cat: 'Viewpoint',           words: ['viewpoint','belvedere','mirador','panorama','lookout','observation','terrace','rooftop view'] },
        { cat: 'Market',              words: ['market','marché','mercado','bazaar','souk','flea market','farmers market','brocante'] },
        { cat: 'Spa / Wellness',      words: ['spa','wellness','thermal','hammam','sauna','massage','yoga','retreat','fitness'] },
        { cat: 'Entertainment',       words: ['cinema','theatre','theater','concert','stadium','arena','zoo','aquarium','theme park','amusement','circus','casino','bowling','escape'] },
        { cat: 'Shopping',            words: ['shopping','mall','boutique','shop','store','outlet','market street','supermarket'] },
        { cat: 'Parking / Fuel',      words: ['parking','garage','petrol','fuel','gas station','station service'] },
        { cat: 'City / Region',       words: ['city','town','village','district','neighbourhood','quarter','arrondissement','region'] },
];

// True if a string looks like a street address (e.g. "22 Rue Antoine Meyer, 2153 Luxembourg")
// rather than a place name — starts with a house number or contains a postal code.
function looksLikeAddress(str) {
    if (!str) return false;
    const s = str.trim();
    return /^\d+[\s,]/.test(s) || /\b\d{4,6}\b/.test(s);
}

function detectCategory(name, address) {
    const text = (name + ' ' + (address || '')).toLowerCase();
    for (const rule of CATEGORY_RULES) {
        if (rule.words.some(w => textHasWord(text, w))) return rule.cat;
    }
    return 'Other';
}

// One-time repair: earlier versions matched keywords as substrings, so e.g.
// "Spa" was detected inside "España". Re-detect only the places whose stored
// category equals what the buggy matcher would have produced (i.e. it was
// auto-assigned, not chosen by the user).
(function repairMisdetectedCategories() {
    if (localStorage.getItem('mapfolio_catfix_v1')) return;
    function legacyDetect(name, address) {
        const text = (name + ' ' + (address || '')).toLowerCase();
        for (const rule of CATEGORY_RULES) {
            if (rule.words.some(w => text.includes(w))) return rule.cat;
        }
        return 'Other';
    }
    let changed = false;
    allPlaces.forEach(p => {
        if (p.address === 'Imported via KMZ metadata layer.') { p.address = ''; changed = true; }
        const t = triageData[p.id];
        if (!t) return;
        const legacy = legacyDetect(p.name, p.address);
        if (t.category === legacy) {
            const fresh = detectCategory(p.name, p.address);
            if (fresh !== legacy) { t.category = fresh; changed = true; }
        }
    });
    if (changed) saveState();
    localStorage.setItem('mapfolio_catfix_v1', 'true');
})();

function saveState() {
    localStorage.setItem('mapfolio_places', JSON.stringify(allPlaces));
    localStorage.setItem('mapfolio_triage', JSON.stringify(triageData));
    localStorage.setItem('mapfolio_folders', JSON.stringify(customFolders));
    localStorage.setItem('mapfolio_custom_categories', JSON.stringify(customCategories));
}

// ── Empty state & Demo data ───────────────────────────────────────────────

const DEMO_PLACES = [
    { id:'demo-1',  name:'Eiffel Tower',          address:'Champ de Mars, Paris, France',              url:'https://maps.google.com/?q=Eiffel+Tower',       lat:48.85837, lng:2.29448  },
    { id:'demo-2',  name:'Sagrada Família',        address:'Carrer de Mallorca, Barcelona, Spain',       url:'https://maps.google.com/?q=Sagrada+Familia',    lat:41.40363, lng:2.17435  },
    { id:'demo-3',  name:'Colosseum',              address:'Piazza del Colosseo, Rome, Italy',           url:'https://maps.google.com/?q=Colosseum+Rome',     lat:41.89021, lng:12.49223 },
    { id:'demo-4',  name:'Acropolis of Athens',    address:'Athens, Greece',                             url:'https://maps.google.com/?q=Acropolis+Athens',   lat:37.97154, lng:23.72647 },
    { id:'demo-5',  name:'Louvre Museum',          address:'Rue de Rivoli, Paris, France',               url:'https://maps.google.com/?q=Louvre+Museum',      lat:48.86063, lng:2.33751  },
    { id:'demo-6',  name:'Park Güell',             address:'Carrer d\'Olot, Barcelona, Spain',           url:'https://maps.google.com/?q=Park+Guell',         lat:41.41451, lng:2.15243  },
    { id:'demo-7',  name:'Trevi Fountain',         address:'Piazza di Trevi, Rome, Italy',               url:'https://maps.google.com/?q=Trevi+Fountain',     lat:41.90086, lng:12.48326 },
    { id:'demo-8',  name:'Rijksmuseum',            address:'Museumstraat 1, Amsterdam, Netherlands',     url:'https://maps.google.com/?q=Rijksmuseum',        lat:52.36004, lng:4.88530  },
    { id:'demo-9',  name:'Alhambra',               address:'Calle Real de la Alhambra, Granada, Spain',  url:'https://maps.google.com/?q=Alhambra+Granada',   lat:37.17605, lng:-3.58826 },
    { id:'demo-10', name:'Santorini Caldera',      address:'Oia, Santorini, Greece',                     url:'https://maps.google.com/?q=Santorini+Caldera',  lat:36.46199, lng:25.37662 },
    { id:'demo-11', name:'Café A Brasileira',      address:'Rua Garrett 120, Lisbon, Portugal',          url:'https://maps.google.com/?q=Cafe+A+Brasileira',  lat:38.71141, lng:-9.14246 },
    { id:'demo-12', name:'Vondelpark',             address:'Vondelpark, Amsterdam, Netherlands',         url:'https://maps.google.com/?q=Vondelpark',         lat:52.35820, lng:4.86817  },
];

const DEMO_TRIAGE = {
    'demo-1':  { category:'Monument / Landmark', status:'Loved It',    folder:'Europe Favourites' },
    'demo-2':  { category:'Monument / Landmark', status:'Want to Go',  folder:'Spain Trip'        },
    'demo-3':  { category:'Monument / Landmark', status:'Been There',  folder:'Italy'             },
    'demo-4':  { category:'Monument / Landmark', status:'Want to Go',  folder:'Greece Dreams'     },
    'demo-5':  { category:'Museum / Gallery',    status:'Loved It',    folder:'Europe Favourites' },
    'demo-6':  { category:'Activity',            status:'Want to Go',  folder:'Spain Trip'        },
    'demo-7':  { category:'Monument / Landmark', status:'Loved It',    folder:'Italy'             },
    'demo-8':  { category:'Museum / Gallery',    status:'Want to Go',  folder:'Europe Favourites' },
    'demo-9':  { category:'Monument / Landmark', status:'Been There',  folder:'Spain Trip'        },
    'demo-10': { category:'Viewpoint',           status:'Favourite',   folder:'Greece Dreams'     },
    'demo-11': { category:'Café / Bar',          status:'Loved It',    folder:'Portugal'          },
    'demo-12': { category:'Nature',              status:'Been There',  folder:'Europe Favourites' },
};

const DEMO_FOLDERS = ['Europe Favourites', 'Spain Trip', 'Italy', 'Greece Dreams', 'Portugal'];
const DEMO_IDS = new Set(DEMO_PLACES.map(p => p.id));

function isDemoActive() {
    return localStorage.getItem('mapfolio_demo') === 'true';
}

function updateEmptyState() {
    const empty = document.getElementById('empty-state');
    const clearBtn = document.getElementById('clear-demo-btn');
    if (!empty) return;

    if (allPlaces.length === 0) {
        empty.classList.remove('hidden');
    } else {
        empty.classList.add('hidden');
    }

    if (clearBtn) {
        clearBtn.classList.toggle('hidden', !isDemoActive());
    }
}

function loadDemo() {
    // Add demo places & triage (don't overwrite user's real ones)
    DEMO_PLACES.forEach(p => {
        if (!allPlaces.find(x => x.id === p.id)) allPlaces.push(p);
    });
    Object.assign(triageData, DEMO_TRIAGE);

    // Add demo folders
    DEMO_FOLDERS.forEach(f => {
        if (!customFolders.includes(f)) customFolders.push(f);
    });

    localStorage.setItem('mapfolio_demo', 'true');
    saveState();
    populateDropdowns();
    applyFiltersAndRender();
    updateEmptyState();
    showImportToast('✨ Demo places loaded! Explore the map.');

    // Fly to Europe
    if (map) map.flyTo([48.0, 10.0], 4, { duration: 1.5 });
}

function clearDemo() {
    allPlaces = allPlaces.filter(p => !DEMO_IDS.has(p.id));
    DEMO_IDS.forEach(id => delete triageData[id]);
    DEMO_FOLDERS.forEach(f => {
        customFolders = customFolders.filter(x => x !== f);
    });
    localStorage.removeItem('mapfolio_demo');
    saveState();
    populateDropdowns();
    applyFiltersAndRender();
    updateEmptyState();
    showImportToast('Demo places cleared.');
}

document.getElementById('load-demo-btn')?.addEventListener('click', loadDemo);
document.getElementById('clear-demo-btn')?.addEventListener('click', clearDemo);

function populateDropdowns() {
    const selects = [
        document.getElementById('filter-category'),
        document.getElementById('triage-category')
    ];

    selects.forEach((select, i) => {
        const current = select.value;
        select.innerHTML = i === 0 ? '<option value="All">All Categories</option>' : '<option value="Unassigned">Select a Category</option>';

        Object.keys(categoryConfig).forEach(name => {
            const opt = document.createElement('option');
            opt.value = name;
            opt.textContent = `${categoryConfig[name].emoji} ${name}`;
            select.appendChild(opt);
        });
        // Custom categories
        customCategories.forEach(cc => {
            const opt = document.createElement('option');
            opt.value = cc.name;
            opt.textContent = `${cc.emoji} ${cc.name}`;
            select.appendChild(opt);
        });
        if (current) select.value = current;
    });

    const triageFolderSelect = document.getElementById('triage-folder');
    const selectedFolderValue = triageFolderSelect.value;
    triageFolderSelect.innerHTML = '<option value="Uncategorized">Uncategorized / General</option>';
    customFolders.forEach(folder => {
        const opt = document.createElement('option');
        opt.value = folder;
        opt.textContent = `📁 ${folder}`;
        triageFolderSelect.appendChild(opt);
    });
    if (selectedFolderValue) triageFolderSelect.value = selectedFolderValue;
}

function initMap() {
    const savedTheme = localStorage.getItem('mapfolio_theme') || 'light';
    document.documentElement.setAttribute('data-theme', savedTheme);

    map = L.map('map').setView([0, 0], 2);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '© OpenStreetMap contributors'
    }).addTo(map);

    clusterGroup = L.markerClusterGroup({
        maxClusterRadius: 50,
        spiderfyOnMaxZoom: true,
        showCoverageOnHover: false,
        zoomToBoundsOnClick: true
    });
    map.addLayer(clusterGroup);

    populateDropdowns();
    renderFoldersList();

    if (allPlaces.length > 0) {
        applyFiltersAndRender();
        fitMapToBounds();
    } else {
        updateEmptyState();
        renderRecentlyAdded();
    }

    renderSavedTripsList();
    restoreActiveTrip();

    // Recalculate map size after CSS layout settles (fixes topbar offset)
    setTimeout(() => map && map.invalidateSize(), 100);
}

// REPLACE YOUR ENTIRE fileUpload LISTENER WITH THIS
if (fileUpload) {
    fileUpload.addEventListener('change', async function(e) {
        const files = Array.from(e.target.files);
        if (!files.length) return;

        for (const file of files) {
            const ext = file.name.split('.').pop().toLowerCase();
            
            if (ext === 'kmz') {
                try {
                    // Unpack compressed archive via JSZip binary array
                    const zip = await JSZip.loadAsync(file);
                    const kmlFile = Object.keys(zip.files).find(fileName => fileName.endsWith('.kml'));
                    if (kmlFile) {
                        const kmlText = await zip.files[kmlFile].async("string");
                        processKMLText(kmlText, file.name.replace('.kmz', ''));
                    }
                } catch (err) {
                    console.error("Error unpacking KMZ archive layer:", err);
                    showImportToast("Failed to process KMZ archive package.");
                }
            } else {
                // RUNS ORIGINAL LOGIC FOR ALL CSV & JSON FILES
                const text = await readFileAsText(file);
                if (ext === 'csv') {
                    processCSV(text, file.name.replace('.csv',''));
               } else if (ext === 'json') {
    const data = JSON.parse(text);
    const folderName = file.name.replace('.json', '');
    if (Array.isArray(data)) {
        processGeocodedJSON(data, folderName);
    } else if (data.features && Array.isArray(data.features)) {
        // Google Takeout GeoJSON (Saved Places, Reviews, etc.)
        const normalized = data.features.map(f => {
            const props = f.properties || {};
            const url = props.google_maps_url || '#';

            // --- Name ---
            let name = props.location?.name || props.name || '';
            if (!name) {
                // Try to extract from ?q=Place+Name&ftid= pattern
                const qMatch = url.match(/[?&]q=([^&]+)/);
                if (qMatch) {
                    const decoded = decodeURIComponent(qMatch[1].replace(/\+/g, ' '));
                    // If it looks like coordinates (numbers, comma), skip as name
                    if (!/^-?\d+\.?\d*,-?\d+\.?\d*$/.test(decoded.trim())) {
                        name = decoded;
                    }
                }
            }
            if (!name) name = 'Unnamed Place';

            // --- Coordinates ---
            let lat = f.geometry?.coordinates?.[1] ?? 0;
            let lng = f.geometry?.coordinates?.[0] ?? 0;
            if ((lat === 0 && lng === 0) || isNaN(lat) || isNaN(lng)) {
                // Try ?q=lat,lng from URL
                const coordMatch = url.match(/[?&]q=(-?\d+\.?\d*),(-?\d+\.?\d*)(?:&|$)/);
                if (coordMatch) {
                    lat = parseFloat(coordMatch[1]);
                    lng = parseFloat(coordMatch[2]);
                }
            }

            // --- Status from star rating (Reviews.json) ---
            let status = 'Been There';
            const stars = props.five_star_rating_published;
            if (stars !== undefined) {
                if (stars >= 5) status = 'Loved It';
                else if (stars === 4) status = 'Been There';
                else if (stars === 3) status = 'Meh';
                else if (stars <= 2) status = 'Skip It';
            }

            return { name, address: props.location?.address || '', url, lat, lng, status };
        }).filter(f => f.name !== 'Unnamed Place' || (f.lat !== 0 && f.lng !== 0));

        processGeocodedJSON(normalized, folderName);
    }
}
            }
        }
        fileUpload.value = '';
    });
}
// ADD THIS NEW FUNCTION SEPARATELY IN SCRIPT.JS
function processKMLText(xmlText, contextName) {
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(xmlText, "text/xml");
    const placemarks = xmlDoc.getElementsByTagName("Placemark");
    let importedCount = 0;

    // REPLACE THE INSIDE OF YOUR processKMLText FOR-EACH LOOP WITH THIS:
Array.from(placemarks).forEach((pm, i) => {
    const nameEl = pm.getElementsByTagName("name")[0];
    const name = nameEl ? nameEl.textContent.trim() : `KMZ Place ${i+1}`;
    
    const isDuplicate = allPlaces.some(p =>
        p.name.toLowerCase().trim() === name.toLowerCase().trim() &&
        triageData[p.id]?.folder === contextName
    );
    if (isDuplicate) return;

    let lat = 0, lng = 0;
    const coordEl = pm.getElementsByTagName("coordinates")[0];
    if (coordEl) {
        const coordsStr = coordEl.textContent.trim().split(/\s+/)[0];
        const parts = coordsStr.split(',');
        if (parts.length >= 2) {
            lng = parseFloat(parts[0]);
            lat = parseFloat(parts[1]);
        }
    }

    const descriptionEl = pm.getElementsByTagName("description")[0];
    let address = descriptionEl ? descriptionEl.textContent.trim() : '';

    // Some exports only give us an address as the "name" (no separate
    // address field) — mirror it into the address field too.
    if (!address && looksLikeAddress(name)) address = name;

    const placeId = `kmz-${contextName}-${i}-${Date.now()}`;

    // AUTOMATIC FILE-TO-FOLDER ASSIGNMENT
    if (!customFolders.includes(contextName)) {
        customFolders.push(contextName);
    }
    triageData[placeId] = {
        category: detectCategory(name, address),
        status: 'Unsorted',
        folder: contextName
    };

    const finalLat = isNaN(lat) ? 0 : lat;
    const finalLng = isNaN(lng) ? 0 : lng;

    allPlaces.push({
        id: placeId,
        name: name,
        address: address || '',
        url: '#',
        lat: finalLat,
        lng: finalLng
    });
    importedCount++;

    // No coordinates in the KML — geocode by name via the queue, like CSV/JSON imports
    if (finalLat === 0 && finalLng === 0) {
        geocodePlace(name, (result) => {
            if (result) {
                const idx = allPlaces.findIndex(p => p.id === placeId);
                if (idx >= 0) {
                    const rLat = parseFloat(result.lat);
                    const rLng = parseFloat(result.lon);
                    allPlaces[idx].lat = rLat;
                    allPlaces[idx].lng = rLng;
                    if (isFarFromFolder(contextName, placeId, rLat, rLng)) {
                        triageData[placeId].needsReview = true;
                    }
                    saveState();
                    applyFiltersAndRender();
                }
            }
        }, contextName);
    }
});

    saveState();
    populateDropdowns();
    applyFiltersAndRender();
    fitMapToBounds();
    showImportToast(`KMZ Unpacked: Processed ${importedCount} non-duplicate pins.`);
}
function readFileAsText(file) {
    return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = e => resolve(e.target.result);
        reader.readAsText(file);
    });
}

// RFC-4180 compliant CSV parser — handles quoted fields, embedded commas, and newlines
function parseCSVLine(line) {
    const result = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        if (ch === '"') {
            if (inQuotes && line[i + 1] === '"') {
                current += '"';
                i++;
            } else {
                inQuotes = !inQuotes;
            }
        } else if (ch === ',' && !inQuotes) {
            result.push(current.trim());
            current = '';
        } else {
            current += ch;
        }
    }
    result.push(current.trim());
    return result;
}

// Geocode queue — sends 1 request per second through CORS proxy to avoid rate limiting
const geocodeQueue = [];
let geocodeRunning = false;

// Folder names that don't represent a real place and shouldn't be used as geocoding context
const GENERIC_FOLDER_NAMES = new Set([
    'imported', 'uncategorized', 'unsorted', 'wishlist', 'favorites', 'favourites',
    'saved places', 'want to go', 'starred places', 'my places', 'done'
]);

// Generate progressively simpler query variants for stubborn place names.
// If contextName looks like a real place (e.g. a city/folder name), try it first
// to keep generic place names (e.g. "Place de la République") in the right region.
function queryVariants(name, contextName) {
    const variants = [];
    if (contextName && !GENERIC_FOLDER_NAMES.has(contextName.trim().toLowerCase())) {
        variants.push(`${name}, ${contextName.trim()}`);
    }
    variants.push(name);
    // After " - " keep only the second part (e.g. "OUTDOOR - Glacier Canyon" → "Glacier Canyon")
    if (name.includes(' - ')) variants.push(name.split(' - ').pop().trim());
    // Before " - " (e.g. "Café du Coin - Paris" → "Café du Coin")
    if (name.includes(' - ')) variants.push(name.split(' - ')[0].trim());
    // Drop text after "By ", "by " (e.g. "Omeraki. By Alberto Chicote." → "Omeraki")
    variants.push(name.replace(/[.,]\s*[Bb]y\s.+$/, '').trim());
    // Drop text after first comma (e.g. "Centre De Recreation, Belvaux" → "Centre De Recreation")
    if (name.includes(',')) variants.push(name.split(',')[0].trim());
    // First 3 words only
    const words = name.split(/\s+/);
    if (words.length > 3) variants.push(words.slice(0, 3).join(' '));
    // Remove special chars / punctuation
    variants.push(name.replace(/[.\-–]/g, ' ').replace(/\s+/g, ' ').trim());
    // Extract from Google Maps URL if available (decoded place name)
    return [...new Set(variants.filter(v => v.length > 2))];
}

function geocodePlace(query, callback, contextName) {
    geocodeQueue.push({ query, callback, contextName });
    if (!geocodeRunning) runGeocodeQueue();
}

// ── Distance helpers for "needs review" detection ─────────────────────────
// Note: haversineKm({lat,lng}, {lat,lng}) is defined further below (used by trip planner)
const NEEDS_REVIEW_DISTANCE_KM = 300;

// Centroid of already-pinned, non-flagged places in a folder. Needs at least
// 2 reference points before we trust it enough to flag outliers.
function getFolderCentroid(folderName, excludeId) {
    const pts = allPlaces.filter(p =>
        p.id !== excludeId &&
        (p.lat !== 0 || p.lng !== 0) &&
        triageData[p.id]?.folder === folderName &&
        !triageData[p.id]?.needsReview
    );
    if (pts.length < 2) return null;
    const lat = pts.reduce((s, p) => s + p.lat, 0) / pts.length;
    const lng = pts.reduce((s, p) => s + p.lng, 0) / pts.length;
    return { lat, lng };
}

// Returns true if (lat, lng) is implausibly far from the rest of its folder
function isFarFromFolder(folderName, placeId, lat, lng) {
    const centroid = getFolderCentroid(folderName, placeId);
    if (!centroid) return false;
    return haversineKm({ lat, lng }, centroid) > NEEDS_REVIEW_DISTANCE_KM;
}

function fetchWithTimeout(url, options = {}, ms = 5000) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), ms);
    return fetch(url, { ...options, signal: ctrl.signal })
        .finally(() => clearTimeout(timer));
}

async function tryGeocode(q) {
    // Try Nominatim first
    try {
        const res = await fetchWithTimeout(`https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(q)}`, { headers: { 'Accept-Language': 'en' } });
        const data = await res.json();
        if (data?.length > 0) return { lat: data[0].lat, lon: data[0].lon };
    } catch(e) {}
    // Fallback: Photon
    try {
        const res = await fetchWithTimeout(`https://photon.komoot.io/api/?q=${encodeURIComponent(q)}&limit=1`);
        const data = await res.json();
        if (data?.features?.length > 0) {
            const [lon, lat] = data.features[0].geometry.coordinates;
            return { lat, lon };
        }
    } catch(e) {}
    return null;
}

function runGeocodeQueue() {
    if (geocodeQueue.length === 0) { geocodeRunning = false; return; }
    geocodeRunning = true;
    const { query, callback, contextName } = geocodeQueue.shift();
    const variants = queryVariants(query, contextName);

    // Try each variant in sequence until one succeeds
    (async () => {
        for (const v of variants) {
            const result = await tryGeocode(v);
            if (result) { callback(result); return; }
            await new Promise(r => setTimeout(r, 300)); // small gap between variants
        }
        callback(null);
    })().finally(() => { setTimeout(runGeocodeQueue, 1100); });
}

function processCSV(text, filenameContext) {
    const lines = text.trim().split('\n');
    if (lines.length < 2) return;

    // Some Google Maps exports prefix the CSV with a list title line before
    // the real header row — scan the first few lines to find the header.
    let headerRowIdx = 0;
    for (let i = 0; i < Math.min(5, lines.length); i++) {
        const candidate = lines[i].split(',').map(h => h.trim().toLowerCase().replace(/"/g, ''));
        const hasName = candidate.some(h => h.includes('name') || h.includes('title'));
        const hasUrl = candidate.some(h => h.includes('url'));
        if (hasName && hasUrl) { headerRowIdx = i; break; }
    }

    const headers = lines[headerRowIdx].split(',').map(h => h.trim().toLowerCase().replace(/"/g, ''));
    const nameIdx = headers.findIndex(h => h.includes('name') || h.includes('title'));
    const latIdx = headers.findIndex(h => h.includes('lat'));
    const lngIdx = headers.findIndex(h => h.includes('lon') || h.includes('lng'));
    const addrIdx = headers.findIndex(h => h.includes('addr') || h.includes('address'));
    const urlIdx = headers.findIndex(h => h.includes('url'));
    const wktIdx = headers.findIndex(h => h === 'wkt' || h.includes('geometry') || h.includes('wkt'));

    lines.slice(headerRowIdx + 1).forEach((line, i) => {
        if (!line.trim() || line.replace(/,/g, '').trim() === '') return;

        const cols = parseCSVLine(line);
        if (cols.length === 0 || !cols[nameIdx]) return;

        let lat = latIdx >= 0 ? parseFloat(cols[latIdx]) : NaN;
        let lng = lngIdx >= 0 ? parseFloat(cols[lngIdx]) : NaN;

        // Try WKT column
        if ((isNaN(lat) || isNaN(lng)) && wktIdx >= 0 && cols[wktIdx]) {
            const wktMatch = cols[wktIdx].match(/POINT\s*\(\s*([-\d.]+)\s+([-\d.]+)\s*\)/i);
            if (wktMatch) {
                lng = parseFloat(wktMatch[1]);
                lat = parseFloat(wktMatch[2]);
            }
        }

        const name = cols[nameIdx];
        let address = addrIdx >= 0 ? cols[addrIdx] : '';
        const url = urlIdx >= 0 ? cols[urlIdx] : '#';

        // Some exports only give us an address as the "name" (no separate
        // address column) — mirror it into the address field too.
        if (!address && looksLikeAddress(name)) address = name;

        const isDuplicate = allPlaces.some(p =>
            p.name.toLowerCase().trim() === name.toLowerCase().trim() &&
            triageData[p.id]?.folder === filenameContext
        );
        if (isDuplicate) return;

        const placeId = `imported-${filenameContext}-${i}-${Date.now()}`;

        if (!customFolders.includes(filenameContext)) {
            customFolders.push(filenameContext);
        }
        triageData[placeId] = {
            category: detectCategory(name, address),
            status: 'Unsorted',
            folder: filenameContext
        };

        // Try URL coordinates
        if (isNaN(lat) || isNaN(lng) || lat === 0) {
            const coordMatch = url.match(/\/@([-\d.]+),([-\d.]+),\d+z\//);
            if (coordMatch) {
                lat = parseFloat(coordMatch[1]);
                lng = parseFloat(coordMatch[2]);
            }
        }

        // If we have coordinates now, push immediately
        if (!isNaN(lat) && !isNaN(lng) && lat !== 0) {
            allPlaces.push({ id: placeId, name, address, url, lat, lng });
            return;
        }

        // No coordinates — add as unpinned placeholder, then geocode via queue
        allPlaces.push({ id: placeId, name, address, url, lat: 0, lng: 0 });

        geocodePlace(name, (result) => {
            if (result) {
                const idx = allPlaces.findIndex(p => p.id === placeId);
                if (idx >= 0) {
                    const rLat = parseFloat(result.lat);
                    const rLng = parseFloat(result.lon);
                    allPlaces[idx].lat = rLat;
                    allPlaces[idx].lng = rLng;
                    if (isFarFromFolder(filenameContext, placeId, rLat, rLng)) {
                        triageData[placeId].needsReview = true;
                    }
                    saveState();
                    applyFiltersAndRender();
                }
            }
        }, filenameContext);
    });

    saveState();
    populateDropdowns();
    applyFiltersAndRender();
    fitMapToBounds();
    showImportToast(`Import processing complete.`);
}
function processGeocodedJSON(data, folderName) {
    folderName = folderName || 'Imported';
    if (!customFolders.includes(folderName)) customFolders.push(folderName);

    let importedCount = 0;
    data.forEach((item, i) => {
        const name = item.name || 'Unnamed Place';
        const url = item.url || '#';

        // Deduplicate by URL or by name+folder
        const isDuplicate =
            (url !== '#' && allPlaces.some(p => p.url === url)) ||
            allPlaces.some(p => p.name.toLowerCase().trim() === name.toLowerCase().trim() && triageData[p.id]?.folder === folderName);
        if (isDuplicate) return;

        const lat = parseFloat(item.lat || item.coordinates?.lat || 0);
        const lng = parseFloat(item.lng || item.coordinates?.lng || 0);
        const placeId = item.id || `json-${folderName}-${i}-${Date.now()}`;

        // Some exports only give us an address as the "name" (no separate
        // address field) — mirror it into the address field too.
        let address = item.address || item.notes || '';
        if (!address && looksLikeAddress(name)) address = name;

        allPlaces.push({
            id: placeId,
            name,
            address,
            url,
            lat: isNaN(lat) ? 0 : lat,
            lng: isNaN(lng) ? 0 : lng
        });

        triageData[placeId] = {
            category: detectCategory(name, address),
            status: item.status || 'Unsorted',
            folder: folderName
        };

        // Geocode if no coordinates
        if (!lat || !lng) {
            geocodePlace(name, (result) => {
                if (result) {
                    const idx = allPlaces.findIndex(p => p.id === placeId);
                    if (idx >= 0) {
                        const rLat = parseFloat(result.lat);
                        const rLng = parseFloat(result.lon);
                        allPlaces[idx].lat = rLat;
                        allPlaces[idx].lng = rLng;
                        if (isFarFromFolder(folderName, placeId, rLat, rLng)) {
                            triageData[placeId].needsReview = true;
                        }
                        saveState();
                        applyFiltersAndRender();
                    }
                }
            }, folderName);
        }

        importedCount++;
    });
    saveState();
    populateDropdowns();
    applyFiltersAndRender();
    fitMapToBounds();
    showImportToast(`Imported ${importedCount} new places from JSON (${data.length - importedCount} skipped).`);
}

function renderFoldersList() {
    const listEl = document.getElementById('folders-list');
    if (!listEl) return;
    listEl.innerHTML = '';

    const folderSearchInput = document.getElementById('folder-search-input');
    const searchFolderTerm = folderSearchInput ? folderSearchInput.value.toLowerCase().trim() : '';

    // Calculate place quantities dynamically per folder context
    const folderCounts = {};
    customFolders.forEach(f => folderCounts[f] = 0);
    folderCounts['Uncategorized'] = 0;

    allPlaces.forEach(place => {
        const data = triageData[place.id];
        const assignedFolder = (data && data.folder) ? data.folder : 'Uncategorized';
        if (folderCounts[assignedFolder] !== undefined) {
            folderCounts[assignedFolder]++;
        } else {
            folderCounts[assignedFolder] = 1;
        }
    });

    // Alphabetical order; show the first few, expand on demand.
    // While searching, every match is shown regardless of the cap.
    const sortedFolders = [...customFolders].sort((a, b) => a.localeCompare(b));
    const matching = sortedFolders.filter(f => searchFolderTerm === '' || f.toLowerCase().includes(searchFolderTerm));
    const visibleFolders = (searchFolderTerm !== '' || foldersShowAll)
        ? matching
        : matching.slice(0, FOLDERS_VISIBLE_LIMIT);

    visibleFolders.forEach((folder) => {
        const index = customFolders.indexOf(folder);
        const count = folderCounts[folder] || 0;
        const li = document.createElement('li');
        li.className = 'folder-item';
        li.style.cursor = 'pointer';

        li.innerHTML = `
            <span class="folder-name-text">
                <span class="folder-icon"><i class="ti ti-folder" aria-hidden="true"></i></span>
                <span class="folder-name-label" title="${folder}">${folder}</span>
                <strong class="folder-name-count" style="opacity: 0.7; font-size: 0.85em; flex-shrink: 0;">(${count})</strong>
            </span>
            <div class="folder-actions" style="display:flex; gap:0.25rem;">
                <button class="bulk-edit-folder-btn" data-folder="${folder}" title="Edit all places in this folder" style="background:none; border:none; cursor:pointer;">🏷️</button>
                <button class="rename-folder-btn" data-index="${index}" style="background:none; border:none; cursor:pointer;">✏️</button>
                <button class="delete-folder-btn" data-index="${index}" style="background:none; border:none; cursor:pointer;">🗑️</button>
            </div>
        `;
        if (activeFolderFilter === folder) {
            li.classList.add('active');
        }

        li.querySelector('.rename-folder-btn').addEventListener('click', (e) => {
            e.stopPropagation();
            const newName = prompt("Enter a new name for this folder:", folder);
            if (newName && newName.trim()) {
                const oldName = customFolders[index];
                customFolders[index] = newName.trim();
                for (let id in triageData) {
                    if (triageData[id].folder === oldName) triageData[id].folder = newName.trim();
                }
                if (activeFolderFilter === oldName) activeFolderFilter = newName.trim();
                saveState();
                applyFiltersAndRender();
                populateDropdowns();
            }
        });

        li.querySelector('.bulk-edit-folder-btn').addEventListener('click', (e) => {
            e.stopPropagation();
            openBulkEditModal(folder, count);
        });

        li.querySelector('.delete-folder-btn').addEventListener('click', (e) => {
            e.stopPropagation();
            if (confirm(`Delete folder "${folder}"?`)) {
                if (activeFolderFilter === folder) activeFolderFilter = null;
                customFolders.splice(index, 1);
                const idsToRemove = Object.keys(triageData).filter(id => triageData[id].folder === folder);
                idsToRemove.forEach(id => delete triageData[id]);
                allPlaces = allPlaces.filter(p => !idsToRemove.includes(p.id));
                saveState();
                populateDropdowns();
                applyFiltersAndRender();
            }
        });
        // ADD THIS CLICK LISTENER RIGHT INSIDE customFolders.forEach IN YOUR renderFoldersList FUNCTION:
// (Put it right before the final listEl.appendChild(li); statement)

li.addEventListener('click', () => {
    activeFolderFilter = (activeFolderFilter === folder) ? null : folder;
    updateActiveFolderLabel();
    renderFoldersList();
    applyFiltersAndRender();
});
        listEl.appendChild(li);
    });

    // "Show all / Show less" toggle when the list is capped
    if (searchFolderTerm === '' && matching.length > FOLDERS_VISIBLE_LIMIT) {
        const toggle = document.createElement('button');
        toggle.className = 'folders-show-all-btn';
        toggle.textContent = foldersShowAll
            ? '▴ Show less'
            : `▾ Show all ${matching.length} folders`;
        toggle.addEventListener('click', (e) => {
            e.stopPropagation();
            foldersShowAll = !foldersShowAll;
            renderFoldersList();
        });
        listEl.appendChild(toggle);
    }
}

document.getElementById('add-folder-btn').addEventListener('click', (e) => {
    e.stopPropagation();
    // Show inline input instead of prompt()
    const body = document.getElementById('folders-body');
    if (document.getElementById('new-folder-inline')) return; // already open
    const row = document.createElement('div');
    row.id = 'new-folder-inline';
    row.style.cssText = 'display:flex;gap:0.4rem;margin:0.4rem 0;';
    row.innerHTML = `
        <input id="new-folder-input" type="text" placeholder="Folder name…"
            style="flex:1;padding:0.45rem 0.6rem;border:1.5px solid var(--primary);border-radius:8px;background:var(--bg-main);color:var(--text-main);font-size:0.85rem;font-family:Inter,sans-serif;outline:none;"
            autocomplete="off" />
        <button id="new-folder-save" style="padding:0.45rem 0.75rem;background:var(--primary);color:#1c1917;border:none;border-radius:8px;font-weight:700;cursor:pointer;font-size:0.85rem;">✓</button>
        <button id="new-folder-cancel" style="padding:0.45rem 0.6rem;background:transparent;border:1px solid var(--border);border-radius:8px;cursor:pointer;font-size:0.85rem;color:var(--text-muted);">✕</button>
    `;
    body.insertBefore(row, body.firstChild);
    const input = document.getElementById('new-folder-input');
    input.focus();

    function saveNewFolder() {
        const name = input.value.trim();
        row.remove();
        if (name) {
            customFolders.push(name);
            saveState();
            renderFoldersList();
            populateDropdowns();
        }
    }
    function cancelNewFolder() { row.remove(); }

    document.getElementById('new-folder-save').addEventListener('click', (e) => { e.stopPropagation(); saveNewFolder(); });
    document.getElementById('new-folder-cancel').addEventListener('click', (e) => { e.stopPropagation(); cancelNewFolder(); });
    input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') saveNewFolder();
        if (e.key === 'Escape') cancelNewFolder();
    });
});

document.getElementById('theme-toggle').addEventListener('click', () => {
    const currentTheme = document.documentElement.getAttribute('data-theme') || 'light';
    const nextTheme = currentTheme === 'light' ? 'dark' : 'light';
    document.documentElement.setAttribute('data-theme', nextTheme);
    localStorage.setItem('mapfolio_theme', nextTheme);
});

function applyFiltersAndRender() {
    renderFoldersList();
    renderRecentlyAdded();
    tagCountries();
    scheduleOsmChecks();
    populateCountryFilter();

    const catFilter = document.getElementById('filter-category').value;
    const statFilter = document.getElementById('filter-status').value;
    const countryFilter = document.getElementById('filter-country')?.value || 'All';
    const searchTerm = document.getElementById('local-search-input').value.toLowerCase().trim();

    const filteredPlaces = allPlaces.filter(place => {
        const data = triageData[place.id] || { category: 'Other', status: 'Unsorted', folder: 'Uncategorized' };
        const matchCategory = catFilter === 'All' || data.category === catFilter;
        const matchStatus = statFilter === 'All' || data.status === statFilter;
        const matchCountry = countryFilter === 'All' || place.country === countryFilter;
        const matchSearch = searchTerm === '' || place.name.toLowerCase().includes(searchTerm) || (place.address || '').toLowerCase().includes(searchTerm);
        const matchFolder = activeFolderFilter === null || (data.folder || 'Uncategorized') === activeFolderFilter;
        return matchCategory && matchStatus && matchCountry && matchSearch && matchFolder;
    });

    renderMapPins(filteredPlaces);
    renderUnpinned();
    updateEmptyState();

    // Update footer count
    const footer = document.getElementById('places-footer');
    if (footer) {
        const total = allPlaces.length;
        const shown = filteredPlaces.filter(p => p.lat !== 0 || p.lng !== 0).length;
        footer.textContent = total === shown
            ? `📍 ${total.toLocaleString()} places`
            : `📍 Showing ${shown.toLocaleString()} of ${total.toLocaleString()} places`;
    }
}

const RECENT_ADDED_LIMIT = 5;

function formatRelativeDate(timestamp) {
    if (!timestamp) return '';
    const diffMs = Date.now() - timestamp;
    const diffDays = Math.floor(diffMs / 86400000);
    if (diffDays <= 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays}d ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`;
    return new Date(timestamp).toLocaleDateString();
}

function renderRecentlyAdded() {
    const section = document.getElementById('recent-added-section');
    const list = document.getElementById('recent-added-list');
    if (!section || !list) return;

    const recent = [...allPlaces]
        .filter(p => p.dateAdded)
        .sort((a, b) => b.dateAdded - a.dateAdded)
        .slice(0, RECENT_ADDED_LIMIT);

    if (recent.length === 0) {
        section.classList.add('hidden');
        return;
    }
    section.classList.remove('hidden');
    list.innerHTML = '';

    recent.forEach(place => {
        const data = triageData[place.id] || { category: 'Other' };
        const catConf = getCatConf(data.category);
        const li = document.createElement('li');
        li.className = 'recent-item';
        li.innerHTML = `
            <span class="recent-item-icon">${catConf.emoji}</span>
            <div class="recent-item-text">
                <div class="recent-item-name">${place.name}</div>
                <div class="recent-item-date">${formatRelativeDate(place.dateAdded)}</div>
            </div>
        `;
        li.addEventListener('click', () => {
            closeDrawer();
            openTriagePanel(place);
            if (place.lat !== 0 && place.lng !== 0) {
                map.flyTo([place.lat, place.lng], 14, { duration: 1.2 });
            }
        });
        list.appendChild(li);
    });
}

function renderUnpinned() {
    const unpinned = allPlaces.filter(p => p.lat === 0 && p.lng === 0);
    const section = document.getElementById('unpinned-section');
    const countEl = document.getElementById('unpinned-count');
    const list = document.getElementById('unpinned-list');

    if (unpinned.length === 0) {
        section.classList.add('hidden');
        return;
    }

    section.classList.remove('hidden');
    countEl.textContent = unpinned.length;
    list.innerHTML = '';

    unpinned.forEach(place => {
        const li = document.createElement('li');
        li.className = 'unpinned-item';
        li.innerHTML = `<span class="unpinned-name">${place.name}</span><button class="unpinned-edit-btn" title="Fix coordinates">✏️</button>`;
        li.querySelector('.unpinned-edit-btn').addEventListener('click', (e) => {
            e.stopPropagation();
            openTriagePanel(place);
        });
        list.appendChild(li);
    });
}

// kept for internal use only — not shown in sidebar anymore
function renderSidebarList(places) {
    const container = document.getElementById('places-list');
    if (!container) return;
    container.innerHTML = '';
    if (places.length === 0) {
        container.innerHTML = '<div class="empty-state">No places match the criteria.</div>';
        return;
    }
    places.forEach(place => {
        const data = triageData[place.id] || { category: 'Other', status: 'Unsorted' };
        const li = document.createElement('li');
        li.className = 'place-item';
        if (activePlace && activePlace.id === place.id) li.classList.add('active');

        const catConf = getCatConf(data.category);
        const statusClass = `status-${data.status.replace(/ /g, '-')}`;

        const missingCoordinatesBadge = (place.lat === 0 && place.lng === 0) ? ' <span style="color:var(--status-red); font-size:11px; font-weight:600;">⚠️ Unpinned</span>' : '';

        li.innerHTML = `
            <div class="place-status-indicator emoji-marker ${catConf.cssClass} ${statusClass}">${catConf.emoji}</div>
            <div class="place-details">
                <div class="place-name">${place.name}${missingCoordinatesBadge}</div>
                <div class="place-address">${place.address || 'No location metadata found.'}</div>
            </div>
        `;

        li.addEventListener('click', () => {
            openTriagePanel(place);
            if (place.lat !== 0 && place.lng !== 0) {
                map.flyTo([place.lat, place.lng], 14, { duration: 1.2 });
            }
            document.querySelectorAll('.place-item').forEach(el => el.classList.remove('active'));
            li.classList.add('active');
        });
        container.appendChild(li);
    });
}

function renderMapPins(places) {
    clusterGroup.clearLayers();
    markers = [];

    if (tripState.active) { renderTripMarkers(); return; }
    if (tripLayer) tripLayer.clearLayers();

    places.forEach(place => {
        if (place.lat === 0 && place.lng === 0) return;

        const data = triageData[place.id] || { category: 'Other', status: 'Unsorted' };
        const catConf = getCatConf(data.category);
        const statusClass = `status-${data.status.replace(/ /g, '-')}`;
        const reviewClass = data.needsReview ? 'needs-review' : '';

        const markerIcon = L.divIcon({
            className: 'custom-marker',
            html: `<div class="emoji-marker ${catConf.cssClass} ${statusClass} ${reviewClass}">${catConf.emoji}${data.needsReview ? '<span class="review-badge">⚠️</span>' : ''}</div>`,
            iconSize: [34, 34],
            iconAnchor: [17, 17]
        });

        const marker = L.marker([place.lat, place.lng], { icon: markerIcon });
        marker.on('click', () => { openTriagePanel(place); });

        clusterGroup.addLayer(marker);
        markers.push(marker);
    });
}

// ── AFFILIATE LINKS ───────────────────────────────────────────────────────────
// Replace these with your real partner IDs once approved
const AFFILIATE_IDS = {
    booking:       'YOUR_BOOKING_AID',    // booking.com affiliate partner ID
    getyourguide:  'YOUR_GYG_PARTNER_ID', // getyourguide partner ID
    viator:        'YOUR_VIATOR_ID',      // viator affiliate ID
};

function buildAffiliateLinks(place, category) {
    const q = encodeURIComponent(place.name + (place.address ? ' ' + place.address : ''));
    const links = [];

    if (['Hotel', 'City / Region'].includes(category)) {
        links.push({
            label: '🏨 Book on Booking.com',
            color: '#003580',
            url: `https://www.booking.com/search.html?ss=${q}&aid=${AFFILIATE_IDS.booking}`
        });
    }
    if (['Restaurant', 'Café / Bar', 'Market'].includes(category)) {
        links.push({
            label: '🍽️ Find on TheFork',
            color: '#00a896',
            url: `https://www.thefork.com/search#location=${q}`
        });
    }
    if (['Activity', 'Museum / Gallery', 'Monument / Landmark', 'Beach', 'Nature', 'Viewpoint', 'Entertainment'].includes(category)) {
        links.push({
            label: '🎟️ Book on GetYourGuide',
            color: '#ff6e17',
            url: `https://www.getyourguide.com/s/?q=${q}&partner_id=${AFFILIATE_IDS.getyourguide}`
        });
        links.push({
            label: '🗺️ Book on Viator',
            color: '#1a1a2e',
            url: `https://www.viator.com/search?text=${q}&mcid=${AFFILIATE_IDS.viator}`
        });
    }
    if (['Spa / Wellness'].includes(category)) {
        links.push({
            label: '💆 Find on Booking.com',
            color: '#003580',
            url: `https://www.booking.com/search.html?ss=${q}&aid=${AFFILIATE_IDS.booking}`
        });
    }
    return links;
}

function renderAffiliateBar(place, category) {
    const bar = document.getElementById('affiliate-bar');
    const links = buildAffiliateLinks(place, category);
    bar.innerHTML = '';
    if (links.length === 0) { bar.classList.add('hidden'); return; }
    bar.classList.remove('hidden');
    links.forEach(({ label, color, url }) => {
        const a = document.createElement('a');
        a.href = url;
        a.target = '_blank';
        a.rel = 'noopener noreferrer';
        a.textContent = label;
        a.style.cssText = `display:inline-block;padding:0.3rem 0.65rem;border-radius:6px;font-size:0.75rem;font-weight:600;text-decoration:none;color:#fff;background:${color};white-space:nowrap;`;
        bar.appendChild(a);
    });
}
// ── END AFFILIATE LINKS ───────────────────────────────────────────────────────

function openTriagePanel(place) {
    activePlace = place;
    const data = triageData[place.id] || { category: 'Other', status: 'Unsorted', folder: 'Uncategorized' };

    document.getElementById('triage-title').value = place.name;
    document.getElementById('triage-address').value = place.address;
    document.getElementById('triage-lat').value = place.lat === 0 ? '' : place.lat;
    document.getElementById('triage-lng').value = place.lng === 0 ? '' : place.lng;
    
    const urlBtn = document.getElementById('triage-url');
    // Generates link context using address/coordinates if fallback URL is missing
    if (!place.url || place.url === '#') {
        urlBtn.href = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(place.name + ' ' + place.address)}`;
    } else {
        urlBtn.href = place.url;
    }

    document.getElementById('triage-category').value = data.category;
    document.getElementById('triage-status').value = data.status;
    document.getElementById('triage-folder').value = data.folder || 'Uncategorized';

    document.getElementById('triage-panel').classList.remove('hidden');
    document.getElementById('delete-confirm').classList.add('hidden');
    document.getElementById('delete-place-btn').classList.remove('hidden');

    document.getElementById('needs-review-banner').classList.toggle('hidden', !data.needsReview);

    renderAffiliateBar(place, data.category);

    // Cancel any stale geocode from a previous panel, then auto-try if unpinned
    cancelGeocode();
    const hasAddress = place.address && place.address.trim().length > 2;
    const missingCoords = !place.lat && !place.lng || (place.lat === 0 && place.lng === 0);
    if (hasAddress && missingCoords) {
        setGeocodeStatus('loading', '🔍 Looking up coordinates…');
        geocodeDebounceTimer = setTimeout(() => runGeocode(place.address.trim()), 600);
    }
}

function closeTriage() {
    document.getElementById('triage-panel').classList.add('hidden');
    activePlace = null;
    applyFiltersAndRender();
}

// ── Auto-geocode address → lat/lng ────────────────────────────────────────
let geocodeDebounceTimer = null;
let geocodeAbortController = null;

function setGeocodeStatus(type, msg) {
    const el = document.getElementById('geocode-status');
    if (!el) return;
    if (!msg) { el.classList.add('hidden'); return; }
    el.className = `geocode-status ${type}`;
    el.classList.remove('hidden');
    el.textContent = msg;
}

function cancelGeocode() {
    clearTimeout(geocodeDebounceTimer);
    if (geocodeAbortController) { geocodeAbortController.abort(); geocodeAbortController = null; }
    setGeocodeStatus(null);
}

async function runGeocode(address) {
    const latEl = document.getElementById('triage-lat');
    const lngEl = document.getElementById('triage-lng');
    const latVal = latEl.value.trim();
    const lngVal = lngEl.value.trim();

    if (!address) { setGeocodeStatus(null); return; }

    // Don't overwrite coords the user typed manually
    const coordsEmpty = !latVal && !lngVal;
    const coordsMatchPlace = activePlace &&
        latVal === String(activePlace.lat) && lngVal === String(activePlace.lng);
    if (!coordsEmpty && !coordsMatchPlace) { setGeocodeStatus(null); return; }

    setGeocodeStatus('loading', '🔍 Looking up coordinates…');

    // Cancel any previous in-flight request
    if (geocodeAbortController) geocodeAbortController.abort();
    geocodeAbortController = new AbortController();
    const signal = geocodeAbortController.signal;

    // Build a list of queries to try in order:
    // 1. The address as-is
    // 2. The place name (from the title field) — great for landmarks
    // 3. Address with accents/special chars stripped
    const placeName = document.getElementById('triage-title')?.value?.trim() || '';
    const stripped = address.normalize('NFD').replace(/[̀-ͯ]/g, '');
    const queries = [...new Set([address, placeName, stripped].filter(Boolean))];

    // Try Nominatim (address/name). A failure here (network hiccup, rate
    // limiting, non-JSON response) shouldn't stop the Photon fallback below —
    // only re-throw if the request was deliberately cancelled.
    async function tryNominatim(q) {
        try {
            const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(q)}`;
            const res = await fetch(url, { headers: { 'Accept-Language': 'en' }, signal });
            const data = await res.json();
            if (data && data.length > 0) return { lat: data[0].lat, lon: data[0].lon };
        } catch (e) {
            if (e.name === 'AbortError') throw e;
        }
        return null;
    }

    // Try Photon (Komoot) — better POI coverage, no API key
    async function tryPhoton(q) {
        try {
            const url = `https://photon.komoot.io/api/?q=${encodeURIComponent(q)}&limit=1`;
            const res = await fetch(url, { signal });
            const data = await res.json();
            if (data && data.features && data.features.length > 0) {
                const [lon, lat] = data.features[0].geometry.coordinates;
                return { lat, lon };
            }
        } catch (e) {
            if (e.name === 'AbortError') throw e;
        }
        return null;
    }

    try {
        let found = null;

        // Round 1: try each query with Nominatim
        for (const q of queries) {
            found = await tryNominatim(q);
            if (found) break;
            await new Promise(x => setTimeout(x, 200));
        }

        // Round 2: if still nothing, try Photon with the same queries
        if (!found) {
            for (const q of queries) {
                found = await tryPhoton(q);
                if (found) break;
                await new Promise(x => setTimeout(x, 200));
            }
        }

        if (found) {
            const lat = parseFloat(found.lat);
            const lng = parseFloat(found.lon);
            latEl.value = lat;
            lngEl.value = lng;
            setGeocodeStatus('success', `✅ Found: ${lat.toFixed(5)}, ${lng.toFixed(5)}`);
        } else {
            setGeocodeStatus('error', '⚠️ Couldn\'t auto-locate — enter coordinates manually');
        }
    } catch (e) {
        if (e.name !== 'AbortError') {
            setGeocodeStatus('error', '⚠️ Lookup failed — enter coordinates manually');
        }
    }
}

// Trigger on user typing in the address field
document.getElementById('triage-address').addEventListener('input', () => {
    const address = document.getElementById('triage-address').value.trim();
    clearTimeout(geocodeDebounceTimer);
    if (!address) { setGeocodeStatus(null); return; }
    setGeocodeStatus('loading', '🔍 Looking up coordinates…');
    geocodeDebounceTimer = setTimeout(() => runGeocode(address), 700);
});

function updateTriageData() {
    if (!activePlace) return;
    triageData[activePlace.id] = {
        category: document.getElementById('triage-category').value,
        status: document.getElementById('triage-status').value,
        folder: document.getElementById('triage-folder').value
    };
    saveState();
}

document.getElementById('dismiss-review-btn').addEventListener('click', () => {
    if (!activePlace) return;
    if (triageData[activePlace.id]) delete triageData[activePlace.id].needsReview;
    saveState();
    document.getElementById('needs-review-banner').classList.add('hidden');
    applyFiltersAndRender();
});

// Fixed Update Engine Trigger
document.getElementById('save-coords-btn').addEventListener('click', () => {
    if (!activePlace) return;
    
    const inputtedLat = parseFloat(document.getElementById('triage-lat').value) || 0;
    const inputtedLng = parseFloat(document.getElementById('triage-lng').value) || 0;

    const matchedIdx = allPlaces.findIndex(p => p.id === activePlace.id);
    if (matchedIdx >= 0) {
        allPlaces[matchedIdx].lat = inputtedLat;
        allPlaces[matchedIdx].lng = inputtedLng;
        allPlaces[matchedIdx].name = document.getElementById('triage-title').value;
        allPlaces[matchedIdx].address = document.getElementById('triage-address').value;
    }

    updateTriageData();
    saveState();
    applyFiltersAndRender();

    if (inputtedLat !== 0 && inputtedLng !== 0) {
        map.flyTo([inputtedLat, inputtedLng], 14, { duration: 1.2 });
    }
    closeTriage();
    showImportToast("Changes saved!");
});

function fitMapToBounds() {
    const validBounds = allPlaces.filter(p => p.lat !== 0 && !isNaN(p.lat)).map(p => [p.lat, p.lng]);
    if (validBounds.length > 0 && map) {
        map.fitBounds(L.latLngBounds(validBounds), { padding: [50, 50], maxZoom: 15 });
    }
}

function showImportToast(message) {
    let toast = document.getElementById('import-toast');
    if (!toast) {
        toast = document.createElement('div');
        toast.id = 'import-toast';
        toast.className = 'import-toast';
        document.body.appendChild(toast);
    }
    toast.textContent = message;
    toast.classList.add('visible');
    setTimeout(() => toast.classList.remove('visible'), 3000);
}

document.getElementById('unpinned-header').addEventListener('click', (e) => {
    if (e.target.closest('#geocode-all-btn')) return;
    const list = document.getElementById('unpinned-list');
    list.classList.toggle('hidden');
});

document.getElementById('geocode-all-btn').addEventListener('click', (e) => {
    e.stopPropagation();
    const unpinned = allPlaces.filter(p => p.lat === 0 && p.lng === 0);
    if (unpinned.length === 0) return;
    // Reset queue state in case a previous run got stuck
    geocodeQueue.length = 0;
    geocodeRunning = false;
    const btn = e.currentTarget;
    btn.disabled = true;
    btn.textContent = `⏳ 0/${unpinned.length}`;
    let done = 0;
    unpinned.forEach(place => {
        // Mirror the triage panel logic: prefer address over name when available
        const hasAddress = place.address && place.address.trim().length > 2 && place.address.trim() !== place.name.trim();
        const query = hasAddress ? `${place.name} ${place.address.trim()}` : place.name;
        const placeFolder = triageData[place.id]?.folder;
        geocodePlace(query, (result) => {
            done++;
            btn.textContent = `⏳ ${done}/${unpinned.length}`;
            if (result) {
                const idx = allPlaces.findIndex(p => p.id === place.id);
                // Only write if the place still has no coordinates (don't overwrite manual fixes)
                if (idx !== -1 && allPlaces[idx].lat === 0 && allPlaces[idx].lng === 0) {
                    const rLat = parseFloat(result.lat);
                    const rLng = parseFloat(result.lon);
                    allPlaces[idx].lat = rLat;
                    allPlaces[idx].lng = rLng;
                    if (isFarFromFolder(placeFolder, place.id, rLat, rLng)) {
                        triageData[place.id].needsReview = true;
                    }
                }
            }
            // Save every 10 results so progress survives a reload
            if (done % 10 === 0) saveState();
            if (done === unpinned.length) {
                saveState();
                applyFiltersAndRender();
                btn.disabled = false;
                btn.textContent = '📍 Fix All';
                showImportToast(`Geocoded ${unpinned.length} places`);
            }
        }, placeFolder);
    });
});


document.getElementById('filter-category').addEventListener('change', applyFiltersAndRender);
document.getElementById('filter-status').addEventListener('change', applyFiltersAndRender);
document.getElementById('close-triage').addEventListener('click', closeTriage);

const EMOJI_PICKER_CHOICES = [
    '📌','⭐','❤️','🏠','🏨','🏛️','🏰','⛪','🕌','🗽',
    '🍽️','☕','🍷','🍕','🛍️','🎭','🎢','🎡','🎨','🎶',
    '🏖️','🏞️','⛰️','🌋','🌳','🌊','🚤','🏊','🥾','🚲',
    '📷','🎡','🛒','🚗','✈️','🚆','⛺','🌆','🏟️','🎓',
];

function closeEmojiPicker() {
    document.querySelector('.emoji-picker-popover')?.remove();
    document.querySelector('.emoji-picker-backdrop')?.remove();
    document.removeEventListener('mousedown', closeEmojiPicker);
}

function openEmojiPicker(anchorEl, currentEmoji, onSelect) {
    closeEmojiPicker();

    const backdrop = document.createElement('div');
    backdrop.className = 'emoji-picker-backdrop';
    backdrop.addEventListener('mousedown', closeEmojiPicker);
    document.body.appendChild(backdrop);

    const popover = document.createElement('div');
    popover.className = 'emoji-picker-popover';

    const grid = document.createElement('div');
    grid.className = 'emoji-picker-grid';
    EMOJI_PICKER_CHOICES.forEach(emoji => {
        const btn = document.createElement('button');
        btn.className = 'emoji-picker-option';
        btn.type = 'button';
        btn.textContent = emoji;
        btn.title = emoji === currentEmoji ? 'Current' : '';
        btn.addEventListener('click', () => {
            onSelect(emoji);
            closeEmojiPicker();
        });
        grid.appendChild(btn);
    });
    popover.appendChild(grid);

    const customRow = document.createElement('div');
    customRow.className = 'emoji-picker-custom-row';
    customRow.innerHTML = `<input type="text" maxlength="4" placeholder="Custom" value="${currentEmoji || ''}"/>
        <button type="button">Use</button>`;
    const customInput = customRow.querySelector('input');
    customRow.querySelector('button').addEventListener('click', () => {
        const val = customInput.value.trim();
        if (val) onSelect(val);
        closeEmojiPicker();
    });
    popover.appendChild(customRow);

    document.body.appendChild(popover);

    const rect = anchorEl.getBoundingClientRect();
    const popRect = popover.getBoundingClientRect();
    let top = rect.bottom + window.scrollY + 4;
    let left = rect.left + window.scrollX;
    if (left + popRect.width > window.innerWidth - 8) {
        left = window.innerWidth - popRect.width - 8;
    }
    if (top + popRect.height > window.innerHeight + window.scrollY - 8) {
        top = rect.top + window.scrollY - popRect.height - 4;
    }
    popover.style.top = `${top}px`;
    popover.style.left = `${left}px`;

    setTimeout(() => document.addEventListener('mousedown', (e) => {
        if (!popover.contains(e.target) && e.target !== anchorEl) closeEmojiPicker();
    }, { once: true }), 0);
}

function renderCustomCategoryList() {
    const container = document.getElementById('custom-categories-list');
    container.innerHTML = '';

    if (customCategories.length === 0) {
        container.innerHTML = '<div style="font-size:0.78rem;opacity:0.5;padding:0.3rem 0;">No custom categories yet.</div>';
    } else {
        customCategories.forEach((cc, idx) => {
            const row = document.createElement('div');
            row.className = 'custom-cat-row';
            row.innerHTML = `<span style="display:flex;align-items:center;gap:0.4rem;">
                    <button class="custom-cat-emoji emoji-pick-btn" data-idx="${idx}" title="Change icon" style="width:30px;height:28px;font-size:1rem;">${cc.emoji}</button>
                    <span>${cc.name}</span>
                </span>
                <span style="display:flex;gap:0.15rem;">
                    <button class="custom-cat-rename" data-idx="${idx}" title="Rename" style="background:none;border:none;cursor:pointer;">✏️</button>
                    <button class="custom-cat-delete" data-idx="${idx}" title="Delete">🗑️</button>
                </span>`;
            row.querySelector('.custom-cat-emoji').addEventListener('click', (e) => {
                openEmojiPicker(e.currentTarget, cc.emoji, (emoji) => {
                    customCategories[idx] = { ...customCategories[idx], emoji };
                    saveState();
                    populateDropdowns();
                    renderCustomCategoryList();
                    applyFiltersAndRender();
                });
            });
            row.querySelector('.custom-cat-rename').addEventListener('click', () => {
                const newName = prompt(`Rename category "${cc.name}" to:`, cc.name);
                if (!newName || !newName.trim() || newName.trim() === cc.name) return;
                const trimmed = newName.trim();
                if (customCategories.some((c, i) => i !== idx && c.name.toLowerCase() === trimmed.toLowerCase()) ||
                    categoryConfig[trimmed]) {
                    alert('A category with that name already exists.'); return;
                }
                const oldName = cc.name;
                customCategories[idx] = { ...customCategories[idx], name: trimmed };
                Object.keys(triageData).forEach(id => {
                    if (triageData[id].category === oldName) triageData[id].category = trimmed;
                });
                saveState();
                populateDropdowns();
                renderCustomCategoryList();
                applyFiltersAndRender();
            });
            row.querySelector('.custom-cat-delete').addEventListener('click', () => {
                if (!confirm(`Delete category "${cc.name}"? Places using it will be set to Other.`)) return;
                // Reset places using this category
                Object.keys(triageData).forEach(id => {
                    if (triageData[id].category === cc.name) triageData[id].category = 'Other';
                });
                customCategories.splice(idx, 1);
                saveState();
                populateDropdowns();
                renderCustomCategoryList();
                applyFiltersAndRender();
            });
            container.appendChild(row);
        });
    }

    // Add new row
    let newCatEmoji = '📌';
    const addRow = document.createElement('div');
    addRow.style.cssText = 'display:flex;gap:0.4rem;margin-top:0.4rem;';
    addRow.innerHTML = `
        <button id="new-cat-emoji" class="emoji-pick-btn" type="button" title="Choose icon">${newCatEmoji}</button>
        <input id="new-cat-name" placeholder="Category name" style="flex:1;padding:0.3rem 0.5rem;border:1px solid var(--border);border-radius:6px;background:var(--bg-main);color:var(--text-main);"/>
        <button id="new-cat-save" style="padding:0.3rem 0.6rem;background:var(--primary);color:#fff;border:none;border-radius:6px;cursor:pointer;font-size:0.8rem;">Add</button>
    `;
    container.appendChild(addRow);

    const newCatEmojiBtn = document.getElementById('new-cat-emoji');
    newCatEmojiBtn.addEventListener('click', (e) => {
        openEmojiPicker(e.currentTarget, newCatEmoji, (emoji) => {
            newCatEmoji = emoji;
            newCatEmojiBtn.textContent = emoji;
        });
    });

    document.getElementById('new-cat-save').addEventListener('click', () => {
        const name = document.getElementById('new-cat-name').value.trim();
        if (!name) return;
        if (customCategories.some(c => c.name.toLowerCase() === name.toLowerCase())) {
            alert('That category already exists.'); return;
        }
        customCategories.push({ name, emoji: newCatEmoji });
        saveState();
        populateDropdowns();
        document.getElementById('triage-category').value = name;
        renderCustomCategoryList();
    });
}

document.getElementById('add-category-btn').addEventListener('click', (e) => {
    e.stopPropagation();
    const container = document.getElementById('custom-categories-list');
    const isHidden = container.classList.toggle('hidden');
    if (!isHidden) renderCustomCategoryList();
});

// --- Smart search: filter existing + find new places via Nominatim ---
const searchInput = document.getElementById('local-search-input');
const searchDropdown = document.getElementById('place-search-dropdown');
let searchDebounceTimer = null;
let lastNominatimResults = [];

function closeSearchDropdown() {
    searchDropdown.classList.add('hidden');
    searchDropdown.innerHTML = '';
}

function showSearchDropdown(localMatches, nominatimResults, query) {
    searchDropdown.innerHTML = '';

    if (localMatches.length > 0) {
        const label = document.createElement('div');
        label.className = 'dropdown-section-label';
        label.textContent = 'In your collection';
        searchDropdown.appendChild(label);
        localMatches.slice(0, 5).forEach(place => {
            const item = document.createElement('div');
            item.className = 'dropdown-item';
            item.innerHTML = `<span class="item-icon">📍</span><div class="item-text"><div class="item-name">${place.name}</div><div class="item-addr">${place.address || ''}</div></div>`;
            item.addEventListener('click', () => {
                closeSearchDropdown();
                searchInput.value = '';
                closeDrawer();
                applyFiltersAndRender();
                if (place.lat !== 0 && place.lng !== 0) {
                    map.flyTo([place.lat, place.lng], 15, { duration: 1.2 });
                }
                openTriagePanel(place);
            });
            searchDropdown.appendChild(item);
        });
    }

    if (nominatimResults.length > 0) {
        const label = document.createElement('div');
        label.className = 'dropdown-section-label';
        label.textContent = 'Add new place';
        searchDropdown.appendChild(label);
        nominatimResults.slice(0, 5).forEach(result => {
            const name = result.name || result.display_name.split(',')[0];
            const addr = result.display_name;
            const item = document.createElement('div');
            item.className = 'dropdown-item';
            item.innerHTML = `<span class="item-icon">➕</span><div class="item-text"><div class="item-name">${name}</div><div class="item-addr">${addr}</div></div>`;
            item.addEventListener('click', () => {
                closeSearchDropdown();
                searchInput.value = '';
                closeDrawer();
                applyFiltersAndRender();
                const lat = parseFloat(result.lat);
                const lng = parseFloat(result.lon);
                map.flyTo([lat, lng], 15, { duration: 1.2 });
                // Create new place and open triage panel
                const newId = `manual-${Date.now()}`;
                const newPlace = { id: newId, name, address: addr, url: '#', lat, lng, osmChecked: true, dateAdded: Date.now() };
                allPlaces.push(newPlace);
                // Prefer OSM's own type (city, restaurant, museum…) over keyword guessing
                const osmCat = osmTypeToCategory(result.class, result.type);
                triageData[newId] = { category: osmCat || detectCategory(name, addr), status: 'Unsorted', folder: 'Uncategorized' };
                saveState();
                populateDropdowns();
                applyFiltersAndRender();
                openTriagePanel(newPlace);
            });
            searchDropdown.appendChild(item);
        });
    }

    // Always offer to add the user's own typed name as a new place — Nominatim
    // results are fuzzy matches and may not be the exact place the user means.
    const exactLocalMatch = localMatches.some(p => p.name.toLowerCase().trim() === query.toLowerCase().trim());
    if (!exactLocalMatch) {
        const item = document.createElement('div');
        item.className = 'dropdown-item';
        item.innerHTML = `<span class="item-icon">➕</span><div class="item-text"><div class="item-name">Add "${query}" as new place</div><div class="item-addr">We'll try to find the location automatically</div></div>`;
        item.addEventListener('click', () => {
            closeSearchDropdown();
            const name = query;
            searchInput.value = '';
            closeDrawer();
            const newId = `manual-${Date.now()}`;
            const newPlace = { id: newId, name, address: name, url: '#', lat: 0, lng: 0, dateAdded: Date.now() };
            allPlaces.push(newPlace);
            triageData[newId] = { category: detectCategory(name, ''), status: 'Unsorted', folder: 'Uncategorized' };
            saveState();
            populateDropdowns();
            applyFiltersAndRender();
            openTriagePanel(newPlace);
        });
        searchDropdown.appendChild(item);
    }

    searchDropdown.classList.remove('hidden');
}

searchInput.addEventListener('input', () => {
    const query = searchInput.value.trim();
    applyFiltersAndRender();
    clearTimeout(searchDebounceTimer);

    if (query.length < 2) {
        closeSearchDropdown();
        return;
    }

    // Local matches
    const localMatches = allPlaces.filter(p =>
        p.name.toLowerCase().includes(query.toLowerCase()) ||
        (p.address || '').toLowerCase().includes(query.toLowerCase())
    );

    searchDebounceTimer = setTimeout(() => {
        const url = `https://nominatim.openstreetmap.org/search?format=json&limit=5&q=${encodeURIComponent(query)}`;
        fetch(url, { headers: { 'Accept-Language': 'en' } })
            .then(r => r.json())
            .then(results => {
                lastNominatimResults = Array.isArray(results) ? results : [];
                showSearchDropdown(localMatches, lastNominatimResults, query);
            })
            .catch(() => {
                showSearchDropdown(localMatches, [], query);
            });
    }, 400);
});

searchInput.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') { closeSearchDropdown(); return; }
    if (e.key === 'Enter') {
        const first = searchDropdown.querySelector('.dropdown-item');
        if (first) { e.preventDefault(); first.click(); }
    }
});

document.addEventListener('click', (e) => {
    if (!searchInput.contains(e.target) && !searchDropdown.contains(e.target)) {
        closeSearchDropdown();
    }
});

document.getElementById('delete-place-btn').addEventListener('click', () => {
    document.getElementById('delete-confirm').classList.remove('hidden');
});

document.getElementById('cancel-delete-btn').addEventListener('click', () => {
    document.getElementById('delete-confirm').classList.add('hidden');
});

document.getElementById('confirm-delete-btn').addEventListener('click', () => {
    if (!activePlace) return;
    allPlaces = allPlaces.filter(p => p.id !== activePlace.id);
    delete triageData[activePlace.id];
    saveState();
    closeTriage();
});

// REPLACE EVERYTHING AT THE ABSOLUTE BOTTOM OF SCRIPT.JS WITH THIS:

// Clear duplicate listeners and bind safely
const folderSearchInputInstance = document.getElementById('folder-search-input');
if (folderSearchInputInstance) {
    folderSearchInputInstance.removeEventListener('input', renderFoldersList);
    folderSearchInputInstance.addEventListener('input', renderFoldersList);
}

document.addEventListener('DOMContentLoaded', initMap);

// ─── Mobile Drawer ────────────────────────────────────────────────────────────

const drawerOpenBtn = document.getElementById('drawer-open-btn');
const drawerOverlay = document.getElementById('drawer-overlay');
const drawerSidebar = document.getElementById('mobile-sheet');

function openDrawer() {
    drawerSidebar.classList.add('drawer-open');
    drawerOverlay.classList.add('visible');
    drawerOverlay.style.display = 'block';
}

function closeDrawer() {
    drawerSidebar.classList.remove('drawer-open');
    drawerOverlay.classList.remove('visible');
    setTimeout(() => {
        if (!drawerSidebar.classList.contains('drawer-open')) {
            drawerOverlay.style.display = '';
        }
    }, 300);
}

drawerOpenBtn && drawerOpenBtn.addEventListener('click', openDrawer);
drawerOverlay && drawerOverlay.addEventListener('click', closeDrawer);

// FAB opens drawer and focuses search
const fabAdd = document.getElementById('fab-add');
fabAdd && fabAdd.addEventListener('click', () => {
    openDrawer();
    setTimeout(() => document.getElementById('local-search-input')?.focus(), 350);
});

// Help modal
const helpBtn = document.getElementById('help-btn');
const helpModal = document.getElementById('help-modal');
const helpClose = document.getElementById('help-modal-close');
const helpBackdrop = document.getElementById('help-modal-backdrop');

helpBtn && helpBtn.addEventListener('click', () => helpModal.classList.remove('hidden'));
helpClose && helpClose.addEventListener('click', () => helpModal.classList.add('hidden'));
helpBackdrop && helpBackdrop.addEventListener('click', () => helpModal.classList.add('hidden'));

// Folders collapsible toggle
const foldersToggle = document.getElementById('folders-toggle');
const foldersBody = document.getElementById('folders-body');
const foldersChevron = document.getElementById('folders-chevron');
const activeFolderLabel = document.getElementById('active-folder-label');

let foldersCollapsed = false;

foldersToggle && foldersToggle.addEventListener('click', (e) => {
    if (e.target.closest('#add-folder-btn')) return;
    foldersCollapsed = !foldersCollapsed;
    foldersBody.classList.toggle('collapsed', foldersCollapsed);
    foldersChevron.classList.toggle('collapsed', foldersCollapsed);
});

// Recently added collapsible toggle
const recentAddedToggle = document.getElementById('recent-added-toggle');
const recentAddedBody = document.getElementById('recent-added-body');
const recentAddedChevron = document.getElementById('recent-added-chevron');
let recentAddedCollapsed = false;

recentAddedToggle && recentAddedToggle.addEventListener('click', () => {
    recentAddedCollapsed = !recentAddedCollapsed;
    recentAddedBody.classList.toggle('collapsed', recentAddedCollapsed);
    recentAddedChevron.classList.toggle('collapsed', recentAddedCollapsed);
});

// Saved trips collapsible toggle
const savedTripsToggle = document.getElementById('saved-trips-toggle');
const savedTripsBody = document.getElementById('saved-trips-body');
const savedTripsChevron = document.getElementById('saved-trips-chevron');
let savedTripsCollapsed = false;

savedTripsToggle && savedTripsToggle.addEventListener('click', () => {
    savedTripsCollapsed = !savedTripsCollapsed;
    savedTripsBody.classList.toggle('collapsed', savedTripsCollapsed);
    savedTripsChevron.classList.toggle('collapsed', savedTripsCollapsed);
});


// Update active folder label in collapsed header
function updateActiveFolderLabel() {
    if (!activeFolderLabel) return;
    activeFolderLabel.textContent = activeFolderFilter ? `· ${activeFolderFilter}` : '';
}

// Mobile theme toggle (topbar)
document.getElementById('theme-toggle-mobile')?.addEventListener('click', () => {
    const currentTheme = document.documentElement.getAttribute('data-theme') || 'light';
    const nextTheme = currentTheme === 'light' ? 'dark' : 'light';
    document.documentElement.setAttribute('data-theme', nextTheme);
    localStorage.setItem('mapfolio_theme', nextTheme);
    // keep both toggle buttons in sync
    const mobileBtn = document.getElementById('theme-toggle-mobile');
    if (mobileBtn) mobileBtn.textContent = nextTheme === 'dark' ? '☀️' : '🌓';
    const sidebarBtn = document.getElementById('theme-toggle');
    if (sidebarBtn) sidebarBtn.textContent = nextTheme === 'dark' ? '☀️' : '🌓';
});

// ─── Mobile Bottom Sheet ──────────────────────────────────────────────────────

const sheet = document.getElementById('mobile-sheet');
const handle = document.getElementById('sheet-handle');

const STATES = ['collapsed', 'half', 'full'];

function isMobile() { return window.innerWidth < 768; }

function setSheetState(state) {
    if (!sheet) return;
    sheet.dataset.state = state;
    // sync nav active button
    const navMap = document.getElementById('nav-map');
    const navPlaces = document.getElementById('nav-places');
    if (navMap && navPlaces) {
        navMap.classList.toggle('active', state === 'collapsed');
        navPlaces.classList.toggle('active', state !== 'collapsed');
    }
}

// Tap the handle to cycle states: collapsed → half → full → collapsed
handle && handle.addEventListener('click', () => {
    if (!isMobile()) return;
    const current = sheet.dataset.state || 'collapsed';
    const next = STATES[(STATES.indexOf(current) + 1) % STATES.length];
    setSheetState(next);
});

// Drag the handle to set state based on finger position
let dragStartY = 0;
let dragStartState = 'collapsed';

function onDragStart(e) {
    if (!isMobile()) return;
    dragStartY = e.type === 'touchstart' ? e.touches[0].clientY : e.clientY;
    dragStartState = sheet.dataset.state || 'collapsed';
    sheet.style.transition = 'none';
}

function onDragEnd(e) {
    if (!isMobile()) return;
    sheet.style.transition = '';
    const endY = e.type === 'touchend' ? e.changedTouches[0].clientY : e.clientY;
    const delta = dragStartY - endY; // positive = dragged up

    if (Math.abs(delta) < 20) return; // too small, ignore

    if (delta > 0) {
        // dragged up → open more
        const next = dragStartState === 'collapsed' ? 'half' : 'full';
        setSheetState(next);
    } else {
        // dragged down → close more
        const next = dragStartState === 'full' ? 'half' : 'collapsed';
        setSheetState(next);
    }
}

if (handle) {
    handle.addEventListener('touchstart', onDragStart, { passive: true });
    handle.addEventListener('touchend', onDragEnd, { passive: true });
    handle.addEventListener('mousedown', onDragStart);
    document.addEventListener('mouseup', onDragEnd);
}

// Nav helpers
function mobileNavMap() {
    setSheetState('collapsed');
}

function mobileNavPlaces() {
    const current = sheet.dataset.state || 'collapsed';
    setSheetState(current === 'collapsed' ? 'half' : current);
}

// When a place is opened on mobile, collapse the sheet so the map is visible
const _origOpenTriage = typeof openTriagePanel !== 'undefined' ? openTriagePanel : null;
if (typeof openTriagePanel === 'function') {
    const __open = openTriagePanel;
    window.openTriagePanel = function(place) {
        __open(place);
        if (isMobile()) setSheetState('collapsed');
    };
}

// ═══════════════════════════════════════════════════════════════════════════
// COUNTRY AUTO-TAG — detect country from address text, fall back to
// reverse geocoding (Nominatim), cached on the place object.
// ═══════════════════════════════════════════════════════════════════════════

const COUNTRIES = [
    ['FR','France'],['ES','Spain','España'],['IT','Italy','Italia'],['PT','Portugal'],
    ['DE','Germany','Deutschland'],['NL','Netherlands','Nederland','The Netherlands'],
    ['BE','Belgium','België','Belgique'],['LU','Luxembourg'],
    ['CH','Switzerland','Schweiz','Suisse','Svizzera'],['AT','Austria','Österreich'],
    ['GB','United Kingdom','UK','England','Scotland','Wales','Northern Ireland'],
    ['IE','Ireland','Éire'],['GR','Greece','Ελλάδα'],['HR','Croatia','Hrvatska'],
    ['SI','Slovenia','Slovenija'],['CZ','Czechia','Czech Republic','Česko'],
    ['SK','Slovakia','Slovensko'],['PL','Poland','Polska'],['HU','Hungary','Magyarország'],
    ['RO','Romania','România'],['BG','Bulgaria'],['RS','Serbia'],['BA','Bosnia and Herzegovina'],
    ['ME','Montenegro'],['MK','North Macedonia'],['AL','Albania'],
    ['DK','Denmark','Danmark'],['SE','Sweden','Sverige'],['NO','Norway','Norge'],
    ['FI','Finland','Suomi'],['IS','Iceland','Ísland'],['EE','Estonia','Eesti'],
    ['LV','Latvia','Latvija'],['LT','Lithuania','Lietuva'],['UA','Ukraine','Україна'],
    ['MD','Moldova'],['TR','Türkiye','Turkey'],['CY','Cyprus'],['MT','Malta'],
    ['MC','Monaco'],['AD','Andorra'],['SM','San Marino'],['VA','Vatican City'],
    ['LI','Liechtenstein'],
    ['US','United States','USA','United States of America'],['CA','Canada'],
    ['MX','Mexico','México'],['BR','Brazil','Brasil'],['AR','Argentina'],['CL','Chile'],
    ['PE','Peru','Perú'],['CO','Colombia'],['EC','Ecuador'],['BO','Bolivia'],
    ['UY','Uruguay'],['CR','Costa Rica'],['PA','Panama'],['CU','Cuba'],
    ['DO','Dominican Republic'],['GT','Guatemala'],
    ['MA','Morocco','Maroc'],['TN','Tunisia'],['EG','Egypt'],['ZA','South Africa'],
    ['KE','Kenya'],['TZ','Tanzania'],['NA','Namibia'],['MU','Mauritius'],
    ['SC','Seychelles'],['CV','Cape Verde','Cabo Verde'],
    ['AE','United Arab Emirates','UAE'],['IL','Israel'],['JO','Jordan'],['LB','Lebanon'],
    ['SA','Saudi Arabia'],['QA','Qatar'],['OM','Oman'],['BH','Bahrain'],['KW','Kuwait'],
    ['IN','India'],['LK','Sri Lanka'],['NP','Nepal'],['MV','Maldives'],['BD','Bangladesh'],
    ['TH','Thailand'],['VN','Vietnam'],['KH','Cambodia'],['LA','Laos'],['MM','Myanmar'],
    ['MY','Malaysia'],['SG','Singapore'],['ID','Indonesia'],['PH','Philippines'],
    ['JP','Japan'],['KR','South Korea'],['CN','China'],['TW','Taiwan'],['HK','Hong Kong'],
    ['MO','Macau'],['MN','Mongolia'],
    ['AU','Australia'],['NZ','New Zealand'],['FJ','Fiji'],['PF','French Polynesia'],
    ['GE','Georgia'],['AM','Armenia'],['AZ','Azerbaijan'],['KZ','Kazakhstan'],
    ['UZ','Uzbekistan'],['KG','Kyrgyzstan'],
];

function flagEmoji(code) {
    if (!code || code.length !== 2) return '🌍';
    return String.fromCodePoint(...[...code.toUpperCase()].map(c => 127397 + c.charCodeAt(0)));
}

// Match address text against country aliases; the alias found LATEST in the
// string wins (country usually comes last — handles "Georgia, USA" correctly).
function matchCountryFromAddress(address) {
    if (!address) return null;
    const text = address.toLowerCase();
    let best = null, bestPos = -1;
    for (const entry of COUNTRIES) {
        const [code, name, ...aliases] = entry;
        for (const alias of [name, ...aliases]) {
            const a = alias.toLowerCase();
            const pos = text.lastIndexOf(a);
            if (pos === -1) continue;
            // crude word-boundary check
            const before = pos === 0 ? ' ' : text[pos - 1];
            const after = pos + a.length >= text.length ? ' ' : text[pos + a.length];
            if (/[a-zà-ž]/.test(before) || /[a-zà-ž]/.test(after)) continue;
            if (pos > bestPos) { bestPos = pos; best = { code, name }; }
        }
    }
    return best;
}

// Reverse-geocode queue for places whose address didn't reveal a country
const countryQueue = [];
const countryTried = new Set();
let countryQueueRunning = false;

function runCountryQueue() {
    if (countryQueue.length === 0) { countryQueueRunning = false; return; }
    countryQueueRunning = true;
    const place = countryQueue.shift();
    (async () => {
        try {
            const url = `https://nominatim.openstreetmap.org/reverse?format=json&zoom=3&lat=${place.lat}&lon=${place.lng}`;
            const res = await fetchWithTimeout(url, { headers: { 'Accept-Language': 'en' } });
            const data = await res.json();
            const code = data?.address?.country_code;
            if (code) {
                const known = COUNTRIES.find(c => c[0] === code.toUpperCase());
                place.country = known ? known[1] : (data.address.country || code.toUpperCase());
                place.countryCode = code.toUpperCase();
                saveState();
                populateCountryFilter();
            }
        } catch (e) {}
    })().finally(() => setTimeout(runCountryQueue, 1200));
}

function tagCountries() {
    let changed = false;
    allPlaces.forEach(p => {
        if (p.country) return;
        const m = matchCountryFromAddress(p.address);
        if (m) {
            p.country = m.name;
            p.countryCode = m.code;
            changed = true;
        } else if ((p.lat !== 0 || p.lng !== 0) && !countryTried.has(p.id)) {
            countryTried.add(p.id);
            countryQueue.push(p);
        }
    });
    if (changed) saveState();
    if (countryQueue.length > 0 && !countryQueueRunning) runCountryQueue();
}

function populateCountryFilter() {
    const select = document.getElementById('filter-country');
    if (!select) return;
    const current = select.value;
    const counts = {};
    allPlaces.forEach(p => {
        if (p.country) counts[p.country] = (counts[p.country] || 0) + 1;
    });
    const sorted = Object.keys(counts).sort((a, b) => counts[b] - counts[a]);
    select.innerHTML = `<option value="All">🌍 All Countries (${sorted.length})</option>`;
    sorted.forEach(name => {
        const code = allPlaces.find(p => p.country === name)?.countryCode;
        const opt = document.createElement('option');
        opt.value = name;
        opt.textContent = `${flagEmoji(code)} ${name} (${counts[name]})`;
        select.appendChild(opt);
    });
    if (current && [...select.options].some(o => o.value === current)) select.value = current;
}

document.getElementById('filter-country')?.addEventListener('change', applyFiltersAndRender);

// ═══════════════════════════════════════════════════════════════════════════
// OSM TYPE → CATEGORY — Nominatim tells us what a place actually is
// (city, restaurant, museum…). Used when adding via search (free) and as a
// slow background check for imported places stuck on "Other".
// ═══════════════════════════════════════════════════════════════════════════

function osmTypeToCategory(cls, type) {
    if (!cls || !type) return null;
    if (cls === 'place') {
        // Note: suburb/quarter/neighbourhood deliberately excluded — they often
        // share a name with a famous POI (e.g. the Sagrada Família neighborhood)
        if (['city','town','village','municipality','hamlet','island'].includes(type)) return 'City / Region';
        return null;
    }
    if (cls === 'boundary' && type === 'administrative') return 'City / Region';
    if (cls === 'tourism') {
        if (['hotel','hostel','guest_house','motel','apartment','chalet','alpine_hut','camp_site'].includes(type)) return 'Hotel';
        if (['museum','gallery','artwork'].includes(type)) return 'Museum / Gallery';
        if (type === 'viewpoint') return 'Viewpoint';
        if (['theme_park','zoo','aquarium'].includes(type)) return 'Entertainment';
        if (type === 'attraction') return 'Monument / Landmark';
        return null;
    }
    if (cls === 'amenity') {
        if (['restaurant','food_court','fast_food'].includes(type)) return 'Restaurant';
        if (['cafe','bar','pub','biergarten','ice_cream'].includes(type)) return 'Café / Bar';
        if (['theatre','cinema','nightclub','casino','arts_centre'].includes(type)) return 'Entertainment';
        if (type === 'marketplace') return 'Market';
        if (type === 'place_of_worship') return 'Monument / Landmark';
        if (['parking','fuel'].includes(type)) return 'Parking / Fuel';
        if (type === 'toilets') return 'Toilets';
        return null;
    }
    if (cls === 'historic') return 'Monument / Landmark';
    if (cls === 'natural') {
        if (type === 'beach') return 'Beach';
        return 'Nature';
    }
    if (cls === 'leisure') {
        if (['park','garden','nature_reserve'].includes(type)) return 'Nature';
        if (['spa','sauna'].includes(type)) return 'Spa / Wellness';
        if (['sports_centre','stadium','water_park','amusement_arcade'].includes(type)) return 'Entertainment';
        if (type === 'beach_resort') return 'Beach';
        return null;
    }
    if (cls === 'shop') return 'Shopping';
    if (cls === 'waterway' || cls === 'water') return 'Nature';
    return null;
}

function normalizeName(s) {
    return (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();
}

// Background re-categorization for places that ended up "Other"/"Unsorted".
// Confirms identity by name match + proximity before trusting the OSM type.
const osmCheckQueue = [];
const osmCheckTried = new Set();
let osmCheckRunning = false;

function runOsmCheckQueue() {
    if (osmCheckQueue.length === 0) { osmCheckRunning = false; return; }
    osmCheckRunning = true;
    const place = osmCheckQueue.shift();
    (async () => {
        try {
            const url = `https://nominatim.openstreetmap.org/search?format=json&limit=5&q=${encodeURIComponent(place.name)}`;
            const res = await fetchWithTimeout(url, { headers: { 'Accept-Language': 'en' } });
            const results = await res.json();
            const target = normalizeName(place.name);
            // Scan ALL matching results and prefer a specific POI category
            // (church, museum, beach…) over an administrative one — a famous
            // landmark often shares its name with a city district.
            let poiCat = null, adminCat = null;
            for (const r of (Array.isArray(results) ? results : [])) {
                const rName = normalizeName(r.name || (r.display_name || '').split(',')[0]);
                const sameName = rName === target || rName.includes(target) || target.includes(rName);
                const close = haversineKm(place, { lat: parseFloat(r.lat), lng: parseFloat(r.lon) }) < 15;
                if (!sameName || !close) continue;
                const cat = osmTypeToCategory(r.class, r.type);
                if (!cat) continue;
                if (cat === 'City / Region') { if (!adminCat) adminCat = cat; }
                else { poiCat = cat; break; }
            }
            const finalCat = poiCat || adminCat;
            if (finalCat) {
                const t = triageData[place.id];
                // Re-check it's still untouched by the user
                if (t && t.category === 'Other' && t.status === 'Unsorted') {
                    t.category = finalCat;
                }
            }
            // Only mark as checked when the lookup actually succeeded —
            // a network failure should be retried next session
            place.osmChecked = true;
            saveState();
            applyFiltersAndRender();
        } catch (e) {}
    })().finally(() => setTimeout(runOsmCheckQueue, 1500));
}

// One-time repair: earlier checker logic let neighborhoods (e.g. the Sagrada
// Família district) classify landmarks as City / Region. Re-queue those for a
// fresh check with the POI-first logic.
(function repairOsmCityMistags() {
    if (localStorage.getItem('mapfolio_osmfix_v2')) return;
    let changed = false;
    allPlaces.forEach(p => {
        const t = triageData[p.id];
        if (p.osmChecked && t && t.category === 'City / Region' && t.status === 'Unsorted') {
            t.category = 'Other';
            delete p.osmChecked;
            changed = true;
        }
    });
    if (changed) saveState();
    localStorage.setItem('mapfolio_osmfix_v2', 'true');
})();

function scheduleOsmChecks() {
    allPlaces.forEach(p => {
        if (p.osmChecked || osmCheckTried.has(p.id)) return;
        if (p.lat === 0 && p.lng === 0) return;
        const t = triageData[p.id];
        if (!t || t.category !== 'Other' || t.status !== 'Unsorted') return;
        osmCheckTried.add(p.id);
        osmCheckQueue.push(p);
    });
    if (osmCheckQueue.length > 0 && !osmCheckRunning) runOsmCheckQueue();
}

// ═══════════════════════════════════════════════════════════════════════════
// STATS PAGE — countries, categories, statuses, travel progress.
// Pure CSS bars, computed live from the collection.
// ═══════════════════════════════════════════════════════════════════════════

const VISITED_STATUSES = ['Been There', 'Loved It', 'Meh', 'Favourite'];

function renderStats() {
    const body = document.getElementById('stats-body');
    if (!body) return;

    if (allPlaces.length === 0) {
        body.innerHTML = '<p style="color:var(--text-muted);">No places yet — import or add some first, then come back!</p>';
        return;
    }

    // ── Gather ──
    const countryCounts = {}, categoryCounts = {}, statusCounts = {};
    let visited = 0, wantToGo = 0, loved = 0;
    allPlaces.forEach(p => {
        if (p.country) countryCounts[p.country] = (countryCounts[p.country] || 0) + 1;
        const t = triageData[p.id] || { category: 'Other', status: 'Unsorted' };
        categoryCounts[t.category] = (categoryCounts[t.category] || 0) + 1;
        statusCounts[t.status] = (statusCounts[t.status] || 0) + 1;
        if (VISITED_STATUSES.includes(t.status)) visited++;
        if (t.status === 'Want to Go') wantToGo++;
        if (t.status === 'Loved It' || t.status === 'Favourite') loved++;
    });

    const countries = Object.entries(countryCounts).sort((a, b) => b[1] - a[1]);
    const categories = Object.entries(categoryCounts).sort((a, b) => b[1] - a[1]);
    const topCountry = countries[0];
    const topCategory = categories.filter(([name]) => name !== 'Other' && name !== 'Unassigned')[0] || categories[0];
    const lovedPct = visited > 0 ? Math.round(loved / visited * 100) : 0;

    function barRows(entries, total, labelFn) {
        const max = entries[0]?.[1] || 1;
        return entries.map(([name, count]) => `
            <div class="stats-bar-row">
                <span class="stats-bar-label">${labelFn(name)}</span>
                <div class="stats-bar-track"><div class="stats-bar-fill" style="width:${Math.max(4, count / max * 100)}%"></div></div>
                <span class="stats-bar-count">${count}</span>
            </div>`).join('');
    }

    const statusOrder = ['Favourite','Want to Go','Been There','Loved It','Meh','Skip It','Unsorted'];
    const statusEmojis = { 'Favourite':'⭐','Want to Go':'🔵','Been There':'🟡','Loved It':'🟢','Meh':'🟤','Skip It':'🔴','Unsorted':'⚪' };

    body.innerHTML = `
        <div class="stats-hero">
            <div class="stats-hero-card"><div class="stats-hero-num">${allPlaces.length.toLocaleString()}</div><div class="stats-hero-label">places</div></div>
            <div class="stats-hero-card"><div class="stats-hero-num">${countries.length}</div><div class="stats-hero-label">countries</div></div>
            <div class="stats-hero-card"><div class="stats-hero-num">${customFolders.length}</div><div class="stats-hero-label">folders</div></div>
        </div>

        ${topCountry || topCategory ? `<div class="stats-highlights">
            ${topCountry ? `<div class="stats-highlight">🏆 Top country: <strong>${flagEmoji(allPlaces.find(p => p.country === topCountry[0])?.countryCode)} ${topCountry[0]}</strong> (${topCountry[1]} places)</div>` : ''}
            ${topCategory ? `<div class="stats-highlight">${getCatConf(topCategory[0]).emoji} You're a <strong>${topCategory[0]}</strong> person (${topCategory[1]} saved)</div>` : ''}
            ${visited > 0 ? `<div class="stats-highlight">💚 ${lovedPct}% of visited places won your heart</div>` : ''}
        </div>` : ''}

        <div class="stats-section">
            <h3>Travel progress</h3>
            <div class="stats-progress-track">
                <div class="stats-progress-visited" style="width:${Math.round(visited / allPlaces.length * 100)}%"></div>
            </div>
            <div class="stats-progress-legend">
                <span>✅ ${visited} visited</span>
                <span>🔵 ${wantToGo} still to go</span>
            </div>
        </div>

        ${countries.length ? `<div class="stats-section">
            <h3>Countries</h3>
            ${barRows(countries, allPlaces.length, name => `${flagEmoji(allPlaces.find(p => p.country === name)?.countryCode)} ${name}`)}
        </div>` : ''}

        <div class="stats-section">
            <h3>Categories</h3>
            ${barRows(categories, allPlaces.length, name => `${getCatConf(name).emoji} ${name}`)}
        </div>

        <div class="stats-section">
            <h3>Statuses</h3>
            <div class="stats-status-chips">
                ${statusOrder.filter(s => statusCounts[s]).map(s =>
                    `<span class="stats-status-chip">${statusEmojis[s]} ${s} <strong>${statusCounts[s]}</strong></span>`).join('')}
            </div>
        </div>
    `;
}

const statsModal = document.getElementById('stats-modal');
document.getElementById('stats-btn')?.addEventListener('click', () => {
    closeDrawer();
    renderStats();
    statsModal.classList.remove('hidden');
});
document.getElementById('stats-modal-close')?.addEventListener('click', () => statsModal.classList.add('hidden'));
document.getElementById('stats-modal-backdrop')?.addEventListener('click', () => statsModal.classList.add('hidden'));

// ═══════════════════════════════════════════════════════════════════════════
// BULK EDIT — apply a category and/or status to every place in a folder at once
// ═══════════════════════════════════════════════════════════════════════════
const bulkEditModal = document.getElementById('bulk-edit-modal');
const bulkEditCategorySelect = document.getElementById('bulk-edit-category');
let bulkEditTargetFolder = null;

function openBulkEditModal(folder, count) {
    bulkEditTargetFolder = folder;
    document.getElementById('bulk-edit-folder-desc').textContent =
        `This will update all ${count} place${count === 1 ? '' : 's'} in "${folder}". Leave a field as "Don't change" to skip it.`;

    bulkEditCategorySelect.innerHTML = '<option value="__nochange">Don\'t change</option><option value="__autodetect">🤖 Auto-detect from each place\'s name</option>';
    Object.keys(categoryConfig).forEach(name => {
        const opt = document.createElement('option');
        opt.value = name;
        opt.textContent = `${categoryConfig[name].emoji} ${name}`;
        bulkEditCategorySelect.appendChild(opt);
    });
    customCategories.forEach(cc => {
        const opt = document.createElement('option');
        opt.value = cc.name;
        opt.textContent = `${cc.emoji} ${cc.name}`;
        bulkEditCategorySelect.appendChild(opt);
    });

    document.getElementById('bulk-edit-status').value = '__nochange';
    bulkEditModal.classList.remove('hidden');
}

document.getElementById('bulk-edit-modal-close')?.addEventListener('click', () => bulkEditModal.classList.add('hidden'));
document.getElementById('bulk-edit-modal-backdrop')?.addEventListener('click', () => bulkEditModal.classList.add('hidden'));

document.getElementById('bulk-edit-apply-btn')?.addEventListener('click', () => {
    const newCategory = bulkEditCategorySelect.value;
    const newStatus = document.getElementById('bulk-edit-status').value;

    if (newCategory === '__nochange' && newStatus === '__nochange') {
        bulkEditModal.classList.add('hidden');
        return;
    }

    let updated = 0;
    allPlaces.forEach(place => {
        const data = triageData[place.id];
        const placeFolder = (data && data.folder) ? data.folder : 'Uncategorized';
        if (placeFolder !== bulkEditTargetFolder) return;
        if (!triageData[place.id]) triageData[place.id] = { category: 'Other', status: 'Unsorted', folder: placeFolder };
        if (newCategory === '__autodetect') {
            triageData[place.id].category = detectCategory(place.name, place.address);
        } else if (newCategory !== '__nochange') {
            triageData[place.id].category = newCategory;
        }
        if (newStatus !== '__nochange') triageData[place.id].status = newStatus;
        updated++;
    });

    saveState();
    applyFiltersAndRender();
    renderFoldersList();
    bulkEditModal.classList.add('hidden');
    alert(`Updated ${updated} place${updated === 1 ? '' : 's'} in "${bulkEditTargetFolder}".`);
});

// ═══════════════════════════════════════════════════════════════════════════
// TRIP PLANNER — cluster a folder's places into N days by proximity,
// order each day as a walkable route, show numbered pins + day tabs.
// ═══════════════════════════════════════════════════════════════════════════

const DAY_COLORS = ['#e63946','#2a9d8f','#4361ee','#f4a261','#9b5de5','#0096c7','#d62828','#52b788','#ff5d8f','#7f5539','#3a0ca3','#fb8500','#06d6a0','#bc4749'];

function haversineKm(a, b) {
    const R = 6371, toRad = d => d * Math.PI / 180;
    const dLat = toRad(b.lat - a.lat), dLng = toRad(b.lng - a.lng);
    const h = Math.sin(dLat/2)**2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng/2)**2;
    return 2 * R * Math.asin(Math.sqrt(h));
}

// K-means on coordinates with farthest-point initialization
function clusterPlaces(places, k) {
    if (places.length <= k) return places.map(p => [p]);

    // Farthest-point sampling for initial centroids
    const centroids = [{ lat: places[0].lat, lng: places[0].lng }];
    while (centroids.length < k) {
        let far = null, farDist = -1;
        places.forEach(p => {
            const d = Math.min(...centroids.map(c => haversineKm(p, c)));
            if (d > farDist) { farDist = d; far = p; }
        });
        centroids.push({ lat: far.lat, lng: far.lng });
    }

    let assignment = [];
    for (let iter = 0; iter < 30; iter++) {
        assignment = places.map(p => {
            let best = 0, bestD = Infinity;
            centroids.forEach((c, i) => {
                const d = haversineKm(p, c);
                if (d < bestD) { bestD = d; best = i; }
            });
            return best;
        });
        let moved = false;
        centroids.forEach((c, i) => {
            const members = places.filter((_, j) => assignment[j] === i);
            if (members.length === 0) return;
            const lat = members.reduce((s, p) => s + p.lat, 0) / members.length;
            const lng = members.reduce((s, p) => s + p.lng, 0) / members.length;
            if (Math.abs(lat - c.lat) > 1e-7 || Math.abs(lng - c.lng) > 1e-7) moved = true;
            c.lat = lat; c.lng = lng;
        });
        if (!moved) break;
    }

    const clusters = centroids.map(() => []);
    places.forEach((p, i) => clusters[assignment[i]].push(p));
    return clusters.filter(c => c.length > 0);
}

// Nearest-neighbour ordering within a day, starting from the most north-west stop
function orderRoute(stops) {
    if (stops.length <= 2) return stops;
    const remaining = [...stops];
    remaining.sort((a, b) => (b.lat - b.lng) - (a.lat - a.lng));
    const route = [remaining.shift()];
    while (remaining.length) {
        const last = route[route.length - 1];
        let bestIdx = 0, bestD = Infinity;
        remaining.forEach((p, i) => {
            const d = haversineKm(last, p);
            if (d < bestD) { bestD = d; bestIdx = i; }
        });
        route.push(remaining.splice(bestIdx, 1)[0]);
    }
    return route;
}

function routeDistanceKm(stops) {
    let total = 0;
    for (let i = 1; i < stops.length; i++) total += haversineKm(stops[i-1], stops[i]);
    return total;
}

function centroidOf(stops) {
    return {
        lat: stops.reduce((s, p) => s + p.lat, 0) / stops.length,
        lng: stops.reduce((s, p) => s + p.lng, 0) / stops.length
    };
}

function planTrip(places, numDays) {
    const clusters = clusterPlaces(places, numDays);
    // Order days as a chain: start at the west-most cluster, hop to nearest next
    const remaining = clusters.map(c => ({ stops: c, center: centroidOf(c) }));
    remaining.sort((a, b) => a.center.lng - b.center.lng);
    const ordered = [remaining.shift()];
    while (remaining.length) {
        const last = ordered[ordered.length - 1];
        let bestIdx = 0, bestD = Infinity;
        remaining.forEach((c, i) => {
            const d = haversineKm(last.center, c.center);
            if (d < bestD) { bestD = d; bestIdx = i; }
        });
        ordered.push(remaining.splice(bestIdx, 1)[0]);
    }
    return ordered.map(day => orderRoute(day.stops));
}

function gmapsDirectionsUrl(stops) {
    const path = stops.map(p => `${p.lat},${p.lng}`).join('/');
    return `https://www.google.com/maps/dir/${path}`;
}

// ── Trip persistence ──────────────────────────────────────────────────────

function saveTrips() {
    localStorage.setItem('mapfolio_trips', JSON.stringify(savedTrips));
}

function tripDaysToIds(days) {
    return days.map(day => day.map(p => p.id));
}

// Resolve stored place IDs back to live place objects, dropping any that
// were deleted since the trip was saved, and any days left empty as a result.
function tripDaysFromIds(idDays) {
    return idDays
        .map(day => day.map(id => allPlaces.find(p => p.id === id)).filter(Boolean))
        .filter(day => day.length > 0);
}

function persistActiveTrip() {
    if (tripState.active && tripState.days.length) {
        localStorage.setItem('mapfolio_active_trip', JSON.stringify({
            label: tripState.label,
            activeDay: tripState.activeDay,
            days: tripDaysToIds(tripState.days)
        }));
    } else {
        localStorage.removeItem('mapfolio_active_trip');
    }
}

function renderSavedTripsList() {
    const section = document.getElementById('saved-trips-section');
    const listEl = document.getElementById('saved-trips-list');
    if (!section || !listEl) return;

    section.classList.toggle('hidden', savedTrips.length === 0);
    listEl.innerHTML = '';

    savedTrips.forEach((trip) => {
        const dayCount = trip.days.length;
        const stopCount = trip.days.reduce((s, d) => s + d.length, 0);

        const li = document.createElement('li');
        li.className = 'folder-item';
        li.style.cursor = 'pointer';
        li.innerHTML = `
            <span class="folder-name-text">
                <span class="folder-icon"><i class="ti ti-map-pin" aria-hidden="true"></i></span>
                <span class="folder-name-label">${trip.name} <strong style="opacity: 0.7; font-size: 0.85em;">(${dayCount}d · ${stopCount} stops)</strong></span>
            </span>
            <div class="folder-actions" style="display:flex; gap:0.25rem;">
                <button class="delete-trip-btn" style="background:none; border:none; cursor:pointer;">🗑️</button>
            </div>
        `;

        li.addEventListener('click', () => loadSavedTrip(trip.id));
        li.querySelector('.delete-trip-btn').addEventListener('click', (e) => {
            e.stopPropagation();
            if (!confirm(`Delete saved trip "${trip.name}"?`)) return;
            savedTrips = savedTrips.filter(t => t.id !== trip.id);
            saveTrips();
            renderSavedTripsList();
        });

        listEl.appendChild(li);
    });
}

function loadSavedTrip(tripId) {
    const trip = savedTrips.find(t => t.id === tripId);
    if (!trip) return;

    const days = tripDaysFromIds(trip.days);
    if (!days.length) {
        showImportToast('⚠️ None of these places exist anymore.');
        return;
    }

    tripState.days = days;
    tripState.active = true;
    tripState.activeDay = 0;
    tripState.label = trip.name;

    document.getElementById('triage-panel')?.classList.add('hidden');
    closeDrawer?.();
    renderTripPanel();
    renderTripMarkers();
    if (isMobile()) setSheetState('collapsed');
    zoomToDay(0);
}

function restoreActiveTrip() {
    const raw = localStorage.getItem('mapfolio_active_trip');
    if (!raw) return;
    let data;
    try { data = JSON.parse(raw); } catch (e) { localStorage.removeItem('mapfolio_active_trip'); return; }

    const days = tripDaysFromIds(data.days || []);
    if (!days.length) { localStorage.removeItem('mapfolio_active_trip'); return; }

    tripState.days = days;
    tripState.active = true;
    tripState.activeDay = Math.min(data.activeDay || 0, days.length - 1);
    tripState.label = data.label || 'Trip';

    document.getElementById('triage-panel')?.classList.add('hidden');
    renderTripPanel();
    renderTripMarkers();
    if (isMobile()) setSheetState('collapsed');
    zoomToDay(tripState.activeDay);
}

// ── Trip modal ──────────────────────────────────────────────────────────────

const tripModal = document.getElementById('trip-modal');
const tripFolderSelect = document.getElementById('trip-folder-select');
const tripDaysInput = document.getElementById('trip-days-input');
const tripModalHint = document.getElementById('trip-modal-hint');

// Status checkboxes — Skip It and Meh excluded by default (you usually plan the good stuff)
const TRIP_STATUSES = [
    { name: 'Favourite',  emoji: '⭐', on: true },
    { name: 'Want to Go', emoji: '🔵', on: true },
    { name: 'Loved It',   emoji: '🟢', on: true },
    { name: 'Been There', emoji: '🟡', on: true },
    { name: 'Unsorted',   emoji: '⚪', on: true },
    { name: 'Meh',        emoji: '🟤', on: false },
    { name: 'Skip It',    emoji: '🔴', on: false },
];
const tripStatusChecked = new Set(TRIP_STATUSES.filter(s => s.on).map(s => s.name));

function renderTripStatusFilters() {
    const box = document.getElementById('trip-status-filters');
    if (!box) return;
    box.innerHTML = '';
    TRIP_STATUSES.forEach(s => {
        const label = document.createElement('label');
        label.className = 'trip-status-chip' + (tripStatusChecked.has(s.name) ? ' checked' : '');
        label.innerHTML = `<input type="checkbox" ${tripStatusChecked.has(s.name) ? 'checked' : ''} /> ${s.emoji} ${s.name}`;
        label.querySelector('input').addEventListener('change', (e) => {
            if (e.target.checked) tripStatusChecked.add(s.name);
            else tripStatusChecked.delete(s.name);
            label.classList.toggle('checked', e.target.checked);
            updateTripModalHint();
        });
        box.appendChild(label);
    });
}

function tripMode() {
    return document.querySelector('input[name="trip-mode"]:checked')?.value || 'walk';
}

function tripPlacesForSelection(value) {
    return allPlaces.filter(p => {
        if (p.lat === 0 && p.lng === 0) return false;
        const status = triageData[p.id]?.status || 'Unsorted';
        if (!tripStatusChecked.has(status)) return false;
        if (value === '__all__') return true;
        if (value.startsWith('country:')) return p.country === value.slice(8);
        const folder = triageData[p.id]?.folder || 'Uncategorized';
        return folder === value;
    });
}

// How many days does this selection realistically need?
// Budgets: walking ≈ 12 km & 7 stops/day, driving ≈ 150 km & 10 stops/day.
function estimateTripNeeds(places, mode) {
    const budget = mode === 'drive' ? { km: 150, stops: 10 } : { km: 12, stops: 7 };
    const totalKm = routeDistanceKm(orderRoute([...places]));
    const daysByDistance = Math.ceil(totalKm / budget.km);
    const daysByStops = Math.ceil(places.length / budget.stops);
    return {
        totalKm,
        recommended: Math.min(14, Math.max(1, daysByDistance, daysByStops))
    };
}

function openTripModal() {
    // Build choices: all places, folders, and countries — with pinned-place counts
    tripFolderSelect.innerHTML = '';

    function addOption(parent, value, label) {
        const count = tripPlacesForSelection(value).length;
        if (value !== '__all__' && count === 0) return;
        const opt = document.createElement('option');
        opt.value = value;
        opt.textContent = `${label} (${count})`;
        parent.appendChild(opt);
    }

    addOption(tripFolderSelect, '__all__', '🌍 All places');

    const folderGroup = document.createElement('optgroup');
    folderGroup.label = 'Folders';
    [...customFolders.map(f => [f, `📁 ${f}`]), ['Uncategorized', '📁 Uncategorized / General']]
        .forEach(([value, label]) => addOption(folderGroup, value, label));
    if (folderGroup.children.length) tripFolderSelect.appendChild(folderGroup);

    const countryGroup = document.createElement('optgroup');
    countryGroup.label = 'Countries';
    const countryNames = [...new Set(allPlaces.filter(p => p.country).map(p => p.country))]
        .sort((a, b) => a.localeCompare(b));
    countryNames.forEach(name => {
        const code = allPlaces.find(p => p.country === name)?.countryCode;
        addOption(countryGroup, `country:${name}`, `${flagEmoji(code)} ${name}`);
    });
    if (countryGroup.children.length) tripFolderSelect.appendChild(countryGroup);
    // Preselect the active folder filter if there is one
    if (activeFolderFilter && [...tripFolderSelect.options].some(o => o.value === activeFolderFilter)) {
        tripFolderSelect.value = activeFolderFilter;
    }
    renderTripStatusFilters();
    updateTripModalHint();
    tripModal.classList.remove('hidden');
}

document.querySelectorAll('input[name="trip-mode"]').forEach(r =>
    r.addEventListener('change', updateTripModalHint));

function updateTripModalHint() {
    const places = tripPlacesForSelection(tripFolderSelect.value);
    const count = places.length;
    const days = parseInt(tripDaysInput.value) || 1;
    tripModalHint.innerHTML = '';

    if (count === 0) {
        tripModalHint.textContent = '⚠️ No pinned places match this selection and these statuses.';
        return;
    }

    const { totalKm, recommended } = estimateTripNeeds(places, tripMode());
    const perDay = Math.ceil(count / Math.min(days, count));
    const kmText = totalKm < 10 ? totalKm.toFixed(1) : Math.round(totalKm).toLocaleString();

    let html = `${count} places, ~${kmText} km total → about ${perDay} stop${perDay > 1 ? 's' : ''} per day.`;
    if (days < recommended) {
        html += `<div class="trip-hint-warning">⚠️ Tight! ${tripMode() === 'drive' ? 'Driving' : 'Walking'} this comfortably needs about
            <button id="trip-use-recommended" class="trip-use-days-btn">${recommended} days — use it</button></div>`;
    } else {
        html += `<div class="trip-hint-ok">✅ Comfortable pace for ${tripMode() === 'drive' ? 'driving' : 'walking'}.</div>`;
    }
    tripModalHint.innerHTML = html;

    document.getElementById('trip-use-recommended')?.addEventListener('click', () => {
        tripDaysInput.value = recommended;
        updateTripModalHint();
    });
}

document.getElementById('trip-planner-btn')?.addEventListener('click', () => {
    closeDrawer();
    openTripModal();
});
document.getElementById('trip-modal-close')?.addEventListener('click', () => tripModal.classList.add('hidden'));
document.getElementById('trip-modal-backdrop')?.addEventListener('click', () => tripModal.classList.add('hidden'));
tripFolderSelect?.addEventListener('change', updateTripModalHint);
tripDaysInput?.addEventListener('input', updateTripModalHint);

document.getElementById('trip-generate-btn')?.addEventListener('click', () => {
    const selection = tripFolderSelect.value;
    const places = tripPlacesForSelection(selection);
    if (places.length === 0) { updateTripModalHint(); return; }
    let days = Math.max(1, Math.min(14, parseInt(tripDaysInput.value) || 3));
    days = Math.min(days, places.length);

    tripState.days = planTrip(places, days);
    tripState.active = true;
    tripState.activeDay = 0;
    tripState.label = selection === '__all__' ? 'All places'
        : selection.startsWith('country:') ? selection.slice(8)
        : selection;

    tripModal.classList.add('hidden');
    document.getElementById('triage-panel').classList.add('hidden');
    renderTripPanel();
    renderTripMarkers();
    if (isMobile()) setSheetState('collapsed');
    // Zoom to day 1
    zoomToDay(0);
});

// ── Trip rendering ──────────────────────────────────────────────────────────

function zoomToDay(dayIdx) {
    const stops = tripState.days[dayIdx];
    if (!stops || !map) return;
    map.fitBounds(L.latLngBounds(stops.map(p => [p.lat, p.lng])), { padding: [60, 60], maxZoom: 15 });
}

function exitTrip() {
    tripState.active = false;
    tripState.days = [];
    if (tripLayer) tripLayer.clearLayers();
    document.getElementById('trip-panel').classList.add('hidden');
    persistActiveTrip();
    applyFiltersAndRender();
    fitMapToBounds();
}

document.getElementById('trip-exit-btn')?.addEventListener('click', exitTrip);

document.getElementById('trip-save-btn')?.addEventListener('click', () => {
    if (!tripState.active || !tripState.days.length) return;
    const name = prompt('Name this trip:', tripState.label);
    if (!name || !name.trim()) return;

    savedTrips.push({
        id: `trip-${Date.now()}`,
        name: name.trim(),
        days: tripDaysToIds(tripState.days),
        createdAt: Date.now()
    });
    saveTrips();
    renderSavedTripsList();
    showImportToast(`✅ Saved "${name.trim()}"`);
});

let tripLayer = null;

function renderTripMarkers() {
    clusterGroup.clearLayers();
    markers = [];
    if (!tripLayer) tripLayer = L.layerGroup().addTo(map);
    tripLayer.clearLayers();
    tripState.days.forEach((stops, dayIdx) => {
        const color = DAY_COLORS[dayIdx % DAY_COLORS.length];
        const dimmed = dayIdx !== tripState.activeDay;
        stops.forEach((place, stopIdx) => {
            const icon = L.divIcon({
                className: 'custom-marker',
                html: `<div class="trip-marker${dimmed ? ' trip-marker-dim' : ''}" style="--day-color:${color}">${stopIdx + 1}</div>`,
                iconSize: [30, 30],
                iconAnchor: [15, 15]
            });
            const marker = L.marker([place.lat, place.lng], { icon });
            marker.bindTooltip(`Day ${dayIdx + 1} · ${place.name}`, { direction: 'top', offset: [0, -12] });
            marker.on('click', () => {
                tripState.activeDay = dayIdx;
                renderTripPanel();
                renderTripMarkers();
            });
            tripLayer.addLayer(marker);
            markers.push(marker);
        });
        // Connect the day's stops with a line (only the active day)
        if (!dimmed && stops.length > 1) {
            const line = L.polyline(stops.map(p => [p.lat, p.lng]), {
                color, weight: 3, opacity: 0.65, dashArray: '6 8'
            });
            tripLayer.addLayer(line);
        }
    });
}

function renderTripPanel() {
    const panel = document.getElementById('trip-panel');
    const tabs = document.getElementById('trip-day-tabs');
    const body = document.getElementById('trip-day-body');
    document.getElementById('trip-panel-title').textContent = `🗂️ ${tripState.label}`;
    const totalStops = tripState.days.reduce((s, d) => s + d.length, 0);
    document.getElementById('trip-panel-subtitle').textContent = `${tripState.days.length} days · ${totalStops} stops`;

    tabs.innerHTML = '';
    tripState.days.forEach((stops, i) => {
        const btn = document.createElement('button');
        btn.className = 'trip-day-tab' + (i === tripState.activeDay ? ' active' : '');
        btn.style.setProperty('--day-color', DAY_COLORS[i % DAY_COLORS.length]);
        btn.textContent = `Day ${i + 1}`;
        btn.addEventListener('click', () => {
            tripState.activeDay = i;
            renderTripPanel();
            renderTripMarkers();
            zoomToDay(i);
        });
        tabs.appendChild(btn);
    });

    const dayIdx = tripState.activeDay;
    const stops = tripState.days[dayIdx];
    const color = DAY_COLORS[dayIdx % DAY_COLORS.length];
    const dist = routeDistanceKm(stops);

    body.innerHTML = '';
    const meta = document.createElement('div');
    meta.className = 'trip-day-meta';
    meta.innerHTML = `<span>${stops.length} stop${stops.length > 1 ? 's' : ''} · ~${dist < 10 ? dist.toFixed(1) : Math.round(dist)} km</span>
        <a href="${gmapsDirectionsUrl(stops)}" target="_blank" rel="noopener noreferrer" class="trip-gmaps-link">🧭 Directions</a>`;
    body.appendChild(meta);

    const list = document.createElement('ol');
    list.className = 'trip-stop-list';
    stops.forEach((place, i) => {
        const data = triageData[place.id] || { category: 'Other' };
        const catConf = getCatConf(data.category);
        const li = document.createElement('li');
        li.className = 'trip-stop';
        li.innerHTML = `
            <span class="trip-stop-num" style="--day-color:${color}">${i + 1}</span>
            <div class="trip-stop-info">
                <div class="trip-stop-name">${catConf.emoji} ${place.name}</div>
                <div class="trip-stop-addr">${place.address || ''}</div>
            </div>`;
        li.addEventListener('click', () => {
            map.flyTo([place.lat, place.lng], 16, { duration: 1 });
        });
        list.appendChild(li);
    });
    body.appendChild(list);

    panel.classList.remove('hidden');
    persistActiveTrip();
}