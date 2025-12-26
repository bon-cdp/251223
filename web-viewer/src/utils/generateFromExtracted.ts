/**
 * Generate solver-like result from extracted PDF data
 * Bridges Henry's extraction with Dev's visualization
 */

import { SolverResult, FloorData, SpaceData, Geometry } from '../types/solverOutput';

interface ExtractedData {
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
}

export function generateSolverResultFromExtracted(extracted: ExtractedData): SolverResult {
  const props = extracted.properties || {};
  const constraints = extracted.constraints || {};
  const units = extracted.units || [];

  // Calculate building parameters
  const lotArea = props.area_sf || 30000;
  const far = props.floor_area_ratio || 4.0;
  const maxHeight = constraints.maximum_height_feet || 70;
  const totalUnits = props.total_units_proposed || units.reduce((sum, u) => sum + (u.count || 0), 0) || 100;

  // Estimate floors (10ft per floor)
  const numFloors = Math.min(Math.floor(maxHeight / 10), 8);
  const floorPlateArea = Math.sqrt(lotArea) * 0.8; // 80% lot coverage
  const floorPlateSide = Math.sqrt(floorPlateArea);

  // Generate floors
  const floors: FloorData[] = [];

  for (let i = -1; i < numFloors; i++) {
    const floorType = i < 0 ? 'PARKING_UNDERGROUND' : i === 0 ? 'GROUND' : 'RESIDENTIAL_TYPICAL';
    const spaces: SpaceData[] = [];

    // Add circulation (elevator, stairs)
    const elevatorSize = 8;
    const stairSize = 12;

    spaces.push(createSpace(
      `elevator_1_f${i}`,
      'CIRCULATION',
      'Elevator 1',
      i,
      floorPlateSide / 2 - elevatorSize,
      floorPlateSide / 2,
      elevatorSize,
      elevatorSize,
      true
    ));

    spaces.push(createSpace(
      `stair_1_f${i}`,
      'CIRCULATION',
      'Stair 1',
      i,
      floorPlateSide / 2 + stairSize,
      floorPlateSide / 2,
      stairSize,
      stairSize * 1.5,
      true
    ));

    if (i < 0) {
      // Parking floor
      const parkingSpaces = Math.floor(floorPlateArea / 350); // ~350 SF per space
      for (let p = 0; p < Math.min(parkingSpaces, 20); p++) {
        const row = Math.floor(p / 5);
        const col = p % 5;
        spaces.push(createSpace(
          `parking_${p}_f${i}`,
          'PARKING',
          `Parking ${p + 1}`,
          i,
          20 + col * 25,
          20 + row * 40,
          20,
          35,
          false
        ));
      }
    } else if (i === 0) {
      // Ground floor - lobby, retail
      spaces.push(createSpace(
        `lobby_f${i}`,
        'CIRCULATION',
        'Lobby',
        i,
        floorPlateSide / 2,
        20,
        40,
        30,
        false
      ));

      spaces.push(createSpace(
        `retail_1_f${i}`,
        'RETAIL',
        'Retail Space 1',
        i,
        30,
        floorPlateSide / 2,
        50,
        40,
        false
      ));

      spaces.push(createSpace(
        `retail_2_f${i}`,
        'RETAIL',
        'Retail Space 2',
        i,
        floorPlateSide - 30,
        floorPlateSide / 2,
        50,
        40,
        false
      ));
    } else {
      // Residential floors
      const unitsPerFloor = Math.ceil(totalUnits / (numFloors - 1));
      const unitTypes = units.length > 0 ? units : [
        { type: 'Studio', count: 4, area_sf: 500 },
        { type: '1BR', count: 4, area_sf: 750 },
        { type: '2BR', count: 2, area_sf: 1000 },
      ];

      let unitIndex = 0;
      let xPos = 15;
      let yPos = 15;
      const maxX = floorPlateSide - 15;

      for (const unitType of unitTypes) {
        const unitsOfType = Math.ceil(unitType.count / (numFloors - 1));
        const unitWidth = Math.sqrt(unitType.area_sf * 1.2);
        const unitHeight = unitType.area_sf / unitWidth;

        for (let u = 0; u < unitsOfType && unitIndex < unitsPerFloor; u++) {
          if (xPos + unitWidth > maxX) {
            xPos = 15;
            yPos += unitHeight + 5;
          }

          spaces.push(createSpace(
            `unit_${unitType.type}_${u}_f${i}`,
            'DWELLING_UNIT',
            `${unitType.type} Unit ${u + 1}`,
            i,
            xPos + unitWidth / 2,
            yPos + unitHeight / 2,
            unitWidth,
            unitHeight,
            false
          ));

          xPos += unitWidth + 5;
          unitIndex++;
        }
      }
    }

    floors.push({
      floor_index: i,
      floor_type: floorType,
      boundary: [
        [0, 0],
        [floorPlateSide, 0],
        [floorPlateSide, floorPlateSide],
        [0, floorPlateSide],
      ],
      area_sf: floorPlateArea,
      spaces,
    });
  }

  const totalSpaces = floors.reduce((sum, f) => sum + f.spaces.length, 0);
  const placedSpaces = totalSpaces; // All spaces are "placed" in our generation

  return {
    success: true,
    obstruction: 0,
    iterations: 1,
    message: 'Generated from PDF extraction',
    violations: [],
    metrics: {
      placement_rate: '100.0%',
      avg_membership: '1.00',
      total_spaces: totalSpaces,
      placed_spaces: placedSpaces,
    },
    building: {
      floors,
      stalks: [
        {
          id: 'elevator_stalk_1',
          type: 'elevator',
          floor_range: Array.from({ length: numFloors + 1 }, (_, i) => i - 1),
          position: { x: floorPlateSide / 2 - 8, y: floorPlateSide / 2 },
        },
        {
          id: 'stair_stalk_1',
          type: 'stair',
          floor_range: Array.from({ length: numFloors + 1 }, (_, i) => i - 1),
          position: { x: floorPlateSide / 2 + 12, y: floorPlateSide / 2 },
        },
      ],
      metrics: {
        total_floors: numFloors + 1,
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
