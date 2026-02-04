import { BuildingShape, ShapeDimensions, SetbackConfig } from '../../utils/massing/types';

interface ShapeConfigProps {
  shape: BuildingShape;
  dimensions: ShapeDimensions;
  setback: SetbackConfig;
  onDimensionsChange: (dimensions: ShapeDimensions) => void;
  onSetbackChange: (setback: SetbackConfig) => void;
}

export function ShapeConfig({
  shape,
  dimensions,
  setback,
  onDimensionsChange,
  onSetbackChange
}: ShapeConfigProps) {
  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">Building Dimensions</label>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="block text-xs text-gray-500 mb-1">Width (ft)</label>
            <input
              type="number"
              value={dimensions.width}
              onChange={(e) => onDimensionsChange({ ...dimensions, width: Number(e.target.value) })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Height (ft)</label>
            <input
              type="number"
              value={dimensions.height}
              onChange={(e) => onDimensionsChange({ ...dimensions, height: Number(e.target.value) })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
      </div>

      {(shape === 'courtyard' || shape === 'donut') && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Courtyard Dimensions</label>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Width (ft)</label>
              <input
                type="number"
                value={dimensions.courtyardWidth ?? 0}
                onChange={(e) => onDimensionsChange({ ...dimensions, courtyardWidth: Number(e.target.value) })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Depth (ft)</label>
              <input
                type="number"
                value={dimensions.courtyardDepth ?? 0}
                onChange={(e) => onDimensionsChange({ ...dimensions, courtyardDepth: Number(e.target.value) })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
        </div>
      )}

      {(shape === 'h-shape' || shape === 't-shape') && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Arm Dimensions</label>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Arm Width (ft)</label>
              <input
                type="number"
                value={dimensions.armWidth ?? 0}
                onChange={(e) => onDimensionsChange({ ...dimensions, armWidth: Number(e.target.value) })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Arm Depth (ft)</label>
              <input
                type="number"
                value={dimensions.armDepth ?? 0}
                onChange={(e) => onDimensionsChange({ ...dimensions, armDepth: Number(e.target.value) })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
        </div>
      )}

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">Setbacks (ft)</label>
        <div className="grid grid-cols-3 gap-2">
          <div>
            <label className="block text-xs text-gray-500 mb-1">Front</label>
            <input
              type="number"
              value={setback.front}
              onChange={(e) => onSetbackChange({ ...setback, front: Number(e.target.value) })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Rear</label>
            <input
              type="number"
              value={setback.rear}
              onChange={(e) => onSetbackChange({ ...setback, rear: Number(e.target.value) })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Side</label>
            <input
              type="number"
              value={setback.side}
              onChange={(e) => onSetbackChange({ ...setback, side: Number(e.target.value) })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
