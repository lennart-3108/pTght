import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { API_BASE } from "../config";

export default function ProfilePage() {
  const [data, setData] = useState(null);
  const [profile, setProfile] = useState({ open_for_matches: false, favorite_sports: [] });
  const [leagues, setLeagues] = useState([]);
  const [games, setGames] = useState({ upcoming: [], completed: [] });
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    let mounted = true;
    setErr("");
    setLoading(true);
    const token = localStorage.getItem("token");

    fetch(`${API_BASE}/me`, { headers: { Authorization: `Bearer ${token}` } })
      .then(async (r) => {
        const j = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(j?.error || `HTTP ${r.status}`);
        return j;
      })
      .then(j => mounted && setData(j))
      .catch(e => mounted && setErr(e.message || "Fehler"))
      .finally(() => mounted && setLoading(false));

    // load profile preferences
    fetch(`${API_BASE}/profile`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.ok ? r.json() : { open_for_matches: false, favorite_sports: [] })
      .then(j => mounted && setProfile({
        open_for_matches: !!j.open_for_matches,
        favorite_sports: Array.isArray(j.favorite_sports) ? j.favorite_sports : []
      }))
      .catch(() => {});

    fetch(`${API_BASE}/me/leagues`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => (r.ok ? r.json() : []))
      .then(j => mounted && setLeagues(Array.isArray(j) ? j : []))
      .catch(() => {});

    fetch(`${API_BASE}/me/games`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => (r.ok ? r.json() : { upcoming: [], completed: [] }))
      .then(j => mounted && setGames({
        upcoming: Array.isArray(j.upcoming) ? j.upcoming : [],
        completed: Array.isArray(j.completed) ? j.completed : []
      }))
      .catch(() => {});

    return () => { mounted = false; };
  }, []);

  async function safeNavigateTo(e, href, apiPath) {
    e.preventDefault();
    try {
      const res = await fetch(`${API_BASE}${apiPath}`, { method: "GET" });
      if (res.ok) {
        navigate(href);
      } else {
        const txt = await res.text().catch(() => "");
        alert(`Seite vorübergehend nicht erreichbar (${res.status}).\n${txt ? txt.slice(0,200) : ""}`);
      }
    } catch (err) {
      alert("Fehler beim Aufrufen der Seite: " + (err.message || err));
    }
  }

  if (loading) return <div style={{ padding: 16 }}>Lade Profil ...</div>;
  if (err) return <div style={{ padding: 16, color: "crimson" }}>Fehler: {err}</div>;
  if (!data) return <div style={{ padding: 16 }}>Keine Daten.</div>;

  // UI helpers
  const wrap = { padding: 16, color: '#e8efe8', fontFamily: 'Inter, system-ui, sans-serif' };
  const card = { background: '#0f2a20', borderRadius: 16, boxShadow: '0 14px 36px rgba(0,0,0,0.5)' };
  const pad = { padding: 16 };
  const pill = { display: 'inline-block', padding: '4px 10px', borderRadius: 999, border: '1px solid #2f6b57', background: '#0e2a22', color: '#dfe' };
  const small = { fontSize: 12, color: '#a6bfb3' };
  const hRow = { display: 'flex', alignItems: 'center', gap: 12 };

  // Group leagues by sport text
  const leaguesBySport = leagues.reduce((m, l) => {
    const key = (l.sport || 'Andere').trim();
    (m[key] = m[key] || []).push(l);
    return m;
  }, {});

  // Compute summary stats for header based on completed games
  const myId = data?.id;
  const completed = Array.isArray(games?.completed) ? games.completed : [];
  const myCompleted = completed.filter(g => (
    (g.home_user_id && String(g.home_user_id) === String(myId)) ||
    (g.away_user_id && String(g.away_user_id) === String(myId)) ||
    (!g.home_user_id && !g.away_user_id) // text-only schemas – include but stats may be ambiguous
  ));
  let wins = 0, losses = 0, draws = 0;
  for (const g of myCompleted) {
    const hs = Number(g.home_score);
    const as = Number(g.away_score);
    if (!Number.isFinite(hs) || !Number.isFinite(as)) continue;
    if (g.home_user_id && String(g.home_user_id) === String(myId)) {
      if (hs > as) wins++; else if (hs < as) losses++; else draws++;
    } else if (g.away_user_id && String(g.away_user_id) === String(myId)) {
      if (as > hs) wins++; else if (as < hs) losses++; else draws++;
    } else {
      // text schema fallback: try by name
      const meName = `${data?.firstname || ''} ${data?.lastname || ''}`.trim();
      if (g.home === meName) { if (hs > as) wins++; else if (hs < as) losses++; else draws++; }
      else if (g.away === meName) { if (as > hs) wins++; else if (as < hs) losses++; else draws++; }
    }
  }
  const matchesCount = myCompleted.length;

  const GameList = ({ title, items, showScore }) => (
    <div style={{ ...card, marginTop: 16 }}>
      <div style={{ ...pad, paddingBottom: 8 }}>
        <div style={{ fontSize: 18, fontWeight: 700 }}>{title}</div>
      </div>
      <div style={{ ...pad, paddingTop: 8 }}>
        {items.length === 0 ? (
          <div style={small}>Keine {title.toLowerCase()}.</div>
        ) : (
          <div style={{ display: 'grid', gap: 10 }}>
            {items.map(g => (
              <div key={g.id} style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr auto', alignItems: 'center', gap: 10, background: '#0b1e19', borderRadius: 12, padding: 12 }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{g.league}</div>
                  <div style={small}>{new Date(g.kickoff_at || Date.now()).toLocaleString('de-DE')}</div>
                </div>
                <div style={{ textAlign: 'right', color: '#9db' }}>{g.home}</div>
                <div style={{ textAlign: 'center', fontWeight: 700 }}>
                  {showScore ? (
                    <span>{g.home_score != null && g.away_score != null ? `${g.home_score}:${g.away_score}` : '— : —'}</span>
                  ) : (
                    <span>VS</span>
                  )}
                </div>
                <div style={{ color: '#9db' }}>{g.away}</div>
                <div style={{ gridColumn: '1 / -1', display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
                  <Link to={`/matches/${g.id}`} style={pill}>Details</Link>
                  <Link to={`/matches/${g.id}`} style={pill}>Match-Chat</Link>
                  {!showScore && <Link to={`/matches/${g.id}`} style={pill}>Termin ändern</Link>}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div style={wrap}>
      {/* Preferences card */}
      <div style={{ ...card, marginBottom: 16 }}>
        <div style={{ ...pad }}>
          <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>Einstellungen</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <input type="checkbox" checked={!!profile.open_for_matches} onChange={(e) => setProfile(p => ({ ...p, open_for_matches: e.target.checked }))} />
              Offen für Matches (Anfragen erlauben)
            </label>
          </div>
          <div style={{ marginBottom: 8 }}>
            <div style={{ marginBottom: 6, ...small, color: '#cfe' }}>Favorisierte Sportarten (Komma-getrennt)</div>
            <input
              type="text"
              value={(profile.favorite_sports || []).join(', ')}
              onChange={(e) => setProfile(p => ({ ...p, favorite_sports: e.target.value.split(',').map(s => s.trim()).filter(Boolean) }))}
              style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: '1px solid #2f6b57', background: '#0b1e19', color: '#e8efe8' }}
              placeholder="z.B. Tennis, Fußball"
            />
          </div>
          <div>
            <button
              onClick={async () => {
                try {
                  const token = localStorage.getItem('token');
                  const resp = await fetch(`${API_BASE}/profile`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                    body: JSON.stringify({
                      open_for_matches: !!profile.open_for_matches,
                      favorite_sports: Array.isArray(profile.favorite_sports) ? profile.favorite_sports : []
                    })
                  });
                  if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
                  alert('Profil gespeichert');
                } catch (e) {
                  alert('Konnte Profil nicht speichern: ' + (e.message || e));
                }
              }}
              style={{ ...pill, cursor: 'pointer', background: '#195642' }}
            >Speichern</button>
          </div>
        </div>
      </div>
      {/* Header with avatar, name, role, sport badges and stats summary */}
      <div style={{ ...card, paddingBottom: 0 }}>
        <div style={{ ...pad, display: 'flex', alignItems: 'center', gap: 16 }}>
          <img alt="avatar" src={`https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent((data.firstname||'')+' '+(data.lastname||''))}&backgroundType=gradientLinear&fontWeight=700`} style={{ width: 80, height: 80, borderRadius: 80, objectFit: 'cover', background: '#1b3a31' }} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 28, fontWeight: 900 }}>{data.firstname} {data.lastname}</div>
            <div style={small}>Einzelspieler</div>
          </div>
          {/* Sport-Badges (Text, komma-getrennt) */}
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {Object.keys(leaguesBySport).map((s) => (
              <span key={s} style={{ ...pill, background: '#143329' }}>{s}</span>
            ))}
          </div>
        </div>
        {/* Stats bar */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, padding: 16 }}>
          <div style={{ textAlign: 'center', padding: '10px 6px' }}>
            <div style={{ fontSize: 34, fontWeight: 900 }}>{wins}</div>
            <div style={{ color: '#bcd' }}>Siege</div>
          </div>
          <div style={{ textAlign: 'center', padding: '10px 6px' }}>
            <div style={{ fontSize: 34, fontWeight: 900 }}>{losses}</div>
            <div style={{ color: '#bcd' }}>Niederlagen</div>
          </div>
          <div style={{ textAlign: 'center', padding: '10px 6px' }}>
            <div style={{ fontSize: 34, fontWeight: 900 }}>{draws}</div>
            <div style={{ color: '#bcd' }}>Unentschieden</div>
          </div>
          <div style={{ textAlign: 'center', padding: '10px 6px' }}>
            <div style={{ fontSize: 34, fontWeight: 900 }}>{matchesCount}</div>
            <div style={{ color: '#bcd' }}>Matches</div>
          </div>
        </div>
      </div>

      {/* Meine Ligen – gruppiert nach Sport (ohne Logos, nur Text) */}
      <div style={{ ...card, marginTop: 16 }}>
        <div style={{ ...pad, paddingBottom: 8 }}>
          <div style={{ fontSize: 18, fontWeight: 700 }}>Meine Ligen</div>
          <div style={small}>Stadt und Sport als Text – mehrere Sportarten werden durch Badges oben angezeigt.</div>
        </div>
        <div style={{ ...pad, paddingTop: 8 }}>
          {leagues.length === 0 ? (
            <div style={small}>Keine Ligen.</div>
          ) : (
            <div style={{ display: 'grid', gap: 10 }}>
              {leagues.map((l) => {
                const leagueHref = l.leagueUrl || (l.id ? `/league/${l.id}` : null);
                const cityHref = l.cityUrl || (l.cityId ? `/cities/${l.cityId}` : null);
                return (
                  <div key={String(l.id || l.leagueId || Math.random())} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#0b1e19', borderRadius: 12, padding: 12 }}>
                    <div>
                      <div style={{ fontWeight: 700 }}>{l.name || l.league || '—'}</div>
                      <div style={small}>{[l.sport, l.city].filter(Boolean).join(' · ')}</div>
                      {l.joined_at && <div style={small}>Beigetreten: {new Date(l.joined_at).toLocaleDateString('de-DE')}</div>}
                    </div>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      {leagueHref && <a href={leagueHref} onClick={(e) => safeNavigateTo(e, leagueHref, `/leagues/${l.id || l.leagueId}`)} style={pill}>Zur Liga</a>}
                      {cityHref && <a href={cityHref} onClick={(e) => safeNavigateTo(e, cityHref, `/cities/${l.cityId}`)} style={pill}>Zur Stadt</a>}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Spiel-Listen (ensure distinct arrays) */}
      <GameList title="Kommende Spiele" items={(games.upcoming || []).filter(g => g.home_score == null && g.away_score == null)} showScore={false} />
      <GameList title="Vergangene Spiele" items={(games.completed || []).filter(g => g.home_score != null && g.away_score != null)} showScore={true} />
    </div>
  );
}

