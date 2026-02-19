/**
 * Generate solver-like result from extracted PDF data
 * Uses actual unit dimensions (width_ft, depth_ft) for accurate floor plans
 *
 * IMPORTANT: Uses CENTER-ORIGIN coordinate system like the default sample data
 * Boundary runs from (-halfSide, -halfSide) to (halfSide, halfSide)
 * Origin (0,0) is at the center of the floor plate
 */

import { SolverResult, FloorData, SpaceData, PolygonGeometry } from '../types/solverOutput';
import { ExtractedBuildingData } from '../components/data/PdfUploader';
import {
  generateFloorBoundary,
  type Polygon,
  type Point,
} from './parcelGeometry';
import {
  pointInPolygon,
  getBoundingBox,
  calculatePolygonArea,
} from './polygon';

// ============================================
// COLLISION DETECTION HELPERS
// ============================================

interface BoundingBox {
  x: number;      // center x
  y: number;      // center y
  width: number;
  height: number;
}

/**
 * Check if two bounding boxes overlap
 */
function spacesOverlap(a: BoundingBox, b: BoundingBox, buffer: number = 0.5): boolean {
  const aLeft = a.x - a.width / 2 - buffer;
  const aRight = a.x + a.width / 2 + buffer;
  const aTop = a.y - a.height / 2 - buffer;
  const aBottom = a.y + a.height / 2 + buffer;

  const bLeft = b.x - b.width / 2 - buffer;
  const bRight = b.x + b.width / 2 + buffer;
  const bTop = b.y - b.height / 2 - buffer;
  const bBottom = b.y + b.height / 2 + buffer;

  return !(aRight < bLeft || aLeft > bRight || aBottom < bTop || aTop > bBottom);
}

/**
 * Check if a space overlaps with any existing space
 */
function hasOverlap(newSpace: BoundingBox, existingSpaces: BoundingBox[], buffer: number = 1.5): boolean {
  return existingSpaces.some(existing => spacesOverlap(newSpace, existing, buffer));
}

/**
 * Check if all 4 corners of a rectangle lie inside a polygon boundary.
 */
function rectInsidePolygon(rect: BoundingBox, polygon: Polygon): boolean {
  const hw = rect.width / 2;
  const hh = rect.height / 2;
  const corners: Point[] = [
    [rect.x - hw, rect.y - hh],
    [rect.x + hw, rect.y - hh],
    [rect.x + hw, rect.y + hh],
    [rect.x - hw, rect.y + hh],
  ];
  return corners.every(c => pointInPolygon(c, polygon));
}

/**
 * Find a non-overlapping position by trying offsets.
 * When a boundaryPolygon is provided, does a grid scan across the polygon BB
 * to find a position where the entire rect fits inside the polygon.
 */
function findNonOverlappingPosition(
  space: BoundingBox,
  existingSpaces: BoundingBox[],
  boundary: { minX: number; maxX: number; minY: number; maxY: number },
  boundaryPolygon?: Polygon
): BoundingBox | null {
  const fitsInBounds = (c: BoundingBox): boolean => {
    if (boundaryPolygon) return rectInsidePolygon(c, boundaryPolygon);
    return c.x - c.width / 2 >= boundary.minX &&
           c.x + c.width / 2 <= boundary.maxX &&
           c.y - c.height / 2 >= boundary.minY &&
           c.y + c.height / 2 <= boundary.maxY;
  };

  // Try original position first
  if (!hasOverlap(space, existingSpaces) && fitsInBounds(space)) return space;

  // For polygon boundaries, do a grid scan across the polygon BB
  if (boundaryPolygon) {
    const bb = getBoundingBox(boundaryPolygon);
    const stepX = Math.max(space.width / 2, 4);
    const stepY = Math.max(space.height / 2, 4);
    let bestCandidate: BoundingBox | null = null;
    let bestDist = Infinity;

    for (let gx = bb.minX + space.width / 2; gx <= bb.maxX - space.width / 2; gx += stepX) {
      for (let gy = bb.minY + space.height / 2; gy <= bb.maxY - space.height / 2; gy += stepY) {
        const candidate = { ...space, x: gx, y: gy };
        if (fitsInBounds(candidate) && !hasOverlap(candidate, existingSpaces)) {
          // Prefer candidate closest to the original requested position
          const dist = Math.hypot(gx - space.x, gy - space.y);
          if (dist < bestDist) {
            bestDist = dist;
            bestCandidate = candidate;
          }
        }
      }
    }
    return bestCandidate;
  }

  // For square boundaries, try offset positions
  const offsets = [
    { dx: space.width + 2, dy: 0 },
    { dx: -space.width - 2, dy: 0 },
    { dx: 0, dy: space.height + 2 },
    { dx: 0, dy: -space.height - 2 },
    { dx: space.width + 2, dy: space.height + 2 },
    { dx: -space.width - 2, dy: -space.height - 2 },
    { dx: space.width + 2, dy: -space.height - 2 },
    { dx: -space.width - 2, dy: space.height + 2 },
  ];

  for (const offset of offsets) {
    const candidate = { ...space, x: space.x + offset.dx, y: space.y + offset.dy };
    if (!hasOverlap(candidate, existingSpaces) && fitsInBounds(candidate)) {
      return candidate;
    }
  }
  return null;
}

/**
 * Safely place a space, checking for collisions
 */
function safelyPlaceSpace(
  spaces: SpaceData[],
  placedBounds: BoundingBox[],
  id: string,
  type: string,
  name: string,
  floorIndex: number,
  x: number,
  y: number,
  width: number,
  height: number,
  isVertical: boolean,
  boundary: { minX: number; maxX: number; minY: number; maxY: number },
  boundaryPolygon?: Polygon
): void {
  const newBounds: BoundingBox = { x, y, width, height };
  const safeBounds = findNonOverlappingPosition(newBounds, placedBounds, boundary, boundaryPolygon);

  if (safeBounds) {
    placedBounds.push(safeBounds);
    spaces.push(createSpace(id, type, name, floorIndex, safeBounds.x, safeBounds.y, safeBounds.width, safeBounds.height, isVertical));
  }
}

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
 * Supports irregular parcel shapes via fill-and-cut algorithm
 */
