export type BuildingShape = 'rectangle' | 'courtyard' | 'donut' | 'h-shape' | 't-shape';

export interface Point2D {
  x: number;
  y: number;
}

export interface Polygon {
  points: Point2D[];
}

export interface SetbackConfig {
  front: number;
  rear: number;
  side: number;
}

export interface ShapeDimensions {
  width: number;
  height: number;
  courtyardWidth?: number;
  courtyardDepth?: number;
  armWidth?: number;
  armDepth?: number;
}

export interface MassingShape {
  type: BuildingShape;
  outline: Polygon;
  interior?: Polygon[];
}

export interface GridCell {
  x: number;
  y: number;
  assignedTo: string | null;
  isCorridor: boolean;
  isExterior: boolean;
  distanceToCorridor: number;
  distanceToExterior: number;
}

export interface GridBounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

export interface CorridorSegment {
  points: Point2D[];
  width: number;
}

export interface SkeletonNode {
  position: Point2D;
  edges: Point2D[];
  distance: number;
}

export interface SkeletonEdge {
  start: Point2D;
  end: Point2D;
  length: number;
}

export interface SkeletonResult {
  nodes: SkeletonNode[];
  edges: SkeletonEdge[];
}

export interface UnitPlacement {
  spaceId: string;
  cells: GridCell[];
  polygon: Polygon;
  area: number;
  targetArea: number;
  hasExteriorAccess: boolean;
  corridorDistance: number;
}

export interface GridPlacementResult {
  units: UnitPlacement[];
  corridorCells: GridCell[];
  coverage: number;
  exteriorAccessScore: number;
}

export interface MassingConfig {
  shape: BuildingShape;
  dimensions: ShapeDimensions;
  setback: SetbackConfig;
  gridSize: number;
  corridorWidth: number;
  minUnitArea: number;
  maxUnitArea: number;
}
