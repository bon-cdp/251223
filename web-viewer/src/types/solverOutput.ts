/**
 * TypeScript interfaces matching Pydantic schemas from solver_output.py
 */

export interface Position {
  x: number;
  y: number;
}

// Rectangle-based geometry (legacy, backward compatible)
export interface RectGeometry {
  x: number;      // Center X
  y: number;      // Center Y
  width: number;
  height: number;
  rotation: number;
}

// Polygon-based geometry for L-shapes and custom polygons
export interface PolygonGeometry {
  vertices: [number, number][];  // Array of [x, y] points, clockwise order
  rotation?: number;
}

// Union type - supports both rectangle and polygon
export type Geometry = RectGeometry | PolygonGeometry;

// Type guard to check if geometry is polygon-based
export function isPolygonGeometry(geom: Geometry): geom is PolygonGeometry {
  return 'vertices' in geom;
}

// Type guard to check if geometry is rectangle-based
export function isRectGeometry(geom: Geometry): geom is RectGeometry {
  return 'width' in geom && 'height' in geom && !('vertices' in geom);
}

// Convert rectangle geometry to polygon vertices
export function rectToPolygon(rect: RectGeometry): [number, number][] {
  const halfW = rect.width / 2;
  const halfH = rect.height / 2;
  return [
    [rect.x - halfW, rect.y - halfH],
    [rect.x + halfW, rect.y - halfH],
    [rect.x + halfW, rect.y + halfH],
    [rect.x - halfW, rect.y + halfH],
  ];
}

export interface SpaceData {
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

export interface FloorData {
  floor_index: number;
  floor_type: string;
  boundary: number[][];
  area_sf: number;
  spaces: SpaceData[];
}

export interface StalkData {
  id: string;
  type: string;
  floor_range: number[];
  position: Position;
}

export interface SolverMetrics {
  placement_rate: string;
  avg_membership: string;
  total_spaces: number;
  placed_spaces: number;
}

export interface BuildingMetrics {
  total_floors: number;
  total_spaces: number;
  cohomology_obstruction: number;
}

export interface BuildingData {
  floors: FloorData[];
  stalks: StalkData[];
  metrics: BuildingMetrics;
}

export interface SolverResult {
  success: boolean;
  obstruction: number;
  iterations: number;
  message: string;
  violations: string[];
  metrics: SolverMetrics;
  building: BuildingData;
}

// Building input types (from p1_building.json)
export interface DwellingUnit {
  type: string;
  name: string;
  count: number;
  area_sf: number;
  width_ft: number;
  depth_ft: number;
  bedrooms: number;
  bathrooms: number;
}

export interface BuildingInput {
  project_name: string;
  address?: string;
  apn?: string;
  building: {
    property_type?: string;
    construction_type?: string;
    lot_size_sf: number;
    far: number;
    gfa_sf: number;
    gba_sf?: number;
    stories_total: number;
    stories_above_grade: number;
    stories_below_grade: number;
    floor_plate_sf: number;
    rentable_sf?: number;
    net_to_gross?: number;
    height_above_grade_ft: number;
    height_below_grade_ft?: number;
  };
  dwelling_units: DwellingUnit[];
  circulation?: {
    corridor_width_ft: number;
    corridor_length_ft?: number;
    elevators: {
      passenger: { count: number; sf_per_floor: number };
      freight?: { count: number; sf_per_floor: number };
    };
    stairs: { count: number; sf_per_floor: number };
    vestibule_elevator_lobby_sf?: number;
    shaft_elevator_sf?: number;
    shaft_stair_sf?: number;
  };
  parking?: {
    surface_stalls: number;
    podium_stalls: number;
    underground_stalls: number;
    indoor_parking_sf?: number;
    surface_lot_sf?: number;
    loading_dock_sf?: number;
    rideshare_zone_sf?: number;
  };
  support?: Array<{ name: string; area_sf: number; floor?: string }>;
  amenities_indoor?: Array<{ name: string; area_sf: number; floor?: string }>;
  amenities_outdoor?: Array<{ name: string; area_sf: number; floor?: string }>;
}
