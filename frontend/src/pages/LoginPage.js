import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { API_BASE } from "../config";
import AuthNoticeBanner from "../components/AuthNoticeBanner";
// large hero logo not currently used here
import smallLogo from "../images/logo/matchleague_logo_4x4-removebg-preview.png";
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

  // Header visibility state
  const [showHeader, setShowHeader] = useState(true);

  // Reset-Form-States
  const [showReset, setShowReset] = useState(false);
  const [resetUsername, setResetUsername] = useState("");
  const [resetPassword, setResetPassword] = useState("");
  const [resetMsg, setResetMsg] = useState("");

  // Email confirmation popup states
  const [showEmailConfirmPopup, setShowEmailConfirmPopup] = useState(false);
  const [unconfirmedEmail, setUnconfirmedEmail] = useState("");
  const [resendMsg, setResendMsg] = useState("");
  const [resending, setResending] = useState(false);

  // Password reset popup states
  const [showPasswordResetPopup, setShowPasswordResetPopup] = useState(false);
  const [resetEmailSent, setResetEmailSent] = useState(false);
  const [resetError, setResetError] = useState("");
  const [sendingReset, setSendingReset] = useState(false);

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
        // Check if error is "E-Mail noch nicht bestätigt"
        if (data.error === "E-Mail noch nicht bestätigt") {
          setUnconfirmedEmail(email);
          setShowEmailConfirmPopup(true);
          setResendMsg("");
          return;
        }
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

  // Resend confirmation email handler
  const handleResendConfirmation = async () => {
    setResendMsg("");
    setResending(true);
    try {
      const res = await fetch(`${API}/resend-confirmation`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: unconfirmedEmail }),
      });
      const data = await res.json();
      if (data.success) {
        setResendMsg("✅ Bestätigungs-E-Mail wurde erneut versendet!");
      } else {
        // Handle rate limiting with user-friendly message
        if (res.status === 429 || data.error?.includes('Too many') || data.retry_after) {
          const retryMinutes = data.retry_after ? Math.ceil(data.retry_after / 60) : 5;
          setResendMsg(`⏱️ Bitte warte noch ${retryMinutes} Minuten, bevor du die E-Mail erneut anforderst.`);
        } else {
          setResendMsg(data.error || "Fehler beim Versenden der E-Mail.");
        }
      }
    } catch {
      setResendMsg("Server nicht erreichbar.");
    } finally {
      setResending(false);
    }
  };

  // Send password reset email
  const handleSendPasswordReset = async () => {
    setResetError("");
    setSendingReset(true);
    try {
      const res = await fetch(`${API}/forgot-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (data.success) {
        setResetEmailSent(true);
      } else {
        setResetError(data.error || "Fehler beim Versenden der E-Mail.");
      }
    } catch {
      setResetError("Server nicht erreichbar.");
    } finally {
      setSendingReset(false);
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

  // Scroll listener to hide header when user scrolls
  useEffect(() => {
    const handleScroll = () => {
      // Hide header as soon as user starts scrolling, but with smooth transition
      setShowHeader(window.scrollY === 0);
    };

    window.addEventListener('scroll', handleScroll);
    handleScroll(); // Check initial position
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <div>
      <AuthNoticeBanner />
      {/* Header with Login Button */}
      <div style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        height: 60,
        background: 'rgba(7, 23, 22, 0.95)',
        backdropFilter: 'blur(12px)',
        borderBottom: '1px solid rgba(255,255,255,0.08)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'flex-end',
        padding: '0 24px',
        zIndex: 1000,
        opacity: showHeader ? 1 : 0,
        pointerEvents: showHeader ? 'auto' : 'none',
        transition: 'opacity 0.6s ease-out'
      }}>
        <button
          onClick={() => {
            document.getElementById('design-divider')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
          }}
          style={{
            padding: '10px 24px',
            background: 'transparent',
            border: '2px solid #debc7c',
            borderRadius: 8,
            color: '#debc7c',
            fontSize: 15,
            fontWeight: 700,
            cursor: 'pointer',
            transition: 'all 0.2s'
          }}
          onMouseOver={(e) => {
            e.target.style.background = '#debc7c';
            e.target.style.color = '#071716';
          }}
          onMouseOut={(e) => {
            e.target.style.background = 'transparent';
            e.target.style.color = '#debc7c';
          }}
        >
          Login
        </button>
      </div>

      <section className="hero-carousel" style={{ position: 'relative' }}>
        {slides.map((s, i) => (
          <div key={i} className={`hero-slide ${i === index ? 'active' : ''}`} style={{ backgroundImage: `url(${s})` }} />
        ))}

        {/* Übergangs-Element oben (Header zu Bild) */}
        <div style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: 80,
          background: 'linear-gradient(180deg, rgba(7, 23, 22, 1) 0%, rgba(7, 23, 22, 0.8) 30%, rgba(7, 23, 22, 0.3) 60%, transparent 100%)',
          zIndex: 4,
          pointerEvents: 'none'
        }} />

        <div className="hero-overlay">
          <div className="hero-inner" style={{ alignItems: 'flex-start' }}>
            <div className="hero-stripe" style={{ marginLeft: '28%', transform: 'translateX(-50%) skewX(-25deg)' }}>
              <img src={smallLogo} alt="ML" className="hero-small-logo" />
              <h1 className="hero-title" style={{ fontWeight: 700 }}>Match League</h1>
            </div>
            <p className="hero-sub" style={{ color: '#ffffffff', fontWeight: 700, marginLeft: '28%', transform: 'translateX(-50%)', textAlign: 'left' }}>Connect. Match. Win.</p>
          </div>
        </div>

        {/* Übergangs-Overlay unten (15% des Bildes) */}
        <div style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          height: '15%',
          background: 'linear-gradient(180deg, transparent 0%, rgba(5, 15, 13, 0.7) 40%, #050f0d 100%)',
          zIndex: 10
        }} />
      </section>

      {/* Design-Element zwischen Hero und Login */}
      <div id="design-divider" style={{
        height: 180,
        background: 'linear-gradient(180deg, #050f0d 0%, #071716 100%)',
        position: 'relative',
        overflow: 'hidden',
        marginTop: -2,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 32,
        scrollMarginTop: '-5vh'
      }}>
        {/* Linker Strich */}
        <div style={{
          flex: 1,
          maxWidth: 300,
          height: 3,
          background: 'linear-gradient(90deg, transparent, #debc7c)',
          opacity: 0.8
        }} />
        
        {/* Logo in der Mitte */}
        <img 
          src={smallLogo} 
          alt="Match League" 
          style={{
            width: 80,
            height: 80,
            objectFit: 'contain',
            opacity: 0.9,
            filter: 'drop-shadow(0 4px 12px rgba(222, 188, 124, 0.3))'
          }} 
        />

        {/* Rechter Strich */}
        <div style={{
          flex: 1,
          maxWidth: 300,
          height: 3,
          background: 'linear-gradient(90deg, #debc7c, transparent)',
          opacity: 0.8
        }} />
        
        {/* Schattierung unten zum Login-Bereich */}
        <div style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          height: '30%',
          background: 'linear-gradient(180deg, transparent 0%, rgba(7, 23, 22, 0.4) 60%, rgba(7, 23, 22, 0.8) 100%)',
          pointerEvents: 'none'
        }} />
      </div>

      <div style={{ textAlign: 'center', margin: '20px 0' }}>
        <h2 style={{ color: '#e6efe6', fontWeight: 700 }}>Willkommen bei Match League</h2>
        <p>
        <b>Match League</b> verbindet Sportler, Teams und Locations – vom spontanen Match bis zur Liga.<br />
      </p>
      <p>     </p>
      </div>

      <div id="login-section" style={{
        maxWidth: 600,
        margin: '40px auto 60px',
        padding: '40px 42px',
        borderRadius: 24,
        background: 'linear-gradient(135deg, rgba(11, 30, 25, 0.95) 0%, rgba(7, 23, 22, 0.98) 100%)',
        border: '2px solid rgba(72, 186, 170, 0.15)',
        boxShadow: '0 20px 60px -12px rgba(0,0,0,0.5), 0 8px 24px rgba(72, 186, 170, 0.08)',
        position: 'relative',
        overflow: 'hidden',
        scrollMarginTop: 80,
        backdropFilter: 'blur(20px)'
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
          <div style={{ position: 'relative', marginBottom: 8 }}>
            <input
              type="password"
              placeholder="Passwort"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              autoComplete="current-password"
              style={{ display: "block", width: "100%", background: '#fafcf9', border: '1px solid rgba(0,0,0,0.12)', padding: '8px', paddingRight: '36px' }}
            />
            <button
              type="button"
              onClick={() => setShowPasswordResetPopup(true)}
              style={{
                position: 'absolute',
                right: '8px',
                top: '50%',
                transform: 'translateY(-50%)',
                background: 'rgba(72, 186, 170, 0.15)',
                border: '1.5px solid rgba(72, 186, 170, 0.4)',
                color: '#48baaa',
                fontSize: '14px',
                fontWeight: 700,
                cursor: 'pointer',
                width: '26px',
                height: '26px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: '50%',
                opacity: 1,
                transition: 'all 0.2s'
              }}
              onMouseOver={(e) => {
                e.target.style.background = 'rgba(72, 186, 170, 0.25)';
                e.target.style.borderColor = '#48baaa';
                e.target.style.transform = 'translateY(-50%) scale(1.05)';
              }}
              onMouseOut={(e) => {
                e.target.style.background = 'rgba(72, 186, 170, 0.15)';
                e.target.style.borderColor = 'rgba(72, 186, 170, 0.4)';
                e.target.style.transform = 'translateY(-50%) scale(1)';
              }}
              title="Passwort vergessen?"
            >
              ?
            </button>
          </div>
          <button 
            type="submit" 
            style={{ 
              width: "100%", 
              fontWeight: 700,
              padding: '11px 22px', 
              borderRadius: 12, 
              border: '2px solid #debc7c', 
              background: 'rgba(8,28,25,0.96)', 
              color: '#debc7c', 
              cursor: 'pointer', 
              fontSize: 15,
              boxShadow: '0 8px 20px rgba(0,0,0,0.28)',
              transition: 'transform 0.18s ease, box-shadow 0.18s ease, background 0.18s ease'
            }}
            onMouseOver={(e) => {
              e.target.style.transform = 'translateY(-2px)';
              e.target.style.boxShadow = '0 12px 28px rgba(222, 188, 124, 0.35)';
            }}
            onMouseOut={(e) => {
              e.target.style.transform = 'translateY(0)';
              e.target.style.boxShadow = '0 8px 20px rgba(0,0,0,0.28)';
            }}
          >
            Login
          </button>
          {loginMsg && <div style={{ marginTop: 8 }}>{loginMsg}</div>}

          {/* Email confirmation notice - small popup below login */}
          {showEmailConfirmPopup && (
            <div style={{
              marginTop: 16,
              padding: '16px 20px',
              background: 'rgba(245, 197, 66, 0.1)',
              border: '1px solid #f5c542',
              borderRadius: 12,
              textAlign: 'center'
            }}>
              <div style={{ 
                fontSize: 14, 
                color: '#f5c542',
                fontWeight: 600,
                marginBottom: 8
              }}>
                E-Mail noch nicht bestätigt
              </div>
              <div style={{ 
                fontSize: 13, 
                color: '#fff',
                opacity: 0.85,
                marginBottom: 12
              }}>
                Bitte bestätige <strong style={{ color: '#f5c542' }}>{unconfirmedEmail}</strong>
              </div>
              <button
                onClick={handleResendConfirmation}
                disabled={resending}
                style={{
                  width: '100%',
                  padding: '10px 16px',
                  background: resending ? 'rgba(245, 197, 66, 0.3)' : '#f5c542',
                  border: 'none',
                  borderRadius: 8,
                  color: '#071716',
                  fontSize: 14,
                  fontWeight: 700,
                  cursor: resending ? 'not-allowed' : 'pointer',
                  transition: 'all 0.2s'
                }}
              >
                {resending ? 'Wird gesendet...' : 'E-Mail erneut senden'}
              </button>
              {resendMsg && (
                <div style={{
                  marginTop: 10,
                  padding: '8px 12px',
                  borderRadius: 6,
                  background: resendMsg.includes('✅') ? 'rgba(34, 197, 94, 0.15)' : resendMsg.includes('Too many') ? 'rgba(239, 68, 68, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                  border: `1px solid ${resendMsg.includes('✅') ? 'rgba(34, 197, 94, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`,
                  fontSize: 12,
                  color: '#fff'
                }}>
                  {resendMsg}
                </div>
              )}
            </div>
          )}
        </form>

        {/* Register button */}
        <button
          onClick={() => window.location.href = '/register'}
          className="btn btn-gold"
          style={{ marginTop: 12, width: "100%", fontWeight: 700 }}
          type="button"
        >
          Registrieren
        </button>

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

      {/* Password Reset Popup */}
      {showPasswordResetPopup && (
        <div 
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0, 0, 0, 0.85)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            backdropFilter: 'blur(8px)',
            padding: 20
          }}
          onClick={() => {
            setShowPasswordResetPopup(false);
            setResetEmailSent(false);
            setResetError("");
          }}
        >
          <div 
            style={{
              background: 'linear-gradient(135deg, #0c2a1f 0%, #071716 100%)',
              border: '2px solid #48baaa',
              borderRadius: 16,
              padding: '32px 28px',
              maxWidth: 420,
              width: '100%',
              boxShadow: '0 20px 60px rgba(72, 186, 170, 0.25)',
              position: 'relative'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close button */}
            <button
              onClick={() => {
                setShowPasswordResetPopup(false);
                setResetEmailSent(false);
                setResetError("");
              }}
              style={{
                position: 'absolute',
                top: 12,
                right: 12,
                background: 'transparent',
                border: 'none',
                color: '#48baaa',
                fontSize: 24,
                cursor: 'pointer',
                width: 32,
                height: 32,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                opacity: 0.7,
                transition: 'opacity 0.2s'
              }}
              onMouseOver={(e) => e.target.style.opacity = '1'}
              onMouseOut={(e) => e.target.style.opacity = '0.7'}
            >
              ×
            </button>

            {!resetEmailSent ? (
              <>
                {/* Icon */}
                <div style={{
                  width: 64,
                  height: 64,
                  borderRadius: '50%',
                  background: 'rgba(72, 186, 170, 0.15)',
                  border: '2px solid #48baaa',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '0 auto 20px',
                  fontSize: 32
                }}>
                  🔒
                </div>

                {/* Title */}
                <h3 style={{
                  color: '#48baaa',
                  fontWeight: 700,
                  fontSize: 22,
                  margin: '0 0 12px',
                  textAlign: 'center'
                }}>
                  Passwort vergessen?
                </h3>

                {/* Message */}
                <p style={{
                  color: '#fff',
                  opacity: 0.9,
                  fontSize: 15,
                  lineHeight: 1.6,
                  margin: '0 0 24px',
                  textAlign: 'center'
                }}>
                  Möchtest du einen Link zum Zurücksetzen deines Passworts per E-Mail an <strong style={{ color: '#48baaa' }}>{email || 'deine E-Mail-Adresse'}</strong> erhalten?
                </p>

                {resetError && (
                  <div style={{
                    padding: '12px 16px',
                    borderRadius: 8,
                    background: 'rgba(239, 68, 68, 0.15)',
                    border: '1px solid rgba(239, 68, 68, 0.3)',
                    color: '#fff',
                    fontSize: 14,
                    textAlign: 'center',
                    marginBottom: 16
                  }}>
                    {resetError}
                  </div>
                )}

                {/* Buttons */}
                <div style={{ display: 'flex', gap: 12 }}>
                  <button
                    onClick={() => {
                      setShowPasswordResetPopup(false);
                      setResetError("");
                    }}
                    style={{
                      flex: 1,
                      padding: '12px 20px',
                      background: 'transparent',
                      border: '2px solid rgba(72, 186, 170, 0.3)',
                      borderRadius: 10,
                      color: '#fff',
                      fontSize: 15,
                      fontWeight: 600,
                      cursor: 'pointer',
                      transition: 'all 0.2s'
                    }}
                    onMouseOver={(e) => {
                      e.target.style.background = 'rgba(72, 186, 170, 0.1)';
                      e.target.style.borderColor = '#48baaa';
                    }}
                    onMouseOut={(e) => {
                      e.target.style.background = 'transparent';
                      e.target.style.borderColor = 'rgba(72, 186, 170, 0.3)';
                    }}
                  >
                    Abbrechen
                  </button>
                  <button
                    onClick={handleSendPasswordReset}
                    disabled={sendingReset || !email}
                    style={{
                      flex: 1,
                      padding: '12px 20px',
                      background: sendingReset || !email ? 'rgba(72, 186, 170, 0.3)' : '#48baaa',
                      border: 'none',
                      borderRadius: 10,
                      color: '#071716',
                      fontSize: 15,
                      fontWeight: 700,
                      cursor: sendingReset || !email ? 'not-allowed' : 'pointer',
                      transition: 'all 0.2s',
                      boxShadow: '0 4px 16px rgba(72, 186, 170, 0.3)'
                    }}
                    onMouseOver={(e) => {
                      if (!sendingReset && email) {
                        e.target.style.transform = 'translateY(-2px)';
                        e.target.style.boxShadow = '0 6px 20px rgba(72, 186, 170, 0.4)';
                      }
                    }}
                    onMouseOut={(e) => {
                      if (!sendingReset && email) {
                        e.target.style.transform = 'translateY(0)';
                        e.target.style.boxShadow = '0 4px 16px rgba(72, 186, 170, 0.3)';
                      }
                    }}
                  >
                    {sendingReset ? 'Wird gesendet...' : 'Ja, E-Mail senden'}
                  </button>
                </div>

                {!email && (
                  <p style={{
                    color: '#fff',
                    opacity: 0.6,
                    fontSize: 12,
                    margin: '12px 0 0',
                    textAlign: 'center'
                  }}>
                    Bitte gib zuerst deine E-Mail-Adresse im Login-Formular ein.
                  </p>
                )}
              </>
            ) : (
              <>
                {/* Success icon */}
                <div style={{
                  width: 64,
                  height: 64,
                  borderRadius: '50%',
                  background: 'rgba(34, 197, 94, 0.15)',
                  border: '2px solid #22c55e',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '0 auto 20px',
                  fontSize: 32
                }}>
                  ✓
                </div>

                {/* Success title */}
                <h3 style={{
                  color: '#22c55e',
                  fontWeight: 700,
                  fontSize: 22,
                  margin: '0 0 12px',
                  textAlign: 'center'
                }}>
                  E-Mail versendet!
                </h3>

                {/* Success message */}
                <p style={{
                  color: '#fff',
                  opacity: 0.9,
                  fontSize: 15,
                  lineHeight: 1.6,
                  margin: '0 0 24px',
                  textAlign: 'center'
                }}>
                  Wir haben dir einen Link zum Zurücksetzen deines Passworts an <strong style={{ color: '#22c55e' }}>{email}</strong> gesendet. Bitte überprüfe dein Postfach.
                </p>

                <button
                  onClick={() => {
                    setShowPasswordResetPopup(false);
                    setResetEmailSent(false);
                  }}
                  style={{
                    width: '100%',
                    padding: '12px 20px',
                    background: '#22c55e',
                    border: 'none',
                    borderRadius: 10,
                    color: '#071716',
                    fontSize: 15,
                    fontWeight: 700,
                    cursor: 'pointer',
                    transition: 'all 0.2s'
                  }}
                >
                  Schließen
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}