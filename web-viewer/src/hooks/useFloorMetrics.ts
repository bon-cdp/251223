/**
 * Hook for calculating real-time floor metrics
 * Updates automatically when floor data changes
 */

import { useMemo } from 'react';
import { FloorData, SpaceData, isPolygonGeometry, rectToPolygon } from '../types/solverOutput';
import { calculatePolygonArea, polygonsOverlap, Polygon } from '../utils/polygon';

interface SpaceMetrics {
  id: string;
  type: string;
  area: number;
}

interface TypeSummary {
  type: string;
  count: number;
  totalArea: number;
  percentage: number;
}

interface FloorMetrics {
  // Area metrics
  totalFloorArea: number;
  usableArea: number;
  efficiencyRatio: number;

  // Space counts
  totalSpaces: number;
  spacesByType: TypeSummary[];

  // Unit metrics
  dwellingUnits: number;
  retailSpaces: number;
  parkingSpaces: number;

  // Violations
  violations: string[];
  hasOverlaps: boolean;
  overlappingSpaces: string[];

  // Change tracking
  originalArea: number;
  areaDelta: number;
  areaDeltaPercent: number;
}

interface EditableSpace extends SpaceData {
  editableVertices?: [number, number][];
  originalGeometry?: any;
}

/**
 * Get vertices from a space (either editable or from geometry)
 */
function getSpaceVertices(space: EditableSpace): [number, number][] {
  if (space.editableVertices) {
    return space.editableVertices;
  }
  if (isPolygonGeometry(space.geometry)) {
    return space.geometry.vertices;
  }
  return rectToPolygon(space.geometry);
}

/**
 * Calculate space area from vertices
 */
function getSpaceArea(space: EditableSpace): number {
  const vertices = getSpaceVertices(space);
  return calculatePolygonArea(vertices);
}

/**
 * Check for overlapping spaces on the same floor
 */
function findOverlaps(spaces: EditableSpace[]): string[] {
  const overlapping: Set<string> = new Set();

  for (let i = 0; i < spaces.length; i++) {
    for (let j = i + 1; j < spaces.length; j++) {
      // Skip vertical spaces (elevators, stairs) - they can overlap
      if (spaces[i].is_vertical || spaces[j].is_vertical) continue;

      const verticesA = getSpaceVertices(spaces[i]) as Polygon;
      const verticesB = getSpaceVertices(spaces[j]) as Polygon;

      if (polygonsOverlap(verticesA, verticesB)) {
        overlapping.add(spaces[i].id);
        overlapping.add(spaces[j].id);
      }
    }
  }

  return Array.from(overlapping);
}

export function useFloorMetrics(
  floor: FloorData,
  editableSpaces?: EditableSpace[]
): FloorMetrics {
  return useMemo(() => {
    // Use editable spaces if provided, filter to current floor
    const spaces = editableSpaces
      ? editableSpaces.filter(s => s.floor_index === floor.floor_index)
      : floor.spaces;

    // Calculate total floor area from boundary
    const totalFloorArea = calculatePolygonArea(floor.boundary as Polygon);

    // Calculate usable area (sum of all space areas)
    let usableArea = 0;
    const spaceMetrics: SpaceMetrics[] = [];

    for (const space of spaces) {
      const area = getSpaceArea(space as EditableSpace);
      usableArea += area;
      spaceMetrics.push({
        id: space.id,
        type: space.type,
        area,
      });
    }

    // Calculate efficiency ratio
    const efficiencyRatio = totalFloorArea > 0
      ? (usableArea / totalFloorArea) * 100
      : 0;

    // Group by type
    const typeMap = new Map<string, { count: number; totalArea: number }>();
    for (const sm of spaceMetrics) {
      const existing = typeMap.get(sm.type) || { count: 0, totalArea: 0 };
      existing.count++;
      existing.totalArea += sm.area;
      typeMap.set(sm.type, existing);
    }

    const spacesByType: TypeSummary[] = Array.from(typeMap.entries())
      .map(([type, data]) => ({
        type,
        count: data.count,
        totalArea: data.totalArea,
        percentage: usableArea > 0 ? (data.totalArea / usableArea) * 100 : 0,
      }))
      .sort((a, b) => b.totalArea - a.totalArea);

    // Count specific types
    const dwellingUnits = spacesByType.find(s => s.type === 'DWELLING_UNIT')?.count || 0;
    const retailSpaces = spacesByType.find(s => s.type === 'RETAIL')?.count || 0;
    const parkingSpaces = spacesByType.find(s => s.type === 'PARKING')?.count || 0;

    // Find overlaps
    const overlappingSpaces = findOverlaps(spaces as EditableSpace[]);
    const hasOverlaps = overlappingSpaces.length > 0;

    // Build violations list
    const violations: string[] = [];
    if (hasOverlaps) {
      violations.push(`${overlappingSpaces.length} spaces overlap`);
    }
    if (efficiencyRatio > 100) {
      violations.push('Spaces exceed floor boundary');
    }
    if (efficiencyRatio < 50) {
      violations.push('Low space utilization (<50%)');
    }

    // Calculate area delta from original
    const originalArea = floor.area_sf || totalFloorArea;
    const areaDelta = usableArea - originalArea;
    const areaDeltaPercent = originalArea > 0
      ? (areaDelta / originalArea) * 100
      : 0;

    return {
      totalFloorArea,
      usableArea,
      efficiencyRatio,
      totalSpaces: spaces.length,
      spacesByType,
      dwellingUnits,
      retailSpaces,
      parkingSpaces,
      violations,
      hasOverlaps,
      overlappingSpaces,
      originalArea,
      areaDelta,
      areaDeltaPercent,
    };
  }, [floor, editableSpaces]);
}

/**
 * Calculate building-wide metrics across all floors
 */
export function useBuildingMetrics(
  floors: FloorData[],
  editableSpaces?: EditableSpace[]
): {
  totalUnits: number;
  totalArea: number;
  avgEfficiency: number;
  totalViolations: number;
  floorMetrics: FloorMetrics[];
} {
  return useMemo(() => {
    const floorMetrics = floors.map(floor =>
      useFloorMetrics(floor, editableSpaces)
    );

    const totalUnits = floorMetrics.reduce((sum, m) => sum + m.dwellingUnits, 0);
    const totalArea = floorMetrics.reduce((sum, m) => sum + m.usableArea, 0);
    const avgEfficiency = floorMetrics.length > 0
      ? floorMetrics.reduce((sum, m) => sum + m.efficiencyRatio, 0) / floorMetrics.length
      : 0;
    const totalViolations = floorMetrics.reduce((sum, m) => sum + m.violations.length, 0);

    return {
      totalUnits,
      totalArea,
      avgEfficiency,
      totalViolations,
      floorMetrics,
    };
  }, [floors, editableSpaces]);
}

export default useFloorMetrics;