function generateFromBuildingData(data: ExtractedBuildingData): SolverResult {
  const building = data.building;
  const units = data.dwelling_units || [];
  const circulation = data.circulation;
  const parking = data.parking;

  const floorPlateArea = building.floor_plate_sf || 19000;

  // Generate boundary from real parcel shape (or fall back to square)
  const { polygon: boundaryPolygon, isIrregular } = generateFloorBoundary(
    data.project_id,
    floorPlateArea,
    3 // 3' inset for setback
  );

  // Derive halfSide for parking/ground floor placement.
  // For irregular polygons, use the short dimension of the bounding box
  // to prevent rooms from overflowing outside the polygon.
  const bb = getBoundingBox(boundaryPolygon);
  const halfSide = isIrregular
    ? Math.min(bb.width, bb.height) / 2
    : Math.max(bb.width, bb.height) / 2;

  const numFloorsAbove = building.stories_above_grade || 7;
  const numFloorsBelow = building.stories_below_grade || 1;
  const totalFloors = building.stories_total || numFloorsAbove + numFloorsBelow;

  // Calculate units per floor for residential floors
  const totalUnits = units.reduce((sum, u) => sum + u.count, 0);
  const residentialFloors = numFloorsAbove - 1; // Excluding ground floor
  const unitsPerFloor = Math.ceil(totalUnits / Math.max(residentialFloors, 1));

  // Circulation dimensions - use FIXED realistic sizes, not PDF values
  const corridorWidth = circulation?.corridor_width_ft || 6;
  const numElevators = Math.min(circulation?.elevators?.passenger?.count || 2, 3);
  const stairCount = Math.min(circulation?.stairs?.count || 2, 2);

  // Standard dimensions for circulation elements (industry standard)
  const ELEVATOR_WIDTH = 8;
  const ELEVATOR_DEPTH = 8;
  const STAIR_WIDTH = 10;
  const STAIR_DEPTH = 12;

  const floors: FloorData[] = [];

  // Core dimensions for non-irregular floors
  const COL_GAP = 1;
  const ROW_GAP = 1;
  const COL_WIDTH = Math.max(STAIR_WIDTH, ELEVATOR_WIDTH);
  const coreWidth = 2 * COL_WIDTH + COL_GAP;
  const elevatorsLeft = Math.ceil(numElevators / 2);
  const elevatorsRight = numElevators - elevatorsLeft;
  const coreHeight = STAIR_DEPTH + ROW_GAP + Math.max(elevatorsLeft, elevatorsRight) * (ELEVATOR_DEPTH + ROW_GAP);

  // For irregular parcels, generate floor 1 first to capture circulation positions,
  // then reuse those same positions on ground/underground floors for vertical alignment.
  let capturedCirculation: { id: string; type: string; name: string; x: number; y: number; w: number; h: number; isVert: boolean }[] = [];

  if (isIrregular) {
    // Generate a reference residential floor to capture circulation positions
    const refSpaces: SpaceData[] = [];
    generateResidentialFloorMCMC(
      refSpaces, 1, boundaryPolygon, units,
      residentialFloors, coreWidth, coreHeight,
      stairCount, numElevators
    );
    // Extract circulation and support positions
    for (const s of refSpaces) {
      if (s.type === 'CIRCULATION' || s.type === 'SUPPORT') {
        const g = s.geometry as { x: number; y: number; width: number; height: number; rotation: number };
        if ('x' in g) {
          capturedCirculation.push({
            id: s.id, type: s.type, name: s.name,
            x: g.x, y: g.y, w: g.width, h: g.height, isVert: s.is_vertical,
          });
        }
      }
    }
  }

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

    if (isIrregular && floorIdx > 0) {
      // Residential floors: MCMC handles everything (circulation + units)
      generateResidentialFloorMCMC(
        spaces, floorIdx, boundaryPolygon, units,
        residentialFloors, coreWidth, coreHeight,
        stairCount, numElevators
      );
    } else if (isIrregular) {
      // Ground/underground on irregular parcels: use captured circulation positions
      const circSpaces: SpaceData[] = [];
      for (const c of capturedCirculation) {
        const idSuffix = c.id.replace(/_f\d+$/, `_f${floorIdx}`);
        const s = createSpace(idSuffix, c.type, c.name, floorIdx, c.x, c.y, c.w, c.h, c.isVert);
        circSpaces.push(s);
        spaces.push(s);
      }

      // Build pre-placed bounds from captured circulation so ground/parking
      // functions know about already-placed stairs, elevators, etc.
      const prePlaced: BoundingBox[] = circSpaces.map(cs => {
        const g = cs.geometry as { x: number; y: number; width: number; height: number };
        return { x: g.x, y: g.y, width: g.width, height: g.height };
      });

      if (floorIdx < 0) {
        generateParkingFloor(spaces, floorIdx, halfSide, parking, coreWidth, coreHeight, boundaryPolygon, prePlaced);
      } else {
        generateGroundFloor(spaces, floorIdx, halfSide, data, coreWidth, coreHeight, boundaryPolygon, prePlaced);
      }

      // Post-process: remove any space that overlaps with another space
      // (check ALL pairs, not just non-circ vs circ)
      // Captured circulation items (from residential floor) have priority — never remove them.
      const capturedIds = new Set(circSpaces.map(cs => cs.id));
      for (let i = spaces.length - 1; i >= 0; i--) {
        const si = spaces[i];
        if (capturedIds.has(si.id)) continue; // never remove captured circ
        const gi = si.geometry as { x: number; y: number; width: number; height: number };
        if (!('x' in gi)) continue;
        const il = gi.x - gi.width / 2, ir = gi.x + gi.width / 2;
        const it = gi.y - gi.height / 2, ib = gi.y + gi.height / 2;
        let overlaps = false;
        for (let j = 0; j < spaces.length; j++) {
          if (i === j) continue;
          const sj = spaces[j];
          const gj = sj.geometry as { x: number; y: number; width: number; height: number };
          if (!('x' in gj)) continue;
          const jl = gj.x - gj.width / 2, jr = gj.x + gj.width / 2;
          const jt = gj.y - gj.height / 2, jb = gj.y + gj.height / 2;
          const ox = Math.max(0, Math.min(ir, jr) - Math.max(il, jl));
          const oy = Math.max(0, Math.min(ib, jb) - Math.max(it, jt));
          if (ox * oy > 1) { overlaps = true; break; }
        }
        if (overlaps) spaces.splice(i, 1);
      }
    } else {
      // Non-irregular parcels: use compact core at center
      const colLeftX = -(COL_GAP / 2 + COL_WIDTH / 2);
      const colRightX = (COL_GAP / 2 + COL_WIDTH / 2);

      const stairY = -coreHeight / 2 + STAIR_DEPTH / 2;
      spaces.push(createSpace(
        `stair_1_f${floorIdx}`, 'CIRCULATION', 'Stair 1', floorIdx,
        colLeftX, stairY, STAIR_WIDTH, STAIR_DEPTH, true
      ));

      if (stairCount >= 2) {
        spaces.push(createSpace(
          `stair_2_f${floorIdx}`, 'CIRCULATION', 'Stair 2', floorIdx,
          colRightX, stairY, STAIR_WIDTH, STAIR_DEPTH, true
        ));
      }

      let elevPlaced = 0;
      for (let row = 0; row < Math.ceil(numElevators / 2); row++) {
        const elevY = stairY + STAIR_DEPTH / 2 + ROW_GAP + row * (ELEVATOR_DEPTH + ROW_GAP) + ELEVATOR_DEPTH / 2;
        if (elevPlaced < numElevators) {
          spaces.push(createSpace(
            `elevator_${elevPlaced + 1}_f${floorIdx}`, 'CIRCULATION', `Elevator ${elevPlaced + 1}`, floorIdx,
            colLeftX, elevY, ELEVATOR_WIDTH, ELEVATOR_DEPTH, true
          ));
          elevPlaced++;
        }
        if (elevPlaced < numElevators) {
          spaces.push(createSpace(
            `elevator_${elevPlaced + 1}_f${floorIdx}`, 'CIRCULATION', `Elevator ${elevPlaced + 1}`, floorIdx,
            colRightX, elevY, ELEVATOR_WIDTH, ELEVATOR_DEPTH, true
          ));
          elevPlaced++;
        }
      }

      if (floorIdx < 0) {
        generateParkingFloor(spaces, floorIdx, halfSide, parking, coreWidth, coreHeight);
      } else if (floorIdx === 0) {
        generateGroundFloor(spaces, floorIdx, halfSide, data, coreWidth, coreHeight);
      } else {
        generateResidentialFloor(
          spaces, floorIdx, halfSide, units,
          corridorWidth, unitsPerFloor, residentialFloors,
          coreWidth, coreHeight
        );
      }
    }

    // Use actual polygon boundary for all floors when irregular
    const floorBoundary: number[][] = isIrregular
      ? boundaryPolygon.map(p => [p[0], p[1]])
      : [[-halfSide, -halfSide], [halfSide, -halfSide], [halfSide, halfSide], [-halfSide, halfSide]];

    floors.push({
      floor_index: floorIdx,
      floor_type: floorType,
      boundary: floorBoundary,
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
          position: { x: -4, y: 0 },
        },
        {
          id: 'stair_stalk',
          type: 'stair',
          floor_range: Array.from({ length: totalFloors }, (_, i) => i - numFloorsBelow),
          position: { x: 9, y: 0 },
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
  parking: ExtractedBuildingData['parking'],
  coreWidth: number,
  coreHeight: number,
  boundaryPolygon?: Polygon,
  prePlacedBounds?: BoundingBox[]
): void {
  const totalStalls = parking?.underground_stalls ?? 45;
  const h = halfSide;
  const MARGIN = 5;

  // For irregular polygons, scale room sizes down based on available area
  const roomScale = boundaryPolygon ? Math.min(1, h / 80) : 1;

  // Standard dimensions (scaled for polygon)
  const STALL_WIDTH = 9;
  const STALL_DEPTH = Math.round(18 * roomScale);
  const AISLE_WIDTH = Math.round(24 * roomScale);

  const boundary = { minX: -h + MARGIN, maxX: h - MARGIN, minY: -h + MARGIN, maxY: h - MARGIN };
  // Seed placedBounds with pre-placed items (captured circulation) or fallback to core
  const placedBounds: BoundingBox[] = prePlacedBounds && prePlacedBounds.length > 0
    ? [...prePlacedBounds]
    : [{ x: 0, y: 0, width: coreWidth, height: coreHeight }];

  // Support rooms — scaled for polygon
  const supportRooms: Array<{ id: string; name: string; w: number; h: number }> = [
    { id: 'storage',        name: 'Storage',        w: Math.round(15 * roomScale), h: Math.round(12 * roomScale) },
    { id: 'trash_recycle',  name: 'Trash/Recycle',  w: Math.round(12 * roomScale), h: Math.round(10 * roomScale) },
    { id: 'fan_room',       name: 'Fan Room',       w: Math.round(12 * roomScale), h: Math.round(10 * roomScale) },
    { id: 'fire_pump',      name: 'Fire Pump',      w: Math.round(10 * roomScale), h: Math.round(10 * roomScale) },
    { id: 'domestic_water', name: 'Domestic Water',  w: Math.round(10 * roomScale), h: Math.round(10 * roomScale) },
    { id: 'mpoe',           name: 'MPOE',           w: Math.round(10 * roomScale), h: Math.round(8 * roomScale) },
  ];

  // Place support rooms — let grid scan find valid position inside polygon
  for (const room of supportRooms) {
    safelyPlaceSpace(
      spaces, placedBounds,
      `${room.id}_f${floorIdx}`, 'SUPPORT', room.name, floorIdx,
      h * 0.4, 0, room.w, room.h, false, boundary, boundaryPolygon
    );
  }

  if (totalStalls > 0) {
    // Block-based parking: 5×2 bays (5 stalls wide × 2 deep) with aisles between.
    // Each bay is one rectangle; cleaner layout, more efficient space use.
    //
    //   ┌─────────┐  ┌─────────┐
    //   │ 5×2 bay │  │ 5×2 bay │   ← north bays (2 rows back-to-back)
    //   └─────────┘  └─────────┘
    //   ═══════════════════════════  ← drive aisle (implicit)
    //   ┌─────────┐  ┌─────────┐
    //   │ 5×2 bay │  │ 5×2 bay │   ← south bays
    //   └─────────┘  └─────────┘

    // Use 5×1 bays for tight polygons, 5×2 for normal
    const bayRows = (roomScale < 1) ? 1 : 2;
    const STALLS_PER_BAY = 5 * bayRows;
    const BAY_W = 5 * STALL_WIDTH;         // 45 ft
    const BAY_H = bayRows * STALL_DEPTH;   // 18 or 36 ft
    const BAY_GAP = 2;                      // gap between adjacent bays

    const aisleW = Math.min(2 * h - 30, 80) * roomScale;
    // Reserve aisle footprint for collision detection (implicit — not rendered)
    placedBounds.push({ x: 0, y: 0, width: aisleW, height: AISLE_WIDTH });

    const northY = -AISLE_WIDTH / 2 - BAY_H / 2;
    const southY = AISLE_WIDTH / 2 + BAY_H / 2;

    const numBays = Math.ceil(totalStalls / STALLS_PER_BAY);
    let bayCount = 0;
    let stallsPlaced = 0;

    for (const rowY of [northY, southY]) {
      const startX = -h + MARGIN + BAY_W / 2;
      for (let col = 0; bayCount < numBays && stallsPlaced < totalStalls; col++) {
        const x = startX + col * (BAY_W + BAY_GAP);
        const stallsInBay = Math.min(STALLS_PER_BAY, totalStalls - stallsPlaced);
        safelyPlaceSpace(
          spaces, placedBounds,
          `parking_bay_${bayCount + 1}_f${floorIdx}`, 'PARKING',
          `P${stallsPlaced + 1}-${stallsPlaced + stallsInBay}`, floorIdx,
          x, rowY, BAY_W, BAY_H, false, boundary, boundaryPolygon
        );
        stallsPlaced += stallsInBay;
        bayCount++;
      }
    }
  }
}

/**
 * Generate ground floor with lobby, amenities, and support spaces
 * Layout based on reference screenshot - lobby at entrance, amenities around perimeter
 * Uses CENTER-ORIGIN coordinates with COLLISION DETECTION
 */
function generateGroundFloor(
  spaces: SpaceData[],
  floorIdx: number,
  halfSide: number,
  _data: ExtractedBuildingData,
  coreWidth: number,
  coreHeight: number,
  boundaryPolygon?: Polygon,
  prePlacedBounds?: BoundingBox[]
): void {
  const h = halfSide;
  const MARGIN = 5;
  const boundary = { minX: -h + MARGIN, maxX: h - MARGIN, minY: -h + MARGIN, maxY: h - MARGIN };
  const s = boundaryPolygon ? Math.min(1, h / 80) : 1; // scale for tight polygons

  // Seed placedBounds with pre-placed items (captured circulation) or fallback to core
  const placedBounds: BoundingBox[] = prePlacedBounds && prePlacedBounds.length > 0
    ? [...prePlacedBounds]
    : [{ x: 0, y: 0, width: coreWidth, height: coreHeight }];

  // Rooms scaled for polygon — grid scan will find valid positions
  const rooms: Array<{ id: string; type: string; name: string; w: number; h: number; prefX: number; prefY: number }> = [
    { id: `lobby_f${floorIdx}`,          type: 'CIRCULATION', name: 'Lobby',        w: Math.round(30 * s), h: Math.round(20 * s), prefX: 0, prefY: h * 0.5 },
    { id: `leasing_f${floorIdx}`,        type: 'SUPPORT',     name: 'Leasing',      w: Math.round(18 * s), h: Math.round(15 * s), prefX: h * 0.5, prefY: h * 0.3 },
    { id: `mail_f${floorIdx}`,           type: 'SUPPORT',     name: 'Mail/Package', w: Math.round(15 * s), h: Math.round(12 * s), prefX: -h * 0.5, prefY: h * 0.3 },
    { id: `lounge_f${floorIdx}`,         type: 'AMENITY',     name: 'Lounge',       w: Math.round(30 * s), h: Math.round(25 * s), prefX: -h * 0.4, prefY: 0 },
    { id: `fitness_f${floorIdx}`,        type: 'AMENITY',     name: 'Fitness',      w: Math.round(25 * s), h: Math.round(20 * s), prefX: -h * 0.3, prefY: -h * 0.4 },
    { id: `restroom_m_f${floorIdx}`,     type: 'SUPPORT',     name: 'Restroom M',   w: Math.round(12 * s), h: Math.round(10 * s), prefX: h * 0.5, prefY: -h * 0.2 },
    { id: `restroom_f_f${floorIdx}`,     type: 'SUPPORT',     name: 'Restroom F',   w: Math.round(12 * s), h: Math.round(10 * s), prefX: h * 0.5, prefY: -h * 0.4 },
    { id: `trash_f${floorIdx}`,          type: 'SUPPORT',     name: 'Trash',        w: Math.round(10 * s), h: Math.round(8 * s),  prefX: h * 0.4, prefY: 0 },
    { id: `bike_storage_f${floorIdx}`,   type: 'SUPPORT',     name: 'Bike Storage', w: Math.round(20 * s), h: Math.round(18 * s), prefX: h * 0.3, prefY: -h * 0.5 },
  ];

  for (const room of rooms) {
    safelyPlaceSpace(spaces, placedBounds,
      room.id, room.type, room.name, floorIdx,
      room.prefX, room.prefY, room.w, room.h, false, boundary, boundaryPolygon
    );
  }

}

// ============================================
// GRID-BASED FLOOR PLAN OPTIMIZER
// ============================================
// Discretizes floor plate into 2ft cells, seeds with edge-based strips,
// then extracts clean edge-aligned rectangles for each unit.

const MCMC_CELL_SIZE = 2;           // 2ft x 2ft cells

/** Frontage widths by unit type (for warm-start strip sizing) */
const MCMC_FRONTAGES: Record<string, number> = {
  'studio': 24, '1br': 30, '2br': 38, '3br': 45,
};

// ---- Cell states ----
const CELL_OUTSIDE = 0;
const CELL_CORE = 1;
const CELL_EMPTY = 3;
const CELL_UNIT = 4;

// ---- Grid data structure ----
interface GridData {
  rows: number;
  cols: number;
  state: Uint8Array;         // cell states
  unitId: Int16Array;        // -1 = unassigned
  nearestEdge: Int16Array;   // index into boundary edges
  distToBoundary: Float32Array;
  bbMinX: number;
  bbMinY: number;
  neighbors: Int32Array;     // 4-connected neighbors, flat [N, E, S, W] per cell (-1 if none)
}

interface MCMCUnit {
  id: number;
  typeKey: string;
  name: string;
  targetArea: number;
  targetFrontage: number;
  cells: Set<number>;
}

// ---- Grid construction ----
function buildGrid(
  boundary: Polygon,
  coreWidth: number,
  coreHeight: number,
  corridorW: number
): GridData {
  const bb = getBoundingBox(boundary);
  const cols = Math.ceil(bb.width / MCMC_CELL_SIZE);
  const rows = Math.ceil(bb.height / MCMC_CELL_SIZE);
  const total = rows * cols;

  const state = new Uint8Array(total);
  const unitId = new Int16Array(total).fill(-1);
  const nearestEdge = new Int16Array(total).fill(-1);
  const distToBoundary = new Float32Array(total).fill(Infinity);

  // Core zone (core + corridor buffer) as rect
  const czHalfW = coreWidth / 2 + corridorW;
  const czHalfH = coreHeight / 2 + corridorW;

  // Precompute boundary edges
  const n = boundary.length;
  const edgeP1: Point[] = [];
  const edgeP2: Point[] = [];
  const edgeDx: number[] = [];
  const edgeDy: number[] = [];
  const edgeLenSq: number[] = [];
  for (let i = 0; i < n; i++) {
    const p1 = boundary[i];
    const p2 = boundary[(i + 1) % n];
    edgeP1.push(p1);
    edgeP2.push(p2);
    const dx = p2[0] - p1[0];
    const dy = p2[1] - p1[1];
    edgeDx.push(dx);
    edgeDy.push(dy);
    edgeLenSq.push(dx * dx + dy * dy);
  }

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const idx = r * cols + c;
      const wx = bb.minX + c * MCMC_CELL_SIZE + MCMC_CELL_SIZE / 2;
      const wy = bb.minY + r * MCMC_CELL_SIZE + MCMC_CELL_SIZE / 2;

      if (!pointInPolygon([wx, wy] as Point, boundary)) {
        state[idx] = CELL_OUTSIDE;
        continue;
      }

      if (wx >= -czHalfW && wx <= czHalfW && wy >= -czHalfH && wy <= czHalfH) {
        state[idx] = CELL_CORE;
        continue;
      }

      state[idx] = CELL_EMPTY;

      // Find nearest boundary edge
      let bestDist = Infinity;
      let bestEdge = 0;
      for (let e = 0; e < n; e++) {
        const lsq = edgeLenSq[e];
        if (lsq < 1e-10) continue;
        const t = Math.max(0, Math.min(1,
          ((wx - edgeP1[e][0]) * edgeDx[e] + (wy - edgeP1[e][1]) * edgeDy[e]) / lsq
        ));
        const projX = edgeP1[e][0] + t * edgeDx[e];
        const projY = edgeP1[e][1] + t * edgeDy[e];
        const d = Math.hypot(wx - projX, wy - projY);
        if (d < bestDist) {
          bestDist = d;
          bestEdge = e;
        }
      }
      nearestEdge[idx] = bestEdge;
      distToBoundary[idx] = bestDist;
    }
  }

  // Build 4-connected neighbor table
  const neighbors = new Int32Array(total * 4).fill(-1);
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const idx = r * cols + c;
      if (r > 0) neighbors[idx * 4 + 0] = (r - 1) * cols + c;       // North
      if (c < cols - 1) neighbors[idx * 4 + 1] = r * cols + (c + 1); // East
      if (r < rows - 1) neighbors[idx * 4 + 2] = (r + 1) * cols + c; // South
      if (c > 0) neighbors[idx * 4 + 3] = r * cols + (c - 1);        // West
    }
  }

  return { rows, cols, state, unitId, nearestEdge, distToBoundary, bbMinX: bb.minX, bbMinY: bb.minY, neighbors };
}

