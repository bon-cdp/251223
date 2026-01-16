/**
 * Floor navigation component with buttons and floor selector
 */

import React from 'react';
import { getFloorTypeLabel } from '../../constants/colors';

interface FloorNavigationProps {
  floorIndices: number[];
  currentFloorIndex: number;
  currentFloorType?: string;
  onFloorChange: (index: number) => void;
  onPrev: () => void;
  onNext: () => void;
}

export const FloorNavigation: React.FC<FloorNavigationProps> = ({
  floorIndices,
  currentFloorIndex,
  currentFloorType,
  onFloorChange,
  onPrev,
  onNext,
}) => {
  const currentPos = floorIndices.indexOf(currentFloorIndex);
  const canGoPrev = currentPos > 0;
  const canGoNext = currentPos < floorIndices.length - 1;

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <span style={styles.label}>Floor</span>
        <span style={styles.floorIndex}>
          {currentFloorIndex >= 0 ? `+${currentFloorIndex}` : currentFloorIndex}
        </span>
      </div>

      {currentFloorType && (
        <div style={styles.floorType}>
          {getFloorTypeLabel(currentFloorType)}
        </div>
      )}

      <div style={styles.navigation}>
        <button
          onClick={onPrev}
          disabled={!canGoPrev}
          style={{
            ...styles.navButton,
            opacity: canGoPrev ? 1 : 0.5,
          }}
          title="Previous floor (↑)"
        >
          ▲
        </button>

        <div style={styles.dots}>
          {floorIndices.map(idx => (
            <button
              key={idx}
              onClick={() => onFloorChange(idx)}
              style={{
                ...styles.dot,
                background: idx === currentFloorIndex ? '#7c3aed' : '#3d3d4f',
                border: idx === currentFloorIndex ? '2px solid #a78bfa' : '2px solid transparent',
                transform: idx === currentFloorIndex ? 'scale(1.15)' : 'scale(1)',
              }}
              title={`Floor ${idx >= 0 ? '+' : ''}${idx}`}
            />
          ))}
        </div>

        <button
          onClick={onNext}
          disabled={!canGoNext}
          style={{
            ...styles.navButton,
            opacity: canGoNext ? 1 : 0.5,
          }}
          title="Next floor (↓)"
        >
          ▼
        </button>
      </div>

      <div style={styles.hint}>
        Use arrow keys to navigate
      </div>
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  container: {
    padding: '16px',
    background: '#1e1e2e',
    borderRadius: '8px',
    textAlign: 'center',
  },
  header: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'baseline',
    gap: '8px',
    marginBottom: '4px',
  },
  label: {
    fontSize: '14px',
    color: '#a0a0b0',
  },
  floorIndex: {
    fontSize: '28px',
    fontWeight: 'bold',
    color: '#fff',
    fontVariantNumeric: 'tabular-nums',
  },
  floorType: {
    fontSize: '12px',
    color: '#7c3aed',
    fontWeight: 500,
    marginBottom: '16px',
    padding: '4px 12px',
    background: 'rgba(124, 58, 237, 0.15)',
    borderRadius: '12px',
    display: 'inline-block',
  },
  navigation: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '8px',
  },
  navButton: {
    width: '36px',
    height: '36px',
    border: '1px solid #3a3a4a',
    borderRadius: '8px',
    background: '#2d2d3f',
    cursor: 'pointer',
    fontSize: '14px',
    color: '#a0a0b0',
    transition: 'all 0.15s ease',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dots: {
    display: 'flex',
    gap: '6px',
    flexWrap: 'wrap',
    justifyContent: 'center',
    maxWidth: '140px',
    padding: '8px',
  },
  dot: {
    width: '14px',
    height: '14px',
    borderRadius: '50%',
    border: '2px solid transparent',
    cursor: 'pointer',
    padding: 0,
    transition: 'all 0.15s ease',
  },
  hint: {
    marginTop: '16px',
    fontSize: '10px',
    color: '#6c6c80',
  },
};

export default FloorNavigation;
