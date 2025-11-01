import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { API_BASE } from "../config";
// large hero logo not currently used here
import smallLogo from "../images/logo.png";
// dynamically load all images from the background folder
function importAllBackgrounds(r) {
  // map to { key, src } so we can sort by filename
  return r.keys().map((k) => ({ key: k.replace(/^\.\//, ''), src: r(k) }));
}
// load all images from sports folder first; fallback to background folder
let backgrounds = [];
try {
  backgrounds = importAllBackgrounds(require.context("../images/sports", false, /\.(png|jpe?g|webp|svg)$/));
} catch (e) {
  try {
    backgrounds = importAllBackgrounds(require.context("../images/background", false, /\.(png|jpe?g|svg)$/));
  } catch {
    backgrounds = [];
  }
}
// sort by optional numeric prefix like `1-name.png` -> lower numbers first; then alpha
backgrounds.sort((a, b) => {
  const re = /^(\d+)-/;
  const ma = a.key.match(re);
  const mb = b.key.match(re);
  if (ma && mb) return Number(ma[1]) - Number(mb[1]);
  if (ma) return -1; // a has prefix -> before b
  if (mb) return 1;  // b has prefix -> before a
  return a.key.localeCompare(b.key);
});

// Hoisted components to avoid remount on each LoginPage re-render
function StatNumber({ value, label }) {
  const [display, setDisplay] = useState(0);
  useEffect(() => {
    if (typeof value !== 'number') return;
    let frame; const start = performance.now(); const duration = 600;
    const from = 0; const to = value;
    function tick(ts) {
      const p = Math.min(1, (ts - start) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      setDisplay(Math.round(from + (to - from) * eased));
      if (p < 1) frame = requestAnimationFrame(tick);
    }
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [value]);
  return (
    <div style={{ padding: '8px 0' }}>
      <div style={{ fontSize: 28, fontWeight: 700, lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>{display}</div>
      <div style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: 1, opacity: 0.75 }}>{label}</div>
    </div>
  );
}

function StatsPanel({ stats, statsLoading, statsError }) {
  if (statsLoading && !stats) return <div style={{ padding: 16 }}>Lade Statistik…</div>;
  if (statsError) return <div style={{ padding: 16, opacity: 0.7 }}>{statsError}</div>;
  if (!stats) return null;
  const items = [
    { key: 'users', label: 'Nutzer', val: stats.users },
    stats.confirmedUsers != null ? { key: 'confirmedUsers', label: 'Bestätigt', val: stats.confirmedUsers } : null,
    { key: 'leagues', label: 'Ligen', val: stats.leagues },
    { key: 'matches', label: 'Matches', val: stats.matches },
    stats.teams != null ? { key: 'teams', label: 'Teams', val: stats.teams } : null,
    stats.teamMembers != null ? { key: 'teamMembers', label: 'Team-Mitglieder', val: stats.teamMembers } : null,
    { key: 'memberships', label: 'Liga-Mitgliedschaften', val: stats.memberships },
    { key: 'sports', label: 'Sportarten', val: stats.sports }
  ].filter(Boolean);
  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit,minmax(110px,1fr))',
      gap: 12,
      padding: 12
    }}>
      {items.map(it => (
        <div key={it.key} style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 10, textAlign: 'center', padding: '12px 8px', backdropFilter: 'blur(6px)' }}>
          <StatNumber value={typeof it.val === 'number' ? it.val : 0} label={it.label} />
        </div>
      ))}
    </div>
  );
}

