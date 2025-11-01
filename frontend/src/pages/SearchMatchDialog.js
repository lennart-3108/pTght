import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { API_BASE } from '../config';
import Avatar from '../components/Avatar';

export default function SearchMatchDialog() {
  const navigate = useNavigate();
  const [sp, setSp] = useSearchParams();
  const [sports, setSports] = useState([]);
  const [cities, setCities] = useState([]);
  const [searching, setSearching] = useState(false);
  const [rows, setRows] = useState([]);
  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
  const authed = !!token;

  // local state reflects query params
  const [sportId, setSportId] = useState(sp.get('sportId') || '');
  const [countryId, setCountryId] = useState(sp.get('countryId') || '');
  const [stateId, setStateId] = useState(sp.get('stateId') || '');
  const [cityId, setCityId] = useState(sp.get('cityId') || '');

  // create match modal
  const [showCreate, setShowCreate] = useState(false);
  const [myLeagues, setMyLeagues] = useState([]);
  const [cmSportId, setCmSportId] = useState('');
  const [cmCountryId, setCmCountryId] = useState('');
  const [cmStateId, setCmStateId] = useState('');
  const [cmCityId, setCmCityId] = useState('');
  const [cmWhenType, setCmWhenType] = useState(''); // 'exact' | 'range' | 'fixed'
  const [cmExactDate, setCmExactDate] = useState('');
  const [cmExactTime, setCmExactTime] = useState('14:00');
  const [cmRangeDays, setCmRangeDays] = useState(7);
  const [cmFixedStart, setCmFixedStart] = useState('');
  const [cmFixedEnd, setCmFixedEnd] = useState('');
  const [cmWhen, setCmWhen] = useState(''); // ISO for datetime-local (computed)
  const [cmType, setCmType] = useState('Liga'); // Liga | Freundschaft | Herausforderung
  const [creating, setCreating] = useState(false);
  const [createErr, setCreateErr] = useState('');
  const [availableLocations, setAvailableLocations] = useState([]);
  const [loadingLocations, setLoadingLocations] = useState(false);

  useEffect(() => {
    let mounted = true;
    Promise.all([
      fetch(`${API_BASE}/sports/list`).then(r => r.ok ? r.json() : []),
      fetch(`${API_BASE}/cities/list`).then(r => r.ok ? r.json() : []),
    ]).then(([ss, cs]) => {
      if (!mounted) return;
      setSports(Array.isArray(ss) ? ss : []);
      setCities(Array.isArray(cs) ? cs : []);
    });
    return () => { mounted = false; };
  }, []);

  // Load available locations when sport, city, and datetime are selected
  useEffect(() => {
    if (!cmSportId || !cmCityId || !cmWhen) {
      setAvailableLocations([]);
      return;
    }

    let mounted = true;
    setLoadingLocations(true);

    const params = new URLSearchParams({
      sport_id: cmSportId,
      city_id: cmCityId,
      datetime: cmWhen,
      duration: 60 // Default 60 minutes
    });

    fetch(`${API_BASE}/locations/availability?${params.toString()}`)
      .then(r => {
        if (!r.ok) throw new Error('Failed to load availability');
        return r.json();
      })
      .then(data => {
        if (!mounted) return;
        setAvailableLocations(Array.isArray(data) ? data : []);
        setLoadingLocations(false);
      })
      .catch(err => {
        console.error('Availability error:', err);
        if (!mounted) return;
        setAvailableLocations([]);
        setLoadingLocations(false);
      });

    return () => { mounted = false; };
  }, [cmSportId, cmCityId, cmWhen]);

  const countries = useMemo(() => {
    return [...new Map(cities.filter(c => c.countryId).map(c => [c.countryId, { id: c.countryId, name: c.countryName }])).values()];
  }, [cities]);
  const states = useMemo(() => {
    return [...new Map(cities.filter(c => (!countryId || String(c.countryId) === String(countryId)) && c.stateId).map(c => [c.stateId, { id: c.stateId, name: c.stateName }])).values()];
  }, [cities, countryId]);
  const filteredCities = useMemo(() => {
    return cities.filter(c => (!countryId || String(c.countryId) === String(countryId)) && (!stateId || String(c.stateId) === String(stateId)));
  }, [cities, countryId, stateId]);

  // For create match modal
  const cmCountries = useMemo(() => {
    return [...new Map(cities.filter(c => c.countryId).map(c => [c.countryId, { id: c.countryId, name: c.countryName }])).values()];
  }, [cities]);
  const cmStates = useMemo(() => {
    return [...new Map(cities.filter(c => (!cmCountryId || String(c.countryId) === String(cmCountryId)) && c.stateId).map(c => [c.stateId, { id: c.stateId, name: c.stateName }])).values()];
  }, [cities, cmCountryId]);
  const cmFilteredCities = useMemo(() => {
    return cities.filter(c => (!cmCountryId || String(c.countryId) === String(cmCountryId)) && (!cmStateId || String(c.stateId) === String(cmStateId)));
  }, [cities, cmCountryId, cmStateId]);

  async function runSearch(paramsOverride) {
    const qp = new URLSearchParams({
      ...(sportId ? { sportId } : {}),
      ...(countryId ? { countryId } : {}),
      ...(stateId ? { stateId } : {}),
      ...(cityId ? { cityId } : {}),
      ...(paramsOverride || {}),
    });
    // keep URL in sync
    setSp(qp, { replace: true });
    setSearching(true);
    try {
      const res = await fetch(`${API_BASE}/open-matches?${qp.toString()}`);
      const data = await res.json();
      setRows(Array.isArray(data) ? data : []);
    } finally {
      setSearching(false);
    }
  }

  // auto-run search on mount if any param present
  useEffect(() => {
    const had = sp.get('sportId') || sp.get('countryId') || sp.get('stateId') || sp.get('cityId');
    if (had) runSearch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // open modal → prefill and load user's leagues
  function openCreate() {
    setCreateErr('');
    setCmSportId(sportId || '');
    setCmCityId(cityId || '');
  // no league selection for open matches
    setCmWhen('');
    setCmType('Liga');
    setShowCreate(true);
    if (authed) {
      fetch(`${API_BASE}/me/leagues`, { headers: { Authorization: `Bearer ${token}` } })
        .then(r => r.ok ? r.json() : [])
        .then(ls => setMyLeagues(Array.isArray(ls) ? ls : []))
        .catch(() => setMyLeagues([]));
    }
  }

  function closeCreate() { setShowCreate(false); }

  const leaguesFiltered = useMemo(() => [], []);

  async function handleCreate() {
    if (!authed) { setCreateErr('Bitte zuerst anmelden.'); return; }
    if (!cmSportId || !cmCityId) {
      setCreateErr('Bitte Sportart und Stadt auswählen.');
      return;
    }
    try {
      setCreating(true);
      setCreateErr('');
      // Create league-less open friendly match
      const resp = await fetch(`${API_BASE}/open-matches`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ sportId: Number(cmSportId), cityId: Number(cmCityId), kickoff_at: cmWhen ? new Date(cmWhen).toISOString() : null })
      });
      if (!resp.ok) {
        const t = await resp.json().catch(() => ({}));
        throw new Error(t.error || 'Konnte Match nicht erstellen');
      }
      const match = await resp.json();
      setShowCreate(false);
      navigate(`/matches/${match.id}`);
    } catch (e) {
      setCreateErr(e?.message || 'Fehler beim Erstellen');
    } finally {
      setCreating(false);
    }
  }

  return (
    <div style={{ maxWidth: 1000, margin: '20px auto', padding: 16 }}>
      <h1 style={{ marginTop: 0 }}>Match suchen</h1>
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center', marginBottom: 12 }}>
        <select value={sportId} onChange={(e) => setSportId(e.target.value)} style={{ padding: '10px 14px', borderRadius: 10, border: 'none', background: '#113528', color: '#e8efe8' }}>
          <option value="">Sportart</option>
          {sports.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        <select value={countryId} onChange={(e) => setCountryId(e.target.value)} style={{ padding: '10px 14px', borderRadius: 10, border: 'none', background: '#113528', color: '#e8efe8' }}>
          <option value="">Land</option>
          {countries.map(co => <option key={co.id} value={co.id}>{co.name}</option>)}
        </select>
        <select value={stateId} onChange={(e) => setStateId(e.target.value)} style={{ padding: '10px 14px', borderRadius: 10, border: 'none', background: '#113528', color: '#e8efe8' }}>
          <option value="">Bundesstaat</option>
          {states.map(st => <option key={st.id} value={st.id}>{st.name}</option>)}
        </select>
        <select value={cityId} onChange={(e) => setCityId(e.target.value)} style={{ padding: '10px 14px', borderRadius: 10, border: 'none', background: '#113528', color: '#e8efe8' }}>
          <option value="">Stadt</option>
          {filteredCities.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <button onClick={() => runSearch()} disabled={searching} style={{ background: '#debc7c', color: '#10261f', padding: '10px 18px', borderRadius: 10, border: 'none', cursor: 'pointer', fontWeight: 700 }}>{searching ? 'Suche…' : 'Suchen'}</button>
        <span style={{ flex: 1 }} />
        <button onClick={openCreate} disabled={!authed} className="btn-primary" style={{ background: '#0e2f2d', border: '1px solid #2f6b57' }}>{authed ? 'Match erstellen' : 'Einloggen um zu erstellen'}</button>
      </div>

      <div style={{ display: 'grid', gap: 10 }}>
        {rows.length === 0 ? (
          <div style={{ color: '#9db' }}>Keine offenen Matches gefunden.</div>
        ) : rows.map(m => {
          const aName = m.home || m.home_name || 'A';
          const bName = m.away || m.away_name || 'Gegner gesucht';
          const status = (m.status || 'Ausstehend');
          
          // Format date
          let dateText = 'Datum: offen';
          if (m.kickoff_at) {
            try {
              const date = new Date(m.kickoff_at);
              dateText = `Datum: ${date.toLocaleDateString('de-DE')} ${date.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}`;
            } catch (e) {
              dateText = 'Datum: offen';
            }
          }
          
          return (
            <div key={m.id} className="ml-card" style={{ display: 'grid', gap: 10 }}>
              {/* Header row: league/sport and status */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', alignItems: 'center' }}>
                <div style={{ fontWeight: 700 }}>
                  {m.league || 'Open Match'}
                  {m.sport ? <span style={{ color: '#9db' }}> · {m.sport}</span> : null}
                </div>
                <div className="ml-chip"><span className="ml-status-dot" /> {status}</div>
              </div>

              {/* VS layout */}
              <div className="ml-match">
                {/* Left side */}
                <div className="ml-match__side">
                  <Avatar userId={m.home_id} name={aName} size={64} />
                  <div>
                    <div style={{ fontWeight: 700 }}>{aName}</div>
                    <div style={{ color: '#9db', fontSize: 12 }}>—</div>
                  </div>
                </div>

                {/* VS */}
                <div style={{ textAlign: 'center' }}><div className="ml-vs">VS</div></div>

                {/* Right side */}
                <div className="ml-match__side" style={{ justifyContent: 'end' }}>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontWeight: 700 }}>{bName}</div>
                    <div style={{ color: '#9db', fontSize: 12 }}>—</div>
                  </div>
                  <Avatar userId={m.away_id} name={bName} size={64} />
                </div>
              </div>

              {/* Footer: date + location + details */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', alignItems: 'center', gap: 10 }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <div style={{ color: '#9db', fontSize: 12 }}>{dateText}</div>
                  <div style={{ color: '#9db' }}>{[m.city, m.state, m.country].filter(Boolean).join(' · ')}</div>
                </div>
                <div>
                  <Link to={`/matches/${m.id}`} className="ml-btn-secondary">Details</Link>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Centered secondary create button as in mock */}
      <div style={{ marginTop: 18, display: 'flex', justifyContent: 'center' }}>
        <button onClick={openCreate} disabled={!authed} style={{ 
          padding: '12px 18px', 
          background: '#dEBC7C', 
          color: '#10261f', 
          borderRadius: '10px', 
          border: 'none', 
          cursor: !authed ? 'not-allowed' : 'pointer', 
          fontWeight: 700,
          opacity: !authed ? 0.6 : 1
        }}>Eigenes Match eröffnen</button>
      </div>

      {/* Create Match Modal */}
      {showCreate && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'grid', placeItems: 'center', zIndex: 1000, padding: '20px' }} onClick={closeCreate}>
          <div className="ml-card" style={{ width: 600, maxWidth: '100%', maxHeight: '90vh', overflowY: 'auto' }} onClick={(e) => e.stopPropagation()}>
            {/* Header */}
            <div style={{ marginBottom: 20, paddingBottom: 16, borderBottom: '1px solid #1a3c33' }}>
              <h2 style={{ margin: '0 0 6px 0', fontSize: 22, fontWeight: 700 }}>Öffentliches Match erstellen</h2>
              <p style={{ margin: 0, color: '#9db', fontSize: 14, lineHeight: 1.4 }}>
                Erstelle ein öffentliches Match, das andere Spieler finden und beitreten können.
              </p>
            </div>

            <div style={{ display: 'grid', gap: 20 }}>
              {/* 1. Sport und Ort */}
              <div style={{ display: 'grid', gap: 10 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ 
                    width: 28, 
                    height: 28, 
                    borderRadius: '50%', 
                    background: cmSportId && cmCityId ? '#debc7c' : '#2f6b57', 
                    color: cmSportId && cmCityId ? '#10261f' : '#e8efe8',
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'center', 
                    fontWeight: 700,
                    fontSize: 14
                  }}>1</div>
                  <span style={{ fontWeight: 700, fontSize: 16, color: '#debc7c' }}>Sport und Ort</span>
                </div>
                
                <div style={{ display: 'grid', gap: 10, marginLeft: 36 }}>
                  <select value={cmSportId} onChange={(e)=>setCmSportId(e.target.value)} style={{ padding: '12px 14px', borderRadius: 10, border: '2px solid #2f6b57', background: '#0e2a22', color: '#e8efe8', fontSize: 14, fontWeight: 500 }}>
                    <option value="">🏃 Sportart wählen</option>
                    {sports.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                  
                  <select value={cmCountryId} onChange={(e)=>{setCmCountryId(e.target.value); setCmStateId(''); setCmCityId('');}} style={{ padding: '12px 14px', borderRadius: 10, border: '2px solid #2f6b57', background: '#0e2a22', color: '#e8efe8', fontSize: 14, fontWeight: 500 }}>
                    <option value="">🌍 Land wählen</option>
                    {cmCountries.map(co => <option key={co.id} value={co.id}>{co.name}</option>)}
                  </select>

                  {cmCountryId && (
                    <select value={cmStateId} onChange={(e)=>{setCmStateId(e.target.value); setCmCityId('');}} style={{ padding: '12px 14px', borderRadius: 10, border: '2px solid #2f6b57', background: '#0e2a22', color: '#e8efe8', fontSize: 14, fontWeight: 500 }}>
                      <option value="">📍 Bundesstaat wählen</option>
                      {cmStates.map(st => <option key={st.id} value={st.id}>{st.name}</option>)}
                    </select>
                  )}

                  {(cmCountryId || cmStateId) && (
                    <select value={cmCityId} onChange={(e)=>setCmCityId(e.target.value)} style={{ padding: '12px 14px', borderRadius: 10, border: '2px solid #2f6b57', background: '#0e2a22', color: '#e8efe8', fontSize: 14, fontWeight: 500 }}>
                      <option value="">🏙️ Stadt wählen</option>
                      {cmFilteredCities.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  )}
                </div>
              </div>

              {/* 2. Level */}
              <div style={{ display: 'grid', gap: 10 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ 
                    width: 28, 
                    height: 28, 
                    borderRadius: '50%', 
                    background: cmType ? '#debc7c' : '#2f6b57', 
                    color: cmType ? '#10261f' : '#e8efe8',
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'center', 
                    fontWeight: 700,
                    fontSize: 14
                  }}>2</div>
                  <span style={{ fontWeight: 700, fontSize: 16, color: '#debc7c' }}>Level</span>
                </div>
                
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginLeft: 36 }}>
                  {['Liga','Freundschaft','Herausforderung'].map(t => (
                    <button key={t} type="button" onClick={()=>setCmType(t)} style={{ 
                      padding: '12px 10px', 
                      borderRadius: 8, 
                      border: cmType===t ? '2px solid #debc7c' : '2px solid #2f6b57', 
                      background: cmType===t ? '#1a3c33' : '#0e2a22',
                      color: cmType===t ? '#debc7c' : '#e8efe8',
                      cursor: 'pointer',
                      fontWeight: 600,
                      fontSize: 13,
                      transition: 'all 0.2s'
                    }}>{t}</button>
                  ))}
                </div>
              </div>

              {/* 3. Gewünschter Zeitpunkt */}
              <div style={{ display: 'grid', gap: 10 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ 
                    width: 28, 
                    height: 28, 
                    borderRadius: '50%', 
                    background: cmWhenType ? '#debc7c' : '#2f6b57', 
                    color: cmWhenType ? '#10261f' : '#e8efe8',
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'center', 
                    fontWeight: 700,
                    fontSize: 14
                  }}>3</div>
                  <span style={{ fontWeight: 700, fontSize: 16, color: '#debc7c' }}>Gewünschter Zeitpunkt</span>
                </div>
                
                {/* Wann-Typ Auswahl */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginLeft: 36 }}>
                  <button 
                    type="button"
                    onClick={() => setCmWhenType('exact')}
                    style={{
                      padding: '14px 8px',
                      borderRadius: 10,
                      border: cmWhenType === 'exact' ? '2px solid #debc7c' : '2px solid #2f6b57',
                      background: cmWhenType === 'exact' ? '#1a3c33' : '#0e2a22',
                      color: cmWhenType === 'exact' ? '#debc7c' : '#e8efe8',
                      cursor: 'pointer',
                      fontWeight: 600,
                      fontSize: 13,
                      textAlign: 'center',
                      transition: 'all 0.2s',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 4
                    }}
                  >
                    <div style={{ fontSize: 20 }}>📅</div>
                    <div>Exakt</div>
                  </button>
                  <button 
                    type="button"
                    onClick={() => setCmWhenType('range')}
                    style={{
                      padding: '14px 8px',
                      borderRadius: 10,
                      border: cmWhenType === 'range' ? '2px solid #debc7c' : '2px solid #2f6b57',
                      background: cmWhenType === 'range' ? '#1a3c33' : '#0e2a22',
                      color: cmWhenType === 'range' ? '#debc7c' : '#e8efe8',
                      cursor: 'pointer',
                      fontWeight: 600,
                      fontSize: 13,
                      textAlign: 'center',
                      transition: 'all 0.2s',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 4
                    }}
                  >
                    <div style={{ fontSize: 20 }}>📆</div>
                    <div>Zeitraum</div>
                  </button>
                  <button 
                    type="button"
                    onClick={() => setCmWhenType('fixed')}
                    style={{
                      padding: '14px 8px',
                      borderRadius: 10,
                      border: cmWhenType === 'fixed' ? '2px solid #debc7c' : '2px solid #2f6b57',
                      background: cmWhenType === 'fixed' ? '#1a3c33' : '#0e2a22',
                      color: cmWhenType === 'fixed' ? '#debc7c' : '#e8efe8',
                      cursor: 'pointer',
                      fontWeight: 600,
                      fontSize: 13,
                      textAlign: 'center',
                      transition: 'all 0.2s',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 4
                    }}
                  >
                    <div style={{ fontSize: 20 }}>🗓️</div>
                    <div>Zeitfenster</div>
                  </button>
                </div>

                {/* Option 1: Exaktes Datum & Uhrzeit */}
                {cmWhenType === 'exact' && (
                  <div style={{ marginLeft: 36, padding: 14, background: 'rgba(26, 60, 51, 0.3)', borderRadius: 10, border: '1px solid #2f6b57' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 10 }}>
                      <div>
                        <label style={{ display: 'block', fontSize: 12, color: '#9db', marginBottom: 6, fontWeight: 600 }}>Datum</label>
                        <input 
                          type="date" 
                          value={cmExactDate} 
                          onChange={(e) => setCmExactDate(e.target.value)}
                          min={new Date().toISOString().split('T')[0]}
                          style={{ padding: '10px 12px', borderRadius: 8, border: '2px solid #2f6b57', background: '#0e2a22', color: '#e8efe8', fontSize: 14, width: '100%' }} 
                        />
                      </div>
                      <div>
                        <label style={{ display: 'block', fontSize: 12, color: '#9db', marginBottom: 6, fontWeight: 600 }}>Uhrzeit</label>
                        <input 
                          type="time" 
                          value={cmExactTime} 
                          onChange={(e) => setCmExactTime(e.target.value)}
                          style={{ padding: '10px 12px', borderRadius: 8, border: '2px solid #2f6b57', background: '#0e2a22', color: '#e8efe8', fontSize: 14, width: '100%' }} 
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* Option 2: Zeitraum */}
                {cmWhenType === 'range' && (
                  <div style={{ marginLeft: 36, padding: 14, background: 'rgba(26, 60, 51, 0.3)', borderRadius: 10, border: '1px solid #2f6b57' }}>
                    <div style={{ fontSize: 12, color: '#9db', marginBottom: 10, fontWeight: 600 }}>In den nächsten:</div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
                      {[
                        { label: '3 Tage', days: 3 },
                        { label: '7 Tage', days: 7 },
                        { label: '14 Tage', days: 14 },
                        { label: '1 Monat', days: 30 },
                        { label: '2 Monate', days: 60 },
                        { label: '3 Monate', days: 90 },
                      ].map(opt => (
                        <button
                          key={opt.days}
                          type="button"
                          onClick={() => setCmRangeDays(opt.days)}
                          style={{
                            padding: '10px 8px',
                            borderRadius: 8,
                            border: cmRangeDays === opt.days ? '2px solid #debc7c' : '2px solid #2f6b57',
                            background: cmRangeDays === opt.days ? '#1a3c33' : '#0e2a22',
                            color: cmRangeDays === opt.days ? '#debc7c' : '#e8efe8',
                            cursor: 'pointer',
                            fontSize: 13,
                            fontWeight: 600,
                            transition: 'all 0.2s'
                          }}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Option 3: Zeitfenster */}
                {cmWhenType === 'fixed' && (
                  <div style={{ marginLeft: 36, padding: 14, background: 'rgba(26, 60, 51, 0.3)', borderRadius: 10, border: '1px solid #2f6b57' }}>
                    <div style={{ display: 'grid', gap: 10 }}>
                      <div>
                        <label style={{ display: 'block', fontSize: 12, color: '#9db', marginBottom: 6, fontWeight: 600 }}>Von (Start-Datum)</label>
                        <input 
                          type="date" 
                          value={cmFixedStart} 
                          onChange={(e) => setCmFixedStart(e.target.value)}
                          min={new Date().toISOString().split('T')[0]}
                          style={{ padding: '10px 12px', borderRadius: 8, border: '2px solid #2f6b57', background: '#0e2a22', color: '#e8efe8', fontSize: 14, width: '100%' }} 
                        />
                      </div>
                      <div>
                        <label style={{ display: 'block', fontSize: 12, color: '#9db', marginBottom: 6, fontWeight: 600 }}>Bis (End-Datum)</label>
                        <input 
                          type="date" 
                          value={cmFixedEnd} 
                          onChange={(e) => setCmFixedEnd(e.target.value)}
                          min={cmFixedStart || new Date().toISOString().split('T')[0]}
                          style={{ padding: '10px 12px', borderRadius: 8, border: '2px solid #2f6b57', background: '#0e2a22', color: '#e8efe8', fontSize: 14, width: '100%' }} 
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Available Locations */}
              {cmSportId && cmCityId && cmWhen && (
                <div style={{ marginTop: 8 }}>
                  <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 12, color: '#debc7c' }}>
                    Verfügbare Plätze
                  </h3>

                  {loadingLocations && (
                    <div style={{ padding: 16, textAlign: 'center', color: '#9db', fontSize: 14 }}>
                      Suche verfügbare Plätze...
                    </div>
                  )}

                  {!loadingLocations && availableLocations.length === 0 && (
                    <div style={{ padding: 16, textAlign: 'center', color: '#9db', fontSize: 14 }}>
                      Keine freien Plätze für diese Auswahl verfügbar
                    </div>
                  )}

                  {!loadingLocations && availableLocations.length > 0 && (
                    <div style={{ display: 'grid', gap: 10 }}>
                      {availableLocations.map(loc => {
                        const photos = loc.photos ? (typeof loc.photos === 'string' ? JSON.parse(loc.photos) : loc.photos) : [];
                        const firstPhoto = photos.length > 0 ? photos[0] : null;
                        const priceText = loc.hourly_rate ? `${loc.hourly_rate}€/h` : 'Preis auf Anfrage';

                        return (
                          <div 
                            key={loc.id}
                            style={{
                              padding: 12,
                              border: '2px solid #2f6b57',
                              borderRadius: 10,
                              background: '#0b1e19',
                              display: 'flex',
                              gap: 12,
                              alignItems: 'center'
                            }}
                          >
                            {firstPhoto && (
                              <img 
                                src={firstPhoto} 
                                alt={loc.name}
                                style={{
                                  width: 50,
                                  height: 50,
                                  borderRadius: 8,
                                  objectFit: 'cover',
                                  border: '1px solid #2f6b57'
                                }}
                              />
                            )}
                            <div style={{ flex: 1 }}>
                              <div style={{ fontWeight: 700, fontSize: 14, color: '#e8efe8', marginBottom: 3 }}>
                                {loc.name}
                              </div>
                              {loc.address && (
                                <div style={{ fontSize: 12, color: '#9db', marginBottom: 4 }}>
                                  {loc.address}
                                </div>
                              )}
                              <div style={{ fontSize: 13, color: '#debc7c', fontWeight: 600 }}>
                                {loc.available_slots} {loc.available_slots === 1 ? 'freier Platz' : 'freie Plätze'} • {priceText}
                              </div>
                            </div>
                            <button
                              onClick={() => {
                                // TODO: Implement booking logic
                                alert(`Platz bei ${loc.name} buchen`);
                              }}
                              style={{
                                background: '#debc7c',
                                color: '#0e2a22',
                                border: 'none',
                                padding: '8px 16px',
                                borderRadius: 8,
                                fontWeight: 700,
                                cursor: 'pointer',
                                fontSize: 13,
                                whiteSpace: 'nowrap'
                              }}
                            >
                              Platz buchen
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* Error Message */}
              {createErr && (
                <div style={{ padding: 12, background: '#4a1a1a', border: '1px solid #8a2a2a', borderRadius: 10, color: '#ffa5a5', fontSize: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 18 }}>⚠️</span>
                  <span>{createErr}</span>
                </div>
              )}

              {/* Footer Buttons */}
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, paddingTop: 16, borderTop: '1px solid #1a3c33' }}>
                <button 
                  onClick={closeCreate} 
                  style={{ 
                    padding: '12px 20px', 
                    borderRadius: 10, 
                    border: '2px solid #2f6b57', 
                    background: 'transparent', 
                    color: '#e8efe8', 
                    cursor: 'pointer', 
                    fontWeight: 600,
                    fontSize: 14,
                    transition: 'all 0.2s'
                  }}
                >
                  Abbrechen
                </button>
                <button 
                  onClick={handleCreate} 
                  disabled={creating || !cmSportId || !cmCityId || !cmWhenType} 
                  style={{ 
                    background: (!cmSportId || !cmCityId || !cmWhenType) ? '#5a5a5a' : '#debc7c', 
                    color: (!cmSportId || !cmCityId || !cmWhenType) ? '#9a9a9a' : '#10261f', 
                    padding: '12px 24px', 
                    borderRadius: 10, 
                    border: 'none', 
                    fontWeight: 700,
                    fontSize: 14,
                    cursor: creating || !cmSportId || !cmCityId || !cmWhenType ? 'not-allowed' : 'pointer',
                    transition: 'all 0.2s',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8
                  }}
                >
                  {creating && <span>⏳</span>}
                  <span>{creating ? 'Erstelle Match...' : 'Match erstellen'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}