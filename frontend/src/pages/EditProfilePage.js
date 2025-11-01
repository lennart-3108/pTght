import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { API_BASE } from "../config";
import LocationSelector from "../components/LocationSelector";

export default function EditProfilePage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [user, setUser] = useState(null);
  const [cities, setCities] = useState([]);
  const [countries, setCountries] = useState([]);
  const [states, setStates] = useState([]);
  const [formData, setFormData] = useState({
    firstname: '',
    lastname: '',
    username: '',
    email: '',
    bio: '',
    location: '',
    phone: '',
    birth_date: '',
    gender: ''
  });

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      navigate('/login');
      return;
    }

    // Load lists (cities, countries, states)
      // helper to safely parse JSON and avoid Promise.all rejections on HTML responses
      const safeJson = async (r) => {
        try {
          if (!r || !r.ok) return [];
          const ct = (r.headers && typeof r.headers.get === 'function') ? (r.headers.get('content-type') || '') : '';
          if (ct.includes('text/html')) return [];
          return await r.json();
        } catch { return []; }
      };

      fetch(`${API_BASE}/cities/list`, { headers: { Authorization: `Bearer ${token}` } })
        .then(safeJson)
        .then(data => setCities(Array.isArray(data) ? data : []))
        .catch(e => console.error('Error loading cities:', e));

      (async () => {
        try {
          let arr = await fetch(`${API_BASE}/countries/list`).then(safeJson);
          setCountries(Array.isArray(arr) ? arr : []);
          if ((!arr || arr.length === 0) && !String(API_BASE).startsWith('http://localhost:5001')) {
            const fallbackBase = 'http://localhost:5001/api';
            const list = await fetch(`${fallbackBase}/countries/list`).then(safeJson).catch(() => []);
            if (Array.isArray(list) && list.length) setCountries(list);
          }
        } catch (e) {
          console.error('Error loading countries:', e);
          if (!String(API_BASE).startsWith('http://localhost:5001')) {
            try {
              const list = await fetch(`http://localhost:5001/api/countries/list`).then(safeJson);
              if (Array.isArray(list) && list.length) setCountries(list);
            } catch {}
          }
        }
      })();

      fetch(`${API_BASE}/states/list`)
        .then(safeJson)
        .then(data => setStates(Array.isArray(data) ? data : []))
        .catch(e => console.error('Error loading states:', e));

      fetch(`${API_BASE}/me`, { headers: { Authorization: `Bearer ${token}` } })

    fetch(`${API_BASE}/countries/list`)
      .then(r => r.ok ? r.json() : [])
      .then(data => {
        const arr = Array.isArray(data) ? data : [];
        setCountries(arr);
        // Fallback: if empty and API_BASE is not localhost, try localhost directly
        if (!arr.length && !String(API_BASE).startsWith('http://localhost:5001')) {
          const fallbackBase = 'http://localhost:5001/api';
          fetch(`${fallbackBase}/countries/list`).then(r => r.ok ? r.json() : [])
            .then(list => { if (Array.isArray(list) && list.length) setCountries(list); })
            .catch(() => {});
        }
      })
      .catch(e => console.error('Error loading countries:', e));

    fetch(`${API_BASE}/states/list`)
      .then(r => r.ok ? r.json() : [])
      .then(data => setStates(Array.isArray(data) ? data : []))
      .catch(e => console.error('Error loading states:', e));

    fetch(`${API_BASE}/me`, { headers: { Authorization: `Bearer ${token}` } })
      .then(async (r) => {
        const j = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(j?.error || `HTTP ${r.status}`);
        return j;
      })
      .then(async (userData) => {
        setUser(userData);
        // Load full user profile data
        const r2 = await fetch(`${API_BASE}/users/${userData.id}`, { 
          headers: { Authorization: `Bearer ${token}` } 
        });
        const fullUser = await r2.json().catch(() => ({}));
        
        setFormData({
          firstname: userData.firstname || '',
          lastname: userData.lastname || '',
          username: userData.username || '',
          email: userData.email || '',
          bio: fullUser.bio || '',
          location: fullUser.location || '',
          phone: fullUser.phone || '',
          birth_date: fullUser.birth_date || '',
          gender: fullUser.gender || ''
        });
        
        setLoading(false);
      })
      .catch((e) => {
        console.error('Error loading profile:', e);
        alert('Fehler beim Laden des Profils');
        navigate('/profile');
      });
  }, [navigate]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const token = localStorage.getItem('token');
      
      console.log('Saving profile data:', formData);
      
      const resp = await fetch(`${API_BASE}/profile`, {
        method: 'PUT',
        headers: { 
          'Content-Type': 'application/json', 
          Authorization: `Bearer ${token}` 
        },
        body: JSON.stringify(formData)
      });
      
      console.log('Response status:', resp.status);
      
      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}));
        console.error('Save error:', err);
        throw new Error(err?.error || `HTTP ${resp.status}`);
      }
      
      const result = await resp.json();
      console.log('Save result:', result);
      
      alert('Profil erfolgreich gespeichert');
      navigate('/profile');
    } catch (e) {
      console.error('Save exception:', e);
      alert('Fehler beim Speichern: ' + (e.message || e));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div style={{ padding: 20, textAlign: 'center', color: '#e8efe8' }}>
        Lädt...
      </div>
    );
  }

  const inputStyle = {
    width: '100%',
    padding: '12px 14px',
    borderRadius: 10,
    border: '1px solid #2f6b57',
    background: '#0b1e19',
    color: '#e8efe8',
    fontSize: 15
  };

  const labelStyle = {
    display: 'block',
    marginBottom: 6,
    fontSize: 13,
    color: '#cfe',
    fontWeight: 500
  };

  const sectionStyle = {
    marginBottom: 20
  };

  return (
    <div style={{ 
      maxWidth: 800, 
      margin: '0 auto', 
      padding: 20,
      background: '#0e2a22',
      minHeight: '100vh'
    }}>
      <div style={{ 
        background: '#113528', 
        borderRadius: 12, 
        padding: 24,
        marginBottom: 20
      }}>
        {/* Header */}
        <div style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center',
          marginBottom: 24
        }}>
          <h1 style={{ 
            fontSize: 24, 
            fontWeight: 700, 
            color: '#e8efe8',
            margin: 0
          }}>
            Persönliche Daten bearbeiten
          </h1>
          <button
            onClick={() => navigate('/profile')}
            style={{
              padding: '8px 16px',
              borderRadius: 8,
              border: '1px solid #2f6b57',
              background: 'transparent',
              color: '#e8efe8',
              cursor: 'pointer',
              fontSize: 14
            }}
          >
            Abbrechen
          </button>
        </div>

        {/* Form */}
        <div>
          {/* Firstname */}
          <div style={sectionStyle}>
            <label style={labelStyle}>Vorname *</label>
            <input
              type="text"
              value={formData.firstname}
              onChange={(e) => setFormData({ ...formData, firstname: e.target.value })}
              style={inputStyle}
              placeholder="Dein Vorname"
              required
            />
          </div>

          {/* Lastname */}
          <div style={sectionStyle}>
            <label style={labelStyle}>Nachname *</label>
            <input
              type="text"
              value={formData.lastname}
              onChange={(e) => setFormData({ ...formData, lastname: e.target.value })}
              style={inputStyle}
              placeholder="Dein Nachname"
              required
            />
          </div>

          {/* Username */}
          <div style={sectionStyle}>
            <label style={labelStyle}>Benutzername</label>
            <input
              type="text"
              value={formData.username}
              onChange={(e) => setFormData({ ...formData, username: e.target.value })}
              style={inputStyle}
              placeholder="Dein Benutzername"
            />
          </div>

          {/* Email */}
          <div style={sectionStyle}>
            <label style={labelStyle}>E-Mail</label>
            <input
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              style={inputStyle}
              placeholder="deine@email.de"
            />
          </div>

          {/* Bio */}
          <div style={sectionStyle}>
            <label style={labelStyle}>Bio / Über mich</label>
            <textarea
              value={formData.bio}
              onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
              style={{ ...inputStyle, minHeight: 100, resize: 'vertical' }}
              placeholder="Erzähle etwas über dich..."
            />
          </div>

          {/* Location with hierarchical selection */}
          <div style={sectionStyle}>
            <label style={labelStyle}>Standort</label>
            
            <LocationSelector
              cities={cities}
              countries={countries}
              states={states}
              value={formData.location}
              onChange={(cityName) => {
                setFormData({ ...formData, location: cityName });
              }}
              placeholder="Standort wählen"
            />
          </div>

          {/* Phone */}
          <div style={sectionStyle}>
            <label style={labelStyle}>Telefonnummer</label>
            <input
              type="tel"
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              style={inputStyle}
              placeholder="+49 123 456789"
            />
          </div>

          {/* Birth Date */}
          <div style={sectionStyle}>
            <label style={labelStyle}>Geburtsdatum</label>
            <input
              type="date"
              value={formData.birth_date}
              onChange={(e) => setFormData({ ...formData, birth_date: e.target.value })}
              style={inputStyle}
            />
          </div>

          {/* Gender */}
          <div style={sectionStyle}>
            <label style={labelStyle}>Geschlecht</label>
            <select
              value={formData.gender}
              onChange={(e) => setFormData({ ...formData, gender: e.target.value })}
              style={inputStyle}
            >
              <option value="">Bitte wählen</option>
              <option value="male">Männlich</option>
              <option value="female">Weiblich</option>
              <option value="diverse">Divers</option>
              <option value="prefer_not_to_say">Keine Angabe</option>
            </select>
          </div>

          {/* Save Button */}
          <div style={{ 
            display: 'flex', 
            gap: 12, 
            marginTop: 32,
            paddingTop: 20,
            borderTop: '1px solid #2f6b57'
          }}>
            <button
              onClick={handleSave}
              disabled={saving}
              style={{
                flex: 1,
                padding: '14px 24px',
                borderRadius: 10,
                border: 'none',
                background: '#debc7c',
                color: '#10261f',
                cursor: saving ? 'not-allowed' : 'pointer',
                fontSize: 16,
                fontWeight: 700,
                opacity: saving ? 0.6 : 1
              }}
            >
              {saving ? 'Speichert...' : 'Änderungen speichern'}
            </button>
            <button
              onClick={() => navigate('/profile')}
              disabled={saving}
              style={{
                padding: '14px 24px',
                borderRadius: 10,
                border: '1px solid #2f6b57',
                background: 'transparent',
                color: '#e8efe8',
                cursor: saving ? 'not-allowed' : 'pointer',
                fontSize: 16,
                fontWeight: 600
              }}
            >
              Abbrechen
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
