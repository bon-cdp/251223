/**
 * Parcel Map component using Leaflet
 * Shows parcel boundary on satellite imagery with geocoding support
 * Optionally renders floor plan spaces as colored polygons
 */

import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { geocodeAddress, createParcelBoundary, createBuildingFootprint } from '../../utils/geocoding';
import { getFeetToLatLngTransform } from '../../utils/parcelGeometry';
import { FloorData, isPolygonGeometry, isRectGeometry } from '../../types/solverOutput';

interface ParcelMapProps {
  // Property address for geocoding
  address?: string;
  // Parcel/lot area in square feet (for generating boundary)
  parcelArea?: number;
  // Floor plate area in SF (for building footprint)
  floorArea?: number;
  // Explicit parcel boundary in lat/lng coordinates (overrides geocoding)
  boundary?: [number, number][];
  // Explicit building footprint (optional)
  buildingFootprint?: [number, number][];
  // Center point if no boundary or address
  center?: [number, number];
  // Zoom level
  zoom?: number;
  // Project name
  projectName?: string;
  // Current floor data for space rendering
  currentFloor?: FloorData;
  // Project ID for coordinate transform
  projectId?: string;
}

// Default center: Los Angeles (common for CA real estate)
const DEFAULT_CENTER: [number, number] = [34.0522, -118.2437];
const DEFAULT_ZOOM = 18;

// Sample parcel coordinates (placeholder)
const SAMPLE_PARCEL: [number, number][] = [
  [34.0525, -118.2440],
  [34.0525, -118.2435],
  [34.0520, -118.2435],
  [34.0520, -118.2440],
];

/** Map space type to fill color */
function getSpaceColor(type: string): string {
  switch (type) {
    case 'DWELLING_UNIT': return '#3b82f6';
    case 'CIRCULATION': return '#f59e0b';
    case 'SUPPORT': return '#8b5cf6';
    case 'AMENITY': return '#10b981';
    case 'PARKING': return '#6b7280';
    case 'RETAIL': return '#ec4899';
    default: return '#94a3b8';
  }
}

/** Space type color legend entries */
const SPACE_TYPE_LEGEND: Array<{ type: string; label: string; color: string }> = [
  { type: 'DWELLING_UNIT', label: 'Units', color: '#3b82f6' },
  { type: 'CIRCULATION', label: 'Circulation', color: '#f59e0b' },
  { type: 'SUPPORT', label: 'Support', color: '#8b5cf6' },
  { type: 'AMENITY', label: 'Amenity', color: '#10b981' },
  { type: 'PARKING', label: 'Parking', color: '#6b7280' },
];

