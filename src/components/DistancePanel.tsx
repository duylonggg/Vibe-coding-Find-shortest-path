import React from 'react';

export interface RouteInfo {
  label: string;
  distanceKm: number;
  algorithmName: string;
}

interface DistancePanelProps {
  routes: RouteInfo[];
  activeIndex: number;
  onSelectRoute: (index: number) => void;
  isDark?: boolean;
}

/** Format a distance in km to 1 or 2 decimal places depending on magnitude. */
function formatKm(km: number): string {
  if (km >= 10) return km.toFixed(1);
  return km.toFixed(2);
}

/** Small colour swatch shown next to each route row. */
function RouteColorDot({ color }: { color: string }) {
  return (
    <span
      style={{
        display: 'inline-block',
        width: 10,
        height: 10,
        borderRadius: '50%',
        background: color,
        flexShrink: 0,
        marginRight: 6,
      }}
    />
  );
}

const ROUTE_COLORS = ['#dc2626', '#9333ea', '#9333ea'];

const DistancePanel: React.FC<DistancePanelProps> = ({
  routes,
  activeIndex,
  onSelectRoute,
  isDark = false,
}) => {
  if (routes.length === 0) return null;

  const bg           = isDark ? '#1e293b' : '#ffffff';
  const textPrimary  = isDark ? '#e2e8f0' : '#1e3a5f';
  const textSecondary = isDark ? '#cbd5e1' : '#374151';
  const textMuted    = isDark ? '#94a3b8' : '#6b7280';
  const borderColor  = isDark ? '#334155' : '#d1d5db';
  const activeBg     = isDark ? '#0f2744' : '#eff6ff';
  const activeText   = isDark ? '#93c5fd' : '#1d4ed8';

  return (
    <div
      style={{
        position: 'absolute',
        bottom: 36,
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 1000,
        background: bg,
        borderRadius: 10,
        boxShadow: isDark
          ? '0 4px 20px rgba(0,0,0,0.6)'
          : '0 4px 20px rgba(0,0,0,0.18)',
        padding: '12px 16px',
        minWidth: 260,
        maxWidth: 360,
        display: 'flex',
        flexDirection: 'column',
        gap: 6,
        transition: 'background 0.4s ease',
      }}
    >
      <div
        style={{
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: 0.5,
          textTransform: 'uppercase',
          color: textMuted,
          marginBottom: 2,
        }}
      >
        Routes
      </div>

      {routes.map((route, idx) => {
        const isActive = idx === activeIndex;
        const color = ROUTE_COLORS[idx] ?? '#9333ea';
        return (
          <button
            key={idx}
            onClick={() => onSelectRoute(idx)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 0,
              padding: '7px 10px',
              borderRadius: 7,
              border: isActive
                ? `1.5px solid ${activeText}`
                : `1px solid ${borderColor}`,
              background: isActive ? activeBg : 'transparent',
              cursor: 'pointer',
              textAlign: 'left',
              transition: 'background 0.2s, border-color 0.2s',
              width: '100%',
            }}
          >
            <RouteColorDot color={color} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div
                style={{
                  fontSize: 13,
                  fontWeight: isActive ? 700 : 500,
                  color: isActive ? activeText : textPrimary,
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                {route.label}
              </div>
              <div
                style={{
                  fontSize: 11,
                  color: textSecondary,
                  marginTop: 1,
                }}
              >
                {route.algorithmName}
              </div>
            </div>
            <div
              style={{
                fontSize: 14,
                fontWeight: 700,
                color: isActive ? activeText : textPrimary,
                marginLeft: 10,
                whiteSpace: 'nowrap',
                flexShrink: 0,
              }}
            >
              {formatKm(route.distanceKm)} km
            </div>
          </button>
        );
      })}
    </div>
  );
};

export default DistancePanel;
