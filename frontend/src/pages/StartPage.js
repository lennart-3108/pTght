import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";

export default function StartPage() {
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [upcoming, setUpcoming] = useState([]);

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    setErr("");
    const token = localStorage.getItem("token");
    fetch("http://localhost:5001/me/games", { headers: { Authorization: `Bearer ${token}` } })
      .then(async (r) => {
        const j = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(j?.error || `HTTP ${r.status}`);
        return j;
      })
      .then((j) => {
        if (!mounted) return;
        setUpcoming(Array.isArray(j.upcoming) ? j.upcoming : []);
      })
      .catch((e) => {
        if (!mounted) return;
        setErr(e.message || "Fehler");
      })
      .finally(() => mounted && setLoading(false));
    return () => { mounted = false; };
  }, []);

  if (loading) return <div style={{ padding: 16 }}>Lade kommende Spiele ...</div>;

  return (
    <div style={{ padding: 16 }}>
      <h2>Meine nächsten Spiele</h2>
      {err && (
        <div style={{ color: "crimson" }}>
          Fehler: {err}
          {(err.includes("401") || err.includes("403")) && (
            <span> – Bitte <Link to="/login">neu einloggen</Link>.</span>
          )}
        </div>
      )}
      {!err && (upcoming.length === 0 ? (
        <div>
          Keine kommenden Spiele.
          {" "}
          <Link to="/leagues">Ligen ansehen</Link>
        </div>
      ) : (
        <table border="1" cellPadding="6" style={{ borderCollapse: "collapse", width: "100%", marginTop: 8 }}>
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
            {upcoming.map(g => (
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
      ))}
    </div>
  );
}

