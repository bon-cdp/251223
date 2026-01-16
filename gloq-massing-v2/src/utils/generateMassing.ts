/**
 * Massing generator - places units using radial outer-to-inner placement
 * Handles both square and strip floor plates using aspect-ratio normalization
 */

import type { BuildingConfig, PlacedSpace, GeneratedFloor, MassingResult } from '../types/building';

const CORRIDOR_WIDTH = 8; // feet
const CORE_SIZE = 30; // feet - elevator/stair core
const MARGIN = 4; // feet - edge margin
const GAP = 1.5; // feet - between units

interface UnitToPlace {
  type: 'STUDIO' | 'ONE_BED' | 'TWO_BED' | 'THREE_BED';
  width: number;
  depth: number;
  area: number;
  remaining: number;
}

/**
 * Calculate floor plate dimensions from lot size
 * Can be overridden to handle different aspect ratios
 */
function getFloorPlateDimensions(lotSize: number, aspectRatio: number = 1): { width: number; height: number } {
  const area = lotSize;
  // width * height = area, width / height = aspectRatio
  // width = sqrt(area * aspectRatio)
  const width = Math.sqrt(area * aspectRatio);
  const height = area / width;
  return { width, height };
}

/**
 * Place units around the perimeter of a floor plate
 * Uses radial placement: units on outer ring, BOH in center
 */
