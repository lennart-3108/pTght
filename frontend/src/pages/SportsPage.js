import React, { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { API_BASE } from "../config";

export default function SportsPage() {
  const { id } = useParams();
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [data, setData] = useState(null);
  const [leagues, setLeagues] = useState([]);

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    setErr("");
    const url = id ? `${API_BASE}/sports/${id}` : `${API_BASE}/sports/list`;
    fetch(url)
      .then(async (r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((json) => {
        if (mounted) setData(json);
      })
      .catch((e) => mounted && setErr(e.message || "Fehler beim Laden."))
      .finally(() => mounted && setLoading(false));
    return () => { mounted = false; };
  }, [id]);

  useEffect(() => {
    if (!id) { setLeagues([]); return; }
    let mounted = true;
    fetch(`${API_BASE}/leagues`)
      .then((r) => r.ok ? r.json() : [])
      .then((rows) => {
        if (!mounted) return;
        const list = Array.isArray(rows) ? rows.filter(l => String(l.sportId) === String(id)) : [];
        setLeagues(list);
      })
      .catch(() => mounted && setLeagues([]));
    return () => { mounted = false; };
  }, [id]);

  if (loading) return <div style={{ padding: 16 }}>Lade Sportarten ...</div>;
  if (err) return <div style={{ padding: 16, color: "crimson" }}>Fehler: {err}</div>;

  if (id) {
    if (!data) return <div style={{ padding: 16 }}>Nicht gefunden.</div>;
    return (
      <div style={{ padding: 16 }}>
        <h2>Sportart</h2>
        <p><b>ID:</b> {data.id}</p>
        <p><b>Name:</b> {data.name}</p>

        <h3 style={{ marginTop: 16 }}>Ligen für diese Sportart</h3>
        {leagues.length === 0 ? (
          <div>Keine Ligen gefunden.</div>
        ) : (
          <ul>
            {leagues.map((l) => (
              <li key={l.id}>
                <Link to={`/league/${l.id}`}>{l.name}</Link> –{" "}
                <Link to={`/cities/${l.cityId}`}>{l.city}</Link>
              </li>
            ))}
          </ul>
        )}

        <div style={{ marginTop: 16 }}>
          <Link to="/sports">Zurück zur Übersicht</Link>
        </div>
      </div>
    );
  }

  const list = Array.isArray(data) ? data : [];
  return (
    <div style={{ padding: 16 }}>
      <h2>Sportarten</h2>
      {list.length === 0 ? (
        <div>Keine Sportarten gefunden.</div>
      ) : (
        <ul>
          {list.map((s) => (
            <li key={s.id}>
              <Link to={`/sports/${s.id}`}>{s.name}</Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

