/**
 * GLOQ Floorplan Viewer - Interactive Massing Tool
 * TestFit-style UI with vertex editing, real-time metrics, and map integration
 */

import { useState, useCallback, useMemo, useEffect } from 'react';
import { useSolverData } from './hooks/useSolverData';
import { useFloorNavigation } from './hooks/useFloorNavigation';
import { useSpaceSelection } from './hooks/useSpaceSelection';
import { usePolygonEditor } from './hooks/usePolygonEditor';
import { useFloorMetrics } from './hooks/useFloorMetrics';
import { EditableFloorPlanViewer } from './components/floorplan/EditableFloorPlanViewer';
import { FloorNavigation } from './components/floorplan/FloorNavigation';
import { SpaceDetailsPanel } from './components/panels/SpaceDetailsPanel';
import { MetricsDashboard } from './components/panels/MetricsDashboard';
import { LegendPanel } from './components/panels/LegendPanel';
import { MetricsBar } from './components/panels/MetricsBar';
import { SpaceSearch } from './components/panels/SpaceSearch';
import { VerificationCalculator } from './components/verification/VerificationCalculator';
import { CanvasToolbar } from './components/toolbar/CanvasToolbar';
import { EnvironmentalMap } from './components/map/EnvironmentalMap';
import { SpaceData } from './types/solverOutput';
import './App.css';

type ViewMode = 'floorplan' | 'map';

