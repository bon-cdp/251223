/**
 * Color legend panel
 */

import React from 'react';
import { SPACE_TYPE_COLORS } from '../../constants/colors';

export const LegendPanel: React.FC = () => {
  // Filter out DEFAULT and format labels
  const entries = Object.entries(SPACE_TYPE_COLORS)
    .filter(([key]) => key !== 'DEFAULT')
    .map(([key, color]) => ({
      label: key.replace(/_/g, ' ').toLowerCase().replace(/^\w/, c => c.toUpperCase()),
      color,
    }));

  return (
    <div style={styles.container}>
      <h3 style={styles.title}>Legend</h3>
      <div style={styles.grid}>
        {entries.map(({ label, color }) => (
          <div key={label} style={styles.item}>
            <div style={{ ...styles.swatch, background: color }} />
            <span style={styles.label}>{label}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  container: {
    background: '#fff',
    borderRadius: '8px',
    border: '1px solid #ddd',
    padding: '12px 16px',
  },
  title: {
    margin: '0 0 12px 0',
    fontSize: '14px',
    fontWeight: 600,
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, 1fr)',
    gap: '8px',
  },
  item: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
  },
  swatch: {
    width: '14px',
    height: '14px',
    borderRadius: '2px',
    flexShrink: 0,
  },
  label: {
    fontSize: '11px',
    color: '#666',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
};

export default LegendPanel;
