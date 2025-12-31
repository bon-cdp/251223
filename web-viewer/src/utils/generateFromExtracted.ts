/**
 * Generate solver-like result from extracted PDF data
 * Uses actual unit dimensions (width_ft, depth_ft) for accurate floor plans
 *
 * IMPORTANT: Uses CENTER-ORIGIN coordinate system like the default sample data
 * Boundary runs from (-halfSide, -halfSide) to (halfSide, halfSide)
 * Origin (0,0) is at the center of the floor plate
 */

import { SolverResult, FloorData, SpaceData } from '../types/solverOutput';
import { ExtractedBuildingData } from '../components/data/PdfUploader';

interface LegacyExtractedData {
  properties?: {
    area_sf?: number;
    apn?: string;
    total_units_proposed?: number;
    floor_area_ratio?: number;
    [key: string]: any;
  };
  constraints?: {
    zoning?: string;
    maximum_height_feet?: number;
    setbacks?: { front_feet?: number; rear_feet?: number; side_feet?: number };
    parking_requirement_per_unit?: number;
    [key: string]: any;
  };
  units?: Array<{ type: string; count: number; area_sf: number }>;
  metadata?: Record<string, any>;
  building_data?: ExtractedBuildingData;
}

export function generateSolverResultFromExtracted(extracted: LegacyExtractedData): SolverResult {
  // If we have the new structured building data, use it for accurate floor plans
  if (extracted.building_data) {
    return generateFromBuildingData(extracted.building_data);
  }

  // Fallback to legacy generation
  return generateFromLegacyData(extracted);
}

/**
 * Generate floor plans using actual unit dimensions from extraction
 * Uses CENTER-ORIGIN coordinate system for proper rendering
 */
