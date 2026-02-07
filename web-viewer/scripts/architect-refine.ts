/**
 * Architect Refinement Tool
 *
 * Takes a floor plan with overlaps and refines it by:
 * 1. Identifying overlapping spaces
 * 2. Calculating optimal positions
 * 3. Updating the JSON
 */

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.join(__dirname, '../public/data');

interface RectGeometry {
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
}

interface SpaceData {
  id: string;
  type: string;
  name: string;
  floor_index: number;
  geometry: RectGeometry;
  target_area_sf: number;
  actual_area_sf: number;
  membership: number;
  area_deviation: string;
  is_vertical: boolean;
}

interface FloorData {
  floor_index: number;
  floor_type: string;
  boundary: number[][];
  area_sf: number;
  spaces: SpaceData[];
}

interface SolverResult {
  success: boolean;
  obstruction: number;
  iterations: number;
  message: string;
  violations: string[];
  metrics: any;
  building: {
    floors: FloorData[];
    stalks: any[];
    metrics: any;
  };
}

// =============================================================================
// OVERLAP DETECTION & RESOLUTION
// =============================================================================

function getSpaceBounds(space: SpaceData) {
  const g = space.geometry;
  return {
    left: g.x - g.width / 2,
    right: g.x + g.width / 2,
    top: g.y - g.height / 2,
    bottom: g.y + g.height / 2,
    centerX: g.x,
    centerY: g.y,
  };
}

function getOverlap(a: SpaceData, b: SpaceData): number {
  const ab = getSpaceBounds(a);
  const bb = getSpaceBounds(b);

  const overlapX = Math.max(0, Math.min(ab.right, bb.right) - Math.max(ab.left, bb.left));
  const overlapY = Math.max(0, Math.min(ab.bottom, bb.bottom) - Math.max(ab.top, bb.top));

  return overlapX * overlapY;
}

function findOverlappingPairs(floor: FloorData): Array<[SpaceData, SpaceData, number]> {
  const pairs: Array<[SpaceData, SpaceData, number]> = [];

  for (let i = 0; i < floor.spaces.length; i++) {
    for (let j = i + 1; j < floor.spaces.length; j++) {
      const overlap = getOverlap(floor.spaces[i], floor.spaces[j]);
      if (overlap > 0.5) {
        pairs.push([floor.spaces[i], floor.spaces[j], overlap]);
      }
    }
  }

  return pairs;
}

// =============================================================================
// ARCHITECTURAL REFINEMENT STRATEGIES
// =============================================================================

/**
 * Strategy 1: Push units away from core/corridors
 * For P9's small floor plate, the corridors are overlapping with units.
 * Solution: Move units outward to the perimeter.
 */
