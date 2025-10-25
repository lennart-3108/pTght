import React, { useState } from "react";
// using native fetch instead of axios for smaller dependency surface
import { API_BASE } from "../config";

const SPORT_OPTIONS = [
  "Fußball",
  "Basketball",
  "Tennis",
  "Volleyball",
  "Schwimmen",
  "Laufen",
  "Handball",
];

export default function RegisterPage() {
  const [form, setForm] = useState({
    firstname: "",
    lastname: "",
    birthday: "",
    email: "",
    password: "",
    sports: [],
  });
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  function handleChange(e) {
    const { name, value } = e.target;
    setForm(prev => ({
      ...prev,
      [name]: value,
    }));
  }

  function handleSportsChange(e) {
    const value = e.target.value;
    setForm(prev => ({
      ...prev,
      sports: prev.sports.includes(value)
        ? prev.sports.filter(s => s !== value)
        : [...prev.sports, value]
    }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    setMessage("");
    console.log("Formulardaten:", form);
    try {
      const res = await fetch(`${API_BASE}/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const responseData = await (async () => {
        const t = await res.text();
        try { return JSON.parse(t); } catch { return null; }
      })();
      if (!res.ok) {
        const errMsg = responseData?.error || `HTTP ${res.status}`;
        throw new Error(errMsg);
      }
      console.log("Backend-Antwort /register:", responseData || "(no json)");
      setMessage(
        "Registrierung erfolgreich! Bitte prüfe dein E-Mail-Postfach und bestätige den Link."
      );
      setForm({
        firstname: "",
        lastname: "",
        birthday: "",
        email: "",
        password: "",
        sports: [],
      });
    } catch (err) {
      console.error("Fehler bei Registrierung:", err?.message || err);
      setMessage(
        err?.message || "Registrierung fehlgeschlagen. Bitte überprüfe deine Daten."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ 
      minHeight: '100vh',
      padding: '40px 20px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center'
    }}>
      <div style={{ 
        maxWidth: 500, 
        width: '100%',
        padding: '40px 32px', 
        borderRadius: 20,
        background: 'linear-gradient(135deg,#071716,#0d2422)',
        border: '1px solid rgba(255,255,255,0.08)',
        boxShadow: '0 8px 32px -8px rgba(0,0,0,0.4), 0 2px 6px rgba(0,0,0,0.3)',
        position: 'relative',
        overflow: 'hidden'
      }}>
        <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', background: 'radial-gradient(circle at 85% 20%, rgba(72,186,170,0.15), transparent 60%)' }} />
        <div style={{ position: 'relative' }}>
        <h2 style={{ 
          margin: '0 0 8px 0',
          fontSize: 28,
          fontWeight: 700,
          color: '#e5e7eb'
        }}>
          Registrieren
        </h2>
        <p style={{ 
          margin: '0 0 32px 0',
          color: '#9ca3af',
          fontSize: 14,
          lineHeight: 1.5
        }}>
          Erstelle deinen Account und werde Teil der Community
        </p>
        
        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: 20 }}>
            <label style={{ 
              display: 'block',
              marginBottom: 8,
              fontWeight: 600,
              color: '#e5e7eb',
              fontSize: 14
            }}>
              Vorname
            </label>
            <input 
              required 
              name="firstname" 
              value={form.firstname} 
              onChange={handleChange}
              placeholder="Max"
              style={{
                width: '100%',
                padding: '12px 16px',
                border: '1px solid rgba(255,255,255,0.12)',
                borderRadius: 8,
                fontSize: 15,
                transition: 'border-color 0.2s',
                outline: 'none',
                boxSizing: 'border-box',
                background: 'rgba(255,255,255,0.05)',
                color: '#e5e7eb'
              }}
              onFocus={(e) => e.target.style.borderColor = '#48baa6'}
              onBlur={(e) => e.target.style.borderColor = 'rgba(255,255,255,0.12)'}
            />
          </div>

          <div style={{ marginBottom: 20 }}>
            <label style={{ 
              display: 'block',
              marginBottom: 8,
              fontWeight: 600,
              color: '#e5e7eb',
              fontSize: 14
            }}>
              Nachname
            </label>
            <input 
              required 
              name="lastname" 
              value={form.lastname} 
              onChange={handleChange}
              placeholder="Mustermann"
              style={{
                width: '100%',
                padding: '12px 16px',
                border: '1px solid rgba(255,255,255,0.12)',
                borderRadius: 8,
                fontSize: 15,
                transition: 'border-color 0.2s',
                outline: 'none',
                boxSizing: 'border-box',
                background: 'rgba(255,255,255,0.05)',
                color: '#e5e7eb'
              }}
              onFocus={(e) => e.target.style.borderColor = '#48baa6'}
              onBlur={(e) => e.target.style.borderColor = 'rgba(255,255,255,0.12)'}
            />
          </div>

          <div style={{ marginBottom: 20 }}>
            <label style={{ 
              display: 'block',
              marginBottom: 8,
              fontWeight: 600,
              color: '#e5e7eb',
              fontSize: 14
            }}>
              Geburtstag
            </label>
            <input 
              required 
              name="birthday" 
              type="date" 
              value={form.birthday} 
              onChange={handleChange}
              style={{
                width: '100%',
                padding: '12px 16px',
                border: '1px solid rgba(255,255,255,0.12)',
                borderRadius: 8,
                fontSize: 15,
                transition: 'border-color 0.2s',
                outline: 'none',
                boxSizing: 'border-box',
                background: 'rgba(255,255,255,0.05)',
                color: '#e5e7eb',
                colorScheme: 'dark'
              }}
              onFocus={(e) => e.target.style.borderColor = '#48baa6'}
              onBlur={(e) => e.target.style.borderColor = 'rgba(255,255,255,0.12)'}
            />
          </div>

          <div style={{ marginBottom: 20 }}>
            <label style={{ 
              display: 'block',
              marginBottom: 8,
              fontWeight: 600,
              color: '#e5e7eb',
              fontSize: 14
            }}>
              E-Mail
            </label>
            <input 
              required 
              name="email" 
              type="email" 
              value={form.email} 
              onChange={handleChange}
              placeholder="max@beispiel.de"
              style={{
                width: '100%',
                padding: '12px 16px',
                border: '1px solid rgba(255,255,255,0.12)',
                borderRadius: 8,
                fontSize: 15,
                transition: 'border-color 0.2s',
                outline: 'none',
                boxSizing: 'border-box',
                background: 'rgba(255,255,255,0.05)',
                color: '#e5e7eb'
              }}
              onFocus={(e) => e.target.style.borderColor = '#48baa6'}
              onBlur={(e) => e.target.style.borderColor = 'rgba(255,255,255,0.12)'}
            />
          </div>

          <div style={{ marginBottom: 24 }}>
            <label style={{ 
              display: 'block',
              marginBottom: 8,
              fontWeight: 600,
              color: '#e5e7eb',
              fontSize: 14
            }}>
              Passwort
            </label>
            <input 
              required 
              name="password" 
              type="password" 
              value={form.password} 
              onChange={handleChange} 
              minLength={6} 
              autoComplete="new-password"
              placeholder="Mindestens 6 Zeichen"
              style={{
                width: '100%',
                padding: '12px 16px',
                border: '1px solid rgba(255,255,255,0.12)',
                borderRadius: 8,
                fontSize: 15,
                transition: 'border-color 0.2s',
                outline: 'none',
                boxSizing: 'border-box',
                background: 'rgba(255,255,255,0.05)',
                color: '#e5e7eb'
              }}
              onFocus={(e) => e.target.style.borderColor = '#48baa6'}
              onBlur={(e) => e.target.style.borderColor = 'rgba(255,255,255,0.12)'}
            />
          </div>

          <div style={{ marginBottom: 28 }}>
            <label style={{ 
              display: 'block',
              marginBottom: 12,
              fontWeight: 600,
              color: '#e5e7eb',
              fontSize: 14
            }}>
              Sportarten (optional)
            </label>
            <div style={{ 
              display: 'grid',
              gridTemplateColumns: 'repeat(2, 1fr)',
              gap: 12
            }}>
              {SPORT_OPTIONS.map(sport => (
                <label 
                  key={sport} 
                  style={{ 
                    display: 'flex',
                    alignItems: 'center',
                    padding: '10px 12px',
                    border: form.sports.includes(sport) ? '1px solid #48baa6' : '1px solid rgba(255,255,255,0.12)',
                    borderRadius: 8,
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    background: form.sports.includes(sport) ? 'rgba(72,186,170,0.15)' : 'rgba(255,255,255,0.03)'
                  }}
                >
                  <input
                    type="checkbox"
                    value={sport}
                    checked={form.sports.includes(sport)}
                    onChange={handleSportsChange}
                    style={{ marginRight: 8, cursor: 'pointer' }}
                  />
                  <span style={{ fontSize: 14, color: '#e5e7eb' }}>{sport}</span>
                </label>
              ))}
            </div>
          </div>

          <button 
            type="submit" 
            disabled={loading}
            className="btn btn-gold"
            style={{
              width: '100%',
              padding: '14px 24px',
              fontSize: 16,
              fontWeight: 700
            }}
          >
            {loading ? 'Wird gesendet...' : 'Registrieren'}
          </button>
        </form>
        
        {message && (
          <div style={{ 
            marginTop: 20, 
            padding: '12px 16px',
            background: message.includes('erfolgreich') ? 'rgba(72,186,170,0.2)' : 'rgba(239,68,68,0.2)',
            color: message.includes('erfolgreich') ? '#48baa6' : '#ef4444',
            border: message.includes('erfolgreich') ? '1px solid rgba(72,186,170,0.3)' : '1px solid rgba(239,68,68,0.3)',
            borderRadius: 8,
            fontSize: 14,
            lineHeight: 1.5
          }}>
            {message}
          </div>
        )}

        <div style={{ 
          marginTop: 24,
          textAlign: 'center',
          fontSize: 14,
          color: '#9ca3af'
        }}>
          Bereits registriert?{' '}
          <a 
            href="/" 
            style={{ 
              color: '#48baa6',
              fontWeight: 600,
              textDecoration: 'none'
            }}
            onMouseEnter={(e) => e.target.style.textDecoration = 'underline'}
            onMouseLeave={(e) => e.target.style.textDecoration = 'none'}
          >
            Zum Login
          </a>
        </div>
        </div>
      </div>
    </div>
  );
}

