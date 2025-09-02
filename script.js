// Load Leaflet libraries
const leafletScript = document.createElement('script');
leafletScript.src = 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.js';
document.head.appendChild(leafletScript);

const drawScript = document.createElement('script');
drawScript.src = 'https://cdnjs.cloudflare.com/ajax/libs/leaflet.draw/1.0.4/leaflet.draw.js';
document.head.appendChild(drawScript);

// Global variables
let map;
let locations = [];
let currentMode = 'click';
let drawnItems;
let apiKey = '';
let selectedDateTime = null;

// Wait for Leaflet to load then initialize
leafletScript.onload = function() {
  drawScript.onload = function() {
    setTimeout(() => {
      initDateTime();
      initMap();
    }, 100);
  };
};

// Initialize date/time inputs with default values
function initDateTime() {
  const now = new Date();
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  
  // Set default date to tomorrow
  const dateStr = tomorrow.toISOString().split('T')[0];
  document.getElementById('dateInput').value = dateStr;
  
  // Set default time to 12:00
  document.getElementById('timeInput').value = '12:00';
  
  // Set the selectedDateTime
  updateSelectedDateTime();
}

function updateSelectedDateTime() {
  const dateInput = document.getElementById('dateInput').value;
  const timeInput = document.getElementById('timeInput').value;
  
  if (dateInput && timeInput) {
    selectedDateTime = new Date(`${dateInput}T${timeInput}:00`);
    
    // Update weather for all existing locations
    locations.forEach(location => {
      if (location.weather && !location.weather.error) {
        fetchWeatherData(location);
      }
    });
  }
}

function getWeatherIcon(weatherMain, clouds) {
  if (weatherMain === 'Clear') return '☀️';
  if (weatherMain === 'Clouds') {
    if (clouds < 30) return '🌤️';
    if (clouds < 70) return '⛅';
    return '☁️';
  }
  if (weatherMain === 'Rain') return '🌧️';
  if (weatherMain === 'Snow') return '❄️';
  if (weatherMain === 'Thunderstorm') return '⛈️';
  if (weatherMain === 'Drizzle') return '🌦️';
  if (weatherMain === 'Mist' || weatherMain === 'Fog') return '🌫️';
  return '🌤️'; // Default
}

function initMap() {
  drawnItems = new L.FeatureGroup();
  map = L.map('map').setView([46.5197, 6.6323], 7); // Centered on Alps

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© OpenStreetMap contributors'
  }).addTo(map);

  map.addLayer(drawnItems);

  // Add click handler for point mode
  map.on('click', function(e) {
    if (currentMode === 'click' && locations.length < 10) {
      addLocationByCoordinates(e.latlng.lat, e.latlng.lng);
    }
  });

  // Initialize drawing controls
  initDrawControls();
  updateModeButtons();
  setupEventListeners();
}

function initDrawControls() {
  const drawControl = new L.Control.Draw({
    position: 'topright',
    draw: {
      polygon: true,
      polyline: false,
      rectangle: false,
      circle: false,
      marker: false,
      circlemarker: false
    },
    edit: {
      featureGroup: drawnItems
    }
  });

  map.addControl(drawControl);

  map.on(L.Draw.Event.CREATED, function (e) {
    if (currentMode === 'polygon') {
      const layer = e.layer;
      drawnItems.addLayer(layer);
      if (e.layerType === 'polygon') {
        analyzePolygonWeather(layer);
      }
    }
  });
}

