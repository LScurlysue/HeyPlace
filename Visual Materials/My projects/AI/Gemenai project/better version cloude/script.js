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

// ADD THIS LINE HERE TO DEFINE THE FILE UPLOADER ELEMENT:
const fileUpload = document.getElementById('file-upload');

const categoryConfig = {
    'City / Region':       { emoji: '🗺️', cssClass: 'cat-City' },
    'Hotel':               { emoji: '🏨', cssClass: 'cat-Hotel' },
    'Restaurant':          { emoji: '🍽️', cssClass: 'cat-Restaurant' },
    'Café / Bar':          { emoji: '☕', cssClass: 'cat-Cafe' },
    'Museum / Gallery':    { emoji: '🏛️', cssClass: 'cat-Museum' },
    'Monument / Landmark': { emoji: '🏰', cssClass: 'cat-Monument' },
    'Activity':            { emoji: '🎯', cssClass: 'cat-Activity' },
    'Beach':               { emoji: '🏖️', cssClass: 'cat-Beach' },
    'Nature':              { emoji: '🌿', cssClass: 'cat-Nature' },
    'Viewpoint':           { emoji: '👁️', cssClass: 'cat-Viewpoint' },
    'Market':              { emoji: '🛒', cssClass: 'cat-Market' },
    'Spa / Wellness':      { emoji: '💆', cssClass: 'cat-Spa' },
    'Entertainment':       { emoji: '🎭', cssClass: 'cat-Entertainment' },
    'Shopping':            { emoji: '🛍️', cssClass: 'cat-Shopping' },
    'Parking / Fuel':      { emoji: '🅿️', cssClass: 'cat-Parking' },
    'Toilets':             { emoji: '🚻', cssClass: 'cat-Toilets' },
    'Other':               { emoji: '📍', cssClass: 'cat-Other' }
};

// Resolve category config — built-in or custom
function getCatConf(categoryName) {
    if (categoryConfig[categoryName]) return categoryConfig[categoryName];
    const custom = customCategories.find(c => c.name === categoryName);
    if (custom) return { emoji: custom.emoji, cssClass: 'cat-Custom' };
    return categoryConfig['Other'];
}

// Auto-category keyword detection
function detectCategory(name, address) {
    const text = (name + ' ' + (address || '')).toLowerCase();
    const rules = [
        { cat: 'Hotel',               words: ['hotel','inn','hostel','auberge','b&b','bed and breakfast','lodge','motel','guesthouse','pension','resort','riad'] },
        { cat: 'Restaurant',          words: ['restaurant','brasserie','bistro','pizzeria','trattoria','sushi','steakhouse','tavern','eatery','diner','grill','cantina','bodega','kebab','burger','noodle','ramen','barbeque','bbq','creperie','crêperie','winery','brewery'] },
        { cat: 'Café / Bar',          words: ['café','cafe','coffee','tea room','tearoom','patisserie','pâtisserie','bakery','boulangerie','bar','pub','tavern','cocktail','lounge','wine bar','brasserie café','kiosk'] },
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
    for (const rule of rules) {
        if (rule.words.some(w => text.includes(w))) return rule.cat;
    }
    return 'Other';
}

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
    }

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
    const address = descriptionEl ? descriptionEl.textContent.trim() : '';

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

    allPlaces.push({
        id: placeId,
        name: name,
        address: address || 'Imported via KMZ metadata layer.',
        url: '#',
        lat: isNaN(lat) ? 0 : lat,
        lng: isNaN(lng) ? 0 : lng
    });
    importedCount++;
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

function geocodePlace(query, callback) {
    geocodeQueue.push({ query, callback });
    if (!geocodeRunning) runGeocodeQueue();
}

function runGeocodeQueue() {
    if (geocodeQueue.length === 0) { geocodeRunning = false; return; }
    geocodeRunning = true;
    const { query, callback } = geocodeQueue.shift();
    const nominatimUrl = `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(query)}`;
    fetch(nominatimUrl, { headers: { 'Accept-Language': 'en', 'User-Agent': 'Mapfolio/1.0' } })
        .then(res => res.json())
        .then(results => { callback(Array.isArray(results) ? results[0] || null : null); })
        .catch(() => { callback(null); })
        .finally(() => { setTimeout(runGeocodeQueue, 1100); });
}

