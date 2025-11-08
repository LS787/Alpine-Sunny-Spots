console.log('Advanced 6-Source Alpine Weather App initializing...');

// Global variables
let map;
let locations = [];
let currentMode = 'click';
let drawnItems;
let apiKeys = {
  openWeather: '',
  weatherApi: '',
  visualCrossing: ''
};
let selectedDateTime = null;

// Initialize storage on page load
function initStorage() {
  const savedOpenWeather = localStorage.getItem('openWeatherApiKey');
  const savedWeatherApi = localStorage.getItem('weatherApiKey');
  const savedVisualCrossing = localStorage.getItem('visualCrossingApiKey');
  
  if (savedOpenWeather) apiKeys.openWeather = savedOpenWeather;
  if (savedWeatherApi) apiKeys.weatherApi = savedWeatherApi;
  if (savedVisualCrossing) apiKeys.visualCrossing = savedVisualCrossing;
  
  console.log('Storage initialized with saved API keys');
}

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
      initStorage();
      restoreApiKeyInputs();
      initMap();
      console.log('6-Source Alpine Weather App ready!');
    }, 100);
    
  } catch (error) {
    console.error('Library loading failed:', error);
    alert('Failed to load map libraries. Please refresh the page.');
  }
}

// Initialize date/time inputs
function initDateTime() {
  const now = new Date();
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  
  const dateStr = tomorrow.toISOString().split('T')[0];
  document.getElementById('dateInput').value = dateStr;
  document.getElementById('timeInput').value = '12:00';
  
  updateSelectedDateTime();
}

// Restore saved API keys
function restoreApiKeyInputs() {
  const openWeatherKey = localStorage.getItem('openWeatherApiKey');
  const weatherApiKey = localStorage.getItem('weatherApiKey');
  const visualCrossingKey = localStorage.getItem('visualCrossingApiKey');
  
  if (openWeatherKey) document.getElementById('openWeatherApiKey').value = openWeatherKey;
  if (weatherApiKey) document.getElementById('weatherApiKey').value = weatherApiKey;
  if (visualCrossingKey) document.getElementById('visualCrossingApiKey').value = visualCrossingKey;
  
  console.log('API key inputs restored');
}

function updateSelectedDateTime() {
  const dateInput = document.getElementById('dateInput').value;
  const timeInput = document.getElementById('timeInput').value;
  
  if (dateInput && timeInput) {
    selectedDateTime = new Date(dateInput + 'T' + timeInput + ':00');
    
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

  document.getElementById('dateInput').addEventListener('change', updateSelectedDateTime);
  document.getElementById('timeInput').addEventListener('change', updateSelectedDateTime);

  // API key handlers with storage
  document.getElementById('openWeatherApiKey').addEventListener('change', function(e) {
    apiKeys.openWeather = e.target.value.trim();
    localStorage.setItem('openWeatherApiKey', apiKeys.openWeather);
    updateApiKeyDisplay();
    if (apiKeys.openWeather) locations.forEach(loc => fetchWeatherData(loc));
  });

  document.getElementById('weatherApiKey').addEventListener('change', function(e) {
    apiKeys.weatherApi = e.target.value.trim();
    localStorage.setItem('weatherApiKey', apiKeys.weatherApi);
    updateApiKeyDisplay();
    if (apiKeys.weatherApi) locations.forEach(loc => fetchWeatherData(loc));
  });

  document.getElementById('visualCrossingApiKey').addEventListener('change', function(e) {
    apiKeys.visualCrossing = e.target.value.trim();
    localStorage.setItem('visualCrossingApiKey', apiKeys.visualCrossing);
    updateApiKeyDisplay();
    if (apiKeys.visualCrossing) locations.forEach(loc => fetchWeatherData(loc));
  });

  document.getElementById('locationSearch').addEventListener('keypress', function(e) {
    if (e.key === 'Enter') searchLocation();
  });

  setTimeout(updateApiKeyDisplay, 200);
}

function updateModeButtons() {
  document.querySelectorAll('.control-btn').forEach(btn => btn.classList.remove('active'));
  if (currentMode === 'click') {
    document.getElementById('clickMode').classList.add('active');
  } else if (currentMode === 'polygon') {
    document.getElementById('polygonMode').classList.add('active');
  }
}

function toggleInstructions() {
  const instructions = document.getElementById('instructions');
  instructions.classList.toggle('collapsed');
}

function updateApiKeyDisplay() {
  const hasKeys = localStorage.getItem('openWeatherApiKey') || 
                  localStorage.getItem('weatherApiKey') || 
                  localStorage.getItem('visualCrossingApiKey');
  
  const apiKeyBox = document.getElementById('apiKeyBox');
  const apiStatus = document.getElementById('apiStatus');
  
  if (!apiKeyBox || !apiStatus) return;
  
  if (hasKeys) {
    apiKeyBox.classList.add('hidden');
    apiStatus.style.display = 'block';
  } else {
    apiKeyBox.classList.remove('hidden');
    apiStatus.style.display = 'none';
  }
}

function showApiKeyBox() {
  document.getElementById('apiKeyBox').classList.remove('hidden');
  document.getElementById('apiStatus').style.display = 'none';
}

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
        alert('Location not found. Try searching for major Alpine cities.');
      }
    })
    .catch(error => {
      console.error('Search error:', error);
    });
}

