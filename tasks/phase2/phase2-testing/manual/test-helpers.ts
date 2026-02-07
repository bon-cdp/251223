/**
 * Manual Testing Helper Functions
 *
 * Execute these functions in the browser DevTools console to test individual components.
 *
 * Usage:
 * 1. Open DevTools (F12 or Cmd+Opt+I)
 * 2. Go to Console tab
 * 3. Copy/paste functions or execute individually
 */

import { RectangleShape } from '../../src/utils/massing/shape/RectangleShape';
import { CourtyardShape } from '../../src/utils/massing/shape/CourtyardShape';
import { DonutShape } from '../../src/utils/massing/shape/DonutShape';
import { HShape } from '../../src/utils/massing/shape/HShape';
import { TShape } from '../../src/utils/massing/shape/TShape';
import { computeStraightSkeleton } from '../../src/utils/massing/skeleton/StraightSkeleton';
import { computeBalancedCorridors } from '../../src/utils/massing/skeleton/CorridorRouter';
import { MassingGrid } from '../../src/utils/massing/grid/MassingGrid';
import { UnitGrower } from '../../src/utils/massing/placement/unitGrower';
import { VoronPartitioner } from '../../src/utils/massing/placement/VoronPartitioner';
import { findLargestRectangle } from '../../src/utils/massing/shape/RectangleFitter';
import type { Polygon, ShapeDimensions } from '../../src/utils/massing/types';

