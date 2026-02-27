import React from 'react';

interface ProgressSliderProps {
  steps: number;
  currentStep: number;
  onStepChange: (step: number) => void;
  isDark?: boolean;
}

const ProgressSlider: React.FC<ProgressSliderProps> = ({ steps, currentStep, onStepChange, isDark = false }) => {
  if (steps === 0) return null;

  const bg = isDark ? '#1e293b' : '#ffffff';
  const textColor = isDark ? '#93c5fd' : '#1e3a5f';

  return (
    <div style={{
      position: 'absolute',
      top: 16,
      left: '50%',
      transform: 'translateX(-50%)',
      zIndex: 1000,
      background: bg,
      borderRadius: 8,
      boxShadow: isDark ? '0 2px 12px rgba(0,0,0,0.5)' : '0 2px 12px rgba(0,0,0,0.2)',
      padding: '10px 18px',
      minWidth: 340,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: 6,
      transition: 'background 0.5s ease, box-shadow 0.4s ease',
    }}>
      <span style={{ fontSize: 13, fontWeight: 600, color: textColor, transition: 'color 0.4s ease' }}>
        Step {currentStep + 1} of {steps}
      </span>
      <input
        type="range"
        min={0}
        max={steps - 1}
        value={currentStep}
        onChange={(e) => onStepChange(parseInt(e.target.value, 10))}
        style={{ width: '100%', accentColor: '#2563eb' }}
      />
    </div>
  );
};

export default ProgressSlider;
