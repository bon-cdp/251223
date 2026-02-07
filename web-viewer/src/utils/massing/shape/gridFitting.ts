import type { Polygon } from '../types';
import { findLargestRectangle, rectangleToPolygon } from './RectangleFitter';
import { MassingGrid } from '../grid/MassingGrid';

export interface GridFittingResult {
  grid: MassingGrid;
  fittedRectangle: Polygon;
  rectangleArea: number;
  plotArea: number;
  utilization: number;
}

export function fitGridToShape(polygon: Polygon): GridFittingResult | null {
  const rectangle = findLargestRectangle(polygon, 2);

  if (!rectangle) {
    return null;
  }

  const rectanglePolygon = rectangleToPolygon(rectangle);

  const grid = MassingGrid.fromPolygon(rectanglePolygon, 2);

  const plotArea = computePolygonArea(polygon);
  const utilization = rectangle.area / plotArea;

  return {
    grid,
    fittedRectangle: rectanglePolygon,
    rectangleArea: rectangle.area,
    plotArea,
    utilization
  };
}

export function fitGridWithSetbacks(
  polygon: Polygon,
  setbacks: { front: number; rear: number; side: number }
): GridFittingResult | null {
  const bounds = computeBounds(polygon);

  const innerPolygon = applySetbacks(polygon, bounds, setbacks);

  return fitGridToShape(innerPolygon);
}

function applySetbacks(
  polygon: Polygon,
  bounds: { minX: number; minY: number; maxX: number; maxY: number },
  setbacks: { front: number; rear: number; side: number }
): Polygon {
  const clippedPoints = polygon.points
    .map(point => {
      const x = Math.max(bounds.minX + setbacks.side, Math.min(bounds.maxX - setbacks.side, point.x));
      const y = Math.max(bounds.minY + setbacks.front, Math.min(bounds.maxY - setbacks.rear, point.y));

      return { x, y };
    })
    .filter((point, index, arr) => {
      if (index === 0) return true;

      const prev = arr[index - 1];
      return Math.abs(point.x - prev.x) > 0.1 || Math.abs(point.y - prev.y) > 0.1;
    });

  return { points: clippedPoints };
}

function computeBounds(polygon: Polygon): {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
} {
  const points = polygon.points;

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const point of points) {
    minX = Math.min(minX, point.x);
    minY = Math.min(minY, point.y);
    maxX = Math.max(maxX, point.x);
    maxY = Math.max(maxY, point.y);
  }

  return { minX, minY, maxX, maxY };
}

function computePolygonArea(polygon: Polygon): number {
  const points = polygon.points;
  let area = 0;

  for (let i = 0; i < points.length; i++) {
    const x0 = points[i].x;
    const y0 = points[i].y;
    const x1 = points[(i + 1) % points.length].x;
    const y1 = points[(i + 1) % points.length].y;

    area += x0 * y1 - x1 * y0;
  }

  return Math.abs(area) / 2;
}
