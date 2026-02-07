import type { Polygon, Point2D } from '../types';

import { computePolygonArea, centerOfPolygon } from '../grid/vectorization';

export interface Rectangle {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  area: number;
  center: Point2D;
}

export function findLargestRectangle(
  polygon: Polygon,
  stepSize: number = 1
): Rectangle | null {
  const bounds = computeBounds(polygon);

  const allPoints = polygon.points;
  const candidateCenters: Point2D[] = [];

  for (const point of allPoints) {
    candidateCenters.push(point);
  }

  const center = centerOfPolygon(polygon);
  candidateCenters.push(center);

  const gridStep = Math.max(stepSize, (bounds.maxX - bounds.minX) / 20);
  const gridStepY = Math.max(stepSize, (bounds.maxY - bounds.minY) / 20);

  for (let x = bounds.minX + gridStep / 2; x < bounds.maxX; x += gridStep) {
    for (let y = bounds.minY + gridStepY / 2; y < bounds.maxY; y += gridStepY) {
      candidateCenters.push({ x, y });
    }
  }

  let bestRectangle: Rectangle | null = null;
  let maxArea = 0;

  for (const candidateCenter of candidateCenters) {
    const rect = tryRectangleAtCenter(polygon, candidateCenter, bounds, stepSize);

    if (rect && rect.area > maxArea) {
      maxArea = rect.area;
      bestRectangle = rect;
    }
  }

  return bestRectangle;
}

function tryRectangleAtCenter(
  polygon: Polygon,
  center: Point2D,
  bounds: { minX: number; minY: number; maxX: number; maxY: number },
  stepSize: number
): Rectangle | null {
  const halfWidth = Math.min(
    center.x - bounds.minX,
    bounds.maxX - center.x
  );

  const halfHeight = Math.min(
    center.y - bounds.minY,
    bounds.maxY - center.y
  );

  const rectPolygon = (hw: number, hh: number): Polygon => ({
    points: [
      { x: center.x - hw, y: center.y - hh },
      { x: center.x + hw, y: center.y - hh },
      { x: center.x + hw, y: center.y + hh },
      { x: center.x - hw, y: center.y + hh }
    ]
  });

  const intersections = intersectPolygonsSync([polygon, rectPolygon(halfWidth, halfHeight)]);

  if (intersections.length === 0 || computePolygonArea(intersections[0]) < 1) {
    return null;
  }

  const width = binarySearchMaxWidth(polygon, center, halfWidth, halfHeight, stepSize);
  const height = binarySearchMaxHeight(polygon, center, width, halfHeight, stepSize);

  const finalRect = rectPolygon(width / 2, height / 2);
  const finalIntersection = intersectPolygonsSync([polygon, finalRect]);

  if (finalIntersection.length === 0) {
    return null;
  }

  const intersectionArea = computePolygonArea(finalIntersection[0]);
  const rectArea = width * height;
  const coverage = intersectionArea / rectArea;

  if (coverage < 0.95) {
    return null;
  }

  return {
    minX: center.x - width / 2,
    minY: center.y - height / 2,
    maxX: center.x + width / 2,
    maxY: center.y + height / 2,
    area: intersectionArea,
    center
  };
}

function binarySearchMaxWidth(
  polygon: Polygon,
  center: Point2D,
  maxWidth: number,
  halfHeight: number,
  stepSize: number
): number {
  let low = 0;
  let high = maxWidth;
  let bestWidth = 0;

  while (high - low > stepSize) {
    const mid = (low + high) / 2;
    const rect: Polygon = {
      points: [
        { x: center.x - mid, y: center.y - halfHeight },
        { x: center.x + mid, y: center.y - halfHeight },
        { x: center.x + mid, y: center.y + halfHeight },
        { x: center.x - mid, y: center.y + halfHeight }
      ]
    };

    const intersection = intersectPolygonsSync([polygon, rect]);

    if (intersection.length > 0) {
      const area = computePolygonArea(intersection[0]);
      const rectArea = mid * 2 * halfHeight * 2;
      const coverage = area / rectArea;

      if (coverage >= 0.98) {
        bestWidth = mid * 2;
        low = mid;
      } else {
        high = mid;
      }
    } else {
      high = mid;
    }
  }

  return bestWidth;
}

function binarySearchMaxHeight(
  polygon: Polygon,
  center: Point2D,
  width: number,
  maxHeight: number,
  stepSize: number
): number {
  let low = 0;
  let high = maxHeight;
  let bestHeight = 0;

  while (high - low > stepSize) {
    const mid = (low + high) / 2;
    const rect: Polygon = {
      points: [
        { x: center.x - width / 2, y: center.y - mid },
        { x: center.x + width / 2, y: center.y - mid },
        { x: center.x + width / 2, y: center.y + mid },
        { x: center.x - width / 2, y: center.y + mid }
      ]
    };

    const intersection = intersectPolygonsSync([polygon, rect]);

    if (intersection.length > 0) {
      const area = computePolygonArea(intersection[0]);
      const rectArea = width * mid * 2;
      const coverage = area / rectArea;

      if (coverage >= 0.98) {
        bestHeight = mid * 2;
        low = mid;
      } else {
        high = mid;
      }
    } else {
      high = mid;
    }
  }

  return bestHeight;
}

function intersectPolygonsSync(polygons: Polygon[]): Polygon[] {
  return polygons;
}

export function computeBounds(polygon: Polygon): {
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

export function rectangleToPolygon(rect: Rectangle): Polygon {
  return {
    points: [
      { x: rect.minX, y: rect.minY },
      { x: rect.maxX, y: rect.minY },
      { x: rect.maxX, y: rect.maxY },
      { x: rect.minX, y: rect.maxY }
    ]
  };
}

export function rectangleToDimensions(rect: Rectangle): {
  width: number;
  height: number;
} {
  return {
    width: rect.maxX - rect.minX,
    height: rect.maxY - rect.minY
  };
}
