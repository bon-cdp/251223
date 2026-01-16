/**
 * SVG Floor Plan Viewer
 * Displays generated massing with color-coded spaces
 * Updated for V3 perimeter-based layout
 */

import { useMemo, useState } from 'react';
import type { GeneratedFloorV3, PlacedSpaceV3 } from '../types/building';
import { SPACE_COLORS } from '../types/building';

interface MassingViewerProps {
  floors: GeneratedFloorV3[];
  warnings?: string[];
}

export function MassingViewer({ floors, warnings = [] }: MassingViewerProps) {
  const [selectedFloor, setSelectedFloor] = useState(0);
  const [hoveredSpace, setHoveredSpace] = useState<PlacedSpaceV3 | null>(null);

  // Find ground floor index
  const groundFloorIdx = useMemo(() => {
    const idx = floors.findIndex(f => f.floorIndex === 0);
    return idx >= 0 ? idx : Math.floor(floors.length / 2);
  }, [floors]);

  // Start at ground floor if it exists
  const currentFloorIdx = selectedFloor >= 0 && selectedFloor < floors.length ? selectedFloor : groundFloorIdx;
  const floor = floors[currentFloorIdx];

  if (!floor) {
    return (
      <div className="flex items-center justify-center h-full text-gray-400">
        Upload an Excel file to generate floor plans
      </div>
    );
  }

  // Calculate SVG viewBox with padding
  const padding = 20;
  const { width: floorW, height: floorH } = floor.boundary;
  const viewBox = `${-floorW/2 - padding} ${-floorH/2 - padding} ${floorW + padding*2} ${floorH + padding*2}`;

  // Scale for display (SVG coordinate to screen pixels)
  const scale = 3;

  return (
    <div className="flex flex-col h-full">
      {/* Floor selector */}
      <div className="flex items-center gap-1 mb-3 overflow-x-auto pb-2">
        <span className="text-xs text-gray-500 mr-2">Floor:</span>
        {floors.map((f, idx) => (
          <button
            key={f.floorIndex}
            className={`px-3 py-1.5 text-sm rounded-md transition-all ${
              idx === currentFloorIdx
                ? 'bg-indigo-600 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
            onClick={() => setSelectedFloor(idx)}
          >
            {f.floorIndex < 0 ? `B${Math.abs(f.floorIndex)}` :
             f.floorIndex === 0 ? 'G' : f.floorIndex}
          </button>
        ))}
      </div>

      {/* Floor type label */}
      <div className="text-sm text-gray-500 mb-2">
        {floor.floorType === 'PARKING' ? 'Parking Level' :
         floor.floorType === 'GROUND' ? 'Ground Floor' :
         `Residential Floor ${floor.floorIndex}`}
        <span className="ml-2 text-gray-400">
          ({Math.round(floor.boundary.width)}' x {Math.round(floor.boundary.height)}')
        </span>
      </div>

      {/* SVG Floor Plan */}
      <div className="flex-1 bg-gray-900 rounded-lg overflow-hidden relative">
        <svg
          viewBox={viewBox}
          width={floorW * scale}
          height={floorH * scale}
          style={{ maxWidth: '100%', maxHeight: '100%' }}
          className="mx-auto"
        >
          {/* Floor plate boundary */}
          <rect
            x={-floorW/2}
            y={-floorH/2}
            width={floorW}
            height={floorH}
            fill="#1e1e2e"
            stroke="#3a3a4a"
            strokeWidth="1"
          />

          {/* Grid lines (every 25 ft) */}
          <g className="grid" stroke="#2d2d3f" strokeWidth="0.3">
            {Array.from({ length: Math.ceil(floorW / 25) + 1 }, (_, i) => {
              const x = -floorW/2 + i * 25;
              return <line key={`v${i}`} x1={x} y1={-floorH/2} x2={x} y2={floorH/2} />;
            })}
            {Array.from({ length: Math.ceil(floorH / 25) + 1 }, (_, i) => {
              const y = -floorH/2 + i * 25;
              return <line key={`h${i}`} x1={-floorW/2} y1={y} x2={floorW/2} y2={y} />;
            })}
          </g>

          {/* Spaces */}
          {floor.spaces.map(space => (
            <g
              key={space.id}
              className="space cursor-pointer"
              onMouseEnter={() => setHoveredSpace(space)}
              onMouseLeave={() => setHoveredSpace(null)}
            >
              <rect
                x={space.x - space.width/2}
                y={space.y - space.height/2}
                width={space.width}
                height={space.height}
                fill={SPACE_COLORS[space.type] || '#6b7280'}
                stroke={hoveredSpace?.id === space.id ? '#ffffff' : '#1e1e2e'}
                strokeWidth={hoveredSpace?.id === space.id ? 1 : 0.5}
                rx="0.5"
                opacity={hoveredSpace && hoveredSpace.id !== space.id ? 0.6 : 1}
              />
              {/* Label for larger spaces */}
              {space.width > 12 && space.height > 8 && (
                <text
                  x={space.x}
                  y={space.y}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fill="white"
                  fontSize="3.5"
                  fontFamily="system-ui"
                  pointerEvents="none"
                >
                  {space.name}
                </text>
              )}
            </g>
          ))}

          {/* Center crosshair for reference */}
          <g stroke="#4a4a5a" strokeWidth="0.3" opacity="0.5">
            <line x1="-10" y1="0" x2="10" y2="0" />
            <line x1="0" y1="-10" x2="0" y2="10" />
          </g>
        </svg>

        {/* Hover tooltip */}
        {hoveredSpace && (
          <div className="absolute bottom-4 left-4 bg-gray-800 text-white px-3 py-2 rounded-lg text-sm shadow-lg">
            <div className="font-medium">{hoveredSpace.name}</div>
            <div className="text-gray-300 text-xs mt-1">
              {Math.round(hoveredSpace.width)}' x {Math.round(hoveredSpace.height)}' = {Math.round(hoveredSpace.area)} SF
              {hoveredSpace.side && <span className="ml-2 text-gray-400">({hoveredSpace.side})</span>}
            </div>
          </div>
        )}
      </div>

      {/* Warnings */}
      {warnings.length > 0 && (
        <div className="mt-2 text-sm text-amber-500 bg-amber-50 rounded-lg p-2">
          {warnings.map((w, i) => (
            <div key={i}>{w}</div>
          ))}
        </div>
      )}

      {/* Legend */}
      <div className="flex flex-wrap gap-3 mt-3 pt-3 border-t border-gray-200">
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded" style={{ background: SPACE_COLORS.STUDIO }} />
          <span className="text-xs text-gray-600">Studio</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded" style={{ background: SPACE_COLORS.ONE_BED }} />
          <span className="text-xs text-gray-600">1 BR</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded" style={{ background: SPACE_COLORS.TWO_BED }} />
          <span className="text-xs text-gray-600">2 BR</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded" style={{ background: SPACE_COLORS.THREE_BED }} />
          <span className="text-xs text-gray-600">3 BR</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded" style={{ background: SPACE_COLORS.RETAIL }} />
          <span className="text-xs text-gray-600">Retail</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded" style={{ background: SPACE_COLORS.AMENITY }} />
          <span className="text-xs text-gray-600">Amenity</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded" style={{ background: SPACE_COLORS.CIRCULATION }} />
          <span className="text-xs text-gray-600">Circulation</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded" style={{ background: SPACE_COLORS.SUPPORT }} />
          <span className="text-xs text-gray-600">Support</span>
        </div>
      </div>
    </div>
  );
}
