/**
 * TypeScript interfaces matching Pydantic schemas from solver_output.py
 */

export interface Position {
  x: number;
  y: number;
}

export interface Geometry {
  x: number;      // Center X
  y: number;      // Center Y
  width: number;
  height: number;
  rotation: number;
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
  building: {
    property_type: string;
    construction_type: string;
    lot_size_sf: number;
    far: number;
    gfa_sf: number;
    gba_sf: number;
    stories_total: number;
    stories_above_grade: number;
    stories_below_grade: number;
    floor_plate_sf: number;
    rentable_sf: number;
    net_to_gross: number;
    height_above_grade_ft: number;
    height_below_grade_ft: number;
  };
  dwelling_units: DwellingUnit[];
}
