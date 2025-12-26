/**
 * Hook for loading and managing solver JSON data
 */

import { useState, useEffect } from 'react';
import { SolverResult, BuildingInput } from '../types/solverOutput';

interface UseSolverDataResult {
  solverResult: SolverResult | null;
  buildingInput: BuildingInput | null;
  loading: boolean;
  error: string | null;
  loadFile: (filename: string) => void;
  availableFiles: string[];
}

const AVAILABLE_FILES = ['p1_output.json'];

export const useSolverData = (): UseSolverDataResult => {
  const [solverResult, setSolverResult] = useState<SolverResult | null>(null);
  const [buildingInput, setBuildingInput] = useState<BuildingInput | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentFile, setCurrentFile] = useState('p1_output.json');

  const loadFile = async (filename: string) => {
    setLoading(true);
    setError(null);

    try {
      // Load solver output
      const outputResponse = await fetch(`/data/${filename}`);
      if (!outputResponse.ok) {
        throw new Error(`Failed to load ${filename}`);
      }
      const outputData: SolverResult = await outputResponse.json();
      setSolverResult(outputData);

      // Try to load corresponding building input
      const inputFilename = filename.replace('_output', '_building');
      try {
        const inputResponse = await fetch(`/data/${inputFilename}`);
        if (inputResponse.ok) {
          const inputData: BuildingInput = await inputResponse.json();
          setBuildingInput(inputData);
        }
      } catch {
        // Building input is optional
        console.log('Building input not found, continuing without it');
      }

      setCurrentFile(filename);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error loading data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadFile(currentFile);
  }, []);

  return {
    solverResult,
    buildingInput,
    loading,
    error,
    loadFile,
    availableFiles: AVAILABLE_FILES,
  };
};