function placeUnitsOnFloor(
  floorIndex: number,
  width: number,
  height: number,
  unitQueue: UnitToPlace[],
  unitsNeeded: number
): { spaces: PlacedSpace[]; unitsPlaced: number } {
  const spaces: PlacedSpace[] = [];
  let unitsPlaced = 0;
  let spaceId = 0;

  const halfW = width / 2;
  const halfH = height / 2;
  const unitDepth = 26; // Standard unit depth

  // Helper to get next unit from queue
  function getNextUnit(): UnitToPlace | null {
    for (const u of unitQueue) {
      if (u.remaining > 0) return u;
    }
    return null;
  }

  // Helper to place a unit
  function placeUnit(x: number, y: number, rotated: boolean = false): boolean {
    if (unitsPlaced >= unitsNeeded) return false;
    const unit = getNextUnit();
    if (!unit) return false;

    const w = rotated ? unitDepth : unit.width;
    const h = rotated ? unit.width : unitDepth;

    spaces.push({
      id: `${unit.type.toLowerCase()}_${spaceId++}_f${floorIndex}`,
      type: unit.type,
      name: unit.type === 'STUDIO' ? 'Studio' :
            unit.type === 'ONE_BED' ? '1 BR' :
            unit.type === 'TWO_BED' ? '2 BR' : '3 BR',
      x, y,
      width: w,
      height: h,
      area: unit.area,
    });

    unit.remaining--;
    unitsPlaced++;
    return true;
  }

  // ROW 1: North edge (top) - units facing exterior
  for (let x = -halfW + MARGIN; x < halfW - MARGIN && unitsPlaced < unitsNeeded; ) {
    // Skip core zone
    if (x > -CORE_SIZE/2 && x < CORE_SIZE/2) { x = CORE_SIZE/2 + GAP; continue; }
    const unit = getNextUnit();
    if (!unit) break;
    if (x + unit.width > halfW - MARGIN) break;
    if (x + unit.width > -CORE_SIZE/2 && x < CORE_SIZE/2) { x = CORE_SIZE/2 + GAP; continue; }
    placeUnit(x + unit.width/2, -halfH + MARGIN + unitDepth/2);
    x += unit.width + GAP;
  }

  // ROW 2: South edge (bottom) - units facing exterior
  for (let x = -halfW + MARGIN; x < halfW - MARGIN && unitsPlaced < unitsNeeded; ) {
    if (x > -CORE_SIZE/2 && x < CORE_SIZE/2) { x = CORE_SIZE/2 + GAP; continue; }
    const unit = getNextUnit();
    if (!unit) break;
    if (x + unit.width > halfW - MARGIN) break;
    if (x + unit.width > -CORE_SIZE/2 && x < CORE_SIZE/2) { x = CORE_SIZE/2 + GAP; continue; }
    placeUnit(x + unit.width/2, halfH - MARGIN - unitDepth/2);
    x += unit.width + GAP;
  }

  // ROW 3: West edge (left) - rotated units
  for (let y = -halfH + MARGIN + unitDepth + GAP; y < halfH - MARGIN - unitDepth && unitsPlaced < unitsNeeded; ) {
    if (y > -CORE_SIZE/2 && y < CORE_SIZE/2) { y = CORE_SIZE/2 + GAP; continue; }
    const unit = getNextUnit();
    if (!unit) break;
    if (y + unit.width > halfH - MARGIN - unitDepth) break;
    placeUnit(-halfW + MARGIN + unitDepth/2, y + unit.width/2, true);
    y += unit.width + GAP;
  }

  // ROW 4: East edge (right) - rotated units
  for (let y = -halfH + MARGIN + unitDepth + GAP; y < halfH - MARGIN - unitDepth && unitsPlaced < unitsNeeded; ) {
    if (y > -CORE_SIZE/2 && y < CORE_SIZE/2) { y = CORE_SIZE/2 + GAP; continue; }
    const unit = getNextUnit();
    if (!unit) break;
    if (y + unit.width > halfH - MARGIN - unitDepth) break;
    placeUnit(halfW - MARGIN - unitDepth/2, y + unit.width/2, true);
    y += unit.width + GAP;
  }

  // ROW 5: North interior (double-loaded corridor - south side of north row)
  const interiorOffset = unitDepth + CORRIDOR_WIDTH;
  for (let x = -halfW + MARGIN + unitDepth + GAP; x < halfW - MARGIN - unitDepth && unitsPlaced < unitsNeeded; ) {
    if (x > -CORE_SIZE - 5 && x < CORE_SIZE + 5) { x = CORE_SIZE + 7; continue; }
    const unit = getNextUnit();
    if (!unit) break;
    if (x + unit.width > halfW - MARGIN - unitDepth) break;
    placeUnit(x + unit.width/2, -halfH + MARGIN + interiorOffset + unitDepth/2);
    x += unit.width + GAP;
  }

  // ROW 6: South interior (double-loaded corridor - north side of south row)
  for (let x = -halfW + MARGIN + unitDepth + GAP; x < halfW - MARGIN - unitDepth && unitsPlaced < unitsNeeded; ) {
    if (x > -CORE_SIZE - 5 && x < CORE_SIZE + 5) { x = CORE_SIZE + 7; continue; }
    const unit = getNextUnit();
    if (!unit) break;
    if (x + unit.width > halfW - MARGIN - unitDepth) break;
    placeUnit(x + unit.width/2, halfH - MARGIN - interiorOffset - unitDepth/2);
    x += unit.width + GAP;
  }

  // Add circulation core at center
  spaces.push({
    id: `elev_1_f${floorIndex}`,
    type: 'CIRCULATION',
    name: 'Elevator',
    x: -5, y: 0,
    width: 8, height: 12,
    area: 96,
  });
  spaces.push({
    id: `elev_2_f${floorIndex}`,
    type: 'CIRCULATION',
    name: 'Elevator',
    x: 5, y: 0,
    width: 8, height: 12,
    area: 96,
  });
  spaces.push({
    id: `stair_1_f${floorIndex}`,
    type: 'CIRCULATION',
    name: 'Stair',
    x: -15, y: 0,
    width: 10, height: 18,
    area: 180,
  });
  spaces.push({
    id: `stair_2_f${floorIndex}`,
    type: 'CIRCULATION',
    name: 'Stair',
    x: 15, y: 0,
    width: 10, height: 18,
    area: 180,
  });

  // Add trash/utility room
  spaces.push({
    id: `trash_f${floorIndex}`,
    type: 'SUPPORT',
    name: 'Trash',
    x: 0, y: -10,
    width: 10, height: 8,
    area: 80,
  });

  return { spaces, unitsPlaced };
}

