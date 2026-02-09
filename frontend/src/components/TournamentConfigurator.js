import React, { useState, useEffect } from 'react';
import { API_BASE } from '../config';

export default function TournamentConfigurator({ onCreated }) {
  const [step, setStep] = useState(1);
  const [sports, setSports] = useState([]);
  const [cities, setCities] = useState([]);
  const [rulesets, setRulesets] = useState([]);
  
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    sport_id: '',
    city_id: '',
    venue_name: '',
    venue_address: '',
    tournament_mode: 'knockout',
    max_participants: 16,
    min_participants: 4,
    registration_deadline: '',
    start_date: '',
    end_date: '',
    ruleset_id: '',
    tournament_config: {
      group_size: 4,
      advancement_per_group: 2,
      best_of_sets: 3
    }
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (formData.sport_id) {
      loadRulesets(formData.sport_id);
    }
  }, [formData.sport_id]);

  const loadData = async () => {
    try {
      const [sportsRes, citiesRes] = await Promise.all([
        fetch(`${API_BASE}/sports/categories`),
        fetch(`${API_BASE}/cities/list`)
      ]);

      if (sportsRes.ok) {
        const sportsData = await sportsRes.json();
        // Flatten sports from categories
        const allSports = sportsData.flatMap(cat => cat.sports || []);
        setSports(allSports);
      }

      if (citiesRes.ok) {
        const citiesData = await citiesRes.json();
        setCities(citiesData);
      }
    } catch (err) {
      console.error('Error loading data:', err);
      setError('Fehler beim Laden der Daten');
    }
  };

  const loadRulesets = async (sportId) => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_BASE}/rulesets?sport_id=${sportId}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      });
      
      if (res.ok) {
        const data = await res.json();
        setRulesets(data);
        // Auto-select first ruleset if available
        if (data.length > 0 && !formData.ruleset_id) {
          setFormData(prev => ({ ...prev, ruleset_id: data[0].id }));
        }
      }
    } catch (err) {
      console.error('Error loading rulesets:', err);
    }
  };

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleConfigChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      tournament_config: {
        ...prev.tournament_config,
        [field]: value
      }
    }));
  };

  const handleSubmit = async () => {
    setLoading(true);
    setError('');

    try {
      const token = localStorage.getItem('token');
      if (!token) {
        setError('Bitte melden Sie sich an');
        setLoading(false);
        return;
      }

      const res = await fetch(`${API_BASE}/tournaments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          ...formData,
          published: false // Start as draft
        })
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Fehler beim Erstellen des Turniers');
      }

      if (onCreated) {
        onCreated(data.tournament);
      }

      // Reset form
      setStep(1);
      setFormData({
        name: '',
        description: '',
        sport_id: '',
        city_id: '',
        venue_name: '',
        venue_address: '',
        tournament_mode: 'knockout',
        max_participants: 16,
        min_participants: 4,
        registration_deadline: '',
        start_date: '',
        end_date: '',
        ruleset_id: '',
        tournament_config: {
          group_size: 4,
          advancement_per_group: 2,
          best_of_sets: 3
        }
      });

      alert('Turnier erfolgreich erstellt!');
    } catch (err) {
      console.error('Error creating tournament:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const tournamentModes = [
    { value: 'knockout', label: 'K.O.-System', icon: '🏆', description: 'Direktes Ausscheiden bei Niederlage' },
    { value: 'round_robin', label: 'Jeder gegen Jeden', icon: '🔄', description: 'Alle spielen gegeneinander' },
    { value: 'groups_knockout', label: 'Gruppen + K.O.', icon: '⚽', description: 'Vorrunde in Gruppen, dann K.O.' },
    { value: 'swiss', label: 'Schweizer System', icon: '🇨🇭', description: 'Dynamische Paarungen nach Punkten' }
  ];

  const participantSizes = [4, 8, 16, 32, 64, 128];

  return (
    <div style={{ 
      maxWidth: 800, 
      margin: '0 auto', 
      padding: 24,
      background: 'rgba(8, 28, 25, 0.95)',
      borderRadius: 16,
      border: '1px solid #debc7c33'
    }}>
      <h2 style={{ 
        color: '#debc7c', 
        marginBottom: 24,
        fontSize: 28,
        fontWeight: 700
      }}>
        Turnier erstellen
      </h2>

      {/* Progress Steps */}
      <div style={{ 
        display: 'flex', 
        gap: 12, 
        marginBottom: 32,
        justifyContent: 'center'
      }}>
        {[1, 2, 3, 4].map(s => (
          <div
            key={s}
            style={{
              width: 40,
              height: 40,
              borderRadius: '50%',
              background: step >= s ? '#debc7c' : '#102820',
              border: step === s ? '2px solid #debc7c' : '1px solid #debc7c44',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: step >= s ? '#102820' : '#debc7c',
              fontWeight: 700,
              cursor: 'pointer',
              transition: 'all 0.3s ease'
            }}
            onClick={() => setStep(s)}
          >
            {s}
          </div>
        ))}
      </div>

      {error && (
        <div style={{
          padding: 12,
          background: '#ff444433',
          border: '1px solid #ff4444',
          borderRadius: 8,
          color: '#ff8888',
          marginBottom: 16
        }}>
          {error}
        </div>
      )}

      {/* Step 1: Basic Info */}
      {step === 1 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <h3 style={{ color: '#debc7c', fontSize: 20 }}>1. Grundinformationen</h3>
          
          <div>
            <label style={{ display: 'block', color: '#debc7c', marginBottom: 8, fontWeight: 600 }}>
              Turniername *
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => handleChange('name', e.target.value)}
              placeholder="z.B. Stadtmeisterschaft Tennis 2026"
              style={{
                width: '100%',
                padding: 12,
                background: '#102820',
                border: '1px solid #debc7c44',
                borderRadius: 8,
                color: '#fff',
                fontSize: 16
              }}
            />
          </div>

          <div>
            <label style={{ display: 'block', color: '#debc7c', marginBottom: 8, fontWeight: 600 }}>
              Beschreibung
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => handleChange('description', e.target.value)}
              placeholder="Beschreibe dein Turnier..."
              rows={4}
              style={{
                width: '100%',
                padding: 12,
                background: '#102820',
                border: '1px solid #debc7c44',
                borderRadius: 8,
                color: '#fff',
                fontSize: 16,
                resize: 'vertical'
              }}
            />
          </div>

          <div>
            <label style={{ display: 'block', color: '#debc7c', marginBottom: 8, fontWeight: 600 }}>
              Sportart *
            </label>
            <select
              value={formData.sport_id}
              onChange={(e) => handleChange('sport_id', e.target.value)}
              style={{
                width: '100%',
                padding: 12,
                background: '#102820',
                border: '1px solid #debc7c44',
                borderRadius: 8,
                color: '#fff',
                fontSize: 16
              }}
            >
              <option value="">-- Sportart wählen --</option>
              {sports.map(sport => (
                <option key={sport.id} value={sport.id}>
                  {sport.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label style={{ display: 'block', color: '#debc7c', marginBottom: 8, fontWeight: 600 }}>
              Stadt
            </label>
            <select
              value={formData.city_id}
              onChange={(e) => handleChange('city_id', e.target.value)}
              style={{
                width: '100%',
                padding: 12,
                background: '#102820',
                border: '1px solid #debc7c44',
                borderRadius: 8,
                color: '#fff',
                fontSize: 16
              }}
            >
              <option value="">-- Stadt wählen --</option>
              {cities.map(city => (
                <option key={city.id} value={city.id}>
                  {city.name}
                </option>
              ))}
            </select>
          </div>

          <button
            onClick={() => setStep(2)}
            disabled={!formData.name || !formData.sport_id}
            style={{
              padding: '14px 24px',
              background: (!formData.name || !formData.sport_id) ? '#666' : '#debc7c',
              color: '#102820',
              border: 'none',
              borderRadius: 8,
              fontSize: 16,
              fontWeight: 700,
              cursor: (!formData.name || !formData.sport_id) ? 'not-allowed' : 'pointer',
              marginTop: 16
            }}
          >
            Weiter →
          </button>
        </div>
      )}

      {/* Step 2: Tournament Mode */}
      {step === 2 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <h3 style={{ color: '#debc7c', fontSize: 20 }}>2. Turnier-Modus</h3>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16 }}>
            {tournamentModes.map(mode => (
              <div
                key={mode.value}
                onClick={() => handleChange('tournament_mode', mode.value)}
                style={{
                  padding: 20,
                  background: formData.tournament_mode === mode.value ? '#debc7c22' : '#102820',
                  border: formData.tournament_mode === mode.value ? '2px solid #debc7c' : '1px solid #debc7c44',
                  borderRadius: 12,
                  cursor: 'pointer',
                  transition: 'all 0.3s ease',
                  textAlign: 'center'
                }}
              >
                <div style={{ fontSize: 32, marginBottom: 8 }}>{mode.icon}</div>
                <div style={{ color: '#debc7c', fontWeight: 700, marginBottom: 4 }}>{mode.label}</div>
                <div style={{ color: '#aaa', fontSize: 13 }}>{mode.description}</div>
              </div>
            ))}
          </div>

          {/* Config based on mode */}
          {formData.tournament_mode === 'groups_knockout' && (
            <div style={{ marginTop: 16 }}>
              <label style={{ display: 'block', color: '#debc7c', marginBottom: 8, fontWeight: 600 }}>
                Gruppengröße
              </label>
              <select
                value={formData.tournament_config.group_size}
                onChange={(e) => handleConfigChange('group_size', parseInt(e.target.value))}
                style={{
                  width: '100%',
                  padding: 12,
                  background: '#102820',
                  border: '1px solid #debc7c44',
                  borderRadius: 8,
                  color: '#fff',
                  fontSize: 16
                }}
              >
                <option value="3">3 Teams pro Gruppe</option>
                <option value="4">4 Teams pro Gruppe</option>
                <option value="5">5 Teams pro Gruppe</option>
              </select>
            </div>
          )}

          <div style={{ display: 'flex', gap: 12, marginTop: 16 }}>
            <button
              onClick={() => setStep(1)}
              style={{
                flex: 1,
                padding: '14px 24px',
                background: 'transparent',
                color: '#debc7c',
                border: '1px solid #debc7c',
                borderRadius: 8,
                fontSize: 16,
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              ← Zurück
            </button>
            <button
              onClick={() => setStep(3)}
              style={{
                flex: 1,
                padding: '14px 24px',
                background: '#debc7c',
                color: '#102820',
                border: 'none',
                borderRadius: 8,
                fontSize: 16,
                fontWeight: 700,
                cursor: 'pointer'
              }}
            >
              Weiter →
            </button>
          </div>
        </div>
      )}

      {/* Step 3: Participants & Schedule */}
      {step === 3 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <h3 style={{ color: '#debc7c', fontSize: 20 }}>3. Teilnehmer & Termine</h3>

          <div>
            <label style={{ display: 'block', color: '#debc7c', marginBottom: 8, fontWeight: 600 }}>
              Max. Teilnehmer *
            </label>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {participantSizes.map(size => (
                <button
                  key={size}
                  onClick={() => handleChange('max_participants', size)}
                  style={{
                    padding: '10px 20px',
                    background: formData.max_participants === size ? '#debc7c' : '#102820',
                    color: formData.max_participants === size ? '#102820' : '#debc7c',
                    border: formData.max_participants === size ? 'none' : '1px solid #debc7c44',
                    borderRadius: 8,
                    fontWeight: 600,
                    cursor: 'pointer'
                  }}
                >
                  {size}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label style={{ display: 'block', color: '#debc7c', marginBottom: 8, fontWeight: 600 }}>
              Anmeldeschluss
            </label>
            <input
              type="datetime-local"
              value={formData.registration_deadline}
              onChange={(e) => handleChange('registration_deadline', e.target.value)}
              style={{
                width: '100%',
                padding: 12,
                background: '#102820',
                border: '1px solid #debc7c44',
                borderRadius: 8,
                color: '#fff',
                fontSize: 16
              }}
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div>
              <label style={{ display: 'block', color: '#debc7c', marginBottom: 8, fontWeight: 600 }}>
                Startdatum
              </label>
              <input
                type="date"
                value={formData.start_date}
                onChange={(e) => handleChange('start_date', e.target.value)}
                style={{
                  width: '100%',
                  padding: 12,
                  background: '#102820',
                  border: '1px solid #debc7c44',
                  borderRadius: 8,
                  color: '#fff',
                  fontSize: 16
                }}
              />
            </div>
            <div>
              <label style={{ display: 'block', color: '#debc7c', marginBottom: 8, fontWeight: 600 }}>
                Enddatum
              </label>
              <input
                type="date"
                value={formData.end_date}
                onChange={(e) => handleChange('end_date', e.target.value)}
                style={{
                  width: '100%',
                  padding: 12,
                  background: '#102820',
                  border: '1px solid #debc7c44',
                  borderRadius: 8,
                  color: '#fff',
                  fontSize: 16
                }}
              />
            </div>
          </div>

          <div style={{ display: 'flex', gap: 12, marginTop: 16 }}>
            <button
              onClick={() => setStep(2)}
              style={{
                flex: 1,
                padding: '14px 24px',
                background: 'transparent',
                color: '#debc7c',
                border: '1px solid #debc7c',
                borderRadius: 8,
                fontSize: 16,
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              ← Zurück
            </button>
            <button
              onClick={() => setStep(4)}
              style={{
                flex: 1,
                padding: '14px 24px',
                background: '#debc7c',
                color: '#102820',
                border: 'none',
                borderRadius: 8,
                fontSize: 16,
                fontWeight: 700,
                cursor: 'pointer'
              }}
            >
              Weiter →
            </button>
          </div>
        </div>
      )}

      {/* Step 4: Venue & Ruleset */}
      {step === 4 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <h3 style={{ color: '#debc7c', fontSize: 20 }}>4. Austragungsort & Regeln</h3>

          <div>
            <label style={{ display: 'block', color: '#debc7c', marginBottom: 8, fontWeight: 600 }}>
              Austragungsort
            </label>
            <input
              type="text"
              value={formData.venue_name}
              onChange={(e) => handleChange('venue_name', e.target.value)}
              placeholder="z.B. Sportzentrum Ost"
              style={{
                width: '100%',
                padding: 12,
                background: '#102820',
                border: '1px solid #debc7c44',
                borderRadius: 8,
                color: '#fff',
                fontSize: 16
              }}
            />
          </div>

          <div>
            <label style={{ display: 'block', color: '#debc7c', marginBottom: 8, fontWeight: 600 }}>
              Adresse
            </label>
            <input
              type="text"
              value={formData.venue_address}
              onChange={(e) => handleChange('venue_address', e.target.value)}
              placeholder="Straße, Hausnummer, PLZ Stadt"
              style={{
                width: '100%',
                padding: 12,
                background: '#102820',
                border: '1px solid #debc7c44',
                borderRadius: 8,
                color: '#fff',
                fontSize: 16
              }}
            />
          </div>

          {rulesets.length > 0 && (
            <div>
              <label style={{ display: 'block', color: '#debc7c', marginBottom: 8, fontWeight: 600 }}>
                Regelwerk
              </label>
              <select
                value={formData.ruleset_id}
                onChange={(e) => handleChange('ruleset_id', e.target.value)}
                style={{
                  width: '100%',
                  padding: 12,
                  background: '#102820',
                  border: '1px solid #debc7c44',
                  borderRadius: 8,
                  color: '#fff',
                  fontSize: 16
                }}
              >
                <option value="">-- Standard-Regelwerk --</option>
                {rulesets.map(ruleset => (
                  <option key={ruleset.id} value={ruleset.id}>
                    {ruleset.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div style={{ display: 'flex', gap: 12, marginTop: 16 }}>
            <button
              onClick={() => setStep(3)}
              style={{
                flex: 1,
                padding: '14px 24px',
                background: 'transparent',
                color: '#debc7c',
                border: '1px solid #debc7c',
                borderRadius: 8,
                fontSize: 16,
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              ← Zurück
            </button>
            <button
              onClick={handleSubmit}
              disabled={loading}
              style={{
                flex: 1,
                padding: '14px 24px',
                background: loading ? '#666' : '#debc7c',
                color: '#102820',
                border: 'none',
                borderRadius: 8,
                fontSize: 16,
                fontWeight: 700,
                cursor: loading ? 'not-allowed' : 'pointer'
              }}
            >
              {loading ? 'Erstelle...' : 'Turnier erstellen ✓'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
