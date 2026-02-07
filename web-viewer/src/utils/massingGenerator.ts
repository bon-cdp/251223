/**
 * Massing Algorithm Selector
 *
 * Allows switching between legacy perimeter packing and new Phase 2 grid-based algorithms.
 * Legacy: Simple, deterministic, perimeter-based placement
 * Phase 2: Grid-based with corridor routing, Voronoi partitioning
 */

import type {
  SolverResult,
  FloorData,
  SpaceData,
  RectGeometry,
  BuildingInput,
  DwellingUnit,
} from "../types/solverOutput";
import type {
  Polygon,
  ShapeDimensions,
  SetbackConfig,
  GridCell,
} from "./massing/types";
import {
  RectangleShape,
  CourtyardShape,
  DonutShape,
  HShape,
  TShape,
} from "./massing/shape";
import { fitGridToShape } from "./massing/shape/gridFitting";
import { MassingGrid } from "./massing/grid/MassingGrid";
import { UnitGrower } from "./massing/placement/unitGrower";
import {
  VoronPartitioner,
  VoronoiRegion,
} from "./massing/placement/VoronPartitioner";
import { computePolygonArea } from "./massing/grid/vectorization";
import type { ExtractedBuildingData } from "../components/data/PdfUploader";

export type MassingAlgorithm = "legacy" | "phase2";

export interface MassingConfig {
  algorithm: MassingAlgorithm;
  shape?: "rectangle" | "courtyard" | "donut" | "h-shape" | "t-shape";
  shapeDimensions?: ShapeDimensions;
  setbacks?: SetbackConfig;
  corridorWidth?: number;
  gridSize?: number;
}

export interface MassingResult {
  algorithm: MassingAlgorithm;
  result: SolverResult;
  metrics: {
    generationTime: number;
    coverage: number;
    corridorAccessScore: number;
    exteriorAccessScore: number;
  };
}

export async function generateMassing(
  buildingData: BuildingInput,
  config: MassingConfig = { algorithm: "legacy" },
): Promise<MassingResult> {
  const startTime = performance.now();

  let result: SolverResult;

  if (config.algorithm === "phase2") {
    result = await generatePhase2Result(buildingData, config);
  } else {
    result = await generateLegacyResult(buildingData);
  }

  const duration = performance.now() - startTime;

  return {
    algorithm: config.algorithm,
    result,
    metrics: {
      generationTime: duration,
      coverage: computeCoverage(result),
      corridorAccessScore: computeCorridorAccessScore(result),
      exteriorAccessScore: computeExteriorAccessScore(result),
    },
  };
}

