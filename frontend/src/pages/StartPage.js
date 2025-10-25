import React, { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { API_BASE } from "../config";
import smallLogo from "../images/logo.png";
import Avatar from "../components/Avatar";

// load background images from sports folder and sort
function importAllBackgrounds(r) {
  return r.keys().map((k) => ({ key: k.replace(/^\.\//, ''), src: r(k) }));
}
// Use sports images for hero rotation
const backgrounds = importAllBackgrounds(require.context("../images/sports", false, /\.(png|jpe?g|webp|svg)$/));
backgrounds.sort((a, b) => {
  const re = /^(\d+)-/;
  const ma = a.key.match(re);
  const mb = b.key.match(re);
  if (ma && mb) return Number(ma[1]) - Number(mb[1]);
  if (ma) return -1;
  if (mb) return 1;
  return a.key.localeCompare(b.key);
});

export default function StartPage() {
  const navigate = useNavigate();
  const [leagues, setLeagues] = useState([]);
  const [sports, setSports] = useState([]);
  const [cities, setCities] = useState([]);
  const [selectedSport, setSelectedSport] = useState("");
  const [selectedCountry, setSelectedCountry] = useState("");
  const [selectedState, setSelectedState] = useState("");
  const [selectedCity, setSelectedCity] = useState("");
  const [openMatches, setOpenMatches] = useState([]);
  const [searching, setSearching] = useState(false);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  // dashboard state
  const [myLeagues, setMyLeagues] = useState([]);
  const [myGames, setMyGames] = useState({ upcoming: [], completed: [] });
  const [standings, setStandings] = useState({ leagueId: "", rows: [] });
  const [leagueMembers, setLeagueMembers] = useState([]);
  const [leagueGames, setLeagueGames] = useState({ upcoming: [], completed: [] });
  const [selectedMyLeagueId, setSelectedMyLeagueId] = useState("");
  // current user id extraction from token for centering table
  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
  const myUserId = useMemo(() => {
    if (!token) return null;
    try {
      const parts = token.split(".");
      if (parts.length < 2) return null;
      const payload = JSON.parse(atob(parts[1]));
      return payload?.user?.id ?? payload?.userId ?? payload?.sub ?? payload?.id ?? null;
    } catch { return null; }
  }, [token]);
  // simple carousel state for backgrounds
  const [index, setIndex] = useState(0);

  // Helper: extract numeric user id for a game side (home/away)
  const toId = (g, side) => {
    if (!g) return null;
    const v = g?.[`${side}_id`] ?? g?.[`${side}Id`] ?? g?.[side];
    const m = String(v ?? '').match(/\d+/);
    return m ? m[0] : null;
  };

  // rotate backgrounds every 5s
  useEffect(() => {
    if (!backgrounds.length) return;
    const t = setInterval(() => setIndex((i) => (i + 1) % backgrounds.length), 5000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    setErr("");
    Promise.all([
      fetch(`${API_BASE}/leagues`).then(r => r.ok ? r.json() : []),
      fetch(`${API_BASE}/sports/list`).then(r => r.ok ? r.json() : []),
      fetch(`${API_BASE}/cities/list`).then(r => r.ok ? r.json() : []),
      fetch(`${API_BASE}/countries`).then(r => r.ok ? r.json() : []),
    ])
      .then(([ls, ss, cs, countries]) => {
        if (!mounted) return;
        setLeagues(Array.isArray(ls) ? ls : []);
        setSports(Array.isArray(ss) ? ss : []);
        setCities(Array.isArray(cs) ? cs : []);
        // auto-select user's city from /me/leagues (first league city)
        (async () => {
          try {
            const token = localStorage.getItem('token');
            if (!token) return;
            const meLeagues = await fetch(`${API_BASE}/me/leagues`, { headers: { Authorization: `Bearer ${token}` } }).then(r => r.ok ? r.json() : []);
            const firstCity = (meLeagues || []).find(l => l.cityId)?.cityId;
            if (firstCity) setSelectedCity(String(firstCity));
            // store for dashboard
            setMyLeagues(Array.isArray(meLeagues) ? meLeagues : []);
            const myGamesResp = await fetch(`${API_BASE}/me/games`, { headers: { Authorization: `Bearer ${token}` } }).then(r => r.ok ? r.json() : { upcoming: [], completed: [] });
            setMyGames({
              upcoming: Array.isArray(myGamesResp.upcoming) ? myGamesResp.upcoming : [],
              completed: Array.isArray(myGamesResp.completed) ? myGamesResp.completed : [],
            });
            if ((meLeagues || []).length) {
              const lid = meLeagues[0].id || meLeagues[0].leagueId;
              setSelectedMyLeagueId(String(lid || ""));
              if (lid) {
                const [st, members, games] = await Promise.all([
                  fetch(`${API_BASE}/leagues/${lid}/standings?format=table`).then(r => r.ok ? r.json() : []),
                  fetch(`${API_BASE}/leagues/${lid}/members`, { headers: { Authorization: `Bearer ${token}` } }).then(r => r.ok ? r.json() : []),
                  fetch(`${API_BASE}/leagues/${lid}/games`).then(r => r.ok ? r.json() : { upcoming: [], completed: [] })
                ]);
                setStandings({ leagueId: String(lid), rows: Array.isArray(st) ? st : [] });
                setLeagueMembers(Array.isArray(members) ? members : []);
                setLeagueGames({
                  upcoming: Array.isArray(games.upcoming) ? games.upcoming : [],
                  completed: Array.isArray(games.completed) ? games.completed : []
                });
              }
            }
          } catch {}
        })();
        // store countries for state filtering fallback via cities list (if needed)
        // Note: states are exposed via cities/list response entries
      })
      .catch(e => { if (mounted) setErr(e.message || "Fehler beim Laden."); })
      .finally(() => { if (mounted) setLoading(false); });
    return () => { mounted = false; };
  }, []);

  if (loading) return <div style={{ padding: 24 }}>Lade Startseite ...</div>;
  if (err) return <div style={{ padding: 24, color: "crimson" }}>Fehler: {err}</div>;

  return (
    <div>
      <section className="hero-carousel">
        {backgrounds.map((b, i) => (
          <div key={i} className={`hero-slide ${i === index ? 'active' : ''}`} style={{ backgroundImage: `url(${b.src})` }} />
        ))}

        <div className="hero-overlay">
          <div className="hero-inner">
            <div className="hero-stripe">
              <img src={smallLogo} alt="ML" className="hero-small-logo" />
              <h1 className="hero-title">Match League</h1>
            </div>
            <p className="hero-sub"><b>Willkommen bei MatchLeague. Connect. Match. Win.</b></p>
            <div className="hero-controls" style={{ display: 'flex', gap: 14, alignItems: 'center', marginTop: 14, flexWrap: 'wrap' }}>
              <select value={selectedSport} onChange={(e) => setSelectedSport(e.target.value)} style={{ padding: '12px 16px', borderRadius: 12, border: 'none', background: '#113528', color: '#e8efe8', fontSize: 16 }}>
              <option value="">Sportart</option>
              {sports.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
              <select value={selectedCountry} onChange={(e) => setSelectedCountry(e.target.value)} style={{ padding: '12px 16px', borderRadius: 12, border: 'none', background: '#113528', color: '#e8efe8', fontSize: 16 }}>
              <option value="">Land</option>
              {/* countries are available through cities/list joined return in backend/server.js → use city-derived unique list if needed */}
              {[...new Map(cities.filter(c => c.countryId).map(c => [c.countryId, { id: c.countryId, name: c.countryName }])).values()].map(co => (
                <option key={co.id} value={co.id}>{co.name}</option>
              ))}
            </select>
              <select value={selectedState} onChange={(e) => setSelectedState(e.target.value)} style={{ padding: '12px 16px', borderRadius: 12, border: 'none', background: '#113528', color: '#e8efe8', fontSize: 16 }}>
              <option value="">Bundesstaat</option>
              {[...new Map(cities.filter(c => (!selectedCountry || String(c.countryId) === String(selectedCountry)) && c.stateId).map(c => [c.stateId, { id: c.stateId, name: c.stateName }])).values()].map(st => (
                <option key={st.id} value={st.id}>{st.name}</option>
              ))}
            </select>
              <select value={selectedCity} onChange={(e) => setSelectedCity(e.target.value)} style={{ padding: '12px 16px', borderRadius: 12, border: 'none', background: '#113528', color: '#e8efe8', fontSize: 16 }}>
              <option value="">Stadt</option>
              {cities.filter(c => (!selectedCountry || String(c.countryId) === String(selectedCountry)) && (!selectedState || String(c.stateId) === String(selectedState))).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
              <button
              onClick={() => {
                const qp = new URLSearchParams();
                if (selectedSport) qp.set('sportId', selectedSport);
                if (selectedCity) qp.set('cityId', selectedCity);
                if (selectedState) qp.set('stateId', selectedState);
                if (selectedCountry) qp.set('countryId', selectedCountry);
                navigate(`/match-search?${qp.toString()}`);
              }}
              style={{ background: '#debc7c', color: '#10261f', padding: '12px 20px', borderRadius: 12, border: 'none', cursor: 'pointer', fontWeight: 800, fontSize: 16 }}
              disabled={searching}
            >{searching ? 'Suche…' : 'Match suchen'}</button>
            </div>
          </div>
        </div>
      </section>

  <div className="ml-main-container">
      {/* Dashboard Sections */}
      {/* Row 1: Upcoming and Last games, 3 items each, fixed height */}
      <div className="ml-dual">
        {/* Kommende Spiele (max 3) */}
  <section className="ml-card">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', alignItems: 'center', marginBottom: 8 }}>
            <h3 style={{ margin: 0 }}>Kommende Spiele</h3>
            <span />
          </div>
          {(!myGames.upcoming || myGames.upcoming.length === 0) ? (
            <div style={{ color: '#9db' }}>Keine anstehenden Spiele.</div>
          ) : (
            <div style={{ display: 'grid', gap: 8 }}>
              {myGames.upcoming.slice(0, 3).map(g => {
                const toId = (v) => {
                  const m = String(v ?? '').match(/\d+/);
                  return m ? m[0] : null;
                };
                const hId = toId(g.home_id ?? g.homeId ?? g.home);
                const aId = toId(g.away_id ?? g.awayId ?? g.away);
                const Name = ({ name, uid }) => uid ? (
                  <Link to={`/user/${uid}`} style={{ color: '#cfe', textDecoration: 'none' }}>{name}</Link>
                ) : (<span>{name}</span>);
                const kx = g.kickoff_at || g.kickoffAt || g.date || null;
                const when = kx ? new Date(kx).toLocaleDateString('de-DE', { weekday: 'short', day: 'numeric', month: 'short' }) : '—';
                return (
                  <div key={g.id} className="ml-match" style={{ padding: '10px 2px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                    <div className="ml-match__side">
                      <Avatar userId={hId} name={g.home} size={44} />
                      <Name name={g.home} uid={hId} />
                    </div>
                    <div className="ml-vs">VS</div>
                    <div className="ml-match__side" style={{ justifyContent: 'flex-end' }}>
                      <Avatar userId={aId} name={g.away} size={44} />
                      <Name name={g.away} uid={aId} />
                    </div>
                    <div style={{ gridColumn: '1 / -1', color: '#9db', fontSize: 12, display: 'flex', justifyContent: 'space-between' }}>
                      <span>{[g.sport, g.league, g.city].filter(Boolean).join(' · ')}</span>
                      <span>{when}</span>
                    </div>
                    {g?.id ? (
                      <div style={{ gridColumn: '1 / -1', display: 'flex', justifyContent: 'flex-end' }}>
                        <Link to={`/matches/${g.id}`} style={{ color: '#debc7c', fontWeight: 700, textDecoration: 'none' }}>Details</Link>
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          )}
        </section>
        {/* Letzte Spiele (max 3) */}
  <section className="ml-card">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', alignItems: 'center', marginBottom: 8 }}>
            <h3 style={{ margin: 0 }}>Letzte Spiele</h3>
            <span />
          </div>
          {(!myGames.completed || myGames.completed.length === 0) ? (
            <div style={{ color: '#9db' }}>Keine vergangenen Spiele.</div>
          ) : (
            <div style={{ display: 'grid', gap: 8 }}>
              {myGames.completed.slice(0, 3).map(g => {
                const toId = (v) => {
                  const m = String(v ?? '').match(/\d+/);
                  return m ? m[0] : null;
                };
                const hId = toId(g.home_id ?? g.homeId ?? g.home);
                const aId = toId(g.away_id ?? g.awayId ?? g.away);
                const Name = ({ name, uid }) => uid ? (
                  <Link to={`/user/${uid}`} style={{ color: '#cfe', textDecoration: 'none' }}>{name}</Link>
                ) : (<span>{name}</span>);
                const score = (g.home_score!=null && g.away_score!=null) ? `${g.home_score}:${g.away_score}` : '— : —';
                return (
                  <div key={g.id} className="ml-match" style={{ padding: '10px 2px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                    <div className="ml-match__side">
                      <Avatar userId={hId} name={g.home} size={44} />
                      <Name name={g.home} uid={hId} />
                    </div>
                    <div className="ml-vs" style={{ fontSize: 24 }}>{score}</div>
                    <div className="ml-match__side" style={{ justifyContent: 'flex-end' }}>
                      <Avatar userId={aId} name={g.away} size={44} />
                      <Name name={g.away} uid={aId} />
                    </div>
                    <div style={{ gridColumn: '1 / -1', color: '#9db', fontSize: 12, display: 'flex', justifyContent: 'space-between' }}>
                      <span>{[g.sport, g.league, g.city].filter(Boolean).join(' · ')}</span>
                      <span>{g.kickoff_at ? new Date(g.kickoff_at).toLocaleDateString('de-DE', { weekday: 'short', day: 'numeric', month: 'short' }) : '—'}</span>
                    </div>
                    {g?.id ? (
                      <div style={{ gridColumn: '1 / -1', display: 'flex', justifyContent: 'flex-end' }}>
                        <Link to={`/matches/${g.id}`} style={{ color: '#debc7c', fontWeight: 700, textDecoration: 'none' }}>Details</Link>
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          )}
        </section>


  {/* Row 2: Tabellen mit Ligen-Auswahl */}
        {/* Standings preview */}
        <section style={{ gridColumn: '1 / -1' }}>
          <h2>Meine Ligen</h2>
          {/* selection chip removed per request */}
          {myLeagues.length > 0 && (
            <div style={{ marginBottom: 8 }}>
              <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                Liga:
                <select
                  value={selectedMyLeagueId}
                  onChange={async (e) => {
                    const lid = e.target.value;
                    setSelectedMyLeagueId(lid);
                    if (!lid) { setStandings({ leagueId: "", rows: [] }); return; }
                    try {
                      const [st, members, games] = await Promise.all([
                        fetch(`${API_BASE}/leagues/${lid}/standings?format=table`).then(r => r.ok ? r.json() : []),
                        fetch(`${API_BASE}/leagues/${lid}/members`, { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } }).then(r => r.ok ? r.json() : []),
                        fetch(`${API_BASE}/leagues/${lid}/games`).then(r => r.ok ? r.json() : { upcoming: [], completed: [] })
                      ]);
                      setStandings({ leagueId: String(lid), rows: Array.isArray(st) ? st : [] });
                      setLeagueMembers(Array.isArray(members) ? members : []);
                      setLeagueGames({
                        upcoming: Array.isArray(games.upcoming) ? games.upcoming : [],
                        completed: Array.isArray(games.completed) ? games.completed : []
                      });
                    } catch { 
                      setStandings({ leagueId: String(lid), rows: [] });
                      setLeagueMembers([]);
                      setLeagueGames({ upcoming: [], completed: [] });
                    }
                  }}
                  style={{ padding: '8px 10px', borderRadius: 8, border: '1px solid #2f6b57', background: '#0e2a22', color: '#dfe' }}
                >
                  {myLeagues.map(l => (
                    <option key={l.id || l.leagueId} value={String(l.id || l.leagueId)}>{l.name}</option>
                  ))}
                </select>
              </label>
            </div>
          )}
          {(!standings.rows || standings.rows.length === 0) ? (
            <div style={{ color: '#9db' }}>Keine Tabellenstände verfügbar.</div>
          ) : (
            <div className="ml-card" style={{ overflowX: 'auto', marginTop: 8 }}>
              {(() => {
                const sel = (myLeagues || []).find(l => String(l.id || l.leagueId) === String(selectedMyLeagueId));
                const name = sel?.name || '';
                return name ? (
                  <div style={{ padding: '10px 6px', fontWeight: 700, color: '#cfe', borderBottom: '1px solid #194638' }}>{name}</div>
                ) : null;
              })()}
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ textAlign: 'left', borderBottom: '2px solid #234' }}>
                    <th style={{ padding: '8px 6px' }}>Platz</th>
                    <th style={{ padding: '8px 6px' }}>Team/Spieler</th>
                    <th style={{ padding: '8px 6px' }}>Sp</th>
                    <th style={{ padding: '8px 6px' }}>S</th>
                    <th style={{ padding: '8px 6px' }}>U</th>
                    <th style={{ padding: '8px 6px' }}>N</th>
                    <th style={{ padding: '8px 6px' }}>Tore</th>
                    <th style={{ padding: '8px 6px' }}>Diff</th>
                    <th style={{ padding: '8px 6px' }}>Pkt</th>
                    <th style={{ padding: '8px 6px' }}>Form</th>
                  </tr>
                </thead>
                <tbody>
                  {(() => {
                    const rows = Array.isArray(standings.rows) ? standings.rows : [];
                    // Resolve UID from league members by matching name when no id on row
                    const norm = (s) => String(s || '').trim().toLowerCase();
                    const memberIndexByName = new Map();
                    (leagueMembers || []).forEach(m => {
                      const uid = m.user_id ?? m.userId ?? m.member_user_id ?? m.memberUserId ?? m.member_id ?? m.memberId ?? m.id;
                      if (uid == null) return;
                      const cand = new Set();
                      const fn = (m.firstname || '').trim();
                      const ln = (m.lastname || '').trim();
                      const username = (m.username || '').trim();
                      const disp = (m.displayName || '').trim();
                      const name = (m.name || '').trim();
                      const combos = [
                        [fn, ln].filter(Boolean).join(' '),
                        [ln, fn].filter(Boolean).join(' '),
                        username,
                        name,
                        disp,
                        String(uid)
                      ].filter(Boolean);
                      combos.forEach(s => {
                        const key = norm(s.replace(/[()]/g, ''));
                        if (key) cand.add(key);
                        // also single tokens for simple usernames/names
                        s.split(/\s+/).forEach(t => { const k2 = norm(t); if (k2) cand.add(k2); });
                      });
                      cand.forEach(k => { if (!memberIndexByName.has(k)) memberIndexByName.set(k, String(uid)); });
                    });
                    // Build form map from completed games like on LeagueDetail
                    const completed = Array.isArray(leagueGames.completed) ? [...leagueGames.completed] : [];
                    completed.sort((a, b) => new Date(b.kickoff_at || b.kickoffAt || b.date || 0) - new Date(a.kickoff_at || a.kickoffAt || a.date || 0));
                    const toId = (g, side) => {
                      const v = g?.[`${side}_id`] ?? g?.[`${side}Id`] ?? g?.[side];
                      const m = String(v ?? '').match(/\d+/);
                      return m ? m[0] : null;
                    };
                    const gScore = (g, k) => g?.[k] ?? g?.[k.replace(/_/, "")] ?? null;
                    const formMap = new Map();
                    const nameFormMap = new Map(); // fallback by display name
                    completed.forEach(g => {
                      const hs = gScore(g, 'home_score');
                      const as = gScore(g, 'away_score');
                      if (hs == null || as == null) return;
                      let hRes = 'U', aRes = 'U';
                      if (Number(hs) > Number(as)) { hRes = 'W'; aRes = 'N'; }
                      else if (Number(hs) < Number(as)) { hRes = 'N'; aRes = 'W'; }

                      // Map by numeric IDs when available
                      const hId = toId(g, 'home');
                      const aId = toId(g, 'away');
                      if (hId) { if (!formMap.has(hId)) formMap.set(hId, []); formMap.get(hId).push(hRes); }
                      if (aId) { if (!formMap.has(aId)) formMap.set(aId, []); formMap.get(aId).push(aRes); }

                      // Always map by display names (fallback)
                      const hName = g.home || g.home_name || g.homeName || '';
                      const aName = g.away || g.away_name || g.awayName || '';
                      if (hName) {
                        const key = norm(hName);
                        if (!nameFormMap.has(key)) nameFormMap.set(key, []);
                        nameFormMap.get(key).push(hRes);
                      }
                      if (aName) {
                        const key = norm(aName);
                        if (!nameFormMap.has(key)) nameFormMap.set(key, []);
                        nameFormMap.get(key).push(aRes);
                      }
                    });
                    for (const [k, arr] of formMap.entries()) formMap.set(k, arr.slice(0, 5));
                    for (const [k, arr] of nameFormMap.entries()) nameFormMap.set(k, arr.slice(0, 5));
                    const findIndex = () => {
                      if (myUserId == null) return -1;
                      const idStr = String(myUserId);
                      return rows.findIndex(r => {
                        const candidate = r.user_id ?? r.userId ?? r.member_id ?? r.memberId ?? r.id;
                        return candidate != null && String(candidate) === idStr;
                      });
                    };
                    const idxMe = findIndex();
                    let start = 0;
                    if (idxMe >= 0) start = Math.max(0, idxMe - 2);
                    const slice = rows.slice(start, start + 5);
                    const initialsFor = (name) => {
                      const s = String(name || '').trim();
                      if (!s) return '?';
                      const p = s.split(/\s+/);
                      const a = (p[0]?.[0] || '').toUpperCase();
                      const b = (p[1]?.[0] || '').toUpperCase();
                      return (a + b) || a || '?';
                    };
                    return slice.map((row, i) => {
                      const nestedUserId = row.user?.id ?? row.user?.userId ?? null;
                      const display = row.name || row.displayName || row.username || row.team || row.player || `User ${nestedUserId ?? ''}`;
                      let uid;
                      const idCandidate = row.user_id ?? row.userId ?? row.member_id ?? row.memberId ?? nestedUserId ?? row.id;
                      if (idCandidate != null) uid = String(idCandidate).match(/\d+/)?.[0];
                      if (!uid) {
                        const byName = memberIndexByName.get(norm(display))
                          || memberIndexByName.get(norm(String(display).replace(/[()]/g, '')));
                        if (byName) uid = String(byName).match(/\d+/)?.[0];
                      }
                      const formArr = Array.isArray(row.form)
                        ? row.form
                        : (String(row.form || '').trim().length ? String(row.form).trim().split(/\s+/) : []);
                      const color = (r) => (r === 'W' ? '#29e0ad' : r === 'N' ? '#ff6b6b' : '#c4d0ca');
                      const key = `${start + i}-${row.id ?? row.user_id ?? row.userId ?? row.member_id ?? row.memberId ?? row.name ?? 'row'}`;
                      return (
                        <tr key={key} style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                          <td style={{ padding: '8px 6px' }}>{row.rank ?? row.platz ?? (start + i + 1)}</td>
                          <td style={{ padding: '10px 8px' }}>
                            <Avatar userId={uid} name={display} size={40} style={{ marginRight: 12 }} />
                            {uid ? (
                              <span style={{ display: 'inline-flex', alignItems: 'center' }}>
                                <Link to={`/user/${uid}`} className="ml-link-profile" title="Profil öffnen">{display}</Link>
                                <span aria-hidden className="ml-link-profile-icon">↗︎</span>
                              </span>
                            ) : (
                              display
                            )}
                          </td>
                          <td style={{ padding: '8px 6px' }}>{row.sp ?? row.played ?? 0}</td>
                          <td style={{ padding: '8px 6px' }}>{row.s ?? row.wins ?? 0}</td>
                          <td style={{ padding: '8px 6px' }}>{row.u ?? row.draws ?? 0}</td>
                          <td style={{ padding: '8px 6px' }}>{row.n ?? row.losses ?? 0}</td>
                          <td style={{ padding: '8px 6px' }}>{
                            (row.goals ?? row.gfga ?? row.gd_text) ??
                            ((row.goals_for != null && row.goals_against != null)
                              ? `${row.goals_for}:${row.goals_against}`
                              : (row.goals || '0:0'))
                          }</td>
                          <td style={{ padding: '8px 6px' }}>{row.diff ?? row.gd ?? 0}</td>
                          <td style={{ padding: '8px 6px' }}>{row.pkt ?? row.points ?? 0}</td>
                          <td style={{ padding: '8px 6px', whiteSpace: 'nowrap' }}>
                            {(() => {
                              // Prefer computed form by uid, fallback to row.form
                              const computed = uid ? (formMap.get(String(uid)) || []) : [];
                              const byName = nameFormMap.get(norm(display)) || [];
                              const effective = computed.length ? computed : (byName.length ? byName : formArr);
                              return effective.length === 0 ? (
                                <span style={{ color: '#9db' }}>—</span>
                              ) : (
                                <span>
                                  {effective.slice(0, 5).map((r, i2) => (
                                    <span key={i2} style={{ color: color(r), fontWeight: 700, display: 'inline-block', marginRight: 6 }}>{r}</span>
                                  ))}
                                </span>
                              );
                            })()}
                          </td>
                        </tr>
                      );
                    });
                  })()}
                </tbody>
              </table>
              {standings.leagueId ? (
                <div style={{ marginTop: 8 }}>
                  <Link to={`/league/${standings.leagueId}`}>Zur Liga</Link>
                </div>
              ) : null}
            </div>
          )}
        </section>
      </div>

      {/* Row 3: Newsfeed */}
      <section className="ml-card" style={{ marginTop: 16 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', alignItems: 'center', marginBottom: 8 }}>
          <h3 style={{ margin: 0 }}>Neuigkeiten</h3>
          <div style={{ color: '#9db', fontSize: 12 }}><Link to="/news">Alle</Link></div>
        </div>

        {/* Top strip: Local Game News + Sponsored - simple stacking */}
        <div className="ml-news-grid">
          {/* Local Game News */}
          <div className="ml-bordered" style={{ padding: 10 }}>
            <div style={{ fontWeight: 700, marginBottom: 8, color: '#dfe' }}>Local Game News</div>
            <div style={{ display: 'grid', gap: 10 }}>
              {(leagueGames.completed || []).slice(0, 3).map((g, idx) => (
                <div key={g.id || idx} style={{ display: 'grid', gridTemplateColumns: '1fr auto', alignItems: 'center', gap: 8 }}>
                  <div>
                    <div style={{ color: '#9db', fontSize: 12 }}>{g.league || standings?.leagueName || 'Community Liga'}</div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'auto auto auto', gap: 10, alignItems: 'center' }}>
                      <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                        <Avatar userId={toId(g,'home')} name={g.home} size={28} />
                        <span>{g.home}</span>
                      </div>
                      <div style={{ fontWeight: 800 }}>{(g.home_score!=null && g.away_score!=null) ? `${g.home_score}:${g.away_score}` : '— : —'}</div>
                      <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                        <Avatar userId={toId(g,'away')} name={g.away} size={28} />
                        <span>{g.away}</span>
                      </div>
                    </div>
                    <div style={{ color: '#9db', fontSize: 12 }}>{g.kickoff_at ? new Date(g.kickoff_at).toLocaleString('de-DE', { weekday: 'short', hour: '2-digit', minute: '2-digit' }) : ''}</div>
                  </div>
                  <Link to={`/matches/${g.id}`} style={{ color: '#debc7c', fontWeight: 700, textDecoration: 'none' }}>Details</Link>
                </div>
              ))}
            </div>
          </div>
          {/* Sponsored Local Stories */}
          <div className="ml-bordered" style={{ padding: 10 }}>
            <div style={{ fontWeight: 700, marginBottom: 8, color: '#dfe' }}>Sponsored Local Stories</div>
            <div style={{ display: 'grid', gap: 10 }}>
              <div className="ml-card" style={{ padding: 8 }}>
                <div style={{ height: 64, background: 'linear-gradient(135deg,#1b3b31,#294c40)', borderRadius: 8, marginBottom: 8 }} />
                <div style={{ fontWeight: 700 }}>Bremen Sports Center</div>
                <div style={{ color: '#9db', fontSize: 12 }}>20% Rabatt für MatchLeague Teams</div>
                <div style={{ marginTop: 6, display: 'flex', gap: 8 }}>
                  <a href="#" className="ml-btn-secondary">Zum Angebot</a>
                  <a href="#" className="ml-btn-secondary">Zur Anzeige</a>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Posts */}
        <div style={{ display: 'grid', gap: 12, marginTop: 12 }}>
          {[1,2].map(i => (
            <div key={i} className="ml-card" style={{ display: 'grid', gap: 8 }}>
              <div style={{ height: 160, borderRadius: 10, overflow: 'hidden', background: 'url(https://images.unsplash.com/photo-1517649763962-0c623066013b?q=80&w=1200&auto=format&fit=crop) center/cover no-repeat' }} />
              <div style={{ fontSize: 18, fontWeight: 700 }}>What a fantastic season!</div>
              <div style={{ color: '#dfe' }}>Thanks to my teammates and everyone who helped organizing our league matches!</div>
              <div style={{ display: 'flex', gap: 12, color: '#9db' }}>
                <span>👍</span><span>💬</span><span>↗︎</span>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Extra Listen (Alle Ligen/Sportarten/Städte) entfernt auf Wunsch */}
      
      </div>
    </div>
  );
}


