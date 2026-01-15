/**
 * Hook for floor navigation state
 */

import { useState, useCallback, useEffect, useMemo } from 'react';
import { FloorData } from '../types/solverOutput';

interface UseFloorNavigationResult {
  currentFloorIndex: number;
  currentFloor: FloorData | null;
  floorIndices: number[];
  goToFloor: (index: number) => void;
  nextFloor: () => void;
  prevFloor: () => void;
}

export const useFloorNavigation = (
  floors: FloorData[] | undefined
): UseFloorNavigationResult => {
  // Sort floors by index (highest first for typical building view)
  const sortedFloors = useMemo(() => 
    floors ? [...floors].sort((a, b) => b.floor_index - a.floor_index) : [],
    [floors]
  );

  const floorIndices = useMemo(() => 
    sortedFloors.map(f => f.floor_index),
    [sortedFloors]
  );

  // Initialize with lazy function that returns first floor index
  const [currentFloorIndex, setCurrentFloorIndex] = useState<number>(() => 
    sortedFloors.length > 0 ? sortedFloors[0].floor_index : 0
  );

  // Get current floor data
  const currentFloor = useMemo(() => 
    sortedFloors.find(f => f.floor_index === currentFloorIndex) || null,
    [sortedFloors, currentFloorIndex]
  );

  // Reset floor index when floors data changes and current index is invalid
  // This is an intentional sync of external prop to internal state
  useEffect(() => {
    if (sortedFloors.length > 0 && !floorIndices.includes(currentFloorIndex)) {
      // Intentional state sync when data source changes
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setCurrentFloorIndex(sortedFloors[0].floor_index);
    }
  }, [sortedFloors, floorIndices, currentFloorIndex]);

  const goToFloor = useCallback((index: number) => {
    if (floorIndices.includes(index)) {
      setCurrentFloorIndex(index);
    }
  }, [floorIndices]);

  const nextFloor = useCallback(() => {
    const currentPos = floorIndices.indexOf(currentFloorIndex);
    if (currentPos < floorIndices.length - 1) {
      setCurrentFloorIndex(floorIndices[currentPos + 1]);
    }
  }, [currentFloorIndex, floorIndices]);

  const prevFloor = useCallback(() => {
    const currentPos = floorIndices.indexOf(currentFloorIndex);
    if (currentPos > 0) {
      setCurrentFloorIndex(floorIndices[currentPos - 1]);
    }
  }, [currentFloorIndex, floorIndices]);

  // Keyboard navigation removed - handled in App.tsx

  return {
    currentFloorIndex,
    currentFloor,
    floorIndices,
    goToFloor,
    nextFloor,
    prevFloor,
  };
};
