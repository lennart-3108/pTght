import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { API_BASE } from "../config";

export default function StartPage() {
  const [leagues, setLeagues] = useState([]);
  const [sports, setSports] = useState([]);
  const [cities, setCities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    setErr("");
    Promise.all([
      fetch(`${API_BASE}/leagues`).then(r => r.ok ? r.json() : []),
      fetch(`${API_BASE}/sports/list`).then(r => r.ok ? r.json() : []),
      fetch(`${API_BASE}/cities/list`).then(r => r.ok ? r.json() : []),
    ])
      .then(([ls, ss, cs]) => {
        if (!mounted) return;
        setLeagues(Array.isArray(ls) ? ls : []);
        setSports(Array.isArray(ss) ? ss : []);
        setCities(Array.isArray(cs) ? cs : []);
      })
      .catch(e => { if (mounted) setErr(e.message || "Fehler beim Laden."); })
      .finally(() => { if (mounted) setLoading(false); });
    return () => { mounted = false; };
  }, []);

  if (loading) return <div style={{ padding: 24 }}>Lade Startseite ...</div>;
  if (err) return <div style={{ padding: 24, color: "crimson" }}>Fehler: {err}</div>;

  return (
    <div style={{ padding: 24, maxWidth: 900, margin: "0 auto" }}>
      <h1>Willkommen bei MatchLeague</h1>
      <p>
        <b>MatchLeague</b> ist deine Plattform für Ligen, Sportarten und Community-Wettbewerbe.<br />
        <Link to="/login">Anmelden</Link> oder <Link to="/register">Registrieren</Link>
      </p>

      <h2>Ligen</h2>
      {leagues.length === 0 ? (
        <div>Keine Ligen vorhanden.</div>
      ) : (
        <ul style={{ paddingLeft: 0, listStyle: "none" }}>
          {leagues.slice(0, 10).map(l => (
            <li key={l.id} style={{ marginBottom: 8 }}>
              <Link to={`/league/${l.id}`} style={{ fontWeight: 600 }}>{l.name}</Link>
              {l.sport ? <span style={{ marginLeft: 8, color: "#666" }}>{l.sport}</span> : null}
              {l.city ? <span style={{ marginLeft: 8, color: "#666" }}>· {l.city}</span> : null}
            </li>
          ))}
        </ul>
      )}
      <div style={{ marginTop: 8 }}>
        <Link to="/leagues">Alle Ligen anzeigen</Link>
      </div>

      <h2>Sportarten</h2>
      {sports.length === 0 ? (
        <div>Keine Sportarten vorhanden.</div>
      ) : (
        <ul style={{ paddingLeft: 0, listStyle: "none" }}>
          {sports.map(s => (
            <li key={s.id}>
              <Link to={`/sports/${s.id}`}>{s.name}</Link>
            </li>
          ))}
        </ul>
      )}

      <h2>Städte</h2>
      {cities.length === 0 ? (
        <div>Keine Städte vorhanden.</div>
      ) : (
        <ul style={{ paddingLeft: 0, listStyle: "none" }}>
          {cities.map(c => (
            <li key={c.id}>
              <Link to={`/cities/${c.id}`}>{c.name}</Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}


