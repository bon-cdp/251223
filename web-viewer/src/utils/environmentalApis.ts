/**
 * Environmental APIs integration
 * Uses Google Maps Platform APIs for Air Quality, Weather, Pollen, and Solar data
 */

const API_KEY = 'AIzaSyB2qRjqPVc28tWoiE_gVl3kUXCeBgMy76E';

// ============================================================================
// Types
// ============================================================================

export interface AirQualityData {
  aqi: number;
  category: string;
  dominantPollutant: string;
  pollutants: {
    name: string;
    concentration: number;
    unit: string;
  }[];
  healthRecommendations?: string;
  color: string;
}

export interface WeatherData {
  temperature: number;
  temperatureUnit: string;
  humidity: number;
  conditions: string;
  windSpeed: number;
  windDirection: string;
  uvIndex: number;
  icon: string;
}

export interface PollenData {
  grass: { level: number; category: string };
  tree: { level: number; category: string };
  weed: { level: number; category: string };
  overallRisk: string;
  color: string;
}

export interface SolarData {
  maxSunshineHoursPerYear: number;
  maxArrayPanelsCount: number;
  maxArrayAreaMeters2: number;
  carbonOffsetFactorKgPerMwh: number;
  solarPotential: string;
  yearlyEnergyDcKwh: number;
  color: string;
}

export interface EnvironmentalData {
  airQuality: AirQualityData | null;
  weather: WeatherData | null;
  pollen: PollenData | null;
  solar: SolarData | null;
  loading: boolean;
  error: string | null;
}

// ============================================================================
// Air Quality API
// ============================================================================

export async function getAirQuality(lat: number, lng: number): Promise<AirQualityData | null> {
  try {
    const response = await fetch(
      `https://airquality.googleapis.com/v1/currentConditions:lookup?key=${API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          location: { latitude: lat, longitude: lng },
          extraComputations: [
            'HEALTH_RECOMMENDATIONS',
            'DOMINANT_POLLUTANT_CONCENTRATION',
            'POLLUTANT_CONCENTRATION',
          ],
        }),
      }
    );

    if (!response.ok) {
      console.warn('Air Quality API error:', response.status);
      return null;
    }

    const data = await response.json();
    const index = data.indexes?.[0];

    if (!index) return null;

    const aqi = index.aqi || 0;
    const category = index.category || 'Unknown';

    return {
      aqi,
      category,
      dominantPollutant: index.dominantPollutant || 'Unknown',
      pollutants: (data.pollutants || []).map((p: { code: string; concentration: { value: number; units: string } }) => ({
        name: p.code,
        concentration: p.concentration?.value || 0,
        unit: p.concentration?.units || '',
      })),
      healthRecommendations: data.healthRecommendations?.generalPopulation,
      color: getAqiColor(aqi),
    };
  } catch (error) {
    console.error('Air Quality API error:', error);
    return null;
  }
}

function getAqiColor(aqi: number): string {
  if (aqi <= 50) return '#10b981'; // Good - Green
  if (aqi <= 100) return '#f59e0b'; // Moderate - Yellow
  if (aqi <= 150) return '#f97316'; // Unhealthy for Sensitive - Orange
  if (aqi <= 200) return '#ef4444'; // Unhealthy - Red
  if (aqi <= 300) return '#8b5cf6'; // Very Unhealthy - Purple
  return '#7f1d1d'; // Hazardous - Maroon
}

// ============================================================================
// Weather API (using OpenMeteo as Google Weather API requires special access)
// ============================================================================

export async function getWeather(lat: number, lng: number): Promise<WeatherData | null> {
  try {
    // Using Open-Meteo free API as fallback
    const response = await fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&current=temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m,wind_direction_10m,uv_index&temperature_unit=fahrenheit&wind_speed_unit=mph`
    );

    if (!response.ok) {
      console.warn('Weather API error:', response.status);
      return null;
    }

    const data = await response.json();
    const current = data.current;

    if (!current) return null;

    return {
      temperature: Math.round(current.temperature_2m),
      temperatureUnit: 'F',
      humidity: current.relative_humidity_2m,
      conditions: getWeatherCondition(current.weather_code),
      windSpeed: Math.round(current.wind_speed_10m),
      windDirection: getWindDirection(current.wind_direction_10m),
      uvIndex: current.uv_index || 0,
      icon: getWeatherIcon(current.weather_code),
    };
  } catch (error) {
    console.error('Weather API error:', error);
    return null;
  }
}

function getWeatherCondition(code: number): string {
  const conditions: Record<number, string> = {
    0: 'Clear sky',
    1: 'Mainly clear',
    2: 'Partly cloudy',
    3: 'Overcast',
    45: 'Foggy',
    48: 'Depositing rime fog',
    51: 'Light drizzle',
    53: 'Moderate drizzle',
    55: 'Dense drizzle',
    61: 'Slight rain',
    63: 'Moderate rain',
    65: 'Heavy rain',
    71: 'Slight snow',
    73: 'Moderate snow',
    75: 'Heavy snow',
    80: 'Slight rain showers',
    81: 'Moderate rain showers',
    82: 'Violent rain showers',
    95: 'Thunderstorm',
  };
  return conditions[code] || 'Unknown';
}

