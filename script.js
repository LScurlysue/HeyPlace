// State
let allPlaces = JSON.parse(localStorage.getItem('mapfolio_places')) || [];
// triageData format: { "google_maps_url": { category: "...", status: "..." } }
let triageData = JSON.parse(localStorage.getItem('mapfolio_triage')) || {};
let activePlace = null;
let map = null;
let markers = []; // Keep track of map markers

// DOM Elements
const fileUpload = document.getElementById('file-upload');
const placesList = document.getElementById('places-list');
const placeCount = document.getElementById('place-count');
const filterCategory = document.getElementById('filter-category');
const filterStatus = document.getElementById('filter-status');
const addManualBtn = document.getElementById('add-manual-btn');
let isAddingPlace = false;

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

    map.on('click', function(e) {
        if (!isAddingPlace) return;
        
        isAddingPlace = false;
        document.getElementById('map').classList.remove('map-adding');
        
        const lat = e.latlng.lat;
        const lng = e.latlng.lng;
        const id = `manual-${Date.now()}`;
        
        const newPlace = {
            id: id,
            name: 'New Place',
            address: `${lat.toFixed(5)}, ${lng.toFixed(5)}`,
            url: '#',
            lat: lat,
            lng: lng
        };
        
        allPlaces.push(newPlace);
        localStorage.setItem('mapfolio_places', JSON.stringify(allPlaces));
        
        triageData[id] = { category: 'Other', status: 'Unsorted' };
        localStorage.setItem('mapfolio_triage', JSON.stringify(triageData));
        
        applyFiltersAndRender();
        openTriage(newPlace);
    });

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

    const filteredPlaces = allPlaces.filter(place => {
        const data = getTriageData(place.id);
        
        const matchCategory = catFilter === 'All' || data.category === catFilter;
        const matchStatus = statFilter === 'All' || data.status === statFilter;
        
        return matchCategory && matchStatus;
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

        const colorClass = data.status.replace(/ /g, '-');
        
        li.innerHTML = `
            <div class="place-status-indicator marker-${colorClass}"></div>
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
        const colorClass = data.status.replace(/ /g, '-');

        const customIcon = L.divIcon({
            className: 'custom-marker',
            html: `<div class="marker-pin marker-${colorClass}"></div>`,
            iconSize: [30, 42],
            iconAnchor: [15, 42]
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

// Event Listeners
filterCategory.addEventListener('change', applyFiltersAndRender);
filterStatus.addEventListener('change', applyFiltersAndRender);

addManualBtn.addEventListener('click', () => {
    isAddingPlace = true;
    document.getElementById('map').classList.add('map-adding');
    // Provide a small hint to the user
    triagePanel.classList.add('hidden');
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

// Startup
document.addEventListener('DOMContentLoaded', initMap);
