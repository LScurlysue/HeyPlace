// State
let allPlaces = JSON.parse(localStorage.getItem('mapfolio_places')) || [];
// triageData format: { "google_maps_url": { category: "...", status: "..." } }
let triageData = JSON.parse(localStorage.getItem('mapfolio_triage')) || {};
let activePlace = null;
let map = null;
let markers = []; // Keep track of map markers

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

// Custom categories — stored as array of { name, emoji }
let customCategories = JSON.parse(localStorage.getItem('mapfolio_custom_categories')) || [];

// Emoji options for custom categories
const CUSTOM_EMOJIS = ['🍺','🥐','🍷','🎭','🏋️','🎨','🛺','⛪','🎪','🏇','🎵','🌮','🍜','☕','🛶','🧖','🎿','🏄','🎬','🛒','🍦','🎂','🍕','🥗','🏰','🌊','🚴','🎳','🎻','🦁'];

function saveCustomCategories() {
    localStorage.setItem('mapfolio_custom_categories', JSON.stringify(customCategories));
}

function getAllCategories() {
    const defaults = Object.keys(categoryConfig);
    const customs = customCategories.map(c => c.name);
    return [...defaults, ...customs];
}

function getCategoryConfig(name) {
    if (categoryConfig[name]) return categoryConfig[name];
    const custom = customCategories.find(c => c.name === name);
    if (custom) return { emoji: custom.emoji, cssClass: 'cat-custom' };
    return categoryConfig['Other'];
}

function populateCategoryDropdowns() {
    const selects = [
        document.getElementById('filter-category'),
        document.getElementById('triage-category')
    ];

    selects.forEach((select, i) => {
        // Save current value
        const current = select.value;

        // Clear and rebuild
        select.innerHTML = '';

        if (i === 0) {
            // Filter dropdown — starts with "All"
            select.innerHTML = '<option value="All">All Categories</option>';
        } else {
            // Triage dropdown — starts with prompt
            select.innerHTML = '<option value="Unassigned">Select a Category</option>';
        }

        // Default categories
        Object.keys(categoryConfig).forEach(name => {
            const opt = document.createElement('option');
            opt.value = name;
            opt.textContent = `${categoryConfig[name].emoji} ${name}`;
            select.appendChild(opt);
        });

        // Custom categories
        if (customCategories.length > 0) {
            const divider = document.createElement('option');
            divider.disabled = true;
            divider.textContent = '── My Categories ──';
            select.appendChild(divider);

            customCategories.forEach(cat => {
                const opt = document.createElement('option');
                opt.value = cat.name;
                opt.textContent = `${cat.emoji} ${cat.name}`;
                select.appendChild(opt);
            });
        }

        // Add "Create new" option only on triage dropdown
        if (i === 1) {
            const divider = document.createElement('option');
            divider.disabled = true;
            divider.textContent = '──────────────';
            select.appendChild(divider);

            const createOpt = document.createElement('option');
            createOpt.value = '__create__';
            createOpt.textContent = '＋ Create new category';
            select.appendChild(createOpt);
        }

        // Restore value if still valid
        if ([...select.options].some(o => o.value === current)) {
            select.value = current;
        }
    });
}

// Migration for old categories
const categoryMigration = {
    'Hotel/Accommodation': 'Hotel',
    'Restaurant/Cafe': 'Restaurant',
    'Nature/Park': 'Nature',
    'Family/Kids Activity': 'Family/Kids'
};
let needsSave = false;
for (let id in triageData) {
    if (categoryMigration[triageData[id].category]) {
        triageData[id].category = categoryMigration[triageData[id].category];
        needsSave = true;
    }
}
if (needsSave) {
    localStorage.setItem('mapfolio_triage', JSON.stringify(triageData));
}

// DOM Elements
const fileUpload = document.getElementById('file-upload');
const placesList = document.getElementById('places-list');
const placeCount = document.getElementById('place-count');
const filterCategory = document.getElementById('filter-category');
const filterStatus = document.getElementById('filter-status');

// Search Elements
const localSearchInput = document.getElementById('local-search-input');
const searchAddHint = document.getElementById('search-add-hint');
const searchWorldwideBtn = document.getElementById('search-worldwide-btn');
const nominatimResultsList = document.getElementById('nominatim-results');
const nominatimLoading = document.getElementById('nominatim-loading');


const triagePanel = document.getElementById('triage-panel');
const closeTriageBtn = document.getElementById('close-triage');
const triageTitle = document.getElementById('triage-title');
const triageAddress = document.getElementById('triage-address');
const triageUrl = document.getElementById('triage-url');
const triageCategory = document.getElementById('triage-category');
const triageStatus = document.getElementById('triage-status');

