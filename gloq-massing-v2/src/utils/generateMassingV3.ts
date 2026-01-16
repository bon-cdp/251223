/**
 * Massing Generator V3 - Perimeter Offset Algorithm
 *
 * Architectural approach:
 * 1. Calculate floor plate from lot size + aspect ratio
 * 2. Create perimeter band by insetting from exterior wall
 * 3. Place units along perimeter (all get windows)
 * 4. Place corridor through center
 * 5. Place core (elevators/stairs) in corridor
 * 6. Fill remaining space with BOH
 */

import type { FullBuildingConfig, GeneratedFloorV3, MassingResultV3, PlacedSpaceV3 } from '../types/building';
import type { Rectangle, EdgeSide } from './geometry';
import {
  calculateFloorPlate,
  createPerimeterBand,
  placeUnitsAlongEdge,
  placeCorridor,
  placeCore,
  getBounds,
  validateNoOverlaps,
} from './geometry';

// ============================================================================
// Constants
// ============================================================================

const CORRIDOR_WIDTH = 6;  // 6ft minimum per code
const UNIT_GAP = 0;        // Wall thickness handled in unit width
const MIN_UNIT_DEPTH = 24;
const MAX_UNIT_DEPTH = 32;
const DEFAULT_UNIT_DEPTH = 28;

// ============================================================================
// Unit Dimension Calculation
// ============================================================================

interface UnitDimensions {
  type: string;
  count: number;
  area: number;
  depth: number;
  width: number;
}

function calculateUnitDimensions(units: FullBuildingConfig['units']): UnitDimensions[] {
  const result: UnitDimensions[] = [];

  const unitTypes = [
    { key: 'studio', type: 'STUDIO', data: units.studio },
    { key: 'oneBed', type: 'ONE_BED', data: units.oneBed },
    { key: 'twoBed', type: 'TWO_BED', data: units.twoBed },
    { key: 'threeBed', type: 'THREE_BED', data: units.threeBed },
  ];

  for (const { type, data } of unitTypes) {
    if (data.count > 0) {
      // Use provided dimensions or calculate from area
      const depth = data.depth || DEFAULT_UNIT_DEPTH;
      const width = data.width || data.area / depth;

      result.push({
        type,
        count: data.count,
        area: data.area,
        depth: Math.min(MAX_UNIT_DEPTH, Math.max(MIN_UNIT_DEPTH, depth)),
        width,
      });
    }
  }

  return result;
}

// ============================================================================
// Residential Floor Generation
// ============================================================================

