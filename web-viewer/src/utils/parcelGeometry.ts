/**
 * Parcel geometry utilities for real parcel shapes
 *
 * Provides hardcoded parcel polygons (converted from GeoJSON lat/lng to feet)
 * and geometry operations for scaling, insetting, and boundary analysis.
 */

import {
  type Point,
  type Polygon,
  calculatePolygonArea,
  calculateCentroid,
  scalePolygon,
} from './polygon';

// =============================================================================
// HARDCODED PARCEL POLYGONS (converted from GeoJSON to center-origin feet)
// =============================================================================
//
// Conversion from lat/lng to feet (Los Angeles area):
//   x = (lng - centroidLng) * 288200  (feet per degree longitude at ~34N)
//   y = (lat - centroidLat) * 364000  (feet per degree latitude)
// Polygons are centered at origin (0,0).

function convertGeoJsonToFeet(coords: number[][]): Polygon {
  // Calculate centroid of lng/lat coords
  let cLng = 0, cLat = 0;
  // Exclude last point if it duplicates first (GeoJSON closed ring)
  const ring = coords[coords.length - 1][0] === coords[0][0] &&
               coords[coords.length - 1][1] === coords[0][1]
    ? coords.slice(0, -1)
    : coords;

  for (const [lng, lat] of ring) {
    cLng += lng;
    cLat += lat;
  }
  cLng /= ring.length;
  cLat /= ring.length;

  const FT_PER_DEG_LNG = 288200;
  const FT_PER_DEG_LAT = 364000;

  return ring.map(([lng, lat]) => [
    (lng - cLng) * FT_PER_DEG_LNG,
    (lat - cLat) * FT_PER_DEG_LAT,
  ] as Point);
}

// P1 - 5240 N Lankershim Blvd (7-vertex irregular polygon)
const P1_GEOJSON: number[][] = [
  [-118.37490349962798, 34.165693990658085],
  [-118.37467334233435, 34.165789208630216],
  [-118.37469682777262, 34.1659368934356],
  [-118.37484948312057, 34.166181738727914],
  [-118.37480486078779, 34.16620700050339],
  [-118.37496925885486, 34.166504311600875],
  [-118.3753004035324, 34.16637023025507],
];

// P4 - 1723 Cloverfield Blvd (6-vertex polygon)
const P4_GEOJSON: number[][] = [
  [-118.47128304946774, 34.026451245666564],
  [-118.47099221555277, 34.0262102081888],
  [-118.47056275986552, 34.0265706378093],
  [-118.47063886593685, 34.02664497622831],
  [-118.47054101527391, 34.0267508520451],
  [-118.47073671659979, 34.02690403384527],
];

// P7 - 6464 Canoga Ave (4-vertex near-rectangle)
const P7_GEOJSON: number[][] = [
  [-118.59721278909241, 34.1881917698952],
  [-118.59721614524025, 34.18744774676111],
  [-118.59636368366544, 34.18745052297892],
  [-118.5963603275176, 34.18819732228182],
];

// P9 - 350 S Hill St (8-vertex irregular polygon)
const P9_GEOJSON: number[][] = [
  [-118.25022093172518, 34.0502674231122],
  [-118.24971135075477, 34.049947450481866],
  [-118.24956967353441, 34.05010270362472],
  [-118.24968164424081, 34.050168970123906],
  [-118.24962908656231, 34.050214409978864],
  [-118.2496610781927, 34.0502352365705],
  [-118.24943942189637, 34.05047379535168],
  [-118.24981875122825, 34.05071424677597],
];

type GeoJsonPolygonCoords = number[][];
type GeoJsonPolygonCollection = GeoJsonPolygonCoords[];
type LatLng = [number, number];

// Raw parcel polygons by project. Each project can carry one or more polygons.
const GEOJSON_MAP: Record<string, GeoJsonPolygonCollection> = {
  p1: [P1_GEOJSON],
  p4: [P4_GEOJSON],
  p7: [P7_GEOJSON],
  p9: [P9_GEOJSON],
};

// Pre-convert primary parcel polygon to feet for floor generation.
// Generation currently expects one boundary polygon per project.
const PARCEL_MAP: Record<string, Polygon> = {
  p1: convertGeoJsonToFeet(P1_GEOJSON),
  p4: convertGeoJsonToFeet(P4_GEOJSON),
  p7: convertGeoJsonToFeet(P7_GEOJSON),
  p9: convertGeoJsonToFeet(P9_GEOJSON),
};

