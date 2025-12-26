/**
 * GLOQ Floorplan Viewer - Main Application
 * Connects Henry's PDF extraction + Dev's visualization + Shakil's solver
 */

import { useState, useCallback } from 'react';
import { useSolverData } from './hooks/useSolverData';
import { useFloorNavigation } from './hooks/useFloorNavigation';
import { useSpaceSelection } from './hooks/useSpaceSelection';
import { FloorPlanViewer } from './components/floorplan/FloorPlanViewer';
import { FloorNavigation } from './components/floorplan/FloorNavigation';
import { SpaceDetailsPanel } from './components/panels/SpaceDetailsPanel';
import { MetricsDashboard } from './components/panels/MetricsDashboard';
import { LegendPanel } from './components/panels/LegendPanel';
import { VerificationCalculator } from './components/verification/VerificationCalculator';
import { PdfUploader } from './components/data/PdfUploader';
import { generateSolverResultFromExtracted } from './utils/generateFromExtracted';
import { SolverResult } from './types/solverOutput';
import './App.css';

function App() {
  const { solverResult: defaultResult, buildingInput, loading, error } = useSolverData();

  // State for PDF-generated results
  const [pdfResult, setPdfResult] = useState<SolverResult | null>(null);
  const [pdfProjectName, setPdfProjectName] = useState<string | null>(null);

  // Use PDF result if available, otherwise default
  const solverResult = pdfResult || defaultResult;

  const {
    currentFloorIndex,
    currentFloor,
    floorIndices,
    goToFloor,
    nextFloor,
    prevFloor,
  } = useFloorNavigation(solverResult?.building.floors);

  const {
    selectedSpace,
    selectSpace,
    clearSelection,
  } = useSpaceSelection();

  // Handle PDF extraction - generate floor plans from extracted data
  const handlePdfExtracted = useCallback((extractedData: any) => {
    console.log('PDF extracted:', extractedData);

    // Generate solver result from extracted data
    const generatedResult = generateSolverResultFromExtracted(extractedData);
    setPdfResult(generatedResult);

    // Set project name from extracted APN or properties
    const apn = extractedData.properties?.apn || extractedData.properties?.apn_references?.[0];
    const zoning = extractedData.constraints?.zoning || '';
    setPdfProjectName(`Extracted: ${apn || 'Unknown APN'} (${zoning})`);
  }, []);

  // Reset to default data
  const handleReset = useCallback(() => {
    setPdfResult(null);
    setPdfProjectName(null);
  }, []);

  if (loading) {
    return (
      <div className="loading">
        <div className="loading-spinner" />
        <p>Loading floor plan data...</p>
      </div>
    );
  }

  if (error || !solverResult) {
    return (
      <div className="error">
        <h2>Error loading data</h2>
        <p>{error || 'Unknown error'}</p>
      </div>
    );
  }

  const projectName = pdfProjectName || buildingInput?.project_name || 'Building Massing';

  return (
    <div className="app">
      <header className="header">
        <h1>GLOQ Floorplan Viewer</h1>
        <div className="header-right">
          <span className="project-name">{projectName}</span>
          {pdfResult && (
            <button onClick={handleReset} className="reset-button">
              Reset to Sample
            </button>
          )}
        </div>
      </header>

      <main className="main">
        <div className="floor-plan-container">
          {currentFloor ? (
            <FloorPlanViewer
              floor={currentFloor}
              selectedSpaceId={selectedSpace?.id || null}
              onSpaceClick={selectSpace}
              scale={3}
              showLabels={true}
            />
          ) : (
            <div className="no-floor">No floor selected</div>
          )}
        </div>

        <aside className="sidebar">
          <FloorNavigation
            floorIndices={floorIndices}
            currentFloorIndex={currentFloorIndex}
            currentFloorType={currentFloor?.floor_type}
            onFloorChange={goToFloor}
            onPrev={prevFloor}
            onNext={nextFloor}
          />

          <SpaceDetailsPanel
            space={selectedSpace}
            onClose={clearSelection}
          />

          <MetricsDashboard
            solverMetrics={solverResult.metrics}
            buildingMetrics={solverResult.building.metrics}
            success={solverResult.success}
            obstruction={solverResult.obstruction}
            violations={solverResult.violations}
          />

          <VerificationCalculator
            solverResult={solverResult}
            buildingInput={buildingInput}
          />

          <PdfUploader onDataExtracted={handlePdfExtracted} />

          <LegendPanel />
        </aside>
      </main>

      <footer className="footer">
        <p>
          GLOQ Massing Solver |
          Placement: {solverResult.metrics.placement_rate} |
          Floors: {solverResult.building.metrics.total_floors} |
          Spaces: {solverResult.metrics.placed_spaces}/{solverResult.metrics.total_spaces}
        </p>
        <p className="future-features">
          Powered by Qwen AI | Henry's Pipeline | Dev's Viz | TODO: Drag-and-drop
        </p>
      </footer>
    </div>
  );
}

export default App;