function setupEventListeners() {
  // Mode controls
  document.getElementById('clickMode').addEventListener('click', function() {
    currentMode = 'click';
    updateModeButtons();
  });

  document.getElementById('polygonMode').addEventListener('click', function() {
    currentMode = 'polygon';
    updateModeButtons();
  });

  document.getElementById('clearAll').addEventListener('click', function() {
    locations = [];
    drawnItems.clearLayers();
    updateLocationsList();
    map.eachLayer(function (layer) {
      if (layer instanceof L.Marker) {
        map.removeLayer(layer);
      }
    });
  });

  // Date/time input handlers
  document.getElementById('dateInput').addEventListener('change', updateSelectedDateTime);
  document.getElementById('timeInput').addEventListener('change', updateSelectedDateTime);

  // API key handling
  document.getElementById('apiKeyInput').addEventListener('input', function(e) {
    apiKey = e.target.value.trim();
    if (apiKey) {
      // Re-fetch weather for existing locations
      locations.forEach(loc => {
        if (!loc.weather) {
          fetchWeatherData(loc);
        }
      });
    }
  });

  // Enter key support for search
  document.getElementById('locationSearch').addEventListener('keypress', function(e) {
    if (e.key === 'Enter') {
      searchLocation();
    }
  });
}

function updateModeButtons() {
  document.querySelectorAll('.control-btn').forEach(btn => btn.classList.remove('active'));
  if (currentMode === 'click') {
    document.getElementById('clickMode').classList.add('active');
  } else if (currentMode === 'polygon') {
    document.getElementById('polygonMode').classList.add('active');
  }
}

// Search functionality
function searchLocation() {
  const query = document.getElementById('locationSearch').value.trim();
  if (!query) return;

  if (locations.length >= 10) {
    alert('Maximum 10 locations allowed. Clear some locations first.');
    return;
  }

  // Use Nominatim API for geocoding
  fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&countrycodes=ch,fr,it,at,de&limit=5`)
    .then(response => response.json())
    .then(data => {
      if (data.length > 0) {
        const result = data[0];
        addLocationByCoordinates(parseFloat(result.lat), parseFloat(result.lon), result.display_name);
        document.getElementById('locationSearch').value = '';
        // Center map on found location
        map.setView([result.lat, result.lon], 10);
      } else {
        alert('Location not found. Try searching for major Alpine cities like Chamonix, Zermatt, Innsbruck, etc.');
      }
    })
    .catch(error => {
      console.error('Geocoding error:', error);
      alert('Error searching for location. Please try again.');
    });
}

// Add location by coordinates
function addLocationByCoordinates(lat, lng, name = null) {
  if (locations.length >= 10) {
    alert('Maximum 10 locations allowed.');
    return;
  }

  const location = {
    id: Date.now(),
    lat: lat,
    lng: lng,
    name: name || `Location ${locations.length + 1}`,
    weather: null,
    marker: null
  };

  // Add marker to map
  const marker = L.marker([lat, lng]).addTo(map);
  marker.bindPopup(location.name);
  location.marker = marker;

  locations.push(location);

  // Fetch weather data if API key is available
  if (apiKey) {
    fetchWeatherData(location);
  }

  updateLocationsList();
}

// Fetch weather data from OpenWeatherMap
function fetchWeatherData(location) {
  if (!apiKey) {
    location.weather = { error: 'API key required' };
    updateLocationsList();
    return;
  }

  const url = `https://api.openweathermap.org/data/2.5/forecast?lat=${location.lat}&lon=${location.lng}&appid=${apiKey}&units=metric`;

  fetch(url)
    .then(response => response.json())
    .then(data => {
      if (data.cod === '200') {
        // Find forecast closest to selected date/time
        let closestForecast = data.list[0];
        let minDiff = Math.abs(new Date(data.list[0].dt * 1000) - selectedDateTime);

        data.list.forEach(forecast => {
          const forecastDate = new Date(forecast.dt * 1000);
          const diff = Math.abs(forecastDate - selectedDateTime);
          if (diff < minDiff) {
            minDiff = diff;
            closestForecast = forecast;
          }
        });

        // Calculate sunny score based on cloud cover and weather conditions
        const clouds = closestForecast.clouds.all;
        const weatherMain = closestForecast.weather[0].main;
        let sunnyScore = 100 - clouds;

        // Adjust score based on weather conditions
        if (weatherMain === 'Clear') sunnyScore = Math.max(sunnyScore, 90);
        else if (weatherMain === 'Clouds' && clouds < 30) sunnyScore = Math.max(sunnyScore, 75);
        else if (['Rain', 'Snow', 'Thunderstorm'].includes(weatherMain)) sunnyScore = Math.max(0, sunnyScore - 50);

        const weatherIcon = getWeatherIcon(weatherMain, clouds);

        location.weather = {
          temperature: Math.round(closestForecast.main.temp),
          description: closestForecast.weather[0].description,
          clouds: clouds,
          humidity: closestForecast.main.humidity,
          windSpeed: Math.round(closestForecast.wind.speed * 3.6), // Convert m/s to km/h
          sunnyScore: Math.round(sunnyScore),
          icon: closestForecast.weather[0].icon,
          weatherIcon: weatherIcon,
          weatherMain: weatherMain,
          date: new Date(closestForecast.dt * 1000)
        };

        // Update marker popup with weather icon
        if (location.marker) {
          location.marker.setIcon(L.divIcon({
            html: `<div class="map-weather-icon">${weatherIcon}</div>`,
            className: 'custom-div-icon',
            iconSize: [30, 30],
            iconAnchor: [15, 15]
          }));

          location.marker.bindPopup(`
            <strong>${location.name}</strong><br>
            ${weatherIcon} ${location.weather.temperature}°C<br>
            ${location.weather.description}<br>
            ☀️ Sunny Score: ${location.weather.sunnyScore}%
          `);
        }
      } else {
        location.weather = { error: 'Weather data unavailable' };
      }
      updateLocationsList();
    })
    .catch(error => {
      console.error('Weather API error:', error);
      location.weather = { error: 'Failed to fetch weather' };
      updateLocationsList();
    });
}

