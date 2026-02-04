import { BuildingShape } from '../../utils/massing/types';

interface ShapeSelectorProps {
  value: BuildingShape;
  onChange: (shape: BuildingShape) => void;
}

const shapes: { value: BuildingShape; label: string; description: string }[] = [
  { value: 'rectangle', label: 'Rectangle', description: 'Simple rectangular floor plate' },
  { value: 'courtyard', label: 'Courtyard', description: 'Rectangle with central courtyard' },
  { value: 'donut', label: 'Donut', description: 'Ring-shaped with uniform thickness' },
  { value: 'h-shape', label: 'H-Shape', description: 'H-shaped building with central wing' },
  { value: 't-shape', label: 'T-Shape', description: 'T-shaped building with top bar' }
];

export function ShapeSelector({ value, onChange }: ShapeSelectorProps) {
  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium text-gray-700">Building Shape</label>
      <div className="grid grid-cols-1 gap-2">
        {shapes.map((shape) => (
          <button
            key={shape.value}
            onClick={() => onChange(shape.value)}
            className={`
              p-3 rounded-lg border-2 text-left transition-all
              ${value === shape.value
                ? 'border-blue-500 bg-blue-50 text-blue-900'
                : 'border-gray-300 hover:border-gray-400 text-gray-700'
              }
            `}
          >
            <div className="font-medium">{shape.label}</div>
            <div className="text-xs mt-1 opacity-75">{shape.description}</div>
          </button>
        ))}
      </div>
    </div>
  );
}