/**
 * Generate ground floor layout
 */
function generateGroundFloor(floorIndex: number, width: number, height: number): PlacedSpace[] {
  const spaces: PlacedSpace[] = [];
  const halfW = width / 2;
  const halfH = height / 2;
  const s = Math.min(halfW * 0.3, 40);

  // Lobby
  spaces.push({
    id: `lobby_f${floorIndex}`,
    type: 'CIRCULATION',
    name: 'Lobby',
    x: 0, y: -halfH + s/2 + 10,
    width: s * 1.5, height: s,
    area: s * 1.5 * s,
  });

  // Retail (left side)
  spaces.push({
    id: `retail_f${floorIndex}`,
    type: 'RETAIL',
    name: 'Retail',
    x: -halfW + s * 0.8, y: 0,
    width: s * 1.2, height: s * 2,
    area: s * 1.2 * s * 2,
  });

  // Amenity lounge (right side)
  spaces.push({
    id: `lounge_f${floorIndex}`,
    type: 'AMENITY',
    name: 'Lounge',
    x: halfW - s * 0.8, y: 0,
    width: s * 1.2, height: s * 2,
    area: s * 1.2 * s * 2,
  });

  // Leasing office
  spaces.push({
    id: `leasing_f${floorIndex}`,
    type: 'SUPPORT',
    name: 'Leasing',
    x: s, y: -halfH + s * 0.6,
    width: s * 0.8, height: s * 0.6,
    area: s * 0.8 * s * 0.6,
  });

  // Mail room
  spaces.push({
    id: `mail_f${floorIndex}`,
    type: 'SUPPORT',
    name: 'Mail',
    x: -s, y: -halfH + s * 0.6,
    width: s * 0.6, height: s * 0.5,
    area: s * 0.6 * s * 0.5,
  });

  // Fitness center
  spaces.push({
    id: `fitness_f${floorIndex}`,
    type: 'AMENITY',
    name: 'Fitness',
    x: 0, y: halfH - s/2 - 10,
    width: s * 1.8, height: s,
    area: s * 1.8 * s,
  });

  // Circulation core
  spaces.push({
    id: `elev_1_f${floorIndex}`,
    type: 'CIRCULATION',
    name: 'Elevator',
    x: -5, y: 0,
    width: 8, height: 12,
    area: 96,
  });
  spaces.push({
    id: `elev_2_f${floorIndex}`,
    type: 'CIRCULATION',
    name: 'Elevator',
    x: 5, y: 0,
    width: 8, height: 12,
    area: 96,
  });

  return spaces;
}

/**
 * Generate parking floor layout
 */
function generateParkingFloor(floorIndex: number, width: number, _height: number): PlacedSpace[] {
  const spaces: PlacedSpace[] = [];
  const halfW = width / 2;

  // Drive aisle
  spaces.push({
    id: `aisle_f${floorIndex}`,
    type: 'CIRCULATION',
    name: 'Drive Aisle',
    x: 0, y: 0,
    width: width - 30, height: 24,
    area: (width - 30) * 24,
  });

  // Parking stalls - 2 rows
  let n = 0;
  for (let x = -halfW + 15; x < halfW - 15 && n < 60; x += 10) {
    spaces.push({
      id: `stall_${n++}_f${floorIndex}`,
      type: 'PARKING',
      name: `Stall ${n}`,
      x, y: -22,
      width: 9, height: 18,
      area: 162,
    });
    spaces.push({
      id: `stall_${n++}_f${floorIndex}`,
      type: 'PARKING',
      name: `Stall ${n}`,
      x, y: 22,
      width: 9, height: 18,
      area: 162,
    });
  }

  // Elevator core
  spaces.push({
    id: `elev_f${floorIndex}`,
    type: 'CIRCULATION',
    name: 'Elevator',
    x: 0, y: 0,
    width: 12, height: 12,
    area: 144,
  });

  return spaces;
}

