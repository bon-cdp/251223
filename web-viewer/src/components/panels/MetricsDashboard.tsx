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
  const [showStatusTooltip, setShowStatusTooltip] = React.useState(false);

  // Determine status details
  const statusInfo = success 
    ? { 
        label: 'Success', 
        color: '#10b981', 
        bgColor: 'rgba(16, 185, 129, 0.2)',
        description: 'All spaces placed successfully with valid constraints.'
      }
    : { 
        label: 'Incomplete', 
        color: '#f59e0b', 
        bgColor: 'rgba(245, 158, 11, 0.2)',
        description: `${violations.length} constraint violations detected. Some spaces may overlap or exceed boundaries.`
      };

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h3 style={styles.title}>Solver Metrics</h3>
        <div 
          style={{ position: 'relative', display: 'inline-block' }}
          onMouseEnter={() => setShowStatusTooltip(true)}
          onMouseLeave={() => setShowStatusTooltip(false)}
        >
          <span style={{
            ...styles.status,
            background: statusInfo.bgColor,
            color: statusInfo.color,
            border: `1px solid ${statusInfo.color}`,
          }}>
            {statusInfo.label}
          </span>
          {/* Status tooltip */}
          {showStatusTooltip && (
            <div style={styles.statusTooltip}>
              <div style={{ fontWeight: 600, marginBottom: 4 }}>{statusInfo.label}</div>
              <div style={{ fontSize: 11, opacity: 0.9 }}>{statusInfo.description}</div>
            </div>
          )}
        </div>
      </div>

      <div style={styles.content}>
        <div style={styles.section}>
          <MetricCard
            label="Placement Rate"
            value={solverMetrics.placement_rate}
            highlight
            tooltip="Percentage of spaces successfully placed on floor plates"
          />
          <MetricCard
            label="Spaces Placed"
            value={`${solverMetrics.placed_spaces}/${solverMetrics.total_spaces}`}
            tooltip="Number of spaces placed vs total spaces to place"
          />
          <MetricCard
            label="Avg Membership"
            value={solverMetrics.avg_membership}
            tooltip="Average fuzzy membership score (1.0 = perfect area match)"
          />
        </div>

        <div style={styles.divider} />

        <div style={styles.section}>
          <MetricCard
            label="Total Floors"
            value={buildingMetrics.total_floors.toString()}
            tooltip="Total number of floors in the building"
          />
          <MetricCard
            label="Total Spaces"
            value={buildingMetrics.total_spaces.toString()}
            tooltip="Total number of placed space instances"
          />
          <MetricCard
            label="Obstruction"
            value={obstruction.toFixed(2)}
            warning={obstruction > 0}
            tooltip="Cohomological obstruction (0 = perfect vertical alignment)"
          />
        </div>

        {violations.length > 0 && (
          <>
            <div style={styles.divider} />
            <div style={styles.violationsSection}>
              <span style={styles.violationsLabel}>
                ⚠ Violations ({violations.length})
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
  tooltip?: string;
}

const MetricCard: React.FC<MetricCardProps> = ({ label, value, highlight, warning, tooltip }) => {
  const [showTooltip, setShowTooltip] = React.useState(false);
  
  return (
    <div 
      style={styles.metricCard}
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
    >
      <span style={styles.metricLabel}>{label}</span>
      <span style={{
        ...styles.metricValue,
        color: warning ? '#ef4444' : highlight ? '#7c3aed' : '#fff',
      }}>
        {value}
      </span>
      {tooltip && showTooltip && (
        <div style={styles.metricTooltip}>
          {tooltip}
        </div>
      )}
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  container: {
    background: '#1e1e2e',
    borderRadius: '8px',
    border: '1px solid #3a3a4a',
    overflow: 'hidden',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '12px 16px',
    background: '#2d2d3f',
    borderBottom: '1px solid #3a3a4a',
  },
  title: {
    margin: 0,
    fontSize: '14px',
    fontWeight: 600,
    color: '#fff',
  },
  status: {
    padding: '4px 10px',
    borderRadius: '6px',
    fontSize: '11px',
    fontWeight: 600,
    textTransform: 'uppercase',
    cursor: 'help',
  },
  statusTooltip: {
    position: 'absolute',
    top: '100%',
    right: 0,
    marginTop: 8,
    padding: '10px 12px',
    background: '#3d3d4f',
    border: '1px solid #4a4a5a',
    borderRadius: '8px',
    fontSize: 12,
    color: '#fff',
    minWidth: 200,
    maxWidth: 280,
    zIndex: 100,
    boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
    lineHeight: 1.4,
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
    padding: '10px 8px',
    background: '#2d2d3f',
    borderRadius: '6px',
    position: 'relative',
    cursor: 'help',
    transition: 'background 0.15s ease',
  },
  metricLabel: {
    fontSize: '9px',
    color: '#a0a0b0',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
    marginBottom: '4px',
  },
  metricValue: {
    fontSize: '16px',
    fontWeight: 600,
  },
  metricTooltip: {
    position: 'absolute',
    bottom: '100%',
    left: '50%',
    transform: 'translateX(-50%)',
    marginBottom: 8,
    padding: '8px 10px',
    background: '#3d3d4f',
    border: '1px solid #4a4a5a',
    borderRadius: '6px',
    fontSize: 11,
    color: '#fff',
    whiteSpace: 'nowrap',
    zIndex: 100,
    boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
  },
  divider: {
    height: '1px',
    background: '#3a3a4a',
    margin: '12px 0',
  },
  violationsSection: {
    marginTop: '8px',
  },
  violationsLabel: {
    fontSize: '11px',
    color: '#f59e0b',
    fontWeight: 600,
  },
  violationsList: {
    marginTop: '8px',
  },
  violation: {
    fontSize: '11px',
    color: '#a0a0b0',
    padding: '6px 10px',
    background: 'rgba(245, 158, 11, 0.1)',
    border: '1px solid rgba(245, 158, 11, 0.2)',
    borderRadius: '4px',
    marginBottom: '4px',
  },
  moreViolations: {
    fontSize: '11px',
    color: '#6c6c80',
    fontStyle: 'italic',
  },
};

export default MetricsDashboard;