function App() {
  const {
    solverResult,
    buildingInput,
    loading,
    error,
    loadProject,
    currentProjectId,
    availableProjects
  } = useSolverData();

  // View mode toggle
  const [viewMode, setViewMode] = useState<ViewMode>('floorplan');
  
  // Panel collapse states for focus mode
  const [leftPanelCollapsed, setLeftPanelCollapsed] = useState(false);
  const [rightPanelCollapsed, setRightPanelCollapsed] = useState(false);

  // Handle project change
  const handleProjectChange = useCallback((projectId: string) => {
    loadProject(projectId);
  }, [loadProject]);

  // Floor navigation
  const {
    currentFloorIndex,
    currentFloor,
    floorIndices,
    goToFloor,
    nextFloor,
    prevFloor,
  } = useFloorNavigation(solverResult?.building.floors);

  // Initialize polygon editor with current floor's spaces
  const allSpaces = useMemo(() => {
    if (!solverResult?.building.floors) return [];
    return solverResult.building.floors.flatMap(f => f.spaces);
  }, [solverResult]);

  const {
    editableSpaces,
    selectedSpaceId,
    editMode,
    selectSpace: selectSpaceEditor,
    setEditMode,
    moveVertexTo,
    addVertex,
    removeVertexAt,
    moveSpace,
    startDrag,
    endDrag,
    undo,
    redo,
    canUndo,
    canRedo,
    resetToOriginal,
  } = usePolygonEditor(allSpaces);

  // Space selection (from viewer click)
  const {
    selectedSpace,
    selectSpace: selectSpacePanel,
    clearSelection,
  } = useSpaceSelection();

  // Sync selection between editor and panel
  const handleSpaceClick = useCallback((space: SpaceData) => {
    selectSpaceEditor(space.id);
    selectSpacePanel(space);
  }, [selectSpaceEditor, selectSpacePanel]);

  // Clear selection
  const handleClearSelection = useCallback(() => {
    selectSpaceEditor(null);
    clearSelection();
  }, [selectSpaceEditor, clearSelection]);

  // Global keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if typing in an input
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      switch (e.key) {
        case 'Escape':
          // Deselect current space
          handleClearSelection();
          break;
        case 'ArrowUp':
          // Previous floor
          e.preventDefault();
          prevFloor();
          break;
        case 'ArrowDown':
          // Next floor
          e.preventDefault();
          nextFloor();
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleClearSelection, prevFloor, nextFloor]);

  // Floor metrics
  const floorMetrics = useFloorMetrics(
    currentFloor || { floor_index: 0, floor_type: '', boundary: [], area_sf: 0, spaces: [] },
    editableSpaces
  );

  // Loading state with skeleton UI
  if (loading) {
    return (
      <div className="app dark-theme">
        {/* Skeleton Header */}
        <header className="header">
          <div className="header-left">
            <h1 className="logo">GLOQ</h1>
            <div className="skeleton" style={{ width: 180, height: 32, borderRadius: 6 }} />
          </div>
          <div className="header-center">
            <div className="skeleton" style={{ width: 160, height: 28, borderRadius: 6 }} />
          </div>
          <div className="header-right" />
        </header>

        {/* Skeleton Main Layout */}
        <div className="main-container">
          {/* Left Panel Skeleton */}
          <aside className="nav-panel">
            <div className="skeleton-panel">
              <div className="skeleton skeleton-title" />
              <div className="skeleton skeleton-line" style={{ width: '80%' }} />
              <div className="skeleton skeleton-line" style={{ width: '60%' }} />
            </div>
          </aside>

          {/* Center Canvas Skeleton */}
          <main className="canvas-area">
            <div style={{ padding: '8px 12px', background: '#2d2d3f', borderBottom: '1px solid #333' }}>
              <div className="skeleton" style={{ width: 300, height: 40 }} />
            </div>
            <div className="floor-plan-container">
              <div className="skeleton skeleton-canvas" style={{ width: '80%', maxWidth: 600 }} />
            </div>
          </main>

          {/* Right Panel Skeleton */}
          <aside className="properties-panel">
            <div className="skeleton-panel">
              <div className="skeleton skeleton-title" />
              <div className="skeleton skeleton-line" style={{ width: '90%' }} />
              <div className="skeleton skeleton-line" style={{ width: '75%' }} />
              <div className="skeleton skeleton-line" style={{ width: '85%' }} />
            </div>
            <div className="skeleton-panel">
              <div className="skeleton skeleton-title" />
              <div className="skeleton skeleton-line" style={{ width: '70%' }} />
              <div className="skeleton skeleton-line" style={{ width: '80%' }} />
            </div>
          </aside>
        </div>
      </div>
    );
  }

  // Error state
  if (error || !solverResult) {
    return (
      <div className="app dark-theme">
        <div className="error">
          <h2>Error loading data</h2>
          <p>{error || 'Unknown error'}</p>
        </div>
      </div>
    );
  }

  const projectName = buildingInput?.project_name || 'Building Massing';

  return (
    <div className="app dark-theme">
      {/* Header */}
      <header className="header">
        <div className="header-left">
          <h1 className="logo">GLOQ</h1>
          {/* Project Selector */}
          <select
            className="project-selector"
            value={currentProjectId}
            onChange={(e) => handleProjectChange(e.target.value)}
          >
            {availableProjects.map(p => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </div>
        <div className="header-center">
          {/* View Toggle */}
          <div className="view-toggle">
            <button
              className={`view-btn ${viewMode === 'floorplan' ? 'active' : ''}`}
              onClick={() => setViewMode('floorplan')}
            >
              Floor Plan
            </button>
            <button
              className={`view-btn ${viewMode === 'map' ? 'active' : ''}`}
              onClick={() => setViewMode('map')}
            >
              Map View
            </button>
          </div>
        </div>
        <div className="header-right">
        </div>
      </header>

      {/* Main Content - 4 Panel Layout */}
      <div className={`main-container ${leftPanelCollapsed ? 'left-collapsed' : ''} ${rightPanelCollapsed ? 'right-collapsed' : ''}`}>
        {/* Left Panel - Navigation Tree */}
        <aside className={`nav-panel ${leftPanelCollapsed ? 'collapsed' : ''}`}>
          <div className="panel-header">Floors</div>
          <FloorNavigation
            floorIndices={floorIndices}
            currentFloorIndex={currentFloorIndex}
            currentFloorType={currentFloor?.floor_type}
            onFloorChange={goToFloor}
            onPrev={prevFloor}
            onNext={nextFloor}
          />
          
          {/* Space Search */}
          <SpaceSearch
            spaces={allSpaces}
            onSpaceSelect={handleSpaceClick}
            selectedSpaceId={selectedSpaceId}
          />
          
          {/* Collapse toggle */}
          <button
            className="panel-toggle panel-toggle-left"
            onClick={() => setLeftPanelCollapsed(!leftPanelCollapsed)}
            title={leftPanelCollapsed ? 'Show floor navigation' : 'Hide floor navigation'}
          >
            {leftPanelCollapsed ? '›' : '‹'}
          </button>
        </aside>

        {/* Center - Canvas Area */}
        <main className="canvas-area">
          {/* Toolbar */}
          <CanvasToolbar
            activeMode={editMode}
            onModeChange={setEditMode}
            canUndo={canUndo}
            canRedo={canRedo}
            onUndo={undo}
            onRedo={redo}
            onReset={() => resetToOriginal()}
          />

          {/* Floor Plan Viewer */}
          <div className="floor-plan-container">
            {viewMode === 'floorplan' && currentFloor ? (
              <EditableFloorPlanViewer
                floor={currentFloor}
                editableSpaces={editableSpaces}
                selectedSpaceId={selectedSpaceId}
                editMode={editMode}
                onSpaceClick={handleSpaceClick}
                onVertexMove={(spaceId, idx, x, y) => moveVertexTo(spaceId, idx, [x, y])}
                onVertexRemove={(spaceId, idx) => removeVertexAt(spaceId, idx)}
                onVertexAdd={(spaceId, idx) => addVertex(spaceId, idx)}
                onSpaceMove={(spaceId, dx, dy) => moveSpace(spaceId, dx, dy)}
                onDragStart={startDrag}
                onDragEnd={endDrag}
                scale={3}
                showLabels={true}
              />
            ) : viewMode === 'map' ? (
              <EnvironmentalMap propertyAddress={buildingInput?.address} />
            ) : (
              <div className="no-floor">No floor selected</div>
            )}
          </div>
        </main>

        {/* Right Panel - Properties (hidden for massing visualization contract) */}
        {/*
        <aside className={`properties-panel ${rightPanelCollapsed ? 'collapsed' : ''}`}>
          <div className="panel-header">Properties</div>

          <SpaceDetailsPanel
            space={selectedSpace}
            onClose={handleClearSelection}
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

          <LegendPanel />

          <button
            className="panel-toggle panel-toggle-right"
            onClick={() => setRightPanelCollapsed(!rightPanelCollapsed)}
            title={rightPanelCollapsed ? 'Show properties' : 'Hide properties'}
          >
            {rightPanelCollapsed ? '‹' : '›'}
          </button>
        </aside>
        */}
      </div>

      {/* Bottom Metrics Bar (hidden for massing visualization contract) */}
      {/*
      <MetricsBar
        efficiency={floorMetrics.efficiencyRatio}
        totalSpaces={floorMetrics.totalSpaces}
        dwellingUnits={floorMetrics.dwellingUnits}
        retailSpaces={floorMetrics.retailSpaces}
        usableArea={floorMetrics.usableArea}
        violations={floorMetrics.violations}
        areaDelta={floorMetrics.areaDelta}
        areaDeltaPercent={floorMetrics.areaDeltaPercent}
      />
      */}
    </div>
  );
}

export default App;
