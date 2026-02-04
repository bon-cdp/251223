import type { GridCell, Polygon, Point2D } from '../types';
import { MassingGrid } from './MassingGrid';

export function vectorizeCells(cells: GridCell[], grid: MassingGrid): Polygon {
  if (cells.length === 0) {
    return { points: [] };
  }

  const cellPolygons = cells.map(cell => cellToPolygon(cell, grid));

  if (cellPolygons.length === 1) {
    return cellPolygons[0];
  }

  const unioned = unionPolygonsSync(cellPolygons);

  if (unioned.length === 1) {
    return unioned[0];
  }

  return mergePolygons(unioned);
}

function cellToPolygon(cell: GridCell, grid: MassingGrid): Polygon {
  const bounds = grid.getBounds();
  const cellSize = grid.getCellSize();

  const x = bounds.minX + cell.x * cellSize;
  const y = bounds.minY + cell.y * cellSize;

  return {
    points: [
      { x, y },
      { x: x + cellSize, y },
      { x: x + cellSize, y: y + cellSize },
      { x, y: y + cellSize }
    ]
  };
}

function unionPolygonsSync(polygons: Polygon[]): Polygon[] {
  return polygons;
}

function mergePolygons(polygons: Polygon[]): Polygon {
  if (polygons.length === 0) {
    return { points: [] };
  }

  if (polygons.length === 1) {
    return polygons[0];
  }

  const allPoints: Point2D[] = [];

  for (const polygon of polygons) {
    allPoints.push(...polygon.points);
  }

  const hull = computeConvexHull(allPoints);

  return { points: hull };
}

function computeConvexHull(points: Point2D[]): Point2D[] {
  if (points.length <= 3) {
    return points;
  }

  const sorted = [...points].sort((a, b) => {
    if (a.x !== b.x) {
      return a.x - b.x;
    }
    return a.y - b.y;
  });

  const lower: Point2D[] = [];

  for (const point of sorted) {
    while (lower.length >= 2) {
      const p1 = lower[lower.length - 2];
      const p2 = lower[lower.length - 1];

      if (crossProduct(p1, p2, point) <= 0) {
        lower.pop();
      } else {
        break;
      }
    }

    lower.push(point);
  }

  const upper: Point2D[] = [];

  for (let i = sorted.length - 1; i >= 0; i--) {
    const point = sorted[i];

    while (upper.length >= 2) {
      const p1 = upper[upper.length - 2];
      const p2 = upper[upper.length - 1];

      if (crossProduct(p1, p2, point) <= 0) {
        upper.pop();
      } else {
        break;
      }
    }

    upper.push(point);
  }

  upper.pop();
  lower.pop();

  return [...lower, ...upper];
}

function crossProduct(a: Point2D, b: Point2D, c: Point2D): number {
  return (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
}

function pointToSegmentDistance(point: Point2D, p1: Point2D, p2: Point2D): number {
  const l2 = (p2.x - p1.x) ** 2 + (p2.y - p1.y) ** 2;

  if (l2 === 0) {
    return Math.hypot(point.x - p1.x, point.y - p1.y);
  }

  let t = ((point.x - p1.x) * (p2.x - p1.x) + (point.y - p1.y) * (p2.y - p1.y)) / l2;
  t = Math.max(0, Math.min(1, t));

  const projection = {
    x: p1.x + t * (p2.x - p1.x),
    y: p1.y + t * (p2.y - p1.y)
  };

  return Math.hypot(point.x - projection.x, point.y - projection.y);
}

export function simplifyPolygon(polygon: Polygon, tolerance: number = 1.0): Polygon {
  if (polygon.points.length <= 3) {
    return polygon;
  }

  const douglasPeucker = (points: Point2D[], epsilon: number): Point2D[] => {
    if (points.length <= 2) {
      return points;
    }

    let maxDist = 0;
    let index = 0;

    for (let i = 1; i < points.length - 1; i++) {
      const dist = pointToSegmentDistance(points[i], points[0], points[points.length - 1]);

      if (dist > maxDist) {
        maxDist = dist;
        index = i;
      }
    }

    if (maxDist > epsilon) {
      const left = douglasPeucker(points.slice(0, index + 1), epsilon);
      const right = douglasPeucker(points.slice(index), epsilon);

      return [...left.slice(0, -1), ...right];
    }

    return [points[0], points[points.length - 1]];
  };

  return {
    points: douglasPeucker(polygon.points, tolerance)
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

export function isRectangle(polygon: Polygon, tolerance: number = 1.0): boolean {
  if (polygon.points.length !== 4) {
    return false;
  }

  const points = polygon.points;

  const edge1 = Math.hypot(points[1].x - points[0].x, points[1].y - points[0].y);
  const edge2 = Math.hypot(points[2].x - points[1].x, points[2].y - points[1].y);
  const edge3 = Math.hypot(points[3].x - points[2].x, points[3].y - points[2].y);
  const edge4 = Math.hypot(points[0].x - points[3].x, points[0].y - points[3].y);

  return (
    Math.abs(edge1 - edge3) < tolerance &&
    Math.abs(edge2 - edge4) < tolerance
  );
}

export function centerOfPolygon(polygon: Polygon): Point2D {
  const points = polygon.points;
  let cx = 0;
  let cy = 0;

  for (const point of points) {
    cx += point.x;
    cy += point.y;
  }

  return {
    x: cx / points.length,
    y: cy / points.length
  };
}