async function reverseGeocode(lat, lng) {
  const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=12&accept-language=en`;
  
  try {
    const response = await fetch(url, {
      headers: { 'User-Agent': 'AlpineSunnySpots/2.0' }
    });
    
    const data = await response.json();
    
    if (data && data.address) {
      const address = data.address;
      const placeName = address.village || address.town || address.city || 
                       address.municipality || address.hamlet || address.county || 
                       address.state || 'Unknown Location';
      const country = address.country_code ? ` (${address.country_code.toUpperCase()})` : '';
      return `${placeName}${country}`;
    }
    
    return `Location (${lat.toFixed(2)}, ${lng.toFixed(2)})`;
    
  } catch (error) {
    console.error('Reverse geocoding error:', error);
    return `Location (${lat.toFixed(2)}, ${lng.toFixed(2)})`;
  }
}

async function addLocationByCoordinates(lat, lng, name) {
  if (locations.length >= 10) {
    alert('Maximum 10 locations allowed.');
    return;
  }

  if (!name) {
    try {
      name = await reverseGeocode(lat, lng);
    } catch (error) {
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

// 6-SOURCE WEATHER DATA FETCHING
async function fetchWeatherData(location) {
  location.weatherSources = {};
  location.loading = true;
  updateLocationsList();

  const promises = [
    fetchOpenMeteoECMWF(location),
    fetchOpenMeteoICON(location),
    fetchOpenMeteoGFS(location),
    fetchOpenWeatherMapWeather(location),
    fetchWeatherApiWeather(location),
    fetchVisualCrossingWeather(location)
  ];

  await Promise.allSettled(promises);
  
  location.weather = calculateWeightedConsensus(location);
  location.loading = false;
  updateLocationsList();
  updateMarker(location);
}

// Open-Meteo ECMWF (Most accurate for Europe)
async function fetchOpenMeteoECMWF(location) {
  try {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${location.lat}&longitude=${location.lng}&hourly=temperature_2m,relative_humidity_2m,weather_code,cloud_cover,wind_speed_10m,wind_direction_10m,uv_index,visibility&models=ecmwf_ifs04&timezone=Europe/Zurich&forecast_days=7`;
    
    const response = await fetch(url);
    const data = await response.json();
    
    if (data.hourly) {
      const timeIndex = findClosestTimeIndex(data.hourly.time, selectedDateTime);
      const weatherCode = data.hourly.weather_code[timeIndex];
      const weatherInfo = getWeatherFromCode(weatherCode);
      
      location.weatherSources.ecmwf = {
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
        source: 'ECMWF',
        model: 'European Model',
        weight: 2.0, // Highest weight for most accurate model
        success: true
      };
    }
  } catch (error) {
    console.error('ECMWF error:', error);
    location.weatherSources.ecmwf = { success: false, error: 'API Error', source: 'ECMWF' };
  }
}