// Initialize Map
let clusterGroup = null;

function initMap() {
    map = L.map('map').setView([0, 0], 2);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '© OpenStreetMap contributors'
    }).addTo(map);

    // Marker cluster group — groups nearby pins when zoomed out
    clusterGroup = L.markerClusterGroup({
        maxClusterRadius: 50,
        spiderfyOnMaxZoom: true,
        showCoverageOnHover: false,
        zoomToBoundsOnClick: true
    });
    map.addLayer(clusterGroup);

    if (allPlaces.length > 0) {
        applyFiltersAndRender();
        fitMapToBounds();
    }
}

// Handle File Upload — supports JSON, KMZ, KML, CSV
fileUpload.addEventListener('change', async function(e) {
    const files = Array.from(e.target.files);
    if (!files.length) return;

    for (const file of files) {
        const ext = file.name.split('.').pop().toLowerCase();
        try {
            if (ext === 'json') {
                const text = await readFileAsText(file);
                const data = JSON.parse(text);
                if (data.features && Array.isArray(data.features)) {
                    // Google Takeout GeoJSON format
                    processGeoJSON(data.features);
                } else if (Array.isArray(data) && data[0]?.extracted_coordinates) {
                    // AI Studio parsed format
                    processAIStudioJSON(data);
                } else if (Array.isArray(data) && data[0]?.lat !== undefined && data[0]?.name) {
                    // Geocoded JSON format (from process_csv script)
                    processGeocodedJSON(data);
                } else {
                    alert(`${file.name}: Invalid JSON format.`);
                }
            } else if (ext === 'kmz') {
                await processKMZ(file);
            } else if (ext === 'kml') {
                const text = await readFileAsText(file);
                processKML(text, file.name.replace('.kml',''));
            } else if (ext === 'csv') {
                const text = await readFileAsText(file);
                processCSV(text);
            } else {
                alert(`${file.name}: Unsupported format.`);
            }
        } catch (err) {
            console.error(err);
            alert(`Error reading ${file.name}: ${err.message}`);
        }
    }
    // Reset input so same file can be re-uploaded
    fileUpload.value = '';
});

function readFileAsText(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = e => resolve(e.target.result);
        reader.onerror = () => reject(new Error('File read failed'));
        reader.readAsText(file);
    });
}

function readFileAsArrayBuffer(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = e => resolve(e.target.result);
        reader.onerror = () => reject(new Error('File read failed'));
        reader.readAsArrayBuffer(file);
    });
}

// Process geocoded JSON format (output from process_csv.py script)
function processGeocodedJSON(data) {
    const newPlaces = data
        .filter(item => item.lat && item.lng && item.lat !== 0 && item.lng !== 0)
        .map((item, i) => ({
            id: `geocoded-${i}-${item.lat}-${item.lng}`,
            name: item.name || 'Unnamed Place',
            address: item.address || '',
            url: item.url || '#',
            lat: parseFloat(item.lat),
            lng: parseFloat(item.lng)
        }));

    const added = mergeAndSave(newPlaces);
    showImportToast(`Geocoded JSON: ${added} places imported`);
}

// Process AI Studio parsed format
function processAIStudioJSON(data) {
    const newPlaces = data
        .filter(item => item.extracted_coordinates?.lat && item.extracted_coordinates?.lng)
        .map(item => {
            const lat = item.extracted_coordinates.lat;
            const lng = item.extracted_coordinates.lng;

            // Clean up bad names
            let name = item.name || 'Unnamed Place';
            // Skip YouTube links, image URLs saved as place names
            if (name.includes('youtube.com') || name.includes('ytimg.com') ||
                name.includes('googleusercontent.com') || name.includes('lh4.google')) {
                name = 'Unnamed Place';
            }
            // Clean up names with trailing URLs
            if (name.includes(',,http')) {
                name = name.split(',,')[0].trim();
            }

            return {
                id: item.place_id || `ai-${lat}-${lng}`,
                name,
                address: item.notes || '',
                url: item.raw_url || '#',
                lat,
                lng
            };
        })
        // Filter out places with clearly bad names
        .filter(p => p.name !== 'Place' && p.name.length > 0);

    const added = mergeAndSave(newPlaces);
    showImportToast(`AI Studio export: ${added} places imported`);
}

