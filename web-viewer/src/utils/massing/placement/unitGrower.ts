import type { GridCell } from '../types';
import { MassingGrid } from '../grid/MassingGrid';
import { vectorizeCells, computePolygonArea } from '../grid/vectorization';

export class UnitGrower {
  private grid: MassingGrid;
  private targetArea: number;
  private areaTolerance: number;

  constructor(grid: MassingGrid, targetArea: number, areaTolerance: number = 0.1) {
    this.grid = grid;
    this.targetArea = targetArea;
    this.areaTolerance = areaTolerance;
  }

  growFromSeed(seedCell: GridCell): GridCell[] {
    const cells: GridCell[] = [seedCell];
    const visited = new Set<string>([`${seedCell.x},${seedCell.y}`]);
    const queue = [seedCell];

    while (queue.length > 0) {
      const current = queue.shift()!;

      const polygon = vectorizeCells(cells, this.grid);
      const area = computePolygonArea(polygon);

      if (area >= this.targetArea * (1 - this.areaTolerance)) {
        break;
      }

      const neighbors = this.getValidNeighbors(current, visited);

      let bestNeighbor: GridCell | null = null;
      let bestScore = -Infinity;

      for (const neighbor of neighbors) {
        const score = this.evaluateNeighbor(neighbor, cells);

        if (score > bestScore) {
          bestScore = score;
          bestNeighbor = neighbor;
        }
      }

      if (bestNeighbor) {
        const key = `${bestNeighbor.x},${bestNeighbor.y}`;
        visited.add(key);
        cells.push(bestNeighbor);
        queue.push(bestNeighbor);
      } else {
        break;
      }
    }

    return this.pruneToArea(cells);
  }

  private getValidNeighbors(cell: GridCell, visited: Set<string>): GridCell[] {
    const neighbors: GridCell[] = [];
    const directions = [
      { dx: 0, dy: -1 },
      { dx: 1, dy: 0 },
      { dx: 0, dy: 1 },
      { dx: -1, dy: 0 }
    ];

    for (const { dx, dy } of directions) {
      const neighbor = this.grid.getCell(cell.x + dx, cell.y + dy);
      const key = `${cell.x + dx},${cell.y + dy}`;

      if (
        neighbor &&
        neighbor.assignedTo === null &&
        !neighbor.isCorridor &&
        !visited.has(key)
      ) {
        neighbors.push(neighbor);
      }
    }

    return neighbors;
  }

  private evaluateNeighbor(neighbor: GridCell, currentCells: GridCell[]): number {
    let score = 0;

    const adjacencyScore = this.computeAdjacency(neighbor, currentCells);
    score += adjacencyScore * 2;

    if (neighbor.isExterior) {
      score += 10;
    }

    const corridorScore = 10 / (neighbor.distanceToCorridor + 1);
    score += corridorScore;

    const exteriorScore = 10 / (neighbor.distanceToExterior + 1);
    score += exteriorScore;

    const compactnessScore = this.computeCompactnessPotential(neighbor, currentCells);
    score += compactnessScore;

    return score;
  }

  private computeAdjacency(neighbor: GridCell, cells: GridCell[]): number {
    let count = 0;
    const directions = [
      { dx: 0, dy: -1 },
      { dx: 1, dy: 0 },
      { dx: 0, dy: 1 },
      { dx: -1, dy: 0 }
    ];

    for (const { dx, dy } of directions) {
      const key = `${neighbor.x + dx},${neighbor.y + dy}`;

      for (const cell of cells) {
        if (`${cell.x},${cell.y}` === key) {
          count++;
          break;
        }
      }
    }

    return count;
  }

  private computeCompactnessPotential(neighbor: GridCell, cells: GridCell[]): number {
    const allCells = [...cells, neighbor];
    const polygon = vectorizeCells(allCells, this.grid);

    const area = computePolygonArea(polygon);
    const perimeter = this.computePerimeter(polygon);

    if (perimeter === 0) {
      return 0;
    }

    const compactness = (4 * Math.PI * area) / (perimeter * perimeter);

    return compactness;
  }

  private computePerimeter(polygon: ReturnType<typeof vectorizeCells>): number {
    const points = polygon.points;
    let perimeter = 0;

    for (let i = 0; i < points.length; i++) {
      const p1 = points[i];
      const p2 = points[(i + 1) % points.length];

      perimeter += Math.hypot(p2.x - p1.x, p2.y - p1.y);
    }

    return perimeter;
  }

  private pruneToArea(cells: GridCell[]): GridCell[] {
    if (cells.length === 0) {
      return cells;
    }

    const sortedByPriority = [...cells].sort((a, b) => {
      const scoreA = this.computeCellScore(a);
      const scoreB = this.computeCellScore(b);

      return scoreB - scoreA;
    });

    for (let i = sortedByPriority.length; i >= 1; i--) {
      const subset = sortedByPriority.slice(0, i);
      const polygon = vectorizeCells(subset, this.grid);
      const area = computePolygonArea(polygon);

      if (area >= this.targetArea * (1 - this.areaTolerance) &&
          area <= this.targetArea * (1 + this.areaTolerance)) {
        return subset;
      }
    }

    return sortedByPriority;
  }

  private computeCellScore(cell: GridCell): number {
    let score = 0;

    if (cell.isExterior) {
      score += 10;
    }

    score += 10 / (cell.distanceToCorridor + 1);

    return score;
  }
}
