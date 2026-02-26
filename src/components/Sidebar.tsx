import React from 'react';

export type AlgorithmType =
  | 'bfs'
  | 'dijkstra'
  | 'bidirectionalBfs'
  | 'aStar'
  | 'alt'
  | 'ch'
  | 'cch';

interface SidebarProps {
  algorithm: AlgorithmType;
  onAlgorithmChange: (alg: AlgorithmType) => void;
  onRun: () => void;
  onClear: () => void;
  canRun: boolean;
  status: string;
}

const algorithms: { value: AlgorithmType; label: string; description: string }[] = [
  { value: 'bfs',             label: 'BFS',                             description: 'Breadth-First Search – explores equally in all directions' },
  { value: 'dijkstra',        label: 'Dijkstra',                        description: "Dijkstra's algorithm – optimal for weighted graphs" },
  { value: 'bidirectionalBfs',label: 'Bidirectional BFS',               description: 'BFS from both ends simultaneously' },
  { value: 'aStar',           label: 'A*',                              description: 'A* – guided by a geographic heuristic' },
  { value: 'alt',             label: 'ALT (A* + Landmarks)',            description: 'A* with Landmarks & Triangle Inequality – tighter lower bounds than plain A*' },
  { value: 'ch',              label: 'Contraction Hierarchies (CH)',    description: 'Preprocesses node importance; fast bidirectional Dijkstra on contracted graph' },
  { value: 'cch',             label: 'Customizable CH (CCH)',           description: 'Topology-only preprocessing + fast metric customization; ideal for dynamic weights' },
];

const Sidebar: React.FC<SidebarProps> = ({
  algorithm,
  onAlgorithmChange,
  onRun,
  onClear,
  canRun,
  status,
}) => {
  return (
    <div style={{
      position: 'absolute',
      top: 16,
      right: 16,
      zIndex: 1000,
      background: 'white',
      borderRadius: 8,
      boxShadow: '0 2px 12px rgba(0,0,0,0.2)',
      padding: '16px 18px',
      minWidth: 200,
      display: 'flex',
      flexDirection: 'column',
      gap: 10,
    }}>
      <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: '#1e3a5f' }}>
        Algorithm
      </h3>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {algorithms.map(({ value, label, description }) => (
          <label key={value} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, cursor: 'pointer', fontSize: 14 }}>
            <input
              type="radio"
              name="algorithm"
              value={value}
              checked={algorithm === value}
              onChange={() => onAlgorithmChange(value)}
              style={{ accentColor: '#2563eb', marginTop: 3, flexShrink: 0 }}
            />
            <span>
              <span style={{ fontWeight: algorithm === value ? 700 : 400 }}>{label}</span>
              {algorithm === value && (
                <span style={{ display: 'block', fontSize: 11, color: '#6b7280', marginTop: 1 }}>{description}</span>
              )}
            </span>
          </label>
        ))}
      </div>

      <button
        onClick={onRun}
        disabled={!canRun}
        style={{
          padding: '8px 0',
          borderRadius: 6,
          border: 'none',
          background: canRun ? '#2563eb' : '#93c5fd',
          color: 'white',
          cursor: canRun ? 'pointer' : 'not-allowed',
          fontWeight: 700,
          fontSize: 14,
        }}
      >
        ▶ Run Algorithm
      </button>

      <button
        onClick={onClear}
        style={{
          padding: '8px 0',
          borderRadius: 6,
          border: '1px solid #d1d5db',
          background: 'white',
          color: '#374151',
          cursor: 'pointer',
          fontWeight: 600,
          fontSize: 14,
        }}
      >
        ✕ Clear
      </button>

      {status && (
        <div style={{
          fontSize: 12,
          color: '#374151',
          background: '#f3f4f6',
          borderRadius: 6,
          padding: '6px 8px',
          wordBreak: 'break-word',
        }}>
          {status}
        </div>
      )}
    </div>
  );
};

export default Sidebar;
