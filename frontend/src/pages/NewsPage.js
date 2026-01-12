import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { API_BASE } from "../config";
import Avatar from "../components/Avatar";

function formatTimestamp(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString("de-DE", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function NewsPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [items, setItems] = useState([]);

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) {
      setError("Bitte einloggen, um Neuigkeiten zu sehen.");
      setLoading(false);
      return;
    }

    const controller = new AbortController();
    setLoading(true);
    setError("");

    fetch(`${API_BASE}/news`, {
      headers: { Authorization: `Bearer ${token}` },
      signal: controller.signal,
    })
      .then(async (res) => {
        if (!res.ok) {
          const msg = await res.text().catch(() => "");
          throw new Error(msg || "Neuigkeiten konnten nicht geladen werden.");
        }
        return res.json();
      })
      .then((data) => {
        setItems(Array.isArray(data?.items) ? data.items : []);
      })
      .catch((err) => {
        if (controller.signal.aborted) return;
        setError(err.message || "Neuigkeiten konnten nicht geladen werden.");
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, []);

  if (loading) {
    return <div style={{ padding: 24 }}>Lade Neuigkeiten ...</div>;
  }

  if (error) {
    return <div style={{ padding: 24, color: "crimson" }}>{error}</div>;
  }

  if (!items.length) {
    return (
      <div style={{ padding: 24 }}>
        <h1 style={{ marginTop: 0 }}>Neuigkeiten</h1>
        <div>Aktuell gibt es keine neuen Ereignisse.</div>
      </div>
    );
  }

  return (
    <div style={{ padding: 24 }}>
      <h1 style={{ marginTop: 0 }}>Neuigkeiten</h1>
      <div style={{ display: "grid", gap: 16 }}>
        {items.map((item) => {
          const ts = formatTimestamp(item.timestamp);
          const leagueLabel = item.leagueName || (item.leagueId ? `Liga #${item.leagueId}` : "Liga");
          const matchLink = item.matchId ? `/matches/${item.matchId}` : null;
          
          // Get avatar info for different notification types
          let avatarUserId = null;
          let avatarName = "";
          let avatarSrc = null;
          
          if (item.type === 'schedule_proposal') {
            avatarUserId = item.proposerUserId;
            avatarName = item.proposerName || `User ${item.proposerUserId}`;
            avatarSrc = item.avatarUrl;
          } else if (item.type === 'player_joined') {
            avatarUserId = item.joinedUserId;
            avatarName = item.joinedUserName || `User ${item.joinedUserId}`;
            avatarSrc = item.avatarUrl;
          } else if (item.fromUserId) {
            avatarUserId = item.fromUserId;
            avatarName = item.fromUserName || `User ${item.fromUserId}`;
            avatarSrc = item.avatarUrl;
          }
          
          return (
            <div
              key={item.id}
              style={{
                background: "linear-gradient(135deg, #112d23, #16362c)",
                padding: "16px 20px",
                borderRadius: 14,
                color: "#e8f3ec",
                boxShadow: "0 12px 24px rgba(0,0,0,0.35)",
                display: "flex",
                gap: 12,
              }}
            >
              {avatarUserId && (
                <div style={{ flexShrink: 0 }}>
                  <Avatar
                    userId={avatarUserId}
                    name={avatarName}
                    src={avatarSrc}
                    size={48}
                  />
                </div>
              )}
              <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 12 }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                  <div style={{ fontWeight: 600, fontSize: 18 }}>{item.title}</div>
                  {ts && <div style={{ color: "#9fbeb0", fontSize: 13 }}>{ts}</div>}
                </div>
                <div style={{ color: "#aecfbf", lineHeight: 1.5 }}>{item.details}</div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
                  <div style={{ color: "#8fb3a0", fontSize: 14 }}>{leagueLabel}</div>
                  {matchLink && (
                    <Link
                      to={matchLink}
                      style={{
                        background: "rgba(255,255,255,0.08)",
                        color: "#f5fff9",
                        padding: "6px 14px",
                        borderRadius: 999,
                        textDecoration: "none",
                        fontSize: 13,
                      }}
                    >
                      Zum Match
                    </Link>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
