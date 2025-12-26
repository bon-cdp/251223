/**
 * Dashboard showing solver metrics
 */

import React from 'react';
import { SolverMetrics, BuildingMetrics } from '../../types/solverOutput';

interface MetricsDashboardProps {
  solverMetrics: SolverMetrics;
  buildingMetrics: BuildingMetrics;
  success: boolean;
  obstruction: number;
  violations: string[];
}

export const MetricsDashboard: React.FC<MetricsDashboardProps> = ({
  solverMetrics,
  buildingMetrics,
  success,
  obstruction,
  violations,
}) => {
  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h3 style={styles.title}>Solver Metrics</h3>
        <span style={{
          ...styles.status,
          background: success ? '#4caf50' : '#f44336',
        }}>
          {success ? 'Success' : 'Failed'}
        </span>
      </div>

      <div style={styles.content}>
        <div style={styles.section}>
          <MetricCard
            label="Placement Rate"
            value={solverMetrics.placement_rate}
            highlight
          />
          <MetricCard
            label="Spaces Placed"
            value={`${solverMetrics.placed_spaces}/${solverMetrics.total_spaces}`}
          />
          <MetricCard
            label="Avg Membership"
            value={solverMetrics.avg_membership}
          />
        </div>

        <div style={styles.divider} />

        <div style={styles.section}>
          <MetricCard
            label="Total Floors"
            value={buildingMetrics.total_floors.toString()}
          />
          <MetricCard
            label="Total Spaces"
            value={buildingMetrics.total_spaces.toString()}
          />
          <MetricCard
            label="Obstruction"
            value={obstruction.toFixed(2)}
            warning={obstruction > 0}
          />
        </div>

        {violations.length > 0 && (
          <>
            <div style={styles.divider} />
            <div style={styles.violationsSection}>
              <span style={styles.violationsLabel}>
                Violations ({violations.length})
              </span>
              <div style={styles.violationsList}>
                {violations.slice(0, 3).map((v, i) => (
                  <div key={i} style={styles.violation}>
                    {v}
                  </div>
                ))}
                {violations.length > 3 && (
                  <div style={styles.moreViolations}>
                    +{violations.length - 3} more...
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

interface MetricCardProps {
  label: string;
  value: string;
  highlight?: boolean;
  warning?: boolean;
}

const MetricCard: React.FC<MetricCardProps> = ({ label, value, highlight, warning }) => (
  <div style={styles.metricCard}>
    <span style={styles.metricLabel}>{label}</span>
    <span style={{
      ...styles.metricValue,
      color: warning ? '#f44336' : highlight ? '#2196f3' : '#333',
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
  status: {
    padding: '2px 8px',
    borderRadius: '4px',
    color: '#fff',
    fontSize: '11px',
    fontWeight: 600,
    textTransform: 'uppercase',
  },
  content: {
    padding: '12px 16px',
  },
  section: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gap: '8px',
  },
  metricCard: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    padding: '8px',
    background: '#f8f9fa',
    borderRadius: '4px',
  },
  metricLabel: {
    fontSize: '10px',
    color: '#666',
    textTransform: 'uppercase',
    marginBottom: '4px',
  },
  metricValue: {
    fontSize: '16px',
    fontWeight: 600,
  },
  divider: {
    height: '1px',
    background: '#eee',
    margin: '12px 0',
  },
  violationsSection: {
    marginTop: '8px',
  },
  violationsLabel: {
    fontSize: '11px',
    color: '#f44336',
    fontWeight: 600,
  },
  violationsList: {
    marginTop: '8px',
  },
  violation: {
    fontSize: '11px',
    color: '#666',
    padding: '4px 8px',
    background: '#fff5f5',
    borderRadius: '4px',
    marginBottom: '4px',
  },
  moreViolations: {
    fontSize: '11px',
    color: '#999',
    fontStyle: 'italic',
  },
};

export default MetricsDashboard;
