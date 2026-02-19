/**
 * Architect Agent - AI-powered floor plan refinement
 *
 * This tooling allows Claude to act as an architect, analyzing floor plans
 * and making intelligent refinements to the JSON data.
 *
 * Building Configurations Understood:
 * - TOWER: Single vertical core, units wrap around
 * - PODIUM: Parking base with residential tower above
 * - H-SHAPE: Two wings connected by core (double-loaded corridors)
 * - O-SHAPE (DONUT): Units around central courtyard
 * - L-SHAPE: Corner building with single corridor
 * - WRAP: Units wrap around parking structure
 */

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.join(__dirname, '../public/data');

// =============================================================================
// TYPE DEFINITIONS
// =============================================================================

interface RectGeometry {
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
}

interface PolygonGeometry {
  vertices: [number, number][];
  rotation?: number;
}

type Geometry = RectGeometry | PolygonGeometry;

function isPolygonGeom(g: Geometry): g is PolygonGeometry {
  return 'vertices' in g;
}

function isRectGeom(g: Geometry): g is RectGeometry {
  return 'width' in g && 'height' in g && !('vertices' in g);
}

interface SpaceData {
  id: string;
  type: string;
  name: string;
  floor_index: number;
  geometry: Geometry;
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
  metrics: {
    placement_rate: string;
    avg_membership: string;
    total_spaces: number;
    placed_spaces: number;
  };
  building: {
    floors: FloorData[];
    stalks: any[];
    metrics: any;
  };
}

// =============================================================================
// ARCHITECT ANALYSIS TOOLS
// =============================================================================

/**
 * Detect overlapping spaces on a floor
 */
/** Get axis-aligned bounding box for any geometry */
function getGeomBounds(g: Geometry): { left: number; right: number; top: number; bottom: number } {
  if (isRectGeom(g)) {
    return {
      left: g.x - g.width / 2,
      right: g.x + g.width / 2,
      top: g.y - g.height / 2,
      bottom: g.y + g.height / 2,
    };
  }
  // Polygon
  const xs = g.vertices.map(v => v[0]);
  const ys = g.vertices.map(v => v[1]);
  return {
    left: Math.min(...xs),
    right: Math.max(...xs),
    top: Math.min(...ys),
    bottom: Math.max(...ys),
  };
}

/** Convert any geometry to a polygon (list of vertices) */
function geomToPolygon(g: Geometry): [number, number][] {
  if (isPolygonGeom(g)) return g.vertices;
  // Rect → 4 corners
  const r = g as RectGeometry;
  const hw = r.width / 2, hh = r.height / 2;
  return [
    [r.x - hw, r.y - hh], [r.x + hw, r.y - hh],
    [r.x + hw, r.y + hh], [r.x - hw, r.y + hh],
  ];
}

/** Signed area of polygon (positive = CCW) */
function polyArea(p: [number, number][]): number {
  let a = 0;
  for (let i = 0; i < p.length; i++) {
    const j = (i + 1) % p.length;
    a += p[i][0] * p[j][1] - p[j][0] * p[i][1];
  }
  return a / 2;
}

/** Sutherland-Hodgman polygon clipping — returns intersection polygon */
function clipPolygons(subject: [number, number][], clip: [number, number][]): [number, number][] {
  let output = [...subject];
  for (let i = 0; i < clip.length && output.length > 0; i++) {
    const input = output;
    output = [];
    const a = clip[i], b = clip[(i + 1) % clip.length];
    const edgeX = b[0] - a[0], edgeY = b[1] - a[1];
    for (let j = 0; j < input.length; j++) {
      const c = input[j], d = input[(j + 1) % input.length];
      const cInside = edgeX * (c[1] - a[1]) - edgeY * (c[0] - a[0]) >= 0;
      const dInside = edgeX * (d[1] - a[1]) - edgeY * (d[0] - a[0]) >= 0;
      if (cInside) output.push(c);
      if (cInside !== dInside) {
        // Intersection point
        const cx = d[0] - c[0], cy = d[1] - c[1];
        const denom = edgeX * cy - edgeY * cx;
        if (Math.abs(denom) > 1e-12) {
          const t = (edgeX * (c[1] - a[1]) - edgeY * (c[0] - a[0])) / denom;
          output.push([c[0] + t * cx, c[1] + t * cy]);
        }
      }
    }
  }
  return output;
}

