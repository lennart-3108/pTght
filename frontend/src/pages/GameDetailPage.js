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

  if (loading) return <div style={{ padding: 16 }}>Lade Spiel ...</div>;
  if (err) return <div style={{ padding: 16, color: "crimson" }}>Fehler: {err}</div>;
  if (!game) return <div style={{ padding: 16 }}>Kein Spiel gefunden.</div>;

  return (
    <div style={{ padding: 16 }}>
      <h2>Spiel-Details</h2>
      <div>
        <b>Datum:</b> {formatDate(game.kickoff_at)}
      </div>
      <div>
        <b>Liga:</b>{" "}
        {game.leagueId ? (
          <Link to={`/league/${game.leagueId}`}>{game.league || game.leagueId}</Link>
        ) : (
          game.league || "-"
        )}
      </div>
      <div>
        <b>Spiel:</b> {game.home} – {game.away}
      </div>
      <div>
        <b>Ergebnis:</b>{" "}
        {game.home_score != null && game.away_score != null
          ? `${game.home_score}:${game.away_score}`
          : "-"}
      </div>
      <div style={{ marginTop: 16 }}>
        <Link to={`/league/${game.leagueId || ""}`}>Zurück zur Liga</Link>
      </div>
      <div style={{ marginTop: 12 }}>
        <Link to={`/matches/${game.id}`}>Match-Detail (permalink)</Link>
      </div>
    </div>
  );
}
