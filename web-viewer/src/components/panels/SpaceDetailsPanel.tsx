/**
 * Panel showing details of selected space
 */

import React from 'react';
import { SpaceData } from '../../types/solverOutput';
import { getSpaceColor } from '../../constants/colors';

interface SpaceDetailsPanelProps {
  space: SpaceData | null;
  onClose: () => void;
}

export const SpaceDetailsPanel: React.FC<SpaceDetailsPanelProps> = ({
  space,
  onClose,
}) => {
  if (!space) {
    return (
      <div style={styles.container}>
        <div style={styles.header}>
          <h3 style={styles.title}>Space Details</h3>
        </div>
        <div style={styles.empty}>
          Click a space to see details
        </div>
      </div>
    );
  }

  const color = getSpaceColor(space.type);

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div
            style={{
              width: '16px',
              height: '16px',
              background: color,
              borderRadius: '2px',
            }}
          />
          <h3 style={styles.title}>{space.name}</h3>
        </div>
        <button onClick={onClose} style={styles.closeButton}>×</button>
      </div>

      <div style={styles.content}>
        <DetailRow label="Type" value={space.type} />
        <DetailRow label="ID" value={space.id} mono />
        <DetailRow label="Floor" value={`${space.floor_index >= 0 ? '+' : ''}${space.floor_index}`} />

        <div style={styles.divider} />

        <DetailRow label="Target Area" value={`${space.target_area_sf.toLocaleString()} SF`} />
        <DetailRow label="Actual Area" value={`${space.actual_area_sf.toLocaleString()} SF`} />
        <DetailRow
          label="Deviation"
          value={space.area_deviation}
          highlight={space.area_deviation !== '+0.0%'}
        />
        <DetailRow
          label="Membership"
          value={`${(space.membership * 100).toFixed(0)}%`}
          highlight={space.membership < 1}
        />

        <div style={styles.divider} />

        <DetailRow label="Width" value={`${space.geometry.width.toFixed(1)} ft`} />
        <DetailRow label="Height" value={`${space.geometry.height.toFixed(1)} ft`} />
        <DetailRow label="Rotation" value={`${space.geometry.rotation}°`} />
        <DetailRow
          label="Vertical"
          value={space.is_vertical ? 'Yes' : 'No'}
          highlight={space.is_vertical}
        />
      </div>
    </div>
  );
};

interface DetailRowProps {
  label: string;
  value: string;
  mono?: boolean;
  highlight?: boolean;
}

const DetailRow: React.FC<DetailRowProps> = ({ label, value, mono, highlight }) => (
  <div style={styles.row}>
    <span style={styles.label}>{label}</span>
    <span style={{
      ...styles.value,
      fontFamily: mono ? 'monospace' : 'inherit',
      color: highlight ? '#e91e63' : '#333',
    }}>
      {value}
    </span>
  </div>
);

const styles: Record<string, React.CSSProperties> = {
  container: {
    background: '#fff',
    borderRadius: '8px',
    border: '1px solid #ddd',
    overflow: 'hidden',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '12px 16px',
    background: '#f8f9fa',
    borderBottom: '1px solid #ddd',
  },
  title: {
    margin: 0,
    fontSize: '14px',
    fontWeight: 600,
  },
  closeButton: {
    background: 'none',
    border: 'none',
    fontSize: '20px',
    cursor: 'pointer',
    color: '#666',
    padding: '0 4px',
  },
  content: {
    padding: '12px 16px',
  },
  empty: {
    padding: '24px',
    textAlign: 'center',
    color: '#999',
    fontSize: '13px',
  },
  row: {
    display: 'flex',
    justifyContent: 'space-between',
    padding: '4px 0',
  },
  label: {
    fontSize: '12px',
    color: '#666',
  },
  value: {
    fontSize: '12px',
    fontWeight: 500,
  },
  divider: {
    height: '1px',
    background: '#eee',
    margin: '8px 0',
  },
};

export default SpaceDetailsPanel;