function generateResidentialFloor(
  floorIndex: number,
  floorPlate: Rectangle,
  unitDimensions: UnitDimensions[],
  unitsPerFloor: number,
  totalUnits: number
): { spaces: PlacedSpaceV3[]; unitsPlaced: Map<string, number> } {
  const spaces: PlacedSpaceV3[] = [];
  const unitsPlaced = new Map<string, number>();

  // Calculate unit depth (use max depth from unit dimensions)
  const unitDepth = Math.max(...unitDimensions.map(u => u.depth), DEFAULT_UNIT_DEPTH);

  // Create perimeter band
  const perimeterBand = createPerimeterBand(floorPlate, unitDepth);
  if (!perimeterBand) {
    console.warn('Floor plate too small for units');
    return { spaces, unitsPlaced };
  }

  // Prepare unit queue (copy to track remaining per floor)
  const unitQueue = unitDimensions.map(u => ({
    type: u.type,
    width: u.width,
    depth: u.depth,
    remaining: Math.ceil(u.count / 7), // Distribute across ~7 residential floors
  }));

  // Place units on each side of perimeter
  const sides: EdgeSide[] = ['north', 'south', 'east', 'west'];
  const bandMap: Record<EdgeSide, Rectangle> = {
    north: perimeterBand.north,
    south: perimeterBand.south,
    east: perimeterBand.east,
    west: perimeterBand.west,
  };

  let totalPlaced = 0;

  for (const side of sides) {
    if (totalPlaced >= unitsPerFloor) break;

    const edgeBand = bandMap[side];
    const { placed } = placeUnitsAlongEdge(edgeBand, side, unitQueue, UNIT_GAP);

    for (const unit of placed) {
      if (totalPlaced >= unitsPerFloor) break;

      spaces.push({
        id: `${unit.type.toLowerCase()}_${floorIndex}_${spaces.length}`,
        type: unit.type as PlacedSpaceV3['type'],
        name: getUnitName(unit.type),
        x: unit.rect.x,
        y: unit.rect.y,
        width: unit.rect.width,
        height: unit.rect.height,
        area: unit.rect.width * unit.rect.height,
        side: unit.side,
      });

      const prev = unitsPlaced.get(unit.type) || 0;
      unitsPlaced.set(unit.type, prev + 1);
      totalPlaced++;
    }
  }

  // Place corridor through center
  const corridor = placeCorridor(floorPlate, CORRIDOR_WIDTH, unitDepth);
  spaces.push({
    id: `corridor_${floorIndex}`,
    type: 'CIRCULATION',
    name: 'Corridor',
    x: corridor.rect.x,
    y: corridor.rect.y,
    width: corridor.rect.width,
    height: corridor.rect.height,
    area: corridor.rect.width * corridor.rect.height,
  });

  // Place core (elevators + stairs)
  const core = placeCore(corridor, totalUnits, 'center');

  for (let i = 0; i < core.elevators.length; i++) {
    const elev = core.elevators[i];
    spaces.push({
      id: `elevator_${i}_${floorIndex}`,
      type: 'CIRCULATION',
      name: `Elevator ${i + 1}`,
      x: elev.x,
      y: elev.y,
      width: elev.width,
      height: elev.height,
      area: elev.width * elev.height,
    });
  }

  for (let i = 0; i < core.stairs.length; i++) {
    const stair = core.stairs[i];
    spaces.push({
      id: `stair_${i}_${floorIndex}`,
      type: 'CIRCULATION',
      name: `Stair ${i + 1}`,
      x: stair.x,
      y: stair.y,
      width: stair.width,
      height: stair.height,
      area: stair.width * stair.height,
    });
  }

  // Add support spaces (trash, mechanical)
  const trashRoom: PlacedSpaceV3 = {
    id: `trash_${floorIndex}`,
    type: 'SUPPORT',
    name: 'Trash',
    x: core.totalRect.x - core.totalRect.width / 2 - 6,
    y: core.totalRect.y,
    width: 8,
    height: 10,
    area: 80,
  };
  spaces.push(trashRoom);

  return { spaces, unitsPlaced };
}

// ============================================================================
// Ground Floor Generation
// ============================================================================

