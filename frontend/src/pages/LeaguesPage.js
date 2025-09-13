import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";

export default function LeaguesPage() {
  const [leagues, setLeagues] = useState([]);
  const [myLeagues, setMyLeagues] = useState([]);

  async function joinLeague(leagueId, leagueName) {
    try {
      const token = localStorage.getItem("token");
      const r = await fetch(`http://localhost:5001/leagues/${leagueId}/join`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` }
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j?.error || `HTTP ${r.status}`);
      alert(j.joined ? `Beigetreten: ${leagueName}` : `Bereits Mitglied: ${leagueName}`);
    } catch (e) {
      alert(`Beitritt fehlgeschlagen: ${e.message || e}`);
    }
  }

  useEffect(() => {
    fetch("http://localhost:5001/leagues", {
      headers: { Authorization: "Bearer " + localStorage.getItem("token") }
    })
      .then(res => res.json())
      .then(data => setLeagues(Array.isArray(data) ? data : []))
      .catch(() => setLeagues([]));

    fetch("http://localhost:5001/me/leagues", {
      headers: { Authorization: "Bearer " + localStorage.getItem("token") }
    })
      .then(res => res.json())
      .then(data => setMyLeagues(Array.isArray(data) ? data : []))
      .catch(() => setMyLeagues([]));
  }, []);

  return (
    <div style={{ padding: 40 }}>
      <h2>Alle Ligen</h2>
      <ul>
        {leagues.map(l => (
          <li key={l.id}>
            <b><Link to={`/league/${l.id}`}>{l.name}</Link></b> ({l.city}) [{l.sport}]
          </li>
        ))}
      </ul>

      <hr />

      <h2>Meine Ligen</h2>
      <ul>
        {myLeagues.length === 0 ? (
          <i>Noch nicht angemeldet.</i>
        ) : (
          myLeagues.map(l => (
            <li key={l.id}>
              <b><Link to={`/league/${l.id}`}>{l.name}</Link></b> ({l.city}) [{l.sport}]
            </li>
          ))
        )}
      </ul>

      <h2>Ligen nach Städten</h2>
      {leagues.length === 0 ? (
        <p>Keine Ligen gefunden.</p>
      ) : (
        <table border="1" cellPadding="6" style={{ borderCollapse: "collapse", width: "100%" }}>
          <thead>
            <tr>
              <th>Stadt</th>
              <th>Sportart</th>
              <th>Liganame</th>
              <th>Aktion</th>
            </tr>
          </thead>
          <tbody>
            {leagues.map((league) => (
              <tr key={league.id}>
                <td>
                  <Link to={`/cities/${league.cityId}`}>{league.city}</Link>
                </td>
                <td>
                  <Link to={`/sports/${league.sportId}`}>{league.sport}</Link>
                </td>
                <td>
                  <Link to={`/league/${league.id}`}>{league.name}</Link>
                </td>
                <td>
                  <button onClick={() => joinLeague(league.id, league.name)}>Beitreten</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
