import React from 'react';
import Counter from './Counter';

function TimeCounter({ hours, minutes, onHoursChange, onMinutesChange, disabled = false }) {
  const formatHours = (h) => String(h).padStart(2, '0');
  const formatMinutes = (m) => String(m).padStart(2, '0');

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
        <div style={{ fontSize: '14px', color: '#9db', fontWeight: '500' }}>Stunden</div>
        <Counter
          value={hours}
          onChange={onHoursChange}
          min={0}
          max={23}
          disabled={disabled}
          formatValue={formatHours}
        />
      </div>
      
      <div style={{ 
        fontSize: '24px', 
        fontWeight: 'bold', 
        color: '#9db', 
        marginTop: '20px' 
      }}>
        :
      </div>
      
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
        <div style={{ fontSize: '14px', color: '#9db', fontWeight: '500' }}>Minuten</div>
        <Counter
          value={minutes}
          onChange={onMinutesChange}
          min={0}
          max={59}
          step={15}
          disabled={disabled}
          formatValue={formatMinutes}
        />
      </div>
    </div>
  );
}

export default TimeCounter;