export function detectOverlaps(floor: FloorData): Array<{space1: string, space2: string, overlap_area: number}> {
  const overlaps: Array<{space1: string, space2: string, overlap_area: number}> = [];
  const spaces = floor.spaces;

  for (let i = 0; i < spaces.length; i++) {
    for (let j = i + 1; j < spaces.length; j++) {
      // Quick BB check first
      const a = getGeomBounds(spaces[i].geometry);
      const b = getGeomBounds(spaces[j].geometry);
      const bbOverlapX = Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left));
      const bbOverlapY = Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));
      if (bbOverlapX < 0.5 || bbOverlapY < 0.5) continue;

      // Precise polygon intersection (ensure CCW winding for Sutherland-Hodgman)
      let polyA = geomToPolygon(spaces[i].geometry);
      let polyB = geomToPolygon(spaces[j].geometry);
      if (polyArea(polyA) < 0) polyA = [...polyA].reverse();
      if (polyArea(polyB) < 0) polyB = [...polyB].reverse();
      const intersection = clipPolygons(polyA, polyB);
      if (intersection.length < 3) continue;

      const overlapArea = Math.abs(polyArea(intersection));
      if (overlapArea > 1) {
        overlaps.push({
          space1: spaces[i].id,
          space2: spaces[j].id,
          overlap_area: Math.round(overlapArea * 100) / 100
        });
      }
    }
  }

  return overlaps;
}

/**
 * Check if dwelling units have window access (touch perimeter)
 */
export function checkWindowAccess(floor: FloorData): Array<{space_id: string, has_window: boolean, distance_to_perimeter: number}> {
  const results: Array<{space_id: string, has_window: boolean, distance_to_perimeter: number}> = [];
  const boundary = floor.boundary;

  // Get floor plate bounds
  const xs = boundary.map(p => p[0]);
  const ys = boundary.map(p => p[1]);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);

  for (const space of floor.spaces) {
    if (space.type !== 'DWELLING_UNIT') continue;

    const bounds = getGeomBounds(space.geometry);

    // Distance to each edge
    const distToLeft = Math.abs(bounds.left - minX);
    const distToRight = Math.abs(bounds.right - maxX);
    const distToTop = Math.abs(bounds.top - minY);
    const distToBottom = Math.abs(bounds.bottom - maxY);

    const minDist = Math.min(distToLeft, distToRight, distToTop, distToBottom);
    const hasWindow = minDist < 3; // Within 3' of perimeter

    results.push({
      space_id: space.id,
      has_window: hasWindow,
      distance_to_perimeter: Math.round(minDist * 100) / 100
    });
  }

  return results;
}

/**
 * Calculate floor efficiency metrics
 */
export function calculateEfficiency(floor: FloorData): {
  total_area: number;
  usable_area: number;
  circulation_area: number;
  efficiency_pct: number;
  unit_count: number;
} {
  const totalArea = floor.area_sf;
  let usableArea = 0;
  let circulationArea = 0;
  let unitCount = 0;

  for (const space of floor.spaces) {
    const area = space.actual_area_sf;

    if (space.type === 'DWELLING_UNIT') {
      usableArea += area;
      unitCount++;
    } else if (space.type === 'CIRCULATION') {
      circulationArea += area;
    }
  }

  return {
    total_area: Math.round(totalArea),
    usable_area: Math.round(usableArea),
    circulation_area: Math.round(circulationArea),
    efficiency_pct: Math.round((usableArea / totalArea) * 100),
    unit_count: unitCount
  };
}

/**
 * Identify the building configuration type
 */
export function identifyConfiguration(floor: FloorData): {
  type: 'TOWER' | 'H-SHAPE' | 'O-SHAPE' | 'L-SHAPE' | 'LINEAR' | 'UNKNOWN';
  description: string;
} {
  const boundary = floor.boundary;
  const xs = boundary.map(p => p[0]);
  const ys = boundary.map(p => p[1]);

  const width = Math.max(...xs) - Math.min(...xs);
  const height = Math.max(...ys) - Math.min(...ys);
  const aspectRatio = width / height;

  // Count corridors
  const corridors = floor.spaces.filter(s => s.type === 'CIRCULATION' && s.name.includes('Corridor'));
  const corridorCount = corridors.length;

  // Check for central core
  const core = floor.spaces.filter(s => s.type === 'CIRCULATION' && (s.name.includes('Elevator') || s.name.includes('Stair')));
  const coreAtCenter = core.some(s => {
    const b = getGeomBounds(s.geometry);
    const cx = (b.left + b.right) / 2;
    const cy = (b.top + b.bottom) / 2;
    return Math.abs(cx) < 20 && Math.abs(cy) < 20;
  });

  if (aspectRatio > 0.8 && aspectRatio < 1.2 && coreAtCenter) {
    return { type: 'TOWER', description: 'Square tower with central core' };
  } else if (corridorCount >= 4 && coreAtCenter) {
    return { type: 'O-SHAPE', description: 'Ring corridor around central core (donut)' };
  } else if (aspectRatio > 2 || aspectRatio < 0.5) {
    return { type: 'LINEAR', description: 'Linear building with single-loaded or double-loaded corridor' };
  } else if (corridorCount === 2) {
    return { type: 'H-SHAPE', description: 'H-shaped with two parallel corridors' };
  }

  return { type: 'UNKNOWN', description: 'Configuration could not be determined' };
}

