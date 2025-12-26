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
                background: idx === currentFloorIndex ? '#333' : '#ddd',
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
    background: '#f8f9fa',
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
    color: '#666',
  },
  floorIndex: {
    fontSize: '24px',
    fontWeight: 'bold',
    color: '#333',
  },
  floorType: {
    fontSize: '12px',
    color: '#666',
    marginBottom: '12px',
  },
  navigation: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '8px',
  },
  navButton: {
    width: '32px',
    height: '32px',
    border: '1px solid #ddd',
    borderRadius: '4px',
    background: '#fff',
    cursor: 'pointer',
    fontSize: '12px',
  },
  dots: {
    display: 'flex',
    gap: '4px',
    flexWrap: 'wrap',
    justifyContent: 'center',
    maxWidth: '120px',
  },
  dot: {
    width: '12px',
    height: '12px',
    borderRadius: '50%',
    border: 'none',
    cursor: 'pointer',
    padding: 0,
  },
  hint: {
    marginTop: '12px',
    fontSize: '10px',
    color: '#999',
  },
};

export default FloorNavigation;
