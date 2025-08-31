import React, { useEffect, useState } from "react";

// Annahme: Ein Endpunkt liefert die Daten, z. B. /api/sports und /api/leagues usw.
export default function CreatePage({ isAdmin }) {
  const [sports, setSports] = useState([]);
  const [newSport, setNewSport] = useState("");
  const [success, setSuccess] = useState(null);

  useEffect(() => {
    // Sportarten laden
    fetch("http://localhost:5001/sports", {
      headers: { Authorization: "Bearer " + localStorage.getItem("token") }
    })
      .then(res => res.json())
      .then(data => setSports(data));
  }, []);

  if (!isAdmin) {
    return <div style={{ padding: 40 }}><h2>Nur für Admins sichtbar!</h2></div>;
  }

  // Sportart erstellen
  const handleCreateSport = async (e) => {
    e.preventDefault();
    const res = await fetch("http://localhost:5001/sports", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + localStorage.getItem("token"),
      },
      body: JSON.stringify({ name: newSport })
    });
    if (res.ok) {
      setSuccess("Sportart erstellt!");
      setNewSport("");
      // Liste nachladen
      fetch("http://localhost:5001/sports", {
        headers: { Authorization: "Bearer " + localStorage.getItem("token") }
      })
        .then(r => r.json())
        .then(data => setSports(data));
    } else {
      setSuccess("Fehler beim Erstellen.");
    }
  };

  return (
    <div style={{ padding: 40 }}>
      <h2>Admin-Bereich: Alles erstellen</h2>
      <form onSubmit={handleCreateSport}>
        <b>Neue Sportart anlegen:</b><br />
        <input
          value={newSport}
          onChange={e => setNewSport(e.target.value)}
          placeholder="Sportart Name"
        />
        <button type="submit">Erstellen</button>
      </form>
      {success && <div style={{ color: "green" }}>{success}</div>}
      <br />
      <h3>Alle Sportarten:</h3>
      <ul>
        {sports.map(s => <li key={s.id}>{s.name}</li>)}
      </ul>
      {/* ⚡️: Hier kannst du weitere Formulare für Städte, Ligen, User usw. ergänzen, analog */}
    </div>
  );
}
 