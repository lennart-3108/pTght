import React from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import matchLeagueLogo from "../images/matchleague_logo_large.png";
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
  const panelBg = '#c8e0c8'; // slightly darker soft green
  const panelBorder = '1px solid rgba(0,0,0,0.08)';
  const btnGreen = '#0a2221';
  const btnGreenHover = '#0e2f2d';

  return (
    <div style={{ maxWidth: 900, margin: '24px auto', padding: 24 }}>
      <div style={{ display: 'flex', gap: 20, alignItems: 'center' }}>
        <img src={matchLeagueLogo} alt="MatchLeague" style={{ width: 160, height: 'auto' }} />
        <div>
          <h1 style={{ margin: 0 }}>Willkommen bei Match League</h1>
          <p style={{ marginTop: 6, color: '#bfcfc4' }}>Verbinde dich mit Spielern, tritt Ligen bei und verfolge Spiele.</p>
        </div>
      </div>

  <div style={{ marginTop: 20, padding: 20, borderRadius: 8, background: panelBg, border: panelBorder, boxShadow: '0 6px 18px rgba(0,0,0,0.06)' }}>
        {confirmed ? (
          <div>
            <h2 style={{ color: 'green' }}>✅ Registrierung bestätigt</h2>
            <p>Dein Konto wurde erfolgreich bestätigt. Schön, dass du dabei bist!</p>
            <p style={{ color: '#555' }}>Du wirst jetzt eingeloggt und weitergeleitet — drücke "Los geht's", um zur Startseite zu gelangen.</p>
            <div style={{ marginTop: 12 }}>
              <button onClick={handleContinue} style={{ marginRight: 8, background: btnGreen, color: '#fff', padding: '10px 18px', borderRadius: 10, border: 'none', cursor: 'pointer' }} onMouseOver={e => e.currentTarget.style.background = btnGreenHover} onMouseOut={e => e.currentTarget.style.background = btnGreen}>Los geht's</button>
              <Link to="/profile"><button style={{ background: btnGreen, color: '#fff', padding: '10px 18px', borderRadius: 10, border: 'none', cursor: 'pointer' }}>Profil bearbeiten</button></Link>
            </div>
          </div>
        ) : (
          <div>
            <h2 style={{ color: error ? 'crimson' : '#333' }}>{error ? 'Fehler bei der Bestätigung' : 'Fast fertig'}</h2>
            {error ? (
              <p style={{ color: '#555' }}>Der Bestätigungslink ist ungültig oder abgelaufen. Bitte fordere eine neue Bestätigungs-Mail an oder kontaktiere den Support.</p>
            ) : (
              <p style={{ color: '#555' }}>Bitte bestätige deine E-Mail-Adresse. Prüfe ggf. den Spam-Ordner.</p>
            )}
            <div style={{ marginTop: 12 }}>
              <Link to="/login"><button style={{ marginRight: 8, background: btnGreen, color: '#fff', padding: '10px 14px', borderRadius: 10, border: 'none', cursor: 'pointer' }}>Zum Login</button></Link>
              <Link to="/register"><button style={{ background: btnGreen, color: '#fff', padding: '10px 14px', borderRadius: 10, border: 'none', cursor: 'pointer' }}>Registrieren</button></Link>
            </div>
          </div>
        )}

        {/* CTA when user isn't member of a league */}
        <div style={{ marginTop: 20 }}>
          {joinedAnyLeague === null ? (
            <div style={{ color: '#888' }}>Überprüfe deine Mitgliedschaften…</div>
          ) : joinedAnyLeague === false ? (
            // CTA box: use a slightly darker green-tinted surface instead of pure white
            <div style={{ padding: 12, background: '#bfe1bf', borderRadius: 6, border: '1px solid rgba(0,0,0,0.04)' }}>
              <strong style={{ color: '#1f4a1f' }}>Du bist noch in keiner Liga angemeldet.</strong>
              <div style={{ marginTop: 8 }}>
                <Link to="/leagues"><button style={{ background: btnGreen, color: '#fff', padding: '10px 18px', borderRadius: 8, border: 'none', cursor: 'pointer' }}>Alle Ligen ansehen und beitreten</button></Link>
              </div>
            </div>
          ) : (
            <div style={{ color: '#555' }}>Super — du bist bereits Mitglied in mindestens einer Liga. Viel Spaß!</div>
          )}
        </div>
      </div>
    </div>
  );
}
