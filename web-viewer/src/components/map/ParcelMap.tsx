/**
 * Parcel Map component using Leaflet
 * Shows parcel boundary on satellite imagery
 */

import React, { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

interface ParcelMapProps {
  // Parcel boundary in lat/lng coordinates
  boundary?: [number, number][];
  // Building footprint (optional)
  buildingFootprint?: [number, number][];
  // Center point if no boundary
  center?: [number, number];
  // Zoom level
  zoom?: number;
  // Floor plate area in SF (for display)
  floorArea?: number;
  // Project name
  projectName?: string;
}

// Default center: Los Angeles (common for CA real estate)
const DEFAULT_CENTER: [number, number] = [34.0522, -118.2437];
const DEFAULT_ZOOM = 18;

// Sample parcel coordinates (placeholder - would come from APN lookup)
const SAMPLE_PARCEL: [number, number][] = [
  [34.0525, -118.2440],
  [34.0525, -118.2435],
  [34.0520, -118.2435],
  [34.0520, -118.2440],
];

export const ParcelMap: React.FC<ParcelMapProps> = ({
  boundary,
  buildingFootprint,
  center = DEFAULT_CENTER,
  zoom = DEFAULT_ZOOM,
  floorArea,
  projectName,
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);

  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    // Initialize map
    const map = L.map(mapContainerRef.current, {
      center: center,
      zoom: zoom,
      zoomControl: true,
    });

    // Add ESRI World Imagery (satellite) tile layer
    L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
      attribution: 'Tiles &copy; Esri',
      maxZoom: 20,
    }).addTo(map);

    // Add labels layer on top
    L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}', {
      maxZoom: 20,
    }).addTo(map);

    // Use provided boundary or sample
    const parcelCoords = boundary || SAMPLE_PARCEL;

    // Add parcel boundary polygon
    const parcelPolygon = L.polygon(parcelCoords, {
      color: '#7c3aed',
      weight: 3,
      fillColor: '#7c3aed',
      fillOpacity: 0.2,
    }).addTo(map);

    // Add building footprint if provided
    if (buildingFootprint) {
      L.polygon(buildingFootprint, {
        color: '#10b981',
        weight: 2,
        fillColor: '#10b981',
        fillOpacity: 0.4,
      }).addTo(map);
    }

    // Fit map to parcel bounds
    map.fitBounds(parcelPolygon.getBounds(), { padding: [50, 50] });

    // Add popup with info
    const popupContent = `
      <div style="font-family: -apple-system, sans-serif; font-size: 12px;">
        <strong>${projectName || 'Parcel'}</strong>
        ${floorArea ? `<br/>Floor Area: ${floorArea.toLocaleString()} SF` : ''}
      </div>
    `;
    parcelPolygon.bindPopup(popupContent);

    mapRef.current = map;

    // Cleanup
    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, [boundary, buildingFootprint, center, zoom, floorArea, projectName]);

  return (
    <div style={styles.container}>
      <div ref={mapContainerRef} style={styles.map} />
      <div style={styles.legend}>
        <div style={styles.legendItem}>
          <span style={{ ...styles.legendColor, background: '#7c3aed' }} />
          <span>Parcel Boundary</span>
        </div>
        {buildingFootprint && (
          <div style={styles.legendItem}>
            <span style={{ ...styles.legendColor, background: '#10b981' }} />
            <span>Building Footprint</span>
          </div>
        )}
      </div>
      <div style={styles.hint}>
        Click parcel for details | Scroll to zoom
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
  },
  map: {
    flex: 1,
    minHeight: '400px',
  },
  legend: {
    display: 'flex',
    gap: '16px',
    padding: '8px 12px',
    background: '#2d2d3f',
    borderTop: '1px solid #3a3a4a',
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
  },
};

export default ParcelMap;
