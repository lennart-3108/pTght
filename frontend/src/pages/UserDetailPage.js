import React, { useEffect, useMemo, useState } from "react";
import { Link, useParams, useNavigate } from "react-router-dom";
import { API_BASE } from "../config";

export default function UserDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [user, setUser] = useState(null);
  const [leagues, setLeagues] = useState([]);
  const [games, setGames] = useState({ upcoming: [], completed: [] });
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  useEffect(() => {
    if (!id) { setErr("Ungültige Benutzer-ID."); setLoading(false); return; }
    let mounted = true;
    (async () => {
      try {
        setLoading(true); setErr("");
        const token = localStorage.getItem("token");
        const [userRes, leaguesRes, gamesRes] = await Promise.all([
          fetch(`${API_BASE}/users/${id}`, { headers: { Authorization: `Bearer ${token}` } }),
          fetch(`${API_BASE}/users/${id}/leagues`, { headers: { Authorization: `Bearer ${token}` } }),
          fetch(`${API_BASE}/users/${id}/games`, { headers: { Authorization: `Bearer ${token}` } }),
        ]);
        if (!userRes.ok) throw new Error(`HTTP ${userRes.status}: Nutzer nicht gefunden`);
        const [userData, leaguesData, gamesData] = await Promise.all([
          userRes.json(),
          leaguesRes.ok ? leaguesRes.json() : Promise.resolve([]),
          gamesRes.ok ? gamesRes.json() : Promise.resolve([]),
        ]);
        if (!mounted) return;
        setUser(userData);
        setLeagues(Array.isArray(leaguesData) ? leaguesData : []);
        // Support both legacy (array) and new ({ upcoming, completed }) shapes
        if (gamesData && Array.isArray(gamesData.upcoming) && Array.isArray(gamesData.completed)) {
          setGames({ upcoming: gamesData.upcoming, completed: gamesData.completed });
        } else {
          const rawGames = Array.isArray(gamesData) ? gamesData : [];
          const upcoming = rawGames.filter(g => g.home_score == null && g.away_score == null);
          const completed = rawGames.filter(g => g.home_score != null && g.away_score != null);
          setGames({ upcoming, completed });
        }
      } catch (e) {
        if (mounted) setErr(e.message || "Fehler beim Laden der Benutzerdaten.");
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, [id]);

  const small = { fontSize: 12, color: '#a6bfb3' };
  const pill = { display: 'inline-block', padding: '4px 10px', borderRadius: 999, border: '1px solid #2f6b57', background: '#0e2a22', color: '#dfe' };
  const card = { background: '#0f2a20', borderRadius: 16, boxShadow: '0 14px 36px rgba(0,0,0,0.5)' };
  const pad = { padding: 16 };
  const wrap = { padding: 16, color: '#e8efe8', fontFamily: 'Inter, system-ui, sans-serif' };

  const leaguesBySport = useMemo(() => (leagues || []).reduce((m, l) => {
    const key = (l.sport || 'Andere').trim();
    (m[key] = m[key] || []).push(l);
    return m;
  }, {}), [leagues]);

  // Stats aus abgeschlossenen Spielen berechnen
  const stats = useMemo(() => {
    if (!user) return { wins: 0, losses: 0, draws: 0, matches: 0 };
    let wins = 0, losses = 0, draws = 0;
    const meId = user?.id;
    for (const g of (games.completed || [])) {
      const hs = Number(g.home_score); const as = Number(g.away_score);
      if (!Number.isFinite(hs) || !Number.isFinite(as)) continue;
      const isHome = String(g.home_user_id || '') === String(meId);
      const isAway = String(g.away_user_id || '') === String(meId);
      if (isHome) { if (hs > as) wins++; else if (hs < as) losses++; else draws++; }
      else if (isAway) { if (as > hs) wins++; else if (as < hs) losses++; else draws++; }
    }
    return { wins, losses, draws, matches: (games.completed || []).length };
  }, [games.completed, user]);

  if (loading) return <div style={{ padding: 16 }}>Lade Benutzerdaten...</div>;
  if (err) return <div style={{ padding: 16, color: "crimson" }}>Fehler: {err}</div>;
  if (!user) return <div style={{ padding: 16 }}>Benutzer nicht gefunden.</div>;

  return (
    <div style={wrap}>
      {/* Header mit Avatar, Name, Badges, Stats */}
      <div style={{ ...card, paddingBottom: 0 }}>
        <div style={{ ...pad, display: 'flex', alignItems: 'center', gap: 16 }}>
          <img alt="avatar" src={`https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent((user.firstname||'')+' '+(user.lastname||''))}&backgroundType=gradientLinear&fontWeight=700`} style={{ width: 80, height: 80, borderRadius: 80, objectFit: 'cover', background: '#1b3a31' }} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 28, fontWeight: 900 }}>{user.firstname} {user.lastname}</div>
            <div style={small}>Einzelspieler</div>
          </div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {user?.id && (
              <Link to={`/chat/user/${user.id}`} style={pill}>Chat senden</Link>
            )}
            {Object.keys(leaguesBySport).map((s) => (
              <span key={s} style={{ ...pill, background: '#143329' }}>{s}</span>
            ))}
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, padding: 16 }}>
          <div style={{ textAlign: 'center', padding: '10px 6px' }}>
            <div style={{ fontSize: 34, fontWeight: 900 }}>{stats.wins}</div>
            <div style={{ color: '#bcd' }}>Siege</div>
          </div>
          <div style={{ textAlign: 'center', padding: '10px 6px' }}>
            <div style={{ fontSize: 34, fontWeight: 900 }}>{stats.losses}</div>
            <div style={{ color: '#bcd' }}>Niederlagen</div>
          </div>
          <div style={{ textAlign: 'center', padding: '10px 6px' }}>
            <div style={{ fontSize: 34, fontWeight: 900 }}>{stats.draws}</div>
            <div style={{ color: '#bcd' }}>Unentschieden</div>
          </div>
          <div style={{ textAlign: 'center', padding: '10px 6px' }}>
            <div style={{ fontSize: 34, fontWeight: 900 }}>{stats.matches}</div>
            <div style={{ color: '#bcd' }}>Matches</div>
          </div>
        </div>
      </div>

      {/* Ligen */}
      <div style={{ ...card, marginTop: 16 }}>
        <div style={{ ...pad, paddingBottom: 8 }}>
          <div style={{ fontSize: 18, fontWeight: 700 }}>Ligen</div>
          <div style={small}>Stadt und Sport als Text</div>
        </div>
        <div style={{ ...pad, paddingTop: 8 }}>
          {leagues.length === 0 ? (
            <div style={small}>Keine Ligen gefunden.</div>
          ) : (
            <div style={{ display: 'grid', gap: 10 }}>
              {leagues.map(l => (
                <div key={l.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#0b1e19', borderRadius: 12, padding: 12 }}>
                  <div>
                    <div style={{ fontWeight: 700 }}>{l.name}</div>
                    <div style={small}>{[l.sport, l.city].filter(Boolean).join(' · ')}</div>
                  </div>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    {l.id && <Link to={`/league/${l.id}`} style={pill}>Zur Liga</Link>}
                    {l.city_id && <Link to={`/cities/${l.city_id}`} style={pill}>Zur Stadt</Link>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Spiele */}
      <div style={{ display: 'grid', gap: 16, gridTemplateColumns: '1fr', marginTop: 16 }}>
        <div style={{ ...card }}>
          <div style={{ ...pad, paddingBottom: 8 }}>
            <div style={{ fontSize: 18, fontWeight: 700 }}>Kommende Spiele</div>
          </div>
          <div style={{ ...pad, paddingTop: 8 }}>
            {games.upcoming.length === 0 ? (
              <div style={small}>Keine kommenden Spiele.</div>
            ) : (
              <div style={{ display: 'grid', gap: 10 }}>
                {games.upcoming.map(g => (
                  <div key={g.id} style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr auto', alignItems: 'center', gap: 10, background: '#0b1e19', borderRadius: 12, padding: 12 }}>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontWeight: 600 }}>
                        {new Date(g.kickoff_at || Date.now()).toLocaleString('de-DE')}
                      </div>
                    </div>
                    <div style={{ textAlign: 'right', color: '#9db' }}>{g.home}</div>
                    <div style={{ textAlign: 'center', fontWeight: 700 }}>VS</div>
                    <div style={{ color: '#9db' }}>{g.away}</div>
                    <div style={{ gridColumn: '1 / -1', marginTop: 8 }}>
                      <Link to={`/matches/${g.id}`} style={pill}>Details</Link>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div style={{ ...card }}>
          <div style={{ ...pad, paddingBottom: 8 }}>
            <div style={{ fontSize: 18, fontWeight: 700 }}>Vergangene Spiele</div>
          </div>
          <div style={{ ...pad, paddingTop: 8 }}>
            {games.completed.length === 0 ? (
              <div style={small}>Keine abgeschlossenen Spiele.</div>
            ) : (
              <div style={{ display: 'grid', gap: 10 }}>
                {games.completed.map(g => (
                  <div key={g.id} style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr auto', alignItems: 'center', gap: 10, background: '#0b1e19', borderRadius: 12, padding: 12 }}>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontWeight: 600 }}>
                        {new Date(g.kickoff_at || Date.now()).toLocaleString('de-DE')}
                      </div>
                    </div>
                    <div style={{ textAlign: 'right', color: '#9db' }}>{g.home}</div>
                    <div style={{ textAlign: 'center', fontWeight: 700 }}>{(g.home_score!=null && g.away_score!=null) ? `${g.home_score}:${g.away_score}` : '— : —'}</div>
                    <div style={{ color: '#9db' }}>{g.away}</div>
                    <div style={{ gridColumn: '1 / -1', marginTop: 8 }}>
                      <Link to={`/matches/${g.id}`} style={pill}>Details</Link>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
