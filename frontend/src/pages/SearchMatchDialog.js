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
  const [cmCityId, setCmCityId] = useState('');
  // no league for friendly open matches
  const [cmWhen, setCmWhen] = useState(''); // ISO for datetime-local
  const [cmType, setCmType] = useState('Liga'); // Liga | Freundschaft | Herausforderung
  const [creating, setCreating] = useState(false);
  const [createErr, setCreateErr] = useState('');

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

  const countries = useMemo(() => {
    return [...new Map(cities.filter(c => c.countryId).map(c => [c.countryId, { id: c.countryId, name: c.countryName }])).values()];
  }, [cities]);
  const states = useMemo(() => {
    return [...new Map(cities.filter(c => (!countryId || String(c.countryId) === String(countryId)) && c.stateId).map(c => [c.stateId, { id: c.stateId, name: c.stateName }])).values()];
  }, [cities, countryId]);
  const filteredCities = useMemo(() => {
    return cities.filter(c => (!countryId || String(c.countryId) === String(countryId)) && (!stateId || String(c.stateId) === String(stateId)));
  }, [cities, countryId, stateId]);

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
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'grid', placeItems: 'center', zIndex: 1000 }}>
          <div className="ml-card" style={{ width: 520, maxWidth: '94vw' }}>
            <h2 style={{ marginTop: 0 }}>Neues Match erstellen</h2>
            <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
              {[1,2,3].map((n,i) => (
                <div key={n} className="ml-chip" style={{ opacity: i===0?1:0.6 }}><span className="ml-status-dot" /> Schritt {n}</div>
              ))}
            </div>

            <div style={{ display: 'grid', gap: 10 }}>
              <label style={{ display: 'grid', gap: 6 }}>
                <span>Sportart</span>
                <select value={cmSportId} onChange={(e)=>setCmSportId(e.target.value)} style={{ padding: '10px 14px', borderRadius: 10, border: '1px solid #2f6b57', background: '#0e2a22', color: '#e8efe8' }}>
                  <option value="">Bitte wählen</option>
                  {sports.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <label style={{ display: 'grid', gap: 6 }}>
                  <span>Ort</span>
                  <select value={cmCityId} onChange={(e)=>setCmCityId(e.target.value)} style={{ padding: '10px 14px', borderRadius: 10, border: '1px solid #2f6b57', background: '#0e2a22', color: '#e8efe8' }}>
                    <option value="">Stadt wählen</option>
                    {cities.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </label>
                <label style={{ display: 'grid', gap: 6 }}>
                  <span>Datum/Zeit</span>
                  <input type="datetime-local" value={cmWhen} onChange={(e)=>setCmWhen(e.target.value)} style={{ padding: '10px 14px', borderRadius: 10, border: '1px solid #2f6b57', background: '#0e2a22', color: '#e8efe8' }} />
                </label>
              </div>

              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                {['Liga','Freundschaft','Herausforderung'].map(t => (
                  <button key={t} type="button" onClick={()=>setCmType(t)} className="ml-btn-secondary" style={{ background: cmType===t?'#10352a':'#0e2a22' }}>{t}</button>
                ))}
              </div>

              {/* No league selection for friendly open matches */}

              {createErr ? <div style={{ color: 'salmon' }}>{createErr}</div> : null}

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 6 }}>
                <button onClick={closeCreate} className="ml-btn-secondary">Abbrechen</button>
                <button onClick={handleCreate} disabled={creating} style={{ background: '#debc7c', color: '#10261f', padding: '10px 14px', borderRadius: 10, border: 'none', fontWeight: 800 }}>{creating ? 'Erstelle…' : 'Match erstellen'}</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
