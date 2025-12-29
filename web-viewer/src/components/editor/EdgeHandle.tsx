/**
 * Edge midpoint handle for adding new vertices
 * Click to add a vertex at the edge midpoint
 */

import React, { useState, useCallback } from 'react';

interface EdgeHandleProps {
  x: number;
  y: number;
  edgeIndex: number;
  onClick: (edgeIndex: number) => void;
  size?: number;
}

export const EdgeHandle: React.FC<EdgeHandleProps> = ({
  x,
  y,
  edgeIndex,
  onClick,
  size = 6,
}) => {
  const [isHovered, setIsHovered] = useState(false);

  const handleClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    onClick(edgeIndex);
  }, [edgeIndex, onClick]);

  // Only show when hovered
  if (!isHovered) {
    return (
      <circle
        cx={x}
        cy={y}
        r={size + 4}
        fill="transparent"
        onMouseEnter={() => setIsHovered(true)}
        style={{ cursor: 'crosshair' }}
      />
    );
  }

  return (
    <g
      onClick={handleClick}
      onMouseLeave={() => setIsHovered(false)}
      style={{ cursor: 'crosshair' }}
    >
      {/* Hit area */}
      <circle
        cx={x}
        cy={y}
        r={size + 4}
        fill="transparent"
      />
      {/* Visible handle - plus icon */}
      <circle
        cx={x}
        cy={y}
        r={size}
        fill="#10b981"
        stroke="#fff"
        strokeWidth={1.5}
      />
      {/* Plus sign */}
      <line
        x1={x - size / 2 + 1}
        y1={y}
        x2={x + size / 2 - 1}
        y2={y}
        stroke="#fff"
        strokeWidth={2}
        pointerEvents="none"
      />
      <line
        x1={x}
        y1={y - size / 2 + 1}
        x2={x}
        y2={y + size / 2 - 1}
        stroke="#fff"
        strokeWidth={2}
        pointerEvents="none"
      />
      {/* Tooltip */}
      <text
        x={x}
        y={y - size - 6}
        textAnchor="middle"
        fontSize={9}
        fill="#10b981"
        fontWeight="bold"
        pointerEvents="none"
      >
        + Add Vertex
      </text>
    </g>
  );
};

export default EdgeHandle;
