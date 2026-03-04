import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { API_BASE } from "../config";
import LocationSelector from "../components/LocationSelector";
import { useLanguage } from "../i18n";

export default function EditProfilePage() {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [user, setUser] = useState(null);
  const [cities, setCities] = useState([]);
  const [countries, setCountries] = useState([]);
  const [states, setStates] = useState([]);
  const [districts, setDistricts] = useState([]);
  const [formData, setFormData] = useState({
    firstname: '',
    lastname: '',
    email: '',
    bio: '',
    location: '',
    phone: '',
    birth_date: '',
    city_id: null,
    district_id: null,
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

      // Load cities with type filter (only main cities, not districts)
      fetch(`${API_BASE}/cities/list?type=city`, { headers: { Authorization: `Bearer ${token}` } })
        .then(safeJson)
        .then(data => setCities(Array.isArray(data) ? data : []))
        .catch(e => console.error('Error loading cities:', e));

      // Load countries
      fetch(`${API_BASE}/countries/list`)
        .then(safeJson)
        .then(data => setCountries(Array.isArray(data) ? data : []))
        .catch(e => console.error('Error loading countries:', e));

      // Load counties/states
      fetch(`${API_BASE}/counties/list`)
        .then(safeJson)
        .then(data => {
          console.log('[EditProfilePage] Counties/states loaded:', data?.length, 'items');
          console.log('[EditProfilePage] First 3 states:', data?.slice(0, 3));
          setStates(Array.isArray(data) ? data : []);
        })
        .catch(e => console.error('Error loading counties:', e));

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
          email: userData.email || '',
          bio: fullUser.bio || '',
          location: fullUser.location || '',
          phone: fullUser.phone || '',
          birth_date: userData.birthday || fullUser.birth_date || '',
          city_id: userData.city_id || fullUser.city_id || null,
          district_id: userData.district_id || fullUser.district_id || null,
          gender: fullUser.gender || ''
        });
        
        setLoading(false);
      })
      .catch((e) => {
        console.error('Error loading profile:', e);
        alert(t('editProfile.loadError'));
        navigate('/profile');
      });
  }, [navigate]);

  // When cities list arrives, populate location display name if missing but IDs exist
  useEffect(() => {
    if (formData.location || !formData.city_id || !Array.isArray(cities) || !cities.length) return;
    const cityName = cities.find(c => String(c.id) === String(formData.city_id))?.name;
    if (cityName) {
      setFormData(prev => ({ ...prev, location: cityName }));
    }
  }, [cities, formData.city_id, formData.location]);

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
      
      alert(t('editProfile.saveOk'));
      navigate('/profile', { replace: true });
    } catch (e) {
      console.error('Save exception:', e);
      alert(t('editProfile.saveErrorPrefix', { error: (e.message || e) }));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div style={{ padding: 20, textAlign: 'center', color: '#e8efe8' }}>
        {t('editProfile.loading')}
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
            {t('editProfile.title')}
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
            {t('common.cancel')}
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
            <label style={labelStyle}>{t('editProfile.bio')}</label>
            <textarea
              value={formData.bio}
              onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
              style={{ ...inputStyle, minHeight: 100, resize: 'vertical' }}
              placeholder={t('editProfile.bioPlaceholder')}
            />
          </div>

          {/* Location with hierarchical selection */}
          <div style={sectionStyle}>
            <label style={labelStyle}>Standort</label>
            
            <LocationSelector
              cities={cities}
              countries={countries}
              states={states}
              districts={districts}
              value={formData.location || (formData.city_id ? (cities.find(c => String(c.id) === String(formData.city_id))?.name || '') : '')}
              onChange={(cityName, cityId, stateId, countryId, districtId) => {
                setFormData({
                  ...formData,
                  location: cityName || '',
                  city_id: cityId || null,
                  district_id: districtId || null
                });
              }}
              placeholder={t('editProfile.locationPlaceholder')}
              onLoadDistricts={(cityId) => {
                // Load districts for selected city
                fetch(`${API_BASE}/cities/${cityId}/districts`)
                  .then(r => r.ok ? r.json() : [])
                  .then(data => setDistricts(Array.isArray(data) ? data : []))
                  .catch(e => console.error('Error loading districts:', e));
              }}
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
            <label style={labelStyle}>{t('editProfile.gender')}</label>
            <GenderSelector
              value={formData.gender}
              onChange={(value) => setFormData({ ...formData, gender: value })}
            />
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
              {saving ? t('editProfile.saving') : t('editProfile.saveChanges')}
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
              {t('common.cancel')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// Shared Gender Selector (same look as RegisterPage)
function GenderSelector({ value, onChange }) {
  const { t } = useLanguage();
  const [showDropdown, setShowDropdown] = React.useState(false);

  const genderOptions = [
    { value: 'male', label: t('editProfile.gender.male'), icon: '♂' },
    { value: 'female', label: t('editProfile.gender.female'), icon: '♀' },
    { value: 'diverse', label: t('editProfile.gender.diverse'), icon: '⚧' },
    { value: 'prefer_not_to_say', label: t('editProfile.gender.na'), icon: '–' }
  ];

  const selectedOption = genderOptions.find(opt => opt.value === value);

  return (
    <div style={{ position: 'relative', zIndex: showDropdown ? 99999 : 1 }}>
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
        onMouseEnter={(e) => e.currentTarget.style.borderColor = '#48baa6'}
        onMouseLeave={(e) => e.currentTarget.style.borderColor = '#2f6b57'}
      >
        <span>
          {selectedOption ? `${selectedOption.icon} ${selectedOption.label}` : t('editProfile.selectPlaceholder')}
        </span>
        <span style={{ fontSize: 12, color: '#6b8578' }}>
          {showDropdown ? '▲' : '▼'}
        </span>
      </div>

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
                e.currentTarget.style.background = '#0e2521';
                e.currentTarget.style.color = '#48baa6';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = value === option.value ? '#113528' : 'transparent';
                e.currentTarget.style.color = value === option.value ? '#48baa6' : '#e8efe8';
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
