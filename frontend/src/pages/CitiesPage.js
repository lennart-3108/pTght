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
          // Alle Städte und Ligen laden
          const [resCities, resLeagues] = await Promise.all([
            fetch(`${API_BASE}/cities/list`),  // fix: API_BASE is defined
            fetch(`${API_BASE}/leagues`),      // fix: API_BASE is defined
          ]);
          if (!resCities.ok) throw new Error("Fehler beim Laden der Städte");
          if (!resLeagues.ok) throw new Error("Fehler beim Laden der Ligen");
          const [citiesData, leaguesData] = await Promise.all([resCities.json(), resLeagues.json()]);
          setCitiesAll(Array.isArray(citiesData) ? citiesData : []);
          setLeagues(Array.isArray(leaguesData) ? leaguesData : []);
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

      <h2 style={{ marginTop: 16 }}>Ligen nach Städten</h2>
      {leagues.length === 0 ? (
        <p>Keine Ligen gefunden.</p>
      ) : (
        <table border="1" cellPadding="6" style={{ borderCollapse: "collapse", width: "100%" }}>
          <thead>
            <tr>
              <th>Stadt</th>
              <th>Sportart</th>
              <th>Liganame</th>
            </tr>
          </thead>
          <tbody>
            {leagues.map((league) => (
              <tr key={league.id}>
                <td>
                  <Link to={`/cities/${league.cityId}`}>{league.city}</Link>
                </td>
                <td>
                  <Link to={`/sports/${league.sportId}`}>{league.sport}</Link>
                </td>
                <td>
                  <Link to={`/league/${league.id}`}>{league.name}</Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