function pushUnitsToPerimeter(floor: FloorData): number {
  const boundary = floor.boundary;
  const xs = boundary.map(p => p[0]);
  const ys = boundary.map(p => p[1]);

  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);

  const MARGIN = 2;
  let adjustments = 0;

  // Get corridor and core spaces
  const corridors = floor.spaces.filter(s => s.type === 'CIRCULATION' && s.name.includes('Corridor'));
  const core = floor.spaces.filter(s =>
    s.type === 'CIRCULATION' && (s.name.includes('Stair') || s.name.includes('Elevator'))
  );

  // Get the core bounding box
  let coreMinX = Infinity, coreMaxX = -Infinity;
  let coreMinY = Infinity, coreMaxY = -Infinity;

  for (const c of [...corridors, ...core]) {
    const b = getSpaceBounds(c);
    coreMinX = Math.min(coreMinX, b.left);
    coreMaxX = Math.max(coreMaxX, b.right);
    coreMinY = Math.min(coreMinY, b.top);
    coreMaxY = Math.max(coreMaxY, b.bottom);
  }

  console.log(`  Core bounds: X[${coreMinX.toFixed(1)}, ${coreMaxX.toFixed(1)}] Y[${coreMinY.toFixed(1)}, ${coreMaxY.toFixed(1)}]`);

  // For each dwelling unit, ensure it doesn't overlap with core
  for (const unit of floor.spaces.filter(s => s.type === 'DWELLING_UNIT')) {
    const b = getSpaceBounds(unit);

    // Check which side the unit is on and push it outward
    const distToNorth = b.top - minY;
    const distToSouth = maxY - b.bottom;
    const distToEast = maxX - b.right;
    const distToWest = b.left - minX;

    const minDist = Math.min(distToNorth, distToSouth, distToEast, distToWest);

    // If unit overlaps with core, push it outward
    const overlapsCore =
      b.right > coreMinX && b.left < coreMaxX &&
      b.bottom > coreMinY && b.top < coreMaxY;

    if (overlapsCore) {
      // Determine push direction based on which perimeter is closest
      if (minDist === distToNorth) {
        // Push north
        const newY = minY + MARGIN + unit.geometry.height / 2;
        console.log(`  Pushing ${unit.id} north: ${unit.geometry.y.toFixed(1)} → ${newY.toFixed(1)}`);
        unit.geometry.y = newY;
        adjustments++;
      } else if (minDist === distToSouth) {
        // Push south
        const newY = maxY - MARGIN - unit.geometry.height / 2;
        console.log(`  Pushing ${unit.id} south: ${unit.geometry.y.toFixed(1)} → ${newY.toFixed(1)}`);
        unit.geometry.y = newY;
        adjustments++;
      } else if (minDist === distToEast) {
        // Push east
        const newX = maxX - MARGIN - unit.geometry.width / 2;
        console.log(`  Pushing ${unit.id} east: ${unit.geometry.x.toFixed(1)} → ${newX.toFixed(1)}`);
        unit.geometry.x = newX;
        adjustments++;
      } else {
        // Push west
        const newX = minX + MARGIN + unit.geometry.width / 2;
        console.log(`  Pushing ${unit.id} west: ${unit.geometry.x.toFixed(1)} → ${newX.toFixed(1)}`);
        unit.geometry.x = newX;
        adjustments++;
      }
    }
  }

  return adjustments;
}

/**
 * Strategy 2: Shrink core size for small floor plates
 */
function shrinkCoreForSmallPlate(floor: FloorData): number {
  const boundary = floor.boundary;
  const xs = boundary.map(p => p[0]);
  const ys = boundary.map(p => p[1]);

  const floorWidth = Math.max(...xs) - Math.min(...xs);
  const floorHeight = Math.max(...ys) - Math.min(...ys);
  const floorSize = Math.min(floorWidth, floorHeight);

  // For floors smaller than 120', shrink corridors
  if (floorSize < 120) {
    const shrinkFactor = floorSize / 150; // Proportional shrink

    let adjustments = 0;
    for (const space of floor.spaces) {
      if (space.type === 'CIRCULATION' && space.name.includes('Corridor')) {
        const oldWidth = space.geometry.width;
        const oldHeight = space.geometry.height;

        // Shrink the smaller dimension (corridor width)
        if (space.geometry.width < space.geometry.height) {
          space.geometry.width = Math.max(4, space.geometry.width * shrinkFactor);
        } else {
          space.geometry.height = Math.max(4, space.geometry.height * shrinkFactor);
        }

        console.log(`  Shrinking corridor ${space.id}: ${oldWidth.toFixed(1)}x${oldHeight.toFixed(1)} → ${space.geometry.width.toFixed(1)}x${space.geometry.height.toFixed(1)}`);
        adjustments++;
      }
    }

    return adjustments;
  }

  return 0;
}

/**
 * Strategy 3: Remove units that can't fit without overlap
 */
