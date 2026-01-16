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
    [key: string]: string | number | boolean | undefined;
  };
  constraints?: {
    zoning?: string;
    maximum_height_feet?: number;
    setbacks?: { front_feet?: number; rear_feet?: number; side_feet?: number };
    parking_requirement_per_unit?: number;
    [key: string]: string | number | boolean | { front_feet?: number; rear_feet?: number; side_feet?: number } | undefined;
  };
  units?: Array<{ type: string; count: number; area_sf: number }>;
  metadata?: Record<string, unknown>;
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
  // Note: numStairs used in core calculations below
  const stairCount = Math.min(circulation?.stairs?.count || 2, 2);

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
    const coreWidth = STAIR_WIDTH + (numElevators * (ELEVATOR_WIDTH + 1)) + STAIR_WIDTH + 4 + (stairCount - 2) * STAIR_WIDTH;

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
 * Generate parking floor with proper stall layout and support rooms
 * Based on reference screenshot - perpendicular stalls with central aisle
 * Uses CENTER-ORIGIN coordinates
 */
function generateParkingFloor(
  spaces: SpaceData[],
  floorIdx: number,
  halfSide: number,
  parking: ExtractedBuildingData['parking']
): void {
  const totalStalls = parking?.underground_stalls || 45;
  const h = halfSide;

  // Standard dimensions
  const STALL_WIDTH = 9;    // 9' wide
  const STALL_DEPTH = 18;   // 18' deep
  const AISLE_WIDTH = 24;   // 24' drive aisle
  const MARGIN = 5;

  // Support room dimensions
  const SUPPORT_DEPTH = 15;

  // Layout: Drive aisle runs East-West through center
  // Parking stalls on North and South sides
  // Support rooms along East edge

  // Add support rooms on EAST side (like reference)
  let supportY = -h + MARGIN;

  // Storage room
  spaces.push(createSpace(
    `storage_f${floorIdx}`,
    'SUPPORT',
    'Storage',
    floorIdx,
    h - MARGIN - 15,
    supportY + 12,
    20,
    20,
    false
  ));
  supportY += 25;

  // Trash/Recycle room
  spaces.push(createSpace(
    `trash_recycle_f${floorIdx}`,
    'SUPPORT',
    'Trash/Recycle',
    floorIdx,
    h - MARGIN - 12,
    supportY + 10,
    18,
    16,
    false
  ));
  supportY += 20;

  // Fan Room
  spaces.push(createSpace(
    `fan_room_f${floorIdx}`,
    'SUPPORT',
    'Fan Room',
    floorIdx,
    h - MARGIN - 12,
    supportY + 10,
    18,
    16,
    false
  ));
  supportY += 20;

  // Fire Pump Room
  spaces.push(createSpace(
    `fire_pump_f${floorIdx}`,
    'SUPPORT',
    'Fire Pump',
    floorIdx,
    h - MARGIN - 10,
    h - MARGIN - 10,
    15,
    15,
    false
  ));

  // Domestic Water
  spaces.push(createSpace(
    `domestic_water_f${floorIdx}`,
    'SUPPORT',
    'Domestic Water',
    floorIdx,
    h - MARGIN - 10,
    h - MARGIN - 28,
    15,
    15,
    false
  ));

  // MPOE (Main Point of Entry) - telecom
  spaces.push(createSpace(
    `mpoe_f${floorIdx}`,
    'SUPPORT',
    'MPOE',
    floorIdx,
    h - MARGIN - 8,
    -h + MARGIN + 40,
    12,
    10,
    false
  ));

  // Add drive aisle (runs East-West through center)
  spaces.push(createSpace(
    `drive_aisle_f${floorIdx}`,
    'CIRCULATION',
    'Drive Aisle',
    floorIdx,
    -10,  // Offset slightly west to make room for support
    0,
    2 * h - 60,  // Leave room for support rooms
    AISLE_WIDTH,
    false
  ));

  // Calculate parking area (west of support rooms)
  const parkingAreaWidth = 2 * h - 60;  // Leave room for support rooms
  const parkingStartX = -h + MARGIN;

  // Calculate stalls per row
  const stallsPerRow = Math.floor(parkingAreaWidth / STALL_WIDTH);

  let stallCount = 0;

  // NORTH side parking (above drive aisle)
  const northY = -AISLE_WIDTH / 2 - STALL_DEPTH / 2;
  for (let col = 0; col < stallsPerRow && stallCount < totalStalls; col++) {
    const x = parkingStartX + col * STALL_WIDTH + STALL_WIDTH / 2;
    spaces.push(createSpace(
      `parking_${stallCount + 1}_f${floorIdx}`,
      'PARKING',
      `P${stallCount + 1}`,
      floorIdx,
      x,
      northY,
      STALL_WIDTH - 0.5,
      STALL_DEPTH,
      false
    ));
    stallCount++;
  }

  // SOUTH side parking (below drive aisle)
  const southY = AISLE_WIDTH / 2 + STALL_DEPTH / 2;
  for (let col = 0; col < stallsPerRow && stallCount < totalStalls; col++) {
    const x = parkingStartX + col * STALL_WIDTH + STALL_WIDTH / 2;
    spaces.push(createSpace(
      `parking_${stallCount + 1}_f${floorIdx}`,
      'PARKING',
      `P${stallCount + 1}`,
      floorIdx,
      x,
      southY,
      STALL_WIDTH - 0.5,
      STALL_DEPTH,
      false
    ));
    stallCount++;
  }

  // If we need more stalls, add another row further out
  if (stallCount < totalStalls) {
    const northY2 = northY - STALL_DEPTH - 2;
    for (let col = 0; col < stallsPerRow && stallCount < totalStalls; col++) {
      const x = parkingStartX + col * STALL_WIDTH + STALL_WIDTH / 2;
      spaces.push(createSpace(
        `parking_${stallCount + 1}_f${floorIdx}`,
        'PARKING',
        `P${stallCount + 1}`,
        floorIdx,
        x,
        northY2,
        STALL_WIDTH - 0.5,
        STALL_DEPTH,
        false
      ));
      stallCount++;
    }
  }
}

