import React, { useState } from 'react';

interface SearchBarProps {
  onLocationFound: (lat: number, lng: number) => void;
  isDark?: boolean;
}

const SearchBar: React.FC<SearchBarProps> = ({ onLocationFound, isDark = false }) => {
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const bg = isDark ? '#1e293b' : '#ffffff';
  const textColor = isDark ? '#e2e8f0' : '#374151';
  const inputBg = isDark ? '#0f172a' : '#ffffff';
  const borderColor = isDark ? '#334155' : '#d1d5db';
  const mutedColor = isDark ? '#94a3b8' : '#6b7280';

  const handleSearch = async () => {
    if (!query.trim()) return;
    setLoading(true);
    setError('');
    try {
      const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}`;
      const res = await fetch(url, { headers: { 'Accept-Language': 'en' } });
      const data = await res.json();
      if (data && data.length > 0) {
        onLocationFound(parseFloat(data[0].lat), parseFloat(data[0].lon));
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
    <div style={{
      position: 'absolute',
      top: 16,
      left: 16,
      zIndex: 1000,
      background: bg,
      borderRadius: 8,
      boxShadow: isDark ? '0 2px 12px rgba(0,0,0,0.5)' : '0 2px 12px rgba(0,0,0,0.2)',
      padding: '10px 12px',
      display: 'flex',
      flexDirection: 'column',
      gap: 6,
      minWidth: 280,
      transition: 'background 0.5s ease, box-shadow 0.4s ease',
    }}>
      <div style={{ display: 'flex', gap: 6 }}>
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
          placeholder="Search location…"
          style={{
            flex: 1,
            padding: '6px 10px',
            borderRadius: 6,
            border: `1px solid ${borderColor}`,
            fontSize: 14,
            outline: 'none',
            background: inputBg,
            color: textColor,
            transition: 'background 0.4s ease, color 0.4s ease, border-color 0.4s ease',
          }}
        />
        <button
          onClick={handleSearch}
          disabled={loading}
          style={{
            padding: '6px 14px',
            borderRadius: 6,
            border: 'none',
            background: '#2563eb',
            color: 'white',
            cursor: loading ? 'not-allowed' : 'pointer',
            fontSize: 14,
            fontWeight: 600,
          }}
        >
          {loading ? '…' : 'Search'}
        </button>
      </div>
      {error && <span style={{ color: '#dc2626', fontSize: 12 }}>{error}</span>}
      <span style={{ fontSize: 11, color: mutedColor, transition: 'color 0.4s ease' }}>
        Left-click: End&nbsp;&nbsp;|&nbsp;&nbsp;Right-click: Start
      </span>
    </div>
  );
};

export default SearchBar;
