import React from 'react';

interface DarkModeToggleProps {
  isDark: boolean;
  onToggle: () => void;
}

const DarkModeToggle: React.FC<DarkModeToggleProps> = ({ isDark, onToggle }) => {
  return (
    <button
      onClick={onToggle}
      title={isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
      aria-label={isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
      className="dark-mode-toggle"
      style={{
        position: 'fixed',
        top: 16,
        right: 16,
        zIndex: 9999,
        width: 48,
        height: 48,
        borderRadius: '50%',
        border: 'none',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: 22,
        boxShadow: isDark
          ? '0 2px 12px rgba(0,0,0,0.5)'
          : '0 2px 12px rgba(0,0,0,0.2)',
        background: isDark ? '#1e293b' : '#ffffff',
        transition: 'background 0.5s ease, box-shadow 0.4s ease',
        padding: 0,
      }}
    >
      <span className={`toggle-icon ${isDark ? 'dark' : 'light'}`}>
        {isDark ? '🌙' : '☀️'}
      </span>
    </button>
  );
};

export default DarkModeToggle;