function generateFromBuildingData(data: ExtractedBuildingData): SolverResult {
  const building = data.building;
  const units = data.dwelling_units || [];
  const circulation = data.circulation;
  const parking = data.parking;

  // Calculate floor plate dimensions - SQUARE like the default data
  const floorPlateArea = building.floor_plate_sf || 19000;
  const floorPlateSide = Math.sqrt(floorPlateArea);  // ~138.96' for 19310 SF
  const halfSide = floorPlateSide / 2;  // ~69.48'

  const numFloorsAbove = building.stories_above_grade || 7;
  const numFloorsBelow = building.stories_below_grade || 1;
  const totalFloors = building.stories_total || numFloorsAbove + numFloorsBelow;

  // Calculate units per floor for residential floors
  const totalUnits = units.reduce((sum, u) => sum + u.count, 0);
  const residentialFloors = numFloorsAbove - 1; // Excluding ground floor
  const unitsPerFloor = Math.ceil(totalUnits / Math.max(residentialFloors, 1));

  // Circulation dimensions - use FIXED realistic sizes, not PDF values
  // PDF values are often total SF across building, not per-element sizes
  const corridorWidth = circulation?.corridor_width_ft || 6;
  const numElevators = Math.min(circulation?.elevators?.passenger?.count || 2, 3);
  const numStairs = Math.min(circulation?.stairs?.count || 2, 2);

  // Standard dimensions for circulation elements (industry standard)
  const ELEVATOR_WIDTH = 8;   // 8' x 8' standard passenger elevator
  const ELEVATOR_DEPTH = 8;
  const STAIR_WIDTH = 10;     // 10' x 12' standard stair with landing
  const STAIR_DEPTH = 12;

  // Generate floors
  const floors: FloorData[] = [];

  // Generate each floor
  for (let floorIdx = -numFloorsBelow; floorIdx < numFloorsAbove; floorIdx++) {
    const spaces: SpaceData[] = [];
    let floorType: string;

    if (floorIdx < 0) {
      floorType = 'PARKING_UNDERGROUND';
    } else if (floorIdx === 0) {
      floorType = 'GROUND';
    } else {
      floorType = 'RESIDENTIAL_TYPICAL';
    }

    // Add vertical circulation (elevators and stairs) to every floor
    // Position at CENTER (0, 0) - compact core arrangement

    // Calculate core width: [Stair1] [Elevator(s)] [Stair2]
    const coreWidth = STAIR_WIDTH + (numElevators * (ELEVATOR_WIDTH + 1)) + STAIR_WIDTH + 4;

    // Stair 1 - left side of core
    spaces.push(createSpace(
      `stair_1_f${floorIdx}`,
      'CIRCULATION',
      'Stair 1',
      floorIdx,
      -coreWidth / 2 + STAIR_WIDTH / 2,
      0,
      STAIR_WIDTH,
      STAIR_DEPTH,
      true
    ));

    // Elevators - center of core
    const elevatorStartX = -coreWidth / 2 + STAIR_WIDTH + 2;
    for (let e = 0; e < numElevators; e++) {
      spaces.push(createSpace(
        `elevator_${e + 1}_f${floorIdx}`,
        'CIRCULATION',
        `Elevator ${e + 1}`,
        floorIdx,
        elevatorStartX + e * (ELEVATOR_WIDTH + 1) + ELEVATOR_WIDTH / 2,
        0,
        ELEVATOR_WIDTH,
        ELEVATOR_DEPTH,
        true
      ));
    }

    // Stair 2 - right side of core
    spaces.push(createSpace(
      `stair_2_f${floorIdx}`,
      'CIRCULATION',
      'Stair 2',
      floorIdx,
      coreWidth / 2 - STAIR_WIDTH / 2,
      0,
      STAIR_WIDTH,
      STAIR_DEPTH,
      true
    ));

    if (floorIdx < 0) {
      // Parking floor - generate parking spaces
      generateParkingFloor(spaces, floorIdx, halfSide, parking);
    } else if (floorIdx === 0) {
      // Ground floor - lobby, retail, support spaces
      generateGroundFloor(spaces, floorIdx, halfSide, data);
    } else {
      // Residential floors - use actual unit dimensions
      generateResidentialFloor(
        spaces,
        floorIdx,
        halfSide,
        units,
        corridorWidth,
        unitsPerFloor,
        residentialFloors
      );
    }

    // CENTER-ORIGIN boundary: from (-halfSide, -halfSide) to (halfSide, halfSide)
    floors.push({
      floor_index: floorIdx,
      floor_type: floorType,
      boundary: [
        [-halfSide, -halfSide],
        [halfSide, -halfSide],
        [halfSide, halfSide],
        [-halfSide, halfSide],
      ],
      area_sf: floorPlateArea,
      spaces,
    });
  }

  const totalSpaces = floors.reduce((sum, f) => sum + f.spaces.length, 0);

  return {
    success: true,
    obstruction: 0,
    iterations: 1,
    message: 'Generated from PDF extraction with actual unit dimensions',
    violations: [],
    metrics: {
      placement_rate: '100.0%',
      avg_membership: '1.00',
      total_spaces: totalSpaces,
      placed_spaces: totalSpaces,
    },
    building: {
      floors,
      stalks: [
        {
          id: 'elevator_stalk',
          type: 'elevator',
          floor_range: Array.from({ length: totalFloors }, (_, i) => i - numFloorsBelow),
          position: { x: -4, y: 0 },  // 8' elevator, center at -4'
        },
        {
          id: 'stair_stalk',
          type: 'stair',
          floor_range: Array.from({ length: totalFloors }, (_, i) => i - numFloorsBelow),
          position: { x: 9, y: 0 },  // Right of elevators
        },
      ],
      metrics: {
        total_floors: totalFloors,
        total_spaces: totalSpaces,
        cohomology_obstruction: 0,
      },
    },
  };
}

/**
 * Generate parking floor with parking stalls
 * Uses CENTER-ORIGIN coordinates
 */
