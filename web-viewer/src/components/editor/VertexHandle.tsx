/**
 * Draggable vertex handle for polygon editing
 */

import React, { useCallback, useRef, useState } from 'react';

interface VertexHandleProps {
  x: number;
  y: number;
  index: number;
  isSelected?: boolean;
  onDrag: (index: number, newX: number, newY: number) => void;
  onDragStart?: () => void;
  onDragEnd?: () => void;
  onRightClick?: (index: number) => void;
  size?: number;
}

export const VertexHandle: React.FC<VertexHandleProps> = ({
  x,
  y,
  index,
  isSelected = false,
  onDrag,
  onDragStart,
  onDragEnd,
  onRightClick,
  size = 8,
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const svgRef = useRef<SVGSVGElement | null>(null);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();

    if (e.button === 2) {
      // Right click
      onRightClick?.(index);
      return;
    }

    setIsDragging(true);
    onDragStart?.();

    // Get SVG element for coordinate conversion
    const svg = (e.target as SVGElement).ownerSVGElement;
    if (!svg) return;
    svgRef.current = svg;

    const handleMouseMove = (moveEvent: MouseEvent) => {
      if (!svgRef.current) return;

      // Convert screen coordinates to SVG coordinates
      const pt = svgRef.current.createSVGPoint();
      pt.x = moveEvent.clientX;
      pt.y = moveEvent.clientY;
      const svgPt = pt.matrixTransform(svgRef.current.getScreenCTM()?.inverse());

      onDrag(index, svgPt.x, svgPt.y);
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      onDragEnd?.();
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  }, [index, onDrag, onDragStart, onDragEnd, onRightClick]);

  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    onRightClick?.(index);
  }, [index, onRightClick]);

  const halfSize = size / 2;
  const fillColor = isDragging
    ? '#ef4444' // Red when dragging
    : isHovered
    ? '#f59e0b' // Amber on hover
    : isSelected
    ? '#7c3aed' // Purple when selected
    : '#3b82f6'; // Blue default

  return (
    <g
      onMouseDown={handleMouseDown}
      onContextMenu={handleContextMenu}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{ cursor: isDragging ? 'grabbing' : 'grab' }}
    >
      {/* Larger invisible hit area */}
      <circle
        cx={x}
        cy={y}
        r={size}
        fill="transparent"
      />
      {/* Visible handle */}
      <rect
        x={x - halfSize}
        y={y - halfSize}
        width={size}
        height={size}
        fill={fillColor}
        stroke="#fff"
        strokeWidth={1.5}
        style={{
          transition: 'fill 0.15s ease',
        }}
      />
      {/* Index label (shown on hover) */}
      {isHovered && (
        <text
          x={x}
          y={y - size - 4}
          textAnchor="middle"
          fontSize={9}
          fill="#333"
          fontWeight="bold"
          pointerEvents="none"
        >
          {index + 1}
        </text>
      )}
    </g>
  );
};

export default VertexHandle;
