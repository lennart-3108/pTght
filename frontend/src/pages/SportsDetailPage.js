import React, { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { API_BASE } from "../config";

export default function SportsDetailPage() {
  const { id } = useParams();
  const [sport, setSport] = useState(null);
  const [leagues, setLeagues] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    setErr("");

    const normalize = (l) => ({
      id: l.id,
      name: l.name,
      cityId: l.cityId ?? l.city_id ?? l.cityID,
      sportId: l.sportId ?? l.sport_id ?? l.sportID,
      city: l.city ?? l.city_name ?? l.cityName ?? "",
    });

    Promise.all([
      fetch(`${API_BASE}/sports/${id}`).then(r => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`)))),
      fetch(`${API_BASE}/sports/${id}/leagues`).then(r => (r.ok ? r.json() : []))
    ])
      .then(([s, ls]) => {
        if (!mounted) return;
        setSport(s);
        setLeagues(Array.isArray(ls) ? ls.map(normalize) : []);
      })
      .catch(e => mounted && setErr(e.message || "Fehler"))
      .finally(() => mounted && setLoading(false));

    return () => { mounted = false; };
  }, [id]);

  if (loading) return <div style={{ padding: 16 }}>Lade Sportart ...</div>;
  if (err) return <div style={{ padding: 16, color: "crimson" }}>Fehler: {err}</div>;
  if (!sport) return <div style={{ padding: 16 }}>Keine Daten.</div>;

  return (
    <div style={{ padding: 16 }}>
      <h2>Sportart: {sport.name}</h2>

      <h3 style={{ marginTop: 12 }}>Ligen</h3>
      {leagues.length === 0 ? (
        <div>Keine Ligen für diese Sportart.</div>
      ) : (
        <table border="1" cellPadding="6" style={{ borderCollapse: "collapse", width: "100%" }}>
          <thead>
            <tr>
              <th>Stadt</th>
              <th>Liga</th>
            </tr>
          </thead>
          <tbody>
            {leagues.map(l => (
              <tr key={l.id}>
                <td><Link to={`/cities/${l.cityId}`}>{l.city}</Link></td>
                <td><Link to={`/league/${l.id}`}>{l.name}</Link></td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <div style={{ marginTop: 12 }}>
        <Link to="/sports">← Zurück zu Sportarten</Link>
      </div>
    </div>
  );
}
