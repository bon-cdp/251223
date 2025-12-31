/**
 * Google Maps Geocoding utility
 * Converts addresses to lat/lng coordinates and creates parcel boundaries
 */

const GOOGLE_MAPS_API_KEY = 'AIzaSyB2qRjqPVc28tWoiE_gVl3kUXCeBgMy76E';

interface GeocodingResult {
  lat: number;
  lng: number;
  formattedAddress: string;
  bounds?: {
    northeast: { lat: number; lng: number };
    southwest: { lat: number; lng: number };
  };
}

/**
 * Geocode an address using Google Maps Geocoding API
 */
export async function geocodeAddress(address: string): Promise<GeocodingResult | null> {
  try {
    const encodedAddress = encodeURIComponent(address);
    const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodedAddress}&key=${GOOGLE_MAPS_API_KEY}`;

    const response = await fetch(url);
    const data = await response.json();

    if (data.status === 'OK' && data.results.length > 0) {
      const result = data.results[0];
      return {
        lat: result.geometry.location.lat,
        lng: result.geometry.location.lng,
        formattedAddress: result.formatted_address,
        bounds: result.geometry.bounds || result.geometry.viewport,
      };
    }

    console.warn('Geocoding failed:', data.status, data.error_message);
    return null;
  } catch (error) {
    console.error('Geocoding error:', error);
    return null;
  }
}

/**
 * Create a parcel boundary polygon from a center point and area
 * @param center The center lat/lng of the parcel
 * @param areaSF The area in square feet
 * @returns Array of [lat, lng] coordinates forming a rectangle
 */
export function createParcelBoundary(
  center: { lat: number; lng: number },
  areaSF: number
): [number, number][] {
  // Convert square feet to approximate dimensions
  // Assuming a square parcel
  const sideLengthFeet = Math.sqrt(areaSF);

  // Convert feet to degrees
  // 1 degree latitude ≈ 364,000 feet
  // 1 degree longitude varies by latitude: 364,000 * cos(lat)
  const feetPerDegreeLat = 364000;
  const feetPerDegreeLng = feetPerDegreeLat * Math.cos(center.lat * Math.PI / 180);

  const latOffset = (sideLengthFeet / 2) / feetPerDegreeLat;
  const lngOffset = (sideLengthFeet / 2) / feetPerDegreeLng;

  // Return polygon vertices (clockwise from top-left)
  return [
    [center.lat + latOffset, center.lng - lngOffset], // NW
    [center.lat + latOffset, center.lng + lngOffset], // NE
    [center.lat - latOffset, center.lng + lngOffset], // SE
    [center.lat - latOffset, center.lng - lngOffset], // SW
  ];
}

/**
 * Create a building footprint polygon from a center point and floor plate area
 * This creates a slightly smaller rectangle inside the parcel
 */
export function createBuildingFootprint(
  center: { lat: number; lng: number },
  floorPlateSF: number
): [number, number][] {
  return createParcelBoundary(center, floorPlateSF);
}

export default { geocodeAddress, createParcelBoundary, createBuildingFootprint };