async function generatePhase2Result(
  buildingData: BuildingInput,
  config: MassingConfig,
): Promise<SolverResult> {
  const shapeConfig = config.shapeDimensions || {
    width: 140,
    height: 140,
    courtyardWidth: 50,
    courtyardDepth: 50,
  };

  // const setbacks = config.setbacks || {
  //   front: 10,
  //   rear: 10,
  //   side: 10,
  // };

  const shape = config.shape || "rectangle";
  const corridorWidth = config.corridorWidth || 6;

  let generator;
  switch (shape) {
    case "courtyard":
      generator = new CourtyardShape();
      break;
    case "donut":
      generator = new DonutShape();
      break;
    case "h-shape":
      generator = new HShape();
      break;
    case "t-shape":
      generator = new TShape();
      break;
    default:
      generator = new RectangleShape();
  }

  const massingShape = generator.generate(shapeConfig);

  const fittingResult = fitGridToShape(massingShape.outline);

  if (!fittingResult) {
    throw new Error("Failed to fit grid to shape");
  }

  const { grid, fittedRectangle } = fittingResult;

  await grid.setupCorridors(fittingResult.fittedRectangle, corridorWidth);

  const units = buildingData.dwelling_units || [];
  const circulation = buildingData.circulation;
  const support = buildingData.support || [];

  const targetAreas = units.map((u) => u.area_sf);

  const partitioner = new VoronPartitioner(grid);
  const regions = partitioner.balancedPartition(targetAreas);

  const floors: FloorData[] = [];
  const numFloorsAbove = buildingData.building?.stories_above_grade || 7;
  const numFloorsBelow = buildingData.building?.stories_below_grade || 1;

  // const unitCounter: Record<string, number> = {
  //   studio: 0,
  //   "1br": 0,
  //   "2br": 0,
  //   "3br": 0,
  // };

  for (let floorIdx = -numFloorsBelow; floorIdx < numFloorsAbove; floorIdx++) {
    let floorType: string;

    if (floorIdx < 0) {
      floorType = "PARKING_UNDERGROUND";
    } else if (floorIdx === 0) {
      floorType = "GROUND";
    } else {
      floorType = "RESIDENTIAL_TYPICAL";
    }

    const spaces: SpaceData[] = [];

    const elevatorX = -4;
    const stairX1 = -16;
    const stairX2 = 16;

    if (floorIdx < 0) {
      spaces.push(
        createVerticalSpace("stair_1", "Stair 1", floorIdx, stairX1, 0, 10, 12),
      );
      spaces.push(
        createVerticalSpace(
          "elevator_1",
          "Elevator 1",
          floorIdx,
          elevatorX,
          0,
          8,
          8,
        ),
      );
      spaces.push(
        createVerticalSpace(
          "elevator_2",
          "Elevator 2",
          floorIdx,
          elevatorX + 8,
          0,
          8,
          8,
        ),
      );
      spaces.push(
        createVerticalSpace("stair_2", "Stair 2", floorIdx, stairX2, 0, 10, 12),
      );

      const parkingSpaces = generateParkingSpaces(
        floorIdx,
        circulation,
        buildingData.parking,
      );
      spaces.push(...parkingSpaces);
    } else {
      spaces.push(
        createVerticalSpace("stair_1", "Stair 1", floorIdx, stairX1, 0, 10, 12),
      );
      spaces.push(
        createVerticalSpace(
          "elevator_1",
          "Elevator 1",
          floorIdx,
          elevatorX,
          0,
          8,
          8,
        ),
      );
      spaces.push(
        createVerticalSpace(
          "elevator_2",
          "Elevator 2",
          floorIdx,
          elevatorX + 8,
          0,
          8,
          8,
        ),
      );
      spaces.push(
        createVerticalSpace("stair_2", "Stair 2", floorIdx, stairX2, 0, 10, 12),
      );

      if (floorIdx === 0) {
        const groundSpaces = generateGroundSupportSpaces(floorIdx, support);
        spaces.push(...groundSpaces);
      } else {
        const corridorSpaces = generateCorridorSpaces(floorIdx, grid);
        spaces.push(...corridorSpaces);

        const unitSpaces = generateResidentialUnitsPhase2(
          floorIdx,
          grid,
          units,
          regions,
        );
        spaces.push(...unitSpaces);
      }
    }

    // Convert polygon to bounds for floor boundary
    const bounds = computePolygonBounds(fittedRectangle);
    const width = bounds.maxX - bounds.minX;
    const height = bounds.maxY - bounds.minY;

    floors.push({
      floor_index: floorIdx,
      floor_type: floorType,
      boundary: convertToCenterOriginBoundary({ width, height }),
      area_sf: computePolygonArea(massingShape.outline),
      spaces,
    });
  }

  const totalSpaces = floors.reduce(
    (sum: number, f) => sum + f.spaces.length,
    0,
  );

  return {
    success: true,
    obstruction: 0,
    iterations: 1,
    message: `Generated using Phase 2 ${config.shape} massing algorithm`,
    violations: [],
    metrics: {
      placement_rate: "100.0%",
      avg_membership: "1.00",
      total_spaces: totalSpaces,
      placed_spaces: totalSpaces,
    },
    building: {
      floors,
      stalks: [],
      metrics: {
        total_floors: numFloorsAbove + numFloorsBelow,
        total_spaces: totalSpaces,
        cohomology_obstruction: 0,
      },
    },
  };
}

function createVerticalSpace(
  id: string,
  name: string,
  floorIndex: number,
  x: number,
  y: number,
  width: number,
  height: number,
): SpaceData {
  return {
    id: `${id}_f${floorIndex}`,
    type: "CIRCULATION",
    name,
    floor_index: floorIndex,
    geometry: { x, y, width, height, rotation: 0 } as RectGeometry,
    target_area_sf: width * height,
    actual_area_sf: width * height,
    membership: 1,
    area_deviation: "+0.0%",
    is_vertical: true,
  };
}

