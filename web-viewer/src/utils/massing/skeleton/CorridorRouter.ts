import type { Polygon, Point2D, CorridorSegment, SkeletonResult } from '../types';
import { computeStraightSkeleton } from './StraightSkeleton';

export async function computeBalancedCorridors(
  polygon: Polygon,
  corridorWidth: number = 6
): Promise<CorridorSegment[]> {
  const skeleton = await computeStraightSkeleton(polygon, 0.5);

  if (skeleton.nodes.length === 0) {
    return [];
  }

  const mainSpine = findMainSpine(skeleton);

  if (mainSpine.length < 2) {
    return [];
  }

  const segments: CorridorSegment[] = [];

  for (let i = 0; i < mainSpine.length - 1; i++) {
    const start = mainSpine[i];
    const end = mainSpine[i + 1];

    segments.push({
      points: [start, end],
      width: corridorWidth
    });
  }

  return segments;
}

function findMainSpine(skeleton: SkeletonResult): Point2D[] {
  if (skeleton.nodes.length === 0) {
    return [];
  }

  const edgeMap = new Map<string, Point2D[]>();

  for (const edge of skeleton.edges) {
    const startKey = `${edge.start.x.toFixed(1)},${edge.start.y.toFixed(1)}`;
    const endKey = `${edge.end.x.toFixed(1)},${edge.end.y.toFixed(1)}`;

    if (!edgeMap.has(startKey)) {
      edgeMap.set(startKey, []);
    }
    if (!edgeMap.has(endKey)) {
      edgeMap.set(endKey, []);
    }

    edgeMap.get(startKey)!.push(edge.end);
    edgeMap.get(endKey)!.push(edge.start);
  }

  const leaves: Point2D[] = [];

  for (const [key, neighbors] of edgeMap) {
    if (neighbors.length === 1) {
      const [x, y] = key.split(',').map(Number);
      leaves.push({ x, y });
    }
  }

  if (leaves.length === 0) {
    return [skeleton.nodes[0].position];
  }

  let longestPath: Point2D[] = [];
  let maxDistance = 0;

  for (const leaf of leaves) {
    const path = bfsLongestPath(leaf, edgeMap);

    const totalDistance = path.reduce((sum, p, i) => {
      if (i === 0) return 0;
      return sum + distance(path[i - 1], p);
    }, 0);

    if (totalDistance > maxDistance) {
      maxDistance = totalDistance;
      longestPath = path;
    }
  }

  return longestPath;
}

function bfsLongestPath(
  start: Point2D,
  edgeMap: Map<string, Point2D[]>
): Point2D[] {
  const visited = new Set<string>();
  const queue: { point: Point2D; path: Point2D[] }[] = [];

  const startKey = `${start.x.toFixed(1)},${start.y.toFixed(1)}`;
  visited.add(startKey);
  queue.push({ point: start, path: [start] });

  let longestPath: Point2D[] = [start];

  while (queue.length > 0) {
    const { point, path } = queue.shift()!;

    if (path.length > longestPath.length) {
      longestPath = path;
    }

    const key = `${point.x.toFixed(1)},${point.y.toFixed(1)}`;
    const neighbors = edgeMap.get(key) || [];

    for (const neighbor of neighbors) {
      const neighborKey = `${neighbor.x.toFixed(1)},${neighbor.y.toFixed(1)}`;

      if (!visited.has(neighborKey)) {
        visited.add(neighborKey);
        queue.push({
          point: neighbor,
          path: [...path, neighbor]
        });
      }
    }
  }

  return longestPath;
}

function distance(a: Point2D, b: Point2D): number {
  return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);
}
