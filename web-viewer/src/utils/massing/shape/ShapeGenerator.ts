import type { Polygon, ShapeDimensions, MassingShape } from '../types';

export abstract class ShapeGenerator {
  abstract generate(dimensions: ShapeDimensions): MassingShape;

  protected normalizeDimensions(dimensions: ShapeDimensions): Required<ShapeDimensions> {
    return {
      width: dimensions.width,
      height: dimensions.height,
      courtyardWidth: dimensions.courtyardWidth ?? 0,
      courtyardDepth: dimensions.courtyardDepth ?? 0,
      armWidth: dimensions.armWidth ?? 0,
      armDepth: dimensions.armDepth ?? 0
    };
  }
}

export function createRectangle(
  width: number,
  height: number,
  centerX: number = 0,
  centerY: number = 0
): Polygon {
  const halfWidth = width / 2;
  const halfHeight = height / 2;

  return {
    points: [
      { x: centerX - halfWidth, y: centerY - halfHeight },
      { x: centerX + halfWidth, y: centerY - halfHeight },
      { x: centerX + halfWidth, y: centerY + halfHeight },
      { x: centerX - halfWidth, y: centerY + halfHeight }
    ]
  };
}

export function translatePolygon(polygon: Polygon, dx: number, dy: number): Polygon {
  return {
    points: polygon.points.map(point => ({
      x: point.x + dx,
      y: point.y + dy
    }))
  };
}

export function computePolygonArea(polygon: Polygon): number {
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
