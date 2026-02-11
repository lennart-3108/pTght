import React from 'react';
import './ComingSoonOverlay.css';

/**
 * ComingSoonOverlay - Displays a "Coming Soon" overlay over disabled features
 * Used in test instance to hide features that aren't ready yet
 */
export default function ComingSoonOverlay({ children, message = "Coming Soon" }) {
  return (
    <div className="coming-soon-wrapper">
      <div className="coming-soon-overlay">
        <div className="coming-soon-badge">
          <div className="coming-soon-icon">🚀</div>
          <div className="coming-soon-text">{message}</div>
        </div>
      </div>
      <div className="coming-soon-content">
        {children}
      </div>
    </div>
  );
}
