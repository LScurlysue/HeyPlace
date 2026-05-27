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
function initMap() {
    map = L.map('map').setView([0, 0], 2);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '© OpenStreetMap contributors'
    }).addTo(map);



    if (allPlaces.length > 0) {
        applyFiltersAndRender();
        fitMapToBounds();
    }
}

// Handle File Upload
fileUpload.addEventListener('change', function(e) {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const data = JSON.parse(e.target.result);
            if (data.features && Array.isArray(data.features)) {
                processData(data.features);
            } else {
                alert('Invalid file format. Expected a Google Takeout "Saved Places.json".');
            }
        } catch (error) {
            console.error(error);
            alert('Error parsing JSON file.');
        }
    };
    reader.readAsText(file);
});

// Process Features Array
function processData(features) {
    const newPlaces = features.map(feature => {
        const props = feature.properties || {};
        const geom = feature.geometry || {};
        const coords = geom.coordinates || [0, 0];
        const location = props.location || {};
        
        // Google puts Longitude first in coordinates array
        const lng = coords[0];
        const lat = coords[1];
        
        let name = location.name;
        if (!name) {
            name = `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
        }

        return {
            id: props.google_maps_url || `${lat}-${lng}`, // Fallback ID
            name: name,
            address: location.address || '',
            url: props.google_maps_url || '#',
            lat: lat,
            lng: lng
        };
    });

    const existingIds = new Set(allPlaces.map(p => p.id));
    const uniqueNew = newPlaces.filter(p => !existingIds.has(p.id));
    allPlaces = [...allPlaces, ...uniqueNew];
    localStorage.setItem('mapfolio_places', JSON.stringify(allPlaces));

    applyFiltersAndRender();
    fitMapToBounds();
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
            map.setView([place.lat, place.lng], 16);
            
            // Highlight active item
            document.querySelectorAll('.place-item').forEach(el => el.classList.remove('active'));
            li.classList.add('active');
        });

        placesList.appendChild(li);
    });
}

// Render Map Markers
function renderMap(places) {
    // Clear existing markers
    markers.forEach(m => map.removeLayer(m));
    markers = [];

    places.forEach(place => {
        const data = getTriageData(place.id);
        const catConf = categoryConfig[data.category] || categoryConfig['Other'];
        const statusClass = `status-${data.status.replace(/ /g, '-')}`;

        const customIcon = L.divIcon({
            className: 'custom-marker',
            html: `<div class="emoji-marker ${catConf.cssClass} ${statusClass}">${catConf.emoji}</div>`,
            iconSize: [32, 32],
            iconAnchor: [16, 16]
        });

        const marker = L.marker([place.lat, place.lng], { icon: customIcon }).addTo(map);
        
        marker.on('click', () => {
            openTriage(place);
            // Also highlight in sidebar if visible
            applyFiltersAndRender();
        });

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
    
    // Hide panel and clear
    nominatimPanel.classList.add('hidden');
    nominatimInput.value = '';
    nominatimResultsList.innerHTML = '';
    
    applyFiltersAndRender();
    const addedPlace = allPlaces.find(p => p.id === id);
    openTriage(addedPlace);
    map.setView([lat, lng], 16);
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
