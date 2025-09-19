import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { API_BASE } from "../config";

export default function ProfilePage() {
  const [data, setData] = useState(null);
  const [leagues, setLeagues] = useState([]);
  const [games, setGames] = useState({ upcoming: [], completed: [] });
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

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

  async function safeNavigateTo(e, href, apiPath) {
    e.preventDefault();
    try {
      const res = await fetch(`${API_BASE}${apiPath}`, { method: "GET" });
      if (res.ok) {
        navigate(href);
      } else {
        const txt = await res.text().catch(() => "");
        alert(`Seite vorübergehend nicht erreichbar (${res.status}).\n${txt ? txt.slice(0,200) : ""}`);
      }
    } catch (err) {
      alert("Fehler beim Aufrufen der Seite: " + (err.message || err));
    }
  }

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
        <ul style={{ listStyle: "none", paddingLeft: 0 }}>
          {leagues.map((l) => {
            const leagueHref = l.leagueUrl || (l.id ? `/league/${l.id}` : null);
            const cityHref = l.cityUrl || (l.cityId ? `/cities/${l.cityId}` : null);
            return (
              <li key={String(l.id || l.leagueId || Math.random())} style={{ marginBottom: 12 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    {leagueHref ? (
                      <a href={leagueHref} onClick={(e) => safeNavigateTo(e, leagueHref, `/leagues/${l.id || l.leagueId}`)} style={{ fontWeight: "600", fontSize: 16 }}>
                        {l.name || l.league || "—"}
                      </a>
                    ) : (
                      <span style={{ fontWeight: "600", fontSize: 16 }}>{l.name || l.league || "—"}</span>
                    )}
                    {l.sport ? <span style={{ marginLeft: 10, color: "#666" }}>{l.sport}</span> : null}
                    {l.city ? <span style={{ marginLeft: 8, color: "#666" }}>· {l.city}</span> : null}
                    {l.joined_at ? (
                      <div style={{ fontSize: 12, color: "#666", marginTop: 4 }}>
                        Beigetreten: {new Date(l.joined_at).toLocaleDateString()}
                      </div>
                    ) : null}
                  </div>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button
                      type="button"
                      onClick={(e) => leagueHref ? safeNavigateTo(e, leagueHref, `/leagues/${l.id || l.leagueId}`) : alert("Keine Liga-URL verfügbar")}
                    >
                      Zur Liga
                    </button>
                    {cityHref ? (
                      <button
                        type="button"
                        onClick={(e) => safeNavigateTo(e, cityHref, `/cities/${l.cityId}`)}
                      >
                        Zur Stadt
                      </button>
                    ) : null}
                  </div>
                </div>
              </li>
            );
          })}
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
                <td><Link to={`/matches/${g.id}`}>{g.home} – {g.away}</Link></td>
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
                <td><Link to={`${g.id}`}>{g.home} {g.home_score}:{g.away_score} {g.away}</Link></td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

