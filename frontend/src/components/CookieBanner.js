import React, { useState, useEffect } from 'react';

const CONSENT_KEY = 'ml_cookie_consent';

/**
 * Returns the current consent status: 'granted' | 'denied' | null (not yet decided)
 */
export function getConsentStatus() {
  try {
    return localStorage.getItem(CONSENT_KEY);
  } catch {
    return null;
  }
}

/**
 * Update Google Consent Mode v2 and enable/disable AdSense script
 */
function applyConsent(status) {
  if (typeof window.gtag === 'function') {
    const granted = status === 'granted';
    window.gtag('consent', 'update', {
      ad_storage: granted ? 'granted' : 'denied',
      ad_user_data: granted ? 'granted' : 'denied',
      ad_personalization: granted ? 'granted' : 'denied',
      analytics_storage: granted ? 'granted' : 'denied',
    });
  }

  // Enable/disable AdSense script loading
  const adsScript = document.getElementById('adsense-script');
  if (adsScript) {
    if (status === 'granted') {
      adsScript.style.display = '';
    } else {
      adsScript.style.display = 'none';
    }
  }
}

export default function CookieBanner() {
  const [visible, setVisible] = useState(false);
  const [showDetails, setShowDetails] = useState(false);

  useEffect(() => {
    const stored = getConsentStatus();
    if (stored) {
      applyConsent(stored);
    } else {
      setVisible(true);
    }
  }, []);

  function handleAccept() {
    localStorage.setItem(CONSENT_KEY, 'granted');
    applyConsent('granted');
    setVisible(false);
  }

  function handleDecline() {
    localStorage.setItem(CONSENT_KEY, 'denied');
    applyConsent('denied');
    setVisible(false);
  }

  if (!visible) return null;

  return (
    <div style={styles.overlay}>
      <div style={styles.banner}>
        <div style={styles.text}>
          <strong style={{ fontSize: 16 }}>Cookie-Einstellungen</strong>
          <p style={{ margin: '8px 0 0', fontSize: 13, lineHeight: 1.6 }}>
            Wir verwenden Cookies, um die Plattform zu verbessern und Werbung zu finanzieren.
            Mit „Akzeptieren" stimmst du der Nutzung von Cookies durch uns und unsere Partner
            (u.a. Google AdSense) zu.
          </p>
          {showDetails && (
            <div style={styles.details}>
              <p style={{ margin: '8px 0 4px', fontWeight: 600, fontSize: 13 }}>Was wird gespeichert:</p>
              <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12, lineHeight: 1.8 }}>
                <li><strong>Werbe-Cookies</strong> – Personalisierte Werbung via Google AdSense</li>
                <li><strong>Analyse-Cookies</strong> – Nutzungsstatistiken zur Verbesserung</li>
                <li><strong>Technisch notwendig</strong> – Login, Einstellungen (immer aktiv)</li>
              </ul>
              <p style={{ margin: '8px 0 0', fontSize: 11, color: '#8cbfad' }}>
                Mehr Informationen: <a href="/datenschutz" style={{ color: '#7fd9ba' }}>Datenschutzerklärung</a>
              </p>
            </div>
          )}
        </div>
        <div style={styles.actions}>
          <button
            onClick={() => setShowDetails(!showDetails)}
            style={styles.detailsBtn}
          >
            {showDetails ? 'Weniger' : 'Details'}
          </button>
          <button onClick={handleDecline} style={styles.declineBtn}>
            Ablehnen
          </button>
          <button onClick={handleAccept} style={styles.acceptBtn}>
            Akzeptieren
          </button>
        </div>
      </div>
    </div>
  );
}

const styles = {
  overlay: {
    position: 'fixed',
    bottom: 0,
    left: 0,
    right: 0,
    zIndex: 99999,
    padding: '12px',
    pointerEvents: 'none',
  },
  banner: {
    pointerEvents: 'auto',
    maxWidth: 520,
    margin: '0 auto',
    background: 'rgba(10, 28, 22, 0.97)',
    border: '1px solid rgba(92, 200, 165, 0.25)',
    borderRadius: 16,
    padding: '20px 24px',
    backdropFilter: 'blur(12px)',
    boxShadow: '0 -4px 30px rgba(0,0,0,0.4)',
  },
  text: {
    color: '#d6e8de',
    marginBottom: 16,
  },
  details: {
    marginTop: 12,
    padding: '12px',
    background: 'rgba(32, 74, 58, 0.4)',
    borderRadius: 10,
    color: '#c8d6cd',
  },
  actions: {
    display: 'flex',
    gap: 8,
    justifyContent: 'flex-end',
    flexWrap: 'wrap',
  },
  detailsBtn: {
    background: 'transparent',
    border: '1px solid rgba(92, 200, 165, 0.3)',
    color: '#8cbfad',
    padding: '8px 14px',
    borderRadius: 8,
    fontSize: 13,
    cursor: 'pointer',
    marginRight: 'auto',
  },
  declineBtn: {
    background: 'transparent',
    border: '1px solid rgba(200, 200, 200, 0.2)',
    color: '#9ca3af',
    padding: '8px 16px',
    borderRadius: 8,
    fontSize: 13,
    cursor: 'pointer',
  },
  acceptBtn: {
    background: '#3da87a',
    border: 'none',
    color: '#fff',
    padding: '8px 20px',
    borderRadius: 8,
    fontSize: 13,
    fontWeight: 600,
    cursor: 'pointer',
  },
};
