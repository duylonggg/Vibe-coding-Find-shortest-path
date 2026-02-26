import React from 'react';

interface ProgressSliderProps {
  steps: number;
  currentStep: number;
  onStepChange: (step: number) => void;
}

const ProgressSlider: React.FC<ProgressSliderProps> = ({ steps, currentStep, onStepChange }) => {
  if (steps === 0) return null;

  return (
    <div style={{
      position: 'absolute',
      top: 16,
      left: '50%',
      transform: 'translateX(-50%)',
      zIndex: 1000,
      background: 'white',
      borderRadius: 8,
      boxShadow: '0 2px 12px rgba(0,0,0,0.2)',
      padding: '10px 18px',
      minWidth: 340,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: 6,
    }}>
      <span style={{ fontSize: 13, fontWeight: 600, color: '#1e3a5f' }}>
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