// =============================================================================
// PUBLIC API
// =============================================================================

/**
 * Get the parcel polygon for a project, in center-origin feet.
 * Returns null for unknown project IDs (caller should fall back to square).
 */
export function getParcelPolygon(projectId: string): Polygon | null {
  return PARCEL_MAP[projectId.toLowerCase()] ?? null;
}

/**
 * Scale a polygon so its area equals targetAreaSf.
 * Uses centroid-based scaling from polygon.ts.
 */
export function scalePolygonToArea(polygon: Polygon, targetAreaSf: number): Polygon {
  const currentArea = calculatePolygonArea(polygon);
  if (currentArea < 1) return polygon;
  const scaleFactor = Math.sqrt(targetAreaSf / currentArea);
  return scalePolygon(polygon, scaleFactor);
}

/**
 * Shrink a polygon inward by insetFt along each edge.
 * For each edge: compute inward normal, offset edge, intersect adjacent offset edges.
 * Works well for convex and near-convex parcels.
 */
export function insetPolygon(polygon: Polygon, insetFt: number): Polygon {
  if (insetFt <= 0) return polygon;
  const n = polygon.length;
  if (n < 3) return polygon;

  const centroid = calculateCentroid(polygon);

  // Compute offset lines for each edge
  const offsetLines: Array<{ p1: Point; p2: Point }> = [];

  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    const [x1, y1] = polygon[i];
    const [x2, y2] = polygon[j];

    // Edge direction
    const dx = x2 - x1;
    const dy = y2 - y1;
    const len = Math.sqrt(dx * dx + dy * dy);
    if (len < 1e-10) continue;

    // Two possible normals: (-dy, dx) and (dy, -dx)
    // Pick the one pointing toward centroid
    const nx1 = -dy / len;
    const ny1 = dx / len;
    const midX = (x1 + x2) / 2;
    const midY = (y1 + y2) / 2;

    // Dot product of normal with vector from midpoint to centroid
    const toCentroidX = centroid[0] - midX;
    const toCentroidY = centroid[1] - midY;
    const dot = nx1 * toCentroidX + ny1 * toCentroidY;

    let nx: number, ny: number;
    if (dot > 0) {
      nx = nx1;
      ny = ny1;
    } else {
      nx = -nx1;
      ny = -ny1;
    }

    // Offset the edge inward
    offsetLines.push({
      p1: [x1 + nx * insetFt, y1 + ny * insetFt],
      p2: [x2 + nx * insetFt, y2 + ny * insetFt],
    });
  }

  if (offsetLines.length < 3) return polygon;

  // Intersect adjacent offset edges to get new vertices
  const result: Polygon = [];
  for (let i = 0; i < offsetLines.length; i++) {
    const j = (i + 1) % offsetLines.length;
    const pt = lineLineIntersection(
      offsetLines[i].p1, offsetLines[i].p2,
      offsetLines[j].p1, offsetLines[j].p2
    );
    if (pt) {
      result.push(pt);
    }
  }

  // Sanity check: if inset collapsed the polygon, return a smaller version
  if (result.length < 3 || calculatePolygonArea(result) < 10) {
    return scalePolygon(polygon, 0.8);
  }

  return result;
}

/**
 * Find where a vertical (x=value) or horizontal (y=value) line intersects the polygon boundary.
 * Returns the min and max extent along the perpendicular axis.
 * Used to determine corridor arm lengths.
 */
export function findBoundaryExtent(
  polygon: Polygon,
  axis: 'x' | 'y',
  value: number
): { min: number; max: number } | null {
  const intersections: number[] = [];
  const n = polygon.length;

  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    const [x1, y1] = polygon[i];
    const [x2, y2] = polygon[j];

    if (axis === 'x') {
      // Vertical line x=value; find y intersections
      if ((x1 <= value && x2 >= value) || (x2 <= value && x1 >= value)) {
        if (Math.abs(x2 - x1) < 1e-10) {
          intersections.push(y1, y2);
        } else {
          const t = (value - x1) / (x2 - x1);
          if (t >= 0 && t <= 1) {
            intersections.push(y1 + t * (y2 - y1));
          }
        }
      }
    } else {
      // Horizontal line y=value; find x intersections
      if ((y1 <= value && y2 >= value) || (y2 <= value && y1 >= value)) {
        if (Math.abs(y2 - y1) < 1e-10) {
          intersections.push(x1, x2);
        } else {
          const t = (value - y1) / (y2 - y1);
          if (t >= 0 && t <= 1) {
            intersections.push(x1 + t * (x2 - x1));
          }
        }
      }
    }
  }

  if (intersections.length < 2) return null;

  return {
    min: Math.min(...intersections),
    max: Math.max(...intersections),
  };
}

