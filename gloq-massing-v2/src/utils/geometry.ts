/**
 * Geometry utilities for massing generation
 * Handles rectangles, collision detection, and perimeter offset calculations
 */

// ============================================================================
// Core Types
// ============================================================================

export interface Point {
  x: number;
  y: number;
}

export interface Rectangle {
  x: number;      // Center X
  y: number;      // Center Y
  width: number;
  height: number;
}

export interface Bounds {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

// ============================================================================
// Rectangle Operations
// ============================================================================

/**
 * Create a rectangle from center and dimensions
 */
export function createRect(x: number, y: number, width: number, height: number): Rectangle {
  return { x, y, width, height };
}

/**
 * Create a rectangle from bounds (min/max coordinates)
 */
export function rectFromBounds(bounds: Bounds): Rectangle {
  const width = bounds.maxX - bounds.minX;
  const height = bounds.maxY - bounds.minY;
  return {
    x: bounds.minX + width / 2,
    y: bounds.minY + height / 2,
    width,
    height,
  };
}

/**
 * Get the bounds of a rectangle
 */
export function getBounds(rect: Rectangle): Bounds {
  const halfW = rect.width / 2;
  const halfH = rect.height / 2;
  return {
    minX: rect.x - halfW,
    maxX: rect.x + halfW,
    minY: rect.y - halfH,
    maxY: rect.y + halfH,
  };
}

/**
 * Get the four corners of a rectangle
 */
export function getCorners(rect: Rectangle): Point[] {
  const bounds = getBounds(rect);
  return [
    { x: bounds.minX, y: bounds.minY }, // Top-left
    { x: bounds.maxX, y: bounds.minY }, // Top-right
    { x: bounds.maxX, y: bounds.maxY }, // Bottom-right
    { x: bounds.minX, y: bounds.maxY }, // Bottom-left
  ];
}

/**
 * Calculate the area of a rectangle
 */
export function rectArea(rect: Rectangle): number {
  return rect.width * rect.height;
}

/**
 * Check if a point is inside a rectangle
 */
export function pointInRect(point: Point, rect: Rectangle): boolean {
  const bounds = getBounds(rect);
  return (
    point.x >= bounds.minX &&
    point.x <= bounds.maxX &&
    point.y >= bounds.minY &&
    point.y <= bounds.maxY
  );
}

// ============================================================================
// Collision Detection
// ============================================================================

/**
 * Check if two rectangles overlap (AABB collision)
 */
export function rectsOverlap(a: Rectangle, b: Rectangle): boolean {
  const boundsA = getBounds(a);
  const boundsB = getBounds(b);

  return !(
    boundsA.maxX <= boundsB.minX ||
    boundsA.minX >= boundsB.maxX ||
    boundsA.maxY <= boundsB.minY ||
    boundsA.minY >= boundsB.maxY
  );
}

/**
 * Check if rectangle A contains rectangle B entirely
 */
export function rectContains(outer: Rectangle, inner: Rectangle): boolean {
  const outerBounds = getBounds(outer);
  const innerBounds = getBounds(inner);

  return (
    innerBounds.minX >= outerBounds.minX &&
    innerBounds.maxX <= outerBounds.maxX &&
    innerBounds.minY >= outerBounds.minY &&
    innerBounds.maxY <= outerBounds.maxY
  );
}

/**
 * Check if any rectangle in a list overlaps with a given rectangle
 */
export function hasOverlap(rect: Rectangle, others: Rectangle[]): boolean {
  return others.some(other => rectsOverlap(rect, other));
}

/**
 * Validate that no rectangles in a list overlap each other
 */
export function validateNoOverlaps(rects: Rectangle[]): { valid: boolean; conflicts: [number, number][] } {
  const conflicts: [number, number][] = [];

  for (let i = 0; i < rects.length; i++) {
    for (let j = i + 1; j < rects.length; j++) {
      if (rectsOverlap(rects[i], rects[j])) {
        conflicts.push([i, j]);
      }
    }
  }

  return { valid: conflicts.length === 0, conflicts };
}

// ============================================================================
// Perimeter Offset Operations
// ============================================================================

/**
 * Inset a rectangle by a given amount on all sides
 * Returns null if the inset would result in a zero or negative area
 */
export function insetRect(rect: Rectangle, inset: number): Rectangle | null {
  const newWidth = rect.width - 2 * inset;
  const newHeight = rect.height - 2 * inset;

  if (newWidth <= 0 || newHeight <= 0) {
    return null;
  }

  return {
    x: rect.x,
    y: rect.y,
    width: newWidth,
    height: newHeight,
  };
}

/**
 * Create a perimeter band (the area between outer and inner rectangles)
 */
export interface PerimeterBand {
  outer: Rectangle;
  inner: Rectangle;
  depth: number;
  north: Rectangle;  // Top band
  south: Rectangle;  // Bottom band
  east: Rectangle;   // Right band
  west: Rectangle;   // Left band
}

export function createPerimeterBand(outer: Rectangle, depth: number): PerimeterBand | null {
  const inner = insetRect(outer, depth);
  if (!inner) return null;

  const outerBounds = getBounds(outer);

  // North band (top)
  const north: Rectangle = {
    x: outer.x,
    y: outerBounds.minY + depth / 2,
    width: outer.width,
    height: depth,
  };

  // South band (bottom)
  const south: Rectangle = {
    x: outer.x,
    y: outerBounds.maxY - depth / 2,
    width: outer.width,
    height: depth,
  };

  // West band (left) - excluding corners already in north/south
  const west: Rectangle = {
    x: outerBounds.minX + depth / 2,
    y: outer.y,
    width: depth,
    height: inner.height,
  };

  // East band (right) - excluding corners already in north/south
  const east: Rectangle = {
    x: outerBounds.maxX - depth / 2,
    y: outer.y,
    width: depth,
    height: inner.height,
  };

  return { outer, inner, depth, north, south, east, west };
}

// ============================================================================
// Unit Placement Along Edge
// ============================================================================

export type EdgeSide = 'north' | 'south' | 'east' | 'west';

export interface PlacedUnit {
  id: string;
  type: string;
  rect: Rectangle;
  side: EdgeSide;
}

/**
 * Place units along an edge of the perimeter
 * Uses greedy bin-packing: places units in order until edge is full
 */
export function placeUnitsAlongEdge(
  edgeBand: Rectangle,
  side: EdgeSide,
  units: Array<{ type: string; width: number; depth: number; remaining: number }>,
  gap: number = 0
): { placed: PlacedUnit[]; unitsUsed: Map<string, number> } {
  const placed: PlacedUnit[] = [];
  const unitsUsed = new Map<string, number>();

  const isHorizontal = side === 'north' || side === 'south';
  const edgeBounds = getBounds(edgeBand);

  let position = isHorizontal ? edgeBounds.minX : edgeBounds.minY;
  const endPosition = isHorizontal ? edgeBounds.maxX : edgeBounds.maxY;

  let unitIndex = 0;

  while (position < endPosition && unitIndex < units.length) {
    const unit = units[unitIndex];

    if (unit.remaining <= 0) {
      unitIndex++;
      continue;
    }

    const unitWidth = isHorizontal ? unit.width : unit.depth;
    const unitDepth = isHorizontal ? unit.depth : unit.width;

    // Check if unit fits
    if (position + unitWidth > endPosition) {
      // Try next unit type (might be smaller)
      unitIndex++;
      continue;
    }

    // Place the unit
    const unitX = isHorizontal
      ? position + unitWidth / 2
      : edgeBand.x;
    const unitY = isHorizontal
      ? edgeBand.y
      : position + unitWidth / 2;

    const unitRect: Rectangle = {
      x: unitX,
      y: unitY,
      width: isHorizontal ? unitWidth : unitDepth,
      height: isHorizontal ? unitDepth : unitWidth,
    };

    placed.push({
      id: `${unit.type}_${Date.now()}_${placed.length}`,
      type: unit.type,
      rect: unitRect,
      side,
    });

    unit.remaining--;
    unitsUsed.set(unit.type, (unitsUsed.get(unit.type) || 0) + 1);
    position += unitWidth + gap;
  }

  return { placed, unitsUsed };
}

// ============================================================================
// Corridor Placement
// ============================================================================

export interface Corridor {
  rect: Rectangle;
  orientation: 'horizontal' | 'vertical';
}

/**
 * Place a corridor through the center of a floor plate
 * Corridor runs along the long axis
 */
export function placeCorridor(
  floorPlate: Rectangle,
  corridorWidth: number,
  unitDepth: number
): Corridor {
  const isHorizontal = floorPlate.width >= floorPlate.height;

  if (isHorizontal) {
    // Corridor runs east-west through center
    return {
      rect: {
        x: floorPlate.x,
        y: floorPlate.y,
        width: floorPlate.width - 2 * unitDepth,  // Stop at unit bands
        height: corridorWidth,
      },
      orientation: 'horizontal',
    };
  } else {
    // Corridor runs north-south through center
    return {
      rect: {
        x: floorPlate.x,
        y: floorPlate.y,
        width: corridorWidth,
        height: floorPlate.height - 2 * unitDepth,  // Stop at unit bands
      },
      orientation: 'vertical',
    };
  }
}

// ============================================================================
// Core Placement
// ============================================================================

export interface Core {
  elevators: Rectangle[];
  stairs: Rectangle[];
  totalRect: Rectangle;
}

/**
 * Calculate core size based on unit count
 */
export function calculateCoreSize(totalUnits: number): { elevators: number; stairs: number; width: number; height: number } {
  if (totalUnits < 100) {
    return { elevators: 2, stairs: 1, width: 24, height: 30 };
  } else if (totalUnits < 250) {
    return { elevators: 4, stairs: 2, width: 32, height: 36 };
  } else {
    return { elevators: 6, stairs: 3, width: 40, height: 42 };
  }
}

/**
 * Place core (elevators + stairs) at one end of the corridor
 */
export function placeCore(
  corridor: Corridor,
  totalUnits: number,
  position: 'start' | 'center' | 'end' = 'center'
): Core {
  const coreSize = calculateCoreSize(totalUnits);
  const corridorBounds = getBounds(corridor.rect);

  let coreX: number;
  let coreY: number;

  if (corridor.orientation === 'horizontal') {
    coreY = corridor.rect.y;
    if (position === 'start') {
      coreX = corridorBounds.minX + coreSize.width / 2;
    } else if (position === 'end') {
      coreX = corridorBounds.maxX - coreSize.width / 2;
    } else {
      coreX = corridor.rect.x;
    }
  } else {
    coreX = corridor.rect.x;
    if (position === 'start') {
      coreY = corridorBounds.minY + coreSize.height / 2;
    } else if (position === 'end') {
      coreY = corridorBounds.maxY - coreSize.height / 2;
    } else {
      coreY = corridor.rect.y;
    }
  }

  const totalRect: Rectangle = {
    x: coreX,
    y: coreY,
    width: coreSize.width,
    height: coreSize.height,
  };

  // Place individual elevators and stairs within the core
  const elevatorSize = 8;  // 8x8 elevator
  const stairSize = { width: 10, height: 18 };

  const elevators: Rectangle[] = [];
  const stairs: Rectangle[] = [];

  // Simple layout: elevators on left, stairs on right
  const elevatorStartX = coreX - coreSize.width / 2 + elevatorSize;
  for (let i = 0; i < coreSize.elevators; i++) {
    elevators.push({
      x: elevatorStartX + i * (elevatorSize + 2),
      y: coreY,
      width: elevatorSize,
      height: elevatorSize,
    });
  }

  const stairStartX = coreX + coreSize.width / 2 - stairSize.width - 2;
  for (let i = 0; i < coreSize.stairs; i++) {
    stairs.push({
      x: stairStartX - i * (stairSize.width + 4),
      y: coreY,
      width: stairSize.width,
      height: stairSize.height,
    });
  }

  return { elevators, stairs, totalRect };
}

// ============================================================================
// Floor Plate Calculation
// ============================================================================

/**
 * Calculate floor plate dimensions from area and aspect ratio
 */
export function calculateFloorPlate(area: number, aspectRatio: number = 1.4): Rectangle {
  // width / height = aspectRatio
  // width * height = area
  // height = width / aspectRatio
  // width * (width / aspectRatio) = area
  // width^2 = area * aspectRatio
  // width = sqrt(area * aspectRatio)

  const width = Math.sqrt(area * aspectRatio);
  const height = area / width;

  return {
    x: 0,  // Centered at origin
    y: 0,
    width,
    height,
  };
}
