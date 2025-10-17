console.log('Advanced Alpine Weather App initializing...');

// Global variables
let map;
let locations = [];
let currentMode = 'click';
let drawnItems;
let apiKeys = {
  openWeather: '',
  weatherApi: ''
};
let selectedDateTime = null;

// Enhanced library loading
function loadScript(src) {
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = src;
    script.onload = resolve;
    script.onerror = reject;
    document.head.appendChild(script);
  });
}

// Initialize the complete app
async function initializeCompleteApp() {
  try {
    console.log('Loading Leaflet library...');
    await loadScript('https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.js');
    
    console.log('Loading Leaflet Draw plugin...');
    await loadScript('https://cdnjs.cloudflare.com/ajax/libs/leaflet.draw/1.0.4/leaflet.draw.js');
    
    console.log('All libraries loaded successfully!');
    setTimeout(() => {
      initDateTime();
      initMap();
      console.log('Complete Alpine Weather App ready!');
    }, 100);
    
  } catch (error) {
    console.error('Library loading failed:', error);
    alert('Failed to load map libraries. Please refresh the page.');
  }
}

// Initialize date/time inputs with default values
function initDateTime() {
  const now = new Date();
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  
  const dateStr = tomorrow.toISOString().split('T')[0];
  document.getElementById('dateInput').value = dateStr;
  document.getElementById('timeInput').value = '12:00';
  
  updateSelectedDateTime();
}

function updateSelectedDateTime() {
  const dateInput = document.getElementById('dateInput').value;
  const timeInput = document.getElementById('timeInput').value;
  
  if (dateInput && timeInput) {
    selectedDateTime = new Date(dateInput + 'T' + timeInput + ':00');
    
    // Update weather for all existing locations
    locations.forEach(location => {
      if (location.weather && !location.weather.error) {
        fetchWeatherData(location);
      }
    });
  }
}

function initMap() {
  console.log('Initializing interactive map...');
  try {
    drawnItems = new L.FeatureGroup();
    map = L.map('map').setView([46.5197, 6.6323], 7);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors'
    }).addTo(map);

    map.addLayer(drawnItems);

    map.on('click', function(e) {
      if (currentMode === 'click' && locations.length < 10) {
        addLocationByCoordinates(e.latlng.lat, e.latlng.lng);
      }
    });

    initDrawControls();
    updateModeButtons();
    setupEventListeners();
    console.log('Map initialized with full functionality!');
    
  } catch (error) {
    console.error('Map initialization error:', error);
  }
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

  // Multi-source API key handling
  document.getElementById('openWeatherApiKey').addEventListener('input', function(e) {
    apiKeys.openWeather = e.target.value.trim();
    if (apiKeys.openWeather) {
      locations.forEach(loc => fetchWeatherData(loc));
    }
  });

  document.getElementById('weatherApiKey').addEventListener('input', function(e) {
    apiKeys.weatherApi = e.target.value.trim();
    if (apiKeys.weatherApi) {
      locations.forEach(loc => fetchWeatherData(loc));
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

// Enhanced search functionality
function searchLocation() {
  const query = document.getElementById('locationSearch').value.trim();
  if (!query) return;

  if (locations.length >= 10) {
    alert('Maximum 10 locations allowed. Clear some locations first.');
    return;
  }

  fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&countrycodes=ch,fr,it,at,de&limit=5`)
    .then(response => response.json())
    .then(data => {
      if (data.length > 0) {
        const result = data[0];
        addLocationByCoordinates(parseFloat(result.lat), parseFloat(result.lon), result.display_name);
        document.getElementById('locationSearch').value = '';
        map.setView([result.lat, result.lon], 10);
      } else {
        alert('Location not found. Try searching for major Alpine cities like Chamonix, Zermatt, Innsbruck, etc.');
      }
    })
    .catch(error => {
      console.error('Search error:', error);
      alert('Error searching for location. Please try again.');
    });
}

// Reverse geocoding to get place names
async function reverseGeocode(lat, lng) {
  const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=12&accept-language=en`;
  
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'AlpineSunnySpots/1.0'
      }
    });
    
    const data = await response.json();
    
    if (data && data.address) {
      const address = data.address;
      
      // Priority: village > town > city > municipality > county
      const placeName = 
        address.village || 
        address.town || 
        address.city || 
        address.municipality || 
        address.hamlet ||
        address.county ||
        address.state ||
        'Unknown Location';
      
      // Add country for context
      const country = address.country_code ? ` (${address.country_code.toUpperCase()})` : '';
      
      return `${placeName}${country}`;
    }
    
    return `Location (${lat.toFixed(2)}, ${lng.toFixed(2)})`;
    
  } catch (error) {
    console.error('Reverse geocoding error:', error);
    return `Location (${lat.toFixed(2)}, ${lng.toFixed(2)})`;
  }
}