function generateCorridorSpaces(
  floorIndex: number,
  grid: MassingGrid,
): SpaceData[] {
  const spaces: SpaceData[] = [];
  const corridorCells = grid.getCells().filter((c) => c.isCorridor);

  const corridorGroups = groupContiguousCorridorCells(corridorCells, grid);

  corridorGroups.forEach((group, i) => {
    if (group.length > 0) {
      const polygon = vectorizeCells(group, grid);
      const area = computePolygonArea(polygon);

      const bounds = computeGroupBounds(group, grid);

      const width = bounds.maxX - bounds.minX;
      const height = bounds.maxY - bounds.minY;
      const centerX = (bounds.minX + bounds.maxX) / 2;
      const centerY = (bounds.minY + bounds.maxY) / 2;

      spaces.push({
        id: `corridor_${["n", "s", "e", "w"][i] || "main"}_f${floorIndex}`,
        type: "CIRCULATION",
        name: "Corridor",
        floor_index: floorIndex,
        geometry: {
          x: centerX,
          y: centerY,
          width,
          height,
          rotation: 0,
        } as RectGeometry,
        target_area_sf: Math.round(area),
        actual_area_sf: Math.round(area),
        membership: 1,
        area_deviation: "+0.0%",
        is_vertical: false,
      });
    }
  });

  return spaces;
}

function groupContiguousCorridorCells(
  corridorCells: GridCell[],
  grid: MassingGrid,
): GridCell[][] {
  const visited = new Set<string>();
  const groups: GridCell[][] = [];

  for (const cell of corridorCells) {
    const key = `${cell.x},${cell.y}`;

    if (visited.has(key)) continue;

    const group: GridCell[] = [];
    const queue = [cell];
    visited.add(key);

    while (queue.length > 0) {
      const current = queue.shift()!;

      group.push(current);

      const neighbors = getNeighbors(current, grid);

      for (const neighbor of neighbors) {
        const neighborKey = `${neighbor.x},${neighbor.y}`;

        if (!visited.has(neighborKey) && neighbor.isCorridor) {
          visited.add(neighborKey);
          queue.push(neighbor);
        }
      }
    }

    if (group.length > 0) {
      groups.push(group);
    }
  }

  return groups;
}

function getNeighbors(cell: GridCell, grid: MassingGrid): GridCell[] {
  const neighbors: GridCell[] = [];
  const directions = [
    [0, -1],
    [1, 0],
    [0, 1],
    [-1, 0],
  ];

  for (const [dx, dy] of directions) {
    const neighbor = grid.getCell(cell.x + dx, cell.y + dy);
    if (neighbor) {
      neighbors.push(neighbor);
    }
  }

  return neighbors;
}

function computeGroupBounds(cells: GridCell[], grid: MassingGrid) {
  if (cells.length === 0) {
    return { minX: 0, minY: 0, maxX: 0, maxY: 0 };
  }

  const bounds = grid.getBounds();
  const cellSize = grid.getCellSize();

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const cell of cells) {
    const x = bounds.minX + cell.x * cellSize;
    const y = bounds.minY + cell.y * cellSize;

    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x);
    maxY = Math.max(maxY, y);
  }

  return { minX, minY, maxX, maxY };
}

function computePolygonBounds(polygon: Polygon) {
  const points = polygon.points;
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const p of points) {
    minX = Math.min(minX, p.x);
    minY = Math.min(minY, p.y);
    maxX = Math.max(maxX, p.x);
    maxY = Math.max(maxY, p.y);
  }

  return { minX, minY, maxX, maxY };
}