/**
 * Get the boundary polygon for a project, scaled to the given floor plate area.
 * Returns { polygon, isIrregular }.
 * Falls back to a square if no parcel shape is found.
 */
export function generateFloorBoundary(
  projectId: string | undefined,
  floorPlateArea: number,
  insetFeet: number = 3
): { polygon: Polygon; isIrregular: boolean } {
  const parcel = projectId ? getParcelPolygon(projectId) : null;

  if (parcel) {
    const scaled = scalePolygonToArea(parcel, floorPlateArea);
    const inset = insetPolygon(scaled, insetFeet);
    // Re-center so centroid is at origin — core lives at (0,0)
    const centroid = calculateCentroid(inset);
    const centered: Polygon = inset.map(([x, y]) => [
      x - centroid[0],
      y - centroid[1],
    ] as Point);
    return { polygon: centered, isIrregular: true };
  }

  // Fallback: square centered at origin
  const side = Math.sqrt(floorPlateArea);
  const h = side / 2;
  const square: Polygon = [
    [-h, -h],
    [h, -h],
    [h, h],
    [-h, h],
  ];
  return { polygon: square, isIrregular: false };
}

// =============================================================================
// INTERNAL HELPERS
// =============================================================================

/**
 * Find intersection point of two lines (each defined by two points).
 * Returns null if lines are parallel.
 */
export function lineLineIntersection(p1: Point, p2: Point, p3: Point, p4: Point): Point | null {
  const x1 = p1[0], y1 = p1[1];
  const x2 = p2[0], y2 = p2[1];
  const x3 = p3[0], y3 = p3[1];
  const x4 = p4[0], y4 = p4[1];

  const denom = (x1 - x2) * (y3 - y4) - (y1 - y2) * (x3 - x4);
  if (Math.abs(denom) < 1e-10) return null;

  const t = ((x1 - x3) * (y3 - y4) - (y1 - y3) * (x3 - x4)) / denom;

  return [
    x1 + t * (x2 - x1),
    y1 + t * (y2 - y1),
  ];
}

// =============================================================================
// GEOJSON COORDINATE EXPORTS (for Leaflet map overlays)
// =============================================================================

function normalizeRing(ring: number[][]): number[][] {
  if (ring.length < 2) return ring;
  const first = ring[0];
  const last = ring[ring.length - 1];
  if (first[0] === last[0] && first[1] === last[1]) {
    return ring.slice(0, -1);
  }
  return ring;
}

function getProjectPolygonCollection(projectId: string | undefined): GeoJsonPolygonCollection | null {
  if (!projectId) return null;
  return GEOJSON_MAP[projectId.toLowerCase()] ?? null;
}

function getGlobalCentroid(polygons: GeoJsonPolygonCollection): { lng: number; lat: number } {
  let sumLng = 0;
  let sumLat = 0;
  let count = 0;

  for (const ringRaw of polygons) {
    const ring = normalizeRing(ringRaw);
    for (const [lng, lat] of ring) {
      sumLng += lng;
      sumLat += lat;
      count++;
    }
  }

  if (count === 0) return { lng: 0, lat: 0 };
  return { lng: sumLng / count, lat: sumLat / count };
}

function polygonsTotalAreaFeet(polygons: GeoJsonPolygonCollection, center: { lng: number; lat: number }): number {
  const FT_PER_DEG_LNG = 288200;
  const FT_PER_DEG_LAT = 364000;
  let totalArea = 0;

  for (const ringRaw of polygons) {
    const ring = normalizeRing(ringRaw);
    const feetPoly: Polygon = ring.map(([lng, lat]) => [
      (lng - center.lng) * FT_PER_DEG_LNG,
      (lat - center.lat) * FT_PER_DEG_LAT,
    ] as Point);
    totalArea += calculatePolygonArea(feetPoly);
  }

  return totalArea;
}

/**
 * Return raw parcel lat/lng polygons as [lat, lng][][] (Leaflet format).
 * GeoJSON stores [lng, lat], so we swap.
 */