export default function LoginPage({ setToken, setIsAdminFlag }) {
  const navigate = useNavigate();
  // Login-Form-States
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loginMsg, setLoginMsg] = useState("");
  // Stats
  const [stats, setStats] = useState(null);
  const [statsLoading, setStatsLoading] = useState(false);
  const [statsError, setStatsError] = useState(null);

  // Reset-Form-States
  const [showReset, setShowReset] = useState(false);
  const [resetUsername, setResetUsername] = useState("");
  const [resetPassword, setResetPassword] = useState("");
  const [resetMsg, setResetMsg] = useState("");

  const API = (typeof API_BASE === 'string' && API_BASE.trim()) ? API_BASE : '/api';

  // Login-Handler (hier an dein Backend anpassen!)
  const handleLogin = async (e) => {
    e.preventDefault();
    setLoginMsg("");
    try {
      const res = await fetch(`${API}/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setLoginMsg(data.error || "Login fehlgeschlagen.");
        return;
      }
      // Erfolg: Backend liefert { token, is_admin }
      localStorage.setItem("token", data.token);
      localStorage.setItem("is_admin", data.is_admin ? "1" : "0");
      setToken(data.token);
      setIsAdminFlag(!!data.is_admin);
      setLoginMsg("✅ Login erfolgreich!");
      // Banner-Flags für App setzen und anschließend weiterleiten
      sessionStorage.setItem("loginSuccessAt", new Date().toISOString());
      sessionStorage.setItem("loginEmail", email);
      
      // Request location permission and send to backend
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          async (position) => {
            const { latitude, longitude } = position.coords;
            try {
              await fetch(`${API}/me`, {
                method: "PUT",
                headers: {
                  "Content-Type": "application/json",
                  "Authorization": `Bearer ${data.token}`
                },
                body: JSON.stringify({ latitude, longitude })
              });
              console.log('Location updated:', { latitude, longitude });
            } catch (err) {
              console.warn('Failed to update location:', err);
            }
          },
          (error) => {
            console.warn('Geolocation permission denied or unavailable:', error);
          },
          { enableHighAccuracy: false, timeout: 5000, maximumAge: 0 }
        );
      }
      
      navigate("/");
    } catch {
      setLoginMsg("Server nicht erreichbar.");
    }
  };

  // Reset-Handler (hier an dein Backend anpassen!)
  const handleReset = async (e) => {
    e.preventDefault();
    setResetMsg("");
    try {
      const response = await fetch(`${API}/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: resetUsername,
          password: resetPassword,
        }),
      });
      const data = await response.json();
      if (data.success) {
        setResetMsg("✅ Passwort erfolgreich geändert!");
      } else {
        setResetMsg(data.error || "Fehler beim Zurücksetzen.");
      }
    } catch {
      setResetMsg("Server nicht erreichbar.");
    }
  };

  // (legacy color constants removed after layout redesign)

  // hero carousel state (use all images in the background folder)
  // slides: array of image URLs (use sorted backgrounds)
  const slides = backgrounds.map(b => b.src);
  const [index, setIndex] = useState(0);
  React.useEffect(() => {
    if (!slides.length) return;
    const t = setInterval(() => setIndex(i => (i + 1) % slides.length), 5000);
    return () => clearInterval(t);
  }, [slides.length]);

  // Load public stats einmalig pro Mount (kein Auto-Refresh)
  // Hinweis: In React 18 StrictMode wird useEffect in Dev doppelt aufgerufen.
  // Wir erlauben den zweiten Aufruf (unschädlich), statt ihn mit einer Ref zu blocken,
  // damit der Ladezustand nicht hängen bleibt.
  useEffect(() => {
    let cancelled = false;
    async function loadStats() {
      setStatsLoading(true); setStatsError(null);
      try {
        const resp = await fetch(`${API}/public/stats`);
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        const data = await resp.json();
        if (!cancelled) setStats(data);
      } catch (e) {
        if (!cancelled) setStatsError('keine Statistik verfügbar');
      } finally {
        if (!cancelled) setStatsLoading(false);
      }
    }
    loadStats();
    return () => { cancelled = true; };
  }, [API]);

  

  return (
    <div>
      <section className="hero-carousel">
        {slides.map((s, i) => (
          <div key={i} className={`hero-slide ${i === index ? 'active' : ''}`} style={{ backgroundImage: `url(${s})` }} />
        ))}

        <div className="hero-overlay">
          <div className="hero-stripe">
            <img src={smallLogo} alt="ML" className="hero-small-logo" />
            <h1 className="hero-title" style={{ fontWeight: 700 }}>Match League</h1>
          </div>
          <p className="hero-sub" style={{ color: '#ffffffff', fontWeight: 700 }}>Connect. Match. Win.</p>
        </div>
      </section>

      <div style={{ textAlign: 'center', margin: '20px 0' }}>
        <h2 style={{ color: '#e6efe6', fontWeight: 700 }}>Willkommen bei Match League</h2>
        <p>
        <b>MatchLeague</b> ist deine Plattform für Ligen, Sportarten und Community-Wettbewerbe.<br />
      </p>
      <p>     </p>
      </div>

      <div style={{
        maxWidth: 600,
        margin: '20px auto 60px',
        padding: '32px 36px',
        borderRadius: 20,
        background: 'linear-gradient(135deg,#071716,#0d2422)',
        border: '1px solid rgba(255,255,255,0.08)',
        boxShadow: '0 8px 32px -8px rgba(0,0,0,0.4), 0 2px 6px rgba(0,0,0,0.3)',
        position: 'relative',
        overflow: 'hidden'
      }}>
        <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', background: 'radial-gradient(circle at 85% 20%, rgba(72,186,170,0.15), transparent 60%)' }} />
        <div style={{ position: 'relative' }}>
          <h2 style={{ fontWeight: 700, marginTop: 0 }}>Login</h2>
        {/* Login-Formular */}
        <form onSubmit={handleLogin}>
          <input
            type="email"
            placeholder="E-Mail"
            value={email}
            onChange={e => setEmail(e.target.value)}
            required
            autoComplete="email"
            style={{ display: "block", marginBottom: 8, width: "100%", background: '#fafcf9', border: '1px solid rgba(0,0,0,0.12)', padding: '8px' }}
          />
          <input
            type="password"
            placeholder="Passwort"
            value={password}
            onChange={e => setPassword(e.target.value)}
            required
            autoComplete="current-password"
            style={{ display: "block", marginBottom: 8, width: "100%", background: '#fafcf9', border: '1px solid rgba(0,0,0,0.12)', padding: '8px' }}
          />
          <button type="submit" className="btn btn-primary" style={{ width: "100%", fontWeight: 700 }}>Login</button>
          {loginMsg && <div style={{ marginTop: 8 }}>{loginMsg}</div>}
        </form>

        {/* Passwort vergessen Button */}
        <button
          onClick={() => setShowReset((s) => !s)}
          className="btn btn-primary"
          style={{ marginTop: 24, width: "100%", fontWeight: 700 }}
          type="button"
        >
          Passwort vergessen?
        </button>

        {/* Register button */}
        <button
          onClick={() => window.location.href = '/register'}
          className="btn btn-gold"
          style={{ marginTop: 12, width: "100%", fontWeight: 700 }}
          type="button"
        >
          Registrieren
        </button>

        {/* Reset-Formular */}
        {showReset && (
          <form
            onSubmit={handleReset}
            style={{ marginTop: 16, border: "1px solid #eee", padding: 16, borderRadius: 8 }}
          >
            <h4 style={{ fontWeight: 700 }}>Passwort zurücksetzen</h4>
            <input
              type="text"
              placeholder="Benutzername oder E-Mail"
              value={resetUsername}
              onChange={e => setResetUsername(e.target.value)}
              required
              autoComplete="username"
              style={{ display: "block", marginBottom: 8, width: "100%" }}
            />
            <input
              type="password"
              placeholder="Neues Passwort"
              value={resetPassword}
              onChange={e => setResetPassword(e.target.value)}
              required
              minLength={6}
              autoComplete="new-password"
              style={{ display: "block", marginBottom: 8, width: "100%" }}
            />
              <button type="submit" className="btn btn-primary" style={{ width: "100%", fontWeight: 700 }}>Zurücksetzen</button>
            {resetMsg && <div style={{ marginTop: 8 }}>{resetMsg}</div>}
          </form>
        )}

        {/* Community Statistik */}
        <div style={{ marginTop: 40, paddingTop: 32, borderTop: '1px solid rgba(255,255,255,0.1)' }}>
          <h3 style={{ fontWeight: 700, margin: '0 0 12px' }}>Community Statistik</h3>
          <p style={{ marginTop: 0, lineHeight: 1.4, opacity: 0.85, fontSize: 14 }}>
            Ein schneller Überblick über die Aktivität auf der Plattform – wächst jeden Tag.
          </p>
          <div style={{ border: '1px solid rgba(255,255,255,0.08)', borderRadius: 16, background: 'rgba(255,255,255,0.03)', backdropFilter: 'blur(4px)', overflow: 'hidden' }}>
            <StatsPanel stats={stats} statsLoading={statsLoading} statsError={statsError} />
          </div>
          {stats && stats.generatedAt && (
            <div style={{ marginTop: 8, fontSize: 11, opacity: 0.5 }}>Aktualisiert: {new Date(stats.generatedAt).toLocaleTimeString()}</div>
          )}
        </div>
        </div>
      </div>
    </div>
  );
}