/**
 * Generate ground floor with lobby, amenities, and support spaces
 * Layout based on reference screenshot - lobby at entrance, amenities around perimeter
 * Uses CENTER-ORIGIN coordinates
 */
function generateGroundFloor(
  spaces: SpaceData[],
  floorIdx: number,
  halfSide: number,
  data: ExtractedBuildingData
): void {
  const h = halfSide;
  const MARGIN = 2;

  // Main LOBBY - at south entrance (front of building)
  const LOBBY_WIDTH = 40;
  const LOBBY_DEPTH = 25;
  spaces.push(createSpace(
    `lobby_f${floorIdx}`,
    'CIRCULATION',
    'Lobby',
    floorIdx,
    0,
    h - MARGIN - LOBBY_DEPTH / 2,  // South edge (front entrance)
    LOBBY_WIDTH,
    LOBBY_DEPTH,
    false
  ));

  // Corridor from lobby to core
  spaces.push(createSpace(
    `corridor_main_f${floorIdx}`,
    'CIRCULATION',
    'Corridor',
    floorIdx,
    0,
    0,  // Center
    6,
    2 * h - LOBBY_DEPTH - 20,
    false
  ));

  // LEASING OFFICE - right of lobby
  spaces.push(createSpace(
    `leasing_f${floorIdx}`,
    'SUPPORT',
    'Leasing',
    floorIdx,
    LOBBY_WIDTH / 2 + 15,
    h - MARGIN - 15,
    25,
    20,
    false
  ));

  // MAIL/PACKAGE ROOM - left of lobby
  spaces.push(createSpace(
    `mail_f${floorIdx}`,
    'SUPPORT',
    'Mail/Package',
    floorIdx,
    -LOBBY_WIDTH / 2 - 12,
    h - MARGIN - 12,
    20,
    18,
    false
  ));

  // AMENITY LOUNGE - northwest corner
  spaces.push(createSpace(
    `lounge_f${floorIdx}`,
    'AMENITY',
    'Lounge',
    floorIdx,
    -h + MARGIN + 25,
    -h + MARGIN + 20,
    45,
    35,
    false
  ));

  // FITNESS CENTER - southwest corner
  spaces.push(createSpace(
    `fitness_f${floorIdx}`,
    'AMENITY',
    'Fitness',
    floorIdx,
    -h + MARGIN + 20,
    h - MARGIN - LOBBY_DEPTH - 20,
    35,
    30,
    false
  ));

  // RESTROOMS - near lobby
  spaces.push(createSpace(
    `restroom_m_f${floorIdx}`,
    'SUPPORT',
    'Restroom M',
    floorIdx,
    h - MARGIN - 12,
    h - MARGIN - 35,
    15,
    12,
    false
  ));

  spaces.push(createSpace(
    `restroom_f_f${floorIdx}`,
    'SUPPORT',
    'Restroom F',
    floorIdx,
    h - MARGIN - 12,
    h - MARGIN - 50,
    15,
    12,
    false
  ));

  // TRASH/UTILITY - east side near core
  spaces.push(createSpace(
    `trash_f${floorIdx}`,
    'SUPPORT',
    'Trash',
    floorIdx,
    h - MARGIN - 8,
    0,
    12,
    10,
    false
  ));

  // BIKE STORAGE - northeast area
  spaces.push(createSpace(
    `bike_storage_f${floorIdx}`,
    'SUPPORT',
    'Bike Storage',
    floorIdx,
    h - MARGIN - 25,
    -h + MARGIN + 25,
    40,
    35,
    false
  ));

  // Optional: Some ground floor units on north side (if building has them)
  // Add a few studios/1BRs facing north
  const groundUnits = data.dwelling_units?.filter(u => u.count > 0).slice(0, 2) || [];
  let unitX = -h + MARGIN + 50;  // Start after lounge

  for (let i = 0; i < 3 && unitX < h - 80; i++) {
    const unit = groundUnits[i % groundUnits.length];
    if (unit) {
      const unitWidth = unit.width_ft || 25;
      const unitDepth = unit.depth_ft || 28;
      spaces.push(createSpace(
        `unit_ground_${i}_f${floorIdx}`,
        'DWELLING_UNIT',
        `${unit.name || unit.type} A${i + 1}`,
        floorIdx,
        unitX + unitWidth / 2,
        -h + MARGIN + unitDepth / 2,
        unitWidth,
        unitDepth,
        false
      ));
      unitX += unitWidth + 1;
    }
  }
}