// Add location with automatic place name
async function addLocationByCoordinates(lat, lng, name) {
  if (locations.length >= 10) {
    alert('Maximum 10 locations allowed.');
    return;
  }

  // If no name provided, get it from reverse geocoding
  if (!name) {
    try {
      name = await reverseGeocode(lat, lng);
    } catch (error) {
      console.error('Reverse geocoding failed:', error);
      name = `Location ${locations.length + 1}`;
    }
  }

  const location = {
    id: Date.now(),
    lat: lat,
    lng: lng,
    name: name,
    weather: null,
    marker: null
  };

  const marker = L.marker([lat, lng]).addTo(map);
  marker.bindPopup(name);
  location.marker = marker;

  locations.push(location);
  fetchWeatherData(location);
  updateLocationsList();
}

// Multi-source weather data fetching
async function fetchWeatherData(location) {
  location.weatherSources = {};
  location.loading = true;
  updateLocationsList();

  const promises = [
    fetchOpenMeteoWeather(location),
    fetchOpenWeatherMapWeather(location),
    fetchWeatherApiWeather(location)
  ];

  await Promise.allSettled(promises);
  
  location.weather = calculateConsensusWeather(location);
  location.loading = false;
  updateLocationsList();
  updateMarker(location);
}

// Open-Meteo API (always free, no key needed)
async function fetchOpenMeteoWeather(location) {
  try {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${location.lat}&longitude=${location.lng}&hourly=temperature_2m,relative_humidity_2m,weather_code,cloud_cover,wind_speed_10m,wind_direction_10m,uv_index,visibility&timezone=Europe/Zurich&forecast_days=7`;
    
    const response = await fetch(url);
    const data = await response.json();
    
    if (data.hourly) {
      const timeIndex = findClosestTimeIndex(data.hourly.time, selectedDateTime);
      const weatherCode = data.hourly.weather_code[timeIndex];
      const weatherInfo = getWeatherFromCode(weatherCode);
      
      location.weatherSources.openMeteo = {
        temperature: Math.round(data.hourly.temperature_2m[timeIndex]),
        humidity: data.hourly.relative_humidity_2m[timeIndex],
        clouds: data.hourly.cloud_cover[timeIndex],
        windSpeed: Math.round(data.hourly.wind_speed_10m[timeIndex] * 3.6),
        windDirection: data.hourly.wind_direction_10m[timeIndex],
        uvIndex: data.hourly.uv_index[timeIndex] || 0,
        visibility: data.hourly.visibility[timeIndex] || 10000,
        weatherMain: weatherInfo.main,
        description: weatherInfo.description,
        icon: weatherInfo.icon,
        source: 'Open-Meteo',
        success: true
      };
    }
  } catch (error) {
    console.error('Open-Meteo error:', error);
    location.weatherSources.openMeteo = { success: false, error: 'API Error' };
  }
}

// OpenWeatherMap API
async function fetchOpenWeatherMapWeather(location) {
  if (!apiKeys.openWeather) {
    location.weatherSources.openWeather = { success: false, error: 'No API Key' };
    return;
  }

  try {
    const url = `https://api.openweathermap.org/data/2.5/forecast?lat=${location.lat}&lon=${location.lng}&appid=${apiKeys.openWeather}&units=metric`;
    const response = await fetch(url);
    const data = await response.json();

    if (data.cod === '200') {
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

      location.weatherSources.openWeather = {
        temperature: Math.round(closestForecast.main.temp),
        feelsLike: Math.round(closestForecast.main.feels_like),
        humidity: closestForecast.main.humidity,
        clouds: closestForecast.clouds.all,
        windSpeed: Math.round(closestForecast.wind.speed * 3.6),
        windDirection: closestForecast.wind.deg || 0,
        pressure: closestForecast.main.pressure,
        visibility: closestForecast.visibility || 10000,
        weatherMain: closestForecast.weather[0].main,
        description: closestForecast.weather[0].description,
        icon: getWeatherIcon(closestForecast.weather[0].main, closestForecast.clouds.all),
        source: 'OpenWeatherMap',
        success: true
      };
    } else {
      location.weatherSources.openWeather = { success: false, error: 'API Error' };
    }
  } catch (error) {
    console.error('OpenWeatherMap error:', error);
    location.weatherSources.openWeather = { success: false, error: 'Network Error' };
  }
}

