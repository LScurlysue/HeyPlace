// State
let allPlaces = JSON.parse(localStorage.getItem('mapfolio_places')) || [];
let triageData = JSON.parse(localStorage.getItem('mapfolio_triage')) || {};
let customFolders = JSON.parse(localStorage.getItem('mapfolio_folders')) || ["Want to Go", "Done"];
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
}

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
    }
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
    if (Array.isArray(data)) {
        processGeocodedJSON(data);
    } else if (data.features && Array.isArray(data.features)) {
        // Google Takeout GeoJSON format
        const normalized = data.features.map(f => ({
    name: f.properties?.location?.name || f.properties?.name || 'Unnamed Place',
    address: f.properties?.location?.address || '',
    url: f.properties?.google_maps_url || '#',
    lat: f.geometry?.coordinates?.[1] ?? 0,
    lng: f.geometry?.coordinates?.[0] ?? 0
}));
        processGeocodedJSON(normalized);
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
function processGeocodedJSON(data) {
    let importedCount = 0;
    data.forEach((item, i) => {
        const name = item.name || 'Unnamed Place';
      const url = item.url || '#';
const isDuplicate = url !== '#' && allPlaces.some(p => p.url === url);
if (isDuplicate) return;

        const lat = item.lat || item.coordinates?.lat || item.extracted_coordinates?.lat;
        const lng = item.lng || item.coordinates?.lng || item.extracted_coordinates?.lng;
        allPlaces.push({
            id: item.id || `json-item-${i}-${Date.now()}`,
            name: name,
            address: item.address || item.notes || '',
            url: item.url || '#',
            lat: lat ? parseFloat(lat) : 0,
            lng: lng ? parseFloat(lng) : 0
        });
        importedCount++;
    });
    saveState();
    applyFiltersAndRender();
    fitMapToBounds();
    showImportToast(`Imported ${importedCount} new places from JSON (${data.length - importedCount} duplicates skipped).`);
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
    renderFoldersList();
    applyFiltersAndRender();
});
        listEl.appendChild(li);
    });
}

document.getElementById('add-folder-btn').addEventListener('click', () => {
    const folderName = prompt("Enter name for new folder:");
    if (folderName && folderName.trim()) {
        customFolders.push(folderName.trim());
        saveState();
        renderFoldersList();
        populateDropdowns();
    }
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

        const catConf = categoryConfig[data.category] || categoryConfig['Other'];
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
        const catConf = categoryConfig[data.category] || categoryConfig['Other'];
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
}

function closeTriage() {
    document.getElementById('triage-panel').classList.add('hidden');
    activePlace = null;
    applyFiltersAndRender();
}

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
    showImportToast("Layout modifications saved successfully!");
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
                applyFiltersAndRender();
                const lat = parseFloat(result.lat);
                const lng = parseFloat(result.lon);
                map.flyTo([lat, lng], 15, { duration: 1.2 });
                // Create new place and open triage panel
                const newId = `manual-${Date.now()}`;
                const newPlace = { id: newId, name, address: addr, url: '#', lat, lng };
                allPlaces.push(newPlace);
                triageData[newId] = { category: 'Other', status: 'Unsorted', folder: 'Uncategorized' };
                saveState();
                populateDropdowns();
                applyFiltersAndRender();
                openTriagePanel(newPlace);
            });
            searchDropdown.appendChild(item);
        });
    }

    if (searchDropdown.children.length === 0) {
        searchDropdown.innerHTML = '<div class="dropdown-item" style="opacity:0.5;cursor:default;">No results found</div>';
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
    if (e.key === 'Escape') closeSearchDropdown();
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