// ---- Warm-start seed ----
function warmStartSeed(
  grid: GridData,
  boundary: Polygon,
  unitQueue: MCMCUnit[]
): void {
  const n = boundary.length;
  const { cols, state, unitId, nearestEdge } = grid;
  const total = grid.rows * cols;

  // Group EMPTY cells by nearest boundary edge
  const edgeBuckets: Map<number, number[]> = new Map();
  for (let idx = 0; idx < total; idx++) {
    if (state[idx] !== CELL_EMPTY) continue;
    const e = nearestEdge[idx];
    if (e < 0) continue;
    let bucket = edgeBuckets.get(e);
    if (!bucket) { bucket = []; edgeBuckets.set(e, bucket); }
    bucket.push(idx);
  }

  // Compute total cells across all edges for proportional allocation
  let totalAvailCells = 0;
  const edgeProjections: Map<number, Array<{ idx: number; proj: number; span: number }>> = new Map();

  for (let e = 0; e < n; e++) {
    const bucket = edgeBuckets.get(e);
    if (!bucket || bucket.length === 0) continue;

    const p1 = boundary[e];
    const p2 = boundary[(e + 1) % n];
    const dx = p2[0] - p1[0];
    const dy = p2[1] - p1[1];
    const len = Math.sqrt(dx * dx + dy * dy);
    if (len < 1e-6) continue;
    const dirX = dx / len;
    const dirY = dy / len;

    const projections: Array<{ idx: number; proj: number; span: number }> = [];
    for (const idx of bucket) {
      const wx = grid.bbMinX + (idx % cols) * MCMC_CELL_SIZE + MCMC_CELL_SIZE / 2;
      const wy = grid.bbMinY + Math.floor(idx / cols) * MCMC_CELL_SIZE + MCMC_CELL_SIZE / 2;
      const proj = (wx - p1[0]) * dirX + (wy - p1[1]) * dirY;
      projections.push({ idx, proj, span: 0 });
    }
    projections.sort((a, b) => a.proj - b.proj);

    if (projections.length > 0) {
      const span = projections[projections.length - 1].proj - projections[0].proj;
      for (const p of projections) p.span = span;
      edgeProjections.set(e, projections);
      totalAvailCells += bucket.length;
    }
  }

  // Allocate units to edges proportionally, using adaptive strip width
  const targetTotal = Math.min(unitQueue.length, Math.max(unitQueue.length, 20));
  let unitIdx = 0;

  for (let e = 0; e < n && unitIdx < unitQueue.length; e++) {
    const projections = edgeProjections.get(e);
    if (!projections || projections.length === 0) continue;

    const bucket = edgeBuckets.get(e);
    if (!bucket) continue;

    const minProj = projections[0].proj;
    const maxProj = projections[projections.length - 1].proj;
    const edgeSpan = maxProj - minProj;
    if (edgeSpan < MCMC_CELL_SIZE) continue;

    // How many units should this edge get? Proportional to cell count
    const edgeShare = bucket.length / Math.max(totalAvailCells, 1);
    const unitsForEdge = Math.max(1, Math.round(edgeShare * targetTotal));
    const stripWidth = edgeSpan / unitsForEdge;

    let stripStart = minProj;
    let edgeUnitCount = 0;
    while (stripStart < maxProj && unitIdx < unitQueue.length && edgeUnitCount < unitsForEdge) {
      const unit = unitQueue[unitIdx];
      const stripEnd = stripStart + stripWidth;

      let assigned = 0;
      for (const { idx, proj } of projections) {
        if (proj >= stripStart && proj < stripEnd && unitId[idx] === -1) {
          unitId[idx] = unit.id;
          state[idx] = CELL_UNIT;
          unit.cells.add(idx);
          assigned++;
        }
      }

      if (assigned > 0) {
        unitIdx++;
        edgeUnitCount++;
      }
      stripStart = stripEnd;
    }
  }

  // Assign remaining EMPTY cells to nearest adjacent unit
  let changed = true;
  while (changed) {
    changed = false;
    for (let idx = 0; idx < total; idx++) {
      if (state[idx] !== CELL_EMPTY) continue;

      // Find adjacent unit
      let bestUnit = -1;
      let bestDist = Infinity;
      for (let d = 0; d < 4; d++) {
        const ni = grid.neighbors[idx * 4 + d];
        if (ni >= 0 && state[ni] === CELL_UNIT && unitId[ni] >= 0) {
          const uid = unitId[ni];
          const dist = grid.distToBoundary[idx];
          if (dist < bestDist) {
            bestDist = dist;
            bestUnit = uid;
          }
        }
      }

      if (bestUnit >= 0 && bestUnit < unitQueue.length) {
        unitId[idx] = bestUnit;
        state[idx] = CELL_UNIT;
        unitQueue[bestUnit].cells.add(idx);
        changed = true;
      }
    }
  }

  // Remove units with too few cells (slivers)
  for (const unit of unitQueue) {
    if (unit.cells.size > 0 && unit.cells.size < 8) {
      for (const idx of unit.cells) {
        unitId[idx] = -1;
        state[idx] = CELL_EMPTY;
      }
      unit.cells.clear();
    }
  }
}