// WeatherAPI.com
async function fetchWeatherApiWeather(location) {
  if (!apiKeys.weatherApi) {
    location.weatherSources.weatherApi = { success: false, error: 'No API Key' };
    return;
  }

  try {
    const targetDate = selectedDateTime.toISOString().split('T')[0];
    const targetHour = selectedDateTime.getHours();
    const url = `https://api.weatherapi.com/v1/forecast.json?key=${apiKeys.weatherApi}&q=${location.lat},${location.lng}&days=7&aqi=yes&alerts=no`;
    
    const response = await fetch(url);
    const data = await response.json();

    if (data.forecast && data.forecast.forecastday) {
      const forecastDay = data.forecast.forecastday.find(day => day.date === targetDate) || data.forecast.forecastday[0];
      const hourData = forecastDay.hour.find(h => new Date(h.time).getHours() === targetHour) || forecastDay.hour[12];

      location.weatherSources.weatherApi = {
        temperature: Math.round(hourData.temp_c),
        feelsLike: Math.round(hourData.feelslike_c),
        humidity: hourData.humidity,
        clouds: hourData.cloud,
        windSpeed: Math.round(hourData.wind_kph),
        windDirection: hourData.wind_degree,
        pressure: hourData.pressure_mb,
        visibility: hourData.vis_km,
        uvIndex: hourData.uv,
        weatherMain: getWeatherMainFromCondition(hourData.condition.text),
        description: hourData.condition.text.toLowerCase(),
        icon: getWeatherIconFromCondition(hourData.condition.text),
        source: 'WeatherAPI',
        success: true
      };
    } else {
      location.weatherSources.weatherApi = { success: false, error: 'No Data' };
    }
  } catch (error) {
    console.error('WeatherAPI error:', error);
    location.weatherSources.weatherApi = { success: false, error: 'Network Error' };
  }
}

// Helper functions
function findClosestTimeIndex(timeArray, targetTime) {
  let closestIndex = 0;
  let minDiff = Math.abs(new Date(timeArray[0]) - targetTime);

  timeArray.forEach((time, index) => {
    const diff = Math.abs(new Date(time) - targetTime);
    if (diff < minDiff) {
      minDiff = diff;
      closestIndex = index;
    }
  });

  return closestIndex;
}

function getWeatherFromCode(code) {
  const weatherCodes = {
    0: { main: 'Clear', description: 'clear sky', icon: '☀️' },
    1: { main: 'Clouds', description: 'mainly clear', icon: '🌤️' },
    2: { main: 'Clouds', description: 'partly cloudy', icon: '⛅' },
    3: { main: 'Clouds', description: 'overcast', icon: '☁️' },
    45: { main: 'Fog', description: 'fog', icon: '🌫️' },
    48: { main: 'Fog', description: 'depositing rime fog', icon: '🌫️' },
    51: { main: 'Drizzle', description: 'light drizzle', icon: '🌦️' },
    53: { main: 'Drizzle', description: 'moderate drizzle', icon: '🌦️' },
    55: { main: 'Drizzle', description: 'dense drizzle', icon: '🌧️' },
    61: { main: 'Rain', description: 'slight rain', icon: '🌧️' },
    63: { main: 'Rain', description: 'moderate rain', icon: '🌧️' },
    65: { main: 'Rain', description: 'heavy rain', icon: '⛈️' },
    71: { main: 'Snow', description: 'slight snow', icon: '❄️' },
    73: { main: 'Snow', description: 'moderate snow', icon: '❄️' },
    75: { main: 'Snow', description: 'heavy snow', icon: '🌨️' },
    95: { main: 'Thunderstorm', description: 'thunderstorm', icon: '⛈️' }
  };

  return weatherCodes[code] || { main: 'Unknown', description: 'unknown', icon: '🌤️' };
}

