/**
 * Bottom metrics bar showing real-time floor statistics
 * Updates live as user edits spaces
 */

import React from 'react';

interface MetricsBarProps {
  efficiency: number;
  totalSpaces: number;
  dwellingUnits: number;
  retailSpaces: number;
  usableArea: number;
  violations: string[];
  areaDelta?: number;
  areaDeltaPercent?: number;
}

export const MetricsBar: React.FC<MetricsBarProps> = ({
  efficiency,
  totalSpaces,
  dwellingUnits,
  retailSpaces,
  usableArea,
  violations,
  areaDelta = 0,
  areaDeltaPercent = 0,
}) => {
  const hasViolations = violations.length > 0;

  return (
    <div style={styles.container}>
      {/* Efficiency */}
      <MetricItem
        label="Efficiency"
        value={`${efficiency.toFixed(1)}%`}
        status={efficiency >= 70 ? 'good' : efficiency >= 50 ? 'warning' : 'bad'}
      />

      {/* Total Spaces */}
      <MetricItem
        label="Spaces"
        value={totalSpaces.toString()}
        status="neutral"
      />

      {/* Units */}
      <MetricItem
        label="Units"
        value={dwellingUnits.toString()}
        status="neutral"
        highlight={dwellingUnits > 0}
      />

      {/* Retail */}
      <MetricItem
        label="Retail"
        value={retailSpaces.toString()}
        status="neutral"
      />

      {/* Usable Area */}
      <MetricItem
        label="Area"
        value={`${Math.round(usableArea).toLocaleString()} SF`}
        status="neutral"
        delta={areaDelta !== 0 ? `${areaDelta > 0 ? '+' : ''}${Math.round(areaDelta).toLocaleString()}` : undefined}
        deltaPercent={areaDeltaPercent !== 0 ? areaDeltaPercent : undefined}
      />

      {/* Violations */}
      <div style={styles.violations}>
        {hasViolations ? (
          <div style={styles.violationBadge}>
            <span style={styles.violationIcon}>⚠</span>
            <span>{violations.length} issue{violations.length > 1 ? 's' : ''}</span>
            <div style={styles.violationTooltip}>
              {violations.map((v, i) => (
                <div key={i}>{v}</div>
              ))}
            </div>
          </div>
        ) : (
          <div style={styles.noViolations}>
            <span style={styles.checkIcon}>✓</span>
            <span>No issues</span>
          </div>
        )}
      </div>
    </div>
  );
};

interface MetricItemProps {
  label: string;
  value: string;
  status: 'good' | 'warning' | 'bad' | 'neutral';
  highlight?: boolean;
  delta?: string;
  deltaPercent?: number;
}

const MetricItem: React.FC<MetricItemProps> = ({
  label,
  value,
  status,
  highlight,
  delta,
  deltaPercent,
}) => {
  const valueColor = {
    good: '#10b981',
    warning: '#f59e0b',
    bad: '#ef4444',
    neutral: '#ffffff',
  }[status];

  return (
    <div style={{ ...styles.metric, ...(highlight ? styles.metricHighlight : {}) }}>
      <span style={styles.metricLabel}>{label}</span>
      <span style={{ ...styles.metricValue, color: valueColor }}>{value}</span>
      {delta && (
        <span style={{
          ...styles.delta,
          color: deltaPercent && deltaPercent > 0 ? '#10b981' : deltaPercent && deltaPercent < 0 ? '#ef4444' : '#a0a0b0',
        }}>
          {delta}
        </span>
      )}
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    alignItems: 'center',
    gap: '24px',
    padding: '8px 16px',
    background: '#1e1e2e',
    borderTop: '1px solid #333',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  },
  metric: {
    display: 'flex',
    alignItems: 'baseline',
    gap: '6px',
  },
  metricHighlight: {
    background: 'rgba(124, 58, 237, 0.2)',
    padding: '4px 8px',
    borderRadius: '4px',
  },
  metricLabel: {
    fontSize: '11px',
    color: '#a0a0b0',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
  },
  metricValue: {
    fontSize: '14px',
    fontWeight: 600,
  },
  delta: {
    fontSize: '10px',
    marginLeft: '4px',
  },
  violations: {
    marginLeft: 'auto',
    position: 'relative' as const,
  },
  violationBadge: {
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
    padding: '4px 8px',
    background: 'rgba(239, 68, 68, 0.2)',
    borderRadius: '4px',
    color: '#ef4444',
    fontSize: '12px',
    cursor: 'pointer',
  },
  violationIcon: {
    fontSize: '14px',
  },
  violationTooltip: {
    position: 'absolute' as const,
    bottom: '100%',
    right: 0,
    background: '#1e1e2e',
    border: '1px solid #333',
    borderRadius: '4px',
    padding: '8px',
    fontSize: '11px',
    color: '#fff',
    whiteSpace: 'nowrap' as const,
    display: 'none',
    zIndex: 100,
  },
  noViolations: {
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
    padding: '4px 8px',
    background: 'rgba(16, 185, 129, 0.2)',
    borderRadius: '4px',
    color: '#10b981',
    fontSize: '12px',
  },
  checkIcon: {
    fontSize: '14px',
  },
};

export default MetricsBar;
