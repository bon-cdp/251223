/**
 * Toggle between New Construction and Repurpose build modes
 */

import type { BuildMode } from '../types/building';

interface BuildModeToggleProps {
  value: BuildMode;
  onChange: (mode: BuildMode) => void;
  disabled?: boolean;
}

export function BuildModeToggle({ value, onChange, disabled }: BuildModeToggleProps) {
  return (
    <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
      <button
        className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${
          value === 'new'
            ? 'bg-white text-blue-600 shadow-sm'
            : 'text-gray-600 hover:text-gray-900'
        } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
        onClick={() => onChange('new')}
        disabled={disabled}
      >
        New (N)
      </button>
      <button
        className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${
          value === 'repurpose'
            ? 'bg-white text-green-600 shadow-sm'
            : 'text-gray-600 hover:text-gray-900'
        } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
        onClick={() => onChange('repurpose')}
        disabled={disabled}
      >
        Repurpose (R)
      </button>
    </div>
  );
}
