/**
 * Floor navigation component with dropdown selector
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
}) => {

  const getFloorLabel = (idx: number): string => {
    if (idx < 0) return `B${Math.abs(idx)} - Parking`;
    if (idx === 0) return `G - Ground`;
    return `${idx} - Residential`;
  };

  return (
    <div style={styles.container}>
      <label style={styles.label} htmlFor="floor-select">Floor</label>
      <select
        id="floor-select"
        style={styles.select}
        value={currentFloorIndex}
        onChange={(e) => onFloorChange(Number(e.target.value))}
      >
        {floorIndices.map(idx => (
          <option key={idx} value={idx}>
            {getFloorLabel(idx)}
          </option>
        ))}
      </select>

      {currentFloorType && (
        <div style={styles.floorType}>
          {getFloorTypeLabel(currentFloorType)}
        </div>
      )}

      <div style={styles.hint}>
        Arrow keys to navigate
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
  label: {
    fontSize: '12px',
    color: '#a0a0b0',
    display: 'block',
    marginBottom: '8px',
  },
  select: {
    width: '100%',
    padding: '10px 12px',
    background: '#2d2d3f',
    border: '1px solid #3a3a4a',
    borderRadius: '8px',
    color: '#fff',
    fontSize: '14px',
    fontWeight: 500,
    cursor: 'pointer',
    outline: 'none',
  },
  floorType: {
    fontSize: '12px',
    color: '#7c3aed',
    fontWeight: 500,
    marginTop: '10px',
    padding: '4px 12px',
    background: 'rgba(124, 58, 237, 0.15)',
    borderRadius: '12px',
    display: 'inline-block',
  },
  hint: {
    marginTop: '12px',
    fontSize: '10px',
    color: '#6c6c80',
  },
};

export default FloorNavigation;
