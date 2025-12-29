/**
 * Main SVG floor plan viewer component
 * Supports both rectangle and polygon-based space geometries
 */

import React from 'react';
import { FloorData, SpaceData, isPolygonGeometry, rectToPolygon } from '../../types/solverOutput';
import { getSpaceColor, BOUNDARY_COLOR, BACKGROUND_COLOR } from '../../constants/colors';
import {
  getFloorBounds,
  createSvgTransform,
  boundaryToSvgPoints,
  geometryToSvgRect,
  polygonToSvgPath,
  worldToSvg,
  getGeometryCenter,
} from '../../utils/geometry';
import { calculateCentroid } from '../../utils/polygon';

interface FloorPlanViewerProps {
  floor: FloorData;
  selectedSpaceId: string | null;
  onSpaceClick: (space: SpaceData) => void;
  scale?: number;
  showLabels?: boolean;
}

export const FloorPlanViewer: React.FC<FloorPlanViewerProps> = ({
  floor,
  selectedSpaceId,
  onSpaceClick,
  scale = 3,
  showLabels = true,
}) => {
  const bounds = getFloorBounds(floor);
  const transform = createSvgTransform(bounds, scale, 30);

  // Separate vertical and non-vertical spaces
  const nonVerticalSpaces = floor.spaces.filter(s => !s.is_vertical);
  const verticalSpaces = floor.spaces.filter(s => s.is_vertical);

  return (
    <svg
      width={transform.svgWidth}
      height={transform.svgHeight}
      style={{ border: '1px solid #ddd', background: '#fff' }}
    >
      {/* Background */}
      <rect
        x={0}
        y={0}
        width={transform.svgWidth}
        height={transform.svgHeight}
        fill="#fff"
      />

      {/* Floor boundary */}
      <path
        d={boundaryToSvgPoints(floor.boundary, transform)}
        fill={BACKGROUND_COLOR}
        stroke={BOUNDARY_COLOR}
        strokeWidth={2}
      />

      {/* Non-vertical spaces (draw first) */}
      {nonVerticalSpaces.map(space => (
        <SpaceRect
          key={space.id}
          space={space}
          transform={transform}
          isSelected={space.id === selectedSpaceId}
          isVertical={false}
          showLabel={showLabels}
          onClick={() => onSpaceClick(space)}
        />
      ))}

      {/* Vertical spaces (draw on top) */}
      {verticalSpaces.map(space => (
        <SpaceRect
          key={space.id}
          space={space}
          transform={transform}
          isSelected={space.id === selectedSpaceId}
          isVertical={true}
          showLabel={showLabels}
          onClick={() => onSpaceClick(space)}
        />
      ))}
    </svg>
  );
};

interface SpaceShapeProps {
  space: SpaceData;
  transform: ReturnType<typeof createSvgTransform>;
  isSelected: boolean;
  isVertical: boolean;
  showLabel: boolean;
  onClick: () => void;
}

/**
 * Renders a space as either a rectangle or polygon based on geometry type
 */
const SpaceShape: React.FC<SpaceShapeProps> = ({
  space,
  transform,
  isSelected,
  isVertical,
  showLabel,
  onClick,
}) => {
  const color = getSpaceColor(space.type);
  const geometry = space.geometry;

  // Determine if this is a polygon geometry
  const isPolygon = isPolygonGeometry(geometry);

  // Get center point for label positioning
  const center = getGeometryCenter(geometry);
  const svgCenter = worldToSvg(center.x, center.y, transform);

  if (isPolygon) {
    // Render as SVG path for polygon geometry
    const pathD = polygonToSvgPath(geometry, transform);

    return (
      <g
        onClick={onClick}
        style={{ cursor: 'pointer' }}
      >
        <path
          d={pathD}
          fill={color}
          fillOpacity={0.9}
          stroke={isSelected ? '#000' : BOUNDARY_COLOR}
          strokeWidth={isSelected ? 2 : 1}
          strokeDasharray={isVertical ? '4,2' : undefined}
        />
        {showLabel && (
          <text
            x={svgCenter.x}
            y={svgCenter.y}
            textAnchor="middle"
            dominantBaseline="middle"
            fontSize={8}
            fill="#333"
            pointerEvents="none"
          >
            {space.name.length > 12 ? space.name.slice(0, 12) + '...' : space.name}
          </text>
        )}
      </g>
    );
  }

  // Render as rectangle (original behavior)
  const rect = geometryToSvgRect(geometry, transform);
  const halfWidth = rect.width / 2;
  const halfHeight = rect.height / 2;

  return (
    <g
      onClick={onClick}
      style={{ cursor: 'pointer' }}
    >
      <rect
        x={rect.x - halfWidth}
        y={rect.y - halfHeight}
        width={rect.width}
        height={rect.height}
        fill={color}
        fillOpacity={0.9}
        stroke={isSelected ? '#000' : BOUNDARY_COLOR}
        strokeWidth={isSelected ? 2 : 1}
        strokeDasharray={isVertical ? '4,2' : undefined}
        transform={`rotate(${-rect.rotation}, ${rect.x}, ${rect.y})`}
      />
      {showLabel && (
        <text
          x={rect.x}
          y={rect.y}
          textAnchor="middle"
          dominantBaseline="middle"
          fontSize={8}
          fill="#333"
          pointerEvents="none"
          transform={`rotate(${-rect.rotation}, ${rect.x}, ${rect.y})`}
        >
          {space.name.length > 12 ? space.name.slice(0, 12) + '...' : space.name}
        </text>
      )}
    </g>
  );
};

// Backward compatible alias
const SpaceRect = SpaceShape;

export default FloorPlanViewer;