// Open-Meteo ICON (German model, Alpine-optimized)
async function fetchOpenMeteoICON(location) {
  try {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${location.lat}&longitude=${location.lng}&hourly=temperature_2m,relative_humidity_2m,weather_code,cloud_cover,wind_speed_10m,wind_direction_10m,uv_index,visibility&models=icon_seamless&timezone=Europe/Zurich&forecast_days=7`;
    
    const response = await fetch(url);
    const data = await response.json();
    
    if (data.hourly) {
      const timeIndex = findClosestTimeIndex(data.hourly.time, selectedDateTime);
      const weatherCode = data.hourly.weather_code[timeIndex];
      const weatherInfo = getWeatherFromCode(weatherCode);
      
      location.weatherSources.icon = {
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
        source: 'ICON',
        model: 'German Alpine Model',
        weight: 1.8, // High weight for Alpine regions
        success: true
      };
    }
  } catch (error) {
    console.error('ICON error:', error);
    location.weatherSources.icon = { success: false, error: 'API Error', source: 'ICON' };
  }
}

// Open-Meteo GFS (US global model)
async function fetchOpenMeteoGFS(location) {
  try {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${location.lat}&longitude=${location.lng}&hourly=temperature_2m,relative_humidity_2m,weather_code,cloud_cover,wind_speed_10m,wind_direction_10m,uv_index,visibility&models=gfs_seamless&timezone=Europe/Zurich&forecast_days=7`;
    
    const response = await fetch(url);
    const data = await response.json();
    
    if (data.hourly) {
      const timeIndex = findClosestTimeIndex(data.hourly.time, selectedDateTime);
      const weatherCode = data.hourly.weather_code[timeIndex];
      const weatherInfo = getWeatherFromCode(weatherCode);
      
      location.weatherSources.gfs = {
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
        source: 'GFS',
        model: 'US Global Model',
        weight: 1.3,
        success: true
      };
    }
  } catch (error) {
    console.error('GFS error:', error);
    location.weatherSources.gfs = { success: false, error: 'API Error', source: 'GFS' };
  }
}

// OpenWeatherMap API
async function fetchOpenWeatherMapWeather(location) {
  if (!apiKeys.openWeather) {
    location.weatherSources.openWeather = { success: false, error: 'No API Key', source: 'OpenWeather' };
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
        const diff = Math.abs(new Date(forecast.dt * 1000) - selectedDateTime);
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
        source: 'OpenWeather',
        model: 'Composite',
        weight: 1.2,
        success: true
      };
    } else {
      location.weatherSources.openWeather = { success: false, error: 'API Error', source: 'OpenWeather' };
    }
  } catch (error) {
    console.error('OpenWeather error:', error);
    location.weatherSources.openWeather = { success: false, error: 'Network Error', source: 'OpenWeather' };
  }
}

// WeatherAPI.com
async function fetchWeatherApiWeather(location) {
  if (!apiKeys.weatherApi) {
    location.weatherSources.weatherApi = { success: false, error: 'No API Key', source: 'WeatherAPI' };
    return;
  }

  try {
    const targetDate = selectedDateTime.toISOString().split('T')[0];
    const targetHour = selectedDateTime.getHours();
    const url = `https://api.weatherapi.com/v1/forecast.json?key=${apiKeys.weatherApi}&q=${location.lat},${location.lng}&days=7&aqi=no&alerts=no`;
    
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
        model: 'Composite',
        weight: 1.2,
        success: true
      };
    } else {
      location.weatherSources.weatherApi = { success: false, error: 'No Data', source: 'WeatherAPI' };
    }
  } catch (error) {
    console.error('WeatherAPI error:', error);
    location.weatherSources.weatherApi = { success: false, error: 'Network Error', source: 'WeatherAPI' };
  }
}