export const ManualTestHelpers = {

  /**
   * Test shape generation
   */
  async testShapeGeneration(shape: string, dimensions: ShapeDimensions) {
    console.group(`🧪 Testing ${shape} shape generation`);

    let generator;

    switch (shape) {
      case 'rectangle':
        generator = new RectangleShape();
        break;
      case 'courtyard':
        generator = new CourtyardShape();
        break;
      case 'donut':
        generator = new DonutShape();
        break;
      case 'h-shape':
        generator = new HShape();
        break;
      case 't-shape':
        generator = new TShape();
        break;
      default:
        console.error('Unknown shape:', shape);
        return null;
    }

    const start = performance.now();
    const result = generator.generate(dimensions);
    const duration = performance.now() - start;

    console.log('Generated shape:', result);
    console.log(`⏱️  Generation time: ${duration.toFixed(2)}ms`);
    console.log(`📐 Vertex count: ${result.outline.points.length}`);

    if (result.interior) {
      console.log(`🕳️  Interior polygons: ${result.interior.length}`);
    }

    const area = this.computePolygonArea(result.outline);
    console.log(`📏  Area: ${area.toFixed(2)} sqft`);

    const isValid = this.validatePolygon(result.outline);
    console.log(`${isValid ? '✅' : '❌'} Polygon valid: ${isValid}`);

    console.groupEnd();

    return result;
  },

  /**
   * Test straight skeleton computation
   */
  async testSkeleton(polygon: Polygon, stepSize: number = 0.5) {
    console.group('🧪 Testing Straight Skeleton');

    const start = performance.now();
    const skeleton = await computeStraightSkeleton(polygon, stepSize);
    const duration = performance.now() - start;

    console.log(`⏱️  Computation time: ${duration.toFixed(2)}ms`);
    console.log(`📊 Node count: ${skeleton.nodes.length}`);
    console.log(`📊 Edge count: ${skeleton.edges.length}`);

    if (skeleton.nodes.length > 0) {
      console.log('First node:', skeleton.nodes[0]);
      console.log('Last node:', skeleton.nodes[skeleton.nodes.length - 1]);
    }

    console.groupEnd();

    return skeleton;
  },

  /**
   * Test corridor routing
   */
  async testCorridors(polygon: Polygon, corridorWidth: number = 6) {
    console.group('🧪 Testing Corridor Routing');

    const start = performance.now();
    const corridors = await computeBalancedCorridors(polygon, corridorWidth);
    const duration = performance.now() - start;

    console.log(`⏱️  Computation time: ${duration.toFixed(2)}ms`);
    console.log(`🛤️  Corridor segments: ${corridors.length}`);

    corridors.forEach((seg, i) => {
      console.log(`Segment ${i}: ${seg.points.length} points, width=${seg.width}ft`);
    });

    const totalLength = corridors.reduce((sum, seg) => {
      return sum + this.computePathLength(seg.points);
    }, 0);

    const corridorArea = totalLength * corridorWidth;
    console.log(`📏  Total corridor length: ${totalLength.toFixed(2)}ft`);
    console.log(`📏  Corridor area: ${corridorArea.toFixed(2)} sqft`);

    console.groupEnd();

    return corridors;
  },

  /**
   * Test grid fitting
   */
  testGridFitting(polygon: Polygon) {
    console.group('🧪 Testing Grid Fitting');

    const start = performance.now();
    const grid = MassingGrid.fromPolygon(polygon, 2);
    const duration = performance.now() - start;

    const cells = grid.getCells();

    console.log(`⏱️  Grid creation time: ${duration.toFixed(2)}ms`);
    console.log(`📊 Total cells: ${cells.length}`);
    console.log(`📊 Available cells: ${grid.getAvailableCells().length}`);

    const exteriorCells = cells.filter(c => c.isExterior);
    console.log(`📊 Exterior cells: ${exteriorCells.length} (${(exteriorCells.length / cells.length * 100).toFixed(1)}%)`);

    const avgCorridorDist = cells.reduce((sum, c) => sum + c.distanceToCorridor, 0) / cells.length;
    const avgExteriorDist = cells.reduce((sum, c) => sum + c.distanceToExterior, 0) / cells.length;

    console.log(`📏  Avg distance to corridor: ${avgCorridorDist === Infinity ? 'N/A' : avgCorridorDist.toFixed(2)}ft`);
    console.log(`📏  Avg distance to exterior: ${avgExteriorDist.toFixed(2)}ft`);

    console.groupEnd();

    return grid;
  },

  /**
   * Test grid fitting with setbacks
   */
  testGridFittingWithSetbacks(
    polygon: Polygon,
    setbacks: { front: number; rear: number; side: number }
  ) {
    console.group('🧪 Testing Grid Fitting with Setbacks');

    console.log('Setbacks:', setbacks);

    const bounds = this.computeBounds(polygon);
    const effectiveWidth = bounds.maxX - bounds.minX - 2 * setbacks.side;
    const effectiveHeight = bounds.maxY - bounds.minY - setbacks.front - setbacks.rear;

    console.log(`Original bounds: ${effectiveWidth}x${effectiveHeight}ft`);

    const innerPolygon = this.applySetbacks(polygon, bounds, setbacks);
    const grid = this.testGridFitting(innerPolygon);

    console.groupEnd();

    return { grid, innerPolygon };
  },

  /**
   * Test unit growing
   */
  testUnitGrowing(targetArea: number, polygon: Polygon) {
    console.group(`🧪 Testing Unit Growing (target: ${targetArea}sf)`);

    const grid = MassingGrid.fromPolygon(polygon, 2);
    const availableCells = grid.getAvailableCells();
    const exteriorCells = availableCells.filter(c => c.isExterior);

    if (exteriorCells.length === 0) {
      console.error('❌ No exterior cells available for seed');
      return null;
    }

    const seedCell = exteriorCells[Math.floor(Math.random() * exteriorCells.length)];
    console.log('Seed cell:', seedCell);

    const grower = new UnitGrower(grid, targetArea, 0.1);

    const start = performance.now();
    const cells = grower.growFromSeed(seedCell);
    const duration = performance.now() - start;

    console.log(`⏱️  Growing time: ${duration.toFixed(2)}ms`);
    console.log(`📊 Cells grown: ${cells.length}`);

    const unitArea = cells.length * 4;
    const deviation = ((unitArea - targetArea) / targetArea) * 100;

    console.log(`📏  Unit area: ${unitArea.toFixed(2)}sf`);
    console.log(`📏  Target area: ${targetArea}sf`);
    console.log(`📏  Deviation: ${deviation.toFixed(1)}%`);
    console.log(`✅ Within tolerance: ${Math.abs(deviation) <= 10 ? 'Yes' : 'No'}`);

    const hasExterior = cells.some(c => c.isExterior);
    const hasCorridor = cells.some(c => c.distanceToCorridor < Infinity);

    console.log(`🪟 Has exterior access: ${hasExterior}`);
    console.log(`🛤️  Has corridor access: ${hasCorridor}`);

    console.groupEnd();

    return { cells, grid };
  },

  /**
   * Test Voronoi partitioning
   */
  testVoronoi(targetAreas: number[], polygon: Polygon) {
    console.group('🧪 Testing Voronoi Partitioning');

    const grid = MassingGrid.fromPolygon(polygon, 2);

    const start = performance.now();
    const partitioner = new VoronPartitioner(grid);
    const regions = partitioner.balancedPartition(targetAreas);
    const duration = performance.now() - start;

    console.log(`⏱️  Partitioning time: ${duration.toFixed(2)}ms`);
    console.log(`📊 Target areas: ${targetAreas.join(', ')}sf`);
    console.log(`📊 Regions created: ${regions.length}`);

    regions.forEach((region, i) => {
      const cellCount = region.cells.length;
      const actualArea = cellCount * 4;
      const target = targetAreas[i];
      const deviation = ((actualArea - target) / target) * 100;

      console.log(`Region ${i}: ${cellCount} cells, ${actualArea.toFixed(0)}sf (${deviation.toFixed(1)}% of ${target}sf)`);
    });

    const totalActualArea = regions.reduce((sum, r) => sum + r.cells.length * 4, 0);
    const totalTarget = targetAreas.reduce((sum, a) => sum + a, 0);

    console.log(`📏  Total actual: ${totalActualArea.toFixed(0)}sf`);
    console.log(`📏  Total target: ${totalTarget}sf`);

    console.groupEnd();

    return regions;
  },

  /**
   * Test rectangle fitting
   */
  testRectangleFitting(polygon: Polygon) {
    console.group('🧪 Testing Rectangle Fitting');

    const start = performance.now();
    const rect = findLargestRectangle(polygon, 2);
    const duration = performance.now() - start;

    if (!rect) {
      console.error('❌ No rectangle found');
      console.groupEnd();
      return null;
    }

    console.log(`⏱️  Fitting time: ${duration.toFixed(2)}ms`);
    console.log('Rectangle:', rect);
    console.log(`📏  Area: ${rect.area.toFixed(2)}sf`);

    const polygonArea = this.computePolygonArea(polygon);
    const utilization = (rect.area / polygonArea) * 100;

    console.log(`📊 Utilization: ${utilization.toFixed(1)}% of polygon area`);

    console.groupEnd();

    return rect;
  },

  /**
   * Test full pipeline
   */
  async testFullPipeline(shape: string, dimensions: ShapeDimensions) {
    console.group('🧪 Testing Full Pipeline');

    console.log('Step 1: Generate shape...');
    const shapeResult = await this.testShapeGeneration(shape, dimensions);
    if (!shapeResult) {
      console.error('❌ Shape generation failed');
      console.groupEnd();
      return null;
    }

    console.log('Step 2: Compute corridors...');
    const corridors = await this.testCorridors(shapeResult.outline, 6);

    console.log('Step 3: Create grid...');
    const grid = this.testGridFitting(shapeResult.outline);

    console.log('Step 4: Setup corridors in grid...');
    await grid.setupCorridors(shapeResult.outline, 6);

    const corridorCells = grid.getCells().filter(c => c.isCorridor);
    console.log(`🛤️  Corridor cells: ${corridorCells.length}`);

    console.log('Step 5: Grow units...');
    const targetAreas = [500, 500, 1000, 750];
    const partitioner = new VoronPartitioner(grid);
    const regions = partitioner.balancedPartition(targetAreas);

    const units = [];

    for (let i = 0; i < Math.min(3, regions.length); i++) {
      const region = regions[i];
      const seedCell = region.cells.find(c => c.isExterior) || region.cells[0];

      if (seedCell) {
        const grower = new UnitGrower(grid, targetAreas[i], 0.1);
        const unitCells = grower.growFromSeed(seedCell);
        units.push({ id: `unit_${i}`, cells: unitCells, targetArea: targetAreas[i] });
      }
    }

    console.log(`🏠 Units generated: ${units.length}`);

    const totalUnitArea = units.reduce((sum, u) => sum + u.cells.length * 4, 0);
    const corridorArea = corridorCells.length * 4;
    const totalArea = totalUnitArea + corridorArea;

    console.log(`📏  Unit area: ${totalUnitArea.toFixed(0)}sf`);
    console.log(`📏  Corridor area: ${corridorArea.toFixed(0)}sf`);
    console.log(`📏  Total used: ${totalArea.toFixed(0)}sf`);

    const gridArea = grid.getCells().length * 4;
    const coverage = (totalArea / gridArea) * 100;

    console.log(`📏  Grid area: ${gridArea.toFixed(0)}sf`);
    console.log(`📊 Coverage: ${coverage.toFixed(1)}%`);

    console.groupEnd();

    return { shapeResult, corridors, grid, units };
  },

  /**
   * Performance benchmark
   */
  async runBenchmark(iterations: number = 100) {
    console.group('🧪 Running Performance Benchmark');

    const polygon: Polygon = {
      points: [
        { x: 0, y: 0 },
        { x: 100, y: 0 },
        { x: 100, y: 120 },
        { x: 0, y: 120 }
      ]
    };

    console.log(`Iterations: ${iterations}`);
    console.log('Test polygon: 100x120ft rectangle');

    const generator = new RectangleShape();

    console.log('\n📐 Shape Generation...');
    const shapeTimes = [];
    for (let i = 0; i < iterations; i++) {
      const start = performance.now();
      generator.generate({ width: 100, height: 120 });
      shapeTimes.push(performance.now() - start);
    }
    const avgShape = shapeTimes.reduce((a, b) => a + b) / shapeTimes.length;
    console.log(`Average: ${avgShape.toFixed(2)}ms`);

    console.log('\n🦴 Skeleton Computation...');
    const skeletonTimes = [];
    for (let i = 0; i < iterations; i++) {
      const start = performance.now();
      await computeStraightSkeleton(polygon, 0.5);
      skeletonTimes.push(performance.now() - start);
    }
    const avgSkeleton = skeletonTimes.reduce((a, b) => a + b) / skeletonTimes.length;
    console.log(`Average: ${avgSkeleton.toFixed(2)}ms`);

    console.log('\n🛤️  Corridor Routing...');
    const corridorTimes = [];
    for (let i = 0; i < iterations; i++) {
      const start = performance.now();
      await computeBalancedCorridors(polygon, 6);
      corridorTimes.push(performance.now() - start);
    }
    const avgCorridor = corridorTimes.reduce((a, b) => a + b) / corridorTimes.length;
    console.log(`Average: ${avgCorridor.toFixed(2)}ms`);

    console.log('\n📊 Grid Creation...');
    const gridTimes = [];
    for (let i = 0; i < iterations; i++) {
      const start = performance.now();
      MassingGrid.fromPolygon(polygon, 2);
      gridTimes.push(performance.now() - start);
    }
    const avgGrid = gridTimes.reduce((a, b) => a + b) / gridTimes.length;
    console.log(`Average: ${avgGrid.toFixed(2)}ms`);

    console.groupEnd();

    return {
      shapeGeneration: avgShape,
      skeleton: avgSkeleton,
      corridorRouting: avgCorridor,
      gridCreation: avgGrid
    };
  },

  /**
   * Utility: Compute polygon area
   */
  computePolygonArea(polygon: Polygon): number {
    const points = polygon.points;
    let area = 0;

    for (let i = 0; i < points.length; i++) {
      const x0 = points[i].x;
      const y0 = points[i].y;
      const x1 = points[(i + 1) % points.length].x;
      const y1 = points[(i + 1) % points.length].y;

      area += x0 * y1 - x1 * y0;
    }

    return Math.abs(area) / 2;
  },

  /**
   * Utility: Validate polygon
   */
  validatePolygon(polygon: Polygon): boolean {
    if (polygon.points.length < 3) return false;

    const points = polygon.points;

    for (let i = 0; i < points.length; i++) {
      const p1 = points[i];
      const p2 = points[(i + 1) % points.length];
      const p3 = points[(i + 2) % points.length];

      const area = (p2.x - p1.x) * (p3.y - p1.y) - (p3.x - p1.x) * (p2.y - p1.y);

      if (Math.abs(area) < 0.0001) {
        console.warn('Degenerate edge detected at vertex', i);
      }
    }

    return true;
  },

  /**
   * Utility: Compute path length
   */
  computePathLength(points: { x: number; y: number }[]): number {
    let length = 0;

    for (let i = 0; i < points.length - 1; i++) {
      const dx = points[i + 1].x - points[i].x;
      const dy = points[i + 1].y - points[i].y;
      length += Math.sqrt(dx * dx + dy * dy);
    }

    return length;
  },

  /**
   * Utility: Compute polygon bounds
   */
  computeBounds(polygon: Polygon) {
    const points = polygon.points;

    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;

    for (const point of points) {
      minX = Math.min(minX, point.x);
      minY = Math.min(minY, point.y);
      maxX = Math.max(maxX, point.x);
      maxY = Math.max(maxY, point.y);
    }

    return { minX, minY, maxX, maxY };
  },

  /**
   * Utility: Apply setbacks
   */
  applySetbacks(
    polygon: Polygon,
    bounds: { minX: number; minY: number; maxX: number; maxY: number },
    setbacks: { front: number; rear: number; side: number }
  ): Polygon {
    const clippedPoints = polygon.points
      .map(point => {
        const x = Math.max(bounds.minX + setbacks.side, Math.min(bounds.maxX - setbacks.side, point.x));
        const y = Math.max(bounds.minY + setbacks.front, Math.min(bounds.maxY - setbacks.rear, point.y));

        return { x, y };
      })
      .filter((point, index, arr) => {
        if (index === 0) return true;

        const prev = arr[index - 1];
        return Math.abs(point.x - prev.x) > 0.1 || Math.abs(point.y - prev.y) > 0.1;
      });

    return { points: clippedPoints };
  }
};

