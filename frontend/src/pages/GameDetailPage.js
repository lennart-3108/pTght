import React, { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { API_BASE } from "../config";

export default function GameDetailPage() {
  const { gameId } = useParams();
  const [game, setGame] = useState(null);
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    setErr("");
    fetch(`${API_BASE}/matches/${gameId}`)
      .then(async (r) => {
        const j = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(j?.error || `HTTP ${r.status}`);
        return j;
      })
      .then(j => mounted && setGame(j))
      .catch(e => mounted && setErr(e.message || "Fehler"))
      .finally(() => mounted && setLoading(false));
    return () => { mounted = false; };
  }, [gameId]);

  function formatDate(input) {
    if (!input) return "-";
    const d = new Date(input);
    if (!Number.isNaN(d.getTime())) return d.toLocaleString();
    const num = Number(input);
    if (Number.isFinite(num)) {
      const d2 = new Date(num);
      return Number.isNaN(d2.getTime()) ? "-" : d2.toLocaleString();
    }
    return "-";
  }
  // fetch league games to build player histories
  const [leagueGames, setLeagueGames] = useState([]);
  const leagueId = game?.leagueId || null;
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        if (!leagueId) {
          if (mounted) setLeagueGames([]);
          return;
        }
        const r = await fetch(`${API_BASE}/leagues/${leagueId}/games`);
        if (!r.ok) return;
        const j = await r.json().catch(() => null);
        if (!mounted) return;
        const arr = Array.isArray(j) ? j : (j && j.upcoming ? (j.upcoming.concat(j.completed || [])) : []);
        setLeagueGames(Array.isArray(arr) ? arr : []);
      } catch (e) {
        // ignore
      }
    })();
    return () => { mounted = false; };
  }, [leagueId]);

  // fetch standings (completed matches) to compute simple table positions
  const [standings, setStandings] = useState([]);
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        if (!leagueId) {
          if (mounted) setStandings([]);
          return;
        }
        const r = await fetch(`${API_BASE}/leagues/${leagueId}/standings`);
        if (!r.ok) return;
        const rows = await r.json().catch(() => []);
        if (!mounted) return;
        setStandings(Array.isArray(rows) ? rows : []);
      } catch (e) {
        // ignore
      }
    })();
    return () => { mounted = false; };
  }, [leagueId]);

  if (loading) return <div style={{ padding: 16 }}>Lade Spiel ...</div>;
  if (err) return <div style={{ padding: 16, color: "crimson" }}>Fehler: {err}</div>;
  if (!game) return <div style={{ padding: 16 }}>Kein Spiel gefunden.</div>;

  const playerA = { name: game.home_user_name || game.home || "-", id: game.home_user_id || null };
  const playerB = { name: game.away_user_name || game.away || "-", id: game.away_user_id || null };

  // compute simple table positions from standings (win=3, draw=1, loss=0)
  function computeTablePositions(rows) {
    const map = Object.create(null);
    (rows || []).forEach(r => {
      const h = String(r.home || '').trim();
      const a = String(r.away || '').trim();
      const hs = Number(r.home_score || 0);
      const as = Number(r.away_score || 0);
      if (!h || !a) return;
      map[h] = map[h] || { name: h, played: 0, points: 0, gf: 0, ga: 0 };
      map[a] = map[a] || { name: a, played: 0, points: 0, gf: 0, ga: 0 };
      map[h].played += 1; map[a].played += 1;
      map[h].gf += hs; map[h].ga += as;
      map[a].gf += as; map[a].ga += hs;
      if (hs > as) { map[h].points += 3; }
      else if (hs < as) { map[a].points += 3; }
      else { map[h].points += 1; map[a].points += 1; }
    });
    const arr = Object.values(map);
    arr.sort((x,y) => (y.points - x.points) || ((y.gf - y.ga) - (x.gf - x.ga)) || (y.gf - x.gf));
    const pos = Object.create(null);
    arr.forEach((row, idx) => { pos[row.name] = { rank: idx + 1, ...row }; });
    return pos;
  }
  const tablePositions = computeTablePositions(standings);

  function filterHistoryForPlayer(player) {
    if (!player) return [];
    return (leagueGames || []).filter(g => {
      // exclude the current match from history
      const currentId = String(game?.id || gameId || '') ;
      if (String(g.id || '') === currentId) return false;
      const homeMatch = String(g.home || g.home_text || "").trim();
      const awayMatch = String(g.away || g.away_text || "").trim();
      // if user ids are present in league games, prefer them
      if (player.id && (g.home_user_id || g.away_user_id)) {
        return String(g.home_user_id) === String(player.id) || String(g.away_user_id) === String(player.id);
      }
      // fallback to name match
      return homeMatch === String(player.name) || awayMatch === String(player.name);
    }).map(g => ({ id: g.id, date: g.kickoff_at || g.date || null, home: g.home, away: g.away, score: (g.home_score != null && g.away_score != null) ? `${g.home_score}:${g.away_score}` : null }));
  }

  const histA = filterHistoryForPlayer(playerA);
  const histB = filterHistoryForPlayer(playerB);

  // layout styles
  const containerStyle = { padding: 20, maxWidth: 1100, margin: '12px auto', fontFamily: 'Inter, Roboto, Arial, sans-serif', color: '#e8efe8' };
  const cardStyle = { background: '#0f2a20', borderRadius: 12, padding: 18, boxShadow: '0 10px 30px rgba(0,0,0,0.6)' };
  const leftStyle = { flex: '1 1 280px' };
  const rightStyle = { flex: '1 1 280px' };

  return (
    <div style={containerStyle}>
      <div style={{ display: 'flex', gap: 20, alignItems: 'flex-start' }}>
        {/* Left player */}
        <div style={{ ...leftStyle }}>
          <div style={cardStyle}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <h3 style={{ margin: 0 }}>{playerA.name}</h3>
              {tablePositions[playerA.name] ? (
                <span style={{ background: '#163a2f', color: '#ffd', padding: '4px 8px', borderRadius: 8, fontSize: 12 }}>#{tablePositions[playerA.name].rank}</span>
              ) : null}
            </div>
            <div style={{ marginTop: 10, color: '#bcd' }}>Position: Einzelspieler</div>
            <div style={{ marginTop: 8 }}>Name: {playerA.name || '-'}</div>
            {/* additional player info could go here */}
          </div>
        </div>

        {/* Center result & meta */}
        <div style={{ flex: '0 0 360px', textAlign: 'center' }}>
          <div style={{ ...cardStyle, background: 'linear-gradient(135deg,#163a2f,#0f2a20)' }}>
            <div style={{ fontSize: 14, color: '#9db' }}>{formatDate(game.kickoff_at)}{game.location ? ` · ${game.location}` : ''}</div>
            { (game.home_score != null && game.away_score != null) ? (
              <div style={{ marginTop: 12, fontSize: 36, fontWeight: 700 }}>{playerA.name} <span style={{ color: '#ffd' }}>{`${game.home_score}:${game.away_score}`}</span> {playerB.name}</div>
            ) : (
              <div style={{ marginTop: 12, fontSize: 36, fontWeight: 700, color: '#ffd' }}>Ausstehend</div>
            ) }
            <div style={{ marginTop: 8, color: '#9db' }}>{game.league || ''}</div>
          </div>
        </div>

        {/* Right player */}
        <div style={{ ...rightStyle }}>
          <div style={cardStyle}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <h3 style={{ margin: 0 }}>{playerB.name}</h3>
              {tablePositions[playerB.name] ? (
                <span style={{ background: '#163a2f', color: '#ffd', padding: '4px 8px', borderRadius: 8, fontSize: 12 }}>#{tablePositions[playerB.name].rank}</span>
              ) : null}
            </div>
            <div style={{ marginTop: 10, color: '#bcd' }}>Position: Einzelspieler</div>
            <div style={{ marginTop: 8 }}>Name: {playerB.name || '-'}</div>
          </div>
        </div>
      </div>

      {/* Past games table */}
      <div style={{ marginTop: 20 }}>
        <div style={{ display: 'flex', gap: 20 }}>
          <div style={{ flex: 1 }}>
            <h4>Vergangene Spiele – {playerA.name}</h4>
            {histA.length === 0 ? <div>Keine vorherigen Spiele in dieser Liga.</div> : (
              <table style={{ width: '100%', borderCollapse: 'collapse', background: '#071511' }}>
                <thead>
                  <tr style={{ textAlign: 'left', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                    <th>Datum</th><th>Gegner</th><th>Ergebnis</th>
                  </tr>
                </thead>
                <tbody>
                  {histA.map(h => (
                    <tr key={h.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                      <td style={{ padding: 8 }}>{formatDate(h.date)}</td>
                      <td style={{ padding: 8 }}>{h.home === playerA.name ? h.away : h.home}</td>
                      <td style={{ padding: 8 }}>{h.score || 'Ausstehend'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          <div style={{ flex: 1 }}>
            <h4>Vergangene Spiele – {playerB.name}</h4>
            {histB.length === 0 ? <div>Keine vorherigen Spiele in dieser Liga.</div> : (
              <table style={{ width: '100%', borderCollapse: 'collapse', background: '#071511' }}>
                <thead>
                  <tr style={{ textAlign: 'left', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                    <th>Datum</th><th>Gegner</th><th>Ergebnis</th>
                  </tr>
                </thead>
                <tbody>
                  {histB.map(h => (
                    <tr key={h.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                      <td style={{ padding: 8 }}>{formatDate(h.date)}</td>
                      <td style={{ padding: 8 }}>{h.home === playerB.name ? h.away : h.home}</td>
                      <td style={{ padding: 8 }}>{h.score || 'Ausstehend'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>

      <div style={{ marginTop: 18 }}>
        <Link to={`/league/${game.leagueId || ''}`}>← Zurück zur Liga</Link>
      </div>
    </div>
  );
}
