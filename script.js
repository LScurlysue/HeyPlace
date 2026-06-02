// State
let allPlaces = JSON.parse(localStorage.getItem('mapfolio_places')) || [];
let triageData = JSON.parse(localStorage.getItem('mapfolio_triage')) || {};
let customFolders = JSON.parse(localStorage.getItem('mapfolio_folders')) || ["Favorites", "Want to Visit"];
let activePlace = null;
let map = null;
let markers = []; 
let clusterGroup = null;

const categoryConfig = {
    'Destination': { emoji: '🗺️', cssClass: 'cat-Destination' },
    'Hotel': { emoji: '🏨', cssClass: 'cat-Hotel' },
    'Restaurant': { emoji: '🍽️', cssClass: 'cat-Restaurant' },
    'Attractions': { emoji: '🏛️', cssClass: 'cat-Attractions' },
    'Experiences': { emoji: '🎯', cssClass: 'cat-Experiences' },
    'Beach': { emoji: '🏖️', cssClass: 'cat-Beach' },
    'Nature': { emoji: '🌿', cssClass: 'cat-Nature' },
    'Family/Kids': { emoji: '🎠', cssClass: 'cat-Family-Kids' },
    'Shopping': { emoji: '🛍️', cssClass: 'cat-Shopping' },
    'Parking/Fuel': { emoji: '🅿️', cssClass: 'cat-Parking-Fuel' },
    'Toilets': { emoji: '🚻', cssClass: 'cat-Toilets' },
    'Other': { emoji: '📍', cssClass: 'cat-Other' }
};

let customCategories = JSON.parse(localStorage.getItem('mapfolio_custom_categories')) || [];

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

const fileUpload = document.getElementById('file-upload');
fileUpload.addEventListener('change', async function(e) {
    const files = Array.from(e.target.files);
    if (!files.length) return;

    for (const file of files) {
        const ext = file.name.split('.').pop().toLowerCase();
        const text = await readFileAsText(file);
        
        if (ext === 'csv') {
            processCSV(text, file.name.replace('.csv',''));
        } else if (ext === 'json') {
            const data = JSON.parse(text);
            if (Array.isArray(data)) processGeocodedJSON(data);
        }
    }
    fileUpload.value = '';
});

