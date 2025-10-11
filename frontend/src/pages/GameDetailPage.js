import React, { useEffect, useMemo, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { API_BASE } from "../config";
import MatchChat from "../components/MatchChat";

export default function GameDetailPage() {
  const { gameId } = useParams();
  const navigate = useNavigate();
  const [game, setGame] = useState(null);
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(true);
  // auth token for optional result submission
  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
  const [hScore, setHScore] = useState('');
  const [aScore, setAScore] = useState('');
  const [submitMsg, setSubmitMsg] = useState('');
  // permission to submit result (must be declared before any early return)
  const [canSubmit, setCanSubmit] = useState(false);
  const [cannotReason, setCannotReason] = useState('');
  // weekly status for league (to disable join when already has a weekly match)
  const [hasWeeklyMatch, setHasWeeklyMatch] = useState(false);
  const [joinMsg, setJoinMsg] = useState('');
  const [scheduleMsg, setScheduleMsg] = useState('');
  // calendar-friendly date+time fields (pop up native calendar/time pickers)
  const [dateStr, setDateStr] = useState(""); // yyyy-mm-dd
  const [timeStr, setTimeStr] = useState(""); // HH:mm

  // Layout policy: keep three cards always side-by-side; enable horizontal scrolling on small screens

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
    if (Number.isNaN(d.getTime())) return "-";
    // German long date
    const opts = { year: 'numeric', month: 'long', day: 'numeric' };
    return d.toLocaleDateString('de-DE', opts);
  }
  function formatTime(input) {
    if (!input) return "";
    const d = new Date(input);
    if (Number.isNaN(d.getTime())) return "";
    return d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
  }
  const relativeFromNow = useMemo(() => (when) => {
    if (!when) return "";
    const d = new Date(when);
    if (Number.isNaN(d.getTime())) return "";
    const now = new Date();
    const diff = d.getTime() - now.getTime();
    const abs = Math.abs(diff);
    const days = Math.round(abs / (24*60*60*1000));
    if (days >= 2) return diff >= 0 ? `in ${days} Tagen` : `vor ${days} Tagen`;
    const hours = Math.round(abs / (60*60*1000));
    if (hours >= 2) return diff >= 0 ? `in ${hours} Stunden` : `vor ${hours} Stunden`;
    const mins = Math.max(1, Math.round(abs / (60*1000)));
    return diff >= 0 ? `in ${mins} Minuten` : `vor ${mins} Minuten`;
  }, []);
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

  // fetch my weekly status for this league (if logged in)
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        if (!token || !leagueId) { if (mounted) setHasWeeklyMatch(false); return; }
        const r = await fetch(`${API_BASE}/leagues/${leagueId}/my-weekly-status`, { headers: { Authorization: `Bearer ${token}` } });
        if (!r.ok) { if (mounted) setHasWeeklyMatch(false); return; }
        const j = await r.json().catch(() => ({ hasWeeklyMatch: false }));
        if (mounted) setHasWeeklyMatch(!!j.hasWeeklyMatch);
      } catch { if (mounted) setHasWeeklyMatch(false); }
    })();
    return () => { mounted = false; };
  }, [token, leagueId]);

  // fetch standings (completed matches) to compute simple table positions
  const [standings, setStandings] = useState([]);
  // control schedule form visibility
  const [showSchedule, setShowSchedule] = useState(false);
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

  // fetch permission for submitting result
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        if (!token || !gameId) { if (mounted){ setCanSubmit(false); setCannotReason(''); } return; }
        const r = await fetch(`${API_BASE}/matches/${gameId}/can-submit`, { headers: { Authorization: `Bearer ${token}` } });
        const j = await r.json().catch(() => ({ canSubmit: false }));
        if (!mounted) return;
        setCanSubmit(!!j.canSubmit);
        setCannotReason(j.reason || '');
      } catch {
        if (mounted) { setCanSubmit(false); setCannotReason(''); }
      }
    })();
    return () => { mounted = false; };
  }, [token, gameId, game?.kickoff_at]);

  // when game kickoff is present, prefill calendar fields with local date+time
  useEffect(() => {
    if (!game?.kickoff_at) return;
    const d = new Date(game.kickoff_at);
    if (Number.isNaN(d.getTime())) return;
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    const hh = String(d.getHours()).padStart(2, '0');
    const mi = String(d.getMinutes()).padStart(2, '0');
    setDateStr(`${yyyy}-${mm}-${dd}`);
    setTimeStr(`${hh}:${mi}`);
  }, [game?.kickoff_at]);

  // decide default visibility of schedule form
  useEffect(() => {
    setShowSchedule(!game?.kickoff_at);
  }, [game?.kickoff_at]);

  if (loading) return <div style={{ padding: 16 }}>Lade Spiel ...</div>;
  if (err) return <div style={{ padding: 16, color: "crimson" }}>Fehler: {err}</div>;
  if (!game) return <div style={{ padding: 16 }}>Kein Spiel gefunden.</div>;

  const playerA = { name: game.home_user_name || game.home || "-", id: game.home_user_id || null };
  const playerB = { name: game.away_user_name || game.away || "-", id: game.away_user_id || null };

  // decode JWT (locally) to get the current viewer's user id without extra /me call
  function decodeJwt(t) {
    try {
      const p = t.split(".")[1];
      const json = atob(p.replace(/-/g, "+").replace(/_/g, "/"));
      return JSON.parse(decodeURIComponent(
        json.split("").map(c => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2)).join("")
      ));
    } catch { return null; }
  }
  const viewer = token ? decodeJwt(token) : null;
  const viewerId = viewer && (viewer.id || viewer.userId || viewer.user_id);
  const isParticipant = viewerId && (
    (game.home_user_id != null && String(game.home_user_id) === String(viewerId)) ||
    (game.away_user_id != null && String(game.away_user_id) === String(viewerId))
  );
  const isCompleted = (game.home_score != null && game.away_score != null);

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

  // layout styles – hero card like in mockup
  const containerStyle = { padding: 16, width: '100%', maxWidth: '900px', margin: '0 auto', fontFamily: 'Inter, Roboto, Arial, sans-serif', color: '#e8efe8' };
  const cardStyle = { background: '#0f2a20', borderRadius: 16, padding: 16, boxShadow: '0 16px 40px rgba(0,0,0,0.55)' };

  async function submitResult(e) {
    e.preventDefault();
    setSubmitMsg('');
    if (!token) { setSubmitMsg('Bitte einloggen.'); return; }
    const hs = String(hScore).trim();
    const as = String(aScore).trim();
    if (hs === '' || as === '' || Number.isNaN(Number(hs)) || Number.isNaN(Number(as))) {
      setSubmitMsg('Bitte gültige Zahlen eingeben.');
      return;
    }
    try {
      const r = await fetch(`${API_BASE}/matches/${gameId}/result`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ home_score: Number(hs), away_score: Number(as) })
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j?.error || `HTTP ${r.status}`);
      setSubmitMsg('Ergebnis gespeichert.');
      setGame(j);
      // Redirect to league after confirmation
      setTimeout(() => { window.location.href = `/league/${leagueId || ''}`; }, 800);
    } catch (e) {
      setSubmitMsg(e.message || 'Fehler beim Speichern.');
    }
  }

  async function joinMatch() {
    setJoinMsg('');
    if (!token) { setJoinMsg('Bitte einloggen.'); return; }
    try {
      const r = await fetch(`${API_BASE}/matches/${gameId}/join`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j?.error || `HTTP ${r.status}`);
      setJoinMsg('Beigetreten.');
      // Re-fetch canonical projection to ensure names and permissions are fresh
      const fres = await fetch(`${API_BASE}/matches/${gameId}`);
      const fresh = await fres.json().catch(() => j);
      setGame(fres.ok ? fresh : j);
    } catch (e) {
      setJoinMsg(e.message || 'Beitreten fehlgeschlagen.');
    }
  }

  async function scheduleMatch(e) {
    e.preventDefault();
    setScheduleMsg('');
    if (!token) { setScheduleMsg('Bitte einloggen.'); return; }
    if (!dateStr || !timeStr) { setScheduleMsg('Bitte Datum und Uhrzeit wählen.'); return; }
    const scheduleAt = `${dateStr}T${timeStr}`; // local time string, backend will parse
    try {
      const r = await fetch(`${API_BASE}/matches/${gameId}/schedule`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ kickoff_at: scheduleAt })
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j?.error || `HTTP ${r.status}`);
      setScheduleMsg('Termin gespeichert.');
      // reload full match to keep display names and status consistent
      const fres = await fetch(`${API_BASE}/matches/${gameId}`);
      const fresh = await fres.json().catch(() => j);
      setGame(fres.ok ? fresh : j);
      // re-check permission after scheduling
      try {
        if (token) {
          const cr = await fetch(`${API_BASE}/matches/${gameId}/can-submit`, { headers: { Authorization: `Bearer ${token}` } });
          const cj = await cr.json().catch(() => ({}));
          setCanSubmit(!!cj.canSubmit);
          setCannotReason(cj.reason || '');
        }
      } catch {}
    } catch (e) {
      setScheduleMsg(e.message || 'Termin setzen fehlgeschlagen.');
    }
  }

  async function cancelMatch() {
    setScheduleMsg('');
    if (!token) { setScheduleMsg('Bitte einloggen.'); return; }
    try {
      const r = await fetch(`${API_BASE}/matches/${gameId}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j?.error || `HTTP ${r.status}`);
      // after deletion, navigate back to league overview
  navigate(leagueId ? `/league/${leagueId}` : '/leagues', { replace: true });
    } catch (e) {
      setScheduleMsg(e.message || 'Absagen fehlgeschlagen.');
    }
  }

  return (
    <div style={containerStyle}>
      {/* Hero match card */}
      <div style={{ ...cardStyle, padding: 20, background: 'linear-gradient(145deg, #102a22, #0c1f1a)' }}>
        {/* Header row */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
          <div style={{ fontSize: 24, fontWeight: 700 }}>{game.league || 'Liga'}</div>
          <div style={{ color: '#b9d3c7', fontSize: 14 }}>#{game.id} · {isCompleted ? 'Beendet' : 'Ausstehend'}</div>
        </div>

        {/* Date + status */}
        <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontSize: 20 }}>{formatDate(game.kickoff_at) || 'Termin N.N.'}</div>
            <div style={{ color: '#9db', fontSize: 14 }}>{game.kickoff_at ? relativeFromNow(game.kickoff_at) : '—'}</div>
          </div>
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ width: 8, height: 8, background: '#ffd35d', borderRadius: 999 }} />
            <span style={{ color: '#ffd35d' }}>{isCompleted ? 'Beendet' : 'Ausstehend'}</span>
          </div>
        </div>

        {/* VS Row */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', alignItems: 'center', gap: 16, marginTop: 16 }}>
          <div style={{ textAlign: 'left' }}>
            {playerA.id ? (
              <Link to={`/user/${playerA.id}`} style={{ textDecoration: 'none', color: '#f4fff8', display: 'inline-block' }}>
                <div style={{ width: 110, height: 110, borderRadius: 110, background: '#173a30', display: 'grid', placeItems: 'center', color: '#6fc89c', fontWeight: 800, fontSize: 28 }}>
                  {String(playerA.name || '?').split(' ').map(s=>s[0]).join('').slice(0,2).toUpperCase()}
                </div>
                <div style={{ marginTop: 10, fontSize: 22, fontWeight: 700 }}>{playerA.name}</div>
              </Link>
            ) : (
              <>
                <div style={{ width: 110, height: 110, borderRadius: 110, background: '#173a30', display: 'grid', placeItems: 'center', color: '#6fc89c', fontWeight: 800, fontSize: 28 }}>
                  {String(playerA.name || '?').split(' ').map(s=>s[0]).join('').slice(0,2).toUpperCase()}
                </div>
                <div style={{ marginTop: 10, fontSize: 22, fontWeight: 700 }}>{playerA.name}</div>
              </>
            )}
            <div style={{ color: '#9db' }}>{tablePositions[playerA.name] ? `${tablePositions[playerA.name].rank}. Rang` : '—'}</div>
            <div style={{ marginTop: 10 }}>
              <Link to={playerA.id ? `/user/${playerA.id}` : '#'} style={{ display: 'inline-block', padding: '8px 12px', borderRadius: 10, border: '1px solid #2f6b57', background: '#0e2a22', color: '#dfe', textDecoration: 'none' }}>Team ansehen</Link>
            </div>
          </div>
          <div style={{ fontSize: 40, color: '#cde' }}>VS</div>
          <div style={{ textAlign: 'right' }}>
            {playerB.id ? (
              <Link to={`/user/${playerB.id}`} style={{ textDecoration: 'none', color: '#f4fff8', display: 'inline-block' }}>
                <div style={{ width: 110, height: 110, borderRadius: 110, background: '#3a1717', display: 'grid', placeItems: 'center', color: '#f3a1a1', fontWeight: 800, fontSize: 28, marginLeft: 'auto' }}>
                  {String(playerB.name || '?').split(' ').map(s=>s[0]).join('').slice(0,2).toUpperCase()}
                </div>
                <div style={{ marginTop: 10, fontSize: 22, fontWeight: 700 }}>{playerB.name}</div>
              </Link>
            ) : (
              <>
                <div style={{ width: 110, height: 110, borderRadius: 110, background: '#3a1717', display: 'grid', placeItems: 'center', color: '#f3a1a1', fontWeight: 800, fontSize: 28, marginLeft: 'auto' }}>
                  {String(playerB.name || '?').split(' ').map(s=>s[0]).join('').slice(0,2).toUpperCase()}
                </div>
                <div style={{ marginTop: 10, fontSize: 22, fontWeight: 700 }}>{playerB.name}</div>
              </>
            )}
            <div style={{ color: '#9db' }}>{tablePositions[playerB.name] ? `${tablePositions[playerB.name].rank}. Rang` : '—'}</div>
            <div style={{ marginTop: 10 }}>
              <Link to={playerB.id ? `/user/${playerB.id}` : '#'} style={{ display: 'inline-block', padding: '8px 12px', borderRadius: 10, border: '1px solid #2f6b57', background: '#0e2a22', color: '#dfe', textDecoration: 'none' }}>Team ansehen</Link>
            </div>
          </div>
        </div>

        {/* Final result banner (when completed) */}
        {isCompleted && (
          <div style={{ marginTop: 12, display: 'flex', justifyContent: 'center' }}>
            <div style={{ fontSize: 36, fontWeight: 800, color: '#e8efe8', letterSpacing: 1, background: '#0a1c17', border: '1px solid #26493c', padding: '8px 16px', borderRadius: 12 }}>
              {Number(game.home_score)} : {Number(game.away_score)}
            </div>
          </div>
        )}

        {/* Location */}
        {game.location && (
          <div style={{ marginTop: 12, color: '#bcd', display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 18 }}>📍</span>
            <span>{game.location}</span>
          </div>
        )}

        {/* Action buttons */}
        <div style={{ marginTop: 16, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          {(token && game && game.home_score == null && game.away_score == null && ((game.home_user_id != null || game.home) && (game.away_user_id != null || game.away))) && (
            <button onClick={() => setShowSchedule(s => !s)} style={{ padding: '10px 14px', borderRadius: 10, border: '1px solid #2f6b57', background: '#0e2a22', color: '#dfe' }}>
              {game.kickoff_at ? 'Termin ändern' : 'Termin festlegen'}
            </button>
          )}
          {/* Chat toggle removed; chat is always visible below */}
          {(token && game && game.home_score == null && game.away_score == null) && (
            <button onClick={cancelMatch} style={{ padding: '10px 14px', borderRadius: 10, border: '1px solid #553f3f', background: '#2a1b1b', color: '#e9d8d8' }}>ABSAGEN</button>
          )}
        </div>

        {/* Schedule form (toggled) */}
        {(token && game && game.home_score == null && game.away_score == null && showSchedule) && (
          <ScheduleSection
            open={showSchedule}
            setOpen={setShowSchedule}
            dateStr={dateStr}
            timeStr={timeStr}
            setDateStr={setDateStr}
            setTimeStr={setTimeStr}
            onSubmit={scheduleMatch}
            message={scheduleMsg}
          />
        )}

        {/* Join match when opponent not yet assigned */}
        {(token && game && !isParticipant && game.home_score == null && game.away_score == null && (game.away_user_id == null && !game.away)) && (
          <div style={{ marginTop: 12 }}>
            <button onClick={joinMatch} disabled={hasWeeklyMatch} style={{ padding: '8px 12px', borderRadius: 10, border: '1px solid #2f6b57', background: hasWeeklyMatch ? '#24463c' : '#1b4b3d', color: '#fff', cursor: hasWeeklyMatch ? 'not-allowed' : 'pointer' }}>
              Diesem Match beitreten
            </button>
            {hasWeeklyMatch && <div style={{ marginTop: 6, color: '#ccc' }}>Du hast diese Woche bereits ein Match in dieser Liga.</div>}
            {joinMsg && <div style={{ marginTop: 6, color: joinMsg.includes('Beigetreten') ? '#9f9' : '#fcc' }}>{joinMsg}</div>}
          </div>
        )}

        {/* Result submission */}
        {(token && (game.home_score == null && game.away_score == null)) && (
          <form onSubmit={submitResult} style={{ marginTop: 18 }}>
            <div style={{ fontSize: 20, fontWeight: 700, marginBottom: 8 }}>Ergebnis eintragen</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
              <input disabled={!canSubmit} type="number" inputMode="numeric" pattern="[0-9]*" min={0} value={hScore} onChange={e => setHScore(e.target.value)} placeholder="—" style={{ flex: '0 0 120px', padding: '10px 12px', borderRadius: 12, border: '1px solid #26493c', background: '#0a1c17', color: '#e8efe8', fontSize: 20, textAlign: 'center' }} />
              <span style={{ fontSize: 28, color: '#9db', fontWeight: 700 }}>:</span>
              <input disabled={!canSubmit} type="number" inputMode="numeric" pattern="[0-9]*" min={0} value={aScore} onChange={e => setAScore(e.target.value)} placeholder="—" style={{ flex: '0 0 120px', padding: '10px 12px', borderRadius: 12, border: '1px solid #26493c', background: '#0a1c17', color: '#e8efe8', fontSize: 20, textAlign: 'center' }} />
              <button disabled={!canSubmit} type="submit" style={{ padding: '10px 14px', borderRadius: 12, border: '1px solid #2f6b57', background: canSubmit ? '#1b4b3d' : '#24463c', color: '#fff', cursor: canSubmit ? 'pointer' : 'not-allowed' }}>Ergebnis speichern</button>
            </div>
            {(!canSubmit && cannotReason) && (
              <div style={{ marginTop: 8, color: '#ccc' }}>Kein Schreibrecht: {cannotReason === 'KICKOFF_NOT_SET' ? 'Termin noch nicht festgelegt' : cannotReason}</div>
            )}
            {submitMsg && <div style={{ marginTop: 8, color: submitMsg.includes('gespeichert') ? '#9f9' : '#fcc' }}>{submitMsg}</div>}
          </form>
        )}
      </div>

      <MatchChat matchId={gameId} token={token} />

      {/* Past games table */}
      <div style={{ marginTop: 16 }}>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <div style={{ flex: '1 1 320px', minWidth: 260 }}>
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
                      <td style={{ padding: 8 }}>{formatDate(h.date)} {formatTime(h.date) && <span style={{ color: '#96a' }}>· {formatTime(h.date)}</span>}</td>
                      <td style={{ padding: 8 }}>{h.home === playerA.name ? h.away : h.home}</td>
                      <td style={{ padding: 8 }}>{h.score || 'Ausstehend'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          <div style={{ flex: '1 1 320px', minWidth: 260 }}>
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
                      <td style={{ padding: 8 }}>{formatDate(h.date)} {formatTime(h.date) && <span style={{ color: '#96a' }}>· {formatTime(h.date)}</span>}</td>
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

// Collapsible schedule section with native calendar and time popups
function ScheduleSection({ open, setOpen, dateStr, timeStr, setDateStr, setTimeStr, onSubmit, message }) {
  return (
    <div style={{ marginTop: 16 }}>
      {!open && (
        <button onClick={() => setOpen(true)} style={{ padding: '8px 12px', borderRadius: 10, border: '1px solid #2f6b57', background: '#0e2a22', color: '#dfe' }}>
          Termin bearbeiten
        </button>
      )}
      {open && (
        <form onSubmit={onSubmit} style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <label style={{ color: '#9db' }}>Datum
            <input type="date" value={dateStr} onChange={(e) => setDateStr(e.target.value)} style={{ marginLeft: 8, padding: '8px 10px', borderRadius: 10, border: '1px solid #26493c', background: '#0a1c17', color: '#e8efe8' }} />
          </label>
          <label style={{ color: '#9db' }}>Uhrzeit
            <input type="time" value={timeStr} onChange={(e) => setTimeStr(e.target.value)} style={{ marginLeft: 8, padding: '8px 10px', borderRadius: 10, border: '1px solid #26493c', background: '#0a1c17', color: '#e8efe8' }} />
          </label>
          <button type="submit" style={{ padding: '8px 12px', borderRadius: 10, border: '1px solid #2f6b57', background: '#1b4b3d', color: '#fff' }}>Speichern</button>
          <button type="button" onClick={() => setOpen(false)} style={{ padding: '8px 12px', borderRadius: 10, border: '1px solid #2f6b57', background: 'transparent', color: '#dfe' }}>Schließen</button>
          {message && <div style={{ width: '100%', color: message.includes('gespeichert') ? '#9f9' : '#fcc' }}>{message}</div>}
        </form>
      )}
    </div>
  );
}