/**
 * Generate residential floor using CONTINUOUS PERIMETER PACKING
 *
 * LAYOUT (like Canoga reference):
 *   ┌──────────────────────────────────────────────────┐
 *   │ 2BR │ 1BR │ 1BR │ Studio │ 1BR │ 1BR │ 2BR      │ ← NORTH (6-7 units)
 *   ├─────┼─────────────────────────────────────┼──────┤
 *   │ 1BR │                                     │ 1BR  │
 *   ├─────┤      ┌─────────────────────┐        ├──────┤ ← EAST/WEST (3-4 each)
 *   │ 1BR │      │   TRASH  MECH      │        │ 1BR  │
 *   ├─────┤      │   ELEV ELEV STAIR  │        ├──────┤
 *   │ Stu │      │   STOR   ELEC      │        │ Stu  │
 *   ├─────┤      └─────────────────────┘        ├──────┤
 *   │ 1BR │                                     │ 1BR  │
 *   ├─────┼─────────────────────────────────────┼──────┤
 *   │ 2BR │ 1BR │ 1BR │ Studio │ 1BR │ 1BR │ 2BR      │ ← SOUTH (6-7 units)
 *   └──────────────────────────────────────────────────┘
 *
 * KEY: Every unit MUST touch exterior wall (windows). ~18-20 units per floor.
 */
