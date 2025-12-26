/**
 * Hook for space selection state
 */

import { useState, useCallback } from 'react';
import { SpaceData } from '../types/solverOutput';

interface UseSpaceSelectionResult {
  selectedSpace: SpaceData | null;
  selectSpace: (space: SpaceData | null) => void;
  isSelected: (spaceId: string) => boolean;
  clearSelection: () => void;
}

export const useSpaceSelection = (): UseSpaceSelectionResult => {
  const [selectedSpace, setSelectedSpace] = useState<SpaceData | null>(null);

  const selectSpace = useCallback((space: SpaceData | null) => {
    setSelectedSpace(space);
  }, []);

  const isSelected = useCallback((spaceId: string) => {
    return selectedSpace?.id === spaceId;
  }, [selectedSpace]);

  const clearSelection = useCallback(() => {
    setSelectedSpace(null);
  }, []);

  return {
    selectedSpace,
    selectSpace,
    isSelected,
    clearSelection,
  };
};
