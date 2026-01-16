/**
 * TypeScript interfaces for building configuration and massing output
 */

export interface UnitType {
  count: number;
  area: number;  // SF per unit
  width: number; // feet
  depth: number; // feet
}

export interface BuildingConfig {
  // Project info
  address: string;
  propertyType: string;

  // Building dimensions
  lotSize: number;        // SF
  stories: number;
  storiesAbove: number;
  storiesBelow: number;
  floorPlateArea: number; // SF per floor
  gba: number;            // Gross Building Area
  gfa: number;            // Gross Floor Area
  netToGross: number;     // Efficiency ratio

  // Unit mix
  units: {
    studios: UnitType;
    oneBed: UnitType;
    twoBed: UnitType;
    threeBed: UnitType;
  };
  totalUnits: number;

  // Space breakdown (SF)
  circulation: number;
  retail: number;
  amenitiesIndoor: number;
  amenitiesOutdoor: number;
  supportAreas: number;
  parking: number;
  boh: number;
}

export interface PlacedSpace {
  id: string;
  type: 'STUDIO' | 'ONE_BED' | 'TWO_BED' | 'THREE_BED' | 'RETAIL' | 'AMENITY' | 'CIRCULATION' | 'SUPPORT' | 'PARKING' | 'BOH';
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
  area: number;
}

export interface GeneratedFloor {
  floorIndex: number;
  floorType: 'PARKING' | 'GROUND' | 'RESIDENTIAL';
  boundary: { width: number; height: number };
  spaces: PlacedSpace[];
}

export interface MassingResult {
  floors: GeneratedFloor[];
  scaleFactor: number;    // 1.0 if everything fits, >1.0 if scaled up
  unitsPlaced: {
    studios: number;
    oneBed: number;
    twoBed: number;
    threeBed: number;
    total: number;
  };
  efficiency: number;     // % of floor plate used for units
}

// Color scheme for space types
export const SPACE_COLORS: Record<PlacedSpace['type'], string> = {
  STUDIO: '#7c3aed',      // Purple
  ONE_BED: '#3b82f6',     // Blue
  TWO_BED: '#10b981',     // Green
  THREE_BED: '#f59e0b',   // Amber
  RETAIL: '#ec4899',      // Pink
  AMENITY: '#8b5cf6',     // Violet
  CIRCULATION: '#6b7280', // Gray
  SUPPORT: '#64748b',     // Slate
  PARKING: '#475569',     // Darker slate
  BOH: '#374151',         // Dark gray
};

export const SPACE_LABELS: Record<PlacedSpace['type'], string> = {
  STUDIO: 'Studio',
  ONE_BED: '1 BR',
  TWO_BED: '2 BR',
  THREE_BED: '3 BR',
  RETAIL: 'Retail',
  AMENITY: 'Amenity',
  CIRCULATION: 'Circulation',
  SUPPORT: 'Support',
  PARKING: 'Parking',
  BOH: 'BOH',
};

// ============================================================================
// V3 Types - Full Configuration with Build Mode + Construction Type Support
// ============================================================================

export type BuildMode = 'new' | 'repurpose';
export type ConstructionType = 'V' | 'III' | 'V/I' | 'III/I' | 'I';

export interface UnitConfig {
  count: number;
  area: number;   // SF per unit
  depth: number;  // feet
  width: number;  // feet (calculated from area/depth)
}

export interface FullBuildingConfig {
  // Project info
  address: string;
  propertyType: string;

  // Build configuration
  buildMode: BuildMode;
  constructionType: ConstructionType;

  // Building dimensions
  lotSize: number;
  storiesAbove: number;
  storiesBelow: number;
  floorPlateArea: number;
  floorPlateAspect: number;  // width/height ratio (1.0 to 4.0)
  gba: number;
  gfa: number;
  netToGross: number;

  // Unit mix
  units: {
    studio: UnitConfig;
    oneBed: UnitConfig;
    twoBed: UnitConfig;
    threeBed: UnitConfig;
  };
  totalUnits: number;

  // Space breakdown (SF)
  circulation: number;
  retail: number;
  amenitiesIndoor: number;
  amenitiesOutdoor: number;
  supportAreas: number;
  parking: number;
  boh: number;

  // Costs (from APT CC N or R)
  costPerSF: number;
  totalConstructionCost: number;
}

export interface PlacedSpaceV3 {
  id: string;
  type: 'STUDIO' | 'ONE_BED' | 'TWO_BED' | 'THREE_BED' | 'RETAIL' | 'AMENITY' | 'CIRCULATION' | 'SUPPORT' | 'PARKING' | 'BOH';
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
  area: number;
  side?: 'north' | 'south' | 'east' | 'west';  // For perimeter units
}

export interface GeneratedFloorV3 {
  floorIndex: number;
  floorType: 'PARKING' | 'GROUND' | 'RESIDENTIAL';
  boundary: { width: number; height: number };
  spaces: PlacedSpaceV3[];
}

export interface MassingMetrics {
  totalUnitsTarget: number;
  totalUnitsPlaced: number;
  placementRate: number;      // % of target units placed
  efficiency: number;         // % of floor plate used for units
  unitsPlaced: {
    studio: number;
    oneBed: number;
    twoBed: number;
    threeBed: number;
    total: number;
  };
  floorPlateArea: number;
  totalBuildingArea: number;
  costPerSF: number;
  totalCost: number;
  costPerUnit: number;
}

export interface MassingResultV3 {
  floors: GeneratedFloorV3[];
  metrics: MassingMetrics;
  warnings: string[];
  config: FullBuildingConfig;
}

// Construction type cost data ($/SF)
export const CONSTRUCTION_COSTS: Record<BuildMode, Record<ConstructionType, number>> = {
  new: {
    'V': 243,
    'III': 263,
    'V/I': 290,
    'III/I': 292,
    'I': 466,
  },
  repurpose: {
    'V': 195,
    'III': 210,
    'V/I': 232,
    'III/I': 234,
    'I': 373,
  },
};

// Construction type max stories
export const CONSTRUCTION_MAX_STORIES: Record<ConstructionType, number> = {
  'V': 5,
  'III': 6,
  'V/I': 7,
  'III/I': 8,
  'I': 999, // Unlimited
};