function generateResidentialFloor(
  spaces: SpaceData[],
  floorIdx: number,
  halfSide: number,
  units: ExtractedBuildingData['dwelling_units'],
  _corridorWidth: number,
  _unitsPerFloor: number,
  totalResidentialFloors: number
): void {
  // Constants - MAXIMUM DENSITY PACKING
  const MARGIN = 2;           // Minimal margin from floor plate edge
  const UNIT_GAP = 0.5;       // Minimal gap between units
  const CORRIDOR_WIDTH = 5;   // Narrow corridor
  const CORE_SIZE = 35;       // Core is ~35' x 35' (elevators, stairs, support)

  const h = halfSide;         // Half of floor plate side

  // DYNAMIC UNIT DEPTH: Units extend from perimeter to corridor
  // Corridor hugs the core, so unit depth = (halfSide - margin) - (core/2 + corridor)
  const UNIT_DEPTH = Math.max(20, h - MARGIN - CORE_SIZE / 2 - CORRIDOR_WIDTH);

  // SKINNY UNITS for maximum packing
  // Studios: 12', 1BR: 14', 2BR: 18', 3BR: 22'
  const COMPACT_WIDTHS: Record<string, number> = {
    'studio': 12,
    '1br': 14,
    '2br': 18,
    '3br': 22,
  };

  // Calculate how many units fit on each side with skinny widths
  const avgWidth = 15;  // Average of compact widths
  const sideLength = 2 * h - 2 * MARGIN;
  const unitsPerLongSide = Math.floor(sideLength / (avgWidth + UNIT_GAP));
  const shortSideLength = sideLength - 2 * UNIT_DEPTH;
  const unitsPerShortSide = Math.floor(shortSideLength / (avgWidth + UNIT_GAP));

  // Total perimeter capacity
  const perimeterCapacity = 2 * unitsPerLongSide + 2 * unitsPerShortSide;

  // Calculate target - aim to fill perimeter completely
  const totalUnits = units.reduce((sum, u) => sum + u.count, 0);
  const targetUnitsPerFloor = Math.ceil(totalUnits / totalResidentialFloors);
  const unitsToPlace = Math.max(targetUnitsPerFloor, perimeterCapacity, 24);

  // Create unit queue with skinny units
  const unitQueue: Array<{ type: string; name: string; width: number; depth: number }> = [];
  let typeIdx = 0;
  for (let i = 0; i < unitsToPlace; i++) {
    const unitType = units[typeIdx % units.length];
    if (unitType) {
      const compactWidth = COMPACT_WIDTHS[unitType.type.toLowerCase()] || 14;
      unitQueue.push({
        type: unitType.type,
        name: unitType.name || unitType.type,
        width: compactWidth,
        depth: UNIT_DEPTH,
      });
    }
    typeIdx++;
  }

  // Place CORE elements in center (elevators, stairs already placed by caller)
  // Add support rooms around core

  // Trash room - left of core
  spaces.push(createSpace(
    `trash_f${floorIdx}`,
    'SUPPORT',
    'Trash',
    floorIdx,
    -20,
    0,
    12,
    10,
    false
  ));

  // Mech room - further left
  spaces.push(createSpace(
    `mech_f${floorIdx}`,
    'SUPPORT',
    'Mech',
    floorIdx,
    -35,
    0,
    10,
    12,
    false
  ));

  // Storage room - right of core
  spaces.push(createSpace(
    `stor_f${floorIdx}`,
    'SUPPORT',
    'Stor',
    floorIdx,
    20,
    0,
    12,
    10,
    false
  ));

  // Electrical room - further right
  spaces.push(createSpace(
    `elec_f${floorIdx}`,
    'SUPPORT',
    'Elec',
    floorIdx,
    35,
    0,
    10,
    12,
    false
  ));

  // ========================================
  // PLACE UNITS CONTINUOUSLY AROUND PERIMETER
  // All units touch exterior wall (windows)
  // ========================================

  let unitIndex = 0;

  // NORTH SIDE - units facing north (windows on north edge)
  // Unit exterior edge at: -h + MARGIN
  // Unit center Y: -h + MARGIN + UNIT_DEPTH/2
  const northY = -h + MARGIN + UNIT_DEPTH / 2;
  let northX = -h + MARGIN;

  while (unitIndex < unitQueue.length && northX + unitQueue[unitIndex].width <= h - MARGIN) {
    const unit = unitQueue[unitIndex];
    spaces.push(createSpace(
      `unit_${unit.type}_${unitIndex}_f${floorIdx}`,
      'DWELLING_UNIT',
      unit.name,
      floorIdx,
      northX + unit.width / 2,
      northY,
      unit.width,
      UNIT_DEPTH,
      false
    ));
    northX += unit.width + UNIT_GAP;
    unitIndex++;
  }

  // EAST SIDE - units facing east (windows on east edge)
  // Unit exterior edge at: h - MARGIN
  // Unit center X: h - MARGIN - UNIT_DEPTH/2
  // Start Y: right below north corner units (at -h + MARGIN + UNIT_DEPTH)
  const eastX = h - MARGIN - UNIT_DEPTH / 2;
  let eastY = -h + MARGIN + UNIT_DEPTH;  // Start right after north units

  while (unitIndex < unitQueue.length && eastY + unitQueue[unitIndex].width <= h - MARGIN - UNIT_DEPTH) {
    const unit = unitQueue[unitIndex];
    // East units are rotated 90° - width becomes height
    spaces.push(createSpace(
      `unit_${unit.type}_${unitIndex}_f${floorIdx}`,
      'DWELLING_UNIT',
      unit.name,
      floorIdx,
      eastX,
      eastY + unit.width / 2,
      UNIT_DEPTH,   // depth becomes width (facing east)
      unit.width,   // width becomes height
      false
    ));
    eastY += unit.width + UNIT_GAP;
    unitIndex++;
  }

  // SOUTH SIDE - units facing south (windows on south edge)
  // Unit exterior edge at: h - MARGIN
  // Unit center Y: h - MARGIN - UNIT_DEPTH/2
  // Start from right corner, go left
  const southY = h - MARGIN - UNIT_DEPTH / 2;
  let southX = h - MARGIN;

  while (unitIndex < unitQueue.length && southX - unitQueue[unitIndex].width >= -h + MARGIN) {
    const unit = unitQueue[unitIndex];
    southX -= unit.width;
    spaces.push(createSpace(
      `unit_${unit.type}_${unitIndex}_f${floorIdx}`,
      'DWELLING_UNIT',
      unit.name,
      floorIdx,
      southX + unit.width / 2,
      southY,
      unit.width,
      UNIT_DEPTH,
      false
    ));
    southX -= UNIT_GAP;
    unitIndex++;
  }

  // WEST SIDE - units facing west (windows on west edge)
  // Unit exterior edge at: -h + MARGIN
  // Unit center X: -h + MARGIN + UNIT_DEPTH/2
  // Start from bottom (above south units), go up
  const westX = -h + MARGIN + UNIT_DEPTH / 2;
  let westY = h - MARGIN - UNIT_DEPTH;  // Start right above south units

  while (unitIndex < unitQueue.length && westY - unitQueue[unitIndex].width >= -h + MARGIN + UNIT_DEPTH) {
    const unit = unitQueue[unitIndex];
    westY -= unit.width;
    // West units are rotated 90° - width becomes height
    spaces.push(createSpace(
      `unit_${unit.type}_${unitIndex}_f${floorIdx}`,
      'DWELLING_UNIT',
      unit.name,
      floorIdx,
      westX,
      westY + unit.width / 2,
      UNIT_DEPTH,   // depth becomes width (facing west)
      unit.width,   // width becomes height
      false
    ));
    westY -= UNIT_GAP;
    unitIndex++;
  }

  // ========================================
  // CORRIDOR - Tight ring around core
  // ========================================
  const corridorOuter = CORE_SIZE / 2 + CORRIDOR_WIDTH;

  // North corridor segment (horizontal)
  spaces.push(createSpace(
    `corridor_n_f${floorIdx}`,
    'CIRCULATION',
    'Corridor',
    floorIdx,
    0,
    -corridorOuter + CORRIDOR_WIDTH / 2,
    CORE_SIZE + 2 * CORRIDOR_WIDTH,
    CORRIDOR_WIDTH,
    false
  ));

  // South corridor segment (horizontal)
  spaces.push(createSpace(
    `corridor_s_f${floorIdx}`,
    'CIRCULATION',
    'Corridor',
    floorIdx,
    0,
    corridorOuter - CORRIDOR_WIDTH / 2,
    CORE_SIZE + 2 * CORRIDOR_WIDTH,
    CORRIDOR_WIDTH,
    false
  ));

  // East corridor segment (vertical)
  spaces.push(createSpace(
    `corridor_e_f${floorIdx}`,
    'CIRCULATION',
    'Corridor',
    floorIdx,
    corridorOuter - CORRIDOR_WIDTH / 2,
    0,
    CORRIDOR_WIDTH,
    CORE_SIZE,
    false
  ));

  // West corridor segment (vertical)
  spaces.push(createSpace(
    `corridor_w_f${floorIdx}`,
    'CIRCULATION',
    'Corridor',
    floorIdx,
    -corridorOuter + CORRIDOR_WIDTH / 2,
    0,
    CORRIDOR_WIDTH,
    CORE_SIZE,
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
