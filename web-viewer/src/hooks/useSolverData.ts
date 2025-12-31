/**
 * Hook for loading solver output JSON files
 * All projects now have pre-computed output files
 */

import { useState, useEffect, useCallback } from 'react';
import { SolverResult, BuildingInput } from '../types/solverOutput';

interface ProjectInfo {
  id: string;
  name: string;
  outputFile: string;
  buildingFile?: string;
}

interface UseSolverDataResult {
  solverResult: SolverResult | null;
  buildingInput: BuildingInput | null;
  loading: boolean;
  error: string | null;
  loadProject: (projectId: string) => void;
  currentProjectId: string;
  availableProjects: ProjectInfo[];
}

// All projects with pre-computed outputs
const AVAILABLE_PROJECTS: ProjectInfo[] = [
  { id: 'p1', name: 'P1 - Mid-Rise (116 units)', outputFile: 'p1_output.json', buildingFile: 'p1_building.json' },
  { id: 'p4', name: 'P4 - High-Rise (348 units)', outputFile: 'p4_output.json', buildingFile: 'p4_building.json' },
  { id: 'p7', name: 'P7 - High-Rise (429 units)', outputFile: 'p7_output.json', buildingFile: 'p7_building.json' },
  { id: 'p9', name: 'P9 - Tower (427 units)', outputFile: 'p9_output.json', buildingFile: 'p9_building.json' },
];

export const useSolverData = (): UseSolverDataResult => {
  const [solverResult, setSolverResult] = useState<SolverResult | null>(null);
  const [buildingInput, setBuildingInput] = useState<BuildingInput | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentProjectId, setCurrentProjectId] = useState('p1');

  const loadProject = useCallback(async (projectId: string) => {
    const project = AVAILABLE_PROJECTS.find(p => p.id === projectId);
    if (!project) {
      setError(`Unknown project: ${projectId}`);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Load pre-computed output
      const outputResponse = await fetch(`/data/${project.outputFile}`);
      if (!outputResponse.ok) {
        throw new Error(`Failed to load ${project.outputFile}`);
      }
      const outputData: SolverResult = await outputResponse.json();
      setSolverResult(outputData);

      // Optionally load building input for metrics
      if (project.buildingFile) {
        try {
          const buildingResponse = await fetch(`/data/${project.buildingFile}`);
          if (buildingResponse.ok) {
            const buildingData: BuildingInput = await buildingResponse.json();
            setBuildingInput(buildingData);
          }
        } catch {
          // Building file is optional
        }
      }

      setCurrentProjectId(projectId);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error loading data');
    } finally {
      setLoading(false);
    }
  }, []);

  // Load default project on mount
  useEffect(() => {
    loadProject(currentProjectId);
  }, []);

  return {
    solverResult,
    buildingInput,
    loading,
    error,
    loadProject,
    currentProjectId,
    availableProjects: AVAILABLE_PROJECTS,
  };
};
