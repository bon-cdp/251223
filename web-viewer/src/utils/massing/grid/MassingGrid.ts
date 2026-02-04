import type { Polygon, GridCell, GridBounds, Point2D } from '../types';
import { computeBalancedCorridors } from '../skeleton/CorridorRouter';

export class MassingGrid {
  private cells: Map<string, GridCell>;
  private bounds: GridBounds;
  private cellSize: number;

  constructor(bounds: GridBounds, cellSize: number = 2) {
    this.bounds = bounds;
    this.cellSize = cellSize;
    this.cells = new Map();
  }

  static fromPolygon(polygon: Polygon, cellSize: number = 2): MassingGrid {
    const bounds = computeBounds(polygon);
    const grid = new MassingGrid(bounds, cellSize);

    grid.initializeCells(polygon);

    return grid;
  }

  private initializeCells(polygon: Polygon): void {
    const { minX, minY, maxX, maxY } = this.bounds;

    const cellWidth = maxX - minX;
    const cellHeight = maxY - minY;

    const cols = Math.ceil(cellWidth / this.cellSize);
    const rows = Math.ceil(cellHeight / this.cellSize);

    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        const x = minX + col * this.cellSize;
        const y = minY + row * this.cellSize;

        const cellCenter: Point2D = {
          x: x + this.cellSize / 2,
          y: y + this.cellSize / 2
        };

        const isInside = this.pointInPolygon(cellCenter, polygon);

        if (isInside) {
          const cell: GridCell = {
            x: col,
            y: row,
            assignedTo: null,
            isCorridor: false,
            isExterior: this.isExteriorCell(col, row, polygon),
            distanceToCorridor: Infinity,
            distanceToExterior: this.computeDistanceToExterior(col, row, polygon)
          };

          this.cells.set(`${col},${row}`, cell);
        }
      }
    }
  }

  private pointInPolygon(point: Point2D, polygon: Polygon): boolean {
    const points = polygon.points;
    let inside = false;

    for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
      const xi = points[i].x;
      const yi = points[i].y;
      const xj = points[j].x;
      const yj = points[j].y;

      const intersect = ((yi > point.y) !== (yj > point.y)) &&
        (point.x < (xj - xi) * (point.y - yi) / (yj - yi) + xi);

      if (intersect) {
        inside = !inside;
      }
    }

    return inside;
  }

  private isExteriorCell(col: number, row: number, polygon: Polygon): boolean {
    const x = this.bounds.minX + col * this.cellSize;
    const y = this.bounds.minY + row * this.cellSize;

    const neighbors = [
      { x: x - this.cellSize, y: y + this.cellSize / 2 },
      { x: x + this.cellSize, y: y + this.cellSize / 2 },
      { x: x + this.cellSize / 2, y: y - this.cellSize },
      { x: x + this.cellSize / 2, y: y + this.cellSize }
    ];

    for (const neighbor of neighbors) {
      if (!this.pointInPolygon(neighbor, polygon)) {
        return true;
      }
    }

    return false;
  }

  private computeDistanceToExterior(col: number, row: number, polygon: Polygon): number {
    const x = this.bounds.minX + col * this.cellSize;
    const y = this.bounds.minY + row * this.cellSize;

    const cellCenter = { x: x + this.cellSize / 2, y: y + this.cellSize / 2 };

    const points = polygon.points;
    let minDistance = Infinity;

    for (let i = 0; i < points.length; i++) {
      const p1 = points[i];
      const p2 = points[(i + 1) % points.length];

      const dist = this.pointToSegmentDistance(cellCenter, p1, p2);
      minDistance = Math.min(minDistance, dist);
    }

    return minDistance;
  }

  private pointToSegmentDistance(point: Point2D, p1: Point2D, p2: Point2D): number {
    const l2 = (p2.x - p1.x) ** 2 + (p2.y - p1.y) ** 2;

    if (l2 === 0) {
      return Math.sqrt((point.x - p1.x) ** 2 + (point.y - p1.y) ** 2);
    }

    let t = ((point.x - p1.x) * (p2.x - p1.x) + (point.y - p1.y) * (p2.y - p1.y)) / l2;
    t = Math.max(0, Math.min(1, t));

    const projection = {
      x: p1.x + t * (p2.x - p1.x),
      y: p1.y + t * (p2.y - p1.y)
    };

    return Math.sqrt((point.x - projection.x) ** 2 + (point.y - projection.y) ** 2);
  }

  getCell(col: number, row: number): GridCell | undefined {
    return this.cells.get(`${col},${row}`);
  }

  getCells(): GridCell[] {
    return Array.from(this.cells.values());
  }

  getAvailableCells(): GridCell[] {
    return this.getCells().filter(cell => cell.assignedTo === null);
  }

  assignCell(col: number, row: number, spaceId: string): void {
    const cell = this.getCell(col, row);
    if (cell) {
      cell.assignedTo = spaceId;
    }
  }

  markCorridor(col: number, row: number): void {
    const cell = this.getCell(col, row);
    if (cell) {
      cell.isCorridor = true;
      cell.distanceToCorridor = 0;
    }
  }

  getBounds(): GridBounds {
    return this.bounds;
  }

  getCellSize(): number {
    return this.cellSize;
  }

  async setupCorridors(polygon: Polygon, corridorWidth: number = 6): Promise<void> {
    const corridors = await computeBalancedCorridors(polygon, corridorWidth);

    for (const corridor of corridors) {
      this.markCorridorCells(corridor);
    }

    this.updateCorridorDistances();
  }

  private markCorridorCells(corridor: { points: Point2D[]; width: number }): void {
    const halfWidth = corridor.width / 2;

    for (const cell of this.getCells()) {
      const cellCenter = this.cellCenter(cell.x, cell.y);

      let minDistance = Infinity;

      for (let i = 0; i < corridor.points.length - 1; i++) {
        const p1 = corridor.points[i];
        const p2 = corridor.points[i + 1];

        const dist = this.pointToSegmentDistance(cellCenter, p1, p2);
        minDistance = Math.min(minDistance, dist);
      }

      if (minDistance <= halfWidth + this.cellSize) {
        this.markCorridor(cell.x, cell.y);
      }
    }
  }

  private updateCorridorDistances(): void {
    const corridorCells = this.getCells().filter(c => c.isCorridor);
    const queue = [...corridorCells];
    const visited = new Set(queue.map(c => `${c.x},${c.y}`));

    while (queue.length > 0) {
      const current = queue.shift()!;

      const neighbors = this.getNeighbors(current.x, current.y);

      for (const neighbor of neighbors) {
        if (!visited.has(`${neighbor.x},${neighbor.y}`)) {
          neighbor.distanceToCorridor = current.distanceToCorridor + this.cellSize;
          visited.add(`${neighbor.x},${neighbor.y}`);
          queue.push(neighbor);
        }
      }
    }
  }

  private getNeighbors(col: number, row: number): GridCell[] {
    const directions = [
      { dx: 0, dy: -1 },
      { dx: 1, dy: 0 },
      { dx: 0, dy: 1 },
      { dx: -1, dy: 0 }
    ];

    const neighbors: GridCell[] = [];

    for (const { dx, dy } of directions) {
      const neighbor = this.getCell(col + dx, row + dy);
      if (neighbor && neighbor.assignedTo === null) {
        neighbors.push(neighbor);
      }
    }

    return neighbors;
  }

  private cellCenter(col: number, row: number): Point2D {
    const x = this.bounds.minX + col * this.cellSize;
    const y = this.bounds.minY + row * this.cellSize;

    return {
      x: x + this.cellSize / 2,
      y: y + this.cellSize / 2
    };
  }
}

function computeBounds(polygon: Polygon): GridBounds {
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