// =============================================================================
// ARCHITECT MODIFICATION TOOLS
// =============================================================================

/**
 * Move a space to a new position
 */
export function moveSpace(floor: FloorData, spaceId: string, newX: number, newY: number): boolean {
  const space = floor.spaces.find(s => s.id === spaceId);
  if (!space) return false;
  const g = space.geometry;

  if (isRectGeom(g)) {
    g.x = newX;
    g.y = newY;
  } else if (isPolygonGeom(g)) {
    // Translate polygon vertices
    const b = getGeomBounds(g);
    const cx = (b.left + b.right) / 2;
    const cy = (b.top + b.bottom) / 2;
    const dx = newX - cx;
    const dy = newY - cy;
    for (let i = 0; i < g.vertices.length; i++) {
      g.vertices[i] = [g.vertices[i][0] + dx, g.vertices[i][1] + dy];
    }
  }
  return true;
}

/**
 * Resize a space (rect only)
 */
export function resizeSpace(floor: FloorData, spaceId: string, newWidth: number, newHeight: number): boolean {
  const space = floor.spaces.find(s => s.id === spaceId);
  if (!space || !isRectGeom(space.geometry)) return false;

  space.geometry.width = newWidth;
  space.geometry.height = newHeight;
  space.actual_area_sf = newWidth * newHeight;

  const deviation = ((space.actual_area_sf - space.target_area_sf) / space.target_area_sf) * 100;
  space.area_deviation = deviation >= 0 ? `+${deviation.toFixed(1)}%` : `${deviation.toFixed(1)}%`;

  return true;
}

/**
 * Remove a space from a floor
 */
export function removeSpace(floor: FloorData, spaceId: string): SpaceData | null {
  const index = floor.spaces.findIndex(s => s.id === spaceId);
  if (index === -1) return null;

  const [removed] = floor.spaces.splice(index, 1);
  return removed;
}

/**
 * Add a new space to a floor
 */
export function addSpace(floor: FloorData, space: SpaceData): void {
  floor.spaces.push(space);
}

/**
 * Shift all spaces of a type by a delta
 */
export function shiftSpacesByType(floor: FloorData, type: string, deltaX: number, deltaY: number): number {
  let count = 0;
  for (const space of floor.spaces) {
    if (space.type === type) {
      const g = space.geometry;
      if (isRectGeom(g)) {
        g.x += deltaX;
        g.y += deltaY;
      } else if (isPolygonGeom(g)) {
        for (let i = 0; i < g.vertices.length; i++) {
          g.vertices[i] = [g.vertices[i][0] + deltaX, g.vertices[i][1] + deltaY];
        }
      }
      count++;
    }
  }
  return count;
}

/**
 * Compact spaces to remove gaps
 */
export function compactSpaces(floor: FloorData, direction: 'north' | 'south' | 'east' | 'west'): void {
  const units = floor.spaces.filter(s => s.type === 'DWELLING_UNIT');

  // Sort by position based on direction
  if (direction === 'north' || direction === 'south') {
    units.sort((a, b) => direction === 'north' ? a.geometry.y - b.geometry.y : b.geometry.y - a.geometry.y);
  } else {
    units.sort((a, b) => direction === 'east' ? b.geometry.x - a.geometry.x : a.geometry.x - b.geometry.x);
  }

  // Compact by removing gaps
  // (Implementation depends on specific layout)
}

// =============================================================================
// FLOOR PLAN ANALYSIS REPORT
// =============================================================================

/**
 * Generate a comprehensive analysis report for a floor
 */
