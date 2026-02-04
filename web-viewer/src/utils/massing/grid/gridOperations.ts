import type { GridCell, Point2D } from '../types';

export function findConnectedCells(
  startCell: GridCell,
  targetCellCount: number,
  getNeighbors: (cell: GridCell) => GridCell[]
): GridCell[] {
  const result: GridCell[] = [startCell];
  const visited = new Set<string>([`${startCell.x},${startCell.y}`]);
  const queue = [startCell];

  while (queue.length > 0 && result.length < targetCellCount) {
    const current = queue.shift()!;

    const neighbors = getNeighbors(current);

    for (const neighbor of neighbors) {
      const key = `${neighbor.x},${neighbor.y}`;

      if (!visited.has(key) && neighbor.assignedTo === null && !neighbor.isCorridor) {
        visited.add(key);
        result.push(neighbor);
        queue.push(neighbor);

        if (result.length >= targetCellCount) {
          break;
        }
      }
    }
  }

  return result;
}

export function sortCellsByPriority(cells: GridCell[]): GridCell[] {
  return [...cells].sort((a, b) => {
    const priorityA = computePriority(a);
    const priorityB = computePriority(b);

    return priorityB - priorityA;
  });
}

function computePriority(cell: GridCell): number {
  const exteriorWeight = 10;
  const corridorWeight = 5;

  let score = 0;

  if (cell.isExterior) {
    score += exteriorWeight;
  }

  if (cell.distanceToCorridor < Infinity) {
    score += corridorWeight / (cell.distanceToCorridor + 1);
  }

  return score;
}

export function findOptimalSeedCells(
  cells: GridCell[],
  seedCount: number,
  minDistance: number = 10
): GridCell[] {
  const sorted = sortCellsByPriority(cells);
  const seeds: GridCell[] = [];

  for (const cell of sorted) {
    if (seeds.length >= seedCount) {
      break;
    }

    let isValid = true;

    for (const seed of seeds) {
      const dist = distance(cellToPoint(cell), cellToPoint(seed));
      if (dist < minDistance) {
        isValid = false;
        break;
      }
    }

    if (isValid) {
      seeds.push(cell);
    }
  }

  return seeds;
}

export function computeCoverage(cells: GridCell[], unitCells: GridCell[][]): number {
  const totalCells = cells.length;
  const usedCells = new Set<string>();

  for (const unitCellList of unitCells) {
    for (const cell of unitCellList) {
      usedCells.add(`${cell.x},${cell.y}`);
    }
  }

  return (usedCells.size / totalCells) * 100;
}

export function computeExteriorAccessScore(cells: GridCell[]): number {
  const exteriorCells = cells.filter(c => c.isExterior);

  if (exteriorCells.length === 0) {
    return 0;
  }

  return (exteriorCells.length / cells.length) * 100;
}

export function validatePlacement(
  cells: GridCell[],
  hasExteriorAccess: boolean,
  maxCorridorDistance: number = 30
): boolean {
  if (cells.length === 0) {
    return false;
  }

  const hasCorridorAccess = cells.some(c => c.distanceToCorridor < Infinity);

  if (!hasCorridorAccess) {
    return false;
  }

  const avgCorridorDistance = cells.reduce((sum, c) => sum + c.distanceToCorridor, 0) / cells.length;

  if (avgCorridorDistance > maxCorridorDistance) {
    return false;
  }

  if (hasExteriorAccess && !cells.some(c => c.isExterior)) {
    return false;
  }

  return true;
}

export function clusterCells(cells: GridCell[], maxDistance: number = 5): GridCell[][] {
  if (cells.length === 0) {
    return [];
  }

  const clusters: GridCell[][] = [];
  const visited = new Set<string>();

  for (const cell of cells) {
    const key = `${cell.x},${cell.y}`;

    if (visited.has(key)) {
      continue;
    }

    const cluster: GridCell[] = [];
    const queue = [cell];
    visited.add(key);

    while (queue.length > 0) {
      const current = queue.shift()!;
      cluster.push(current);

      for (const other of cells) {
        const otherKey = `${other.x},${other.y}`;

        if (!visited.has(otherKey)) {
          const dist = Math.abs(current.x - other.x) + Math.abs(current.y - other.y);

          if (dist <= maxDistance) {
            visited.add(otherKey);
            queue.push(other);
          }
        }
      }
    }

    clusters.push(cluster);
  }

  return clusters;
}

function distance(a: Point2D, b: Point2D): number {
  return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);
}

function cellToPoint(cell: GridCell): Point2D {
  return { x: cell.x, y: cell.y };
}
