/**
 * Displays extracted building data from PDF with visual representation
 */

import React from 'react';
import { getSpaceColor } from '../../constants/colors';

interface ExtractedData {
  properties?: Record<string, any>;
  constraints?: Record<string, any>;
  units?: Array<{ type: string; count: number; area_sf: number }>;
  metadata?: Record<string, any>;
}

interface ExtractedBuildingViewProps {
  data: ExtractedData;
  onClear: () => void;
}

export const ExtractedBuildingView: React.FC<ExtractedBuildingViewProps> = ({
  data,
  onClear,
}) => {
  const { properties = {}, constraints = {}, units = [] } = data;

  // Calculate totals
  const totalUnits = units.reduce((sum, u) => sum + (u.count || 0), 0);
  const totalArea = units.reduce((sum, u) => sum + (u.count || 0) * (u.area_sf || 0), 0);

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h3 style={styles.title}>Extracted from PDF</h3>
        <button onClick={onClear} style={styles.clearBtn}>Clear</button>
      </div>

      {/* Building Summary */}
      <div style={styles.summary}>
        <div style={styles.summaryItem}>
          <span style={styles.summaryValue}>
            {properties.area_sf?.toLocaleString() || properties.lot_size_sf?.toLocaleString() || '—'}
          </span>
          <span style={styles.summaryLabel}>Lot SF</span>
        </div>
        <div style={styles.summaryItem}>
          <span style={styles.summaryValue}>{totalUnits || properties.total_units || '—'}</span>
          <span style={styles.summaryLabel}>Units</span>
        </div>
        <div style={styles.summaryItem}>
          <span style={styles.summaryValue}>{constraints.far || properties.far || '—'}</span>
          <span style={styles.summaryLabel}>FAR</span>
        </div>
        <div style={styles.summaryItem}>
          <span style={styles.summaryValue}>{constraints.maximum_height_feet || constraints.max_height || '—'}</span>
          <span style={styles.summaryLabel}>Height (ft)</span>
        </div>
      </div>

      {/* Unit Mix Visualization */}
      {units.length > 0 && (
        <div style={styles.section}>
          <h4 style={styles.sectionTitle}>Unit Mix</h4>
          <div style={styles.unitMix}>
            {units.map((unit, i) => {
              const width = totalUnits > 0 ? (unit.count / totalUnits) * 100 : 0;
              const colors = ['#4CAF50', '#2196F3', '#9C27B0', '#FF9800', '#E91E63'];
              return (
                <div key={i} style={styles.unitRow}>
                  <div style={styles.unitInfo}>
                    <span style={styles.unitType}>{unit.type}</span>
                    <span style={styles.unitCount}>{unit.count} units @ {unit.area_sf?.toLocaleString()} SF</span>
                  </div>
                  <div style={styles.barContainer}>
                    <div
                      style={{
                        ...styles.bar,
                        width: `${width}%`,
                        background: colors[i % colors.length],
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
          <div style={styles.totalArea}>
            Total Area: {totalArea.toLocaleString()} SF
          </div>
        </div>
      )}

      {/* Constraints */}
      {Object.keys(constraints).length > 0 && (
        <div style={styles.section}>
          <h4 style={styles.sectionTitle}>Constraints</h4>
          <div style={styles.constraintGrid}>
            {constraints.zoning && (
              <div style={styles.constraint}>
                <span style={styles.constraintLabel}>Zoning</span>
                <span style={styles.constraintValue}>{constraints.zoning}</span>
              </div>
            )}
            {constraints.setbacks && (
              <div style={styles.constraint}>
                <span style={styles.constraintLabel}>Setbacks</span>
                <span style={styles.constraintValue}>
                  {typeof constraints.setbacks === 'object'
                    ? `F:${constraints.setbacks.front_feet || constraints.setbacks.front}' R:${constraints.setbacks.rear_feet || constraints.setbacks.rear}' S:${constraints.setbacks.side_feet || constraints.setbacks.side}'`
                    : constraints.setbacks}
                </span>
              </div>
            )}
            {(constraints.parking_requirement_per_unit || constraints.parking_ratio) && (
              <div style={styles.constraint}>
                <span style={styles.constraintLabel}>Parking</span>
                <span style={styles.constraintValue}>
                  {constraints.parking_requirement_per_unit || constraints.parking_ratio} per unit
                </span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Schematic Floor Plate */}
      <div style={styles.section}>
        <h4 style={styles.sectionTitle}>Schematic</h4>
        <svg viewBox="0 0 200 200" style={styles.schematic}>
          {/* Building footprint */}
          <rect
            x="20"
            y="20"
            width="160"
            height="160"
            fill="#f5f5f5"
            stroke="#333"
            strokeWidth="2"
          />

          {/* Unit blocks */}
          {units.map((unit, i) => {
            const cols = 4;
            const unitWidth = 35;
            const unitHeight = 25;
            const startY = 30;

            return Array.from({ length: Math.min(unit.count, 8) }).map((_, j) => {
              const row = Math.floor((i * 8 + j) / cols);
              const col = (i * 8 + j) % cols;
              const colors = ['#4CAF50', '#2196F3', '#9C27B0', '#FF9800'];

              return (
                <rect
                  key={`${i}-${j}`}
                  x={25 + col * (unitWidth + 5)}
                  y={startY + row * (unitHeight + 5)}
                  width={unitWidth}
                  height={unitHeight}
                  fill={colors[i % colors.length]}
                  stroke="#333"
                  strokeWidth="0.5"
                  rx="2"
                />
              );
            });
          })}

          {/* Core */}
          <rect
            x="80"
            y="140"
            width="40"
            height="35"
            fill="#FFC107"
            stroke="#333"
            strokeWidth="1"
          />
          <text x="100" y="160" textAnchor="middle" fontSize="8" fill="#333">CORE</text>
        </svg>
      </div>
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  container: {
    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    borderRadius: '12px',
    padding: '16px',
    color: '#fff',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '16px',
  },
  title: {
    margin: 0,
    fontSize: '16px',
    fontWeight: 600,
  },
  clearBtn: {
    background: 'rgba(255,255,255,0.2)',
    border: 'none',
    color: '#fff',
    padding: '4px 12px',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '12px',
  },
  summary: {
    display: 'grid',
    gridTemplateColumns: 'repeat(4, 1fr)',
    gap: '8px',
    marginBottom: '16px',
  },
  summaryItem: {
    textAlign: 'center',
    padding: '8px',
    background: 'rgba(255,255,255,0.1)',
    borderRadius: '8px',
  },
  summaryValue: {
    display: 'block',
    fontSize: '18px',
    fontWeight: 700,
  },
  summaryLabel: {
    fontSize: '10px',
    opacity: 0.8,
    textTransform: 'uppercase',
  },
  section: {
    marginTop: '12px',
    padding: '12px',
    background: 'rgba(255,255,255,0.1)',
    borderRadius: '8px',
  },
  sectionTitle: {
    margin: '0 0 8px 0',
    fontSize: '12px',
    textTransform: 'uppercase',
    opacity: 0.8,
  },
  unitMix: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  unitRow: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
  },
  unitInfo: {
    display: 'flex',
    justifyContent: 'space-between',
    fontSize: '11px',
  },
  unitType: {
    fontWeight: 600,
    textTransform: 'capitalize',
  },
  unitCount: {
    opacity: 0.8,
  },
  barContainer: {
    height: '8px',
    background: 'rgba(255,255,255,0.2)',
    borderRadius: '4px',
    overflow: 'hidden',
  },
  bar: {
    height: '100%',
    borderRadius: '4px',
    transition: 'width 0.3s ease',
  },
  totalArea: {
    marginTop: '8px',
    fontSize: '12px',
    textAlign: 'right',
    fontWeight: 600,
  },
  constraintGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, 1fr)',
    gap: '8px',
  },
  constraint: {
    display: 'flex',
    flexDirection: 'column',
  },
  constraintLabel: {
    fontSize: '10px',
    opacity: 0.7,
    textTransform: 'uppercase',
  },
  constraintValue: {
    fontSize: '12px',
    fontWeight: 500,
  },
  schematic: {
    width: '100%',
    height: '150px',
    background: '#fff',
    borderRadius: '8px',
  },
};

export default ExtractedBuildingView;