// ---- Extract clean edge-aligned rectangle from unit cells ----
function extractUnitAsEdgeRect(
  grid: GridData,
  unit: MCMCUnit,
  boundary: Polygon,
  corridorHalfW: number,
  corridorHalfH: number,
): [number, number][] | null {
  if (unit.cells.size === 0) return null;

  const { cols, nearestEdge } = grid;

  // Find primary boundary edge (mode of nearestEdge for this unit's cells)
  const edgeCounts: Map<number, number> = new Map();
  for (const idx of unit.cells) {
    const e = nearestEdge[idx];
    edgeCounts.set(e, (edgeCounts.get(e) || 0) + 1);
  }
  let primaryEdge = 0;
  let maxCount = 0;
  for (const [e, count] of edgeCounts) {
    if (count > maxCount) {
      maxCount = count;
      primaryEdge = e;
    }
  }

  // Get edge geometry
  const n = boundary.length;
  const p1 = boundary[primaryEdge];
  const p2 = boundary[(primaryEdge + 1) % n];
  const edgeDx = p2[0] - p1[0];
  const edgeDy = p2[1] - p1[1];
  const edgeLen = Math.sqrt(edgeDx * edgeDx + edgeDy * edgeDy);
  if (edgeLen < 1e-6) return null;

  // Edge direction and inward normal
  const dirX = edgeDx / edgeLen;
  const dirY = edgeDy / edgeLen;

  // Pick inward normal: the one pointing toward (0,0) from edge midpoint
  const midX = (p1[0] + p2[0]) / 2;
  const midY = (p1[1] + p2[1]) / 2;
  const n1x = -dirY, n1y = dirX;
  const n2x = dirY, n2y = -dirX;
  const dot1 = n1x * (-midX) + n1y * (-midY);
  const dot2 = n2x * (-midX) + n2y * (-midY);
  const normX = dot1 > dot2 ? n1x : n2x;
  const normY = dot1 > dot2 ? n1y : n2y;

  // Project cell centers onto edge direction and inward normal
  // Only include cells whose nearest edge matches the primary edge
  let minProj = Infinity, maxProj = -Infinity;
  let minDepth = Infinity, maxDepth = -Infinity;
  let projectedCount = 0;

  for (const idx of unit.cells) {
    if (nearestEdge[idx] !== primaryEdge) continue;

    const c = idx % cols;
    const r = Math.floor(idx / cols);
    const wx = grid.bbMinX + c * MCMC_CELL_SIZE + MCMC_CELL_SIZE / 2;
    const wy = grid.bbMinY + r * MCMC_CELL_SIZE + MCMC_CELL_SIZE / 2;

    const vx = wx - p1[0];
    const vy = wy - p1[1];
    const proj = vx * dirX + vy * dirY;
    const depth = vx * normX + vy * normY;

    if (proj < minProj) minProj = proj;
    if (proj > maxProj) maxProj = proj;
    if (depth < minDepth) minDepth = depth;
    if (depth > maxDepth) maxDepth = depth;
    projectedCount++;
  }

  if (projectedCount === 0) return null;

  // Add half-cell padding and clamp frontage to edge span
  minProj = Math.max(0, minProj - MCMC_CELL_SIZE / 2);
  maxProj = Math.min(edgeLen, maxProj + MCMC_CELL_SIZE / 2);
  minDepth = Math.max(0, minDepth - MCMC_CELL_SIZE / 2);
  maxDepth += MCMC_CELL_SIZE / 2;

  // --- Corridor depth limit: units must not extend into corridor ring around core ---
  // perpDistToCenter = signed distance from boundary edge to (0,0) along inward normal
  const perpDistToCenter = normX * (-p1[0]) + normY * (-p1[1]);
  // supportDist = how far corridor rect extends toward this edge (Minkowski support function)
  const supportDist = corridorHalfW * Math.abs(normX) + corridorHalfH * Math.abs(normY);
  const corridorMaxDepth = perpDistToCenter - supportDist;
  if (corridorMaxDepth > 0) {
    maxDepth = Math.min(maxDepth, corridorMaxDepth);
  }

  // Binary search for max safe depth: ensure all 4 vertices stay inside polygon
  // Check inner vertices (at maxDepth) — outer vertices are on the boundary edge
  let lo = minDepth;
  let hi = maxDepth;
  for (let bsIter = 0; bsIter < 15; bsIter++) {
    const mid = (lo + hi) / 2;
    const innerS: Point = [
      p1[0] + minProj * dirX + mid * normX,
      p1[1] + minProj * dirY + mid * normY,
    ];
    const innerE: Point = [
      p1[0] + maxProj * dirX + mid * normX,
      p1[1] + maxProj * dirY + mid * normY,
    ];
    if (pointInPolygon(innerS, boundary) && pointInPolygon(innerE, boundary)) {
      lo = mid;
    } else {
      hi = mid;
    }
  }
  maxDepth = lo;

  // --- Corner trimming: prevent overlap between adjacent edge zones ---
  // At each polygon vertex, two edges meet. Units from both extend inward at different
  // angles, creating overlap wedges. Trim frontage at each end by depth/tan(halfAngle)
  // so that unit rectangles stop at the angular bisector.
  const unitDepth = maxDepth - minDepth;

  // Determine polygon winding (positive signed area = CCW)
  let sa2 = 0;
  for (let i = 0; i < n; i++) {
    const a = boundary[i], b = boundary[(i + 1) % n];
    sa2 += a[0] * b[1] - b[0] * a[1];
  }
  const wSign = sa2 > 0 ? 1 : -1;

  // Interior angle & trim at START vertex of this edge
  const vPrev = boundary[(primaryEdge - 1 + n) % n];
  const inSx = p1[0] - vPrev[0], inSy = p1[1] - vPrev[1];
  const crossS = (inSx * edgeDy - inSy * edgeDx) * wSign;
  const dotS = inSx * edgeDx + inSy * edgeDy;
  const halfAngleS = (Math.PI - Math.atan2(crossS, dotS)) / 2;
  let startTrim = 0;
  if (halfAngleS > 0.1 && halfAngleS < Math.PI - 0.1) {
    startTrim = Math.max(0, unitDepth / Math.tan(halfAngleS));
  }

  // Interior angle & trim at END vertex of this edge
  const vAfterEnd = boundary[(primaryEdge + 2) % n];
  const outEx = vAfterEnd[0] - p2[0], outEy = vAfterEnd[1] - p2[1];
  const crossE = (edgeDx * outEy - edgeDy * outEx) * wSign;
  const dotE = edgeDx * outEx + edgeDy * outEy;
  const halfAngleE = (Math.PI - Math.atan2(crossE, dotE)) / 2;
  let endTrim = 0;
  if (halfAngleE > 0.1 && halfAngleE < Math.PI - 0.1) {
    endTrim = Math.max(0, unitDepth / Math.tan(halfAngleE));
  }

  // Apply corner trims to frontage
  minProj = Math.max(minProj, startTrim);
  maxProj = Math.min(maxProj, edgeLen - endTrim);

  // Ensure minimum viable rectangle
  if (maxProj - minProj < 8 || maxDepth - minDepth < 8) return null;

  // Build 4-vertex rectangle in world coordinates
  const outerStart: [number, number] = [
    p1[0] + minProj * dirX + minDepth * normX,
    p1[1] + minProj * dirY + minDepth * normY,
  ];
  const outerEnd: [number, number] = [
    p1[0] + maxProj * dirX + minDepth * normX,
    p1[1] + maxProj * dirY + minDepth * normY,
  ];
  const innerEnd: [number, number] = [
    p1[0] + maxProj * dirX + maxDepth * normX,
    p1[1] + maxProj * dirY + maxDepth * normY,
  ];
  const innerStart: [number, number] = [
    p1[0] + minProj * dirX + maxDepth * normX,
    p1[1] + minProj * dirY + maxDepth * normY,
  ];

  let verts: [number, number][] = [outerStart, outerEnd, innerEnd, innerStart];

  // Clamp all vertices to be inside the boundary polygon.
  // Any vertex outside gets projected to the nearest boundary edge point.
  // Vertices near boundary (within 4ft) get snapped for clean exterior edges.
  verts = clampVerticesToBoundary(verts, boundary);

  return verts;
}