function generateGroundFloor(
  floorIndex: number,
  floorPlate: Rectangle,
  config: FullBuildingConfig
): PlacedSpaceV3[] {
  const spaces: PlacedSpaceV3[] = [];
  const bounds = getBounds(floorPlate);
  const unitDepth = DEFAULT_UNIT_DEPTH;

  // Lobby at front (south)
  const lobbyWidth = Math.min(floorPlate.width * 0.3, 50);
  const lobbyDepth = Math.min(40, unitDepth);
  spaces.push({
    id: `lobby_${floorIndex}`,
    type: 'CIRCULATION',
    name: 'Lobby',
    x: floorPlate.x,
    y: bounds.maxY - lobbyDepth / 2,
    width: lobbyWidth,
    height: lobbyDepth,
    area: lobbyWidth * lobbyDepth,
  });

  // Retail on one side (west)
  if (config.retail > 0) {
    const retailWidth = Math.min(config.retail / unitDepth, floorPlate.width * 0.3);
    spaces.push({
      id: `retail_${floorIndex}`,
      type: 'RETAIL',
      name: 'Retail',
      x: bounds.minX + retailWidth / 2 + 2,
      y: floorPlate.y,
      width: retailWidth,
      height: unitDepth * 1.5,
      area: config.retail,
    });
  }

  // Amenity lounge (east side)
  if (config.amenitiesIndoor > 0) {
    const amenityWidth = Math.min(config.amenitiesIndoor / unitDepth, floorPlate.width * 0.25);
    spaces.push({
      id: `amenity_${floorIndex}`,
      type: 'AMENITY',
      name: 'Lounge',
      x: bounds.maxX - amenityWidth / 2 - 2,
      y: floorPlate.y,
      width: amenityWidth,
      height: unitDepth,
      area: config.amenitiesIndoor,
    });
  }

  // Leasing office
  spaces.push({
    id: `leasing_${floorIndex}`,
    type: 'SUPPORT',
    name: 'Leasing',
    x: floorPlate.x + lobbyWidth / 2 + 15,
    y: bounds.maxY - 20,
    width: 20,
    height: 15,
    area: 300,
  });

  // Mail room
  spaces.push({
    id: `mail_${floorIndex}`,
    type: 'SUPPORT',
    name: 'Mail',
    x: floorPlate.x - lobbyWidth / 2 - 10,
    y: bounds.maxY - 15,
    width: 15,
    height: 12,
    area: 180,
  });

  // Core (elevators + stairs)
  const corridor = placeCorridor(floorPlate, CORRIDOR_WIDTH, unitDepth);
  const core = placeCore(corridor, config.totalUnits, 'center');

  for (let i = 0; i < core.elevators.length; i++) {
    const elev = core.elevators[i];
    spaces.push({
      id: `elevator_${i}_${floorIndex}`,
      type: 'CIRCULATION',
      name: `Elevator ${i + 1}`,
      x: elev.x,
      y: elev.y,
      width: elev.width,
      height: elev.height,
      area: elev.width * elev.height,
    });
  }

  for (let i = 0; i < core.stairs.length; i++) {
    const stair = core.stairs[i];
    spaces.push({
      id: `stair_${i}_${floorIndex}`,
      type: 'CIRCULATION',
      name: `Stair ${i + 1}`,
      x: stair.x,
      y: stair.y,
      width: stair.width,
      height: stair.height,
      area: stair.width * stair.height,
    });
  }

  return spaces;
}

// ============================================================================
// Parking Floor Generation
// ============================================================================

function generateParkingFloor(
  floorIndex: number,
  floorPlate: Rectangle
): PlacedSpaceV3[] {
  const spaces: PlacedSpaceV3[] = [];
  const bounds = getBounds(floorPlate);

  // Drive aisle through center
  const aisleWidth = 24;
  spaces.push({
    id: `aisle_${floorIndex}`,
    type: 'CIRCULATION',
    name: 'Drive Aisle',
    x: floorPlate.x,
    y: floorPlate.y,
    width: floorPlate.width - 40,
    height: aisleWidth,
    area: (floorPlate.width - 40) * aisleWidth,
  });

  // Parking stalls on both sides
  const stallWidth = 9;
  const stallDepth = 18;
  let stallCount = 0;

  for (let x = bounds.minX + 20; x < bounds.maxX - 20; x += stallWidth + 1) {
    // North row
    spaces.push({
      id: `stall_n_${stallCount}_${floorIndex}`,
      type: 'PARKING',
      name: `P${stallCount + 1}`,
      x: x + stallWidth / 2,
      y: floorPlate.y - aisleWidth / 2 - stallDepth / 2,
      width: stallWidth,
      height: stallDepth,
      area: stallWidth * stallDepth,
    });
    stallCount++;

    // South row
    spaces.push({
      id: `stall_s_${stallCount}_${floorIndex}`,
      type: 'PARKING',
      name: `P${stallCount + 1}`,
      x: x + stallWidth / 2,
      y: floorPlate.y + aisleWidth / 2 + stallDepth / 2,
      width: stallWidth,
      height: stallDepth,
      area: stallWidth * stallDepth,
    });
    stallCount++;
  }

  // Elevator core
  spaces.push({
    id: `parking_elev_${floorIndex}`,
    type: 'CIRCULATION',
    name: 'Elevator',
    x: floorPlate.x,
    y: floorPlate.y,
    width: 12,
    height: 12,
    area: 144,
  });

  return spaces;
}

// ============================================================================
// Main Generator Function
// ============================================================================

