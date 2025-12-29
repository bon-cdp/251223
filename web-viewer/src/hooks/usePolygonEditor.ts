/**
 * Hook for polygon vertex editing state management
 * Supports moving, adding, and removing vertices with undo/redo
 */

import { useState, useCallback, useMemo, useEffect } from 'react';
import { SpaceData, Geometry, PolygonGeometry, isPolygonGeometry, rectToPolygon, RectGeometry } from '../types/solverOutput';
import {
  moveVertex,
  addVertexToEdge,
  removeVertex,
  translatePolygon,
  isValidPolygon,
  calculatePolygonArea,
  Point,
  Polygon,
} from '../utils/polygon';

export type EditMode = 'select' | 'move' | 'vertex' | 'add-space' | 'measure';

interface EditableSpace extends SpaceData {
  // Override geometry to always be polygon for editing
  editableVertices: [number, number][];
  originalGeometry: Geometry;
  hasChanges: boolean;
}

interface HistoryEntry {
  spaces: EditableSpace[];
  timestamp: number;
}

interface UsePolygonEditorResult {
  // Current state
  editableSpaces: EditableSpace[];
  selectedSpaceId: string | null;
  editMode: EditMode;
  isDragging: boolean;

  // Actions
  selectSpace: (spaceId: string | null) => void;
  setEditMode: (mode: EditMode) => void;

  // Vertex editing
  moveVertexTo: (spaceId: string, vertexIndex: number, newPos: [number, number]) => void;
  addVertex: (spaceId: string, edgeIndex: number) => void;
  removeVertexAt: (spaceId: string, vertexIndex: number) => void;

  // Space movement
  moveSpace: (spaceId: string, dx: number, dy: number) => void;

  // Drag state
  startDrag: () => void;
  endDrag: () => void;

  // History
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;

  // Get space for rendering
  getSpace: (spaceId: string) => EditableSpace | undefined;

  // Metrics
  getSpaceArea: (spaceId: string) => number;
  hasCollisions: (spaceId: string) => boolean;

  // Reset
  resetToOriginal: (spaceId?: string) => void;

  // Convert back to SpaceData
  toSpaceData: (space: EditableSpace) => SpaceData;
}

/**
 * Convert any Geometry to editable vertices
 */
function geometryToVertices(geometry: Geometry): [number, number][] {
  if (isPolygonGeometry(geometry)) {
    return geometry.vertices.map(v => [...v] as [number, number]);
  }
  // Convert rect to polygon
  return rectToPolygon(geometry as RectGeometry);
}

/**
 * Convert SpaceData to EditableSpace
 */
function toEditableSpace(space: SpaceData): EditableSpace {
  return {
    ...space,
    editableVertices: geometryToVertices(space.geometry),
    originalGeometry: space.geometry,
    hasChanges: false,
  };
}