// Expose to window for console access
declare global {
  interface Window {
    testMassingShape: (shape: string, dimensions: ShapeDimensions) => Promise<any>;
    testSkeleton: (polygon: Polygon, stepSize?: number) => Promise<any>;
    testCorridors: (polygon: Polygon, corridorWidth?: number) => Promise<any>;
    testGridFitting: (polygon: Polygon) => any;
    testGridFittingWithSetbacks: (polygon: Polygon, setbacks: any) => any;
    testUnitGrowing: (targetArea: number, polygon: Polygon) => any;
    testVoronoi: (targetAreas: number[], polygon: Polygon) => any;
    testRectangleFitting: (polygon: Polygon) => any;
    testFullPipeline: (shape: string, dimensions: ShapeDimensions) => Promise<any>;
    runBenchmark: (iterations?: number) => Promise<any>;
  }
}

if (typeof window !== 'undefined') {
  window.testMassingShape = ManualTestHelpers.testShapeGeneration.bind(ManualTestHelpers);
  window.testSkeleton = ManualTestHelpers.testSkeleton.bind(ManualTestHelpers);
  window.testCorridors = ManualTestHelpers.testCorridors.bind(ManualTestHelpers);
  window.testGridFitting = ManualTestHelpers.testGridFitting.bind(ManualTestHelpers);
  window.testGridFittingWithSetbacks = ManualTestHelpers.testGridFittingWithSetbacks.bind(ManualTestHelpers);
  window.testUnitGrowing = ManualTestHelpers.testUnitGrowing.bind(ManualTestHelpers);
  window.testVoronoi = ManualTestHelpers.testVoronoi.bind(ManualTestHelpers);
  window.testRectangleFitting = ManualTestHelpers.testRectangleFitting.bind(ManualTestHelpers);
  window.testFullPipeline = ManualTestHelpers.testFullPipeline.bind(ManualTestHelpers);
  window.runBenchmark = ManualTestHelpers.runBenchmark.bind(ManualTestHelpers);
}

export default ManualTestHelpers;
