/**
 * Selector for construction types: V, III, V/I, III/I, I
 */

import type { ConstructionType } from '../types/building';
import { CONSTRUCTION_MAX_STORIES } from '../types/building';

interface ConstructionTypeSelectorProps {
  value: ConstructionType;
  onChange: (type: ConstructionType) => void;
  stories?: number;
  disabled?: boolean;
}

const CONSTRUCTION_TYPES: { type: ConstructionType; label: string; description: string }[] = [
  { type: 'V', label: 'Type V', description: 'Wood frame, max 5 stories' },
  { type: 'III', label: 'Type III', description: 'Wood + masonry, max 6 stories' },
  { type: 'V/I', label: 'Type V/I', description: 'Wood over concrete, max 7 stories' },
  { type: 'III/I', label: 'Type III/I', description: 'Masonry over concrete, max 8 stories' },
  { type: 'I', label: 'Type I', description: 'Concrete/steel, unlimited' },
];

export function ConstructionTypeSelector({
  value,
  onChange,
  stories = 0,
  disabled,
}: ConstructionTypeSelectorProps) {
  return (
    <div className="flex flex-wrap gap-2">
      {CONSTRUCTION_TYPES.map(({ type, label, description }) => {
        const maxStories = CONSTRUCTION_MAX_STORIES[type];
        const isOverLimit = stories > maxStories;

        return (
          <button
            key={type}
            className={`px-3 py-2 rounded-lg text-sm font-medium transition-all border ${
              value === type
                ? 'bg-indigo-600 text-white border-indigo-600'
                : isOverLimit
                ? 'bg-red-50 text-red-400 border-red-200 cursor-not-allowed'
                : 'bg-white text-gray-700 border-gray-200 hover:border-indigo-300'
            } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
            onClick={() => !isOverLimit && onChange(type)}
            disabled={disabled || isOverLimit}
            title={description + (isOverLimit ? ` (${stories} stories exceeds max ${maxStories})` : '')}
          >
            {label}
            {isOverLimit && (
              <span className="ml-1 text-xs">({maxStories} max)</span>
            )}
          </button>
        );
      })}
    </div>
  );
}
