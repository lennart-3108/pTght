import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";

export default function SportDetailPage() {
  const { id } = useParams();
  const [sport, setSport] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`http://localhost:5001/sports/${id}`, {
      headers: {
        Authorization: "Bearer " + localStorage.getItem("token")
      }
    })
      .then(res => res.json())
      .then(data => {
        setSport(data);
        setLoading(false);
      });
  }, [id]);

  if (loading) return <p style={{ padding: 20 }}>Lädt...</p>;
  if (!sport) return <p style={{ padding: 20 }}>Sportart nicht gefunden.</p>;

  return (
    <div style={{ padding: 40 }}>
      <h2>{sport.name}</h2>
      <p><b>ID:</b> {sport.id}</p>
      {sport.description && <p>{sport.description}</p>}
    </div>
  );
}
