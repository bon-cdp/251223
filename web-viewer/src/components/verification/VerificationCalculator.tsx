/**
 * Verification calculator comparing solver output to building input
 */

import React from 'react';
import { SolverResult, BuildingInput } from '../../types/solverOutput';

interface VerificationCalculatorProps {
  solverResult: SolverResult;
  buildingInput: BuildingInput | null;
}

interface VerificationItem {
  label: string;
  expected: string | number;
  actual: string | number;
  pass: boolean;
}

export const VerificationCalculator: React.FC<VerificationCalculatorProps> = ({
  solverResult,
  buildingInput,
}) => {
  if (!buildingInput) {
    return (
      <div style={styles.container}>
        <h3 style={styles.title}>Verification</h3>
        <div style={styles.empty}>
          Building input data not available
        </div>
      </div>
    );
  }

  // Calculate verification items
  const verifications: VerificationItem[] = [];

  // Total floors
  verifications.push({
    label: 'Total Floors',
    expected: buildingInput.building.stories_total,
    actual: solverResult.building.metrics.total_floors,
    pass: buildingInput.building.stories_total === solverResult.building.metrics.total_floors,
  });

  // Total dwelling units expected
  const expectedUnits = buildingInput.dwelling_units.reduce((sum, u) => sum + u.count, 0);
  const actualDwellingSpaces = solverResult.building.floors
    .flatMap(f => f.spaces)
    .filter(s => s.type === 'DWELLING_UNIT').length;

  verifications.push({
    label: 'Dwelling Units',
    expected: expectedUnits,
    actual: actualDwellingSpaces,
    pass: actualDwellingSpaces >= expectedUnits * 0.9, // 90% tolerance
  });

  // Lot size (compare floor plate area)
  const lotSizeSf = buildingInput.building.lot_size_sf;
  const groundFloor = solverResult.building.floors.find(f => f.floor_index === 0);
  const groundFloorArea = groundFloor?.area_sf || 0;

  verifications.push({
    label: 'Lot Size',
    expected: `${lotSizeSf.toLocaleString()} SF`,
    actual: `${groundFloorArea.toLocaleString()} SF`,
    pass: Math.abs(groundFloorArea - lotSizeSf) / lotSizeSf < 0.35, // 35% tolerance for floor plate
  });

  // FAR check
  const expectedFar = buildingInput.building.far;
  const totalBuildingArea = solverResult.building.floors.reduce((sum, f) => sum + f.area_sf, 0);
  const actualFar = totalBuildingArea / lotSizeSf;

  verifications.push({
    label: 'FAR',
    expected: expectedFar.toFixed(2),
    actual: actualFar.toFixed(2),
    pass: Math.abs(actualFar - expectedFar) / expectedFar < 0.1, // 10% tolerance
  });

  // Placement rate
  const placementPercent = parseFloat(solverResult.metrics.placement_rate);
  verifications.push({
    label: 'Placement Rate',
    expected: '100%',
    actual: solverResult.metrics.placement_rate,
    pass: placementPercent >= 80,
  });

  const passCount = verifications.filter(v => v.pass).length;

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h3 style={styles.title}>Verification</h3>
        <span style={{
          ...styles.score,
          color: passCount === verifications.length ? '#4caf50' : '#ff9800',
        }}>
          {passCount}/{verifications.length} passed
        </span>
      </div>

      <div style={styles.content}>
        {verifications.map((item, i) => (
          <div key={i} style={styles.row}>
            <div style={styles.rowHeader}>
              <span style={{
                ...styles.indicator,
                background: item.pass ? '#4caf50' : '#f44336',
              }}>
                {item.pass ? '✓' : '✗'}
              </span>
              <span style={styles.label}>{item.label}</span>
            </div>
            <div style={styles.values}>
              <span style={styles.expected}>Expected: {item.expected}</span>
              <span style={styles.actual}>Actual: {item.actual}</span>
            </div>
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
  score: {
    fontSize: '12px',
    fontWeight: 600,
  },
  content: {
    padding: '8px 16px',
  },
  empty: {
    padding: '24px',
    textAlign: 'center',
    color: '#999',
    fontSize: '13px',
  },
  row: {
    padding: '8px 0',
    borderBottom: '1px solid #eee',
  },
  rowHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    marginBottom: '4px',
  },
  indicator: {
    width: '18px',
    height: '18px',
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#fff',
    fontSize: '10px',
    fontWeight: 'bold',
  },
  label: {
    fontSize: '13px',
    fontWeight: 500,
  },
  values: {
    display: 'flex',
    gap: '16px',
    marginLeft: '26px',
  },
  expected: {
    fontSize: '11px',
    color: '#666',
  },
  actual: {
    fontSize: '11px',
    color: '#333',
    fontWeight: 500,
  },
};

export default VerificationCalculator;