export function getParcelGeoJsonPolygons(projectId: string | undefined): LatLng[][] | null {
  const polygons = getProjectPolygonCollection(projectId);
  if (!polygons) return null;
  return polygons.map((ringRaw) => {
    const ring = normalizeRing(ringRaw);
    return ring.map(([lng, lat]) => [lat, lng] as LatLng);
  });
}

/**
 * Return raw parcel lat/lng coords as [lat, lng][] (Leaflet format).
 * GeoJSON stores [lng, lat], so we swap.
 * Returns null for unknown project IDs.
 */
export function getParcelGeoJsonCoords(projectId: string | undefined): [number, number][] | null {
  const polygons = getParcelGeoJsonPolygons(projectId);
  return polygons?.[0] ?? null;
}

/**
 * Return parcel GeoJSON coords scaled so the polygon area ≈ targetAreaSf.
 * Useful for showing a building footprint overlay at the correct scale.
 * Returns [lat, lng][] for Leaflet, or null for unknown projects.
 */
export function getScaledParcelGeoJsonPolygons(
  projectId: string | undefined,
  targetAreaSf: number | undefined
): [number, number][][] | null {
  if (!projectId || !targetAreaSf) return null;
  const polygons = getProjectPolygonCollection(projectId);
  if (!polygons) return null;

  const center = getGlobalCentroid(polygons);
  const currentArea = polygonsTotalAreaFeet(polygons, center);
  if (currentArea < 1) return null;

  const scaleFactor = Math.sqrt(targetAreaSf / currentArea);

  return polygons.map((ringRaw) => {
    const ring = normalizeRing(ringRaw);
    return ring.map(([lng, lat]) => [
      center.lat + (lat - center.lat) * scaleFactor,
      center.lng + (lng - center.lng) * scaleFactor,
    ] as [number, number]);
  });
}

export function getScaledParcelGeoJson(
  projectId: string | undefined,
  targetAreaSf: number | undefined
): [number, number][] | null {
  const polygons = getScaledParcelGeoJsonPolygons(projectId, targetAreaSf);
  return polygons?.[0] ?? null;
}

/**
 * Get transform parameters for converting center-origin feet coordinates
 * to lat/lng, for a given project and floor plate area.
 * Returns null for unknown project IDs.
 */
export function getFeetToLatLngTransform(
  projectId: string | undefined,
  floorPlateArea: number | undefined
): { centroidLat: number; centroidLng: number; ftPerDegLat: number; ftPerDegLng: number; scaleFactor: number } | null {
  if (!projectId || !floorPlateArea) return null;
  const polygons = getProjectPolygonCollection(projectId);
  const coords = polygons?.[0];
  if (!coords) return null;

  // Compute centroid in lng/lat space (same logic as getScaledParcelGeoJson)
  const ring = coords[coords.length - 1][0] === coords[0][0] &&
               coords[coords.length - 1][1] === coords[0][1]
    ? coords.slice(0, -1)
    : coords;

  let cLng = 0, cLat = 0;
  for (const [lng, lat] of ring) {
    cLng += lng;
    cLat += lat;
  }
  cLng /= ring.length;
  cLat /= ring.length;

  const FT_PER_DEG_LNG = 288200;
  const FT_PER_DEG_LAT = 364000;

  // Convert to feet to compute current area and scale factor
  const feetPoly: Polygon = ring.map(([lng, lat]) => [
    (lng - cLng) * FT_PER_DEG_LNG,
    (lat - cLat) * FT_PER_DEG_LAT,
  ] as Point);

  const currentArea = calculatePolygonArea(feetPoly);
  if (currentArea < 1) return null;

  const scaleFactor = Math.sqrt(floorPlateArea / currentArea);

  // Replicate the inset + re-center chain from generateFloorBoundary
  // so map coordinates align with floor space coordinates.
  const scaled = scalePolygon(feetPoly, scaleFactor);
  const inset = insetPolygon(scaled, 3);
  const insetCentroid = calculateCentroid(inset);

  // The inset centroid in feet tells us where (0,0) maps to in raw GeoJSON space.
  // Convert back to lat/lng offset.
  const offsetLng = insetCentroid[0] / scaleFactor / FT_PER_DEG_LNG;
  const offsetLat = insetCentroid[1] / scaleFactor / FT_PER_DEG_LAT;

  return {
    centroidLat: cLat + offsetLat,
    centroidLng: cLng + offsetLng,
    ftPerDegLat: FT_PER_DEG_LAT,
    ftPerDegLng: FT_PER_DEG_LNG,
    scaleFactor,
  };
}

// Re-export types used externally
export type { Point, Polygon };
