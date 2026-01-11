import React from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import matchLeagueLogo from "../images/logo/matchleague_logo_4x4-removebg-preview.png";
import { API_BASE } from "../config";

function useQuery() {
  const { search } = useLocation();
  return React.useMemo(() => new URLSearchParams(search), [search]);
}

export default function WelcomePage({ setToken, setIsAdminFlag }) {
  const q = useQuery();
  const confirmed = q.get("confirmed") === "1";
  const error = q.get("error");
  const token = q.get("token");
  const oneTime = q.get("one_time");
  const isAdmin = q.get("is_admin") === "1";
  const [joinedAnyLeague, setJoinedAnyLeague] = React.useState(null); // null=unknown, true/false known
  const navigate = require('react-router-dom').useNavigate();

  React.useEffect(() => {
    // If an opaque one_time token was provided, exchange it for a JWT (server-side single-use)
    if (oneTime) {
      try {
        (async () => {
          const res = await fetch(`${API_BASE}/auth/exchange-one-time`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ one_time: oneTime })
          });
          if (res.ok) {
            const data = await res.json();
            if (data.token) {
              localStorage.setItem('token', data.token);
              localStorage.setItem('is_admin', data.is_admin ? '1' : '0');
              setToken && setToken(data.token);
              setIsAdminFlag && setIsAdminFlag(!!data.is_admin);
            }
          }
        })();
      } catch (e) {
        // ignore exchange errors; user can still use login
      }
    } else if (token && setToken) {
      try {
        localStorage.setItem('token', token);
        localStorage.setItem('is_admin', isAdmin ? '1' : '0');
        setToken(token);
        setIsAdminFlag && setIsAdminFlag(!!isAdmin);
      } catch (e) {
        // ignore storage errors
      }
    }

    // query membership to figure out CTA text
    (async () => {
      try {
        // prefer token from query, otherwise stored token
        const authToken = token || localStorage.getItem('token');
        const headers = authToken ? { Authorization: `Bearer ${authToken}` } : {};
        const res = await fetch(`${API_BASE}/me/leagues`, { headers });
        if (res.ok) {
          const data = await res.json();
          // backend may return { upcoming, completed } or an array; normalize
          if (Array.isArray(data)) setJoinedAnyLeague(data.length > 0);
          else if (Array.isArray(data.upcoming) || Array.isArray(data.completed)) setJoinedAnyLeague(((data.upcoming||[]).length + (data.completed||[]).length) > 0);
          else setJoinedAnyLeague(false);
        } else if (res.status === 401) {
          // not logged in
          setJoinedAnyLeague(false);
        } else {
          setJoinedAnyLeague(false);
        }
      } catch (e) {
        setJoinedAnyLeague(false);
      }
    })();
  }, []); // run once

  const handleContinue = () => {
    // If token was provided assume logged-in state; go to start
    navigate('/');
  };

  // Use a more visibly green (darker) panel so it doesn't read as white
  const panelBg = '#0f2a20ff'; // slightly darker soft green
  const panelBorder = '1px solid rgba(0,0,0,0.08)';
  const btnGreen = 'var(--primary-600)';
  const btnGreenHover = 'var(--primary-600-hover)';

  return (
    <div style={{ maxWidth: 900, margin: '24px auto', padding: 24 }}>
      <div style={{ display: 'flex', gap: 20, alignItems: 'center' }}>
        <img src={matchLeagueLogo} alt="MatchLeague" style={{ width: 160, height: 'auto' }} />
        <div>
          <h1 style={{ margin: 0 }}>Willkommen bei Match League</h1>
        </div>
      </div>

  <div style={{ marginTop: 20, padding: 20, borderRadius: 8, background: panelBg, border: panelBorder, boxShadow: '0 6px 18px rgba(0,0,0,0.06)' }}>
        {confirmed ? (
          <div>
            <h2 style={{ 
              color: '#debc7c', 
              fontSize: 28, 
              fontWeight: 700, 
              marginBottom: 8,
              letterSpacing: '-0.02em'
            }}>
              Schön, dass du da bist!
            </h2>
            
            <div style={{ 
              marginBottom: 24, 
              paddingBottom: 24, 
              borderBottom: '1px solid rgba(255,255,255,0.1)'
            }}>
              <p style={{ 
                color: '#e5e7eb', 
                fontSize: 16, 
                marginBottom: 12,
                lineHeight: 1.6
              }}>
                Match League verbindet Sportler, Teams und Locations – vom spontanen Match bis zur Liga.
              </p>
              <p style={{ 
                color: '#e5e7eb', 
                fontSize: 15,
                lineHeight: 1.6,
                marginBottom: 0
              }}>
                Finde passende Matches, tritt Ligen bei und bleib mit deiner Sport-Community verbunden.
              </p>
            </div>

            <div style={{ 
              background: 'rgba(222, 188, 124, 0.1)', 
              border: '1px solid rgba(222, 188, 124, 0.2)',
              borderRadius: 8,
              padding: 16,
              marginBottom: 24
            }}>
              <p style={{ 
                color: '#debc7c', 
                fontSize: 16, 
                fontWeight: 600,
                marginBottom: 6,
                display: 'flex',
                alignItems: 'center',
                gap: 8
              }}>
                <span style={{ fontSize: 20 }}>✓</span> Dein Konto ist jetzt aktiv
              </p>
              <p style={{ 
                color: '#e5e7eb', 
                fontSize: 14,
                marginBottom: 0,
                lineHeight: 1.5
              }}>
                Du kannst direkt loslegen und dein nächstes Spiel starten.
              </p>
            </div>

            <div>
              <button 
                onClick={handleContinue} 
                className="btn-gold" 
                style={{ 
                  padding: '12px 32px', 
                  fontSize: 16, 
                  fontWeight: 700 
                }}
              >
                Los geht's
              </button>
            </div>
          </div>
        ) : (
          <div>
            <h2 style={{ color: error ? '#ef4444' : '#e5e7eb' }}>{error ? 'Fehler bei der Bestätigung' : 'Fast fertig'}</h2>
            {error ? (
              <p style={{ color: '#9ca3af' }}>Der Bestätigungslink ist ungültig oder abgelaufen. Bitte fordere eine neue Bestätigungs-Mail an oder kontaktiere den Support.</p>
            ) : (
              <p style={{ color: '#9ca3af' }}>Bitte bestätige deine E-Mail-Adresse. Prüfe ggf. den Spam-Ordner.</p>
            )}
            <div style={{ marginTop: 12 }}>
              <Link to="/login"><button style={{ marginRight: 8, background: btnGreen, color: '#fff', padding: '10px 14px', borderRadius: 10, border: 'none', cursor: 'pointer' }}>Zum Login</button></Link>
              <Link to="/register"><button style={{ background: btnGreen, color: '#fff', padding: '10px 14px', borderRadius: 10, border: 'none', cursor: 'pointer' }}>Registrieren</button></Link>
            </div>
          </div>
        )}

        {/* CTA when user isn't member of a league removed per request */}
      </div>
    </div>
  );
}
