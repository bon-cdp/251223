/**
 * Editable floor plan viewer with vertex editing support
 * Extends FloorPlanViewer with drag-and-drop vertex manipulation
 */

import React, { useMemo } from 'react';
import { FloorData, SpaceData, isPolygonGeometry, rectToPolygon } from '../../types/solverOutput';
import { getSpaceColor, BOUNDARY_COLOR, BACKGROUND_COLOR } from '../../constants/colors';
import {
  getFloorBounds,
  createSvgTransform,
  boundaryToSvgPoints,
  polygonToSvgPath,
  worldToSvg,
  getGeometryCenter,
} from '../../utils/geometry';
import { PolygonEditor } from '../editor/PolygonEditor';
import { EditMode } from '../../hooks/usePolygonEditor';

interface EditableSpaceData extends SpaceData {
  editableVertices?: [number, number][];
  hasChanges?: boolean;
  hasCollision?: boolean;
}

interface EditableFloorPlanViewerProps {
  floor: FloorData;
  editableSpaces?: EditableSpaceData[];
  selectedSpaceId: string | null;
  editMode: EditMode;
  onSpaceClick: (space: SpaceData) => void;
  onVertexMove?: (spaceId: string, vertexIndex: number, x: number, y: number) => void;
  onVertexRemove?: (spaceId: string, vertexIndex: number) => void;
  onVertexAdd?: (spaceId: string, edgeIndex: number) => void;
  onDragStart?: () => void;
  onDragEnd?: () => void;
  scale?: number;
  showLabels?: boolean;
}

export const EditableFloorPlanViewer: React.FC<EditableFloorPlanViewerProps> = ({
  floor,
  editableSpaces,
  selectedSpaceId,
  editMode,
  onSpaceClick,
  onVertexMove,
  onVertexRemove,
  onVertexAdd,
  onDragStart,
  onDragEnd,
  scale = 3,
  showLabels = true,
}) => {
  const bounds = getFloorBounds(floor);
  const transform = createSvgTransform(bounds, scale, 30);

  // Use editable spaces if provided, otherwise use floor.spaces
  const spaces = useMemo(() => {
    if (editableSpaces && editableSpaces.length > 0) {
      return editableSpaces.filter(s => s.floor_index === floor.floor_index);
    }
    return floor.spaces;
  }, [editableSpaces, floor]);

  // Separate vertical and non-vertical spaces
  const nonVerticalSpaces = spaces.filter(s => !s.is_vertical);
  const verticalSpaces = spaces.filter(s => s.is_vertical);

  // Check if we're in vertex editing mode
  const isEditingVertices = editMode === 'vertex';

  return (
    <svg
      width={transform.svgWidth}
      height={transform.svgHeight}
      style={{ border: '1px solid #333', background: '#1e1e2e' }}
    >
      {/* Background */}
      <rect
        x={0}
        y={0}
        width={transform.svgWidth}
        height={transform.svgHeight}
        fill="#1e1e2e"
      />

      {/* Floor boundary */}
      <path
        d={boundaryToSvgPoints(floor.boundary, transform)}
        fill="#2d2d3f"
        stroke="#4a4a5a"
        strokeWidth={2}
      />

      {/* Non-vertical spaces (draw first) */}
      {nonVerticalSpaces.map(space => (
        <EditableSpace
          key={space.id}
          space={space as EditableSpaceData}
          transform={transform}
          isSelected={space.id === selectedSpaceId}
          isVertical={false}
          showLabel={showLabels}
          isEditMode={isEditingVertices && space.id === selectedSpaceId}
          onClick={() => onSpaceClick(space)}
          onVertexMove={onVertexMove}
          onVertexRemove={onVertexRemove}
          onVertexAdd={onVertexAdd}
          onDragStart={onDragStart}
          onDragEnd={onDragEnd}
        />
      ))}

      {/* Vertical spaces (draw on top) */}
      {verticalSpaces.map(space => (
        <EditableSpace
          key={space.id}
          space={space as EditableSpaceData}
          transform={transform}
          isSelected={space.id === selectedSpaceId}
          isVertical={true}
          showLabel={showLabels}
          isEditMode={isEditingVertices && space.id === selectedSpaceId}
          onClick={() => onSpaceClick(space)}
          onVertexMove={onVertexMove}
          onVertexRemove={onVertexRemove}
          onVertexAdd={onVertexAdd}
          onDragStart={onDragStart}
          onDragEnd={onDragEnd}
        />
      ))}

      {/* Edit mode indicator */}
      {isEditingVertices && selectedSpaceId && (
        <text
          x={10}
          y={20}
          fontSize={11}
          fill="#7c3aed"
          fontWeight="bold"
        >
          EDIT MODE: Drag vertices to reshape
        </text>
      )}
    </svg>
  );
};