export const ParcelMap: React.FC<ParcelMapProps> = ({
  address,
  parcelArea,
  floorArea,
  boundary,
  buildingFootprint,
  center = DEFAULT_CENTER,
  zoom = DEFAULT_ZOOM,
  projectName,
  currentFloor,
  projectId,
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const parcelPolygonRef = useRef<L.Polygon | null>(null);
  const footprintPolygonRef = useRef<L.Polygon | null>(null);
  const spaceLayersRef = useRef<L.Layer[]>([]);

  // State for geocoded data
  const [geocodedCenter, setGeocodedCenter] = useState<[number, number] | null>(null);
  const [geocodedParcel, setGeocodedParcel] = useState<[number, number][] | null>(null);
  const [geocodedFootprint, setGeocodedFootprint] = useState<[number, number][] | null>(null);
  const [formattedAddress, setFormattedAddress] = useState<string | null>(null);
  const [geocodingError, setGeocodingError] = useState<string | null>(null);
  const [isGeocoding, setIsGeocoding] = useState(false);

  // Track address to avoid resetting state in effect body
  const previousAddressRef = useRef<string | undefined>(undefined);

  // Geocode address when it changes
  useEffect(() => {
    // Early return with cleanup callback setup
    let cancelled = false;

    const resetGeocodedState = () => {
      setGeocodedCenter(null);
      setGeocodedParcel(null);
      setGeocodedFootprint(null);
      setFormattedAddress(null);
      setGeocodingError(null);
    };

    // If address changed from something to nothing, reset
    if (!address) {
      if (previousAddressRef.current) {
        resetGeocodedState();
      }
      previousAddressRef.current = address;
      return;
    }

    // Only geocode if address actually changed
    if (address === previousAddressRef.current) {
      return;
    }
    previousAddressRef.current = address;

    setIsGeocoding(true);
    setGeocodingError(null);

    geocodeAddress(address).then(result => {
      if (cancelled) return;
      setIsGeocoding(false);

      if (result) {
        const centerPoint: [number, number] = [result.lat, result.lng];
        setGeocodedCenter(centerPoint);
        setFormattedAddress(result.formattedAddress);

        // Generate parcel boundary from area
        if (parcelArea) {
          const parcelBoundary = createParcelBoundary(
            { lat: result.lat, lng: result.lng },
            parcelArea
          );
          setGeocodedParcel(parcelBoundary);
        }

        // Generate building footprint from floor area
        if (floorArea) {
          const footprint = createBuildingFootprint(
            { lat: result.lat, lng: result.lng },
            floorArea
          );
          setGeocodedFootprint(footprint);
        }
      } else {
        setGeocodingError('Could not find location for address');
      }
    }).catch(err => {
      if (cancelled) return;
      setIsGeocoding(false);
      setGeocodingError('Geocoding failed');
      console.error('Geocoding error:', err);
    });

    return () => { cancelled = true; };
  }, [address, parcelArea, floorArea]);

  // Initialize map once
  useEffect(() => {
    if (!mapContainerRef.current) return;
    if (mapRef.current) return; // Already initialized

    const effectiveCenter = geocodedCenter || center;
    const map = L.map(mapContainerRef.current, {
      center: effectiveCenter,
      zoom: zoom,
      zoomControl: true,
    });

    // Add Google Maps satellite tile layer
    L.tileLayer('https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}', {
      attribution: 'Map data &copy; Google',
      maxZoom: 21,
    }).addTo(map);

    // Add Google Maps labels/roads layer on top (hybrid view)
    L.tileLayer('https://mt1.google.com/vt/lyrs=h&x={x}&y={y}&z={z}', {
      maxZoom: 21,
    }).addTo(map);

    mapRef.current = map;

    // Cleanup
    return () => {
      map.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Only run once on mount - map initialization should happen only once

  // Update map when data changes
  useEffect(() => {
    if (!mapRef.current) return;
    const map = mapRef.current;

    // Remove old polygons
    if (parcelPolygonRef.current) {
      parcelPolygonRef.current.remove();
      parcelPolygonRef.current = null;
    }
    if (footprintPolygonRef.current) {
      footprintPolygonRef.current.remove();
      footprintPolygonRef.current = null;
    }
    // Remove old space layers
    for (const layer of spaceLayersRef.current) {
      layer.remove();
    }
    spaceLayersRef.current = [];

    // Determine what to show - priority: explicit boundary > geocoded > sample
    const parcelCoords = boundary || geocodedParcel || SAMPLE_PARCEL;
    const footprintCoords = buildingFootprint || geocodedFootprint;
    const showingSpaces = !!(currentFloor && projectId);

    // Fit map to parcel coords (for centering) but don't render boundary/footprint
    const parcelPoly = L.polygon(parcelCoords, {
      color: 'transparent',
      weight: 0,
      fillOpacity: 0,
    }).addTo(map);
    parcelPolygonRef.current = parcelPoly;

    // Render floor plan spaces if available
    if (currentFloor && projectId) {
      const transform = getFeetToLatLngTransform(projectId, floorArea);
      if (transform) {
        const { centroidLat, centroidLng, ftPerDegLat, ftPerDegLng, scaleFactor } = transform;

        /** Convert center-origin feet (x,y) to [lat, lng] */
        const feetToLatLng = (x: number, y: number): [number, number] => {
          // x → lng offset, y → lat offset (scaled by floor plate scale factor)
          const lng = centroidLng + (x / scaleFactor) / ftPerDegLng;
          const lat = centroidLat + (y / scaleFactor) / ftPerDegLat;
          return [lat, lng];
        };

        for (const space of currentFloor.spaces) {
          const color = getSpaceColor(space.type);
          let latLngs: [number, number][];

          if (isPolygonGeometry(space.geometry)) {
            latLngs = space.geometry.vertices.map(([x, y]) => feetToLatLng(x, y));
          } else if (isRectGeometry(space.geometry)) {
            const { x, y, width, height } = space.geometry;
            const hw = width / 2;
            const hh = height / 2;
            latLngs = [
              feetToLatLng(x - hw, y - hh),
              feetToLatLng(x + hw, y - hh),
              feetToLatLng(x + hw, y + hh),
              feetToLatLng(x - hw, y + hh),
            ];
          } else {
            continue;
          }

          const poly = L.polygon(latLngs, {
            color: '#000',
            weight: 0.3,
            fillColor: color,
            fillOpacity: 0.65,
          }).addTo(map);

          poly.bindPopup(`
            <div style="font-family: -apple-system, sans-serif; font-size: 11px;">
              <strong>${space.name}</strong><br/>
              Type: ${space.type}<br/>
              Area: ${Math.round(space.actual_area_sf)} SF
            </div>
          `);

          spaceLayersRef.current.push(poly);
        }
      }
    }

    // Fit map to parcel bounds
    map.fitBounds(parcelPoly.getBounds(), { padding: [50, 50] });

  }, [boundary, geocodedParcel, buildingFootprint, geocodedFootprint, projectName, floorArea, parcelArea, formattedAddress, currentFloor, projectId]);

  // Update map center when geocoded center changes
  useEffect(() => {
    if (!mapRef.current || !geocodedCenter) return;
    mapRef.current.setView(geocodedCenter, zoom);
  }, [geocodedCenter, zoom]);

  // Determine which space types are present for the legend
  const activeSpaceTypes = currentFloor
    ? SPACE_TYPE_LEGEND.filter(entry =>
        currentFloor.spaces.some(s => s.type === entry.type)
      )
    : [];

  return (
    <div style={styles.container}>
      {/* Loading indicator */}
      {isGeocoding && (
        <div style={styles.loadingOverlay}>
          <div style={styles.loadingSpinner} />
          <span>Finding location...</span>
        </div>
      )}

      {/* Error message */}
      {geocodingError && (
        <div style={styles.errorBanner}>
          {geocodingError}
        </div>
      )}

      <div ref={mapContainerRef} style={styles.map} />

      <div style={styles.legend}>
        {activeSpaceTypes.map(entry => (
          <div key={entry.type} style={styles.legendItem}>
            <span style={{ ...styles.legendColor, background: entry.color }} />
            <span>{entry.label}</span>
          </div>
        ))}
      </div>

      <div style={styles.hint}>
        {address ? `📍 ${address}` : 'Click parcel for details | Scroll to zoom'}
      </div>
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  container: {
    width: '100%',
    height: '100%',
    display: 'flex',
    flexDirection: 'column',
    background: '#1e1e2e',
    borderRadius: '8px',
    overflow: 'hidden',
    position: 'relative',
  },
  map: {
    flex: 1,
    minHeight: '400px',
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    padding: '8px 12px',
    background: 'rgba(30, 30, 46, 0.9)',
    color: '#a0a0b0',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    fontSize: '12px',
    zIndex: 1000,
  },
  loadingSpinner: {
    width: '14px',
    height: '14px',
    border: '2px solid #3a3a4a',
    borderTopColor: '#7c3aed',
    borderRadius: '50%',
    animation: 'spin 1s linear infinite',
  },
  errorBanner: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    padding: '8px 12px',
    background: 'rgba(220, 38, 38, 0.9)',
    color: '#fff',
    fontSize: '12px',
    zIndex: 1000,
  },
  legend: {
    display: 'flex',
    gap: '16px',
    padding: '8px 12px',
    background: '#2d2d3f',
    borderTop: '1px solid #3a3a4a',
    flexWrap: 'wrap',
  },
  legendItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    fontSize: '11px',
    color: '#a0a0b0',
  },
  legendColor: {
    width: '12px',
    height: '12px',
    borderRadius: '2px',
  },
  hint: {
    padding: '6px 12px',
    background: '#2d2d3f',
    fontSize: '10px',
    color: '#6c6c80',
    textAlign: 'center',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
};

export default ParcelMap;
