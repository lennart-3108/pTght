import React, { useEffect, useState, useMemo } from "react";
import { Link, useParams } from "react-router-dom";

export default function LeagueDetailPage() {
  const { leagueId } = useParams();
  const [league, setLeague] = useState(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [joinMsg, setJoinMsg] = useState("");
  const [members, setMembers] = useState([]);
  const [standings, setStandings] = useState([]);
  const [games, setGames] = useState({ upcoming: [], completed: [] });
  const [loadingExtras, setLoadingExtras] = useState(true);
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

  const amMember = useMemo(
    () => members.some(m => String(m.user_id ?? m.id) === String(myId)),
    [members, myId]
  );

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    setErr("");
    fetch(`http://localhost:5001/leagues/${leagueId}`)
      .then(r => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then(j => mounted && setLeague(j))
      .catch(e => mounted && setErr(e.message || "Fehler"))
      .finally(() => mounted && setLoading(false));
    return () => { mounted = false; };
  }, [leagueId]);

  useEffect(() => {
    let mounted = true;
    setLoadingExtras(true);
    Promise.all([
      fetch(`http://localhost:5001/leagues/${leagueId}/members`, { headers: { Authorization: `Bearer ${token}` } })
        .then(r => (r.ok ? r.json() : []))
        .catch(() => []),
      fetch(`http://localhost:5001/leagues/${leagueId}/standings`)
        .then(r => (r.ok ? r.json() : []))
        .catch(() => []),
      fetch(`http://localhost:5001/leagues/${leagueId}/games`)
        .then(r => (r.ok ? r.json() : { upcoming: [], completed: [] }))
        .catch(() => ({ upcoming: [], completed: [] }))
    ])
      .then(([m, s, g]) => {
        if (!mounted) return;
        setMembers(Array.isArray(m) ? m : []);
        setStandings(Array.isArray(s) ? s : []);
        setGames({ upcoming: g.upcoming || [], completed: g.completed || [] });
      })
      .finally(() => mounted && setLoadingExtras(false));
    return () => { mounted = false; };
  }, [leagueId, token]);

  async function joinLeague() {
    setJoinMsg("");
    try {
      const token = localStorage.getItem("token");
      const r = await fetch(`http://localhost:5001/leagues/${leagueId}/join`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` }
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j?.error || `HTTP ${r.status}`);
      setJoinMsg(j.joined ? "Beitritt erfolgreich." : "Bereits Mitglied.");
      // nach Beitritt Mitglieder neu laden
      try {
        const mRes = await fetch(`http://localhost:5001/leagues/${leagueId}/members`, { headers: { Authorization: `Bearer ${token}` } });
        const m = mRes.ok ? await mRes.json() : [];
        setMembers(Array.isArray(m) ? m : []);
      } catch {}
    } catch (e) {
      setJoinMsg(`Beitritt fehlgeschlagen: ${e.message || e}`);
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
        {!amMember && <button onClick={joinLeague}>Beitreten</button>}
        {joinMsg && <span style={{ color: joinMsg.includes("fehl") ? "crimson" : "green" }}>{joinMsg}</span>}
      </div>

      {/* Teilnehmer */}
      <h3 style={{ marginTop: 16 }}>Teilnehmer</h3>
      {loadingExtras ? (
        <div>Lade Teilnehmer ...</div>
      ) : members.length === 0 ? (
        <div>Noch keine Teilnehmer.</div>
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
              const memberUserId = m.user_id ?? m.id;
              return (
                <tr key={m.id}>
                  <td>
                    <Link to={`/user/${memberUserId}`}>{m.firstname} {m.lastname}</Link>
                  </td>
                  <td>{m.joined_at ? new Date(m.joined_at).toLocaleString() : "-"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}

      {/* Tabelle (Standings) */}
      <h3 style={{ marginTop: 16 }}>Tabelle</h3>
      {loadingExtras ? (
        <div>Lade Tabelle ...</div>
      ) : standings.length === 0 ? (
        <div>Noch keine Ergebnisse.</div>
      ) : (
        <table border="1" cellPadding="6" style={{ borderCollapse: "collapse", width: "100%" }}>
          <thead>
            <tr>
              <th>#</th>
              <th>Mannschaft</th>
              <th>Sp</th>
              <th>S</th>
              <th>U</th>
              <th>N</th>
              <th>Tore</th>
              <th>Diff</th>
              <th>Pkt</th>
            </tr>
          </thead>
          <tbody>
            {standings.map((r, idx) => (
              <tr key={r.team}>
                <td>{idx + 1}</td>
                <td>{r.team}</td>
                <td>{r.played}</td>
                <td>{r.wins}</td>
                <td>{r.draws}</td>
                <td>{r.losses}</td>
                <td>{r.gf}:{r.ga}</td>
                <td>{r.gd}</td>
                <td>{r.pts}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {/* Kommende Spiele */}
      <h3 style={{ marginTop: 16 }}>Kommende Spiele</h3>
      {loadingExtras ? (
        <div>Lade Spiele ...</div>
      ) : games.upcoming.length === 0 ? (
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
                <td>
                  <Link to={`/game/${g.id}`}>{new Date(g.kickoff_at).toLocaleString()}</Link>
                </td>
                <td>{g.home} – {g.away}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {/* Abgeschlossene Spiele */}
      <h3 style={{ marginTop: 16 }}>Abgeschlossene Spiele</h3>
      {loadingExtras ? (
        <div>Lade Spiele ...</div>
      ) : games.completed.length === 0 ? (
        <div>Keine abgeschlossenen Spiele.</div>
      ) : (
        <table border="1" cellPadding="6" style={{ borderCollapse: "collapse", width: "100%" }}>
          <thead>
            <tr>
              <th>Datum</th>
              <th>Ergebnis</th>
            </tr>
          </thead>
          <tbody>
            {games.completed.map(g => (
              <tr key={g.id}>
                <td>
                  <Link to={`/game/${g.id}`}>{new Date(g.kickoff_at).toLocaleString()}</Link>
                </td>
                <td>
                  {g.home} – {g.away}
                  {(g.home_score != null && g.away_score != null) && ` (${g.home_score}:${g.away_score})`}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <div style={{ marginTop: 12 }}>
        <Link to="/leagues">← Zurück zur Übersicht</Link>
      </div>
    </div>
  );
}
