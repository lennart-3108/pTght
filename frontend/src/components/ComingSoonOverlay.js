import React from 'react';
import './ComingSoonOverlay.css';

/**
 * ComingSoonOverlay - Displays a simple diagonal "Coming Soon" emblem
 * over disabled features.
 */
export default function ComingSoonOverlay({ children, message = "Coming Soon" }) {
  return (
    <div className="coming-soon-wrapper">
      <div className="coming-soon-overlay">
        <div className="coming-soon-ribbon">{message}</div>
      </div>
      <div className="coming-soon-content">
        {children}
      </div>
    </div>
  );
}