interface EditableSpaceProps {
  space: EditableSpaceData;
  transform: ReturnType<typeof createSvgTransform>;
  isSelected: boolean;
  isVertical: boolean;
  showLabel: boolean;
  isEditMode: boolean;
  onClick: () => void;
  onVertexMove?: (spaceId: string, vertexIndex: number, x: number, y: number) => void;
  onVertexRemove?: (spaceId: string, vertexIndex: number) => void;
  onVertexAdd?: (spaceId: string, edgeIndex: number) => void;
  onDragStart?: () => void;
  onDragEnd?: () => void;
}

const EditableSpace: React.FC<EditableSpaceProps> = ({
  space,
  transform,
  isSelected,
  isVertical,
  showLabel,
  isEditMode,
  onClick,
  onVertexMove,
  onVertexRemove,
  onVertexAdd,
  onDragStart,
  onDragEnd,
}) => {
  const color = getSpaceColor(space.type);
  const geometry = space.geometry;

  // Get vertices for rendering and editing
  const vertices = useMemo(() => {
    if (space.editableVertices) {
      return space.editableVertices;
    }
    if (isPolygonGeometry(geometry)) {
      return geometry.vertices;
    }
    return rectToPolygon(geometry);
  }, [space.editableVertices, geometry]);

  // Convert vertices to SVG path
  const pathD = useMemo(() => {
    return vertices
      .map((v, i) => {
        const svg = worldToSvg(v[0], v[1], transform);
        return `${i === 0 ? 'M' : 'L'}${svg.x},${svg.y}`;
      })
      .join(' ') + ' Z';
  }, [vertices, transform]);

  // Get center for label
  const center = useMemo(() => {
    const xs = vertices.map(v => v[0]);
    const ys = vertices.map(v => v[1]);
    const cx = (Math.min(...xs) + Math.max(...xs)) / 2;
    const cy = (Math.min(...ys) + Math.max(...ys)) / 2;
    return worldToSvg(cx, cy, transform);
  }, [vertices, transform]);

  // Determine stroke style
  const strokeColor = space.hasCollision
    ? '#ef4444' // Red for collision
    : isSelected
    ? '#7c3aed' // Purple when selected
    : '#4a4a5a'; // Default dark

  const strokeWidth = isSelected ? 2 : 1;

  return (
    <g style={{ cursor: 'pointer' }}>
      {/* Space shape */}
      <path
        d={pathD}
        fill={color}
        fillOpacity={isSelected ? 1 : 0.85}
        stroke={strokeColor}
        strokeWidth={strokeWidth}
        strokeDasharray={isVertical ? '4,2' : undefined}
        onClick={onClick}
      />

      {/* Label */}
      {showLabel && (
        <text
          x={center.x}
          y={center.y}
          textAnchor="middle"
          dominantBaseline="middle"
          fontSize={9}
          fill="#fff"
          fontWeight={isSelected ? 'bold' : 'normal'}
          pointerEvents="none"
          style={{ textShadow: '0 1px 2px rgba(0,0,0,0.5)' }}
        >
          {space.name.length > 15 ? space.name.slice(0, 15) + '...' : space.name}
        </text>
      )}

      {/* Change indicator */}
      {space.hasChanges && (
        <circle
          cx={center.x + 20}
          cy={center.y - 10}
          r={4}
          fill="#f59e0b"
          stroke="#fff"
          strokeWidth={1}
        />
      )}

      {/* Collision warning */}
      {space.hasCollision && (
        <text
          x={center.x}
          y={center.y + 12}
          textAnchor="middle"
          fontSize={8}
          fill="#ef4444"
          fontWeight="bold"
          pointerEvents="none"
        >
          ⚠ OVERLAP
        </text>
      )}

      {/* Polygon editor overlay when in edit mode */}
      {isEditMode && (
        <PolygonEditor
          vertices={vertices}
          transform={transform}
          isSelected={true}
          showVertexHandles={true}
          showEdgeHandles={true}
          onVertexMove={(vertexIndex, x, y) =>
            onVertexMove?.(space.id, vertexIndex, x, y)
          }
          onVertexRemove={(vertexIndex) =>
            onVertexRemove?.(space.id, vertexIndex)
          }
          onEdgeAddVertex={(edgeIndex) =>
            onVertexAdd?.(space.id, edgeIndex)
          }
          onDragStart={onDragStart}
          onDragEnd={onDragEnd}
        />
      )}
    </g>
  );
};

export default EditableFloorPlanViewer;
