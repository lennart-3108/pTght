import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { API_BASE } from "../config";

export default function ProfilePage() {
  const [data, setData] = useState(null);
  const [leagues, setLeagues] = useState([]);
  const [games, setGames] = useState({ upcoming: [], completed: [] });
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(true);

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

  if (loading) return <div style={{ padding: 16 }}>Lade Profil ...</div>;
  if (err) return <div style={{ padding: 16, color: "crimson" }}>Fehler: {err}</div>;
  if (!data) return <div style={{ padding: 16 }}>Keine Daten.</div>;

  return (
    <div style={{ padding: 16 }}>
      <h2>Profil</h2>
      <div><b>Name:</b> {data.firstname} {data.lastname}</div>
      <div><b>E-Mail:</b> {data.email}</div>

      <h3 style={{ marginTop: 16 }}>Meine Ligen</h3>
      {leagues.length === 0 ? (
        <div>Keine Ligen.</div>
      ) : (
        <ul>
          {leagues.map(l => (
            <li key={l.id}>
              <Link to={`/league/${l.id}`}>{l.name}</Link> – <Link to={`/cities/${l.cityId}`}>{l.city}</Link>
            </li>
          ))}
        </ul>
      )}

      <h3 style={{ marginTop: 16 }}>Kommende Spiele</h3>
      {games.upcoming.length === 0 ? (
        <div>Keine kommenden Spiele.</div>
      ) : (
        <table border="1" cellPadding="6" style={{ borderCollapse: "collapse", width: "100%" }}>
          <thead>
            <tr>
              <th>Datum</th>
              <th>Liga</th>
              <th>Spiel</th>
            </tr>
          </thead>
          <tbody>
            {games.upcoming.map(g => (
              <tr key={g.id}>
                <td>{new Date(g.kickoff_at).toLocaleString()}</td>
                <td><Link to={`/league/${g.leagueId}`}>{g.league}</Link></td>
                <td><Link to={`/game/${g.id}`}>{g.home} – {g.away}</Link></td>
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
              <th>Liga</th>
              <th>Ergebnis</th>
            </tr>
          </thead>
          <tbody>
            {games.completed.map(g => (
              <tr key={g.id}>
                <td>{new Date(g.kickoff_at).toLocaleString()}</td>
                <td><Link to={`/league/${g.leagueId}`}>{g.league}</Link></td>
                <td><Link to={`/game/${g.id}`}>{g.home} {g.home_score}:{g.away_score} {g.away}</Link></td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