function removeOverflowUnits(floor: FloorData): SpaceData[] {
  const removed: SpaceData[] = [];
  const nonDwellings = floor.spaces.filter(s => s.type !== 'DWELLING_UNIT');
  const dwellings = floor.spaces.filter(s => s.type === 'DWELLING_UNIT');

  // Sort dwellings by distance from center (remove outer ones first if they overlap)
  dwellings.sort((a, b) => {
    const distA = Math.sqrt(a.geometry.x ** 2 + a.geometry.y ** 2);
    const distB = Math.sqrt(b.geometry.x ** 2 + b.geometry.y ** 2);
    return distA - distB; // Keep inner ones
  });

  const kept: SpaceData[] = [];

  for (const unit of dwellings) {
    // Check if this unit overlaps with any non-dwelling or already-kept dwelling
    let hasOverlap = false;

    for (const other of [...nonDwellings, ...kept]) {
      if (getOverlap(unit, other) > 0.5) {
        hasOverlap = true;
        break;
      }
    }

    if (hasOverlap) {
      console.log(`  Removing overlapping unit: ${unit.id}`);
      removed.push(unit);
    } else {
      kept.push(unit);
    }
  }

  // Update floor spaces
  floor.spaces = [...nonDwellings, ...kept];

  return removed;
}

/**
 * Strategy 4: Repack units using greedy perimeter placement
 */
function repackPerimeter(floor: FloorData): number {
  const boundary = floor.boundary;
  const xs = boundary.map(p => p[0]);
  const ys = boundary.map(p => p[1]);

  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);

  const MARGIN = 2;
  const GAP = 0.5;

  // Get non-dwelling spaces (keep as-is)
  const fixed = floor.spaces.filter(s => s.type !== 'DWELLING_UNIT');

  // Get dwelling units to repack
  const units = floor.spaces.filter(s => s.type === 'DWELLING_UNIT');

  if (units.length === 0) return 0;

  // Get the core area to avoid
  const corridors = fixed.filter(s => s.type === 'CIRCULATION');
  let coreMinX = Infinity, coreMaxX = -Infinity;
  let coreMinY = Infinity, coreMaxY = -Infinity;

  for (const c of corridors) {
    const b = getSpaceBounds(c);
    coreMinX = Math.min(coreMinX, b.left - 2);
    coreMaxX = Math.max(coreMaxX, b.right + 2);
    coreMinY = Math.min(coreMinY, b.top - 2);
    coreMaxY = Math.max(coreMaxY, b.bottom + 2);
  }

  // Calculate unit depth (from perimeter to core)
  const unitDepth = Math.min(
    (coreMinX - minX - MARGIN) * 0.9,
    (maxX - coreMaxX - MARGIN) * 0.9,
    (coreMinY - minY - MARGIN) * 0.9,
    (maxY - coreMaxY - MARGIN) * 0.9
  );

  console.log(`  Repacking with unit depth: ${unitDepth.toFixed(1)}'`);

  // Place units around perimeter
  let placedCount = 0;
  let unitIndex = 0;

  // NORTH side
  let currentX = minX + MARGIN;
  while (unitIndex < units.length && currentX + units[unitIndex].geometry.width < maxX - MARGIN) {
    const unit = units[unitIndex];
    unit.geometry.x = currentX + unit.geometry.width / 2;
    unit.geometry.y = minY + MARGIN + unitDepth / 2;
    unit.geometry.height = unitDepth;
    currentX += unit.geometry.width + GAP;
    placedCount++;
    unitIndex++;
  }

  // SOUTH side
  currentX = maxX - MARGIN;
  while (unitIndex < units.length && currentX - units[unitIndex].geometry.width > minX + MARGIN) {
    const unit = units[unitIndex];
    currentX -= unit.geometry.width;
    unit.geometry.x = currentX + unit.geometry.width / 2;
    unit.geometry.y = maxY - MARGIN - unitDepth / 2;
    unit.geometry.height = unitDepth;
    currentX -= GAP;
    placedCount++;
    unitIndex++;
  }

  // EAST side
  let currentY = minY + MARGIN + unitDepth;
  while (unitIndex < units.length && currentY + units[unitIndex].geometry.width < maxY - MARGIN - unitDepth) {
    const unit = units[unitIndex];
    unit.geometry.x = maxX - MARGIN - unitDepth / 2;
    unit.geometry.y = currentY + unit.geometry.width / 2;
    // Rotate for east side
    const temp = unit.geometry.width;
    unit.geometry.width = unitDepth;
    unit.geometry.height = temp;
    currentY += unit.geometry.height + GAP;
    placedCount++;
    unitIndex++;
  }

  // WEST side
  currentY = maxY - MARGIN - unitDepth;
  while (unitIndex < units.length && currentY - units[unitIndex].geometry.width > minY + MARGIN + unitDepth) {
    const unit = units[unitIndex];
    currentY -= unit.geometry.width;
    unit.geometry.x = minX + MARGIN + unitDepth / 2;
    unit.geometry.y = currentY + unit.geometry.width / 2;
    // Rotate for west side
    const temp = unit.geometry.width;
    unit.geometry.width = unitDepth;
    unit.geometry.height = temp;
    currentY -= GAP;
    placedCount++;
    unitIndex++;
  }

  // Remove unplaced units
  const placedUnits = units.slice(0, placedCount);
  floor.spaces = [...fixed, ...placedUnits];

  console.log(`  Placed ${placedCount}/${units.length} units`);

  return placedCount;
}

