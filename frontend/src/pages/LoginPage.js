import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { API_BASE } from "../config";
// large hero logo not currently used here
import smallLogo from "../images/matchleague_logo_4x4.png";
// dynamically load all images from the background folder
function importAllBackgrounds(r) {
  // map to { key, src } so we can sort by filename
  return r.keys().map((k) => ({ key: k.replace(/^\.\//, ''), src: r(k) }));
}
// load all images from folder
const backgrounds = importAllBackgrounds(require.context("../images/background", false, /\.(png|jpe?g|svg)$/));
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

export default function LoginPage({ setToken, setIsAdminFlag }) {
  const navigate = useNavigate();
  // Login-Form-States
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loginMsg, setLoginMsg] = useState("");

  // Reset-Form-States
  const [showReset, setShowReset] = useState(false);
  const [resetUsername, setResetUsername] = useState("");
  const [resetPassword, setResetPassword] = useState("");
  const [resetMsg, setResetMsg] = useState("");
  
  // Resend confirmation states
  const [showResend, setShowResend] = useState(false);
  const [resendEmail, setResendEmail] = useState("");
  const [resendMsg, setResendMsg] = useState("");

  // Login-Handler (hier an dein Backend anpassen!)
  const handleLogin = async (e) => {
    e.preventDefault();
    setLoginMsg("");
    try {
      const res = await fetch(`${API_BASE}/login`, {
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
      const response = await fetch(`${API_BASE}/reset-password`, {
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

  // choose a visibly green-tinted panel (not near-white) so it reads as a soft surface
  const panelBg = '#081c19';
  const panelBorder = '4px solid rgba(245, 241, 241, 0.08)';
  const btnGreen = '#0a2221';
  const btnGreenHover = '#0e2f2d';

  // hero carousel state (use all images in the background folder)
  // slides: array of image URLs (use sorted backgrounds)
  const slides = backgrounds.map(b => b.src);
  const [index, setIndex] = useState(0);
  React.useEffect(() => {
    const t = setInterval(() => setIndex(i => (i + 1) % slides.length), 5000);
    return () => clearInterval(t);
  }, [slides.length]);

  return (
    <div>
      <section className="hero-carousel">
        {slides.map((s, i) => (
          <div key={i} className={`hero-slide ${i === index ? 'active' : ''}`} style={{ backgroundImage: `url(${s})` }} />
        ))}

        <div className="hero-overlay">
          <div className="hero-stripe">
            <img src={smallLogo} alt="ML" className="hero-small-logo" />
            <h1 className="hero-title">Match League</h1>
          </div>
          <p className="hero-sub">Verbinde dich mit Spielern. Tritt Ligen bei. Verfolge Spiele.</p>
        </div>
      </section>

      <div style={{ textAlign: 'center', margin: '20px 0' }}>
        <h2 style={{ color: '#e6efe6' }}>Willkommen bei Match League</h2>
      </div>

      <div style={{ maxWidth: 350, margin: "-40px auto 40px", padding: 20, borderRadius: 8, background: panelBg, border: panelBorder, boxShadow: '0 6px 18px rgba(0,0,0,0.06)' }}>
        <h2>Login</h2>
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
          <button type="submit" className="btn btn-primary" style={{ width: "100%" }}>Login</button>
          {loginMsg && <div style={{ marginTop: 8 }}>{loginMsg}</div>}
        </form>

        {/* Passwort vergessen Button */}
        <button
          onClick={() => setShowReset((s) => !s)}
          className="btn btn-primary"
          style={{ marginTop: 24, width: "100%" }}
          type="button"
        >
          Passwort vergessen?
        </button>

        {/* Resend confirmation link button */}
        <button
          onClick={() => setShowResend((s) => !s)}
          className="btn btn-primary"
          style={{ marginTop: 12, width: "100%" }}
          type="button"
        >
          Bestätigungs-Mail erneut senden
        </button>

        {/* Reset-Formular */}
        {showReset && (
          <form
            onSubmit={handleReset}
            style={{ marginTop: 16, border: "1px solid #eee", padding: 16, borderRadius: 8 }}
          >
            <h4>Passwort zurücksetzen</h4>
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
              <button type="submit" className="btn btn-primary" style={{ width: "100%" }}>Zurücksetzen</button>
            {resetMsg && <div style={{ marginTop: 8 }}>{resetMsg}</div>}
          </form>
        )}

        {/* Resend confirmation form */}
        {showResend && (
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              setResendMsg("");
              try {
                const resp = await fetch(`${API_BASE}/resend-confirmation`, {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ email: resendEmail }),
                });
                const data = await resp.json().catch(() => ({}));
                if (resp.ok && data.success !== false) {
                  setResendMsg(data.message || "✅ Bestätigungs-Mail versendet.");
                } else {
                  setResendMsg(data.error || data.message || "Fehler beim Versenden der Bestätigungs-Mail.");
                }
              } catch (e) {
                setResendMsg("Server nicht erreichbar.");
              }
            }}
            style={{ marginTop: 16, border: "1px solid #eee", padding: 16, borderRadius: 8 }}
          >
            <h4>Bestätigungs-Mail erneut anfordern</h4>
            <input
              type="email"
              placeholder="E-Mail"
              value={resendEmail}
              onChange={(e) => setResendEmail(e.target.value)}
              required
              style={{ display: "block", marginBottom: 8, width: "100%" }}
            />
            <button type="submit" className="btn btn-primary" style={{ width: "100%" }}>Senden</button>
            {resendMsg && <div style={{ marginTop: 8 }}>{resendMsg}</div>}
          </form>
        )}
      </div>
    </div>
  );
}


