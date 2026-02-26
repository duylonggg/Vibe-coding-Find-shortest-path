import React, { useState } from 'react';

interface SearchBarProps {
  onLocationFound: (lat: number, lng: number) => void;
}

const SearchBar: React.FC<SearchBarProps> = ({ onLocationFound }) => {
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

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
      background: 'white',
      borderRadius: 8,
      boxShadow: '0 2px 12px rgba(0,0,0,0.2)',
      padding: '10px 12px',
      display: 'flex',
      flexDirection: 'column',
      gap: 6,
      minWidth: 280,
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
            border: '1px solid #d1d5db',
            fontSize: 14,
            outline: 'none',
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
      <span style={{ fontSize: 11, color: '#6b7280' }}>
        Left-click: End&nbsp;&nbsp;|&nbsp;&nbsp;Right-click: Start
      </span>
    </div>
  );
};

export default SearchBar;