// =============================================================================
// MAIN REFINEMENT PIPELINE
// =============================================================================

async function refineProject(projectId: string): Promise<void> {
  const outputPath = path.join(DATA_DIR, `${projectId}_output.json`);

  if (!fs.existsSync(outputPath)) {
    console.log(`  ${projectId}: output file not found`);
    return;
  }

  const result: SolverResult = JSON.parse(fs.readFileSync(outputPath, 'utf-8'));

  console.log(`\n${'═'.repeat(60)}`);
  console.log(`Refining ${projectId.toUpperCase()}`);
  console.log('═'.repeat(60));

  let totalAdjustments = 0;

  for (const floor of result.building.floors) {
    if (floor.floor_type !== 'RESIDENTIAL_TYPICAL') continue;

    const overlaps = findOverlappingPairs(floor);
    if (overlaps.length === 0) continue;

    console.log(`\nFloor ${floor.floor_index}: ${overlaps.length} overlaps detected`);

    // Apply refinement strategies
    const pushed = pushUnitsToPerimeter(floor);
    totalAdjustments += pushed;

    // Check remaining overlaps
    const remainingOverlaps = findOverlappingPairs(floor);
    if (remainingOverlaps.length > 0) {
      console.log(`  Still ${remainingOverlaps.length} overlaps, trying repack...`);
      const repacked = repackPerimeter(floor);
      totalAdjustments += repacked;
    }

    // Final check
    const finalOverlaps = findOverlappingPairs(floor);
    if (finalOverlaps.length > 0) {
      console.log(`  Removing ${finalOverlaps.length} remaining overlapping units...`);
      const removed = removeOverflowUnits(floor);
      totalAdjustments += removed.length;
    }
  }

  // Also fix parking floors
  for (const floor of result.building.floors) {
    if (!floor.floor_type.includes('PARKING')) continue;

    const overlaps = findOverlappingPairs(floor);
    if (overlaps.length === 0) continue;

    console.log(`\nFloor ${floor.floor_index} (Parking): ${overlaps.length} overlaps`);

    // For parking, just remove overlapping support spaces
    const removed = removeOverflowUnits(floor);
    totalAdjustments += removed.length;
  }

  if (totalAdjustments > 0) {
    // Save refined output
    const refinedPath = path.join(DATA_DIR, `${projectId}_output.json`);
    fs.writeFileSync(refinedPath, JSON.stringify(result, null, 2));
    console.log(`\n✅ Saved refined output: ${refinedPath}`);
    console.log(`   Total adjustments: ${totalAdjustments}`);
  } else {
    console.log(`\n✅ No adjustments needed`);
  }
}

async function main() {
  console.log('='.repeat(60));
  console.log('ARCHITECT REFINEMENT TOOL');
  console.log('='.repeat(60));

  const projects = ['p1', 'p4', 'p7', 'p9'];

  for (const project of projects) {
    await refineProject(project);
  }

  console.log('\n' + '='.repeat(60));
  console.log('Refinement Complete');
  console.log('='.repeat(60));
}

main().catch(console.error);
