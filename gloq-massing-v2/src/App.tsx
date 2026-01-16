/**
 * GLOQ Massing Generator v3
 * Upload Excel file → Select build mode + construction type → Generate floor plan massing
 */

import { useMemo, useCallback, useState } from 'react';
import { useExcelData } from './hooks/useExcelData';
import { generateMassingV3 } from './utils/generateMassingV3';
import { ExcelUploader } from './components/ExcelUploader';
import { MassingViewer } from './components/MassingViewer';
import { MetricsSidebar } from './components/MetricsSidebar';
import { BuildModeToggle } from './components/BuildModeToggle';
import { ConstructionTypeSelector } from './components/ConstructionTypeSelector';
import type { BuildMode, ConstructionType } from './types/building';
import './App.css';

function App() {
  const { excelData, config, loading, error, parseFile, setConfig, reset } = useExcelData();

  // Local state for build mode and construction type (synced with config)
  const [buildMode, setBuildMode] = useState<BuildMode>('new');
  const [constructionType, setConstructionType] = useState<ConstructionType>('V');

  // Generate massing when config is available
  const massingResult = useMemo(() => {
    if (!config) return null;
    return generateMassingV3(config);
  }, [config]);

  const handleFileSelect = useCallback((file: File) => {
    parseFile(file);
    // Reset to defaults
    setBuildMode('new');
    setConstructionType('V');
  }, [parseFile]);

  const handleBuildModeChange = useCallback((mode: BuildMode) => {
    setBuildMode(mode);
    setConfig(mode, constructionType);
  }, [constructionType, setConfig]);

  const handleConstructionTypeChange = useCallback((type: ConstructionType) => {
    setConstructionType(type);
    setConfig(buildMode, type);
  }, [buildMode, setConfig]);

  const handleReset = useCallback(() => {
    reset();
    setBuildMode('new');
    setConstructionType('V');
  }, [reset]);

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-600">Parsing Excel file...</p>
        </div>
      </div>
    );
  }

  // No file uploaded yet - show uploader
  if (!config || !massingResult) {
    return (
      <div className="min-h-screen bg-gray-50">
        <header className="bg-white border-b border-gray-200 px-6 py-4">
          <div className="max-w-7xl mx-auto flex items-center gap-4">
            <h1 className="text-2xl font-bold text-indigo-600">GLOQ</h1>
            <span className="text-gray-500">Massing Generator</span>
          </div>
        </header>
        <main className="max-w-2xl mx-auto px-6 py-16">
          <div className="text-center mb-8">
            <h2 className="text-xl font-semibold text-gray-900 mb-2">
              Upload GLOQ Excel File
            </h2>
            <p className="text-gray-500">
              Upload your GLOQ Engine Excel file to generate floor plan massing
            </p>
          </div>
          <ExcelUploader onFileSelect={handleFileSelect} loading={loading} />
          {error && (
            <div className="mt-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
              {error}
            </div>
          )}
        </main>
      </div>
    );
  }

  // File loaded - show floor plans
  return (
    <div className="min-h-screen bg-gray-100 flex flex-col">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-6 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-3">
              <h1 className="text-xl font-bold text-indigo-600">GLOQ</h1>
              <span className="text-gray-400">|</span>
              <span className="text-gray-600 font-medium">{config.address}</span>
            </div>
          </div>
          <button
            className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
            onClick={handleReset}
          >
            Upload New File
          </button>
        </div>
      </header>

      {/* Config Bar */}
      <div className="bg-white border-b border-gray-200 px-6 py-3">
        <div className="flex flex-wrap items-center gap-6">
          <div className="flex items-center gap-3">
            <span className="text-sm font-medium text-gray-700">Build Mode:</span>
            <BuildModeToggle
              value={buildMode}
              onChange={handleBuildModeChange}
              disabled={!excelData}
            />
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm font-medium text-gray-700">Construction:</span>
            <ConstructionTypeSelector
              value={constructionType}
              onChange={handleConstructionTypeChange}
              stories={config.storiesAbove}
              disabled={!excelData}
            />
          </div>
        </div>
      </div>

      {/* Main Content */}
      <main className="flex-1 flex min-h-0 p-4 gap-4">
        {/* Floor Plan Viewer */}
        <div className="flex-1 bg-white rounded-xl shadow-sm p-4 min-w-0">
          <MassingViewer
            floors={massingResult.floors}
            warnings={massingResult.warnings}
          />
        </div>

        {/* Metrics Sidebar */}
        <aside className="w-80 flex-shrink-0 overflow-y-auto">
          <MetricsSidebar
            config={config}
            metrics={massingResult.metrics}
          />
        </aside>
      </main>
    </div>
  );
}

export default App;
