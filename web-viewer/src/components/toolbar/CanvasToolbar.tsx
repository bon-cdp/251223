/**
 * Canvas toolbar for tool selection
 * TestFit-style toolbar with tool icons
 */

import React from 'react';
import { EditMode } from '../../hooks/usePolygonEditor';

interface CanvasToolbarProps {
  activeMode: EditMode;
  onModeChange: (mode: EditMode) => void;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  onReset?: () => void;
}

interface ToolButton {
  mode: EditMode;
  icon: string;
  label: string;
  shortcut: string;
}

const tools: ToolButton[] = [
  { mode: 'select', icon: '⬚', label: 'Select', shortcut: 'V' },
  { mode: 'move', icon: '✥', label: 'Pan', shortcut: 'H' },
  { mode: 'vertex', icon: '✎', label: 'Edit Vertices', shortcut: 'E' },
  { mode: 'add-space', icon: '⊕', label: 'Add Space', shortcut: 'A' },
  { mode: 'measure', icon: '📏', label: 'Measure', shortcut: 'M' },
];

export const CanvasToolbar: React.FC<CanvasToolbarProps> = ({
  activeMode,
  onModeChange,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  onReset,
}) => {
  // Handle keyboard shortcuts
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if typing in an input
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      // Undo/Redo
      if (e.ctrlKey || e.metaKey) {
        if (e.key === 'z' && !e.shiftKey) {
          e.preventDefault();
          onUndo();
        } else if ((e.key === 'z' && e.shiftKey) || e.key === 'y') {
          e.preventDefault();
          onRedo();
        }
        return;
      }

      // Tool shortcuts
      const key = e.key.toUpperCase();
      const tool = tools.find(t => t.shortcut === key);
      if (tool) {
        e.preventDefault();
        onModeChange(tool.mode);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onModeChange, onUndo, onRedo]);

  return (
    <div style={styles.container}>
      {/* Tool buttons */}
      <div style={styles.toolGroup}>
        {tools.map(tool => (
          <button
            key={tool.mode}
            onClick={() => onModeChange(tool.mode)}
            style={{
              ...styles.toolButton,
              ...(activeMode === tool.mode ? styles.toolButtonActive : {}),
            }}
            title={`${tool.label} (${tool.shortcut})`}
          >
            <span style={styles.toolIcon}>{tool.icon}</span>
            <span style={styles.toolLabel}>{tool.label}</span>
          </button>
        ))}
      </div>

      {/* Separator */}
      <div style={styles.separator} />

      {/* Undo/Redo */}
      <div style={styles.toolGroup}>
        <button
          onClick={onUndo}
          disabled={!canUndo}
          style={{
            ...styles.actionButton,
            opacity: canUndo ? 1 : 0.4,
          }}
          title="Undo (Ctrl+Z)"
        >
          ↶
        </button>
        <button
          onClick={onRedo}
          disabled={!canRedo}
          style={{
            ...styles.actionButton,
            opacity: canRedo ? 1 : 0.4,
          }}
          title="Redo (Ctrl+Y)"
        >
          ↷
        </button>
      </div>

      {/* Separator */}
      <div style={styles.separator} />

      {/* Reset */}
      {onReset && (
        <button
          onClick={onReset}
          style={styles.resetButton}
          title="Reset to original"
        >
          Reset
        </button>
      )}

      {/* Mode indicator */}
      <div style={styles.modeIndicator}>
        <span style={styles.modeLabel}>Mode:</span>
        <span style={styles.modeName}>
          {tools.find(t => t.mode === activeMode)?.label || 'Select'}
        </span>
      </div>
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '8px 12px',
    background: '#2d2d3f',
    borderBottom: '1px solid #333',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  },
  toolGroup: {
    display: 'flex',
    gap: '4px',
  },
  toolButton: {
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    gap: '2px',
    padding: '6px 10px',
    background: 'transparent',
    border: '1px solid transparent',
    borderRadius: '4px',
    cursor: 'pointer',
    color: '#a0a0b0',
    transition: 'all 0.15s ease',
  },
  toolButtonActive: {
    background: 'rgba(124, 58, 237, 0.3)',
    borderColor: '#7c3aed',
    color: '#fff',
  },
  toolIcon: {
    fontSize: '18px',
  },
  toolLabel: {
    fontSize: '9px',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.5px',
  },
  separator: {
    width: '1px',
    height: '32px',
    background: '#444',
  },
  actionButton: {
    width: '32px',
    height: '32px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: '#3d3d4f',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    color: '#fff',
    fontSize: '16px',
    transition: 'background 0.15s ease',
  },
  resetButton: {
    padding: '6px 12px',
    background: 'transparent',
    border: '1px solid #555',
    borderRadius: '4px',
    cursor: 'pointer',
    color: '#a0a0b0',
    fontSize: '11px',
    transition: 'all 0.15s ease',
  },
  modeIndicator: {
    marginLeft: 'auto',
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
  },
  modeLabel: {
    fontSize: '10px',
    color: '#666',
    textTransform: 'uppercase' as const,
  },
  modeName: {
    fontSize: '12px',
    color: '#7c3aed',
    fontWeight: 600,
  },
};

export default CanvasToolbar;