// Visual Crossing Weather
async function fetchVisualCrossingWeather(location) {
  if (!apiKeys.visualCrossing) {
    location.weatherSources.visualCrossing = { success: false, error: 'No API Key', source: 'Visual Crossing' };
    return;
  }

  try {
    const targetDate = selectedDateTime.toISOString().split('T')[0];
    const url = `https://weather.visualcrossing.com/VisualCrossingWebServices/rest/services/timeline/${location.lat},${location.lng}/${targetDate}/${targetDate}?unitGroup=metric&key=${apiKeys.visualCrossing}&include=hours`;
    
    const response = await fetch(url);
    const data = await response.json();

    if (data.days && data.days[0] && data.days[0].hours) {
      const targetHour = selectedDateTime.getHours();
      const hourData = data.days[0].hours.find(h => parseInt(h.datetime.split(':')[0]) === targetHour) || data.days[0].hours[12];

      location.weatherSources.visualCrossing = {
        temperature: Math.round(hourData.temp),
        feelsLike: Math.round(hourData.feelslike),
        humidity: hourData.humidity,
        clouds: hourData.cloudcover,
        windSpeed: Math.round(hourData.windspeed),
        windDirection: hourData.winddir,
        pressure: hourData.pressure,
        visibility: hourData.visibility,
        uvIndex: hourData.uvindex || 0,
        weatherMain: getWeatherMainFromCondition(hourData.conditions),
        description: hourData.conditions.toLowerCase(),
        icon: getWeatherIconFromCondition(hourData.conditions),
        source: 'Visual Crossing',
        model: 'Ensemble',
        weight: 1.5,
        success: true
      };
    } else {
      location.weatherSources.visualCrossing = { success: false, error: 'No Data', source: 'Visual Crossing' };
    }
  } catch (error) {
    console.error('Visual Crossing error:', error);
    location.weatherSources.visualCrossing = { success: false, error: 'Network Error', source: 'Visual Crossing' };
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

// WEIGHTED CONSENSUS CALCULATION
function calculateWeightedConsensus(location) {
  const sources = location.weatherSources;
  const successfulSources = Object.values(sources).filter(s => s.success);

  if (successfulSources.length === 0) {
    return { error: 'No weather data available', sources: sources };
  }

  // Calculate weighted averages (giving more weight to accurate models)
  const totalWeight = successfulSources.reduce((sum, s) => sum + (s.weight || 1), 0);
  
  const weightedTemp = successfulSources.reduce((sum, s) => sum + (s.temperature * (s.weight || 1)), 0) / totalWeight;
  const weightedHumidity = successfulSources.reduce((sum, s) => sum + (s.humidity * (s.weight || 1)), 0) / totalWeight;
  const weightedClouds = successfulSources.reduce((sum, s) => sum + (s.clouds * (s.weight || 1)), 0) / totalWeight;
  const weightedWindSpeed = successfulSources.reduce((sum, s) => sum + (s.windSpeed * (s.weight || 1)), 0) / totalWeight;

  // Calculate consensus quality score
  const tempVariance = calculateVariance(successfulSources.map(s => s.temperature));
  const cloudVariance = calculateVariance(successfulSources.map(s => s.clouds));
  const consensusQuality = tempVariance < 3 && cloudVariance < 15 ? 'High' : tempVariance < 5 && cloudVariance < 25 ? 'Medium' : 'Low';

  let consensusScore = 100 - weightedClouds;
  const weatherConditions = successfulSources.map(s => s.weatherMain);
  
  if (weatherConditions.includes('Clear')) consensusScore = Math.max(consensusScore, 85);
  if (weatherConditions.includes('Rain') || weatherConditions.includes('Snow') || weatherConditions.includes('Thunderstorm')) {
    consensusScore = Math.max(0, consensusScore - 40);
  }

  const conditionCounts = {};
  successfulSources.forEach(s => {
    conditionCounts[s.weatherMain] = (conditionCounts[s.weatherMain] || 0) +
      (s.weight || 1);
  });
  const mostCommonCondition = Object.keys(conditionCounts).reduce((a, b) => conditionCounts[a] > conditionCounts[b] ? a : b);

  return {
    temperature: Math.round(weightedTemp),
    humidity: Math.round(weightedHumidity),
    clouds: Math.round(weightedClouds),
    windSpeed: Math.round(weightedWindSpeed),
    sunnyScore: Math.round(consensusScore),
    weatherMain: mostCommonCondition,
    weatherIcon: getWeatherIcon(mostCommonCondition, weightedClouds),
    description: `${successfulSources.length}-source weighted consensus`,
    sources: sources,
    sourceCount: successfulSources.length,
    consensusQuality: consensusQuality,
    ...getBestSourceDetails(successfulSources)
  };
}

function calculateVariance(values) {
  const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
  const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
  return Math.sqrt(variance);
}

function getBestSourceDetails(sources) {
  const priorityOrder = ['Visual Crossing', 'ECMWF', 'ICON', 'WeatherAPI', 'OpenWeather', 'GFS'];
  
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
      📊 Sources: ${location.weather.sourceCount}/6<br>
      🎯 Consensus: ${location.weather.consensusQuality}
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
      addLocationByCoordinates(point.lat, point.lng);
    }
  });
}

