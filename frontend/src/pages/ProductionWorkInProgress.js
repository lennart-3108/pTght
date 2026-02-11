import React from 'react';
import './ProductionWorkInProgress.css';

export default function ProductionLandingPage() {
  return (
    <div className="prod-landing">
      <div className="prod-container">
        <div className="prod-content">
          {/* Logo */}
          <div className="prod-logo">
            <span className="logo-icon">🎾</span>
            <h1>Match League</h1>
          </div>

          {/* Main Message */}
          <div className="prod-message">
            <h2>Wir sind bald zurück!</h2>
            <p className="prod-subtitle">
              Match League wird gerade optimiert und erweitert.
            </p>
            
            {/* Status Info */}
            <div className="prod-status">
              <div className="status-item">
                <div className="status-icon">🔧</div>
                <div className="status-text">
                  <strong>Entwicklung</strong>
                  <p>Features werden aktiv entwickelt</p>
                </div>
              </div>
              
              <div className="status-item">
                <div className="status-icon">🧪</div>
                <div className="status-text">
                  <strong>Testing</strong>
                  <p>Test-Instanz verfügbar</p>
                </div>
              </div>
              
              <div className="status-item">
                <div className="status-icon">🚀</div>
                <div className="status-text">
                  <strong>Launch</strong>
                  <p>Bald verfügbar</p>
                </div>
              </div>
            </div>

            {/* CTA */}
            <div className="prod-cta">
              <p className="prod-info">
                Interessiert an der Test-Version?
              </p>
              <a href="https://test.matchleague.org" className="prod-button">
                Test-Instanz öffnen
              </a>
              <p className="prod-note">
                🔔 Bleib informiert — folge uns für Updates
              </p>
            </div>
          </div>

          {/* Footer */}
          <div className="prod-footer">
            <p>Connect. Match. Win.</p>
            <p className="prod-version">Version 2026 • Work in Progress</p>
          </div>
        </div>
      </div>
    </div>
  );
}
