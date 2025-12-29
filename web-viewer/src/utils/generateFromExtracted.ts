/**
 * Generate solver-like result from extracted PDF data
 * Uses actual unit dimensions (width_ft, depth_ft) for accurate floor plans
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
 */
function generateFromBuildingData(data: ExtractedBuildingData): SolverResult {
  const building = data.building;
  const units = data.dwelling_units || [];
  const circulation = data.circulation;
  const parking = data.parking;

  // Calculate floor plate dimensions
  const floorPlateArea = building.floor_plate_sf || 19000;
  // Assume roughly 1.5:1 aspect ratio for realistic floor plate
  const floorPlateWidth = Math.sqrt(floorPlateArea * 1.5);
  const floorPlateDepth = floorPlateArea / floorPlateWidth;

  const numFloorsAbove = building.stories_above_grade || 7;
  const numFloorsBelow = building.stories_below_grade || 1;
  const totalFloors = building.stories_total || numFloorsAbove + numFloorsBelow;

  // Calculate units per floor for residential floors
  const totalUnits = units.reduce((sum, u) => sum + u.count, 0);
  const residentialFloors = numFloorsAbove - 1; // Excluding ground floor
  const unitsPerFloor = Math.ceil(totalUnits / Math.max(residentialFloors, 1));

  // Circulation dimensions
  const corridorWidth = circulation?.corridor_width_ft || 6;
  const elevatorSize = Math.sqrt(circulation?.elevators?.passenger?.sf_per_floor || 136);
  const stairSize = Math.sqrt(circulation?.stairs?.sf_per_floor || 188);
  const numElevators = circulation?.elevators?.passenger?.count || 2;
  const numStairs = circulation?.stairs?.count || 2;

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
    const coreX = floorPlateWidth / 2;
    const coreY = floorPlateDepth / 2;

    // Elevators
    for (let e = 0; e < numElevators; e++) {
      spaces.push(createSpace(
        `elevator_${e + 1}_f${floorIdx}`,
        'CIRCULATION',
        `Elevator ${e + 1}`,
        floorIdx,
        coreX - elevatorSize - (e * elevatorSize * 1.2),
        coreY,
        elevatorSize,
        elevatorSize,
        true
      ));
    }

    // Stairs
    for (let s = 0; s < numStairs; s++) {
      spaces.push(createSpace(
        `stair_${s + 1}_f${floorIdx}`,
        'CIRCULATION',
        `Stair ${s + 1}`,
        floorIdx,
        coreX + elevatorSize * 1.5 + (s * stairSize * 1.5),
        coreY,
        stairSize,
        stairSize * 1.5,
        true
      ));
    }

    if (floorIdx < 0) {
      // Parking floor - generate parking spaces
      generateParkingFloor(spaces, floorIdx, floorPlateWidth, floorPlateDepth, parking);
    } else if (floorIdx === 0) {
      // Ground floor - lobby, retail, support spaces
      generateGroundFloor(spaces, floorIdx, floorPlateWidth, floorPlateDepth, data);
    } else {
      // Residential floors - use actual unit dimensions
      generateResidentialFloor(
        spaces,
        floorIdx,
        floorPlateWidth,
        floorPlateDepth,
        units,
        corridorWidth,
        unitsPerFloor,
        residentialFloors
      );
    }

    floors.push({
      floor_index: floorIdx,
      floor_type: floorType,
      boundary: [
        [0, 0],
        [floorPlateWidth, 0],
        [floorPlateWidth, floorPlateDepth],
        [0, floorPlateDepth],
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
          position: { x: floorPlateWidth / 2 - elevatorSize, y: floorPlateDepth / 2 },
        },
        {
          id: 'stair_stalk',
          type: 'stair',
          floor_range: Array.from({ length: totalFloors }, (_, i) => i - numFloorsBelow),
          position: { x: floorPlateWidth / 2 + elevatorSize * 1.5, y: floorPlateDepth / 2 },
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
 */
function generateParkingFloor(
  spaces: SpaceData[],
  floorIdx: number,
  width: number,
  depth: number,
  parking: ExtractedBuildingData['parking']
): void {
  const totalStalls = parking?.underground_stalls || 35;
  const stallWidth = 9; // Standard parking stall width
  const stallDepth = 18; // Standard parking stall depth
  const aisleWidth = 24; // Drive aisle width

  // Create parking bay layout
  const stallsPerRow = Math.floor((width - 40) / stallWidth);
  const numRows = Math.ceil(totalStalls / stallsPerRow);

  let stallCount = 0;
  for (let row = 0; row < numRows && stallCount < totalStalls; row++) {
    const yPos = 20 + row * (stallDepth * 2 + aisleWidth);

    for (let col = 0; col < stallsPerRow && stallCount < totalStalls; col++) {
      const xPos = 20 + col * stallWidth;

      spaces.push(createSpace(
        `parking_${stallCount + 1}_f${floorIdx}`,
        'PARKING',
        `Parking ${stallCount + 1}`,
        floorIdx,
        xPos + stallWidth / 2,
        yPos + stallDepth / 2,
        stallWidth,
        stallDepth,
        false
      ));
      stallCount++;
    }
  }

  // Add drive aisle
  spaces.push(createSpace(
    `drive_aisle_f${floorIdx}`,
    'CIRCULATION',
    'Drive Aisle',
    floorIdx,
    width / 2,
    depth / 2,
    width - 40,
    aisleWidth,
    false
  ));
}

/**
 * Generate ground floor with lobby, retail, and support spaces
 */
function generateGroundFloor(
  spaces: SpaceData[],
  floorIdx: number,
  width: number,
  depth: number,
  data: ExtractedBuildingData
): void {
  const support = data.support || [];
  const amenities = data.amenities_indoor || [];

  // Lobby - central entrance
  const lobbyArea = support.find(s => s.name.toLowerCase().includes('lobby'))?.area_sf || 500;
  const lobbyWidth = Math.sqrt(lobbyArea * 1.5);
  const lobbyDepth = lobbyArea / lobbyWidth;

  spaces.push(createSpace(
    `lobby_f${floorIdx}`,
    'CIRCULATION',
    'Entry Lobby',
    floorIdx,
    width / 2,
    30,
    lobbyWidth,
    lobbyDepth,
    false
  ));

  // Mail room
  const mailRoom = support.find(s => s.name.toLowerCase().includes('mail'));
  if (mailRoom) {
    spaces.push(createSpace(
      `mail_f${floorIdx}`,
      'SUPPORT',
      'Mail Room',
      floorIdx,
      width / 2 - 40,
      30,
      15,
      15,
      false
    ));
  }

  // Retail spaces on ground floor edges
  let xOffset = 30;
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

  for (const retail of retailSpaces) {
    const retailWidth = Math.sqrt((retail.area_sf || 1000) * 0.8);
    const retailDepth = (retail.area_sf || 1000) / retailWidth;

    spaces.push(createSpace(
      `retail_${retail.name.replace(/\s+/g, '_').toLowerCase()}_f${floorIdx}`,
      'RETAIL',
      retail.name,
      floorIdx,
      xOffset + retailWidth / 2,
      depth / 2,
      retailWidth,
      retailDepth,
      false
    ));
    xOffset += retailWidth + 10;
  }

  // Leasing office
  spaces.push(createSpace(
    `leasing_f${floorIdx}`,
    'SUPPORT',
    'Leasing Office',
    floorIdx,
    width - 50,
    30,
    20,
    15,
    false
  ));

  // Bicycle room
  const bikeRoom = support.find(s => s.name.toLowerCase().includes('bicycle'));
  if (bikeRoom) {
    spaces.push(createSpace(
      `bicycle_f${floorIdx}`,
      'SUPPORT',
      'Bicycle Room',
      floorIdx,
      width - 60,
      depth - 40,
      40,
      30,
      false
    ));
  }
}

/**
 * Generate residential floor using ACTUAL unit dimensions from PDF
 */
function generateResidentialFloor(
  spaces: SpaceData[],
  floorIdx: number,
  floorWidth: number,
  floorDepth: number,
  units: ExtractedBuildingData['dwelling_units'],
  corridorWidth: number,
  _unitsPerFloor: number,
  totalResidentialFloors: number
): void {
  // Create a double-loaded corridor layout
  // Units on both sides of a central corridor

  const corridorY = floorDepth / 2;
  const margin = 5; // Edge margin

  // Add corridor
  spaces.push(createSpace(
    `corridor_f${floorIdx}`,
    'CIRCULATION',
    'Corridor',
    floorIdx,
    floorWidth / 2,
    corridorY,
    floorWidth - 60, // Leave space for stairs at ends
    corridorWidth,
    false
  ));

  // Distribute units evenly across floors
  // Calculate how many of each unit type go on this floor
  const floorNumber = floorIdx; // 1-indexed floor number for residential
  const unitAllocation = distributeUnitsToFloor(units, floorNumber, totalResidentialFloors);

  // Place units on north side of corridor (top)
  let xPosNorth = margin + 30; // Start after stair
  const northY = corridorY - corridorWidth / 2 - 5; // Offset from corridor

  // Place units on south side of corridor (bottom)
  let xPosSouth = margin + 30;
  const southY = corridorY + corridorWidth / 2 + 5;

  let unitIndex = 0;
  let northSide = true; // Alternate sides

  for (const allocation of unitAllocation) {
    const unitType = allocation.unitType;
    const countOnFloor = allocation.count;

    for (let i = 0; i < countOnFloor; i++) {
      // Use ACTUAL dimensions from extracted PDF data
      const unitWidth = unitType.width_ft || 25;
      const unitDepth = unitType.depth_ft || 30;

      if (northSide) {
        // Check if unit fits on north side
        if (xPosNorth + unitWidth > floorWidth - margin - 30) {
          northSide = false;
        } else {
          spaces.push(createSpace(
            `unit_${unitType.type}_${unitIndex}_f${floorIdx}`,
            'DWELLING_UNIT',
            unitType.name || `${unitType.type} Unit`,
            floorIdx,
            xPosNorth + unitWidth / 2,
            northY - unitDepth / 2,
            unitWidth,
            unitDepth,
            false
          ));
          xPosNorth += unitWidth + 1; // 1ft gap between units
          unitIndex++;
          continue;
        }
      }

      // Place on south side
      if (xPosSouth + unitWidth <= floorWidth - margin - 30) {
        spaces.push(createSpace(
          `unit_${unitType.type}_${unitIndex}_f${floorIdx}`,
          'DWELLING_UNIT',
          unitType.name || `${unitType.type} Unit`,
          floorIdx,
          xPosSouth + unitWidth / 2,
          southY + unitDepth / 2,
          unitWidth,
          unitDepth,
          false
        ));
        xPosSouth += unitWidth + 1;
        unitIndex++;
      }
    }
  }

  // Add common laundry if typical floor
  spaces.push(createSpace(
    `laundry_f${floorIdx}`,
    'SUPPORT',
    'Laundry',
    floorIdx,
    floorWidth - 35,
    corridorY,
    15,
    20,
    false
  ));

  // Add trash room
  spaces.push(createSpace(
    `trash_f${floorIdx}`,
    'SUPPORT',
    'Trash Room',
    floorIdx,
    35,
    corridorY,
    12,
    15,
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

  const floors: FloorData[] = [];

  for (let i = -1; i < numFloors; i++) {
    const floorType = i < 0 ? 'PARKING_UNDERGROUND' : i === 0 ? 'GROUND' : 'RESIDENTIAL_TYPICAL';
    const spaces: SpaceData[] = [];

    // Add basic circulation
    spaces.push(createSpace(`elevator_f${i}`, 'CIRCULATION', 'Elevator', i,
      floorPlateSide / 2, floorPlateSide / 2, 10, 10, true));
    spaces.push(createSpace(`stair_f${i}`, 'CIRCULATION', 'Stair', i,
      floorPlateSide / 2 + 20, floorPlateSide / 2, 12, 18, true));

    if (i < 0) {
      // Parking
      for (let p = 0; p < 20; p++) {
        const row = Math.floor(p / 5);
        const col = p % 5;
        spaces.push(createSpace(`parking_${p}_f${i}`, 'PARKING', `Parking ${p + 1}`, i,
          20 + col * 25, 20 + row * 40, 20, 35, false));
      }
    } else if (i === 0) {
      // Ground floor
      spaces.push(createSpace(`lobby_f${i}`, 'CIRCULATION', 'Lobby', i,
        floorPlateSide / 2, 25, 40, 30, false));
      spaces.push(createSpace(`retail_f${i}`, 'RETAIL', 'Retail', i,
        30, floorPlateSide / 2, 50, 40, false));
    } else {
      // Residential - use calculated dimensions from area
      const unitsPerFloor = Math.ceil(totalUnits / (numFloors - 1));
      let xPos = 15, yPos = 15;

      for (const unit of units.slice(0, unitsPerFloor)) {
        const unitWidth = Math.sqrt((unit.area_sf || 700) * 1.2);
        const unitHeight = (unit.area_sf || 700) / unitWidth;

        spaces.push(createSpace(
          `unit_${unit.type}_f${i}`,
          'DWELLING_UNIT',
          `${unit.type}`,
          i, xPos + unitWidth / 2, yPos + unitHeight / 2, unitWidth, unitHeight, false
        ));
        xPos += unitWidth + 5;
        if (xPos > floorPlateSide - 20) {
          xPos = 15;
          yPos += unitHeight + 5;
        }
      }
    }

    floors.push({
      floor_index: i,
      floor_type: floorType,
      boundary: [[0, 0], [floorPlateSide, 0], [floorPlateSide, floorPlateSide], [0, floorPlateSide]],
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
