import type { GridCell, Point2D } from '../types';
import { MassingGrid } from '../grid/MassingGrid';

export interface VoronoiRegion {
  seedCell: GridCell;
  cells: GridCell[];
  centroid: Point2D;
}

export class VoronPartitioner {
  private grid: MassingGrid;

  constructor(grid: MassingGrid) {
    this.grid = grid;
  }

  partition(seedCells: GridCell[]): VoronoiRegion[] {
    const regions: VoronoiRegion[] = seedCells.map(seed => ({
      seedCell: seed,
      cells: [seed],
      centroid: this.cellToPoint(seed)
    }));

    const allCells = this.grid.getCells().filter(
      cell => cell.assignedTo === null && !cell.isCorridor
    );

    const unassigned = new Set(
      allCells.map(c => `${c.x},${c.y}`)
        .filter(key => !seedCells.some(s => `${s.x},${s.y}` === key))
    );

    let changed = true;

    while (changed && unassigned.size > 0) {
      changed = false;

      const toAssign: { cell: GridCell; regionIndex: number }[] = [];

      for (const key of unassigned) {
        const [x, y] = key.split(',').map(Number);
        const cell = this.grid.getCell(x, y);

        if (!cell) {
          continue;
        }

        const nearestRegion = this.findNearestRegion(cell, regions);

        if (nearestRegion !== null) {
          toAssign.push({ cell, regionIndex: nearestRegion });
        }
      }

      for (const { cell, regionIndex } of toAssign) {
        const key = `${cell.x},${cell.y}`;

        if (unassigned.has(key)) {
          unassigned.delete(key);
          regions[regionIndex].cells.push(cell);
          changed = true;
        }
      }
    }

    for (const region of regions) {
      region.centroid = this.computeRegionCentroid(region);
    }

    return regions;
  }

  private findNearestRegion(cell: GridCell, regions: VoronoiRegion[]): number | null {
    const cellPoint = this.cellToPoint(cell);
    let minDistance = Infinity;
    let nearestIndex: number | null = null;

    for (let i = 0; i < regions.length; i++) {
      const region = regions[i];
      const dist = this.distance(cellPoint, region.centroid);

      if (dist < minDistance) {
        minDistance = dist;
        nearestIndex = i;
      }
    }

    return nearestIndex;
  }

  private computeRegionCentroid(region: VoronoiRegion): Point2D {
    let sumX = 0;
    let sumY = 0;

    for (const cell of region.cells) {
      const point = this.cellToPoint(cell);
      sumX += point.x;
      sumY += point.y;
    }

    return {
      x: sumX / region.cells.length,
      y: sumY / region.cells.length
    };
  }

  private distance(a: Point2D, b: Point2D): number {
    return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);
  }

  private cellToPoint(cell: GridCell): Point2D {
    const bounds = this.grid.getBounds();
    const cellSize = this.grid.getCellSize();

    return {
      x: bounds.minX + cell.x * cellSize + cellSize / 2,
      y: bounds.minY + cell.y * cellSize + cellSize / 2
    };
  }

  balancedPartition(targetAreas: number[]): VoronoiRegion[] {
    const allCells = this.grid.getCells().filter(
      cell => cell.assignedTo === null && !cell.isCorridor
    );

    const sortedByPriority = [...allCells].sort((a, b) => {
      const scoreA = this.computePriority(a);
      const scoreB = this.computePriority(b);

      return scoreB - scoreA;
    });

    const regions: VoronoiRegion[] = [];
    const regionCellCounts = targetAreas.map(area => Math.ceil(area / 4));

    const regionSeeds: GridCell[] = [];

    for (let i = 0; i < regionCellCounts.length; i++) {
      let bestCell: GridCell | null = null;
      let bestScore = -Infinity;

      for (const cell of sortedByPriority) {
        if (regionSeeds.some(s => s.x === cell.x && s.y === cell.y)) {
          continue;
        }

        const minDistance = this.computeMinDistanceToSeeds(cell, regionSeeds);

        const score = this.computePriority(cell) + minDistance;

        if (score > bestScore) {
          bestScore = score;
          bestCell = cell;
        }
      }

      if (bestCell) {
        regionSeeds.push(bestCell);
      }
    }

    const initialRegions = this.partition(regionSeeds);

    for (let i = 0; i < initialRegions.length; i++) {
      regions.push({
        seedCell: initialRegions[i].seedCell,
        cells: [],
        centroid: initialRegions[i].centroid
      });
    }

    const regionQueues = initialRegions.map(r => [...r.cells]);

    for (let i = 0; i < regions.length; i++) {
      const region = regions[i];
      const targetCount = regionCellCounts[i];
      const queue = regionQueues[i];

      while (region.cells.length < targetCount && queue.length > 0) {
        const cell = queue.shift()!;
        region.cells.push(cell);
      }

      if (region.cells.length === 0 && queue.length > 0) {
        region.cells.push(queue.shift()!);
      }
    }

    return regions;
  }

  private computePriority(cell: GridCell): number {
    let score = 0;

    if (cell.isExterior) {
      score += 10;
    }

    score += 10 / (cell.distanceToCorridor + 1);

    return score;
  }

  private computeMinDistanceToSeeds(cell: GridCell, seeds: GridCell[]): number {
    if (seeds.length === 0) {
      return 0;
    }

    let minDistance = Infinity;
    const cellPoint = this.cellToPoint(cell);

    for (const seed of seeds) {
      const seedPoint = this.cellToPoint(seed);
      const dist = this.distance(cellPoint, seedPoint);

      minDistance = Math.min(minDistance, dist);
    }

    return minDistance;
  }
}