// Process Google Takeout GeoJSON
function processGeoJSON(features) {
    const newPlaces = features.map(feature => {
        const props = feature.properties || {};
        const geom = feature.geometry || {};
        const coords = geom.coordinates || [0, 0];
        const location = props.location || {};
        const lng = coords[0];
        const lat = coords[1];
        let name = location.name || `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
        return {
            id: props.google_maps_url || `geojson-${lat}-${lng}`,
            name,
            address: location.address || '',
            url: props.google_maps_url || '#',
            lat, lng
        };
    });
    mergeAndSave(newPlaces);
}

// Process KMZ file (zip containing doc.kml)
async function processKMZ(file) {
    const buffer = await readFileAsArrayBuffer(file);
    const zip = await JSZip.loadAsync(buffer);
    const kmlFile = zip.file('doc.kml');
    if (!kmlFile) throw new Error('No doc.kml found inside KMZ');
    const kmlText = await kmlFile.async('string');
    const mapName = file.name.replace('.kmz', '');
    processKML(kmlText, mapName);
}

// Process KML text
function processKML(kmlText, sourceName) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(kmlText, 'text/xml');
    const placemarks = doc.querySelectorAll('Placemark');
    const newPlaces = [];

    placemarks.forEach(pm => {
        const name = pm.querySelector('name')?.textContent?.trim() || 'Unnamed Place';
        const coordEl = pm.querySelector('coordinates');
        if (!coordEl) return;

        const parts = coordEl.textContent.trim().split(',');
        if (parts.length < 2) return;

        const lng = parseFloat(parts[0]);
        const lat = parseFloat(parts[1]);
        if (isNaN(lat) || isNaN(lng)) return;

        // Try to get folder name as a hint for category
        const folder = pm.closest('Folder');
        const folderName = folder?.querySelector('name')?.textContent?.trim() || '';

        const id = `kml-${sourceName}-${lat.toFixed(5)}-${lng.toFixed(5)}`;

        newPlaces.push({
            id,
            name,
            address: folderName ? `${folderName} · ${sourceName}` : sourceName,
            url: '#',
            lat,
            lng,
            sourceFolder: folderName
        });
    });

    const added = mergeAndSave(newPlaces);
    showImportToast(`${sourceName}: ${added} places imported`);
}

// Process CSV file — expects columns: name, lat, lng (and optionally address)
function processCSV(text) {
    const lines = text.trim().split('\n');
    if (lines.length < 2) return;

    const headers = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/"/g, ''));
    const nameIdx = headers.findIndex(h => h.includes('name') || h.includes('title'));
    const latIdx = headers.findIndex(h => h.includes('lat'));
    const lngIdx = headers.findIndex(h => h.includes('lon') || h.includes('lng'));
    const addrIdx = headers.findIndex(h => h.includes('addr') || h.includes('address'));

    if (latIdx === -1 || lngIdx === -1) {
        alert('CSV must have latitude and longitude columns.');
        return;
    }

    const newPlaces = [];
    lines.slice(1).forEach((line, i) => {
        // Handle quoted CSV values
        const cols = line.match(/(".*?"|[^,]+)(?=,|$)/g)?.map(c => c.replace(/"/g, '').trim()) || line.split(',').map(c => c.trim());
        const lat = parseFloat(cols[latIdx]);
        const lng = parseFloat(cols[lngIdx]);
        if (isNaN(lat) || isNaN(lng)) return;
        newPlaces.push({
            id: `csv-${i}-${lat}-${lng}`,
            name: nameIdx >= 0 ? cols[nameIdx] : `Place ${i + 1}`,
            address: addrIdx >= 0 ? cols[addrIdx] : '',
            url: '#',
            lat, lng
        });
    });

    const added = mergeAndSave(newPlaces);
    showImportToast(`CSV: ${added} places imported`);
}

// Merge new places with existing, avoid duplicates
function mergeAndSave(newPlaces) {
    const existingIds = new Set(allPlaces.map(p => p.id));
    const unique = newPlaces.filter(p => !existingIds.has(p.id));
    allPlaces = [...allPlaces, ...unique];
    localStorage.setItem('mapfolio_places', JSON.stringify(allPlaces));
    applyFiltersAndRender();
    fitMapToBounds();
    return unique.length;
}

// Toast notification for import feedback
function showImportToast(message) {
    let toast = document.getElementById('import-toast');
    if (!toast) {
        toast = document.createElement('div');
        toast.id = 'import-toast';
        toast.className = 'import-toast';
        document.body.appendChild(toast);
    }
    toast.textContent = `✅ ${message}`;
    toast.classList.add('visible');
    setTimeout(() => toast.classList.remove('visible'), 3000);
}


// Main Render Logic
function applyFiltersAndRender() {
    const catFilter = filterCategory.value;
    const statFilter = filterStatus.value;
    const searchTerm = localSearchInput.value.toLowerCase().trim();

    const filteredPlaces = allPlaces.filter(place => {
        const data = getTriageData(place.id);
        
        const matchCategory = catFilter === 'All' || data.category === catFilter;
        const matchStatus = statFilter === 'All' || data.status === statFilter;
        const matchSearch = searchTerm === '' || place.name.toLowerCase().includes(searchTerm) || place.address.toLowerCase().includes(searchTerm);
        
        return matchCategory && matchStatus && matchSearch;
    });

    renderSidebar(filteredPlaces);
    renderMap(filteredPlaces);
    placeCount.textContent = `(${filteredPlaces.length})`;
}

// Render Sidebar List
function renderSidebar(places) {
    placesList.innerHTML = '';
    
    if (places.length === 0) {
        placesList.innerHTML = '<div class="empty-state">No places found.</div>';
        return;
    }

    places.forEach(place => {
        const data = getTriageData(place.id);
        const li = document.createElement('li');
        li.className = 'place-item';
        if (activePlace && activePlace.id === place.id) {
            li.classList.add('active');
        }

        const catConf = categoryConfig[data.category] || categoryConfig['Other'];
        const statusClass = `status-${data.status.replace(/ /g, '-')}`;
        
        li.innerHTML = `
            <div class="place-status-indicator emoji-marker ${catConf.cssClass} ${statusClass}" style="width: 28px; height: 28px; font-size: 14px;">${catConf.emoji}</div>
            <div class="place-details">
                <div class="place-name" title="${place.name}">${place.name}</div>
                <div class="place-address" title="${place.address}">${place.address}</div>
                <div class="place-meta">${data.category}</div>
            </div>
        `;

        li.addEventListener('click', () => {
            openTriage(place);
            map.flyTo([place.lat, place.lng], 14, { duration: 1.2 });
            document.querySelectorAll('.place-item').forEach(el => el.classList.remove('active'));
            li.classList.add('active');
        });

        placesList.appendChild(li);
    });
}

// Render Map Markers
function renderMap(places) {
    // Clear existing markers from cluster group
    clusterGroup.clearLayers();
    markers = [];

    places.forEach(place => {
        const data = getTriageData(place.id);
        const catConf = getCategoryConfig(data.category);
        const statusClass = `status-${data.status.replace(/ /g, '-')}`;

        const customIcon = L.divIcon({
            className: 'custom-marker',
            html: `<div class="emoji-marker ${catConf.cssClass} ${statusClass}">${catConf.emoji}</div>`,
            iconSize: [32, 32],
            iconAnchor: [16, 16]
        });

        const marker = L.marker([place.lat, place.lng], { icon: customIcon });

        marker.on('click', () => {
            openTriage(place);
            applyFiltersAndRender();
        });

        clusterGroup.addLayer(marker);
        markers.push(marker);
    });
}

// Adjust map bounds to show all markers
function fitMapToBounds() {
    if (allPlaces.length === 0) return;
    const bounds = L.latLngBounds(allPlaces.map(p => [p.lat, p.lng]));
    map.fitBounds(bounds, { padding: [50, 50] });
}

// Triage Panel Logic
function openTriage(place) {
    activePlace = place;
    const data = getTriageData(place.id);

    triageTitle.value = place.name;
    triageAddress.value = place.address;
    
    if (place.url === '#') {
        triageUrl.style.display = 'none';
    } else {
        triageUrl.style.display = 'inline-block';
        triageUrl.href = place.url;
    }

    triageCategory.value = data.category;
    triageStatus.value = data.status;

    triagePanel.classList.remove('hidden');

    // Reset delete UI state
    document.getElementById('delete-confirm').classList.add('hidden');
    document.getElementById('delete-place-btn').classList.remove('hidden');
}

function closeTriage() {
    triagePanel.classList.add('hidden');
    activePlace = null;
    applyFiltersAndRender();
}

// Update Local Data
function updateTriageData() {
    if (!activePlace) return;

    triageData[activePlace.id] = {
        category: triageCategory.value,
        status: triageStatus.value
    };

    localStorage.setItem('mapfolio_triage', JSON.stringify(triageData));
    applyFiltersAndRender();
}

// Helper to get triage data with defaults
function getTriageData(id) {
    return triageData[id] || { category: 'Other', status: 'Unsorted' };
}

// Nominatim Search Logic
async function searchNominatim(query) {
    query = (query || '').trim();
    if (!query) return;

    nominatimResultsList.innerHTML = '';
    nominatimLoading.classList.remove('hidden');

    try {
        const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}`);
        const results = await response.json();
        
        nominatimLoading.classList.add('hidden');
        
        if (results.length === 0) {
            nominatimResultsList.innerHTML = '<li class="nominatim-msg">No results found.</li>';
            return;
        }

        results.forEach(result => {
            const li = document.createElement('li');
            li.className = 'nominatim-result-item';
            
            const name = result.name || result.display_name.split(',')[0];
            const address = result.display_name;
            
            li.innerHTML = `<strong>${name}</strong><br><span style="color:var(--text-muted)">${address}</span>`;
            
            li.addEventListener('click', () => {
                addNominatimPlace(result, name, address);
            });
            
            nominatimResultsList.appendChild(li);
        });
    } catch (err) {
        nominatimLoading.classList.add('hidden');
        nominatimResultsList.innerHTML = '<li class="nominatim-msg">Error fetching results.</li>';
        console.error(err);
    }
}

