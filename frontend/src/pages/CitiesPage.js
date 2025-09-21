import React, { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { API_BASE } from "../config"; // fix: import API_BASE

export default function CitiesPage() {
  const { cityId } = useParams();
  const [leagues, setLeagues] = useState([]);
  const [city, setCity] = useState(null);
  const [loading, setLoading] = useState(true);
  const [citiesAll, setCitiesAll] = useState([]);

  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      try {
        if (cityId) {
          const res = await fetch(`${API_BASE}/cities/${cityId}`); // fix: use API_BASE
          if (!res.ok) throw new Error("Fehler beim Laden der Stadt");
          const data = await res.json();
          setCity(data.city);
          setLeagues(data.leagues || []);
        } else {
            // Nur Städte laden (keine Ligen-Übersicht hier)
            const resCities = await fetch(`${API_BASE}/cities/list`);
            if (!resCities.ok) throw new Error("Fehler beim Laden der Städte");
            const citiesData = await resCities.json();
            setCitiesAll(Array.isArray(citiesData) ? citiesData : []);
        }
      } catch (error) {
        console.error(error);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [cityId]);

  if (loading) return <p>Lade {cityId ? "Stadt" : "Städte & Ligen"}...</p>;

  if (cityId && city) {
    return (
      <div>
        <h2>Stadt: {city.name}</h2>
        <p><Link to="/cities">← Zurück zur Übersicht</Link></p>
        {leagues.length === 0 ? (
          <p>Keine Ligen in dieser Stadt.</p>
        ) : (
          <table border="1" cellPadding="6" style={{ borderCollapse: "collapse", width: "100%" }}>
            <thead>
              <tr>
                <th>Liga</th>
                <th>Sportart</th>
              </tr>
            </thead>
            <tbody>
              {leagues.map(l => (
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
      </div>
    );
  }

  return (
    <div>
      <h2>Städte</h2>
      {citiesAll.length === 0 ? (
        <p>Keine Städte gefunden.</p>
      ) : (
        <ul>
          {citiesAll.map((c) => (
            <li key={c.id}>
              <Link to={`/cities/${c.id}`}>{c.name}</Link>
            </li>
          ))}
        </ul>
      )}

      {/* Ligen nach Städten entfernt per Anforderung */}
    </div>
  );
}