function getWeatherMainFromCondition(condition) {
  const text = condition.toLowerCase();
  if (text.includes('sunny') || text.includes('clear')) return 'Clear';
  if (text.includes('cloud')) return 'Clouds';
  if (text.includes('rain') || text.includes('shower')) return 'Rain';
  if (text.includes('snow') || text.includes('blizzard')) return 'Snow';
  if (text.includes('thunder') || text.includes('storm')) return 'Thunderstorm';
  if (text.includes('drizzle') || text.includes('mist')) return 'Drizzle';
  if (text.includes('fog')) return 'Fog';
  return 'Clouds';
}

function getWeatherIconFromCondition(condition) {
  const text = condition.toLowerCase();
  if (text.includes('sunny') || text.includes('clear')) return '☀️';
  if (text.includes('partly cloudy')) return '⛅';
  if (text.includes('cloudy')) return '☁️';
  if (text.includes('rain')) return '🌧️';
  if (text.includes('snow')) return '❄️';
  if (text.includes('thunder')) return '⛈️';
  if (text.includes('drizzle')) return '🌦️';
  if (text.includes('fog') || text.includes('mist')) return '🌫️';
  return '🌤️';
}

// Calculate consensus weather from all sources
function calculateConsensusWeather(location) {
  const sources = location.weatherSources;
  const successfulSources = Object.values(sources).filter(s => s.success);

  if (successfulSources.length === 0) {
    return { error: 'No weather data available', sources: sources };
  }

  const avgTemp = Math.round(successfulSources.reduce((sum, s) => sum + s.temperature, 0) / successfulSources.length);
  const avgHumidity = Math.round(successfulSources.reduce((sum, s) => sum + s.humidity, 0) / successfulSources.length);
  const avgClouds = Math.round(successfulSources.reduce((sum, s) => sum + s.clouds, 0) / successfulSources.length);
  const avgWindSpeed = Math.round(successfulSources.reduce((sum, s) => sum + s.windSpeed, 0) / successfulSources.length);

  let consensusScore = 100 - avgClouds;
  const weatherConditions = successfulSources.map(s => s.weatherMain);
  
  if (weatherConditions.includes('Clear')) consensusScore = Math.max(consensusScore, 85);
  if (weatherConditions.includes('Rain') || weatherConditions.includes('Snow') || weatherConditions.includes('Thunderstorm')) {
    consensusScore = Math.max(0, consensusScore - 40);
  }

  const conditionCounts = {};
  successfulSources.forEach(s => {
    conditionCounts[s.weatherMain] = (conditionCounts[s.weatherMain] || 0) + 1;
  });
  const mostCommonCondition = Object.keys(conditionCounts).reduce((a, b) => conditionCounts[a] > conditionCounts[b] ? a : b);

  return {
    temperature: avgTemp,
    humidity: avgHumidity,
    clouds: avgClouds,
    windSpeed: avgWindSpeed,
    sunnyScore: Math.round(consensusScore),
    weatherMain: mostCommonCondition,
    weatherIcon: getWeatherIcon(mostCommonCondition, avgClouds),
    description: `${successfulSources.length} source consensus`,
    sources: sources,
    sourceCount: successfulSources.length,
    ...getBestSourceDetails(successfulSources)
  };
}

function getBestSourceDetails(sources) {
  const priorityOrder = ['WeatherAPI', 'OpenWeatherMap', 'Open-Meteo'];
  
  for (const priority of priorityOrder) {
    const source = sources.find(s => s.source === priority);
    if (source) {
      return {
        feelsLike: source.feelsLike || source.temperature,
        pressure: source.pressure || 1013,
        visibility: Math.round((source.visibility || 10000) / 1000),
        uvIndex: source.uvIndex || 0,
        windDirection: source.windDirection || 0
      };
    }
  }
  
  return {
    feelsLike: sources[0].temperature,
    pressure: 1013,
    visibility: 10,
    uvIndex: 0,
    windDirection: 0
  };
}

function updateMarker(location) {
  if (location.marker && location.weather && !location.weather.error) {
    location.marker.setIcon(L.divIcon({
      html: `<div class="map-weather-icon">${location.weather.weatherIcon}</div>`,
      className: 'custom-div-icon',
      iconSize: [30, 30],
      iconAnchor: [15, 15]
    }));

    location.marker.bindPopup(`
      <strong>${location.name}</strong><br>
      ${location.weather.weatherIcon} ${location.weather.temperature}°C<br>
      ${location.weather.description}<br>
      ☀️ Sunny Score: ${location.weather.sunnyScore}%<br>
      📊 Sources: ${location.weather.sourceCount}
    `);
  }
}

