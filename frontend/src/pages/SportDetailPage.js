import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { API_BASE } from "../config";

export default function SportDetailPage() {
  const { id } = useParams();
  const [sport, setSport] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    fetch(`${API_BASE}/sports/${id}`, {
      headers: {
        Authorization: "Bearer " + (localStorage.getItem("token") || ""),
      },
      signal: controller.signal,
    })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((data) => setSport(data))
      .catch(() => setSport(null))
      .finally(() => setLoading(false));
    return () => controller.abort();
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

