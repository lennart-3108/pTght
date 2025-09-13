import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";

export default function ProfilePage() {
  const [me, setMe] = useState(null);
  const [leagues, setLeagues] = useState([]);
  const [games, setGames] = useState({ upcoming: [], completed: [] });
  const [err, setErr] = useState("");
  const token = localStorage.getItem("token");

  useEffect(() => {
    let mounted = true;
    setErr("");
    // Profil
    fetch("http://localhost:5001/me", { headers: { Authorization: `Bearer ${token}` } })
      .then(r => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then(j => mounted && setMe(j))
      .catch(e => mounted && setErr(e.message || "Fehler"));
    // Meine Ligen
    fetch("http://localhost:5001/me/leagues", { headers: { Authorization: `Bearer ${token}` } })
      .then(r => (r.ok ? r.json() : []))
      .then(j => mounted && setLeagues(Array.isArray(j) ? j : []))
      .catch(() => {});
    // Meine Spiele
    fetch("http://localhost:5001/me/games", { headers: { Authorization: `Bearer ${token}` } })
      .then(r => (r.ok ? r.json() : { upcoming: [], completed: [] }))
      .then(j => mounted && setGames({ upcoming: j.upcoming || [], completed: j.completed || [] }))
      .catch(() => {});
    return () => { mounted = false; };
  }, [token]);

  return (
    <div style={{ padding: 16 }}>
      <h2>Profil</h2>
      {err && (
        <div style={{ color: "crimson" }}>
          Fehler: {err}
          {(err.includes("401") || err.includes("403")) && (
            <span> – Bitte <Link to="/login">neu einloggen</Link>.</span>
          )}
        </div>
      )}
      {!me ? (
        <div>Lade Profil ...</div>
      ) : (
        <div style={{ marginBottom: 16 }}>
          <div><b>Name:</b> {me.firstname} {me.lastname}</div>
          <div><b>E-Mail:</b> {me.email}</div>
          <div><b>Rolle:</b> {me.is_admin ? "Admin" : "User"}</div>
        </div>
      )}

      <h3>Meine Ligen</h3>
      {leagues.length === 0 ? (
        <div>Keine Ligen beigetreten.</div>
      ) : (
        <table border="1" cellPadding="6" style={{ borderCollapse: "collapse", width: "100%" }}>
          <thead>
            <tr>
              <th>Stadt</th>
              <th>Sportart</th>
              <th>Liga</th>
              <th>Seit</th>
            </tr>
          </thead>
          <tbody>
            {leagues.map(l => (
              <tr key={l.id}>
                <td>{l.city}</td>
                <td>{l.sport}</td>
                <td><Link to={`/league/${l.id}`}>{l.name}</Link></td>
                <td>{l.joined_at ? new Date(l.joined_at).toLocaleString() : "-"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <h3 style={{ marginTop: 18 }}>Kommende Spiele</h3>
      {games.upcoming.length === 0 ? (
        <div>Keine kommenden Spiele.</div>
      ) : (
        <table border="1" cellPadding="6" style={{ borderCollapse: "collapse", width: "100%" }}>
          <thead>
            <tr>
              <th>Datum</th>
              <th>Stadt</th>
              <th>Sport</th>
              <th>Liga</th>
              <th>Spiel</th>
            </tr>
          </thead>
          <tbody>
            {games.upcoming.map(g => (
              <tr key={g.id}>
                <td>{new Date(g.kickoff_at).toLocaleString()}</td>
                <td>{g.city}</td>
                <td>{g.sport}</td>
                <td><Link to={`/league/${g.leagueId}`}>{g.league}</Link></td>
                <td>{g.home} – {g.away}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <h3 style={{ marginTop: 18 }}>Abgeschlossene Spiele</h3>
      {games.completed.length === 0 ? (
        <div>Keine abgeschlossenen Spiele.</div>
      ) : (
        <table border="1" cellPadding="6" style={{ borderCollapse: "collapse", width: "100%" }}>
          <thead>
            <tr>
              <th>Datum</th>
              <th>Stadt</th>
              <th>Sport</th>
              <th>Liga</th>
              <th>Ergebnis</th>
            </tr>
          </thead>
          <tbody>
            {games.completed.map(g => (
              <tr key={g.id}>
                <td>{new Date(g.kickoff_at).toLocaleString()}</td>
                <td>{g.city}</td>
                <td>{g.sport}</td>
                <td><Link to={`/league/${g.leagueId}`}>{g.league}</Link></td>
                <td>
                  {g.home} – {g.away}
                  {(g.home_score != null && g.away_score != null) && ` (${g.home_score}:${g.away_score})`}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

