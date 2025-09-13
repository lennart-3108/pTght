import React, { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";

export default function GameDetailPage() {
  const { gameId } = useParams();
  const [g, setG] = useState(null);
  const [err, setErr] = useState("");

  useEffect(() => {
    let mounted = true;
    setErr("");
    fetch(`http://localhost:5001/games/${gameId}`)
      .then(r => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then(j => mounted && setG(j))
      .catch(e => mounted && setErr(e.message || "Fehler"));
    return () => { mounted = false; };
  }, [gameId]);

  if (err) return <div style={{ padding: 16, color: "crimson" }}>Fehler: {err}</div>;
  if (!g) return <div style={{ padding: 16 }}>Lade Spiel ...</div>;

  return (
    <div style={{ padding: 16 }}>
      <h2>Spiel</h2>
      <div><b>Datum:</b> {new Date(g.kickoff_at).toLocaleString()}</div>
      <div><b>Partie:</b> {g.home} – {g.away}</div>
      {(g.home_score != null && g.away_score != null) && (
        <div><b>Ergebnis:</b> {g.home_score}:{g.away_score}</div>
      )}
      <div style={{ marginTop: 8 }}>
        <b>Liga:</b> <Link to={`/league/${g.leagueId}`}>{g.league}</Link>
      </div>
      <div style={{ marginTop: 12 }}>
        <Link to={-1}>← Zurück</Link>
      </div>
    </div>
  );
}
