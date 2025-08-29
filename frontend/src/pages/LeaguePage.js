import React, { useEffect, useState } from "react";

// Annahmen: Endpunkte `/api/leagues` und `/api/my-leagues`
export default function LeaguePage() {
  const [leagues, setLeagues] = useState([]);
  const [myLeagues, setMyLeagues] = useState([]);

  useEffect(() => {
    fetch("http://localhost:5001/leagues", {
      headers: { Authorization: "Bearer " + localStorage.getItem("token") }
    })
      .then(res => res.json())
      .then(data => setLeagues(data));

    fetch("http://localhost:5001/my-leagues", {
      headers: { Authorization: "Bearer " + localStorage.getItem("token") }
    })
      .then(res => res.json())
      .then(data => setMyLeagues(data));
  }, []);

  return (
    <div style={{ padding: 40 }}>
      <h2>Alle Ligen</h2>
      <ul>
        {leagues.map(l => (
          <li key={l.id}>
            <b>{l.name}</b> ({l.city}) [{l.sport}]
          </li>
        ))}
      </ul>
      <hr />
      <h2>Meine Ligen</h2>
      <ul>
        {myLeagues.length === 0 ? <i>Noch nicht angemeldet.</i> :
          myLeagues.map(l => (
            <li key={l.id}>
              <b>{l.name}</b> ({l.city}) [{l.sport}]
            </li>
          ))
        }
      </ul>
    </div>
  );
}