function generateParkingFloor(
  spaces: SpaceData[],
  floorIdx: number,
  halfSide: number,
  parking: ExtractedBuildingData['parking']
): void {
  const totalStalls = parking?.underground_stalls || 35;
  const stallWidth = 9; // Standard parking stall width
  const stallDepth = 18; // Standard parking stall depth
  const aisleWidth = 24; // Drive aisle width
  const margin = 10;

  // Available width for parking
  const availableWidth = (halfSide - margin) * 2;
  const stallsPerRow = Math.floor(availableWidth / stallWidth);
  const numRows = Math.ceil(totalStalls / (stallsPerRow * 2)); // 2 sides

  let stallCount = 0;

  // Place parking on both sides of drive aisle
  for (let row = 0; row < numRows && stallCount < totalStalls; row++) {
    // Y position for this row (alternating north and south of center)
    const rowYNorth = -(aisleWidth / 2 + stallDepth / 2 + row * (stallDepth + 2));
    const rowYSouth = aisleWidth / 2 + stallDepth / 2 + row * (stallDepth + 2);

    for (let col = 0; col < stallsPerRow && stallCount < totalStalls; col++) {
      const xPos = -halfSide + margin + (col * stallWidth) + stallWidth / 2;

      // North side stall
      if (stallCount < totalStalls) {
        spaces.push(createSpace(
          `parking_${stallCount + 1}_f${floorIdx}`,
          'PARKING',
          `Parking ${stallCount + 1}`,
          floorIdx,
          xPos,
          rowYNorth,
          stallWidth,
          stallDepth,
          false
        ));
        stallCount++;
      }

      // South side stall
      if (stallCount < totalStalls && row === 0) { // Only first row on south for now
        spaces.push(createSpace(
          `parking_${stallCount + 1}_f${floorIdx}`,
          'PARKING',
          `Parking ${stallCount + 1}`,
          floorIdx,
          xPos,
          rowYSouth,
          stallWidth,
          stallDepth,
          false
        ));
        stallCount++;
      }
    }
  }

  // Add drive aisle at center
  spaces.push(createSpace(
    `drive_aisle_f${floorIdx}`,
    'CIRCULATION',
    'Drive Aisle',
    floorIdx,
    0,
    0,
    halfSide * 2 - margin * 2,
    aisleWidth,
    false
  ));
}

/**
 * Generate ground floor with lobby, retail, and support spaces
 * Uses CENTER-ORIGIN coordinates
 */
function generateGroundFloor(
  spaces: SpaceData[],
  floorIdx: number,
  halfSide: number,
  data: ExtractedBuildingData
): void {
  const support = data.support || [];
  const amenities = data.amenities_indoor || [];

  // Lobby - at front (negative Y in center-origin)
  const lobbyArea = support.find(s => s.name.toLowerCase().includes('lobby'))?.area_sf || 500;
  const lobbyWidth = Math.sqrt(lobbyArea * 1.5);
  const lobbyDepth = lobbyArea / lobbyWidth;

  spaces.push(createSpace(
    `lobby_f${floorIdx}`,
    'CIRCULATION',
    'Entry Lobby',
    floorIdx,
    0,  // Centered on X
    -halfSide + lobbyDepth / 2 + 5,  // Near front edge
    lobbyWidth,
    lobbyDepth,
    false
  ));

  // Mail room - near lobby
  const mailRoom = support.find(s => s.name.toLowerCase().includes('mail'));
  if (mailRoom) {
    spaces.push(createSpace(
      `mail_f${floorIdx}`,
      'SUPPORT',
      'Mail Room',
      floorIdx,
      -lobbyWidth / 2 - 20,
      -halfSide + 20,
      15,
      15,
      false
    ));
  }

  // Retail spaces on ground floor sides
  const retailSpaces = amenities.filter(a =>
    a.name.toLowerCase().includes('retail') ||
    a.name.toLowerCase().includes('café') ||
    a.name.toLowerCase().includes('cafe') ||
    a.name.toLowerCase().includes('bar')
  );

  // If no retail found in amenities, add default retail
  if (retailSpaces.length === 0) {
    retailSpaces.push({ name: 'Retail Space', area_sf: 2500, floor: 'ground' });
  }

  let xOffset = -halfSide + 20;
  for (const retail of retailSpaces) {
    const retailWidth = Math.sqrt((retail.area_sf || 1000) * 0.8);
    const retailDepth = (retail.area_sf || 1000) / retailWidth;

    spaces.push(createSpace(
      `retail_${retail.name.replace(/\s+/g, '_').toLowerCase()}_f${floorIdx}`,
      'RETAIL',
      retail.name,
      floorIdx,
      xOffset + retailWidth / 2,
      0,  // Center Y
      retailWidth,
      retailDepth,
      false
    ));
    xOffset += retailWidth + 10;
  }

  // Leasing office - near front right
  spaces.push(createSpace(
    `leasing_f${floorIdx}`,
    'SUPPORT',
    'Leasing Office',
    floorIdx,
    halfSide - 25,
    -halfSide + 20,
    20,
    15,
    false
  ));

  // Bicycle room - at back
  const bikeRoom = support.find(s => s.name.toLowerCase().includes('bicycle'));
  if (bikeRoom) {
    spaces.push(createSpace(
      `bicycle_f${floorIdx}`,
      'SUPPORT',
      'Bicycle Room',
      floorIdx,
      halfSide - 35,
      halfSide - 25,
      40,
      30,
      false
    ));
  }
}