export function analyzeFloor(floor: FloorData): {
  floor_index: number;
  floor_type: string;
  configuration: ReturnType<typeof identifyConfiguration>;
  efficiency: ReturnType<typeof calculateEfficiency>;
  overlaps: ReturnType<typeof detectOverlaps>;
  window_access: ReturnType<typeof checkWindowAccess>;
  issues: string[];
  recommendations: string[];
} {
  const config = identifyConfiguration(floor);
  const efficiency = calculateEfficiency(floor);
  const overlaps = detectOverlaps(floor);
  const windowAccess = checkWindowAccess(floor);

  const issues: string[] = [];
  const recommendations: string[] = [];

  // Check for overlaps
  if (overlaps.length > 0) {
    issues.push(`${overlaps.length} space overlap(s) detected`);
    for (const o of overlaps.slice(0, 3)) {
      recommendations.push(`Resolve overlap between ${o.space1} and ${o.space2} (${o.overlap_area} SF)`);
    }
  }

  // Check window access
  const noWindow = windowAccess.filter(w => !w.has_window);
  if (noWindow.length > 0) {
    issues.push(`${noWindow.length} unit(s) without window access`);
    recommendations.push(`Move interior units to perimeter for natural light`);
  }

  // Check efficiency
  if (efficiency.efficiency_pct < 70) {
    issues.push(`Low floor efficiency: ${efficiency.efficiency_pct}%`);
    recommendations.push(`Consider reducing corridor width or adding more units`);
  }

  return {
    floor_index: floor.floor_index,
    floor_type: floor.floor_type,
    configuration: config,
    efficiency,
    overlaps,
    window_access: windowAccess,
    issues,
    recommendations
  };
}

/**
 * Analyze entire building
 */
export function analyzeBuilding(result: SolverResult): {
  project_summary: {
    total_floors: number;
    total_units: number;
    avg_efficiency: number;
    total_issues: number;
  };
  floor_analyses: ReturnType<typeof analyzeFloor>[];
  critical_issues: string[];
} {
  const floorAnalyses = result.building.floors.map(f => analyzeFloor(f));

  let totalUnits = 0;
  let totalEfficiency = 0;
  let totalIssues = 0;
  const criticalIssues: string[] = [];

  for (const analysis of floorAnalyses) {
    totalUnits += analysis.efficiency.unit_count;
    totalEfficiency += analysis.efficiency.efficiency_pct;
    totalIssues += analysis.issues.length;

    if (analysis.overlaps.length > 0) {
      criticalIssues.push(`Floor ${analysis.floor_index}: ${analysis.overlaps.length} overlaps`);
    }
  }

  return {
    project_summary: {
      total_floors: result.building.floors.length,
      total_units: totalUnits,
      avg_efficiency: Math.round(totalEfficiency / floorAnalyses.length),
      total_issues: totalIssues
    },
    floor_analyses: floorAnalyses,
    critical_issues: criticalIssues
  };
}

// =============================================================================
// SVG GENERATION FOR VISUAL ANALYSIS
// =============================================================================

/**
 * Generate SVG visualization of a floor for visual analysis
 */
export function generateFloorSVG(floor: FloorData): string {
  const boundary = floor.boundary;
  const xs = boundary.map(p => p[0]);
  const ys = boundary.map(p => p[1]);

  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);

  const width = maxX - minX;
  const height = maxY - minY;
  const scale = 4;
  const padding = 20;

  const svgWidth = width * scale + padding * 2;
  const svgHeight = height * scale + padding * 2;

  // Transform function: world coords to SVG coords (flip Y)
  const tx = (x: number) => (x - minX) * scale + padding;
  const ty = (y: number) => svgHeight - ((y - minY) * scale + padding);

  // Color mapping
  const colors: Record<string, string> = {
    'DWELLING_UNIT': '#4CAF50',
    'CIRCULATION': '#9E9E9E',
    'SUPPORT': '#FF9800',
    'AMENITY': '#2196F3',
    'PARKING': '#607D8B',
    'RETAIL': '#E91E63',
  };

  let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${svgWidth}" height="${svgHeight}" viewBox="0 0 ${svgWidth} ${svgHeight}">`;
  svg += `<rect width="100%" height="100%" fill="#1a1a2e"/>`;

  // Draw boundary
  const boundaryPath = boundary.map((p, i) => `${i === 0 ? 'M' : 'L'} ${tx(p[0])} ${ty(p[1])}`).join(' ') + ' Z';
  svg += `<path d="${boundaryPath}" fill="none" stroke="#fff" stroke-width="2"/>`;

  // Draw spaces
  for (const space of floor.spaces) {
    const g = space.geometry;
    const color = colors[space.type] || '#666';

    if (isPolygonGeom(g)) {
      // Render polygon unit
      const points = g.vertices.map(([vx, vy]) => `${tx(vx)},${ty(vy)}`).join(' ');
      svg += `<polygon points="${points}" fill="${color}" fill-opacity="0.7" stroke="${color}" stroke-width="1"/>`;

      // Label at centroid
      const cx = g.vertices.reduce((s, v) => s + v[0], 0) / g.vertices.length;
      const cy = g.vertices.reduce((s, v) => s + v[1], 0) / g.vertices.length;
      const bounds = getGeomBounds(g);
      const polyW = (bounds.right - bounds.left) * scale;
      const fontSize = Math.min(10, polyW / 4);
      if (fontSize > 4) {
        svg += `<text x="${tx(cx)}" y="${ty(cy)}" font-size="${fontSize}" fill="white" text-anchor="middle" dominant-baseline="middle">${space.name.substring(0, 8)}</text>`;
      }
    } else {
      // Render rect unit
      const x = tx(g.x - g.width / 2);
      const y = ty(g.y + g.height / 2);
      const w = g.width * scale;
      const h = g.height * scale;

      svg += `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${color}" fill-opacity="0.7" stroke="${color}" stroke-width="1"/>`;

      // Label
      const fontSize = Math.min(10, w / 4);
      if (fontSize > 4) {
        svg += `<text x="${x + w/2}" y="${y + h/2}" font-size="${fontSize}" fill="white" text-anchor="middle" dominant-baseline="middle">${space.name.substring(0, 8)}</text>`;
      }
    }
  }

  // Title
  svg += `<text x="10" y="15" font-size="12" fill="white">Floor ${floor.floor_index} (${floor.floor_type})</text>`;

  svg += '</svg>';
  return svg;
}

