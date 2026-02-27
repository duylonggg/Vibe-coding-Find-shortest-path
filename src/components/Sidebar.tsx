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
  isDark?: boolean;
  isLoading?: boolean;
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
  isDark = false,
  isLoading = false,
}) => {
  const bg = isDark ? '#1e293b' : '#ffffff';
  const textPrimary = isDark ? '#e2e8f0' : '#1e3a5f';
  const textSecondary = isDark ? '#cbd5e1' : '#374151';
  const textMuted = isDark ? '#94a3b8' : '#6b7280';
  const borderColor = isDark ? '#334155' : '#d1d5db';
  const statusBg = isDark ? '#0f172a' : '#f3f4f6';

  return (
    <div style={{
      position: 'absolute',
      top: 72, // Offset below the dark mode toggle button (48px height + 2×12px margin)
      right: 16,
      zIndex: 1000,
      background: bg,
      borderRadius: 8,
      boxShadow: isDark ? '0 2px 12px rgba(0,0,0,0.5)' : '0 2px 12px rgba(0,0,0,0.2)',
      padding: '16px 18px',
      minWidth: 200,
      display: 'flex',
      flexDirection: 'column',
      gap: 10,
      transition: 'background 0.5s ease, box-shadow 0.4s ease',
    }}>
      <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: textPrimary, transition: 'color 0.4s ease' }}>
        Algorithm
      </h3>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {algorithms.map(({ value, label, description }) => (
          <label key={value} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, cursor: 'pointer', fontSize: 14, color: textSecondary, transition: 'color 0.4s ease' }}>
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
                <span style={{ display: 'block', fontSize: 11, color: textMuted, marginTop: 1, transition: 'color 0.4s ease' }}>{description}</span>
              )}
            </span>
          </label>
        ))}
      </div>

      <button
        onClick={onRun}
        disabled={!canRun || isLoading}
        style={{
          padding: '8px 0',
          borderRadius: 6,
          border: 'none',
          background: canRun && !isLoading ? '#2563eb' : (isDark ? '#1e3a5f' : '#93c5fd'),
          color: 'white',
          cursor: canRun && !isLoading ? 'pointer' : 'not-allowed',
          fontWeight: 700,
          fontSize: 14,
          transition: 'background 0.4s ease',
        }}
      >
        {isLoading ? '⏳ Loading…' : '▶ Run Algorithm'}
      </button>

      <button
        onClick={onClear}
        style={{
          padding: '8px 0',
          borderRadius: 6,
          border: `1px solid ${borderColor}`,
          background: isDark ? '#0f172a' : 'white',
          color: textSecondary,
          cursor: 'pointer',
          fontWeight: 600,
          fontSize: 14,
          transition: 'background 0.4s ease, color 0.4s ease, border-color 0.4s ease',
        }}
      >
        ✕ Clear
      </button>

      {status && (
        <div style={{
          fontSize: 12,
          color: textSecondary,
          background: statusBg,
          borderRadius: 6,
          padding: '6px 8px',
          wordBreak: 'break-word',
          transition: 'background 0.4s ease, color 0.4s ease',
        }}>
          {status}
        </div>
      )}
    </div>
  );
};

export default Sidebar;