/**
 * Generate residential floor using ALGEBRAIC approach
 *
 * COORDINATE SYSTEM (center-origin):
 *   Floor plate: [-h, -h] to [+h, +h] where h = halfSide
 *   Corridor: Y from -Wc/2 to +Wc/2, X from -h+margin to +h-margin
 *
 * UNIT PLACEMENT:
 *   North side (negative Y): units above corridor
 *   South side (positive Y): units below corridor
 *
 * CONSTRAINTS:
 *   - Unit top edge >= -halfSide + margin
 *   - Unit bottom edge <= -corridorWidth/2 - gap (for north)
 *   - Unit left edge >= -halfSide + margin
 *   - Unit right edge <= +halfSide - margin
 */
function generateResidentialFloor(
  spaces: SpaceData[],
  floorIdx: number,
  halfSide: number,
  units: ExtractedBuildingData['dwelling_units'],
  corridorWidth: number,
  _unitsPerFloor: number,
  totalResidentialFloors: number
): void {
  // Constants
  const MARGIN = 5;           // Margin from floor plate edge
  const GAP = 2;              // Gap between units and corridor
  const UNIT_GAP = 1;         // Gap between adjacent units
  const CORE_ZONE = 25;       // X zone reserved for circulation core at center

  // Calculate available space
  const Wc = corridorWidth;   // Corridor width
  const h = halfSide;         // Half of floor plate side

  // Available depth for units on each side
  // North: from -h+MARGIN to -Wc/2-GAP
  // South: from +Wc/2+GAP to +h-MARGIN
  const availableDepth = h - MARGIN - Wc / 2 - GAP;

  // Add corridor at center (Y=0)
  const corridorLength = 2 * h - 2 * MARGIN;
  spaces.push(createSpace(
    `corridor_f${floorIdx}`,
    'CIRCULATION',
    'Corridor',
    floorIdx,
    0,              // X center
    0,              // Y center
    corridorLength, // width (along X)
    Wc,             // height (corridor width)
    false
  ));

  // Get unit allocation for this floor
  const unitAllocation = distributeUnitsToFloor(units, floorIdx, totalResidentialFloors);
  if (unitAllocation.length === 0) return;

  // Get average unit dimensions for capacity calculation
  const avgWidth = units.reduce((s, u) => s + (u.width_ft || 25), 0) / units.length || 25;
  const avgDepth = units.reduce((s, u) => s + (u.depth_ft || 28), 0) / units.length || 28;

  // Cap unit depth to available space
  const maxUnitDepth = Math.min(avgDepth, availableDepth);

  // Calculate unit Y positions (center of unit)
  // IMPORTANT: Units need EXTERIOR WINDOWS, so position at perimeter not corridor
  //
  // North side: exterior (window) edge at top, interior edge faces corridor
  //   - Top edge (exterior) at: -h + MARGIN
  //   - Unit center at: -h + MARGIN + depth/2
  //   - Bottom edge (interior) at: -h + MARGIN + depth (must be < -Wc/2 - GAP)
  //
  // South side: exterior (window) edge at bottom, interior edge faces corridor
  //   - Bottom edge (exterior) at: +h - MARGIN
  //   - Unit center at: +h - MARGIN - depth/2
  //   - Top edge (interior) at: +h - MARGIN - depth (must be > +Wc/2 + GAP)
  const northY = -h + MARGIN + maxUnitDepth / 2;  // Positioned at north perimeter
  const southY = +h - MARGIN - maxUnitDepth / 2;  // Positioned at south perimeter

  // Verify units stay in bounds and don't overlap corridor
  const northBottomEdge = northY + maxUnitDepth / 2;  // Interior edge
  const southTopEdge = southY - maxUnitDepth / 2;     // Interior edge

  // Verify units don't overlap corridor
  if (northBottomEdge > -Wc / 2 - GAP) {
    console.warn(`North units may overlap corridor. Interior edge: ${northBottomEdge}, Corridor: ${-Wc/2}`);
  }
  if (southTopEdge < Wc / 2 + GAP) {
    console.warn(`South units may overlap corridor. Interior edge: ${southTopEdge}, Corridor: ${Wc/2}`);
  }

  // Calculate X range for units (avoid core zone in center)
  const xStart = -h + MARGIN;
  const xEnd = h - MARGIN;
  const coreStart = -CORE_ZONE / 2;
  const coreEnd = CORE_ZONE / 2;

  // Units per side: left zone + right zone (excluding core)
  const leftZoneWidth = coreStart - xStart - MARGIN;
  const rightZoneWidth = xEnd - coreEnd - MARGIN;
  const unitsLeftPerSide = Math.floor(leftZoneWidth / (avgWidth + UNIT_GAP));
  const unitsRightPerSide = Math.floor(rightZoneWidth / (avgWidth + UNIT_GAP));
  const maxUnitsPerFloor = (unitsLeftPerSide + unitsRightPerSide) * 2;

  // Track X positions for each zone and side
  let xNorthLeft = xStart;
  let xNorthRight = coreEnd + MARGIN;
  let xSouthLeft = xStart;
  let xSouthRight = coreEnd + MARGIN;

  let unitIndex = 0;
  let unitsPlaced = 0;

  for (const allocation of unitAllocation) {
    const unitType = allocation.unitType;
    const countOnFloor = allocation.count;

    for (let i = 0; i < countOnFloor && unitsPlaced < maxUnitsPerFloor; i++) {
      const unitWidth = unitType.width_ft || 25;
      const unitDepth = Math.min(unitType.depth_ft || 28, maxUnitDepth);

      // Recalculate Y for this specific unit depth
      // Position at PERIMETER for exterior windows
      const thisNorthY = -h + MARGIN + unitDepth / 2;  // North perimeter (exterior windows face north)
      const thisSouthY = +h - MARGIN - unitDepth / 2;  // South perimeter (exterior windows face south)

      // Alternate: even units north, odd units south
      const goNorth = unitIndex % 2 === 0;
      let placed = false;

      if (goNorth) {
        // Try north left zone first
        if (xNorthLeft + unitWidth <= coreStart - MARGIN) {
          spaces.push(createSpace(
            `unit_${unitType.type}_${unitIndex}_f${floorIdx}`,
            'DWELLING_UNIT',
            unitType.name || `${unitType.type}`,
            floorIdx,
            xNorthLeft + unitWidth / 2,
            thisNorthY,
            unitWidth,
            unitDepth,
            false
          ));
          xNorthLeft += unitWidth + UNIT_GAP;
          placed = true;
        }
        // Try north right zone
        else if (xNorthRight + unitWidth <= xEnd) {
          spaces.push(createSpace(
            `unit_${unitType.type}_${unitIndex}_f${floorIdx}`,
            'DWELLING_UNIT',
            unitType.name || `${unitType.type}`,
            floorIdx,
            xNorthRight + unitWidth / 2,
            thisNorthY,
            unitWidth,
            unitDepth,
            false
          ));
          xNorthRight += unitWidth + UNIT_GAP;
          placed = true;
        }
      } else {
        // Try south left zone first
        if (xSouthLeft + unitWidth <= coreStart - MARGIN) {
          spaces.push(createSpace(
            `unit_${unitType.type}_${unitIndex}_f${floorIdx}`,
            'DWELLING_UNIT',
            unitType.name || `${unitType.type}`,
            floorIdx,
            xSouthLeft + unitWidth / 2,
            thisSouthY,
            unitWidth,
            unitDepth,
            false
          ));
          xSouthLeft += unitWidth + UNIT_GAP;
          placed = true;
        }
        // Try south right zone
        else if (xSouthRight + unitWidth <= xEnd) {
          spaces.push(createSpace(
            `unit_${unitType.type}_${unitIndex}_f${floorIdx}`,
            'DWELLING_UNIT',
            unitType.name || `${unitType.type}`,
            floorIdx,
            xSouthRight + unitWidth / 2,
            thisSouthY,
            unitWidth,
            unitDepth,
            false
          ));
          xSouthRight += unitWidth + UNIT_GAP;
          placed = true;
        }
      }

      // If preferred side full, try other side
      if (!placed) {
        // Try any available spot
        if (xSouthLeft + unitWidth <= coreStart - MARGIN) {
          spaces.push(createSpace(
            `unit_${unitType.type}_${unitIndex}_f${floorIdx}`,
            'DWELLING_UNIT',
            unitType.name || `${unitType.type}`,
            floorIdx,
            xSouthLeft + unitWidth / 2,
            thisSouthY,
            unitWidth,
            unitDepth,
            false
          ));
          xSouthLeft += unitWidth + UNIT_GAP;
          placed = true;
        } else if (xSouthRight + unitWidth <= xEnd) {
          spaces.push(createSpace(
            `unit_${unitType.type}_${unitIndex}_f${floorIdx}`,
            'DWELLING_UNIT',
            unitType.name || `${unitType.type}`,
            floorIdx,
            xSouthRight + unitWidth / 2,
            thisSouthY,
            unitWidth,
            unitDepth,
            false
          ));
          xSouthRight += unitWidth + UNIT_GAP;
          placed = true;
        } else if (xNorthLeft + unitWidth <= coreStart - MARGIN) {
          spaces.push(createSpace(
            `unit_${unitType.type}_${unitIndex}_f${floorIdx}`,
            'DWELLING_UNIT',
            unitType.name || `${unitType.type}`,
            floorIdx,
            xNorthLeft + unitWidth / 2,
            thisNorthY,
            unitWidth,
            unitDepth,
            false
          ));
          xNorthLeft += unitWidth + UNIT_GAP;
          placed = true;
        } else if (xNorthRight + unitWidth <= xEnd) {
          spaces.push(createSpace(
            `unit_${unitType.type}_${unitIndex}_f${floorIdx}`,
            'DWELLING_UNIT',
            unitType.name || `${unitType.type}`,
            floorIdx,
            xNorthRight + unitWidth / 2,
            thisNorthY,
            unitWidth,
            unitDepth,
            false
          ));
          xNorthRight += unitWidth + UNIT_GAP;
          placed = true;
        }
      }

      if (placed) {
        unitIndex++;
        unitsPlaced++;
      }
    }
  }

  // Support spaces - place at ends of corridor
  spaces.push(createSpace(
    `laundry_f${floorIdx}`,
    'SUPPORT',
    'Laundry',
    floorIdx,
    h - MARGIN - 7.5,  // Near right edge
    0,
    15,
    12,
    false
  ));

  spaces.push(createSpace(
    `trash_f${floorIdx}`,
    'SUPPORT',
    'Trash',
    floorIdx,
    -h + MARGIN + 6,  // Near left edge
    0,
    12,
    10,
    false
  ));
}