export function usePolygonEditor(initialSpaces: SpaceData[]): UsePolygonEditorResult {
  // Editable spaces state
  const [editableSpaces, setEditableSpaces] = useState<EditableSpace[]>(() =>
    initialSpaces.map(toEditableSpace)
  );

  // Selection state
  const [selectedSpaceId, setSelectedSpaceId] = useState<string | null>(null);

  // Edit mode
  const [editMode, setEditMode] = useState<EditMode>('select');

  // Drag state
  const [isDragging, setIsDragging] = useState(false);

  // History for undo/redo
  const [history, setHistory] = useState<HistoryEntry[]>([
    { spaces: initialSpaces.map(toEditableSpace), timestamp: Date.now() }
  ]);
  const [historyIndex, setHistoryIndex] = useState(0);

  // Sync editable spaces when initialSpaces changes (e.g., after data loads)
  useEffect(() => {
    if (initialSpaces.length > 0 && editableSpaces.length === 0) {
      const newEditableSpaces = initialSpaces.map(toEditableSpace);
      setEditableSpaces(newEditableSpaces);
      setHistory([{ spaces: newEditableSpaces, timestamp: Date.now() }]);
      setHistoryIndex(0);
    }
  }, [initialSpaces]);

  // Push state to history
  const pushHistory = useCallback((spaces: EditableSpace[]) => {
    setHistory(prev => {
      // Remove any forward history when adding new entry
      const newHistory = prev.slice(0, historyIndex + 1);
      newHistory.push({ spaces: JSON.parse(JSON.stringify(spaces)), timestamp: Date.now() });
      // Keep max 50 history entries
      if (newHistory.length > 50) newHistory.shift();
      return newHistory;
    });
    setHistoryIndex(prev => Math.min(prev + 1, 49));
  }, [historyIndex]);

  // Select a space
  const selectSpace = useCallback((spaceId: string | null) => {
    setSelectedSpaceId(spaceId);
  }, []);

  // Move a vertex to new position
  const moveVertexTo = useCallback((spaceId: string, vertexIndex: number, newPos: [number, number]) => {
    setEditableSpaces(prev => {
      const newSpaces = prev.map(space => {
        if (space.id !== spaceId) return space;

        const newVertices = moveVertex(space.editableVertices, vertexIndex, newPos);

        // Validate the new polygon
        if (!isValidPolygon(newVertices)) {
          return space; // Reject invalid change
        }

        return {
          ...space,
          editableVertices: newVertices,
          hasChanges: true,
        };
      });
      return newSpaces;
    });
  }, []);

  // Add vertex to an edge
  const addVertex = useCallback((spaceId: string, edgeIndex: number) => {
    setEditableSpaces(prev => {
      const newSpaces = prev.map(space => {
        if (space.id !== spaceId) return space;

        const newVertices = addVertexToEdge(space.editableVertices, edgeIndex);

        return {
          ...space,
          editableVertices: newVertices,
          hasChanges: true,
        };
      });
      pushHistory(newSpaces);
      return newSpaces;
    });
  }, [pushHistory]);

  // Remove a vertex
  const removeVertexAt = useCallback((spaceId: string, vertexIndex: number) => {
    setEditableSpaces(prev => {
      const newSpaces = prev.map(space => {
        if (space.id !== spaceId) return space;

        const newVertices = removeVertex(space.editableVertices, vertexIndex);
        if (!newVertices) return space; // Can't remove from triangle

        return {
          ...space,
          editableVertices: newVertices,
          hasChanges: true,
        };
      });
      pushHistory(newSpaces);
      return newSpaces;
    });
  }, [pushHistory]);

  // Move entire space
  const moveSpace = useCallback((spaceId: string, dx: number, dy: number) => {
    setEditableSpaces(prev => {
      const newSpaces = prev.map(space => {
        if (space.id !== spaceId) return space;

        const newVertices = translatePolygon(space.editableVertices, dx, dy);

        return {
          ...space,
          editableVertices: newVertices,
          hasChanges: true,
        };
      });
      return newSpaces;
    });
  }, []);

  // Drag state management
  const startDrag = useCallback(() => setIsDragging(true), []);

  const endDrag = useCallback(() => {
    setIsDragging(false);
    // Save to history when drag ends
    pushHistory(editableSpaces);
  }, [editableSpaces, pushHistory]);

  // Undo
  const undo = useCallback(() => {
    if (historyIndex > 0) {
      const newIndex = historyIndex - 1;
      setHistoryIndex(newIndex);
      setEditableSpaces(JSON.parse(JSON.stringify(history[newIndex].spaces)));
    }
  }, [history, historyIndex]);

  // Redo
  const redo = useCallback(() => {
    if (historyIndex < history.length - 1) {
      const newIndex = historyIndex + 1;
      setHistoryIndex(newIndex);
      setEditableSpaces(JSON.parse(JSON.stringify(history[newIndex].spaces)));
    }
  }, [history, historyIndex]);

  const canUndo = historyIndex > 0;
  const canRedo = historyIndex < history.length - 1;

  // Get a specific space
  const getSpace = useCallback((spaceId: string) => {
    return editableSpaces.find(s => s.id === spaceId);
  }, [editableSpaces]);

  // Get space area
  const getSpaceArea = useCallback((spaceId: string) => {
    const space = editableSpaces.find(s => s.id === spaceId);
    if (!space) return 0;
    return calculatePolygonArea(space.editableVertices);
  }, [editableSpaces]);

  // Check for collisions (simplified - bounding box check)
  const hasCollisions = useCallback((spaceId: string) => {
    const space = editableSpaces.find(s => s.id === spaceId);
    if (!space) return false;

    // Get bounding box of this space
    const xs = space.editableVertices.map(v => v[0]);
    const ys = space.editableVertices.map(v => v[1]);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);

    // Check against other spaces on same floor
    for (const other of editableSpaces) {
      if (other.id === spaceId || other.floor_index !== space.floor_index) continue;

      const oxs = other.editableVertices.map(v => v[0]);
      const oys = other.editableVertices.map(v => v[1]);
      const oMinX = Math.min(...oxs);
      const oMaxX = Math.max(...oxs);
      const oMinY = Math.min(...oys);
      const oMaxY = Math.max(...oys);

      // Simple AABB overlap check
      if (maxX > oMinX && minX < oMaxX && maxY > oMinY && minY < oMaxY) {
        return true;
      }
    }

    return false;
  }, [editableSpaces]);

  // Reset to original
  const resetToOriginal = useCallback((spaceId?: string) => {
    if (spaceId) {
      setEditableSpaces(prev =>
        prev.map(space =>
          space.id === spaceId
            ? {
                ...space,
                editableVertices: geometryToVertices(space.originalGeometry),
                hasChanges: false,
              }
            : space
        )
      );
    } else {
      // Reset all
      setEditableSpaces(prev =>
        prev.map(space => ({
          ...space,
          editableVertices: geometryToVertices(space.originalGeometry),
          hasChanges: false,
        }))
      );
    }
  }, []);

  // Convert EditableSpace back to SpaceData
  const toSpaceData = useCallback((space: EditableSpace): SpaceData => {
    const newGeometry: PolygonGeometry = {
      vertices: space.editableVertices,
      rotation: isPolygonGeometry(space.originalGeometry)
        ? space.originalGeometry.rotation
        : undefined,
    };

    const area = calculatePolygonArea(space.editableVertices);

    return {
      ...space,
      geometry: newGeometry,
      actual_area_sf: area,
      area_deviation: `${(((area - space.target_area_sf) / space.target_area_sf) * 100).toFixed(1)}%`,
    };
  }, []);

  return {
    editableSpaces,
    selectedSpaceId,
    editMode,
    isDragging,
    selectSpace,
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
    getSpace,
    getSpaceArea,
    hasCollisions,
    resetToOriginal,
    toSpaceData,
  };
}

export default usePolygonEditor;