function processCSV(text, filenameContext) {
    const lines = text.trim().split('\n');
    if (lines.length < 2) return;

    const headers = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/"/g, ''));
    const nameIdx = headers.findIndex(h => h.includes('name') || h.includes('title'));
    const latIdx = headers.findIndex(h => h.includes('lat'));
    const lngIdx = headers.findIndex(h => h.includes('lon') || h.includes('lng'));
    const addrIdx = headers.findIndex(h => h.includes('addr') || h.includes('address'));
    const urlIdx = headers.findIndex(h => h.includes('url'));
    const wktIdx = headers.findIndex(h => h === 'wkt' || h.includes('geometry') || h.includes('wkt'));

    lines.slice(1).forEach((line, i) => {
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
        const address = addrIdx >= 0 ? cols[addrIdx] : '';
        const url = urlIdx >= 0 ? cols[urlIdx] : '#';

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
                    allPlaces[idx].lat = parseFloat(result.lat);
                    allPlaces[idx].lng = parseFloat(result.lon);
                    saveState();
                    applyFiltersAndRender();
                }
            }
        });
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

        allPlaces.push({
            id: placeId,
            name,
            address: item.address || item.notes || '',
            url,
            lat: isNaN(lat) ? 0 : lat,
            lng: isNaN(lng) ? 0 : lng
        });

        triageData[placeId] = {
            category: detectCategory(name, item.address || ''),
            status: item.status || 'Unsorted',
            folder: folderName
        };

        // Geocode if no coordinates
        if (!lat || !lng) {
            geocodePlace(name, (result) => {
                if (result) {
                    const idx = allPlaces.findIndex(p => p.id === placeId);
                    if (idx >= 0) {
                        allPlaces[idx].lat = parseFloat(result.lat);
                        allPlaces[idx].lng = parseFloat(result.lon);
                        saveState();
                        applyFiltersAndRender();
                    }
                }
            });
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

    customFolders.forEach((folder, index) => {
        if (searchFolderTerm !== '' && !folder.toLowerCase().includes(searchFolderTerm)) {
            return; // Filter out search mismatches
        }

        const count = folderCounts[folder] || 0;
        const li = document.createElement('li');
        li.className = 'folder-item';
        li.style.display = 'flex';
        li.style.justifyContent = 'space-between';
        li.style.alignItems = 'center';
        li.style.padding = '0.5rem';
        li.style.cursor = 'pointer';

        li.innerHTML = `
            <span class="folder-name-text">📁 ${folder} <strong style="opacity: 0.7; font-size: 0.85em;">(${count})</strong></span>
            <div class="folder-actions" style="display:flex; gap:0.25rem;">
                <button class="rename-folder-btn" data-index="${index}" style="background:none; border:none; cursor:pointer;">✏️</button>
                <button class="delete-folder-btn" data-index="${index}" style="background:none; border:none; cursor:pointer;">🗑️</button>
            </div>
        `;
        if (activeFolderFilter === folder) {
            li.style.borderColor = 'var(--primary)';
            li.style.background = 'var(--item-hover)';
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

    const catFilter = document.getElementById('filter-category').value;
    const statFilter = document.getElementById('filter-status').value;
    const searchTerm = document.getElementById('local-search-input').value.toLowerCase().trim();

    const filteredPlaces = allPlaces.filter(place => {
        const data = triageData[place.id] || { category: 'Other', status: 'Unsorted', folder: 'Uncategorized' };
        const matchCategory = catFilter === 'All' || data.category === catFilter;
        const matchStatus = statFilter === 'All' || data.status === statFilter;
        const matchSearch = searchTerm === '' || place.name.toLowerCase().includes(searchTerm) || (place.address || '').toLowerCase().includes(searchTerm);
        const matchFolder = activeFolderFilter === null || (data.folder || 'Uncategorized') === activeFolderFilter;
        return matchCategory && matchStatus && matchSearch && matchFolder;
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

    places.forEach(place => {
        if (place.lat === 0 && place.lng === 0) return;

        const data = triageData[place.id] || { category: 'Other', status: 'Unsorted' };
        const catConf = getCatConf(data.category);
        const statusClass = `status-${data.status.replace(/ /g, '-')}`;

        const markerIcon = L.divIcon({
            className: 'custom-marker',
            html: `<div class="emoji-marker ${catConf.cssClass} ${statusClass}">${catConf.emoji}</div>`,
            iconSize: [34, 34],
            iconAnchor: [17, 17]
        });

        const marker = L.marker([place.lat, place.lng], { icon: markerIcon });
        marker.on('click', () => { openTriagePanel(place); });

        clusterGroup.addLayer(marker);
        markers.push(marker);
    });
}

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

    // Try Nominatim (address/name)
    async function tryNominatim(q) {
        const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(q)}`;
        const res = await fetch(url, { headers: { 'Accept-Language': 'en' }, signal });
        const data = await res.json();
        if (data && data.length > 0) return { lat: data[0].lat, lon: data[0].lon };
        return null;
    }

    // Try Photon (Komoot) — better POI coverage, no API key
    async function tryPhoton(q) {
        const url = `https://photon.komoot.io/api/?q=${encodeURIComponent(q)}&limit=1`;
        const res = await fetch(url, { signal });
        const data = await res.json();
        if (data && data.features && data.features.length > 0) {
            const [lon, lat] = data.features[0].geometry.coordinates;
            return { lat, lon };
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

document.getElementById('unpinned-header').addEventListener('click', () => {
    const list = document.getElementById('unpinned-list');
    list.classList.toggle('hidden');
});

document.getElementById('filter-category').addEventListener('change', applyFiltersAndRender);
document.getElementById('filter-status').addEventListener('change', applyFiltersAndRender);
document.getElementById('close-triage').addEventListener('click', closeTriage);

function renderCustomCategoryList() {
    const container = document.getElementById('custom-categories-list');
    container.innerHTML = '';

    if (customCategories.length === 0) {
        container.innerHTML = '<div style="font-size:0.78rem;opacity:0.5;padding:0.3rem 0;">No custom categories yet.</div>';
    } else {
        customCategories.forEach((cc, idx) => {
            const row = document.createElement('div');
            row.className = 'custom-cat-row';
            row.innerHTML = `<span>${cc.emoji} ${cc.name}</span><button class="custom-cat-delete" data-idx="${idx}" title="Delete">🗑️</button>`;
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
    const addRow = document.createElement('div');
    addRow.style.cssText = 'display:flex;gap:0.4rem;margin-top:0.4rem;';
    addRow.innerHTML = `
        <input id="new-cat-emoji" placeholder="😀" style="width:44px;padding:0.3rem;border:1px solid var(--border);border-radius:6px;background:var(--bg-main);color:var(--text-main);text-align:center;" maxlength="2"/>
        <input id="new-cat-name" placeholder="Category name" style="flex:1;padding:0.3rem 0.5rem;border:1px solid var(--border);border-radius:6px;background:var(--bg-main);color:var(--text-main);"/>
        <button id="new-cat-save" style="padding:0.3rem 0.6rem;background:var(--primary);color:#fff;border:none;border-radius:6px;cursor:pointer;font-size:0.8rem;">Add</button>
    `;
    container.appendChild(addRow);

    document.getElementById('new-cat-save').addEventListener('click', () => {
        const name = document.getElementById('new-cat-name').value.trim();
        const emoji = document.getElementById('new-cat-emoji').value.trim() || '📌';
        if (!name) return;
        if (customCategories.some(c => c.name.toLowerCase() === name.toLowerCase())) {
            alert('That category already exists.'); return;
        }
        customCategories.push({ name, emoji });
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
                const newPlace = { id: newId, name, address: addr, url: '#', lat, lng };
                allPlaces.push(newPlace);
                triageData[newId] = { category: detectCategory(name, addr), status: 'Unsorted', folder: 'Uncategorized' };
                saveState();
                populateDropdowns();
                applyFiltersAndRender();
                openTriagePanel(newPlace);
            });
            searchDropdown.appendChild(item);
        });
    }

    if (localMatches.length === 0 && nominatimResults.length === 0) {
        const item = document.createElement('div');
        item.className = 'dropdown-item';
        item.innerHTML = `<span class="item-icon">➕</span><div class="item-text"><div class="item-name">Add "${query}" as new place</div><div class="item-addr">We'll try to find the location automatically</div></div>`;
        item.addEventListener('click', () => {
            closeSearchDropdown();
            const name = query;
            searchInput.value = '';
            closeDrawer();
            const newId = `manual-${Date.now()}`;
            const newPlace = { id: newId, name, address: name, url: '#', lat: 0, lng: 0 };
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