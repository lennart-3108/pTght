import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { API_BASE } from "../config";
import smallLogo from "../images/matchleague_logo_4x4.png";

// load background images same as LoginPage
function importAllBackgrounds(r) {
  return r.keys().map((k) => ({ key: k.replace(/^\.\//, ''), src: r(k) }));
}
const backgrounds = importAllBackgrounds(require.context("../images/background", false, /\.(png|jpe?g|svg)$/));
backgrounds.sort((a, b) => {
  const re = /^(\d+)-/;
  const ma = a.key.match(re);
  const mb = b.key.match(re);
  if (ma && mb) return Number(ma[1]) - Number(mb[1]);
  if (ma) return -1;
  if (mb) return 1;
  return a.key.localeCompare(b.key);
});

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
    <div>
      <section className="hero-carousel">
        {backgrounds.map((b, i) => (
          <div key={i} className={`hero-slide ${i === 0 ? 'active' : ''}`} style={{ backgroundImage: `url(${b.src})` }} />
        ))}

        <div className="hero-overlay">
          <div className="hero-stripe">
            <img src={smallLogo} alt="ML" className="hero-small-logo" />
            <h1 className="hero-title">Match League</h1>
          </div>
          <p className="hero-sub"><b>Willkommen bei MatchLeague. Verbinde dich mit Spielern. Tritt Ligen bei. Verfolge Spiele.</b></p>
        </div>
      </section>

  <div style={{ padding: 24, maxWidth: 900, margin: "0 auto" }}>
      

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
    </div>
  );
}


