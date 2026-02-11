import React from 'react';
import './TestInstanceDisclaimer.css';

/**
 * TestInstanceDisclaimer - Shown during registration on test instance
 * Informs users about test data, no liability, and planned data migration
 */
export default function TestInstanceDisclaimer({ onAccept, onDecline }) {
  const [accepted, setAccepted] = React.useState(false);

  const handleAccept = () => {
    if (!accepted) return;
    onAccept && onAccept();
  };

  return (
    <div className="test-disclaimer-modal">
      <div className="test-disclaimer-content">
        <div className="test-disclaimer-header">
          <div className="test-badge">⚠️ Test-Instanz</div>
          <h2>Wichtige Hinweise zur Registrierung</h2>
        </div>

        <div className="test-disclaimer-body">
          <div className="disclaimer-section">
            <div className="disclaimer-icon">🧪</div>
            <div>
              <h3>Test-Umgebung</h3>
              <p>
                Du registrierst dich auf einer <strong>Test-Instanz</strong> von Match League. 
                Diese Version dient zum Testen und Ausprobieren der Plattform.
              </p>
            </div>
          </div>

          <div className="disclaimer-section">
            <div className="disclaimer-icon">⚡</div>
            <div>
              <h3>Keine Garantien</h3>
              <p>
                Wir übernehmen <strong>keine Haftung</strong> für:
              </p>
              <ul>
                <li>Datenverlust oder -beschädigung</li>
                <li>Ausfall oder Nichtverfügbarkeit der Test-Instanz</li>
                <li>Fehler, Bugs oder unerwartetes Verhalten</li>
                <li>Sicherheit oder Vertraulichkeit deiner Daten</li>
              </ul>
            </div>
          </div>

          <div className="disclaimer-section">
            <div className="disclaimer-icon">🚀</div>
            <div>
              <h3>Daten-Migration bei Go-Live</h3>
              <p>
                Bei der Einführung der Production-Version werden wir <strong>unser Bestes versuchen</strong>, 
                deine Daten zu übertragen. Eine Garantie können wir jedoch <strong>nicht geben</strong>.
              </p>
              <p className="disclaimer-note">
                💡 Gib daher bitte keine sensiblen oder kritischen Daten ein.
              </p>
            </div>
          </div>

          <div className="disclaimer-section highlight">
            <div className="disclaimer-icon">🎮</div>
            <div>
              <h3>Viel Spaß beim Matchen!</h3>
              <p>
                Trotz Test-Status - genieße die Plattform, finde Spielpartner und 
                hilf uns mit deinem Feedback, Match League noch besser zu machen!
              </p>
            </div>
          </div>
        </div>

        <div className="test-disclaimer-footer">
          <label className="disclaimer-checkbox">
            <input 
              type="checkbox" 
              checked={accepted} 
              onChange={(e) => setAccepted(e.target.checked)}
            />
            <span>
              Ich habe die Hinweise gelesen und akzeptiere, dass dies eine Test-Umgebung 
              ohne Garantien ist.
            </span>
          </label>

          <div className="disclaimer-buttons">
            <button 
              className="btn-decline" 
              onClick={onDecline}
              type="button"
            >
              Abbrechen
            </button>
            <button 
              className="btn-accept" 
              onClick={handleAccept}
              disabled={!accepted}
              type="button"
            >
              Akzeptieren & Fortfahren
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