// =============================================================================
// MAIN EXECUTION
// =============================================================================

async function main() {
  const projects = ['p1', 'p4', 'p7', 'p9'];

  console.log('='.repeat(60));
  console.log('ARCHITECT AGENT - Floor Plan Analysis');
  console.log('='.repeat(60));

  for (const project of projects) {
    const outputPath = path.join(DATA_DIR, `${project}_output.json`);

    if (!fs.existsSync(outputPath)) {
      console.log(`\nSkipping ${project}: output file not found`);
      continue;
    }

    console.log(`\n${'─'.repeat(60)}`);
    console.log(`Analyzing ${project.toUpperCase()}`);
    console.log('─'.repeat(60));

    const result: SolverResult = JSON.parse(fs.readFileSync(outputPath, 'utf-8'));
    const analysis = analyzeBuilding(result);

    console.log(`\nProject Summary:`);
    console.log(`  Total Floors: ${analysis.project_summary.total_floors}`);
    console.log(`  Total Units: ${analysis.project_summary.total_units}`);
    console.log(`  Avg Efficiency: ${analysis.project_summary.avg_efficiency}%`);
    console.log(`  Total Issues: ${analysis.project_summary.total_issues}`);

    if (analysis.critical_issues.length > 0) {
      console.log(`\nCritical Issues:`);
      for (const issue of analysis.critical_issues) {
        console.log(`  ⚠️  ${issue}`);
      }
    }

    // Show residential floor analysis
    const residentialFloors = analysis.floor_analyses.filter(f => f.floor_type === 'RESIDENTIAL_TYPICAL');
    if (residentialFloors.length > 0) {
      const sample = residentialFloors[0];
      console.log(`\nSample Residential Floor (${sample.floor_index}):`);
      console.log(`  Configuration: ${sample.configuration.type}`);
      console.log(`  Units: ${sample.efficiency.unit_count}`);
      console.log(`  Efficiency: ${sample.efficiency.efficiency_pct}%`);
      console.log(`  Overlaps: ${sample.overlaps.length}`);

      if (sample.recommendations.length > 0) {
        console.log(`  Recommendations:`);
        for (const rec of sample.recommendations.slice(0, 3)) {
          console.log(`    → ${rec}`);
        }
      }
    }

    // Generate SVGs for each floor type (parking, ground, residential)
    const floorTypesToRender: Array<{ type: string; label: string }> = [
      { type: 'PARKING_UNDERGROUND', label: 'parking' },
      { type: 'GROUND', label: 'ground' },
      { type: 'RESIDENTIAL_TYPICAL', label: 'residential' },
    ];

    for (const { type, label } of floorTypesToRender) {
      const floor = result.building.floors.find(f => f.floor_type === type);
      if (floor) {
        const svg = generateFloorSVG(floor);
        const svgPath = path.join(DATA_DIR, `${project}_floor_${label}_analysis.svg`);
        fs.writeFileSync(svgPath, svg);
        console.log(`  SVG saved: ${svgPath} (floor ${floor.floor_index})`);
      }
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log('Analysis Complete');
  console.log('='.repeat(60));
}

// Export for use as module
export { main as runArchitectAgent };

// Run if executed directly
main().catch(console.error);