// ENHANCED DISPLAY WITH 6-SOURCE INFORMATION
function updateLocationsList() {
  const listElement = document.getElementById('locationsList');
  const titleElement = document.querySelector('.locations-list h3');
  titleElement.textContent = `📊 6-Source Weather Comparison (${locations.length}/10 locations)`;

  if (locations.length === 0) {
    listElement.innerHTML = '<div class="loading">Click on the map or search for locations to see 6-source weather consensus!</div>';
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
          <div class="loading">🔄 Fetching 6-source weather data...</div>
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

    // Model badges for active sources
    const modelBadges = [];
    if (sources.ecmwf?.success) modelBadges.push('<span class="model-badge">ECMWF</span>');
    if (sources.icon?.success) modelBadges.push('<span class="model-badge">ICON</span>');
    if (sources.gfs?.success) modelBadges.push('<span class="model-badge">GFS</span>');
    if (sources.openWeather?.success) modelBadges.push('<span class="model-badge">OpenWeather</span>');
    if (sources.weatherApi?.success) modelBadges.push('<span class="model-badge">WeatherAPI</span>');
    if (sources.visualCrossing?.success) modelBadges.push('<span class="model-badge">Visual Crossing</span>');

    const sourceStatus = `
      <div class="weather-sources">
        <div class="weather-source ${sources.ecmwf?.success ? 'active' : 'error'}">
          🇪🇺 ECMWF ${sources.ecmwf?.success ? '✓' : '✗'}
        </div>
        <div class="weather-source ${sources.icon?.success ? 'active' : 'error'}">
          🇩🇪 ICON ${sources.icon?.success ? '✓' : '✗'}
        </div>
        <div class="weather-source ${sources.gfs?.success ? 'active' : 'error'}">
          🇺🇸 GFS ${sources.gfs?.success ? '✓' : '✗'}
        </div>
        <div class="weather-source ${sources.openWeather?.success ? 'active' : 'error'}">
          🌤️ OpenWeather ${sources.openWeather?.success ? '✓' : '✗'}
        </div>
        <div class="weather-source ${sources.weatherApi?.success ? 'active' : 'error'}">
          ⚡ WeatherAPI ${sources.weatherApi?.success ? '✓' : '✗'}
        </div>
        <div class="weather-source ${sources.visualCrossing?.success ? 'active' : 'error'}">
          🎨 Visual Crossing ${sources.visualCrossing?.success ? '✓' : '✗'}
        </div>
      </div>
    `;

    const consensusColor = weather.consensusQuality === 'High' ? '#00b894' : 
                          weather.consensusQuality === 'Medium' ? '#fdcb6e' : '#ff7675';

    return `
      <div class="location-card">
        <div class="consensus-score">☀️ ${weather.sunnyScore}%</div>
        <div class="location-name">
          <span class="weather-icon">${weather.weatherIcon}</span>
          ${location.name}
        </div>
        <div class="weather-summary">
          <strong>${weather.temperature}°C</strong> • ${weather.description}
          <br><small>📊 Weighted from ${weather.sourceCount}/6 sources</small>
        </div>
        <div class="consensus-quality" style="border-color: ${consensusColor};">
          🎯 Consensus Quality: <strong style="color: ${consensusColor};">${weather.consensusQuality}</strong>
          <br><small>Models: ${modelBadges.join(' ')}</small>
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
            <strong>🎯 ${weather.sourceCount}/6</strong>
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
window.addEventListener('load', function() {
  initStorage();
  initializeCompleteApp();
});

console.log('6-Source Alpine Weather App with weighted consensus loaded successfully!');
