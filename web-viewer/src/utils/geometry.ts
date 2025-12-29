/**
 * Geometry utilities for coordinate transformations
 * Supports both rectangle and polygon geometries
 */

import {
  Geometry,
  FloorData,
  RectGeometry,
  PolygonGeometry,
  isPolygonGeometry,
  isRectGeometry,
  rectToPolygon,
} from '../types/solverOutput';
import { calculateCentroid, calculatePolygonArea } from './polygon';

export interface BoundingBox {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

export const getBoundingBox = (boundary: number[][]): BoundingBox => {
  if (!boundary || boundary.length === 0) {
    return { minX: 0, minY: 0, maxX: 100, maxY: 100 };
  }

  const xs = boundary.map(p => p[0]);
  const ys = boundary.map(p => p[1]);

  return {
    minX: Math.min(...xs),
    minY: Math.min(...ys),
    maxX: Math.max(...xs),
    maxY: Math.max(...ys),
  };
};

export const getFloorBounds = (floor: FloorData): BoundingBox => {
  return getBoundingBox(floor.boundary);
};

export interface SvgTransform {
  scale: number;
  margin: number;
  svgWidth: number;
  svgHeight: number;
  bounds: BoundingBox;
}

export const createSvgTransform = (
  bounds: BoundingBox,
  scale: number = 3,
  margin: number = 20
): SvgTransform => {
  const width = bounds.maxX - bounds.minX;
  const height = bounds.maxY - bounds.minY;

  return {
    scale,
    margin,
    svgWidth: width * scale + margin * 2,
    svgHeight: height * scale + margin * 2,
    bounds,
  };
};

/**
 * Convert world coordinates to SVG coordinates
 * SVG has Y-axis flipped (0 at top)
 */
export const worldToSvg = (
  x: number,
  y: number,
  transform: SvgTransform
): { x: number; y: number } => {
  const { scale, margin, svgHeight, bounds } = transform;

  return {
    x: (x - bounds.minX) * scale + margin,
    y: svgHeight - ((y - bounds.minY) * scale + margin),
  };
};

/**
 * Convert center-based geometry to SVG rectangle props
 * Handles both RectGeometry and PolygonGeometry (converts polygon to bounding rect)
 */
export const geometryToSvgRect = (
  geometry: Geometry,
  transform: SvgTransform
): { x: number; y: number; width: number; height: number; rotation: number } => {
  const { scale } = transform;

  if (isPolygonGeometry(geometry)) {
    // For polygons, use centroid as center and bounding box for dimensions
    const centroid = calculateCentroid(geometry.vertices);
    const center = worldToSvg(centroid[0], centroid[1], transform);

    const xs = geometry.vertices.map(v => v[0]);
    const ys = geometry.vertices.map(v => v[1]);
    const width = (Math.max(...xs) - Math.min(...xs)) * scale;
    const height = (Math.max(...ys) - Math.min(...ys)) * scale;

    return {
      x: center.x,
      y: center.y,
      width,
      height,
      rotation: geometry.rotation || 0,
    };
  }

  // RectGeometry - original logic
  const center = worldToSvg(geometry.x, geometry.y, transform);

  return {
    x: center.x,
    y: center.y,
    width: geometry.width * scale,
    height: geometry.height * scale,
    rotation: geometry.rotation,
  };
};

/**
 * Convert polygon geometry to SVG path string
 */
export const polygonToSvgPath = (
  geometry: PolygonGeometry,
  transform: SvgTransform
): string => {
  if (!geometry.vertices || geometry.vertices.length === 0) return '';

  return geometry.vertices
    .map((point, i) => {
      const svg = worldToSvg(point[0], point[1], transform);
      return `${i === 0 ? 'M' : 'L'}${svg.x},${svg.y}`;
    })
    .join(' ') + ' Z';
};

/**
 * Get polygon vertices in SVG coordinates
 */
export const getPolygonSvgVertices = (
  geometry: Geometry,
  transform: SvgTransform
): Array<{ x: number; y: number; index: number }> => {
  let vertices: [number, number][];

  if (isPolygonGeometry(geometry)) {
    vertices = geometry.vertices;
  } else {
    // Convert rect to polygon
    vertices = rectToPolygon(geometry);
  }

  return vertices.map((v, index) => {
    const svg = worldToSvg(v[0], v[1], transform);
    return { x: svg.x, y: svg.y, index };
  });
};

/**
 * Get edge midpoints in SVG coordinates (for adding vertices)
 */
export const getEdgeMidpointsSvg = (
  geometry: Geometry,
  transform: SvgTransform
): Array<{ x: number; y: number; edgeIndex: number }> => {
  let vertices: [number, number][];

  if (isPolygonGeometry(geometry)) {
    vertices = geometry.vertices;
  } else {
    vertices = rectToPolygon(geometry);
  }

  const midpoints: Array<{ x: number; y: number; edgeIndex: number }> = [];

  for (let i = 0; i < vertices.length; i++) {
    const j = (i + 1) % vertices.length;
    const midX = (vertices[i][0] + vertices[j][0]) / 2;
    const midY = (vertices[i][1] + vertices[j][1]) / 2;
    const svg = worldToSvg(midX, midY, transform);
    midpoints.push({ x: svg.x, y: svg.y, edgeIndex: i });
  }

  return midpoints;
};

/**
 * Convert SVG coordinates back to world coordinates
 */
export const svgToWorld = (
  svgX: number,
  svgY: number,
  transform: SvgTransform
): { x: number; y: number } => {
  const { scale, margin, svgHeight, bounds } = transform;

  return {
    x: (svgX - margin) / scale + bounds.minX,
    y: (svgHeight - svgY - margin) / scale + bounds.minY,
  };
};

/**
 * Get geometry area (works for both rect and polygon)
 */
export const getGeometryArea = (geometry: Geometry): number => {
  if (isPolygonGeometry(geometry)) {
    return calculatePolygonArea(geometry.vertices);
  }
  return geometry.width * geometry.height;
};

/**
 * Get geometry center (works for both rect and polygon)
 */
export const getGeometryCenter = (geometry: Geometry): { x: number; y: number } => {
  if (isPolygonGeometry(geometry)) {
    const centroid = calculateCentroid(geometry.vertices);
    return { x: centroid[0], y: centroid[1] };
  }
  return { x: geometry.x, y: geometry.y };
};

/**
 * Convert boundary polygon to SVG path points
 */
export const boundaryToSvgPoints = (
  boundary: number[][],
  transform: SvgTransform
): string => {
  if (!boundary || boundary.length === 0) return '';

  return boundary
    .map((point, i) => {
      const svg = worldToSvg(point[0], point[1], transform);
      return `${i === 0 ? 'M' : 'L'}${svg.x},${svg.y}`;
    })
    .join(' ') + ' Z';
};