function getWeatherIcon(code: number): string {
  if (code === 0) return '☀️';
  if (code <= 2) return '🌤️';
  if (code === 3) return '☁️';
  if (code <= 48) return '🌫️';
  if (code <= 55) return '🌧️';
  if (code <= 65) return '🌧️';
  if (code <= 75) return '❄️';
  if (code <= 82) return '🌦️';
  if (code >= 95) return '⛈️';
  return '🌡️';
}

function getWindDirection(degrees: number): string {
  const directions = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  const index = Math.round(degrees / 45) % 8;
  return directions[index];
}

// ============================================================================
// Pollen API
// ============================================================================

export async function getPollen(lat: number, lng: number): Promise<PollenData | null> {
  try {
    const response = await fetch(
      `https://pollen.googleapis.com/v1/forecast:lookup?key=${API_KEY}&location.latitude=${lat}&location.longitude=${lng}&days=1`
    );

    if (!response.ok) {
      console.warn('Pollen API error:', response.status);
      return null;
    }

    const data = await response.json();
    const today = data.dailyInfo?.[0];

    if (!today) return null;

    const pollenTypes = today.pollenTypeInfo || [];

    const getPollenLevel = (type: string) => {
      const info = pollenTypes.find((p: { code: string }) => p.code === type);
      if (!info) return { level: 0, category: 'None' };
      return {
        level: info.indexInfo?.value || 0,
        category: info.indexInfo?.category || 'Unknown',
      };
    };

    const grass = getPollenLevel('GRASS');
    const tree = getPollenLevel('TREE');
    const weed = getPollenLevel('WEED');

    const maxLevel = Math.max(grass.level, tree.level, weed.level);
    const overallRisk = maxLevel <= 1 ? 'Low' : maxLevel <= 3 ? 'Moderate' : 'High';

    return {
      grass,
      tree,
      weed,
      overallRisk,
      color: getPollenColor(maxLevel),
    };
  } catch (error) {
    console.error('Pollen API error:', error);
    return null;
  }
}

function getPollenColor(level: number): string {
  if (level <= 1) return '#10b981'; // Low - Green
  if (level <= 2) return '#84cc16'; // Low-Moderate - Lime
  if (level <= 3) return '#f59e0b'; // Moderate - Yellow
  if (level <= 4) return '#f97316'; // High - Orange
  return '#ef4444'; // Very High - Red
}

// ============================================================================
// Solar API
// ============================================================================

export async function getSolarData(lat: number, lng: number): Promise<SolarData | null> {
  try {
    const response = await fetch(
      `https://solar.googleapis.com/v1/buildingInsights:findClosest?location.latitude=${lat}&location.longitude=${lng}&requiredQuality=HIGH&key=${API_KEY}`
    );

    if (!response.ok) {
      console.warn('Solar API error:', response.status);
      return null;
    }

    const data = await response.json();
    const solar = data.solarPotential;

    if (!solar) return null;

    const maxPanels = solar.maxArrayPanelsCount || 0;
    const yearlyEnergy = solar.maxSunshineHoursPerYear * maxPanels * 0.4; // Rough kWh estimate

    let solarPotential = 'Low';
    let color = '#f59e0b';

    if (solar.maxSunshineHoursPerYear > 1800) {
      solarPotential = 'Excellent';
      color = '#10b981';
    } else if (solar.maxSunshineHoursPerYear > 1500) {
      solarPotential = 'Good';
      color = '#84cc16';
    } else if (solar.maxSunshineHoursPerYear > 1200) {
      solarPotential = 'Moderate';
      color = '#f59e0b';
    }

    return {
      maxSunshineHoursPerYear: solar.maxSunshineHoursPerYear || 0,
      maxArrayPanelsCount: maxPanels,
      maxArrayAreaMeters2: solar.maxArrayAreaMeters2 || 0,
      carbonOffsetFactorKgPerMwh: solar.carbonOffsetFactorKgPerMwh || 0,
      solarPotential,
      yearlyEnergyDcKwh: yearlyEnergy,
      color,
    };
  } catch (error) {
    console.error('Solar API error:', error);
    return null;
  }
}

// ============================================================================
// Geocoding (for address search)
// ============================================================================

export interface GeocodingResult {
  lat: number;
  lng: number;
  formattedAddress: string;
  placeId?: string;
}

export async function geocodeAddress(address: string): Promise<GeocodingResult | null> {
  try {
    const response = await fetch(
      `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${API_KEY}`
    );

    if (!response.ok) {
      console.warn('Geocoding error:', response.status);
      return null;
    }

    const data = await response.json();

    if (data.status !== 'OK' || !data.results?.[0]) {
      return null;
    }

    const result = data.results[0];
    return {
      lat: result.geometry.location.lat,
      lng: result.geometry.location.lng,
      formattedAddress: result.formatted_address,
      placeId: result.place_id,
    };
  } catch (error) {
    console.error('Geocoding error:', error);
    return null;
  }
}

// ============================================================================
// Fetch All Environmental Data
// ============================================================================

export async function getEnvironmentalData(lat: number, lng: number): Promise<Omit<EnvironmentalData, 'loading'>> {
  const [airQuality, weather, pollen, solar] = await Promise.all([
    getAirQuality(lat, lng),
    getWeather(lat, lng),
    getPollen(lat, lng),
    getSolarData(lat, lng),
  ]);

  return {
    airQuality,
    weather,
    pollen,
    solar,
    error: null,
  };
}
