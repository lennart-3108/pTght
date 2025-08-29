import React, { useEffect, useState } from "react";

export default function CitiesPage() {
  const [leagues, setLeagues] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchLeagues() {
      try {
        const res = await fetch("http://localhost:5001/leagues");
        if (!res.ok) throw new Error("Fehler beim Laden der Ligen");
        const data = await res.json();
        setLeagues(data);
      } catch (error) {
        console.error(error);
      } finally {
        setLoading(false);
      }
    }

    fetchLeagues();
  }, []);

  if (loading) return <p>Lade Ligen...</p>;

  return (
    <div>
      <h2>Ligen nach Städten</h2>

      {leagues.length === 0 ? (
        <p>Keine Ligen gefunden.</p>
      ) : (
        <table border="1" cellPadding="6" style={{ borderCollapse: "collapse", width: "100%" }}>
          <thead>
            <tr>
              <th>Stadt</th>
              <th>Sportart</th>
              <th>Liganame</th>
              <th>Aktion</th>
            </tr>
          </thead>
          <tbody>
            {leagues.map((league) => (
              <tr key={league.id}>
                <td>{league.city}</td>
                <td>{league.sport}</td>
                <td>{league.name}</td>
                <td>
                  <button onClick={() => alert(`Beitreten zu ${league.name}`)}>Beitreten</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
