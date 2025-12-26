/**
 * Hook for floor navigation state
 */

import { useState, useCallback, useEffect } from 'react';
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
  const [currentFloorIndex, setCurrentFloorIndex] = useState<number>(0);

  // Sort floors by index (highest first for typical building view)
  const sortedFloors = floors
    ? [...floors].sort((a, b) => b.floor_index - a.floor_index)
    : [];

  const floorIndices = sortedFloors.map(f => f.floor_index);

  // Get current floor data
  const currentFloor = sortedFloors.find(
    f => f.floor_index === currentFloorIndex
  ) || null;

  // Initialize to first floor in sorted list
  useEffect(() => {
    if (sortedFloors.length > 0 && !floorIndices.includes(currentFloorIndex)) {
      setCurrentFloorIndex(sortedFloors[0].floor_index);
    }
  }, [floors]);

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

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') {
        prevFloor();
      } else if (e.key === 'ArrowDown' || e.key === 'ArrowRight') {
        nextFloor();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [nextFloor, prevFloor]);

  return {
    currentFloorIndex,
    currentFloor,
    floorIndices,
    goToFloor,
    nextFloor,
    prevFloor,
  };
};
