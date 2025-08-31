import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";

export default function SportsPage() {
  const [sports, setSports] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("http://localhost:5001/sports", {
      headers: {
        Authorization: "Bearer " + localStorage.getItem("token")
      }
    })
      .then(res => res.json())
      .then(data => {
        setSports(data);
        setLoading(false);
      });
  }, []);

  if (loading) return <p style={{ padding: 20 }}>Lädt...</p>;

  return (
    <div style={{ padding: 40 }}>
      <h2>Alle Sportarten</h2>
      {sports.length === 0 ? (
        <p>Keine Sportarten gefunden.</p>
      ) : (
        <ul>
          {sports.map((sport, i) => (
            <li key={sport.id || i}>
              <Link to={`/sports/${sport.id}`}>{sport.name}</Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