// ---- Project a point to nearest boundary edge ----
function nearestBoundaryPoint(
  v: [number, number],
  boundary: Polygon
): { proj: [number, number]; dist: number } {
  let bestDist = Infinity;
  let bestProj: [number, number] = v;

  for (let i = 0; i < boundary.length; i++) {
    const bp1 = boundary[i];
    const bp2 = boundary[(i + 1) % boundary.length];
    const dx = bp2[0] - bp1[0];
    const dy = bp2[1] - bp1[1];
    const lenSq = dx * dx + dy * dy;
    if (lenSq < 1e-10) continue;

    const t = Math.max(0, Math.min(1,
      ((v[0] - bp1[0]) * dx + (v[1] - bp1[1]) * dy) / lenSq
    ));
    const projX = bp1[0] + t * dx;
    const projY = bp1[1] + t * dy;
    const dist = Math.hypot(v[0] - projX, v[1] - projY);

    if (dist < bestDist) {
      bestDist = dist;
      bestProj = [projX, projY];
    }
  }

  return { proj: bestProj, dist: bestDist };
}

// ---- Clamp vertices to boundary polygon ----
// Vertices outside the polygon are projected to nearest boundary point.
// Vertices near boundary (within SNAP_DIST) are snapped for clean edges.
function clampVerticesToBoundary(
  polygon: [number, number][],
  boundary: Polygon
): [number, number][] {
  const SNAP_DIST = 4;

  return polygon.map(v => {
    const { proj, dist } = nearestBoundaryPoint(v, boundary);
    const inside = pointInPolygon(v as Point, boundary);

    if (!inside) {
      // Outside polygon — clamp to boundary
      return proj;
    }
    if (dist <= SNAP_DIST) {
      // Near boundary — snap for clean exterior edges
      return proj;
    }
    return v;
  });
}

/**
 * Create a SpaceData with PolygonGeometry instead of rect
 */
function createPolygonSpace(
  id: string,
  type: string,
  name: string,
  floorIndex: number,
  vertices: [number, number][],
  targetArea: number
): SpaceData {
  const actualArea = calculatePolygonArea(vertices);
  const deviation = targetArea > 0
    ? ((actualArea - targetArea) / targetArea * 100).toFixed(1)
    : '0.0';
  return {
    id,
    type,
    name,
    floor_index: floorIndex,
    geometry: { vertices } as PolygonGeometry,
    target_area_sf: targetArea,
    actual_area_sf: actualArea,
    membership: 1.0,
    area_deviation: `${Number(deviation) >= 0 ? '+' : ''}${deviation}%`,
    is_vertical: false,
  };
}

// ---- Orchestrator ----

/**
 * Direct geometric placement for irregular polygons with mitered corners.
 *
 * 1. Compute per-edge: direction, inward normal, depth to corridor ring
 * 2. At each polygon vertex, compute mitered inner corner (intersection of
 *    adjacent inner edges) so units tile seamlessly with zero gaps/overlap
 * 3. Subdivide each edge strip into units via linear interpolation of
 *    outer boundary and mitered inner boundary
 *
 * Result: units cover the ENTIRE perimeter, tapering to trapezoids at
 * polygon corners. A corridor gap separates units from the central core.
 */
