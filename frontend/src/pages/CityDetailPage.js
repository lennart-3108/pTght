import React, { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";

export default function CityDetailPage() {
  const { cityId } = useParams();
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [data, setData] = useState(null);

  useEffect(() => {
    let isMounted = true;
    setLoading(true);
    setErr("");
    fetch(`http://localhost:5001/cities/${cityId}`)
      .then(async (r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((json) => {
        if (isMounted) setData(json);
      })
      .catch((e) => {
        if (isMounted) setErr(e.message || "Fehler beim Laden.");
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });
    return () => { isMounted = false; };
  }, [cityId]);

  if (loading) return <div style={{ padding: 16 }}>Lade Stadt ...</div>;
  if (err) return <div style={{ padding: 16, color: "crimson" }}>Fehler: {String(err)}</div>;
  if (!data?.city) return <div style={{ padding: 16 }}>Keine Daten gefunden.</div>;

  const { city, leagues = [] } = data;

  return (
    <div style={{ padding: 16 }}>
      <h2>Stadt: {city.name}</h2>
      <p>ID: {city.id}</p>

      <h3>Ligen</h3>
      {leagues.length === 0 ? (
        <div>Keine Ligen gefunden.</div>
      ) : (
        <table>
          <tbody>
            {leagues.map((l) => (
              <tr key={l.id}>
                <td>
                  <Link to={`/league/${l.id}`}>{l.name}</Link>
                </td>
                <td>
                  <Link to={`/sports/${l.sportId}`}>{l.sport}</Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <div style={{ marginTop: 16 }}>
        <Link to="/cities">Zurück zur Städteübersicht</Link>
      </div>
    </div>
  );
}
