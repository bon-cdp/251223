/**
 * Environmental Map Component
 * Searchable map with Air Quality, Weather, Pollen, and Solar data display
 */

import React, { useEffect, useRef, useState, useCallback } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import {
  geocodeAddress,
  getEnvironmentalData,
  type AirQualityData,
  type WeatherData,
  type PollenData,
  type SolarData,
} from '../../utils/environmentalApis';

interface EnvironmentalMapProps {
  initialCenter?: [number, number];
  initialZoom?: number;
}

// Default center: Los Angeles
const DEFAULT_CENTER: [number, number] = [34.0522, -118.2437];
const DEFAULT_ZOOM = 14;

export const EnvironmentalMap: React.FC<EnvironmentalMapProps> = ({
  initialCenter = DEFAULT_CENTER,
  initialZoom = DEFAULT_ZOOM,
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);

  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  // Location state
  const [currentLocation, setCurrentLocation] = useState<{
    lat: number;
    lng: number;
    address: string;
  } | null>(null);

  // Environmental data state
  const [envData, setEnvData] = useState<{
    airQuality: AirQualityData | null;
    weather: WeatherData | null;
    pollen: PollenData | null;
    solar: SolarData | null;
  }>({
    airQuality: null,
    weather: null,
    pollen: null,
    solar: null,
  });
  const [loadingEnvData, setLoadingEnvData] = useState(false);

  // Initialize map
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    const map = L.map(mapContainerRef.current, {
      center: initialCenter,
      zoom: initialZoom,
      zoomControl: true,
    });

    // Google Maps satellite + hybrid tiles
    L.tileLayer('https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}', {
      attribution: 'Map data &copy; Google',
      maxZoom: 21,
    }).addTo(map);

    L.tileLayer('https://mt1.google.com/vt/lyrs=h&x={x}&y={y}&z={z}', {
      maxZoom: 21,
    }).addTo(map);

    // Click handler to select location
    map.on('click', (e: L.LeafletMouseEvent) => {
      handleLocationSelect(e.latlng.lat, e.latlng.lng, 'Selected location');
    });

    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, [initialCenter, initialZoom]);

  // Handle location selection
  const handleLocationSelect = useCallback(async (lat: number, lng: number, address: string) => {
    setCurrentLocation({ lat, lng, address });

    // Update marker
    if (mapRef.current) {
      if (markerRef.current) {
        markerRef.current.setLatLng([lat, lng]);
      } else {
        markerRef.current = L.marker([lat, lng], {
          icon: L.divIcon({
            className: 'custom-marker',
            html: '<div style="width: 20px; height: 20px; background: #7c3aed; border: 3px solid white; border-radius: 50%; box-shadow: 0 2px 6px rgba(0,0,0,0.3);"></div>',
            iconSize: [20, 20],
            iconAnchor: [10, 10],
          }),
        }).addTo(mapRef.current);
      }

      mapRef.current.setView([lat, lng], 17);
    }

    // Fetch environmental data
    setLoadingEnvData(true);
    try {
      const data = await getEnvironmentalData(lat, lng);
      setEnvData({
        airQuality: data.airQuality,
        weather: data.weather,
        pollen: data.pollen,
        solar: data.solar,
      });
    } catch (error) {
      console.error('Error fetching environmental data:', error);
    } finally {
      setLoadingEnvData(false);
    }
  }, []);

  // Handle search
  const handleSearch = useCallback(async () => {
    if (!searchQuery.trim()) return;

    setIsSearching(true);
    setSearchError(null);

    try {
      const result = await geocodeAddress(searchQuery);
      if (result) {
        handleLocationSelect(result.lat, result.lng, result.formattedAddress);
        setSearchQuery(result.formattedAddress);
      } else {
        setSearchError('Location not found');
      }
    } catch {
      setSearchError('Search failed');
    } finally {
      setIsSearching(false);
    }
  }, [searchQuery, handleLocationSelect]);

  // Handle Enter key
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  return (
    <div style={styles.container}>
      {/* Search Bar */}
      <div style={styles.searchBar}>
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Search address (e.g., 6464 Canoga Ave, Woodland Hills)"
          style={styles.searchInput}
        />
        <button
          onClick={handleSearch}
          disabled={isSearching}
          style={styles.searchButton}
        >
          {isSearching ? '...' : 'Search'}
        </button>
      </div>

      {searchError && <div style={styles.errorBanner}>{searchError}</div>}

      {/* Map */}
      <div ref={mapContainerRef} style={styles.map} />

      {/* Environmental Data Panel */}
      <div style={styles.dataPanel}>
        {currentLocation ? (
          <>
            <div style={styles.locationHeader}>
              {currentLocation.address}
            </div>

            {loadingEnvData ? (
              <div style={styles.loading}>Loading environmental data...</div>
            ) : (
              <div style={styles.dataGrid}>
                {/* Air Quality */}
                <DataCard
                  title="Air Quality"
                  icon="🌬️"
                  value={envData.airQuality ? `AQI ${envData.airQuality.aqi}` : 'N/A'}
                  subtitle={envData.airQuality?.category || ''}
                  color={envData.airQuality?.color || '#6b7280'}
                />

                {/* Weather */}
                <DataCard
                  title="Weather"
                  icon={envData.weather?.icon || '🌡️'}
                  value={envData.weather ? `${envData.weather.temperature}°${envData.weather.temperatureUnit}` : 'N/A'}
                  subtitle={envData.weather?.conditions || ''}
                  color="#3b82f6"
                />

                {/* Pollen */}
                <DataCard
                  title="Pollen"
                  icon="🌸"
                  value={envData.pollen?.overallRisk || 'N/A'}
                  subtitle={envData.pollen ? `Grass: ${envData.pollen.grass.level}/5` : ''}
                  color={envData.pollen?.color || '#6b7280'}
                />

                {/* Solar */}
                <DataCard
                  title="Solar"
                  icon="☀️"
                  value={envData.solar?.solarPotential || 'N/A'}
                  subtitle={envData.solar ? `${envData.solar.maxSunshineHoursPerYear} hrs/yr` : ''}
                  color={envData.solar?.color || '#6b7280'}
                />
              </div>
            )}

            {/* Detailed breakdown */}
            {envData.weather && (
              <div style={styles.details}>
                <span>Humidity: {envData.weather.humidity}%</span>
                <span>Wind: {envData.weather.windSpeed} mph {envData.weather.windDirection}</span>
                <span>UV Index: {envData.weather.uvIndex}</span>
              </div>
            )}
          </>
        ) : (
          <div style={styles.placeholder}>
            Search for an address or click on the map to view environmental data
          </div>
        )}
      </div>

      {/* Instructions */}
      <div style={styles.hint}>
        Click anywhere on the map or search for an address to view environmental data
      </div>
    </div>
  );
};