function generateResidentialFloorMCMC(
  spaces: SpaceData[],
  floorIdx: number,
  boundary: Polygon,
  units: ExtractedBuildingData['dwelling_units'],
  totalResidentialFloors: number,
  _coreWidth: number,
  _coreHeight: number,
  stairCount: number,
  numElevators: number,
): void {
  // Check if two line segments cross each other
  function segsCross(a: [number,number], b: [number,number], c: [number,number], d: [number,number]): boolean {
    const d1 = (b[0]-a[0])*(c[1]-a[1]) - (b[1]-a[1])*(c[0]-a[0]);
    const d2 = (b[0]-a[0])*(d[1]-a[1]) - (b[1]-a[1])*(d[0]-a[0]);
    const d3 = (d[0]-c[0])*(a[1]-c[1]) - (d[1]-c[1])*(a[0]-c[0]);
    const d4 = (d[0]-c[0])*(b[1]-c[1]) - (d[1]-c[1])*(b[0]-c[0]);
    return d1 * d2 < 0 && d3 * d4 < 0;
  }

  const MIN_UNIT_DEPTH = 10;
  const n = boundary.length;

  // ---- Step 1: Per-edge geometry ----
  // No core ring constraint — depth is distance from edge to centroid (origin)
  interface EdgeGeom {
    dirX: number; dirY: number;
    normX: number; normY: number;
    edgeLen: number;
    maxDepth: number; // full perpendicular distance from edge to origin
  }
  const edgeGeoms: (EdgeGeom | null)[] = [];

  for (let e = 0; e < n; e++) {
    const p1 = boundary[e], p2 = boundary[(e + 1) % n];
    const dx = p2[0] - p1[0], dy = p2[1] - p1[1];
    const edgeLen = Math.hypot(dx, dy);
    if (edgeLen < 15) { edgeGeoms.push(null); continue; }

    const dirX = dx / edgeLen, dirY = dy / edgeLen;
    const midX = (p1[0] + p2[0]) / 2, midY = (p1[1] + p2[1]) / 2;
    const nl = -dirY, nr = dirX;
    const dotL = nl * (-midX) + nr * (-midY);
    const normX = dotL > 0 ? nl : dirY;
    const normY = dotL > 0 ? nr : -dirX;

    // Distance from edge to origin along inward normal
    const maxDepth = normX * (-p1[0]) + normY * (-p1[1]);
    if (maxDepth < MIN_UNIT_DEPTH) { edgeGeoms.push(null); continue; }

    edgeGeoms.push({ dirX, dirY, normX, normY, edgeLen, maxDepth });
  }

  // Ring depths — adaptive based on available depth.
  // Larger parcels get deeper units to fill more space.
  const validMaxDepths = edgeGeoms.filter((eg): eg is EdgeGeom => eg !== null).map(eg => eg.maxDepth);
  const avgMaxDepth = validMaxDepths.length > 0
    ? validMaxDepths.reduce((a, b) => a + b, 0) / validMaxDepths.length : 60;
  // Scale outer depth: 25ft base, up to 45ft for large parcels
  const OUTER_DEPTH = Math.min(45, Math.max(25, Math.round(avgMaxDepth * 0.4)));
  const COURTYARD_GAP = 14; // wide enough for stairs/elevators + corridor
  // Scale inner depth proportionally
  const INNER_DEPTH = Math.min(35, Math.max(18, Math.round(avgMaxDepth * 0.3)));
  const UNIT_DEPTH = OUTER_DEPTH;

  // ---- Step 2: Build inset polygon (uniform depth miter) ----
  const insetVerts: ([number, number] | null)[] = [];

  for (let v = 0; v < n; v++) {
    const prevEG = edgeGeoms[(v - 1 + n) % n];
    const curEG = edgeGeoms[v];
    const vertex = boundary[v];

    if (!prevEG || !curEG) {
      const eg = prevEG || curEG;
      if (eg) {
        insetVerts.push([vertex[0] + UNIT_DEPTH * eg.normX, vertex[1] + UNIT_DEPTH * eg.normY]);
      } else {
        insetVerts.push(null);
      }
      continue;
    }

    // Uniform depth miter: offset both edges inward by UNIT_DEPTH, intersect
    const rhsX = UNIT_DEPTH * (curEG.normX - prevEG.normX);
    const rhsY = UNIT_DEPTH * (curEG.normY - prevEG.normY);
    const det = prevEG.dirY * curEG.dirX - prevEG.dirX * curEG.dirY;

    if (Math.abs(det) < 1e-10) {
      // Parallel edges — simple offset
      insetVerts.push([
        vertex[0] + UNIT_DEPTH * prevEG.normX,
        vertex[1] + UNIT_DEPTH * prevEG.normY,
      ]);
      continue;
    }

    const t = (-curEG.dirY * rhsX + curEG.dirX * rhsY) / det;
    const mx = vertex[0] + UNIT_DEPTH * prevEG.normX + t * prevEG.dirX;
    const my = vertex[1] + UNIT_DEPTH * prevEG.normY + t * prevEG.dirY;

    // Safety: if inset point outside boundary, clamp
    if (!pointInPolygon([mx, my] as Point, boundary)) {
      const { proj } = nearestBoundaryPoint([mx, my], boundary);
      insetVerts.push(proj);
    } else {
      insetVerts.push([mx, my]);
    }
  }

  // ---- Step 3: Place units along each edge ----
  const MIN_UNIT_FRONTAGE = 18;
  const totalUnits = units.reduce((sum, u) => sum + u.count, 0);
  const targetPerFloor = Math.ceil(totalUnits / Math.max(totalResidentialFloors, 1));

  let totalFrontage = 0;
  for (let e = 0; e < n; e++) {
    if (edgeGeoms[e]) totalFrontage += edgeGeoms[e]!.edgeLen;
  }
  if (totalFrontage < 8) return;

  const maxByFrontage = Math.floor(totalFrontage / MIN_UNIT_FRONTAGE);
  const cappedTarget = Math.min(targetPerFloor, maxByFrontage);

  let unitCount = 0;
  let typeIdx = 0;

  for (let e = 0; e < n; e++) {
    const eg = edgeGeoms[e];
    if (!eg) continue;

    const vStart = boundary[e];
    const vEnd = boundary[(e + 1) % n];
    const innerStart = insetVerts[e] || [vStart[0] + UNIT_DEPTH * eg.normX, vStart[1] + UNIT_DEPTH * eg.normY];
    const innerEnd = insetVerts[(e + 1) % n] || [vEnd[0] + UNIT_DEPTH * eg.normX, vEnd[1] + UNIT_DEPTH * eg.normY];

    const share = eg.edgeLen / totalFrontage;
    const maxOnEdge = Math.max(1, Math.floor(eg.edgeLen / MIN_UNIT_FRONTAGE));
    const unitsForEdge = Math.min(maxOnEdge, Math.max(1, Math.round(share * cappedTarget)));

    // Small corner gap (fraction of edge) to prevent miter corner overlaps
    const GAP = Math.min(0.04, 3 / eg.edgeLen);
    for (let i = 0; i < unitsForEdge; i++) {
      const t0 = GAP + i * (1 - 2 * GAP) / unitsForEdge;
      const t1 = GAP + (i + 1) * (1 - 2 * GAP) / unitsForEdge;

      const outer1: [number, number] = [
        vStart[0] + t0 * (vEnd[0] - vStart[0]),
        vStart[1] + t0 * (vEnd[1] - vStart[1]),
      ];
      const outer2: [number, number] = [
        vStart[0] + t1 * (vEnd[0] - vStart[0]),
        vStart[1] + t1 * (vEnd[1] - vStart[1]),
      ];
      const inner2: [number, number] = [
        innerStart[0] + t1 * (innerEnd[0] - innerStart[0]),
        innerStart[1] + t1 * (innerEnd[1] - innerStart[1]),
      ];
      const inner1: [number, number] = [
        innerStart[0] + t0 * (innerEnd[0] - innerStart[0]),
        innerStart[1] + t0 * (innerEnd[1] - innerStart[1]),
      ];

      const verts: [number, number][] = [outer1, outer2, inner2, inner1];

      // Skip self-intersecting (bowtie) polygons
      if (segsCross(verts[0], verts[1], verts[2], verts[3]) ||
          segsCross(verts[1], verts[2], verts[3], verts[0])) continue;

      const ut = units[typeIdx % units.length];
      spaces.push(createPolygonSpace(
        `unit_${ut.type.toLowerCase()}_${unitCount}_f${floorIdx}`,
        'DWELLING_UNIT',
        ut.name || ut.type,
        floorIdx,
        verts,
        ut.area_sf || 700,
      ));
      unitCount++;
      typeIdx++;
    }
  }

  // ---- Step 4: Inner ring units (courtyard-facing) ----
  // Build a second inset polygon at OUTER_DEPTH + COURTYARD_GAP from boundary.
  // Inner ring units go from this second inset toward the corridor ring.
  const innerRingOuterDepth = OUTER_DEPTH + COURTYARD_GAP;

  // Build second inset (inner ring outer boundary)
  const innerRingOuter: ([number, number] | null)[] = [];
  for (let v = 0; v < n; v++) {
    const prevEG = edgeGeoms[(v - 1 + n) % n];
    const curEG = edgeGeoms[v];
    const vertex = boundary[v];

    if (!prevEG || !curEG) {
      const eg = prevEG || curEG;
      if (eg && eg.maxDepth >= innerRingOuterDepth + INNER_DEPTH) {
        innerRingOuter.push([vertex[0] + innerRingOuterDepth * eg.normX, vertex[1] + innerRingOuterDepth * eg.normY]);
      } else {
        innerRingOuter.push(null);
      }
      continue;
    }

    // Check both edges have enough depth for inner ring
    if (prevEG.maxDepth < innerRingOuterDepth + INNER_DEPTH || curEG.maxDepth < innerRingOuterDepth + INNER_DEPTH) {
      innerRingOuter.push(null);
      continue;
    }

    const rhsX = innerRingOuterDepth * (curEG.normX - prevEG.normX);
    const rhsY = innerRingOuterDepth * (curEG.normY - prevEG.normY);
    const det = prevEG.dirY * curEG.dirX - prevEG.dirX * curEG.dirY;

    if (Math.abs(det) < 1e-10) {
      innerRingOuter.push([
        vertex[0] + innerRingOuterDepth * prevEG.normX,
        vertex[1] + innerRingOuterDepth * prevEG.normY,
      ]);
      continue;
    }

    const t = (-curEG.dirY * rhsX + curEG.dirX * rhsY) / det;
    const mx = vertex[0] + innerRingOuterDepth * prevEG.normX + t * prevEG.dirX;
    const my = vertex[1] + innerRingOuterDepth * prevEG.normY + t * prevEG.dirY;

    if (!pointInPolygon([mx, my] as Point, boundary)) {
      innerRingOuter.push(null);
    } else {
      innerRingOuter.push([mx, my]);
    }
  }

  // Build inner ring inner boundary (innerRingOuterDepth + INNER_DEPTH from boundary)
  const innerRingInnerDepth = innerRingOuterDepth + INNER_DEPTH;
  const innerRingInner: ([number, number] | null)[] = [];
  for (let v = 0; v < n; v++) {
    const prevEG = edgeGeoms[(v - 1 + n) % n];
    const curEG = edgeGeoms[v];
    const vertex = boundary[v];

    if (!prevEG || !curEG) {
      const eg = prevEG || curEG;
      if (eg && eg.maxDepth >= innerRingInnerDepth) {
        innerRingInner.push([vertex[0] + innerRingInnerDepth * eg.normX, vertex[1] + innerRingInnerDepth * eg.normY]);
      } else {
        innerRingInner.push(null);
      }
      continue;
    }

    if (prevEG.maxDepth < innerRingInnerDepth || curEG.maxDepth < innerRingInnerDepth) {
      innerRingInner.push(null);
      continue;
    }

    const rhsX = innerRingInnerDepth * (curEG.normX - prevEG.normX);
    const rhsY = innerRingInnerDepth * (curEG.normY - prevEG.normY);
    const det = prevEG.dirY * curEG.dirX - prevEG.dirX * curEG.dirY;

    if (Math.abs(det) < 1e-10) {
      innerRingInner.push([
        vertex[0] + innerRingInnerDepth * prevEG.normX,
        vertex[1] + innerRingInnerDepth * prevEG.normY,
      ]);
      continue;
    }

    const t = (-curEG.dirY * rhsX + curEG.dirX * rhsY) / det;
    const mx = vertex[0] + innerRingInnerDepth * prevEG.normX + t * prevEG.dirX;
    const my = vertex[1] + innerRingInnerDepth * prevEG.normY + t * prevEG.dirY;

    if (!pointInPolygon([mx, my] as Point, boundary)) {
      innerRingInner.push(null);
    } else {
      innerRingInner.push([mx, my]);
    }
  }

  // Place inner ring units
  for (let e = 0; e < n; e++) {
    const eg = edgeGeoms[e];
    if (!eg) continue;
    if (eg.maxDepth < innerRingInnerDepth) continue;

    const outerS = innerRingOuter[e];
    const outerE = innerRingOuter[(e + 1) % n];
    const innerS = innerRingInner[e];
    const innerE = innerRingInner[(e + 1) % n];
    if (!outerS || !outerE || !innerS || !innerE) continue;

    // Estimate inner ring frontage (shorter than boundary edge)
    const innerEdgeLen = Math.hypot(outerE[0] - outerS[0], outerE[1] - outerS[1]);
    if (innerEdgeLen < 10) continue;

    const share = innerEdgeLen / totalFrontage;
    const maxOnEdge = Math.max(1, Math.floor(innerEdgeLen / MIN_UNIT_FRONTAGE));
    const unitsForEdge = Math.min(maxOnEdge, Math.max(1, Math.round(share * cappedTarget)));

    const iGAP = Math.min(0.04, 3 / innerEdgeLen);
    for (let i = 0; i < unitsForEdge; i++) {
      const t0 = iGAP + i * (1 - 2 * iGAP) / unitsForEdge;
      const t1 = iGAP + (i + 1) * (1 - 2 * iGAP) / unitsForEdge;

      const o1: [number, number] = [outerS[0] + t0 * (outerE[0] - outerS[0]), outerS[1] + t0 * (outerE[1] - outerS[1])];
      const o2: [number, number] = [outerS[0] + t1 * (outerE[0] - outerS[0]), outerS[1] + t1 * (outerE[1] - outerS[1])];
      const i2: [number, number] = [innerS[0] + t1 * (innerE[0] - innerS[0]), innerS[1] + t1 * (innerE[1] - innerS[1])];
      const i1: [number, number] = [innerS[0] + t0 * (innerE[0] - innerS[0]), innerS[1] + t0 * (innerE[1] - innerS[1])];

      const verts: [number, number][] = [o1, o2, i2, i1];

      // Skip bowtie polygons
      if (segsCross(verts[0], verts[1], verts[2], verts[3]) ||
          segsCross(verts[1], verts[2], verts[3], verts[0])) continue;

      const ut = units[typeIdx % units.length];
      spaces.push(createPolygonSpace(
        `unit_inner_${ut.type.toLowerCase()}_${unitCount}_f${floorIdx}`,
        'DWELLING_UNIT',
        ut.name || ut.type,
        floorIdx,
        verts,
        ut.area_sf || 700,
      ));
      unitCount++;
      typeIdx++;
    }
  }

  // ---- Step 5: Place circulation & support in a row along the longest edge ----
  const STAIR_W = 10, STAIR_D = 12;
  const ELEV_W = 8, ELEV_D = 8;
  const SUPPORT_W = 5, SUPPORT_H = 5;
  const ITEM_GAP = 3; // 3ft gap between items

  // Collect valid edges sorted by frontage length (longest first)
  const validEdges: { idx: number; eg: EdgeGeom; iv0: [number, number]; iv1: [number, number] }[] = [];
  for (let e = 0; e < n; e++) {
    const eg = edgeGeoms[e];
    const iv0 = insetVerts[e];
    const iv1 = insetVerts[(e + 1) % n];
    if (eg && iv0 && iv1) validEdges.push({ idx: e, eg, iv0, iv1 });
  }
  validEdges.sort((a, b) => b.eg.edgeLen - a.eg.edgeLen);

  // All circulation/support items to place
  const corridorItems: { id: string; type: string; name: string; w: number; h: number; isVert: boolean }[] = [];
  for (let s = 0; s < stairCount; s++) {
    corridorItems.push({ id: `stair_${s + 1}_f${floorIdx}`, type: 'CIRCULATION', name: `Stair ${s + 1}`, w: STAIR_W, h: STAIR_D, isVert: true });
  }
  for (let e = 0; e < numElevators; e++) {
    corridorItems.push({ id: `elevator_${e + 1}_f${floorIdx}`, type: 'CIRCULATION', name: `Elevator ${e + 1}`, w: ELEV_W, h: ELEV_D, isVert: true });
  }
  corridorItems.push({ id: `trash_f${floorIdx}`, type: 'SUPPORT', name: 'Trash', w: SUPPORT_W, h: SUPPORT_H, isVert: false });
  corridorItems.push({ id: `mech_f${floorIdx}`, type: 'SUPPORT', name: 'Mech', w: SUPPORT_W, h: SUPPORT_H, isVert: false });
  corridorItems.push({ id: `stor_f${floorIdx}`, type: 'SUPPORT', name: 'Stor', w: SUPPORT_W, h: SUPPORT_H, isVert: false });
  corridorItems.push({ id: `elec_f${floorIdx}`, type: 'SUPPORT', name: 'Elec', w: SUPPORT_W, h: SUPPORT_H, isVert: false });

  // Check if full rect (all 4 corners) fits inside the boundary polygon
  function rectFitsInBoundary(rx: number, ry: number, rw: number, rh: number): boolean {
    const hw = rw / 2, hh = rh / 2;
    const corners: Point[] = [
      [rx - hw, ry - hh], [rx + hw, ry - hh],
      [rx + hw, ry + hh], [rx - hw, ry + hh],
    ];
    return corners.every(c => pointInPolygon(c, boundary));
  }

  // Overlap checker with buffer — checks both directions (rect corners in polygon + polygon verts in rect)
  const BUF = 1.5;
  function rectOverlapsAny(rx: number, ry: number, rw: number, rh: number, skipId: string): boolean {
    // First: must fit inside boundary polygon
    if (!rectFitsInBoundary(rx, ry, rw, rh)) return true;

    const hw = rw / 2 + BUF, hh = rh / 2 + BUF;
    const rl = rx - hw, rr = rx + hw, rt = ry - hh, rb = ry + hh;
    const rectCorners: [number, number][] = [[rl, rt], [rr, rt], [rr, rb], [rl, rb]];
    for (const s of spaces) {
      if (s.id === skipId) continue;
      const g = s.geometry;
      if ('vertices' in g) {
        const vs = g.vertices as [number, number][];
        // Check both ways: rect corners inside polygon AND polygon verts inside rect
        if (rectCorners.some(c => pointInPolygon(c, vs))) return true;
        if (vs.some(v => v[0] >= rl && v[0] <= rr && v[1] >= rt && v[1] <= rb)) return true;
      } else {
        const r = g as { x: number; y: number; width: number; height: number };
        const sl = r.x - r.width / 2 - BUF, sr = r.x + r.width / 2 + BUF;
        const st = r.y - r.height / 2 - BUF, sb = r.y + r.height / 2 + BUF;
        const ox = Math.max(0, Math.min(rr, sr) - Math.max(rl, sl));
        const oy = Math.max(0, Math.min(rb, sb) - Math.max(rt, st));
        if (ox * oy > 1) return true;
      }
    }
    return false;
  }

  // Place all items in a row along the longest edge, oriented along that edge's direction.
  // Walk along the edge, placing each item with 3ft gap between them.
  if (validEdges.length > 0) {
    const longestEdge = validEdges[0];
    const { eg, iv0, iv1 } = longestEdge;
    const edgeLen = Math.hypot(iv1[0] - iv0[0], iv1[1] - iv0[1]);

    // Compute total length needed for all items along the edge direction
    // Each item's footprint along edge = max(w, h) projected onto edge dir
    const totalNeeded = corridorItems.reduce((sum, item) => sum + Math.max(item.w, item.h), 0)
      + ITEM_GAP * (corridorItems.length - 1);

    // Start offset to center the row along the edge
    const startT = Math.max(0.05, (1 - totalNeeded / edgeLen) / 2);
    let cursor = startT * edgeLen; // distance along edge from iv0

    for (const item of corridorItems) {
      const itemLen = Math.max(item.w, item.h);
      // Diagonal radius: center-to-corner distance + 2ft clearance
      const diagRadius = Math.sqrt((item.w / 2) ** 2 + (item.h / 2) ** 2) + 2;
      const insetOffset = Math.max(COURTYARD_GAP / 2, diagRadius);
      const t = (cursor + itemLen / 2) / edgeLen;
      const cx = iv0[0] + t * (iv1[0] - iv0[0]) + insetOffset * eg.normX;
      const cy = iv0[1] + t * (iv1[1] - iv0[1]) + insetOffset * eg.normY;

      if (!rectOverlapsAny(cx, cy, item.w, item.h, item.id)) {
        spaces.push(createSpace(item.id, item.type, item.name, floorIdx, cx, cy, item.w, item.h, item.isVert));
      } else {
        // Fallback: scan all edges at fine steps
        let placed = false;
        for (const ve of validEdges) {
          const veLen = Math.hypot(ve.iv1[0] - ve.iv0[0], ve.iv1[1] - ve.iv0[1]);
          const veOffset = Math.max(COURTYARD_GAP / 2, diagRadius);
          for (let d = itemLen / 2 + ITEM_GAP; d <= veLen - itemLen / 2; d += 2) {
            const ft = d / veLen;
            const nx = ve.iv0[0] + ft * (ve.iv1[0] - ve.iv0[0]) + veOffset * ve.eg.normX;
            const ny = ve.iv0[1] + ft * (ve.iv1[1] - ve.iv0[1]) + veOffset * ve.eg.normY;
            if (!rectOverlapsAny(nx, ny, item.w, item.h, item.id)) {
              spaces.push(createSpace(item.id, item.type, item.name, floorIdx, nx, ny, item.w, item.h, item.isVert));
              placed = true;
              break;
            }
          }
          if (placed) break;
        }
        // If no valid position found, skip this item rather than forcing an overlap
      }
      cursor += itemLen + ITEM_GAP;
    }
  }

  // ---- Step 6: Fill remaining empty space with misc rooms (residential floors only) ----
  if (floorIdx > 0) {
    const MISC_W = 10, MISC_H = 12;
    const bb = getBoundingBox(boundary);
    const SCAN_STEP = 4;
    let miscCount = 0;
    let foundAny = true;
    while (foundAny) {
      foundAny = false;
      for (let gx = bb.minX + MISC_W / 2 + 3; gx <= bb.maxX - MISC_W / 2 - 3; gx += SCAN_STEP) {
        for (let gy = bb.minY + MISC_H / 2 + 3; gy <= bb.maxY - MISC_H / 2 - 3; gy += SCAN_STEP) {
          if (!rectOverlapsAny(gx, gy, MISC_W, MISC_H, `misc_${miscCount}_f${floorIdx}`)) {
            spaces.push(createSpace(
              `misc_${miscCount}_f${floorIdx}`, 'SUPPORT', 'Misc', floorIdx,
              gx, gy, MISC_W, MISC_H, false
            ));
            miscCount++;
            foundAny = true;
          }
        }
      }
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
  totalResidentialFloors: number,
  coreWidth: number,
  coreHeight: number  // Actual core height (rectangular, not square)
): void {
  // Constants
  const MARGIN = 5;           // 5ft setback from property line
  const UNIT_GAP = 0.5;       // Minimal gap between units
  const CORRIDOR_WIDTH = 5;   // Narrow corridor

  const h = halfSide;         // Half of floor plate side

  // ========================================
  // INSIDE-OUT ZONE COMPUTATION
  // Rectangular core → asymmetric unit depths
  // ========================================

  // Zone 1: CORE - rectangular (coreWidth × coreHeight)
  const coreHalfW = coreWidth / 2;
  const coreHalfH = coreHeight / 2;

  // Zone 2: CORRIDOR - wraps around core
  const corridorOuterW = coreHalfW + CORRIDOR_WIDTH;  // For E/W sides
  const corridorOuterH = coreHalfH + CORRIDOR_WIDTH;  // For N/S sides

  // Zone 3: UNITS - asymmetric depths based on rectangular core
  const unitOuter = h - MARGIN;  // Outer edge at property setback
  const UNIT_DEPTH_NS = Math.max(15, unitOuter - corridorOuterH);  // N/S sides (shorter core dim)
  const UNIT_DEPTH_EW = Math.max(15, unitOuter - corridorOuterW);  // E/W sides (wider core dim)

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
  const shortSideLength = 2 * corridorOuterH;  // E/W sides span corridor height
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
        depth: 0,  // depth set per-side during placement
      });
    }
    typeIdx++;
  }

  // Place support rooms at the ENDS of corridor segments (adjacent to corridor ring)
  // This keeps them out of the unit zone and out of the core elements
  const SUPPORT_W = 5;
  const SUPPORT_H = CORRIDOR_WIDTH;  // Match corridor height for clean look

  // Place at the east/west ends of the N and S corridor segments
  // N corridor: centered at Y = -corridorOuterH + CORRIDOR_WIDTH/2
  // S corridor: centered at Y = +corridorOuterH - CORRIDOR_WIDTH/2
  const nCorridorY = -corridorOuterH + CORRIDOR_WIDTH / 2;
  const sCorridorY =  corridorOuterH - CORRIDOR_WIDTH / 2;
  // East end of corridor = corridorOuterW (where E corridor meets)
  // Place support rooms just beyond the E/W corridor segments
  const supportEastX = corridorOuterW + SUPPORT_W / 2;
  const supportWestX = -corridorOuterW - SUPPORT_W / 2;

  const supportPositions = [
    { id: `trash_f${floorIdx}`, name: 'Trash',  x: supportEastX, y: nCorridorY },
    { id: `mech_f${floorIdx}`,  name: 'Mech',   x: supportEastX, y: sCorridorY },
    { id: `stor_f${floorIdx}`,  name: 'Stor',   x: supportWestX, y: nCorridorY },
    { id: `elec_f${floorIdx}`,  name: 'Elec',   x: supportWestX, y: sCorridorY },
  ];

  // Pre-register support room bounds for collision detection with units
  const supportBounds: BoundingBox[] = supportPositions.map(s => ({
    x: s.x, y: s.y, width: SUPPORT_W, height: SUPPORT_H
  }));

  for (const s of supportPositions) {
    spaces.push(createSpace(s.id, 'SUPPORT', s.name, floorIdx, s.x, s.y, SUPPORT_W, SUPPORT_H, false));
  }

  // ========================================
  // PLACE UNITS CONTINUOUSLY AROUND PERIMETER
  // All units touch exterior wall (windows)
  // WITH COLLISION DETECTION against core + support rooms
  // ========================================

  // Initialize collision detection with core + corridor ring + support rooms
  const placedBounds: BoundingBox[] = [
    { x: 0, y: 0, width: coreWidth, height: coreHeight },
    ...supportBounds
  ];

  let unitIndex = 0;

  // ========================================
  // NORTH SIDE - units facing north (windows on north edge)
  // Uses UNIT_DEPTH_NS (depth from north corridor to north wall)
  // ========================================
  const northY = -h + MARGIN + UNIT_DEPTH_NS / 2;
  let northX = -h + MARGIN;

  while (unitIndex < unitQueue.length && northX + unitQueue[unitIndex].width <= h - MARGIN) {
    const unit = unitQueue[unitIndex];
    const unitBounds: BoundingBox = {
      x: northX + unit.width / 2,
      y: northY,
      width: unit.width,
      height: UNIT_DEPTH_NS
    };
    if (!hasOverlap(unitBounds, placedBounds, 0)) {
      placedBounds.push(unitBounds);
      spaces.push(createSpace(
        `unit_${unit.type}_${unitIndex}_f${floorIdx}`,
        'DWELLING_UNIT', unit.name, floorIdx,
        unitBounds.x, unitBounds.y, unit.width, UNIT_DEPTH_NS, false
      ));
    }
    northX += unit.width + UNIT_GAP;
    unitIndex++;
  }

  // ========================================
  // EAST SIDE - units facing east (windows on east edge)
  // Uses UNIT_DEPTH_EW; span from -corridorOuterH to +corridorOuterH
  // ========================================
  const eastX = h - MARGIN - UNIT_DEPTH_EW / 2;
  let eastY = -corridorOuterH;

  while (unitIndex < unitQueue.length && eastY + unitQueue[unitIndex].width <= corridorOuterH) {
    const unit = unitQueue[unitIndex];
    const unitBounds: BoundingBox = {
      x: eastX,
      y: eastY + unit.width / 2,
      width: UNIT_DEPTH_EW,
      height: unit.width
    };
    if (!hasOverlap(unitBounds, placedBounds, 0)) {
      placedBounds.push(unitBounds);
      spaces.push(createSpace(
        `unit_${unit.type}_${unitIndex}_f${floorIdx}`,
        'DWELLING_UNIT', unit.name, floorIdx,
        unitBounds.x, unitBounds.y, UNIT_DEPTH_EW, unit.width, false
      ));
    }
    eastY += unit.width + UNIT_GAP;
    unitIndex++;
  }

  // ========================================
  // SOUTH SIDE - units facing south (windows on south edge)
  // Uses UNIT_DEPTH_NS
  // ========================================
  const southY = h - MARGIN - UNIT_DEPTH_NS / 2;
  let southX = h - MARGIN;

  while (unitIndex < unitQueue.length && southX - unitQueue[unitIndex].width >= -h + MARGIN) {
    const unit = unitQueue[unitIndex];
    southX -= unit.width;
    const unitBounds: BoundingBox = {
      x: southX + unit.width / 2,
      y: southY,
      width: unit.width,
      height: UNIT_DEPTH_NS
    };
    if (!hasOverlap(unitBounds, placedBounds, 0)) {
      placedBounds.push(unitBounds);
      spaces.push(createSpace(
        `unit_${unit.type}_${unitIndex}_f${floorIdx}`,
        'DWELLING_UNIT', unit.name, floorIdx,
        unitBounds.x, unitBounds.y, unit.width, UNIT_DEPTH_NS, false
      ));
    }
    southX -= UNIT_GAP;
    unitIndex++;
  }

  // ========================================
  // WEST SIDE - units facing west (windows on west edge)
  // Uses UNIT_DEPTH_EW; span from -corridorOuterH to +corridorOuterH
  // ========================================
  const westX = -h + MARGIN + UNIT_DEPTH_EW / 2;
  let westY = corridorOuterH;

  while (unitIndex < unitQueue.length && westY - unitQueue[unitIndex].width >= -corridorOuterH) {
    const unit = unitQueue[unitIndex];
    westY -= unit.width;
    const unitBounds: BoundingBox = {
      x: westX,
      y: westY + unit.width / 2,
      width: UNIT_DEPTH_EW,
      height: unit.width
    };
    if (!hasOverlap(unitBounds, placedBounds, 0)) {
      placedBounds.push(unitBounds);
      spaces.push(createSpace(
        `unit_${unit.type}_${unitIndex}_f${floorIdx}`,
        'DWELLING_UNIT', unit.name, floorIdx,
        unitBounds.x, unitBounds.y, UNIT_DEPTH_EW, unit.width, false
      ));
    }
    westY -= UNIT_GAP;
    unitIndex++;
  }

  // Corridor is implicit — the gap between units and core IS the corridor.
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
