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
          
          if (item.type === 'friend_request') {
            avatarUserId = item.fromUserId;
            avatarName = item.fromUserName || `User ${item.fromUserId}`;
            avatarSrc = item.avatarUrl;
          } else if (item.type === 'schedule_proposal') {
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
          
          // Special styling for proposal notifications
          const isProposal = item.type === 'schedule_proposal';
          const isFriendRequest = item.type === 'friend_request';
          const titleColor = (isProposal || isFriendRequest) ? '#debc7c' : '#e8f3ec';
          const containerBorder = (isProposal || isFriendRequest) ? '2px solid #2f6b57' : 'none';
          const containerBg = (isProposal || isFriendRequest) ? '#1a2e26' : 'linear-gradient(135deg, #112d23, #16362c)';
          
          return (
            <div
              key={item.id}
              style={{
                background: containerBg,
                padding: "16px 20px",
                borderRadius: 14,
                color: "#e8f3ec",
                boxShadow: "0 12px 24px rgba(0,0,0,0.35)",
                display: "flex",
                gap: 12,
                border: containerBorder,
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
                  <div style={{ fontWeight: (isProposal || isFriendRequest) ? 700 : 600, fontSize: 18, color: titleColor }}>
                    {isProposal && '📩 '}
                    {isFriendRequest && '👥 '}
                    {item.title}
                  </div>
                  {ts && <div style={{ color: "#9fbeb0", fontSize: 13 }}>{ts}</div>}
                </div>
                <div style={{ color: "#aecfbf", lineHeight: 1.5 }}>{item.details}</div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                  {!isFriendRequest && <div style={{ color: "#8fb3a0", fontSize: 14 }}>{leagueLabel}</div>}
                  {isFriendRequest && avatarUserId && (
                    <Link
                      to={`/user/${avatarUserId}`}
                      style={{
                        background: "#1c5b47",
                        color: "#f2fff8",
                        padding: "10px 16px",
                        borderRadius: 10,
                        textDecoration: "none",
                        fontSize: 14,
                        fontWeight: 600,
                        border: "2px solid #debc7c",
                        display: "inline-block",
                      }}
                    >
                      Profil ansehen
                    </Link>
                  )}
                  {matchLink && !isFriendRequest && (
                    <Link
                      to={matchLink}
                      style={{
                        background: "#1c5b47",
                        color: "#f2fff8",
                        padding: "10px 16px",
                        borderRadius: 10,
                        textDecoration: "none",
                        fontSize: 14,
                        fontWeight: 600,
                        border: "2px solid #debc7c",
                        display: "inline-block",
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