function readFileAsText(file) {
    return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = e => resolve(e.target.result);
        reader.readAsText(file);
    });
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

    lines.slice(1).forEach((line, i) => {
        if (!line.trim()) return;
        const cols = line.match(/(".*?"|[^,]+)(?=,|$)/g)?.map(c => c.replace(/"/g, '').trim()) || line.split(',').map(c => c.trim());
        
        let lat = latIdx >= 0 ? parseFloat(cols[latIdx]) : NaN;
        let lng = lngIdx >= 0 ? parseFloat(cols[lngIdx]) : NaN;
        const name = nameIdx >= 0 ? cols[nameIdx] : `Place ${i + 1}`;
        const address = addrIdx >= 0 ? cols[addrIdx] : '';
        const url = urlIdx >= 0 ? cols[urlIdx] : '#';

        const placeId = `imported-${filenameContext}-${i}-${Date.now()}`;

        // Flexible Fallback Strategy
        if (isNaN(lat) || isNaN(lng) || lat === 0) {
            const cleanQuery = `${name}, ${filenameContext}`;
            fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(cleanQuery)}`)
                .then(res => res.json())
                .then(results => {
                    if (results && results.length > 0) {
                        const matched = results[0];
                        allPlaces.push({
                            id: placeId,
                            name: name,
                            address: address || matched.display_name,
                            url: url,
                            lat: parseFloat(matched.lat),
                            lng: parseFloat(matched.lon)
                        });
                    } else {
                        // Keep it inside the session collection map view array as safe fallback
                        allPlaces.push({ id: placeId, name, address, url, lat: 0, lng: 0 });
                    }
                    saveState();
                    applyFiltersAndRender();
                }).catch(err => {
                    allPlaces.push({ id: placeId, name, address, url, lat: 0, lng: 0 });
                    saveState();
                    applyFiltersAndRender();
                });
        } else {
            allPlaces.push({ id: placeId, name, address, url, lat, lng });
        }
    });

    saveState();
    applyFiltersAndRender();
    showImportToast(`Import Processing complete.`);
}

function processGeocodedJSON(data) {
    data.forEach((item, i) => {
        const lat = item.lat || item.coordinates?.lat || item.extracted_coordinates?.lat;
        const lng = item.lng || item.coordinates?.lng || item.extracted_coordinates?.lng;
        allPlaces.push({
            id: item.id || `json-item-${i}-${Date.now()}`,
            name: item.name || 'Unnamed Place',
            address: item.address || item.notes || '',
            url: item.url || '#',
            lat: lat ? parseFloat(lat) : 0,
            lng: lng ? parseFloat(lng) : 0
        });
    });
    saveState();
    applyFiltersAndRender();
}

function renderFoldersList() {
    const listEl = document.getElementById('folders-list');
    listEl.innerHTML = '';

    customFolders.forEach((folder, index) => {
        const li = document.createElement('li');
        li.className = 'folder-item';
        li.innerHTML = `
            <span class="folder-name-text">📁 ${folder}</span>
            <div class="folder-actions">
                <button class="rename-folder-btn" data-index="${index}">✏️</button>
                <button class="delete-folder-btn" data-index="${index}">🗑️</button>
            </div>
        `;

        li.querySelector('.rename-folder-btn').addEventListener('click', (e) => {
            e.stopPropagation();
            const newName = prompt("Enter a new name for this folder:", folder);
            if (newName && newName.trim()) {
                customFolders[index] = newName.trim();
                saveState();
                renderFoldersList();
                populateDropdowns();
            }
        });

        li.querySelector('.delete-folder-btn').addEventListener('click', (e) => {
            e.stopPropagation();
            if (confirm(`Delete folder "${folder}"?`)) {
                customFolders.splice(index, 1);
                for (let id in triageData) {
                    if (triageData[id].folder === folder) triageData[id].folder = 'Uncategorized';
                }
                saveState();
                renderFoldersList();
                populateDropdowns();
            }
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
    const catFilter = document.getElementById('filter-category').value;
    const statFilter = document.getElementById('filter-status').value;
    const searchTerm = document.getElementById('local-search-input').value.toLowerCase().trim();

    const filteredPlaces = allPlaces.filter(place => {
        const data = triageData[place.id] || { category: 'Other', status: 'Unsorted', folder: 'Uncategorized' };
        const matchCategory = catFilter === 'All' || data.category === catFilter;
        const matchStatus = statFilter === 'All' || data.status === statFilter;
        const matchSearch = searchTerm === '' || place.name.toLowerCase().includes(searchTerm) || place.address.toLowerCase().includes(searchTerm);
        return matchCategory && matchStatus && matchSearch;
    });

    renderSidebarList(filteredPlaces);
    renderMapPins(filteredPlaces);
    document.getElementById('place-count').textContent = `(${filteredPlaces.length})`;
}

function renderSidebarList(places) {
    const container = document.getElementById('places-list');
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

        // If coordinates are zero/missing, add an indicator label next to the item name
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
        if (place.lat === 0 && place.lng === 0) return; // Skip rendering broken points on map completely until saved

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
    if (place.url === '#') {
        urlBtn.style.display = 'none';
    } else {
        urlBtn.style.display = 'inline-block';
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
    applyFiltersAndRender();
}

// Handle Manual Coordinate Saving Entry
document.getElementById('save-coords-btn').addEventListener('click', () => {
    if (!activePlace) return;
    
    const inputtedLat = parseFloat(document.getElementById('triage-lat').value);
    const inputtedLng = parseFloat(document.getElementById('triage-lng').value);

    if (isNaN(inputtedLat) || isNaN(inputtedLng)) {
        alert("Please provide valid numeric coordinates first!");
        return;
    }

    // Update coordinates in original dataset
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
    
    // Pan directly over to the newly pinned spot
    map.flyTo([inputtedLat, inputtedLng], 14, { duration: 1.2 });
    showImportToast("Coordinates saved successfully!");
});

function fitMapToBounds() {
    if (allPlaces.length === 0) return;
    const validBounds = allPlaces.filter(p => p.lat !== 0 && !isNaN(p.lat)).map(p => [p.lat, p.lng]);
    if (validBounds.length > 0) map.fitBounds(L.latLngBounds(validBounds), { padding: [50, 50] });
}

function showImportToast(message) {
    let toast = document.getElementById('import-toast');
    if (!toast) {
        toast = document.createElement('div');
        toast.id = 'import-toast';
        toast.className = 'import-toast';
        document.body.appendChild(toast);
    }
    toast.textContent = `` + message;
    toast.classList.add('visible');
    setTimeout(() => toast.classList.remove('visible'), 3000);
}

document.getElementById('filter-category').addEventListener('change', applyFiltersAndRender);
document.getElementById('filter-status').addEventListener('change', applyFiltersAndRender);
document.getElementById('local-search-input').addEventListener('input', applyFiltersAndRender);
document.getElementById('close-triage').addEventListener('click', closeTriage);

document.getElementById('delete-place-btn').addEventListener('click', () => {
    document.getElementById('delete-confirm').classList.remove('hidden');
    document.getElementById('delete-place-btn').classList.add('hidden');
});

document.getElementById('cancel-delete-btn').addEventListener('click', () => {
    document.getElementById('delete-confirm').classList.add('hidden');
    document.getElementById('delete-place-btn').classList.remove('hidden');
});

document.getElementById('confirm-delete-btn').addEventListener('click', () => {
    if (!activePlace) return;
    allPlaces = allPlaces.filter(p => p.id !== activePlace.id);
    delete triageData[activePlace.id];
    saveState();
    closeTriage();
});

document.addEventListener('DOMContentLoaded', initMap);