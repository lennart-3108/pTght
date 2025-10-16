import React from 'react';

function Counter({ 
  value, 
  onChange, 
  min = 0, 
  max = Infinity, 
  step = 1, 
  disabled = false, 
  className = "",
  style = {},
  showValue = true,
  formatValue = (val) => val
}) {
  const handleIncrement = () => {
    const newValue = Math.min(max, value + step);
    if (newValue !== value) {
      onChange(newValue);
    }
  };

  const handleDecrement = () => {
    const newValue = Math.max(min, value - step);
    if (newValue !== value) {
      onChange(newValue);
    }
  };

  const canIncrement = !disabled && value < max;
  const canDecrement = !disabled && value > min;

  const defaultStyle = {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    ...style
  };

  const buttonStyle = {
    width: '32px',
    height: '32px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: '8px',
    border: '1px solid #26493c',
    background: '#1b4b3d',
    color: '#fff',
    fontSize: '18px',
    fontWeight: 'bold',
    cursor: 'pointer',
    userSelect: 'none',
    transition: 'all 0.2s ease'
  };

  const disabledButtonStyle = {
    ...buttonStyle,
    background: '#24463c',
    color: '#666',
    cursor: 'not-allowed'
  };

  const valueStyle = {
    minWidth: '40px',
    textAlign: 'center',
    fontSize: '18px',
    fontWeight: 'bold',
    color: '#e8efe8'
  };

  return (
    <div className={className} style={defaultStyle}>
      <button
        type="button"
        onClick={handleDecrement}
        disabled={!canDecrement}
        style={canDecrement ? buttonStyle : disabledButtonStyle}
        aria-label="Verringern"
      >
        −
      </button>
      {showValue && (
        <div style={valueStyle}>
          {formatValue(value)}
        </div>
      )}
      <button
        type="button"
        onClick={handleIncrement}
        disabled={!canIncrement}
        style={canIncrement ? buttonStyle : disabledButtonStyle}
        aria-label="Erhöhen"
      >
        +
      </button>
    </div>
  );
}

export default Counter;