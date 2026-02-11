import React from 'react';
import './ProductionLandingPage.css';

/**
 * ProductionLandingPage - Main landing page for matchleague.org (production)
 * Shows "Coming Soon" message with link to test instance
 */
export default function ProductionLandingPage() {
  return (
    <div className="prod-landing">
      <div className="prod-stars"></div>
      <div className="prod-stars2"></div>
      <div className="prod-stars3"></div>
      
      <div className="prod-content">
        <div className="prod-logo">
          <div className="prod-logo-icon">🎾</div>
          <h1>Match League</h1>
        </div>

        <div className="prod-hero">
          <h2 className="prod-title">Coming Soon</h2>
          <p className="prod-subtitle">
            Die neue Art, Spielpartner zu finden und Matches zu organisieren
          </p>
        </div>

        <div className="prod-features">
          <div className="prod-feature">
            <div className="feature-icon">🔍</div>
            <h3>Match finden</h3>
            <p>Finde Spielpartner in deiner Nähe</p>
          </div>
          <div className="prod-feature">
            <div className="feature-icon">⚡</div>
            <h3>Schnell & Einfach</h3>
            <p>Unkompliziert Termine vereinbaren</p>
          </div>
          <div className="prod-feature">
            <div className="feature-icon">💬</div>
            <h3>Chat & Connect</h3>
            <p>Direkte Kommunikation mit deinen Partnern</p>
          </div>
        </div>

        <div className="prod-cta-section">
          <div className="prod-cta-box">
            <div className="cta-badge">✨ Schon jetzt ausprobieren!</div>
            <h3>Interessiert?</h3>
            <p>
              Registriere dich gerne bei unserer <strong>Test-Instanz</strong> und 
              probiere Match League schon jetzt aus!
            </p>
            <p className="cta-note">
              💡 Deine Daten gehen nicht verloren – bei Go-Live werden sie übertragen.*
            </p>
            <a 
              href="https://test.matchleague.org" 
              className="btn-cta"
              target="_blank"
              rel="noopener noreferrer"
            >
              Zur Test-Instanz →
            </a>
          </div>
        </div>

        <div className="prod-footer">
          <p className="footer-disclaimer">
            * Wir versuchen alles, um deine Daten bei der Migration zu übertragen, 
            können es aber nicht garantieren. Die Test-Instanz ist eine Beta-Version 
            ohne Garantien oder Haftung.
          </p>
          <p className="footer-copyright">
            © 2026 Match League • <a href="mailto:info@matchleague.org">Kontakt</a>
          </p>
        </div>
      </div>
    </div>
  );
}
