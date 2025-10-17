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

function truncateText(text, max = 140) {
  if (!text) return "";
  if (text.length <= max) return text;
  return `${text.slice(0, max - 1)}…`;
}

export default function ChatsPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [chats, setChats] = useState([]);

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) {
      setError("Bitte einloggen, um Chats zu sehen.");
      setLoading(false);
      return;
    }

    const controller = new AbortController();
    setLoading(true);
    setError("");

    // unified chats list (match-based and direct chats)
    fetch(`${API_BASE}/chats`, {
      headers: { Authorization: `Bearer ${token}` },
      signal: controller.signal,
    })
      .then(async (res) => {
        if (!res.ok) {
          const msg = await res.text().catch(() => "");
          throw new Error(msg || "Chats konnten nicht geladen werden.");
        }
        return res.json();
      })
      .then((data) => {
        setChats(Array.isArray(data?.chats) ? data.chats : []);
      })
      .catch((err) => {
        if (controller.signal.aborted) return;
        setError(err.message || "Chats konnten nicht geladen werden.");
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, []);

  if (loading) {
    return <div style={{ padding: 24 }}>Lade Chats ...</div>;
  }

  if (error) {
    return <div style={{ padding: 24, color: "crimson" }}>{error}</div>;
  }

  if (!chats.length) {
    return (
      <div style={{ padding: 24 }}>
        <h1 style={{ marginTop: 0 }}>Chats</h1>
        <div>Du hast aktuell keine Chats. Starte ein Match, um loszulegen!</div>
      </div>
    );
  }

  return (
    <div style={{ padding: 24 }}>
      <h1 style={{ marginTop: 0 }}>Chats</h1>
      <div style={{ display: "grid", gap: 16 }}>
        {chats.map((chat) => {
          const last = chat.lastMessage;
          const activity = formatTimestamp(chat.lastActivityAt || last?.createdAt);
          const href = chat.type === 'direct'
            ? `/chat/user/${chat.opponentUserId}`
            : `/matches/${chat.matchId}`;
          const typeLabel = chat.type === 'direct' ? 'Privater Chat' : 'Match-Chat';
          return (
            <Link
              key={`${chat.type}-${chat.type === 'direct' ? chat.chatId : chat.matchId}`}
              to={href}
              style={{
                display: "block",
                background: "linear-gradient(135deg, #0f2e25, #16382e)",
                padding: "16px 20px",
                borderRadius: 14,
                textDecoration: "none",
                color: "#e8f3ec",
                boxShadow: "0 12px 24px rgba(0,0,0,0.35)",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16 }}>
                <div style={{ display: 'flex', gap: 12, alignItems: 'center', flex: '1 1 auto' }}>
                  <Avatar userId={chat.opponentUserId} name={chat.opponentName} src={chat.opponentAvatar} size={40} />
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{ fontSize: 18, fontWeight: 600, color: "#f4fff8" }}>{chat.opponentName || "Match"}</div>
                      <span style={{ fontSize: 11, background: '#144033', color: '#cfeee1', padding: '2px 8px', borderRadius: 999, border: '1px solid #2b6b57' }}>{typeLabel}</span>
                      {chat.unread ? (
                        <span style={{ marginLeft: 4, fontSize: 11, background: '#b93a3a', color: '#fff', padding: '2px 8px', borderRadius: 999 }}>Neu</span>
                      ) : null}
                    </div>
                  {chat.type === 'match' && (
                    <div style={{ color: "#9fbeb0", marginTop: 4 }}>
                      {chat.leagueName || "Liga unbekannt"}
                      {chat.sportName ? ` · ${chat.sportName}` : ""}
                    </div>
                  )}
                  {last ? (
                    <div style={{ marginTop: 10, fontSize: 14 }}>
                      <div style={{ fontWeight: 600, color: "#d4ede1" }}>{last.senderTeamName || last.senderUserName || "Letzte Nachricht"}</div>
                      <div style={{ marginTop: 4, color: "#aecfbf", lineHeight: 1.4 }}>{truncateText(last.body)}</div>
                    </div>
                  ) : (
                    <div style={{ marginTop: 12, fontSize: 14, color: "#8fb3a0" }}>Noch keine Nachrichten.</div>
                  )}
                  </div>
                </div>
                <div style={{ flex: "0 0 auto", display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 8 }}>
                  {activity && <div style={{ fontSize: 13, color: "#94b5a5" }}>{activity}</div>}
                  {chat.type === 'match' && chat.homeScore != null && chat.awayScore != null && (
                    <div style={{ fontSize: 14, background: "rgba(255,255,255,0.08)", padding: "4px 12px", borderRadius: 999, color: "#f7fff9" }}>
                      {chat.homeScore}:{chat.awayScore}
                    </div>
                  )}
                  <div style={{ fontSize: 13, color: "#7ca895" }}>{chat.type === 'direct' ? 'Zum Chat' : 'Zum Match'}</div>
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