function addNominatimPlace(result, name, address) {
    const lat = parseFloat(result.lat);
    const lng = parseFloat(result.lon);
    const id = `osm-${result.place_id}`;
    
    // Check if already exists
    if (!allPlaces.some(p => p.id === id)) {
        const newPlace = {
            id: id,
            name: name,
            address: address,
            url: `https://www.openstreetmap.org/node/${result.osm_id}`,
            lat: lat,
            lng: lng
        };
        
        allPlaces.push(newPlace);
        localStorage.setItem('mapfolio_places', JSON.stringify(allPlaces));
        
        triageData[id] = { category: 'Other', status: 'Unsorted' };
        localStorage.setItem('mapfolio_triage', JSON.stringify(triageData));
    }
    
    // Clear search bar and results
    localSearchInput.value = '';
    nominatimResultsList.innerHTML = '';
    searchAddHint.classList.add('hidden');

    // Render first, then fly to location and open triage
    applyFiltersAndRender();
    const addedPlace = allPlaces.find(p => p.id === id);
    
    map.flyTo([lat, lng], 14, { duration: 1.2 });
    setTimeout(() => openTriage(addedPlace), 400);
}

// Event Listeners
filterCategory.addEventListener('change', applyFiltersAndRender);
filterStatus.addEventListener('change', applyFiltersAndRender);

