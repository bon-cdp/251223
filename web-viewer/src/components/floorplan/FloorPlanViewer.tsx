/**
 * Main SVG floor plan viewer component
 */

import React from 'react';
import { FloorData, SpaceData } from '../../types/solverOutput';
import { getSpaceColor, BOUNDARY_COLOR, BACKGROUND_COLOR } from '../../constants/colors';
import {
  getFloorBounds,
  createSvgTransform,
  boundaryToSvgPoints,
  geometryToSvgRect,
  worldToSvg,
} from '../../utils/geometry';

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

interface SpaceRectProps {
  space: SpaceData;
  transform: ReturnType<typeof createSvgTransform>;
  isSelected: boolean;
  isVertical: boolean;
  showLabel: boolean;
  onClick: () => void;
}

const SpaceRect: React.FC<SpaceRectProps> = ({
  space,
  transform,
  isSelected,
  isVertical,
  showLabel,
  onClick,
}) => {
  const rect = geometryToSvgRect(space.geometry, transform);
  const color = getSpaceColor(space.type);

  // For rotation, we need to position the rect centered and apply transform
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

export default FloorPlanViewer;
