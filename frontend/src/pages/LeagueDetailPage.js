import React, { useEffect, useState, useMemo } from "react";
import { Link, useParams, useNavigate } from "react-router-dom";
import { API_BASE } from "../config";

export default function LeagueDetailPage() {
  const { leagueId } = useParams();
  const navigate = useNavigate();
  const [league, setLeague] = useState(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [joinMsg, setJoinMsg] = useState("");
  const [members, setMembers] = useState([]);
  const [standings, setStandings] = useState([]);
  const [games, setGames] = useState({ upcoming: [], completed: [] });
  const [loadingExtras, setLoadingExtras] = useState(true);
  const [joining, setJoining] = useState(false);
  const [isMemberByMe, setIsMemberByMe] = useState(null); // null = unknown, true/false = known
  const [myOpenMatch, setMyOpenMatch] = useState(null);
  const [matchSearching, setMatchSearching] = useState(false);
  // Match-Formular
  const [opponentId, setOpponentId] = useState("");
  const [kickoffLocal, setKickoffLocal] = useState("");

  const token = localStorage.getItem("token");

  const myId = useMemo(() => {
    if (!token) return null;
    try {
      const payload = JSON.parse(atob(token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/")));
      return payload?.id ?? null;
    } catch {
      return null;
    }
  }, [token]);

  // helper to derive a user id from various API shapes
  function getMemberUserId(m) {
    const userId = (
      m.user_id ??
      m.userId ??
      m.uid ??
      (m.user && m.user.id) ??
      // if member row looks like a user (has firstname/lastname), m.id is likely the user id
      ((m.firstname || m.lastname) ? m.id : undefined) ??
      m.id
    );
    console.log("getMemberUserId:", userId, "from member:", m); // Debug log
    return userId;
  }

  const amMember = useMemo(() => {
    // Prefer /me/leagues result when available (more reliable)
    if (isMemberByMe !== null) return !!isMemberByMe;
    // Überprüfe, ob der Benutzer in der Mitgliederliste enthalten ist
    const isMember = myId ? members.some(m => {
      const memberId = String(getMemberUserId(m));
      console.log("Überprüfe Mitglied:", memberId, "gegen", myId);
      return memberId === String(myId);
    }) : false;

    console.log("Debugging amMember:");
    console.log("myId:", myId);
    console.log("members:", members);
    console.log("isMember:", isMember);

    return isMember;
  }, [members, myId, isMemberByMe]);

  const isOpenLeague = useMemo(() => {
    const l = league || {};
    // explicit boolean-ish flags
    const openFlags = [l.is_open, l.isOpen, l.open];
    for (const f of openFlags) {
      if (f === true || f === 1 || f === "1") return true;
      if (f === false || f === 0 || f === "0") return false;
    }
    const privFlags = [l.is_private, l.isPrivate, l.private];
    for (const f of privFlags) {
      if (f === true || f === 1 || f === "1") return false;
      if (f === false || f === 0 || f === "0") return true;
    }
    // textual fields
    const txt = (l.type || l.privacy || l.access || l.visibility || "").toString().toLowerCase();
    if (txt.includes("priv")) return false; // private
    if (txt.includes("closed") || txt.includes("invite")) return false;
    if (txt.includes("open") || txt.includes("offen") || txt.includes("öffentlich") || txt.includes("public")) return true;
    // default: treat as open if unknown
    return true;
  }, [league]);

  const isPublicLeague = useMemo(() => {
    const isPublic = league?.publicState === "public";
    console.log("Debugging isPublicLeague:");
    console.log("league:", league); // Logge die gesamten Liga-Daten
    console.log("publicState:", league?.publicState);
    console.log("isPublicLeague:", isPublic);
    return isPublic;
  }, [league]);

  const isOwner = useMemo(() => {
    return String(league?.ownerId) === String(myId);
  }, [league, myId]);

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

  function formatScore(g) {
    if (g?.score != null && g.score !== "") return g.score;
    if (g?.home_score != null && g?.away_score != null) return `${g.home_score}:${g.away_score}`;
    if (g?.result) return g.result;
    return "-";
  }

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

  async function reloadExtras() {
    setLoadingExtras(true);
    try {
      const [m, s, g] = await Promise.all([
        fetch(`${API_BASE}/leagues/${leagueId}/members`, { headers: { Authorization: `Bearer ${token}` } })
          .then(r => (r.ok ? r.json() : []))
          .catch(() => []),
        fetch(`${API_BASE}/leagues/${leagueId}/standings`)
          .then(r => (r.ok ? r.json() : []))
          .catch(() => []),
        fetch(`${API_BASE}/leagues/${leagueId}/games`)
          .then(r => (r.ok ? r.json() : { upcoming: [], completed: [] }))
          .catch(() => ({ upcoming: [], completed: [] }))
      ]);
      setMembers(Array.isArray(m) ? m : []);
      setStandings(Array.isArray(s) ? s : []);
      setGames({ upcoming: g.upcoming || [], completed: g.completed || [] });
    } finally {
      setLoadingExtras(false);
    }
  }

  useEffect(() => {
    // Lade Extras erst, wenn die Liga erfolgreich geladen wurde.
    if (league) reloadExtras();
  }, [league, token]); // <-- abhängig von 'league' statt nur leagueId

  useEffect(() => {
    // whenever league or membership changes, refresh my open match
    fetchMyOpenMatch();
  }, [leagueId, isMemberByMe]);

  async function handleJoin() {
    try {
      setJoining(true);
      const token = localStorage.getItem("token");
      const r = await fetch(`${API_BASE}/leagues/${leagueId}/join`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` }
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j?.error || `HTTP ${r.status}`);
      setJoinMsg(j.joined ? "Beigetreten" : (j.message || "Bereits Mitglied"));
      await reloadExtras();
      // Ensure membership flag used by amMember is updated immediately so the UI
      // can re-evaluate (otherwise isMemberByMe may still be false and override
      // the members list check, leaving the "Beitreten" button visible).
      if (j && j.joined) setIsMemberByMe(true);
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
      const r = await fetch(`${API_BASE}/leagues/${leagueId}/leave`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` }
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

  // Liste der möglichen Gegner aus den Mitgliedern (ohne mich)
  const opponents = useMemo(() => {
    return (members || [])
      .map((m) => {
        const uid = getMemberUserId(m);
        const name = (m.firstname && m.lastname)
          ? `${m.firstname} ${m.lastname}`
          : (m.name || m.username || `User ${uid}`);
        return { id: uid, name };
      })
      .filter((o) => String(o.id) !== String(myId));
  }, [members, myId]);

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

  return (
    <div style={{ padding: 16 }}>
      <h2>{league.name}</h2>
      <div style={{ marginBottom: 8 }}>
        Stadt: <Link to={`/cities/${league.cityId}`}>{league.city}</Link>
        {" · "}
        Sportart: <Link to={`/sports/${league.sportId}`}>{league.sport}</Link>
      </div>
      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        {!amMember && (isOpenLeague || isPublicLeague) && (
          <button onClick={handleJoin} disabled={!token || joining}>
            {joining ? "Beitritt..." : "Beitreten"}
          </button>
        )}
        {amMember && (
          <button onClick={handleLeave} disabled={!token || joining}>
            {joining ? "Austritt..." : "Austreten"}
          </button>
        )}
        {joinMsg && <span style={{ color: joinMsg.includes("fehl") ? "crimson" : "green" }}>{joinMsg}</span>}
      </div>

      {amMember && (
        <form onSubmit={createMatch} style={{ margin: "12px 0", display: "flex", gap: 12, alignItems: "end", flexWrap: "wrap" }}>
          <label style={{ display: "grid", gap: 4 }}>
            Gegner
            <select value={opponentId} onChange={(e) => setOpponentId(e.target.value)}>
              <option value="">– wählen –</option>
              {opponents.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
            </select>
          </label>
          <label style={{ display: "grid", gap: 4 }}>
            Datum/Zeit
            <input type="datetime-local" value={kickoffLocal} onChange={(e) => setKickoffLocal(e.target.value)} />
          </label>
          <button type="submit">Match erstellen</button>
        </form>
      )}

      {/* Match suchen (join-or-create) */}
      {amMember && (
        <div style={{ marginTop: 12 }}>
          <button
            onClick={async () => {
              try {
                setMatchSearching(true);
                setErr('');
                const t = localStorage.getItem('token');
                if (!t) throw new Error('Bitte einloggen');
                // captain-only rule: check membership row if captain flag present
                const memberRow = members.find(m => String(getMemberUserId(m)) === String(myId));
                if (league && (league.sportType === 'team' || league.sport_type === 'team')) {
                  // check memberRow.captain or user_leagues.captain via backend; fallback to memberRow.captain
                  if (!(memberRow && memberRow.captain)) {
                    alert('Nur Captains können für Team-Sportarten die Match-Suche starten.');
                    return;
                  }
                }
                const r = await fetch(`${API_BASE}/leagues/${leagueId}/match-search`, { method: 'POST', headers: { Authorization: `Bearer ${t}` } });
                const j = await r.json().catch(() => ({}));
                if (!r.ok) throw new Error(j.error || j.message || `HTTP ${r.status}`);
                if (j.action === 'joined') {
                  alert('Match gefunden und beigetreten');
                } else if (j.action === 'created') {
                  alert('Offenes Match erstellt');
                }
                await reloadExtras();
                await fetchMyOpenMatch();
              } catch (e) {
                alert(`Match-Suche fehlgeschlagen: ${e.message || e}`);
              } finally {
                setMatchSearching(false);
              }
            }}
            disabled={!token || !!myOpenMatch || matchSearching}
          >
            {matchSearching ? 'Suchen...' : (myOpenMatch ? 'Offenes Match vorhanden' : 'Match suchen')}
          </button>
        </div>
      )}

      {loadingExtras ? (
        <div>Lade zusätzliche Daten...</div>
      ) : (
        <>
          <h3 style={{ marginTop: 16 }}>Mitglieder</h3>
          {members.length === 0 ? (
            <div>Keine Mitglieder.</div>
          ) : (
            <table border="1" cellPadding="6" style={{ borderCollapse: "collapse", width: "100%" }}>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Beigetreten</th>
                </tr>
              </thead>
              <tbody>
                {members.map(m => {
                  const userId = getMemberUserId(m);
                  console.log("Mitglied in Tabelle:", m); // Debug log
                  const name = (m.firstname && m.lastname)
                    ? `${m.firstname} ${m.lastname}`
                    : (m.name || m.username || `User ${userId}`);
                  return (
                    <tr key={userId}>
                      <td><Link to={`/user/${userId}`}>{name}</Link></td>
                      <td>{formatDate(m.joined_at)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}

          <h3 style={{ marginTop: 16 }}>Bevorstehende Spiele</h3>
          {games.upcoming.length === 0 ? (
            <div>Keine kommenden Spiele.</div>
          ) : (
            <table border="1" cellPadding="6" style={{ borderCollapse: "collapse", width: "100%" }}>
              <thead>
                <tr>
                  <th>Datum</th>
                  <th>Spiel</th>
                </tr>
              </thead>
              <tbody>
                {games.upcoming.map(g => (
                  <tr key={g.id}>
                    <td><Link to={`/matches/${g.id}`}>{formatDate(g.kickoff_at || g.date)}</Link></td>
                    <td>{g.home} – {g.away}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          <h3 style={{ marginTop: 16 }}>Abgeschlossene Spiele</h3>
          {games.completed.length === 0 ? (
            <div>Keine abgeschlossenen Spiele.</div>
          ) : (
            <table border="1" cellPadding="6" style={{ borderCollapse: "collapse", width: "100%" }}>
              <thead>
                <tr>
                  <th>Datum</th>
                  <th>Spiel</th>
                  <th>Ergebnis</th>
                </tr>
              </thead>
              <tbody>
                {games.completed.map(g => (
                  <tr key={g.id}>
                    <td><Link to={`/matches/${g.id}`}>{formatDate(g.kickoff_at || g.date)}</Link></td>
                    <td>{g.home} – {g.away}</td>
                    <td>{formatScore(g)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </>
      )}

      <div style={{ marginTop: 12 }}>
        <Link to="/leagues">← Zurück zur Übersicht</Link>
      </div>
    </div>
  );
}