// Data Card Component
interface DataCardProps {
  title: string;
  icon: string;
  value: string;
  subtitle: string;
  color: string;
}

const DataCard: React.FC<DataCardProps> = ({ title, icon, value, subtitle, color }) => (
  <div style={{ ...styles.card, borderLeftColor: color }}>
    <div style={styles.cardHeader}>
      <span style={styles.cardIcon}>{icon}</span>
      <span style={styles.cardTitle}>{title}</span>
    </div>
    <div style={{ ...styles.cardValue, color }}>{value}</div>
    <div style={styles.cardSubtitle}>{subtitle}</div>
  </div>
);

const styles: Record<string, React.CSSProperties> = {
  container: {
    width: '100%',
    height: '100%',
    display: 'flex',
    flexDirection: 'column',
    background: '#1e1e2e',
    borderRadius: 8,
    overflow: 'hidden',
  },
  searchBar: {
    display: 'flex',
    gap: 8,
    padding: '12px 16px',
    background: '#2d2d3f',
    borderBottom: '1px solid #3a3a4a',
  },
  searchInput: {
    flex: 1,
    padding: '10px 14px',
    background: '#1e1e2e',
    border: '1px solid #3a3a4a',
    borderRadius: 6,
    color: '#fff',
    fontSize: 14,
    outline: 'none',
  },
  searchButton: {
    padding: '10px 20px',
    background: '#7c3aed',
    color: '#fff',
    border: 'none',
    borderRadius: 6,
    cursor: 'pointer',
    fontWeight: 600,
    fontSize: 14,
  },
  errorBanner: {
    padding: '8px 16px',
    background: 'rgba(239, 68, 68, 0.9)',
    color: '#fff',
    fontSize: 12,
  },
  map: {
    flex: 1,
    minHeight: 300,
  },
  dataPanel: {
    padding: 16,
    background: '#2d2d3f',
    borderTop: '1px solid #3a3a4a',
  },
  locationHeader: {
    fontSize: 14,
    fontWeight: 600,
    color: '#fff',
    marginBottom: 12,
    paddingBottom: 8,
    borderBottom: '1px solid #3a3a4a',
  },
  loading: {
    color: '#a0a0b0',
    fontSize: 13,
    textAlign: 'center',
    padding: 20,
  },
  dataGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(4, 1fr)',
    gap: 12,
  },
  card: {
    background: '#1e1e2e',
    borderRadius: 8,
    padding: 12,
    borderLeft: '4px solid',
  },
  cardHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  cardIcon: {
    fontSize: 16,
  },
  cardTitle: {
    fontSize: 11,
    color: '#a0a0b0',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
  },
  cardValue: {
    fontSize: 18,
    fontWeight: 700,
    marginBottom: 4,
  },
  cardSubtitle: {
    fontSize: 11,
    color: '#6b7280',
  },
  details: {
    display: 'flex',
    gap: 16,
    marginTop: 12,
    paddingTop: 12,
    borderTop: '1px solid #3a3a4a',
    fontSize: 12,
    color: '#a0a0b0',
  },
  placeholder: {
    color: '#6b7280',
    fontSize: 13,
    textAlign: 'center',
    padding: 20,
  },
  hint: {
    padding: '8px 16px',
    background: '#2d2d3f',
    fontSize: 11,
    color: '#6b7280',
    textAlign: 'center',
    borderTop: '1px solid #3a3a4a',
  },
};

export default EnvironmentalMap;
