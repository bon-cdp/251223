import { useState } from 'react';
import { ShapeSelector } from './ShapeSelector';
import { ShapeConfig } from './ShapeConfig';
import { BuildingShape, ShapeDimensions, SetbackConfig } from '../../utils/massing/types';

interface MassingPanelProps {
  onRegenerate: (config: {
    shape: BuildingShape;
    dimensions: ShapeDimensions;
    setback: SetbackConfig;
  }) => void;
  isRegenerating?: boolean;
}

export function MassingPanel({ onRegenerate, isRegenerating = false }: MassingPanelProps) {
  const [shape, setShape] = useState<BuildingShape>('rectangle');
  const [dimensions, setDimensions] = useState<ShapeDimensions>({
    width: 100,
    height: 120,
    courtyardWidth: 40,
    courtyardDepth: 50,
    armWidth: 20,
    armDepth: 40
  });
  const [setback, setSetback] = useState<SetbackConfig>({
    front: 10,
    rear: 10,
    side: 10
  });

  const handleRegenerate = () => {
    onRegenerate({ shape, dimensions, setback });
  };

  return (
    <div className="massing-panel p-4 space-y-4 border-t border-gray-700">
      <h3 className="text-sm font-semibold text-gray-300 mb-2">Massing Configuration</h3>
      
      <ShapeSelector value={shape} onChange={setShape} />
      
      <ShapeConfig
        shape={shape}
        dimensions={dimensions}
        setback={setback}
        onDimensionsChange={setDimensions}
        onSetbackChange={setSetback}
      />
      
      <button
        onClick={handleRegenerate}
        disabled={isRegenerating}
        className={`
          w-full py-2 px-4 rounded-lg font-medium transition-colors
          ${isRegenerating
            ? 'bg-gray-600 text-gray-400 cursor-not-allowed'
            : 'bg-blue-600 hover:bg-blue-700 text-white'
          }
        `}
      >
        {isRegenerating ? 'Generating...' : 'Regenerate'}
      </button>
    </div>
  );
}
