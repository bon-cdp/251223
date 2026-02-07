import { ShapeGenerator, createRectangle } from './ShapeGenerator';
import type { MassingShape, ShapeDimensions, Polygon } from '../types';

export class HShape extends ShapeGenerator {
  generate(dimensions: ShapeDimensions): MassingShape {
    const dims = this.normalizeDimensions(dimensions);

    const armWidth = dims.armWidth ?? dims.width * 0.2;
    const armDepth = dims.armDepth ?? dims.height * 0.4;

    const leftArm = createRectangle(armWidth, dims.height, -dims.width / 2 + armWidth / 2, 0);
    const rightArm = createRectangle(armWidth, dims.height, dims.width / 2 - armWidth / 2, 0);
    const centerBar = createRectangle(dims.width - 2 * armWidth, armDepth, 0, 0);

    const outline = this.mergePolygons([leftArm, rightArm, centerBar]);

    return {
      type: 'h-shape',
      outline,
      interior: undefined
    };
  }

  private mergePolygons(polygons: Polygon[]): Polygon {
    if (polygons.length === 0) {
      return { points: [] };
    }

    if (polygons.length === 1) {
      return polygons[0];
    }

    const allPoints: { x: number; y: number }[] = [];

    for (const polygon of polygons) {
      allPoints.push(...polygon.points);
    }

    const hull = this.computeConvexHull(allPoints);

    return { points: hull };
  }

  private computeConvexHull(points: { x: number; y: number }[]): { x: number; y: number }[] {
    if (points.length <= 3) {
      return points;
    }

    const sorted = [...points].sort((a, b) => {
      if (a.x !== b.x) {
        return a.x - b.x;
      }
      return a.y - b.y;
    });

    const lower: { x: number; y: number }[] = [];

    for (const point of sorted) {
      while (lower.length >= 2) {
        const p1 = lower[lower.length - 2];
        const p2 = lower[lower.length - 1];

        if (this.crossProduct(p1, p2, point) <= 0) {
          lower.pop();
        } else {
          break;
        }
      }

      lower.push(point);
    }

    const upper: { x: number; y: number }[] = [];

    for (let i = sorted.length - 1; i >= 0; i--) {
      const point = sorted[i];

      while (upper.length >= 2) {
        const p1 = upper[upper.length - 2];
        const p2 = upper[upper.length - 1];

        if (this.crossProduct(p1, p2, point) <= 0) {
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

  private crossProduct(
    a: { x: number; y: number },
    b: { x: number; y: number },
    c: { x: number; y: number }
  ): number {
    return (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
  }
}
