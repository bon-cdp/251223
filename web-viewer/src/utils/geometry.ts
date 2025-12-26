/**
 * Geometry utilities for coordinate transformations
 */

import { Geometry, FloorData } from '../types/solverOutput';

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
 */
export const geometryToSvgRect = (
  geometry: Geometry,
  transform: SvgTransform
): { x: number; y: number; width: number; height: number; rotation: number } => {
  const { scale } = transform;

  // Center point in SVG coordinates
  const center = worldToSvg(geometry.x, geometry.y, transform);

  // For rotated rectangles, we position at center and use transform
  return {
    x: center.x,
    y: center.y,
    width: geometry.width * scale,
    height: geometry.height * scale,
    rotation: geometry.rotation,
  };
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
