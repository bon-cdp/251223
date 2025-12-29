/**
 * Polygon editor overlay for a space
 * Shows vertex handles and edge handles when space is selected in edit mode
 */

import React, { useCallback } from 'react';
import { VertexHandle } from './VertexHandle';
import { EdgeHandle } from './EdgeHandle';
import { SvgTransform, worldToSvg, svgToWorld } from '../../utils/geometry';

interface PolygonEditorProps {
  vertices: [number, number][];
  transform: SvgTransform;
  isSelected: boolean;
  showVertexHandles: boolean;
  showEdgeHandles: boolean;
  onVertexMove: (vertexIndex: number, newX: number, newY: number) => void;
  onVertexRemove: (vertexIndex: number) => void;
  onEdgeAddVertex: (edgeIndex: number) => void;
  onDragStart?: () => void;
  onDragEnd?: () => void;
}

export const PolygonEditor: React.FC<PolygonEditorProps> = ({
  vertices,
  transform,
  isSelected,
  showVertexHandles,
  showEdgeHandles,
  onVertexMove,
  onVertexRemove,
  onEdgeAddVertex,
  onDragStart,
  onDragEnd,
}) => {
  // Convert vertices to SVG coordinates
  const svgVertices = vertices.map((v, index) => {
    const svg = worldToSvg(v[0], v[1], transform);
    return { x: svg.x, y: svg.y, index };
  });

  // Calculate edge midpoints
  const edgeMidpoints = vertices.map((_, i) => {
    const j = (i + 1) % vertices.length;
    const midX = (vertices[i][0] + vertices[j][0]) / 2;
    const midY = (vertices[i][1] + vertices[j][1]) / 2;
    const svg = worldToSvg(midX, midY, transform);
    return { x: svg.x, y: svg.y, edgeIndex: i };
  });

  // Handle vertex drag - convert SVG coords back to world coords
  const handleVertexDrag = useCallback((vertexIndex: number, svgX: number, svgY: number) => {
    const world = svgToWorld(svgX, svgY, transform);
    onVertexMove(vertexIndex, world.x, world.y);
  }, [transform, onVertexMove]);

  if (!isSelected) return null;

  return (
    <g className="polygon-editor">
      {/* Edge handles (add vertex) - render first so vertices are on top */}
      {showEdgeHandles && edgeMidpoints.map(mp => (
        <EdgeHandle
          key={`edge-${mp.edgeIndex}`}
          x={mp.x}
          y={mp.y}
          edgeIndex={mp.edgeIndex}
          onClick={onEdgeAddVertex}
        />
      ))}

      {/* Vertex handles */}
      {showVertexHandles && svgVertices.map(v => (
        <VertexHandle
          key={`vertex-${v.index}`}
          x={v.x}
          y={v.y}
          index={v.index}
          isSelected={true}
          onDrag={handleVertexDrag}
          onDragStart={onDragStart}
          onDragEnd={onDragEnd}
          onRightClick={onVertexRemove}
        />
      ))}

      {/* Draw connecting lines between vertices (dashed for visual feedback) */}
      {showVertexHandles && (
        <path
          d={
            svgVertices
              .map((v, i) => `${i === 0 ? 'M' : 'L'}${v.x},${v.y}`)
              .join(' ') + ' Z'
          }
          fill="none"
          stroke="#7c3aed"
          strokeWidth={1}
          strokeDasharray="4,4"
          pointerEvents="none"
          opacity={0.5}
        />
      )}
    </g>
  );
};

export default PolygonEditor;