export function generateMassingV3(config: FullBuildingConfig): MassingResultV3 {
  const floors: GeneratedFloorV3[] = [];
  const warnings: string[] = [];

  // Calculate floor plate
  const floorPlate = calculateFloorPlate(
    config.floorPlateArea,
    config.floorPlateAspect || 1.4
  );

  // Calculate unit dimensions
  const unitDimensions = calculateUnitDimensions(config.units);

  // Calculate units per residential floor
  const residentialFloors = config.storiesAbove - 1; // Minus ground floor
  const unitsPerFloor = Math.ceil(config.totalUnits / Math.max(1, residentialFloors));

  // Track total units placed
  const totalPlaced = {
    studio: 0,
    oneBed: 0,
    twoBed: 0,
    threeBed: 0,
    total: 0,
  };

  // Generate parking floors (below grade)
  for (let i = -config.storiesBelow; i < 0; i++) {
    const spaces = generateParkingFloor(i, floorPlate);
    floors.push({
      floorIndex: i,
      floorType: 'PARKING',
      boundary: { width: floorPlate.width, height: floorPlate.height },
      spaces,
    });
  }

  // Generate ground floor
  const groundSpaces = generateGroundFloor(0, floorPlate, config);
  floors.push({
    floorIndex: 0,
    floorType: 'GROUND',
    boundary: { width: floorPlate.width, height: floorPlate.height },
    spaces: groundSpaces,
  });

  // Generate residential floors
  for (let i = 1; i < config.storiesAbove; i++) {
    const remainingUnits = config.totalUnits - totalPlaced.total;
    const targetUnits = Math.min(unitsPerFloor, remainingUnits);

    const { spaces, unitsPlaced } = generateResidentialFloor(
      i,
      floorPlate,
      unitDimensions,
      targetUnits,
      config.totalUnits
    );

    // Update totals
    totalPlaced.studio += unitsPlaced.get('STUDIO') || 0;
    totalPlaced.oneBed += unitsPlaced.get('ONE_BED') || 0;
    totalPlaced.twoBed += unitsPlaced.get('TWO_BED') || 0;
    totalPlaced.threeBed += unitsPlaced.get('THREE_BED') || 0;
    totalPlaced.total += Array.from(unitsPlaced.values()).reduce((a, b) => a + b, 0);

    floors.push({
      floorIndex: i,
      floorType: 'RESIDENTIAL',
      boundary: { width: floorPlate.width, height: floorPlate.height },
      spaces,
    });
  }

  // Check for placement issues
  if (totalPlaced.total < config.totalUnits) {
    const missing = config.totalUnits - totalPlaced.total;
    warnings.push(`${missing} units could not fit. Consider larger floor plate or fewer stories.`);
  }

  // Validate no overlaps on each floor
  for (const floor of floors) {
    const rects = floor.spaces.map(s => ({ x: s.x, y: s.y, width: s.width, height: s.height }));
    const { valid, conflicts } = validateNoOverlaps(rects);
    if (!valid) {
      warnings.push(`Floor ${floor.floorIndex}: ${conflicts.length} space overlaps detected`);
    }
  }

  // Calculate metrics
  const totalUnitArea =
    totalPlaced.studio * (config.units.studio?.area || 500) +
    totalPlaced.oneBed * (config.units.oneBed?.area || 650) +
    totalPlaced.twoBed * (config.units.twoBed?.area || 1050) +
    totalPlaced.threeBed * (config.units.threeBed?.area || 1300);

  const totalBuildingArea = config.floorPlateArea * config.storiesAbove;
  const efficiency = totalUnitArea / totalBuildingArea;

  const placementRate = totalPlaced.total / config.totalUnits;

  return {
    floors,
    metrics: {
      totalUnitsTarget: config.totalUnits,
      totalUnitsPlaced: totalPlaced.total,
      placementRate,
      efficiency,
      unitsPlaced: totalPlaced,
      floorPlateArea: config.floorPlateArea,
      totalBuildingArea,
      costPerSF: config.costPerSF,
      totalCost: config.totalConstructionCost,
      costPerUnit: config.totalConstructionCost / Math.max(1, totalPlaced.total),
    },
    warnings,
    config,
  };
}

// ============================================================================
// Helper Functions
// ============================================================================

function getUnitName(type: string): string {
  switch (type) {
    case 'STUDIO': return 'Studio';
    case 'ONE_BED': return '1 BR';
    case 'TWO_BED': return '2 BR';
    case 'THREE_BED': return '3 BR';
    default: return type;
  }
}
