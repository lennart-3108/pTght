import React, { useState, useEffect } from "react";
// using native fetch instead of axios for smaller dependency surface
import { API_BASE } from "../config";
import LocationSelector from "../components/LocationSelector";

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
    passwordConfirm: "",
    city_id: null,
    city_name: "",
    district_id: null,
    gender: "",
    sports: [],
    country_code: "",
  });
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [acceptGdpr, setAcceptGdpr] = useState(false);
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

  // Location data for selector
  const [cities, setCities] = useState([]);
  const [states, setStates] = useState([]);
  const [countries, setCountries] = useState([]);
  const [districts, setDistricts] = useState([]);

  useEffect(() => {
    let mounted = true;
    Promise.all([
      fetch(`${API_BASE}/cities/list`).then(r => r.ok ? r.json() : []),
      fetch(`${API_BASE}/states/list`).then(r => r.ok ? r.json() : []),
      fetch(`${API_BASE}/countries/list`).then(r => r.ok ? r.json() : []),
    ]).then(([citiesData, statesData, countriesData]) => {
      if (!mounted) return;
      setCities(Array.isArray(citiesData) ? citiesData : []);
      setStates(Array.isArray(statesData) ? statesData : []);
      setCountries(Array.isArray(countriesData) ? countriesData : []);
    }).catch(() => {});
    return () => { mounted = false; };
  }, []);

  function handleLocationChange(name, cityId, stateId, countryId, districtId) {
    // Find country code from countryId
    const country = countries.find(c => c.id === countryId);
    setForm(prev => ({
      ...prev,
      city_id: cityId || null,
      city_name: name || "",
      district_id: districtId || null,
      country_code: country?.code || ""
    }));
  }

  async function handleLoadDistricts(cityId) {
    try {
      const res = await fetch(`${API_BASE}/cities/${cityId}/districts`);
      if (!res.ok) return setDistricts([]);
      const data = await res.json();
      setDistricts(Array.isArray(data) ? data : []);
    } catch (e) {
      setDistricts([]);
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    setMessage("");
    
    // Validate minimum age (16 years)
    const birthDate = new Date(form.birthday);
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    
    if (age < 16) {
      setMessage("Du musst mindestens 16 Jahre alt sein, um dich zu registrieren.");
      setLoading(false);
      return;
    }
    
    // Validate Terms acceptance
    if (!acceptTerms) {
      setMessage("Bitte akzeptiere die Allgemeinen Geschäftsbedingungen.");
      setLoading(false);
      return;
    }
    
    // Validate GDPR for EU countries
    const euCountries = ['DE', 'AT', 'CH', 'FR', 'IT', 'NL', 'BE', 'ES', 'PT', 'PL', 'CZ', 'SK', 'HU', 'RO', 'BG', 'GR', 'HR', 'SI', 'LT', 'LV', 'EE', 'IE', 'DK', 'SE', 'FI', 'LU', 'MT', 'CY'];
    if (form.country_code && euCountries.includes(form.country_code.toUpperCase()) && !acceptGdpr) {
      setMessage("Bitte akzeptiere die Datenschutzerklärung (DSGVO).");
      setLoading(false);
      return;
    }
    
    console.log("Formulardaten:", form);
    try {
      const res = await fetch(`${API_BASE}/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          accept_terms: acceptTerms,
          accept_gdpr: acceptGdpr
        }),
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
        overflow: 'visible'
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

          <div style={{ marginBottom: 28 }}>
            <label style={{ 
              display: 'block',
              marginBottom: 12,
              fontWeight: 600,
              color: '#e5e7eb',
              fontSize: 14
            }}>
              Standort (optional)
            </label>
            <div style={{ maxWidth: 520 }}>
              <LocationSelector
                countries={countries}
                states={states}
                cities={cities}
                districts={districts}
                value={form.city_name}
                onChange={handleLocationChange}
                onLoadDistricts={handleLoadDistricts}
                placeholder="Stadt oder Bezirk wählen"
              />
            </div>
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

          <div style={{ marginBottom: 24 }}>
            <label style={{ 
              display: 'block',
              marginBottom: 8,
              fontWeight: 600,
              color: '#e5e7eb',
              fontSize: 14
            }}>
              Passwort bestätigen
            </label>
            <input 
              required 
              name="passwordConfirm" 
              type="password" 
              value={form.passwordConfirm} 
              onChange={handleChange} 
              minLength={6} 
              autoComplete="new-password"
              placeholder="Passwort wiederholen"
              style={{
                width: '100%',
                padding: '12px 16px',
                border: `1px solid ${form.passwordConfirm && form.password !== form.passwordConfirm ? '#ef4444' : 'rgba(255,255,255,0.12)'}`,
                borderRadius: 8,
                fontSize: 15,
                transition: 'border-color 0.2s',
                outline: 'none',
                boxSizing: 'border-box',
                background: 'rgba(255,255,255,0.05)',
                color: '#e5e7eb'
              }}
              onFocus={(e) => e.target.style.borderColor = '#48baa6'}
              onBlur={(e) => e.target.style.borderColor = form.passwordConfirm && form.password !== form.passwordConfirm ? '#ef4444' : 'rgba(255,255,255,0.12)'}
            />
            {form.passwordConfirm && form.password !== form.passwordConfirm && (
              <div style={{ marginTop: 6, fontSize: 13, color: '#ef4444' }}>
                Passwörter stimmen nicht überein
              </div>
            )}
            {form.passwordConfirm && form.password === form.passwordConfirm && form.password.length >= 6 && (
              <div style={{ marginTop: 6, fontSize: 13, color: '#48baa6' }}>
                ✓ Passwörter stimmen überein
              </div>
            )}
          </div>

          <div style={{ marginBottom: 24 }}>
            <label style={{ 
              display: 'block',
              marginBottom: 8,
              fontWeight: 600,
              color: '#e5e7eb',
              fontSize: 14
            }}>
              Geschlecht
            </label>
            <GenderSelector 
              value={form.gender} 
              onChange={(value) => setForm(prev => ({ ...prev, gender: value }))}
            />
          </div>

          {/* AGB Checkbox */}
          <div style={{ marginBottom: 16 }}>
            <label style={{ 
              display: 'flex',
              alignItems: 'flex-start',
              cursor: 'pointer',
              color: '#e5e7eb',
              fontSize: 14,
              lineHeight: 1.6
            }}>
              <input 
                type="checkbox"
                checked={acceptTerms}
                onChange={(e) => setAcceptTerms(e.target.checked)}
                required
                style={{
                  marginRight: 10,
                  marginTop: 4,
                  width: 18,
                  height: 18,
                  cursor: 'pointer',
                  accentColor: '#48baa6'
                }}
              />
              <span>
                Ich akzeptiere die{' '}
                <a 
                  href="/agb" 
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ color: '#48baa6', textDecoration: 'underline' }}
                >
                  Allgemeinen Geschäftsbedingungen
                </a>
                {' '}*
              </span>
            </label>
          </div>

          {/* GDPR Checkbox - nur für EU Länder */}
          {form.country_code && ['DE', 'AT', 'CH', 'FR', 'IT', 'NL', 'BE', 'ES', 'PT', 'PL', 'CZ', 'SK', 'HU', 'RO', 'BG', 'GR', 'HR', 'SI', 'LT', 'LV', 'EE', 'IE', 'DK', 'SE', 'FI', 'LU', 'MT', 'CY'].includes(form.country_code.toUpperCase()) && (
            <div style={{ marginBottom: 16 }}>
              <label style={{ 
                display: 'flex',
                alignItems: 'flex-start',
                cursor: 'pointer',
                color: '#e5e7eb',
                fontSize: 14,
                lineHeight: 1.6
              }}>
                <input 
                  type="checkbox"
                  checked={acceptGdpr}
                  onChange={(e) => setAcceptGdpr(e.target.checked)}
                  required
                  style={{
                    marginRight: 10,
                    marginTop: 4,
                    width: 18,
                    height: 18,
                    cursor: 'pointer',
                    accentColor: '#48baa6'
                  }}
                />
                <span>
                  Ich stimme der{' '}
                  <a 
                    href="/datenschutz" 
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ color: '#48baa6', textDecoration: 'underline' }}
                  >
                    Datenschutzerklärung (DSGVO)
                  </a>
                  {' '}zu *
                </span>
              </label>
            </div>
          )}

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

// Gender Selector Component
function GenderSelector({ value, onChange }) {
  const [showDropdown, setShowDropdown] = React.useState(false);
  
  const genderOptions = [
    { value: 'male', label: 'Männlich', icon: '♂' },
    { value: 'female', label: 'Weiblich', icon: '♀' },
    { value: 'other', label: 'Divers', icon: '⚧' }
  ];

  const selectedOption = genderOptions.find(opt => opt.value === value);

  return (
    <div style={{ position: 'relative', zIndex: showDropdown ? 99999 : 1 }}>
      {/* Display field */}
      <div
        onClick={() => setShowDropdown(!showDropdown)}
        style={{
          padding: '12px 16px',
          borderRadius: 10,
          border: '1px solid #2f6b57',
          background: '#0b1e19',
          color: value ? '#e8efe8' : '#9ca3af',
          fontSize: 15,
          width: '100%',
          cursor: 'pointer',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          userSelect: 'none',
          transition: 'all 0.2s',
          boxSizing: 'border-box'
        }}
        onMouseEnter={(e) => e.target.style.borderColor = '#48baa6'}
        onMouseLeave={(e) => e.target.style.borderColor = '#2f6b57'}
      >
        <span>
          {selectedOption ? `${selectedOption.icon} ${selectedOption.label}` : '-- Geschlecht wählen --'}
        </span>
        <span style={{ fontSize: 12, color: '#6b8578' }}>
          {showDropdown ? '▲' : '▼'}
        </span>
      </div>

      {/* Dropdown menu */}
      {showDropdown && (
        <div style={{
          position: 'absolute',
          top: '100%',
          left: 0,
          right: 0,
          marginTop: 4,
          background: '#0b1e19',
          border: '1px solid #2f6b57',
          borderRadius: 10,
          zIndex: 100000,
          boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
          overflow: 'hidden'
        }}>
          {genderOptions.map((option, idx) => (
            <div
              key={option.value}
              onClick={() => {
                onChange(option.value);
                setShowDropdown(false);
              }}
              style={{
                padding: '12px 16px',
                cursor: 'pointer',
                background: value === option.value ? '#113528' : 'transparent',
                borderBottom: idx < genderOptions.length - 1 ? '1px solid #1a3329' : 'none',
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                fontSize: 14,
                color: value === option.value ? '#48baa6' : '#e8efe8',
                fontWeight: value === option.value ? 600 : 500,
                transition: 'all 0.15s'
              }}
              onMouseEnter={(e) => {
                e.target.style.background = '#0e2521';
                e.target.style.color = '#48baa6';
              }}
              onMouseLeave={(e) => {
                e.target.style.background = value === option.value ? '#113528' : 'transparent';
                e.target.style.color = value === option.value ? '#48baa6' : '#e8efe8';
              }}
            >
              <span style={{ fontSize: 16 }}>{option.icon}</span>
              <span>{option.label}</span>
              {value === option.value && (
                <span style={{ marginLeft: 'auto', color: '#48baa6' }}>✓</span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

