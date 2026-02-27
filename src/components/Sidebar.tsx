import React, { useState } from 'react';
import type { LatLng } from '../Algorithm/types';

export type AlgorithmType =
  | 'bfs'
  | 'dijkstra'
  | 'bidirectionalBfs'
  | 'aStar'
  | 'alt'
  | 'ch'
  | 'cch';

/** Maximum allowed bounding-box span in degrees (~222 km at equator). */
const MAX_BOX_DEGREES = 2.0;
/** Approximate km per degree of latitude (used for display only). */
const KM_PER_DEGREE = 111;

/** Haversine distance in km between two lat/lng points. */
function haversineKm(a: LatLng, b: LatLng): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((a.lat * Math.PI) / 180) *
      Math.cos((b.lat * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(s), Math.sqrt(1 - s));
}

/** Returns true when the straight-line distance between start and end exceeds the
 *  area limit derived from MAX_BOX_DEGREES (approximately MAX_BOX_DEGREES × KM_PER_DEGREE km). */
function isOutOfRadius(start: LatLng, end: LatLng): boolean {
  return haversineKm(start, end) > MAX_BOX_DEGREES * KM_PER_DEGREE;
}

interface SidebarProps {
  algorithm: AlgorithmType;
  onAlgorithmChange: (alg: AlgorithmType) => void;
  onRun: () => void;
  onClear: () => void;
  canRun: boolean;
  status: string;
  isDark?: boolean;
  isLoading?: boolean;
  startPos?: LatLng | null;
  endPos?: LatLng | null;
  onSetStart?: (pos: LatLng) => void;
  onSetEnd?: (pos: LatLng) => void;
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

/** Geocode a place name via Nominatim and return the first result's lat/lng. */
async function geocodeLocation(query: string): Promise<LatLng | null> {
  const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}`;
  const res = await fetch(url, { headers: { 'Accept-Language': 'en' } });
  const data = await res.json();
  if (data && data.length > 0) {
    return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
  }
  return null;
}

/** A small geocoding search input used for both start and end points. */
function LocationInput({
  label,
  placeholder,
  currentPos,
  isDark,
  textPrimary,
  textSecondary,
  textMuted,
  borderColor,
  inputBg,
  onLocate,
}: {
  label: string;
  placeholder: string;
  currentPos?: LatLng | null;
  isDark: boolean;
  textPrimary: string;
  textSecondary: string;
  textMuted: string;
  borderColor: string;
  inputBg: string;
  onLocate: (pos: LatLng) => void;
}) {
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSearch = async () => {
    if (!query.trim()) return;
    setLoading(true);
    setError('');
    try {
      const pos = await geocodeLocation(query);
      if (pos) {
        onLocate(pos);
        setError('');
      } else {
        setError('Location not found');
      }
    } catch {
      setError('Search failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <span style={{ fontSize: 12, fontWeight: 600, color: textPrimary }}>{label}</span>
      <div style={{ display: 'flex', gap: 4 }}>
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
          placeholder={placeholder}
          style={{
            flex: 1,
            padding: '5px 8px',
            borderRadius: 5,
            border: `1px solid ${borderColor}`,
            fontSize: 12,
            outline: 'none',
            background: inputBg,
            color: textSecondary,
          }}
        />
        <button
          onClick={handleSearch}
          disabled={loading}
          style={{
            padding: '5px 10px',
            borderRadius: 5,
            border: 'none',
            background: '#2563eb',
            color: 'white',
            cursor: loading ? 'not-allowed' : 'pointer',
            fontSize: 12,
            fontWeight: 600,
            flexShrink: 0,
          }}
        >
          {loading ? '…' : 'Go'}
        </button>
      </div>
      {error && <span style={{ fontSize: 11, color: '#dc2626' }}>{error}</span>}
      {currentPos && !error && (
        <span style={{ fontSize: 10, color: textMuted }}>
          {currentPos.lat.toFixed(5)}, {currentPos.lng.toFixed(5)}
        </span>
      )}
    </div>
  );
}

const Sidebar: React.FC<SidebarProps> = ({
  algorithm,
  onAlgorithmChange,
  onRun,
  onClear,
  canRun,
  status,
  isDark = false,
  isLoading = false,
  startPos,
  endPos,
  onSetStart,
  onSetEnd,
}) => {
  const bg = isDark ? '#1e293b' : '#ffffff';
  const textPrimary = isDark ? '#e2e8f0' : '#1e3a5f';
  const textSecondary = isDark ? '#cbd5e1' : '#374151';
  const textMuted = isDark ? '#94a3b8' : '#6b7280';
  const borderColor = isDark ? '#334155' : '#d1d5db';
  const statusBg = isDark ? '#0f172a' : '#f3f4f6';
  const inputBg = isDark ? '#0f172a' : '#ffffff';

  // Check if end point is outside the allowed radius from start point
  const radiusWarning =
    startPos && endPos && isOutOfRadius(startPos, endPos)
      ? `⚠️ End point is too far from start (~${Math.round(haversineKm(startPos, endPos))} km). Please choose points within ~${Math.round(MAX_BOX_DEGREES * KM_PER_DEGREE)} km.`
      : null;

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

      {/* Location inputs */}
      {(onSetStart || onSetEnd) && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: textPrimary, transition: 'color 0.4s ease' }}>
            Points
          </h3>
          {onSetStart && (
            <LocationInput
              label="🟢 Start point"
              placeholder="Search start location…"
              currentPos={startPos}
              isDark={isDark}
              textPrimary={textPrimary}
              textSecondary={textSecondary}
              textMuted={textMuted}
              borderColor={borderColor}
              inputBg={inputBg}
              onLocate={onSetStart}
            />
          )}
          {onSetEnd && (
            <LocationInput
              label="🔴 End point"
              placeholder="Search end location…"
              currentPos={endPos}
              isDark={isDark}
              textPrimary={textPrimary}
              textSecondary={textSecondary}
              textMuted={textMuted}
              borderColor={borderColor}
              inputBg={inputBg}
              onLocate={onSetEnd}
            />
          )}
          {radiusWarning && (
            <div style={{
              fontSize: 11,
              color: '#b45309',
              background: isDark ? '#292524' : '#fef3c7',
              borderRadius: 5,
              padding: '5px 7px',
              wordBreak: 'break-word',
            }}>
              {radiusWarning}
            </div>
          )}
        </div>
      )}

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