/**
 * Main massing generator function
 */
export function generateMassing(config: BuildingConfig): MassingResult {
  const floors: GeneratedFloor[] = [];

  // Calculate floor plate dimensions
  const { width, height } = getFloorPlateDimensions(config.floorPlateArea);

  // Create unit queue with remaining counts
  const unitQueue: UnitToPlace[] = [
    { type: 'STUDIO', width: config.units.studios.width, depth: config.units.studios.depth, area: config.units.studios.area, remaining: config.units.studios.count },
    { type: 'ONE_BED', width: config.units.oneBed.width, depth: config.units.oneBed.depth, area: config.units.oneBed.area, remaining: config.units.oneBed.count },
    { type: 'TWO_BED', width: config.units.twoBed.width, depth: config.units.twoBed.depth, area: config.units.twoBed.area, remaining: config.units.twoBed.count },
    { type: 'THREE_BED', width: config.units.threeBed.width, depth: config.units.threeBed.depth, area: config.units.threeBed.area, remaining: config.units.threeBed.count },
  ];

  // Calculate how many units we can fit per floor
  const residentialFloors = config.storiesAbove - 1; // Minus ground floor
  const unitsPerFloor = Math.ceil(config.totalUnits / Math.max(1, residentialFloors)) + 5;

  // Track placed units
  const placed = {
    studios: 0,
    oneBed: 0,
    twoBed: 0,
    threeBed: 0,
    total: 0,
  };

  // Generate parking floors (below grade)
  for (let i = -config.storiesBelow; i < 0; i++) {
    floors.push({
      floorIndex: i,
      floorType: 'PARKING',
      boundary: { width, height },
      spaces: generateParkingFloor(i, width, height),
    });
  }

  // Generate ground floor
  floors.push({
    floorIndex: 0,
    floorType: 'GROUND',
    boundary: { width, height },
    spaces: generateGroundFloor(0, width, height),
  });

  // Generate residential floors
  for (let i = 1; i < config.storiesAbove; i++) {
    const initialRemaining = {
      studios: unitQueue[0].remaining,
      oneBed: unitQueue[1].remaining,
      twoBed: unitQueue[2].remaining,
      threeBed: unitQueue[3].remaining,
    };

    const result = placeUnitsOnFloor(i, width, height, unitQueue, unitsPerFloor);

    // Track what was placed on this floor
    placed.studios += initialRemaining.studios - unitQueue[0].remaining;
    placed.oneBed += initialRemaining.oneBed - unitQueue[1].remaining;
    placed.twoBed += initialRemaining.twoBed - unitQueue[2].remaining;
    placed.threeBed += initialRemaining.threeBed - unitQueue[3].remaining;
    placed.total += result.unitsPlaced;

    floors.push({
      floorIndex: i,
      floorType: 'RESIDENTIAL',
      boundary: { width, height },
      spaces: result.spaces,
    });
  }

  // Calculate efficiency
  const totalUnitArea = placed.studios * config.units.studios.area +
                        placed.oneBed * config.units.oneBed.area +
                        placed.twoBed * config.units.twoBed.area +
                        placed.threeBed * config.units.threeBed.area;
  const residentialArea = config.floorPlateArea * residentialFloors;
  const efficiency = totalUnitArea / residentialArea;

  // Calculate scale factor (if units don't fit)
  const targetUnitArea = config.units.studios.count * config.units.studios.area +
                         config.units.oneBed.count * config.units.oneBed.area +
                         config.units.twoBed.count * config.units.twoBed.area +
                         config.units.threeBed.count * config.units.threeBed.area;
  const scaleFactor = placed.total < config.totalUnits ?
    Math.sqrt(targetUnitArea / totalUnitArea) : 1.0;

  return {
    floors,
    scaleFactor,
    unitsPlaced: placed,
    efficiency,
  };
}
