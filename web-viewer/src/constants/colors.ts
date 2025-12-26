/**
 * Color scheme matching config.py from gloq_massing visualization
 */

export const SPACE_TYPE_COLORS: Record<string, string> = {
  // Core space types
  DWELLING_UNIT: "#4CAF50",      // Green
  RETAIL: "#9C27B0",             // Purple
  CIRCULATION: "#FFC107",        // Amber
  SUPPORT: "#2196F3",            // Blue
  STAFF: "#00BCD4",              // Cyan
  AMENITY_INDOOR: "#E91E63",     // Pink
  AMENITY_OUTDOOR: "#8BC34A",    // Light green
  PARKING: "#607D8B",            // Blue grey

  // MEP types
  LOW_VOLTAGE: "#FF5722",        // Deep orange
  DRY_UTILITIES: "#795548",      // Brown
  ELECTRICAL: "#FF9800",         // Orange
  MECHANICAL: "#9E9E9E",         // Grey
  PLUMBING: "#03A9F4",           // Light blue
  FIRE_SPRINKLER: "#F44336",     // Red

  // Default fallback
  DEFAULT: "#999999",            // Grey
};

export const getSpaceColor = (spaceType: string): string => {
  const normalized = spaceType.toUpperCase().replace(/ /g, "_");
  return SPACE_TYPE_COLORS[normalized] || SPACE_TYPE_COLORS.DEFAULT;
};

// SVG styling constants
export const BOUNDARY_COLOR = "#333333";
export const BOUNDARY_LINEWIDTH = 2;
export const SPACE_LINEWIDTH = 1;
export const SPACE_ALPHA = 0.9;
export const LABEL_COLOR = "#333333";
export const LABEL_FONTSIZE = 8;
export const BACKGROUND_COLOR = "#f5f5f5";

// Floor type display names
export const FLOOR_TYPE_LABELS: Record<string, string> = {
  PARKING_UNDERGROUND: "Underground Parking",
  PARKING_PODIUM: "Podium Parking",
  GROUND: "Ground Floor",
  RESIDENTIAL_TYPICAL: "Residential",
  AMENITY: "Amenity",
  ROOF: "Roof",
  BASEMENT: "Basement",
  MIXED_USE: "Mixed Use",
};

export const getFloorTypeLabel = (floorType: string): string => {
  return FLOOR_TYPE_LABELS[floorType] || floorType;
};
