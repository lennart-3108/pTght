import React, { useEffect, useState, useMemo } from "react";
import { Link, useParams, useNavigate } from "react-router-dom";
import { API_BASE, fetchWithTimeout } from "../config";
import Avatar from "../components/Avatar";

export default function LeagueDetailPage() {
  const { leagueId } = useParams();
  const navigate = useNavigate();
  const [league, setLeague] = useState(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [joinMsg, setJoinMsg] = useState("");
  const [members, setMembers] = useState([]);
  const [standings, setStandings] = useState([]);
  const [seasons, setSeasons] = useState([]);
  const [selectedSeasonId, setSelectedSeasonId] = useState('current'); // 'overall' | 'current' | numeric id
  const [games, setGames] = useState({ upcoming: [], completed: [] });
  const [loadingExtras, setLoadingExtras] = useState(true);
  const [joining, setJoining] = useState(false);
  const [isMemberByMe, setIsMemberByMe] = useState(null); // null = unknown, true/false = known
  const [myOpenMatch, setMyOpenMatch] = useState(null);
  const [matchSearching, setMatchSearching] = useState(false);
  const [hasWeeklyMatch, setHasWeeklyMatch] = useState(false);
  // Match-Formular
  const [opponentId, setOpponentId] = useState("");
  const [kickoffLocal, setKickoffLocal] = useState("");

  const token = localStorage.getItem("token");

  const myId = useMemo(() => {
    if (!token) return null;
    try {
      const parts = token.split(".");
      if (parts.length < 2) return null;
      const payload = JSON.parse(atob(parts[1]));
      return payload?.user?.id ?? payload?.userId ?? payload?.sub ?? payload?.id ?? null;
    } catch {
      return null;
    }
  }, [token]);

  function getMemberUserId(m) {
    if (!m) return null;
    return m.user_id ?? m.userId ?? m.member_user_id ?? m.memberUserId ?? m.member_id ?? m.memberId ?? m.id ?? null;
  }

  const amMember = useMemo(() => {
    if (isMemberByMe != null) return !!isMemberByMe;
    if (!myId) return false;
    return (members || []).some(m => String(getMemberUserId(m)) === String(myId));
  }, [isMemberByMe, members, myId]);

  const leaguePublicState = league?.publicState ?? league?.public_state ?? league?.visibility ?? "";
  const joinPolicyRaw = league?.joinPolicy ?? league?.join_policy ?? "";
  const joinPolicy = String(joinPolicyRaw || "").toLowerCase();

  const isPublicLeague = useMemo(() => {
    const state = String(leaguePublicState || "").toLowerCase();
    if (!state && !joinPolicy) return true;
    if (["public", "open", "visible", "listed"].includes(state)) return true;
    if (["hidden", "private", "closed"].includes(state)) return false;
    if (["public", "open", "auto", "automatic"].includes(joinPolicy)) return true;
    if (["closed", "manual", "invite", "private"].includes(joinPolicy)) return false;
    return !!(league?.isPublic || league?.public);
  }, [leaguePublicState, joinPolicy, league]);

  const isOpenLeague = useMemo(() => {
    if (["open", "public", "auto", "automatic"].includes(joinPolicy)) return true;
    if (["closed", "manual", "invite", "private"].includes(joinPolicy)) return false;
    const state = String(leaguePublicState || "").toLowerCase();
    if (!state && !joinPolicy) return true;
    if (["open", "public"].includes(state)) return true;
    if (["hidden", "private", "closed"].includes(state)) return false;
    return !!league?.autoJoin;
  }, [joinPolicy, leaguePublicState, league]);

  const joinAvailabilityUnknown = String(leaguePublicState || "").trim() === "" && joinPolicy === "";

  const canAttemptJoin = !amMember && (isOpenLeague || isPublicLeague || joinAvailabilityUnknown);

  async function runMatchSearch({ auto = false, refresh = true } = {}) {
    const t = localStorage.getItem("token");
    if (!t) throw new Error("Nicht eingeloggt");
    const resp = await fetchWithTimeout(`${API_BASE}/leagues/${leagueId}/match-search`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${t}`
      },
      body: JSON.stringify({ auto: !!auto }),
      timeout: 8000
    });
    const data = await resp.json().catch(() => ({}));
    if (!resp.ok) throw new Error(data?.error || `HTTP ${resp.status}`);

    if (data.match && data.match.id) {
      setMyOpenMatch(data.match);
      setGames(prev => {
        const prevUpcoming = Array.isArray(prev?.upcoming) ? prev.upcoming : [];
        const deduped = prevUpcoming.filter(m => String(m.id) !== String(data.match.id));
        return {
          ...prev,
          upcoming: [...deduped, data.match]
        };
      });
    }

    if (refresh) {
      await reloadExtras();
      await fetchMyOpenMatch();
      await fetchMyWeeklyStatus();
    }

    return data;
  }

  const opponents = useMemo(() => {
    return (members || [])
      .map(m => {
        const uid = getMemberUserId(m);
        if (!uid) return null;
        const name = (m.firstname && m.lastname)
          ? `${m.firstname} ${m.lastname}`
          : (m.name || m.username || m.displayName || `User ${uid}`);
        return { id: uid, name };
      })
      .filter(Boolean)
      .filter(o => String(o.id) !== String(myId));
  }, [members, myId]);

  const standingsWithMembers = useMemo(() => {
    const baseRows = (standings || []).map((row, idx) => {
      const uid = String(
        row.user_id ??
        row.userId ??
        row.member_id ??
        row.memberId ??
        ((row.user || {}).id) ??
        (row.key != null ? row.key : idx)
      );
      return {
        ...row,
        _uid: uid,
        name: row.name || row.displayName || row.username || row.key || `User ${uid}`,
        _order: idx
      };
    });

    const existingIds = new Set(baseRows.map(r => r._uid));
    const fillerRows = (members || [])
      .map(m => {
        const uid = String(getMemberUserId(m));
        if (!uid) return null;
        if (existingIds.has(uid)) return null;
        const name = (m.firstname && m.lastname)
          ? `${m.firstname} ${m.lastname}`
          : (m.name || m.username || `User ${uid}`);
        return {
          _uid: uid,
          name,
          played: 0,
          won: 0,
          drawn: 0,
          lost: 0,
          gf: 0,
          ga: 0,
          gd: 0,
          points: 0,
          rank: null,
          _order: Number.MAX_SAFE_INTEGER,
        };
      })
      .filter(Boolean)
      .sort((a, b) => a.name.localeCompare(b.name, 'de'));

    const merged = [...baseRows, ...fillerRows];
    return merged
      .map((row, idx) => ({
        ...row,
        rank: row.rank ?? (row.points || row.won || row.played ? idx + 1 : "–"),
      }))
      .sort((a, b) => {
        if (a._order === b._order) return a.name.localeCompare(b.name, 'de');
        return a._order - b._order;
      });
  }, [standings, members]);

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    setErr("");
    fetch(`${API_BASE}/leagues/${leagueId}`)
      .then(r => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then(async j => {
        if (mounted) setLeague(j);
        // After league loads, check membership via /me/leagues if we have a token
        if (mounted) {
          try {
            const t = localStorage.getItem("token");
            if (t) {
              const ml = await fetch(`${API_BASE}/me/leagues`, { headers: { Authorization: `Bearer ${t}` } })
                .then(r => (r.ok ? r.json() : []))
                .catch(() => []);
              const found = Array.isArray(ml) && ml.some(l => String(l.id || l.leagueId) === String(leagueId));
              setIsMemberByMe(!!found);
            } else {
              setIsMemberByMe(false);
            }
          } catch {
            if (mounted) setIsMemberByMe(false);
          }
        }
      })
      .catch(e => mounted && setErr(e.message || "Fehler"))
      .finally(() => mounted && setLoading(false));
    return () => { mounted = false; };
  }, [leagueId]);

  // fetch my open match for this league
  async function fetchMyOpenMatch() {
    try {
      const t = localStorage.getItem('token');
      if (!t) { setMyOpenMatch(null); return; }
      const r = await fetch(`${API_BASE}/leagues/${leagueId}/my-open-match`, { headers: { Authorization: `Bearer ${t}` } });
      if (!r.ok) { setMyOpenMatch(null); return; }
      const j = await r.json().catch(() => null);
      setMyOpenMatch(j || null);
    } catch (e) {
      setMyOpenMatch(null);
    }
  }

  // fetch my weekly status for this league
  async function fetchMyWeeklyStatus() {
    try {
      const t = localStorage.getItem('token');
      if (!t) { setHasWeeklyMatch(false); return; }
      const r = await fetch(`${API_BASE}/leagues/${leagueId}/my-weekly-status`, { headers: { Authorization: `Bearer ${t}` } });
      if (!r.ok) { setHasWeeklyMatch(false); return; }
      const j = await r.json().catch(() => ({ hasWeeklyMatch: false }));
      setHasWeeklyMatch(!!j?.hasWeeklyMatch);
    } catch (e) {
      setHasWeeklyMatch(false);
    }
  }

  async function reloadExtras() {
    setLoadingExtras(true);
    try {
      const [m, sList, g] = await Promise.all([
        fetch(`${API_BASE}/leagues/${leagueId}/members`, { headers: { Authorization: `Bearer ${token}` } })
          .then(r => (r.ok ? r.json() : []))
          .catch(() => []),
        fetch(`${API_BASE}/leagues/${leagueId}/seasons`)
          .then(r => (r.ok ? r.json() : []))
          .catch(() => []),
        fetch(`${API_BASE}/leagues/${leagueId}/games`)
          .then(r => (r.ok ? r.json() : { upcoming: [], completed: [] }))
          .catch(() => ({ upcoming: [], completed: [] }))
      ]);
      setMembers(Array.isArray(m) ? m : []);
      setSeasons(Array.isArray(sList) ? sList : []);
      // initial standings load (current season) in classic table format
      try {
        const r = await fetch(`${API_BASE}/leagues/${leagueId}/standings?format=table`);
        const j = await r.json().catch(() => []);
        setStandings(Array.isArray(j) ? j : []);
      } catch { setStandings([]); }
      setGames({ upcoming: g.upcoming || [], completed: g.completed || [] });
    } finally {
      setLoadingExtras(false);
    }
  }

  useEffect(() => {
    // Lade Extras erst, wenn die Liga erfolgreich geladen wurde.
    if (league) reloadExtras();
  }, [league, token]); // <-- abhängig von 'league' statt nur leagueId
  // reload standings on season change (classic table format)
  useEffect(() => {
    if (!leagueId) return;
    (async () => {
      try {
        let url = `${API_BASE}/leagues/${leagueId}/standings?format=table`;
        if (selectedSeasonId === 'overall') url = `${url}&scope=overall`;
        else if (selectedSeasonId && selectedSeasonId !== 'current') url = `${url}&seasonId=${selectedSeasonId}`;
        const r = await fetch(url);
        const j = await r.json().catch(() => []);
        setStandings(Array.isArray(j) ? j : []);
      } catch { setStandings([]); }
    })();
  }, [leagueId, selectedSeasonId]);

  useEffect(() => {
    // whenever league or membership changes, refresh my open match
    fetchMyOpenMatch();
    fetchMyWeeklyStatus();
  }, [leagueId, isMemberByMe]);

  async function handleJoin() {
    try {
      setJoining(true);
      const token = localStorage.getItem("token");
      const r = await fetchWithTimeout(`${API_BASE}/leagues/${leagueId}/join`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        timeout: 8000
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j?.error || `HTTP ${r.status}`);

      const baseMsg = j.joined ? "✅ Beigetreten." : (j.message || "Bereits Mitglied");
      let extrasMsg = "";
      if (j.matchAction === "paired") extrasMsg = " Ein Match wurde dir direkt zugewiesen.";
      else if (j.matchAction === "created") extrasMsg = " Ein offenes Match wurde für dich erstellt.";
      else if (j.matchAction === "existing") extrasMsg = " Du hattest bereits ein offenes Match.";
      else if (j.matchAction === "error") extrasMsg = ` Match-Zuordnung fehlgeschlagen: ${j.matchError || "unbekannter Fehler"}.`;
      setJoinMsg(`${baseMsg}${extrasMsg}`.trim());

      if (j.match && j.match.id) {
        setGames(prev => {
          const prevUpcoming = Array.isArray(prev?.upcoming) ? prev.upcoming : [];
          const deduped = prevUpcoming.filter(m => String(m.id) !== String(j.match.id));
          return {
            ...prev,
            upcoming: [...deduped, j.match]
          };
        });
      }

      let extrasReloaded = false;
      const shouldTriggerSearch = j.joined && (!j.match || !j.match.id);

      if (j && j.joined) setIsMemberByMe(true);

      if (j && j.joined && j.match && j.match.id) {
        await fetchMyOpenMatch();
        await fetchMyWeeklyStatus();
        await reloadExtras();
        extrasReloaded = true;
      }

      if (shouldTriggerSearch) {
        try {
          const result = await runMatchSearch({ auto: true });
          if (result && result.action) {
            let autoMsg = "";
            if (result.action === "joined") autoMsg = " Automatische Matchsuche: Du wurdest einem offenen Match hinzugefügt.";
            else if (result.action === "created") autoMsg = " Automatische Matchsuche: Offenes Match erstellt.";
            else if (result.action === "paired") autoMsg = " Automatische Matchsuche: Gegner gefunden.";
            else if (result.action === "skipped") autoMsg = " Automatische Matchsuche: Bereits ein offenes Match vorhanden.";
            if (autoMsg) setJoinMsg(prev => `${prev}${autoMsg}`.trim());
          }
          extrasReloaded = true;
        } catch (autoErr) {
          const msg = autoErr?.message || String(autoErr);
          if (!/429|Weekly match limit/i.test(msg)) {
            setJoinMsg(prev => `${prev} (Matchsuche: ${msg})`.trim());
          }
        }
      }

      if (!extrasReloaded) {
        await reloadExtras();
        if (j && j.joined) {
          await fetchMyOpenMatch();
          await fetchMyWeeklyStatus();
        }
      }
    } catch (e) {
      setJoinMsg(`Beitritt fehlgeschlagen: ${e.message || e}`);
      alert(`Beitritt fehlgeschlagen: ${e.message || e}`);
    } finally {
      setJoining(false);
    }
  }

  async function handleLeave() {
    try {
      setJoining(true);
      const token = localStorage.getItem("token");
      const r = await fetchWithTimeout(`${API_BASE}/leagues/${leagueId}/leave`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        timeout: 8000
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j?.error || `HTTP ${r.status}`);
      setJoinMsg(j.left ? "Ausgetreten" : (j.message || "Nicht Mitglied"));
      await reloadExtras();
      // Update membership flag so UI toggles the buttons correctly
      if (j && j.left) setIsMemberByMe(false);
    } catch (e) {
      setJoinMsg(`Austritt fehlgeschlagen: ${e.message || e}`);
      alert(`Austritt fehlgeschlagen: ${e.message || e}`);
    } finally {
      setJoining(false);
    }
  }

  function formatKickoff(match) {
    if (!match) return "Noch kein Termin";
    const raw = match.kickoff_at || match.kickoffAt || match.date || match.scheduled_at || match.scheduledAt;
    if (!raw || (typeof raw === "string" && raw.trim() === "")) return "Noch kein Termin";
    const dt = new Date(raw);
    if (Number.isNaN(dt.getTime())) return "Noch kein Termin";
    return dt.toLocaleString('de-DE');
  }

  // Helpers for user IDs and display
  function toNumericId(v) {
    if (v == null) return null;
    const m = String(v).match(/\d+/);
    return m ? m[0] : null;
  }
  function initialsFor(name) {
    const s = String(name || "").trim();
    if (!s) return "?";
    const p = s.split(/\s+/);
    const a = (p[0]?.[0] || "").toUpperCase();
    const b = (p[1]?.[0] || "").toUpperCase();
    return (a + b) || a || "?";
  }

  // Fast lookup of member meta by numeric user id
  const memberById = useMemo(() => {
    const map = new Map();
    (members || []).forEach(m => {
      const uid = toNumericId(getMemberUserId(m));
      if (uid) map.set(String(uid), m);
    });
    return map;
  }, [members]);

  // Build last-5 form (W/U/N) for each user from completed games
  const formByUserId = useMemo(() => {
    const map = new Map();
    const completed = Array.isArray(games?.completed) ? [...games.completed] : [];
    completed.sort((a, b) => {
      const da = new Date(a.kickoff_at || a.kickoffAt || a.date || 0).getTime();
      const db = new Date(b.kickoff_at || b.kickoffAt || b.date || 0).getTime();
      return db - da; // newest first
    });
    const toId = (g, side) => toNumericId(g?.[`${side}_id`] ?? g?.[`${side}Id`] ?? g?.[side]);
    const gScore = (g, k) => g?.[k] ?? g?.[k.replace(/_/, "")] ?? null; // home_score -> homeScore
    completed.forEach(g => {
      const hId = toId(g, 'home');
      const aId = toId(g, 'away');
      const hs = gScore(g, 'home_score');
      const as = gScore(g, 'away_score');
      if (hId && aId && hs != null && as != null) {
        let hRes = 'U', aRes = 'U';
        if (Number(hs) > Number(as)) { hRes = 'W'; aRes = 'N'; }
        else if (Number(hs) < Number(as)) { hRes = 'N'; aRes = 'W'; }
        if (!map.has(hId)) map.set(hId, []);
        if (!map.has(aId)) map.set(aId, []);
        map.get(hId).push(hRes);
        map.get(aId).push(aRes);
      }
    });
    // keep only last 5
    for (const [k, arr] of map.entries()) map.set(k, arr.slice(0, 5));
    return map;
  }, [games?.completed]);
  async function createMatch(e) {
    e && e.preventDefault();
    try {
      if (!opponentId) throw new Error("Bitte einen Gegner wählen.");
      if (!kickoffLocal) throw new Error("Bitte Datum/Zeit wählen.");
      const token = localStorage.getItem("token");
      const iso = new Date(kickoffLocal).toISOString();
      const r = await fetch(`${API_BASE}/leagues/${leagueId}/matches`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ opponent_user_id: Number(opponentId), kickoff_at: iso }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j?.error || `HTTP ${r.status}`);
      // optional: Reload Extras oder navigieren
      await reloadExtras();
      setOpponentId("");
      setKickoffLocal("");
      // Wenn ID geliefert wird, navigieren
      if (j && j.id) navigate(`/matches/${j.id}`);
    } catch (e) {
      alert(`Match erstellen fehlgeschlagen: ${e.message || e}`);
    }
  }

  if (loading) return <div style={{ padding: 16 }}>Lade Liga ...</div>;
  if (err) return <div style={{ padding: 16, color: "crimson" }}>Fehler: {err}</div>;
  if (!league) return <div style={{ padding: 16 }}>Keine Daten.</div>;

  // Styles
  const wrap = { padding: 16, color: '#e8efe8', fontFamily: 'Inter, system-ui, sans-serif' };
  const card = { background: '#0f2a20', borderRadius: 16, boxShadow: '0 14px 36px rgba(0,0,0,0.5)' };
  const pad = { padding: 16 };
  const pill = { display: 'inline-block', padding: '6px 12px', borderRadius: 999, border: '1px solid #2f6b57', background: '#0e2a22', color: '#dfe' };
  const small = { fontSize: 12, color: '#a6bfb3' };

  return (
    <div style={wrap}>
      {/* Hero */}
      <div style={{ ...card, paddingBottom: 0 }}>
        <div style={{ ...pad }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ fontSize: 26 }}>🏆</div>
            <div style={{ fontSize: 28, fontWeight: 900 }}>{league.name}</div>
          </div>
          <div style={{ marginTop: 4, ...small }}>
            <Link to={`/cities/${league.cityId}`} style={{ color: '#cfe' }}>{league.city}</Link>
            {" · "}
            <Link to={`/sports/${league.sportId}`} style={{ color: '#cfe' }}>{league.sport}</Link>
          </div>
          <div style={{ marginTop: 10, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            {canAttemptJoin && (
              <button onClick={handleJoin} disabled={!token || joining} style={pill}>
                {joining ? "Beitritt..." : "Teilnehmen"}
              </button>
            )}
            {amMember && (
              <button onClick={handleLeave} disabled={!token || joining} style={pill}>
                {joining ? "Austritt..." : "Austreten"}
              </button>
            )}
            {joinMsg && <span style={{ color: joinMsg.includes("fehl") ? "crimson" : "#9fd" }}>{joinMsg}</span>}
          </div>
        </div>
        {/* quick stats */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, padding: 16 }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 26, fontWeight: 900 }}>{(standingsWithMembers || []).reduce((a,b)=>a + (b.played||0),0)}</div>
            <div style={{ color: '#bcd' }}>Spiele</div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 26, fontWeight: 900 }}>{(games.completed||[]).reduce((a,b)=>a + ((b.home_score||0)+(b.away_score||0)),0)}</div>
            <div style={{ color: '#bcd' }}>Tore</div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 26, fontWeight: 900 }}>{members.length}</div>
            <div style={{ color: '#bcd' }}>Mitglieder</div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 26, fontWeight: 900 }}>{(games.upcoming||[]).length}</div>
            <div style={{ color: '#bcd' }}>Anstehend</div>
          </div>
        </div>
      </div>

      {amMember && !myOpenMatch && !hasWeeklyMatch && (
        <div style={{ ...card, marginTop: 12 }}>
          <div style={{ ...pad, paddingBottom: 0 }}>
            <div style={{ fontSize: 18, fontWeight: 700 }}>Neues Match starten</div>
            <div style={{ marginTop: 6, color: '#9db' }}>
              Wähle einen Gegner und den Kickoff – wir legen das Match direkt an.
            </div>
          </div>
          <form onSubmit={createMatch} style={{ ...pad, display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }}>
            <label style={{ display: 'grid', gap: 6 }}>
              Gegner
              <select value={opponentId} onChange={(e) => setOpponentId(e.target.value)}>
                <option value="">– wählen –</option>
                {opponents.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
              </select>
            </label>
            <label style={{ display: 'grid', gap: 6 }}>
              Datum &amp; Uhrzeit
              <input type="datetime-local" value={kickoffLocal} onChange={(e) => setKickoffLocal(e.target.value)} />
            </label>
            <div style={{ display: 'flex', alignItems: 'flex-end' }}>
              <button type="submit" disabled={hasWeeklyMatch || !!myOpenMatch} style={{ ...pill, width: '100%', justifyContent: 'center' }}>Match erstellen</button>
            </div>
          </form>
        </div>
      )}

      {amMember && (myOpenMatch || hasWeeklyMatch) && (
        <div style={{ marginTop: 8, color: '#ccc' }}>
          Du kannst nur ein offenes Match gleichzeitig haben und nur ein Match pro Woche spielen.
        </div>
      )}

      {/* Match suchen (join-or-create) */}
      {amMember && !myOpenMatch && !hasWeeklyMatch && (
        <div style={{ marginTop: 12 }}>
          <button
            onClick={async () => {
              try {
                setMatchSearching(true);
                const result = await runMatchSearch({ auto: false });
                if (result?.action === 'joined') alert('Match gefunden und beigetreten');
                else if (result?.action === 'created') alert('Offenes Match erstellt');
                else if (result?.action === 'paired') alert('Gegner ohne Wochen-Spiel gefunden. Vorschlag erstellt.');
                else if (result?.action === 'skipped') alert('Du hast bereits ein offenes Match.');
              } catch (e) {
                alert(`Match-Suche fehlgeschlagen: ${e.message || e}`);
              } finally {
                setMatchSearching(false);
              }
            }}
            disabled={!token || matchSearching}
          >
            {matchSearching ? 'Suchen...' : 'Match suchen'}
          </button>
        </div>
      )}

      {amMember && myOpenMatch && (
        <div style={{ marginTop: 12 }}>
          Du hast bereits ein offenes Match.{' '}
          <Link to={`/matches/${myOpenMatch.id}`}>Zum Match</Link>
        </div>
      )}

      {amMember && !myOpenMatch && hasWeeklyMatch && (
        <div style={{ marginTop: 12 }}>
          Du hattest diese Woche bereits ein Spiel. Die Matchsuche ist nächste Woche wieder verfügbar.
        </div>
      )}

      {loadingExtras ? (
        <div style={{ ...card, ...pad, marginTop: 16 }}>Lade zusätzliche Daten...</div>
      ) : (
        <>
          {/* Mitglieder */}
          <div style={{ ...card, marginTop: 16 }}>
            <div style={{ ...pad, paddingBottom: 8 }}>
              <div style={{ fontSize: 18, fontWeight: 700 }}>Tabelle</div>
              <div style={{ marginTop: 8 }}>
                <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                  Saison:
                  <select value={selectedSeasonId} onChange={(e) => setSelectedSeasonId(e.target.value)}>
                    <option value="current">Aktuelle Saison</option>
                    {seasons.map(se => <option key={se.id} value={se.id}>{se.name}</option>)}
                    <option value="overall">Overall</option>
                  </select>
                </label>
              </div>
            </div>
            <div style={{ ...pad, paddingTop: 8 }}>
              {standingsWithMembers.length === 0 ? (
                <div style={small}>Keine Einträge.</div>
              ) : (
                <div style={{ overflowX: 'auto' }}>
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
                      {standingsWithMembers.map((row, idx) => (
                        <tr key={row._uid || idx} style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                          <td style={{ padding: '8px 6px' }}>{row.rank ?? (idx + 1)}</td>
                          <td style={{ padding: '8px 6px' }}>
                            {(() => {
                              const uid = toNumericId(row._uid);
                              const m = uid ? memberById.get(String(uid)) : null;
                              const avatarUrl = m?.avatar || m?.avatarUrl || m?.image || m?.imageUrl || m?.profile_image || m?.profileImage || null;
                              const display = row.name || row.key || `User ${uid || ''}`;
                              const avatar = (
                                <span style={{ marginRight: 8, verticalAlign: 'middle', display: 'inline-flex' }}>
                                  <Avatar userId={uid} name={display} src={avatarUrl} size={28} />
                                </span>
                              );
                              return uid ? (
                                <span style={{ display: 'inline-flex', alignItems: 'center' }}>
                                  {avatar}
                                  <Link to={`/user/${uid}`} style={{ color: '#cfe', textDecoration: 'none' }} title="Profil öffnen">
                                    {display}
                                  </Link>
                                  <span aria-hidden style={{ marginLeft: 6, opacity: 0.7 }}>↗︎</span>
                                </span>
                              ) : (
                                <span style={{ display: 'inline-flex', alignItems: 'center' }}>
                                  {avatar}
                                  {display}
                                </span>
                              );
                            })()}
                          </td>
                          <td style={{ padding: '8px 6px' }}>{row.played ?? 0}</td>
                          <td style={{ padding: '8px 6px' }}>{row.won ?? 0}</td>
                          <td style={{ padding: '8px 6px' }}>{row.drawn ?? 0}</td>
                          <td style={{ padding: '8px 6px' }}>{row.lost ?? 0}</td>
                          <td style={{ padding: '8px 6px' }}>{(row.gf ?? 0)}:{(row.ga ?? 0)}</td>
                          <td style={{ padding: '8px 6px' }}>{(row.gd ?? ((row.gf||0) - (row.ga||0)))}</td>
                          <td style={{ padding: '8px 6px' }}>{row.points ?? 0}</td>
                          <td style={{ padding: '8px 6px', whiteSpace: 'nowrap' }}>
                            {(() => {
                              const uid = toNumericId(row._uid);
                              const form = (uid && formByUserId.get(String(uid))) || [];
                              const color = (r) => (r === 'W' ? '#29e0ad' : r === 'N' ? '#ff6b6b' : '#c4d0ca');
                              return (
                                <span>
                                  {form.map((r, i) => (
                                    <span key={i} style={{ color: color(r), fontWeight: 700, display: 'inline-block', marginRight: 6 }}>{r}</span>
                                  ))}
                                </span>
                              );
                            })()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>

          {/* Spiele */}
          <div style={{ display: 'grid', gap: 16, gridTemplateColumns: '1fr', marginTop: 16 }}>
            <div style={{ ...card }}>
              <div style={{ ...pad, paddingBottom: 8 }}>
                <div style={{ fontSize: 18, fontWeight: 700 }}>Anstehende Spiele</div>
              </div>
              <div style={{ ...pad, paddingTop: 8 }}>
                {games.upcoming.length === 0 ? (
                  <div style={small}>Keine kommenden Spiele.</div>
                ) : (
                  <div style={{ display: 'grid', gap: 10 }}>
                    {games.upcoming.map(g => (
                      <div key={g.id} style={{ background: '#0b1e19', borderRadius: 12, padding: 12, display: 'grid', gridTemplateColumns: '1fr auto 1fr auto', alignItems: 'center', gap: 10 }}>
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontWeight: 600 }}>{formatKickoff(g)}</div>
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
                      <div key={g.id} style={{ background: '#0b1e19', borderRadius: 12, padding: 12, display: 'grid', gridTemplateColumns: '1fr auto 1fr auto', alignItems: 'center', gap: 10 }}>
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontWeight: 600 }}>{formatKickoff(g)}</div>
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

        </>
      )}

      <div style={{ marginTop: 12 }}>
        <Link to="/leagues">← Zurück zur Übersicht</Link>
      </div>
    </div>
  );
}