function generateResidentialUnitsPhase2(
  floorIndex: number,
  grid: MassingGrid,
  units: DwellingUnit[],
  regions: VoronoiRegion[],
): SpaceData[] {
  const spaces: SpaceData[] = [];
  const unitIndexStart: Record<string, number> = {
    studio: 0,
    "1br": 0,
    "2br": 0,
    "3br": 0,
  };

  for (
    let regionIdx = 0;
    regionIdx < regions.length && regionIdx < units.length;
    regionIdx++
  ) {
    const region = regions[regionIdx];
    const unit = units[regionIdx];

    if (!unit) continue;

    const unitType = unit.type;
    const targetArea = unit.area_sf;
    const grower = new UnitGrower(grid, targetArea, 0.1);

    const exteriorCells = region.cells.filter((c: GridCell) => c.isExterior);
    const seedCell =
      exteriorCells.length > 0
        ? exteriorCells[Math.floor(Math.random() * exteriorCells.length)]
        : region.cells[Math.floor(Math.random() * region.cells.length)];

    const unitCells = grower.growFromSeed(seedCell);

    if (unitCells.length === 0) continue;

    unitCells.forEach((cell: GridCell) => {
      grid.assignCell(
        cell.x,
        cell.y,
        `unit_${unitType}_${unitIndexStart[unitType]}_f${floorIndex}`,
      );
    });

    const unitPolygon = vectorizeCells(unitCells, grid);
    const actualArea = computePolygonArea(unitPolygon);
    const deviation = ((actualArea - targetArea) / targetArea) * 100;

    const bounds = computeGroupBounds(unitCells, grid);
    const width = bounds.maxX - bounds.minX;
    const height = bounds.maxY - bounds.minY;
    const centerX = (bounds.minX + bounds.maxX) / 2;
    const centerY = (bounds.minY + bounds.maxY) / 2;

    const unitId = `unit_${unitType}_${unitIndexStart[unitType]}_f${floorIndex}`;
    unitIndexStart[unitType]++;

    spaces.push({
      id: unitId,
      type: "DWELLING_UNIT",
      name: unit.name,
      floor_index: floorIndex,
      geometry: {
        x: centerX,
        y: centerY,
        width,
        height,
        rotation: 0,
      } as RectGeometry,
      target_area_sf: targetArea,
      actual_area_sf: Math.round(actualArea),
      membership: 1,
      area_deviation: `${deviation >= 0 ? "+" : ""}${deviation.toFixed(1)}%`,
      is_vertical: false,
    });
  }

  return spaces;
}

function generateGroundSupportSpaces(
  floorIndex: number,
  support: BuildingInput["support"],
): SpaceData[] {
  const spaces: SpaceData[] = [];

  const groundSupport =
    support?.filter((s) => s.floor === "ground" || !s.floor) ?? [];

  for (const space of groundSupport) {
    const side = Math.sqrt(space.area_sf);

    spaces.push({
      id: `${space.name.toLowerCase().replace(/[^a-z0-9]/g, "_")}_f${floorIndex}`,
      type: "SUPPORT",
      name: space.name,
      floor_index: floorIndex,
      geometry: {
        x: 30,
        y: 30 + spaces.length * 25,
        width: side,
        height: side,
        rotation: 0,
      } as RectGeometry,
      target_area_sf: space.area_sf,
      actual_area_sf: space.area_sf,
      membership: 1,
      area_deviation: "+0.0%",
      is_vertical: false,
    });
  }

  return spaces;
}

function generateParkingSpaces(
  floorIndex: number,
  circulation: BuildingInput["circulation"],
  parking: BuildingInput["parking"],
): SpaceData[] {
  const spaces: SpaceData[] = [];

  const driveAisleArea = circulation?.corridor_length_ft
    ? circulation.corridor_length_ft * 6
    : 1895;
  const driveAisleWidth = Math.sqrt(driveAisleArea) || 43.5;

  spaces.push({
    id: "drive_aisle_f-1",
    type: "CIRCULATION",
    name: "Drive Aisle",
    floor_index: floorIndex,
    geometry: {
      x: -10,
      y: 0,
      width: driveAisleWidth,
      height: 24,
      rotation: 0,
    } as RectGeometry,
    target_area_sf: driveAisleArea,
    actual_area_sf: driveAisleArea,
    membership: 1,
    area_deviation: "+0.0%",
    is_vertical: false,
  });

  const parkingCount = parking?.underground_stalls || 35;

  const parkingWidth = 8.5;
  const parkingHeight = 18;

  for (let p = 1; p <= parkingCount; p++) {
    const aisleSide = p <= 12 ? -1 : 1;

    spaces.push({
      id: `parking_${p}_f-1`,
      type: "PARKING",
      name: `P${p}`,
      floor_index: floorIndex,
      geometry: {
        x: -59.9 + (p - 1) * 8.5,
        y: aisleSide * 21,
        width: parkingWidth,
        height: parkingHeight,
        rotation: 0,
      } as RectGeometry,
      target_area_sf: 153,
      actual_area_sf: 153,
      membership: 1,
      area_deviation: "+0.0%",
      is_vertical: false,
    });
  }

  return spaces;
}

function vectorizeCells(cells: GridCell[], grid: MassingGrid): Polygon {
  const bounds = grid.getBounds();
  const cellSize = grid.getCellSize();

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const cell of cells) {
    const x = bounds.minX + cell.x * cellSize;
    const y = bounds.minY + cell.y * cellSize;

    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x);
    maxY = Math.max(maxY, y);
  }

  return {
    points: [
      { x: minX, y: minY },
      { x: maxX, y: minY },
      { x: maxX, y: maxY },
      { x: minX, y: maxY },
    ],
  };
}