function analyzePolygonWeather(polygonLayer) {
  const bounds = polygonLayer.getBounds();
  const center = bounds.getCenter();

  const points = [
    center,
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

// Enhanced display with full multi-source information
function updateLocationsList() {
  const listElement = document.getElementById('locationsList');
  const titleElement = document.querySelector('.locations-list h3');
  titleElement.textContent = `📊 Multi-Source Weather Comparison (${locations.length}/10 locations)`;

  if (locations.length === 0) {
    listElement.innerHTML = '<div class="loading">Click on the map or search for locations to see multi-source weather forecast!</div>';
    return;
  }

  const sortedLocations = locations.slice().sort((a, b) => {
    if (!a.weather || !b.weather) return 0;
    if (a.weather.error || b.weather.error) return 0;
    return (b.weather.sunnyScore || 0) - (a.weather.sunnyScore || 0);
  });

  listElement.innerHTML = sortedLocations.map(location => {
    if (location.loading) {
      return `
        <div class="location-card">
          <div class="location-name">${location.name}</div>
          <div class="loading">🔄 Fetching multi-source weather data...</div>
        </div>
      `;
    }

    if (!location.weather || location.weather.error) {
      return `
        <div class="location-card">
          <div class="location-name">${location.name}</div>
          <div class="error">${location.weather?.error || 'No weather data'}</div>
        </div>
      `;
    }

    const weather = location.weather;
    const sources = weather.sources || {};

    const sourceStatus = `
      <div class="weather-sources">
        <div class="weather-source ${sources.openMeteo?.success ? 'active' : 'error'}">
          📡 Open-Meteo ${sources.openMeteo?.success ? '✓' : '✗'}
        </div>
        <div class="weather-source ${sources.openWeather?.success ? 'active' : 'error'}">
          🌤️ OpenWeather ${sources.openWeather?.success ? '✓' : '✗'}
        </div>
        <div class="weather-source ${sources.weatherApi?.success ? 'active' : 'error'}">
          ⚡ WeatherAPI ${sources.weatherApi?.success ? '✓' : '✗'}
        </div>
      </div>
    `;

    return `
      <div class="location-card">
        <div class="consensus-score">☀️ ${weather.sunnyScore}%</div>
        <div class="location-name">
          <span class="weather-icon">${weather.weatherIcon}</span>
          ${location.name}
        </div>
        <div class="weather-summary">
          <strong>${weather.temperature}°C</strong> • ${weather.description}
          <br><small>📊 Consensus from ${weather.sourceCount} source${weather.sourceCount > 1 ? 's' : ''}</small>
        </div>
        ${sourceStatus}
        <div class="detailed-weather">
          <div class="weather-detail">
            <strong>🌡️ ${weather.temperature}°C</strong>
            Feels like ${weather.feelsLike}°C
          </div>
          <div class="weather-detail">
            <strong>💨 ${weather.windSpeed} km/h</strong>
            ${getWindDirection(weather.windDirection)}
          </div>
          <div class="weather-detail">
            <strong>☁️ ${weather.clouds}%</strong>
            Cloud cover
          </div>
          <div class="weather-detail">
            <strong>💧 ${weather.humidity}%</strong>
            Humidity
          </div>
          <div class="weather-detail">
            <strong>📊 ${weather.pressure} hPa</strong>
            Pressure
          </div>
          <div class="weather-detail">
            <strong>👁️ ${weather.visibility} km</strong>
            Visibility
          </div>
          <div class="weather-detail">
            <strong>☀️ UV ${weather.uvIndex}</strong>
            UV Index
          </div>
          <div class="weather-detail">
            <strong>🎯 ${weather.sourceCount}/3</strong>
            Active sources
          </div>
        </div>
      </div>
    `;
  }).join('');
}

function getWindDirection(degrees) {
  if (!degrees) return 'N/A';
  const directions = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
  return directions[Math.round(degrees / 22.5) % 16];
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
  return '🌤️';
}

// Start the complete app when page loads
window.addEventListener('load', initializeCompleteApp);

console.log('Complete Alpine Weather App with reverse geocoding loaded successfully!');
