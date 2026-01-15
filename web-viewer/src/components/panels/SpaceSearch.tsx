/**
 * Space search and filter component
 * Allows users to find spaces by name or type
 */

import React, { useState, useMemo, useCallback } from 'react';
import { SpaceData } from '../../types/solverOutput';

interface SpaceSearchProps {
  spaces: SpaceData[];
  onSpaceSelect: (space: SpaceData) => void;
  selectedSpaceId: string | null;
}

const spaceTypeColors: Record<string, string> = {
  'dwelling': '#7c3aed',
  'retail': '#10b981',
  'support': '#f59e0b',
  'circulation': '#6366f1',
  'mep': '#ef4444',
  'amenity': '#ec4899',
};

export const SpaceSearch: React.FC<SpaceSearchProps> = ({
  spaces,
  onSpaceSelect,
  selectedSpaceId,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [isExpanded, setIsExpanded] = useState(false);

  // Get unique space types
  const spaceTypes = useMemo(() => {
    const types = new Set(spaces.map(s => s.type.split('_')[0]));
    return ['all', ...Array.from(types)];
  }, [spaces]);

  // Filter spaces based on search query and type
  const filteredSpaces = useMemo(() => {
    return spaces.filter(space => {
      const matchesQuery = searchQuery === '' || 
        space.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        space.id.toLowerCase().includes(searchQuery.toLowerCase());
      
      const matchesType = typeFilter === 'all' || 
        space.type.toLowerCase().startsWith(typeFilter.toLowerCase());
      
      return matchesQuery && matchesType;
    });
  }, [spaces, searchQuery, typeFilter]);

  // Handle space click
  const handleSpaceClick = useCallback((space: SpaceData) => {
    onSpaceSelect(space);
    setIsExpanded(false);
  }, [onSpaceSelect]);

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <span style={styles.title}>Search Spaces</span>
        <button
          style={styles.expandButton}
          onClick={() => setIsExpanded(!isExpanded)}
          title={isExpanded ? 'Collapse' : 'Expand'}
        >
          {isExpanded ? '▼' : '▶'}
        </button>
      </div>

      {isExpanded && (
        <div style={styles.content}>
          {/* Search input */}
          <div style={styles.searchBox}>
            <span style={styles.searchIcon}>🔍</span>
            <input
              type="text"
              placeholder="Search by name or ID..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={styles.searchInput}
            />
            {searchQuery && (
              <button
                style={styles.clearButton}
                onClick={() => setSearchQuery('')}
              >
                ×
              </button>
            )}
          </div>

          {/* Type filter */}
          <div style={styles.filterRow}>
            <span style={styles.filterLabel}>Type:</span>
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              style={styles.filterSelect}
            >
              {spaceTypes.map(type => (
                <option key={type} value={type}>
                  {type === 'all' ? 'All Types' : type.charAt(0).toUpperCase() + type.slice(1)}
                </option>
              ))}
            </select>
          </div>

          {/* Results count */}
          <div style={styles.resultsCount}>
            {filteredSpaces.length} of {spaces.length} spaces
          </div>

          {/* Results list */}
          <div style={styles.resultsList}>
            {filteredSpaces.slice(0, 20).map(space => (
              <div
                key={space.id}
                style={{
                  ...styles.resultItem,
                  ...(space.id === selectedSpaceId ? styles.resultItemSelected : {}),
                }}
                onClick={() => handleSpaceClick(space)}
              >
                <div
                  style={{
                    ...styles.typeIndicator,
                    backgroundColor: spaceTypeColors[space.type.split('_')[0]] || '#6c6c80',
                  }}
                />
                <div style={styles.resultInfo}>
                  <div style={styles.resultName}>{space.name}</div>
                  <div style={styles.resultMeta}>
                    Floor {space.floor_index >= 0 ? '+' : ''}{space.floor_index} • {space.actual_area_sf.toFixed(0)} SF
                  </div>
                </div>
              </div>
            ))}
            {filteredSpaces.length > 20 && (
              <div style={styles.moreResults}>
                +{filteredSpaces.length - 20} more results
              </div>
            )}
            {filteredSpaces.length === 0 && (
              <div style={styles.noResults}>
                No spaces found
              </div>
            )}
          </div>
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
    marginBottom: '12px',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '10px 12px',
    background: '#2d2d3f',
    cursor: 'pointer',
  },
  title: {
    fontSize: '12px',
    fontWeight: 600,
    color: '#fff',
  },
  expandButton: {
    background: 'none',
    border: 'none',
    color: '#a0a0b0',
    cursor: 'pointer',
    fontSize: '10px',
    padding: '4px',
  },
  content: {
    padding: '12px',
  },
  searchBox: {
    display: 'flex',
    alignItems: 'center',
    background: '#2d2d3f',
    borderRadius: '6px',
    padding: '8px 10px',
    marginBottom: '10px',
    border: '1px solid #3a3a4a',
  },
  searchIcon: {
    marginRight: '8px',
    fontSize: '12px',
  },
  searchInput: {
    flex: 1,
    background: 'transparent',
    border: 'none',
    outline: 'none',
    color: '#fff',
    fontSize: '12px',
  },
  clearButton: {
    background: 'none',
    border: 'none',
    color: '#a0a0b0',
    cursor: 'pointer',
    fontSize: '14px',
    padding: '0 4px',
  },
  filterRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    marginBottom: '10px',
  },
  filterLabel: {
    fontSize: '11px',
    color: '#a0a0b0',
  },
  filterSelect: {
    flex: 1,
    background: '#2d2d3f',
    border: '1px solid #3a3a4a',
    borderRadius: '4px',
    color: '#fff',
    fontSize: '11px',
    padding: '4px 8px',
    cursor: 'pointer',
  },
  resultsCount: {
    fontSize: '10px',
    color: '#6c6c80',
    marginBottom: '8px',
  },
  resultsList: {
    maxHeight: '200px',
    overflowY: 'auto',
  },
  resultItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    padding: '8px 10px',
    borderRadius: '6px',
    cursor: 'pointer',
    transition: 'background 0.15s ease',
    marginBottom: '4px',
  },
  resultItemSelected: {
    background: 'rgba(124, 58, 237, 0.2)',
    border: '1px solid #7c3aed',
  },
  typeIndicator: {
    width: '10px',
    height: '10px',
    borderRadius: '50%',
    flexShrink: 0,
  },
  resultInfo: {
    flex: 1,
    minWidth: 0,
  },
  resultName: {
    fontSize: '11px',
    color: '#fff',
    fontWeight: 500,
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  resultMeta: {
    fontSize: '10px',
    color: '#6c6c80',
    marginTop: '2px',
  },
  moreResults: {
    fontSize: '10px',
    color: '#6c6c80',
    textAlign: 'center',
    padding: '8px',
    fontStyle: 'italic',
  },
  noResults: {
    fontSize: '11px',
    color: '#6c6c80',
    textAlign: 'center',
    padding: '16px',
  },
};

export default SpaceSearch;