/**
 * Distribute units evenly across residential floors
 */
function distributeUnitsToFloor(
  units: ExtractedBuildingData['dwelling_units'],
  floorNumber: number,
  totalFloors: number
): Array<{ unitType: ExtractedBuildingData['dwelling_units'][0]; count: number }> {
  const result: Array<{ unitType: ExtractedBuildingData['dwelling_units'][0]; count: number }> = [];

  for (const unit of units) {
    // Calculate how many of this unit type go on each floor
    const unitsPerFloor = Math.ceil(unit.count / totalFloors);
    const startingUnit = (floorNumber - 1) * unitsPerFloor;
    const endingUnit = Math.min(startingUnit + unitsPerFloor, unit.count);
    const countOnFloor = Math.max(0, endingUnit - startingUnit);

    if (countOnFloor > 0) {
      result.push({ unitType: unit, count: countOnFloor });
    }
  }

  return result;
}

/**
 * Legacy generation for backward compatibility
 * Also uses CENTER-ORIGIN coordinates
 */
function generateFromLegacyData(extracted: LegacyExtractedData): SolverResult {
  const props = extracted.properties || {};
  const constraints = extracted.constraints || {};
  const units = extracted.units || [];

  const lotArea = props.area_sf || 30000;
  const maxHeight = constraints.maximum_height_feet || 70;
  const totalUnits = props.total_units_proposed || units.reduce((sum, u) => sum + (u.count || 0), 0) || 100;

  const numFloors = Math.min(Math.floor(maxHeight / 10), 8);
  const floorPlateArea = lotArea * 0.6;
  const floorPlateSide = Math.sqrt(floorPlateArea);
  const halfSide = floorPlateSide / 2;

  const floors: FloorData[] = [];

  for (let i = -1; i < numFloors; i++) {
    const floorType = i < 0 ? 'PARKING_UNDERGROUND' : i === 0 ? 'GROUND' : 'RESIDENTIAL_TYPICAL';
    const spaces: SpaceData[] = [];

    // Add basic circulation at center
    spaces.push(createSpace(`elevator_f${i}`, 'CIRCULATION', 'Elevator', i,
      -5, 0, 10, 17, true));
    spaces.push(createSpace(`stair_f${i}`, 'CIRCULATION', 'Stair', i,
      10, 0, 12, 18, true));

    if (i < 0) {
      // Parking - centered layout
      for (let p = 0; p < 20; p++) {
        const row = Math.floor(p / 5);
        const col = p % 5;
        const x = -halfSide + 30 + col * 25;
        const y = -halfSide + 30 + row * 40;
        spaces.push(createSpace(`parking_${p}_f${i}`, 'PARKING', `Parking ${p + 1}`, i,
          x, y, 20, 35, false));
      }
    } else if (i === 0) {
      // Ground floor - centered layout
      spaces.push(createSpace(`lobby_f${i}`, 'CIRCULATION', 'Lobby', i,
        0, -halfSide + 25, 40, 30, false));
      spaces.push(createSpace(`retail_f${i}`, 'RETAIL', 'Retail', i,
        -halfSide + 40, 0, 50, 40, false));
    } else {
      // Residential - use calculated dimensions from area
      const unitsPerFloor = Math.ceil(totalUnits / (numFloors - 1));
      let xPos = -halfSide + 25;
      let northSide = true;

      for (const unit of units.slice(0, unitsPerFloor)) {
        const unitWidth = Math.sqrt((unit.area_sf || 700) * 1.2);
        const unitHeight = (unit.area_sf || 700) / unitWidth;
        const yPos = northSide ? -unitHeight / 2 - 5 : unitHeight / 2 + 5;

        spaces.push(createSpace(
          `unit_${unit.type}_f${i}`,
          'DWELLING_UNIT',
          `${unit.type}`,
          i, xPos + unitWidth / 2, yPos, unitWidth, unitHeight, false
        ));
        xPos += unitWidth + 5;
        if (xPos > halfSide - 25) {
          xPos = -halfSide + 25;
          northSide = !northSide;
        }
      }
    }

    // CENTER-ORIGIN boundary
    floors.push({
      floor_index: i,
      floor_type: floorType,
      boundary: [
        [-halfSide, -halfSide],
        [halfSide, -halfSide],
        [halfSide, halfSide],
        [-halfSide, halfSide],
      ],
      area_sf: floorPlateArea,
      spaces,
    });
  }

  const totalSpaces = floors.reduce((sum, f) => sum + f.spaces.length, 0);

  return {
    success: true,
    obstruction: 0,
    iterations: 1,
    message: 'Generated from legacy extraction data',
    violations: [],
    metrics: {
      placement_rate: '100.0%',
      avg_membership: '1.00',
      total_spaces: totalSpaces,
      placed_spaces: totalSpaces,
    },
    building: {
      floors,
      stalks: [],
      metrics: {
        total_floors: floors.length,
        total_spaces: totalSpaces,
        cohomology_obstruction: 0,
      },
    },
  };
}

function createSpace(
  id: string,
  type: string,
  name: string,
  floorIndex: number,
  x: number,
  y: number,
  width: number,
  height: number,
  isVertical: boolean
): SpaceData {
  const area = width * height;
  return {
    id,
    type,
    name,
    floor_index: floorIndex,
    geometry: {
      x,
      y,
      width,
      height,
      rotation: 0,
    },
    target_area_sf: area,
    actual_area_sf: area,
    membership: 1.0,
    area_deviation: '+0.0%',
    is_vertical: isVertical,
  };
}
