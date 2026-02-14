import React from 'react';
import './ProductionWorkInProgress.css';

export default function ProductionLandingPage() {
  return (
    <div className="prod-landing">
      <div className="prod-container">
        <div className="prod-content">
          <div className="prod-logo">
            <h1>Match League</h1>
          </div>

          <div className="prod-message">
            <h2>Work in Progress</h2>
            <p className="prod-subtitle">
              Wir bauen Match League gerade weiter aus.
            </p>

            <div className="prod-cta">
              <p className="prod-info">Hier entsteht gerade die finale Produktversion.</p>
              <p className="prod-info">Kein Grund nervös zu sein: Du kannst schon jetzt auf der Test-Instanz starten.</p>
              <a href="https://test.matchleague.org" className="prod-button">
                Zur Test-Instanz
              </a>
              <p className="prod-note">
                Wenn du dort Test-User wirst, übernehmen wir dein Profil und deine Daten in die finale Version — nichts geht verloren.
              </p>
            </div>
          </div>

          <div className="prod-footer">
            <p>Connect. Match. Win.</p>
            <p className="prod-version">Version 2026 • Work in Progress</p>
          </div>
        </div>
      </div>
    </div>
  );
}