// Analyze weather in polygon area
function analyzePolygonWeather(polygonLayer) {
  const bounds = polygonLayer.getBounds();
  const center = bounds.getCenter();

  // Generate 5 sample points within the polygon
  const points = [
    center, // Center point
    bounds.getNorthEast(),
    bounds.getNorthWest(),
    bounds.getSouthEast(),
    bounds.getSouthWest()
  ];

  points.forEach((point, index) => {
    if (locations.length < 10) {
      addLocationByCoordinates(point.lat, point.lng, `Area Point ${index + 1}`);
    }
  });
}

// Update locations list display
function updateLocationsList() {
  const listElement = document.getElementById('locationsList');
  const titleElement = document.querySelector('.locations-list h3');
  titleElement.textContent = `📊 Weather Comparison (${locations.length}/10 locations)`;

  if (locations.length === 0) {
    listElement.innerHTML = '<div class="loading">Click on the map or search for locations to see tomorrow\'s weather forecast!</div>';
    return;
  }

  // Sort locations by sunny score (highest first)
  const sortedLocations = locations.slice().sort((a, b) => {
    if (!a.weather || !b.weather) return 0;
    if (a.weather.error || b.weather.error) return 0;
    return (b.weather.sunnyScore || 0) - (a.weather.sunnyScore || 0);
  });

  listElement.innerHTML = sortedLocations.map(location => {
    if (!location.weather) {
      return `
        <div class="location-card">
          <div class="location-name">${location.name}</div>
          <div class="loading">Loading weather data...</div>
        </div>
      `;
    }

    if (location.weather.error) {
      return `
        <div class="location-card">
          <div class="location-name">${location.name}</div>
          <div class="error">${location.weather.error}</div>
        </div>
      `;
    }

    const weather = location.weather;
    return `
      <div class="location-card">
        <div class="sunny-score">☀️ ${weather.sunnyScore}%</div>
        <div class="location-name">
          <span class="weather-icon">${weather.weatherIcon}</span>
          ${location.name}
        </div>
        <div class="weather-info">
          <div class="weather-detail">
            🌡️ ${weather.temperature}°C<br>
            <small>${weather.description}</small>
          </div>
          <div class="weather-detail">
            ☁️ ${weather.clouds}% clouds<br>
            <small>💨 ${weather.windSpeed} km/h</small>
          </div>
        </div>
      </div>
    `;
  }).join('');
}