// Unified smart search
localSearchInput.addEventListener('input', () => {
    applyFiltersAndRender();
    const query = localSearchInput.value.trim();
    // Show "Search worldwide" hint if typed something and no local results
    if (query.length > 2) {
        searchAddHint.classList.remove('hidden');
        searchWorldwideBtn.textContent = `🌍 Search worldwide for "${query}"`;
    } else {
        searchAddHint.classList.add('hidden');
        nominatimResultsList.innerHTML = '';
    }
});

searchWorldwideBtn.addEventListener('click', () => {
    searchNominatim(localSearchInput.value.trim());
});

localSearchInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter' && localSearchInput.value.trim().length > 2) {
        searchNominatim(localSearchInput.value.trim());
    }
});

triageTitle.addEventListener('input', () => {
    if (!activePlace) return;
    activePlace.name = triageTitle.value;
    localStorage.setItem('mapfolio_places', JSON.stringify(allPlaces));
    applyFiltersAndRender(); // re-render sidebar
});

triageAddress.addEventListener('input', () => {
    if (!activePlace) return;
    activePlace.address = triageAddress.value;
    localStorage.setItem('mapfolio_places', JSON.stringify(allPlaces));
    applyFiltersAndRender();
});

closeTriageBtn.addEventListener('click', closeTriage);
triageCategory.addEventListener('change', updateTriageData);
triageStatus.addEventListener('change', updateTriageData);

// Delete logic
const deletePlaceBtn = document.getElementById('delete-place-btn');
const deleteConfirm = document.getElementById('delete-confirm');
const confirmDeleteBtn = document.getElementById('confirm-delete-btn');
const cancelDeleteBtn = document.getElementById('cancel-delete-btn');

deletePlaceBtn.addEventListener('click', () => {
    deleteConfirm.classList.remove('hidden');
    deletePlaceBtn.classList.add('hidden');
});

cancelDeleteBtn.addEventListener('click', () => {
    deleteConfirm.classList.add('hidden');
    deletePlaceBtn.classList.remove('hidden');
});

confirmDeleteBtn.addEventListener('click', () => {
    if (!activePlace) return;
    // Remove from allPlaces
    allPlaces = allPlaces.filter(p => p.id !== activePlace.id);
    localStorage.setItem('mapfolio_places', JSON.stringify(allPlaces));
    // Remove from triageData
    delete triageData[activePlace.id];
    localStorage.setItem('mapfolio_triage', JSON.stringify(triageData));
    closeTriage();
});

// Startup
document.addEventListener('DOMContentLoaded', initMap);