function convertToCenterOriginBoundary(rect: {
  width: number;
  height: number;
}): number[][] {
  const halfWidth = rect.width / 2;
  const halfHeight = rect.height / 2;

  return [
    [-halfWidth, -halfHeight],
    [halfWidth, -halfHeight],
    [halfWidth, halfHeight],
    [-halfWidth, halfHeight],
  ];
}

function computeCoverage(result: SolverResult): number {
  const totalFloorArea = result.building.floors.reduce(
    (sum: number, f) => sum + f.area_sf,
    0,
  );

  const usedArea = result.building.floors.reduce(
    (sum: number, f) =>
      sum +
      f.spaces.reduce(
        (s: number, sp: SpaceData) => s + (sp.actual_area_sf || 0),
        0,
      ),
    0,
  );

  return (usedArea / totalFloorArea) * 100;
}

function computeCorridorAccessScore(result: SolverResult): number {
  const allSpaces = result.building.floors.flatMap((f: FloorData) => f.spaces);
  const nonCorridorSpaces = allSpaces.filter(
    (s: SpaceData) => s.type !== "CIRCULATION",
  );

  if (nonCorridorSpaces.length === 0) return 100;

  let accessibleCount = 0;

  for (const space of nonCorridorSpaces) {
    const isAccessible = checkCorridorAccess(space, result.building.floors);

    if (isAccessible) accessibleCount++;
  }

  return (accessibleCount / nonCorridorSpaces.length) * 100;
}

function checkCorridorAccess(space: SpaceData, floors: FloorData[]): boolean {
  const floor = floors.find(
    (f: FloorData) => f.floor_index === space.floor_index,
  );
  if (!floor) return true;

  const corridorSpaces = floor.spaces.filter(
    (s: SpaceData) => s.type === "CIRCULATION" && !s.is_vertical,
  );

  if (corridorSpaces.length === 0) return false;

  const geom = space.geometry as RectGeometry;
  const spaceCenter = { x: geom.x, y: geom.y };

  for (const corridor of corridorSpaces) {
    const corridorGeom = corridor.geometry as RectGeometry;
    const corridorCenter = { x: corridorGeom.x, y: corridorGeom.y };

    const dx = Math.abs(spaceCenter.x - corridorCenter.x);
    const dy = Math.abs(spaceCenter.y - corridorCenter.y);

    const combinedWidth = (geom.width + corridorGeom.width) / 2;
    const combinedHeight = (geom.height + corridorGeom.height) / 2;

    if (dx < combinedWidth && dy < combinedHeight) {
      return true;
    }
  }

  return false;
}

function computeExteriorAccessScore(result: SolverResult): number {
  const allSpaces = result.building.floors.flatMap((f: FloorData) => f.spaces);
  const unitSpaces = allSpaces.filter(
    (s: SpaceData) => s.type === "DWELLING_UNIT",
  );

  if (unitSpaces.length === 0) return 100;

  const floor = result.building.floors[0];
  if (!floor) return 100;

  const boundaryWidth = Math.sqrt(floor.area_sf);
  const halfBoundary = boundaryWidth / 2;

  let exteriorCount = 0;

  for (const space of unitSpaces) {
    const geom = space.geometry as RectGeometry;

    const spaceLeft = geom.x - geom.width / 2;
    const spaceRight = geom.x + geom.width / 2;
    const spaceTop = geom.y + geom.height / 2;
    const spaceBottom = geom.y - geom.height / 2;

    if (
      Math.abs(spaceLeft) >= halfBoundary - 2 ||
      Math.abs(spaceRight) >= halfBoundary - 2 ||
      Math.abs(spaceTop) >= halfBoundary - 2 ||
      Math.abs(spaceBottom) >= halfBoundary - 2
    ) {
      exteriorCount++;
    }
  }

  return (exteriorCount / unitSpaces.length) * 100;
}

async function generateLegacyResult(
  buildingData: BuildingInput,
): Promise<SolverResult> {
  const { generateSolverResultFromExtracted } =
    await import("./generateFromExtracted");

  return generateSolverResultFromExtracted({
    building_data: buildingData as unknown as ExtractedBuildingData,
  });
}
