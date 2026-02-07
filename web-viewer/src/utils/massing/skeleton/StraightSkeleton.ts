import { offsetPolygon } from '../clipper';
import type { Polygon, Point2D, SkeletonResult, SkeletonNode, SkeletonEdge } from '../types';

export async function computeStraightSkeleton(
  polygon: Polygon,
  stepSize: number = 0.5
): Promise<SkeletonResult> {
  const nodes: SkeletonNode[] = [];
  const edges: SkeletonEdge[] = [];
  const visitedCentroids = new Set<string>();

  let currentPolygons: Polygon[] = [polygon];
  let offset = 0;

  while (currentPolygons.length > 0) {
    const newPolygons: Polygon[] = [];

    for (const poly of currentPolygons) {
      const centroid = computePolygonCentroid(poly);
      const key = `${centroid.x.toFixed(2)},${centroid.y.toFixed(2)}`;

      if (!visitedCentroids.has(key)) {
        visitedCentroids.add(key);
        nodes.push({
          position: centroid,
          edges: poly.points,
          distance: offset
        });
      }

      const area = computePolygonArea(poly);
      if (area > stepSize * 2) {
        newPolygons.push(poly);
      }
    }

    if (newPolygons.length === 0) break;

    offset += stepSize;
    const nextPolygons: Polygon[] = [];

    for (const poly of newPolygons) {
      const offsetResults = await offsetPolygon(poly, -stepSize);

      for (const offsetPoly of offsetResults) {
        if (computePolygonArea(offsetPoly) > 1) {
          nextPolygons.push(offsetPoly);
        }
      }
    }

    currentPolygons = nextPolygons;
  }

  for (let i = 0; i < nodes.length - 1; i++) {
    const nodeA = nodes[i];
    const nodeB = nodes[i + 1];

    const dist = distance(nodeA.position, nodeB.position);
    if (dist < stepSize * 3) {
      edges.push({
        start: nodeA.position,
        end: nodeB.position,
        length: dist
      });
    }
  }

  return { nodes, edges };
}

function computePolygonCentroid(polygon: Polygon): Point2D {
  const points = polygon.points;
  let cx = 0;
  let cy = 0;
  let area = 0;

  for (let i = 0; i < points.length; i++) {
    const x0 = points[i].x;
    const y0 = points[i].y;
    const x1 = points[(i + 1) % points.length].x;
    const y1 = points[(i + 1) % points.length].y;

    const a = x0 * y1 - x1 * y0;
    cx += (x0 + x1) * a;
    cy += (y0 + y1) * a;
    area += a;
  }

  area *= 3;

  return {
    x: cx / area,
    y: cy / area
  };
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

function distance(a: Point2D, b: Point2D): number {
  return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);
}
