import React, { useEffect, useRef, useState } from "react";
import { API_BASE } from "../config";

export default function MatchChat({ matchId, token }) {
  const [messages, setMessages] = useState([]);
  const [meta, setMeta] = useState(null);
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [sending, setSending] = useState(false);
  const listRef = useRef(null);
  const pollRef = useRef(null);

  useEffect(() => {
    if (!token) {
      setLoading(false);
      setError("Bitte einloggen, um den Match-Chat zu nutzen.");
      return;
    }
    let cancelled = false;
    const controller = new AbortController();

    async function load(initial = false) {
      try {
        const res = await fetch(`${API_BASE}/matches/${matchId}/chat`, {
          headers: { Authorization: `Bearer ${token}` },
          signal: controller.signal,
        });
        if (!res.ok) {
          const msg = res.status === 403
            ? "Du bist nicht Teil dieses Matches."
            : res.status === 404
              ? "Match nicht gefunden."
              : "Chat konnte nicht geladen werden.";
          if (!cancelled) {
            setError(msg);
            setMessages([]);
            setMeta(null);
          }
          return;
        }
        const data = await res.json().catch(() => ({ messages: [], meta: null }));
        if (!cancelled) {
          setError("");
          setMessages(Array.isArray(data.messages) ? data.messages : []);
          setMeta(data.meta || null);
          if (initial) setTimeout(scrollToBottom, 0);
          // mark as read
          try {
            await fetch(`${API_BASE}/chats/match/${matchId}/read`, { method: 'POST', headers: { Authorization: `Bearer ${token}` } });
          } catch {}
        }
      } catch (e) {
        if (cancelled || controller.signal.aborted) return;
        setError("Chat konnte nicht geladen werden.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    function scrollToBottom() {
      if (!listRef.current) return;
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }

    load(true);
    pollRef.current = window.setInterval(() => load(false), 10000);

    return () => {
      cancelled = true;
      controller.abort();
      if (pollRef.current) window.clearInterval(pollRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [matchId, token]);

  useEffect(() => {
    if (!listRef.current) return;
    listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [messages]);

  async function sendMessage(e) {
    e.preventDefault();
    const value = text.trim();
    if (!value) return;
  setSending(true);
    try {
      const res = await fetch(`${API_BASE}/matches/${matchId}/chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ message: value }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const msg = data?.error || "Nachricht konnte nicht gesendet werden.";
        setError(msg);
        return;
      }
      if (data?.message) {
        setMessages((prev) => [...prev, data.message]);
        setMeta((prev) => ({ ...(prev || {}), ...(data.meta || {}) }));
        setText("");
      }
    } catch (e) {
      setError("Nachricht konnte nicht gesendet werden.");
    } finally {
      setSending(false);
    }
  }

  const viewerUserId = meta?.viewerUserId || null;
  const viewerTeamId = meta?.viewerTeamId || null;

  function renderMessage(msg) {
    // Team cannot send; only users send messages (even in team matches).
    const isOwn = viewerUserId != null && Number(msg.senderUserId) === Number(viewerUserId);
    const align = isOwn ? 'row-reverse' : 'row';
    const bubbleColor = isOwn ? '#1f5c47' : '#16342c';
    const name = msg.senderUserName || msg.senderTeamName || (msg.senderUserId ? `User ${msg.senderUserId}` : 'Unbekannt');
    const avatarUrl = msg.senderUserAvatar || '';
    const initials = (name || 'U').slice(0, 1).toUpperCase();
    return (
      <div key={msg.id} style={{ display: 'flex', flexDirection: align, gap: 8, marginBottom: 12, alignItems: 'flex-end' }}>
        {avatarUrl ? (
          <img alt="avatar" src={avatarUrl} style={{ width: 32, height: 32, borderRadius: 999, objectFit: 'cover', border: '1px solid #2f6b57' }} />
        ) : (
          <div style={{ width: 32, height: 32, borderRadius: 999, background: '#123226', border: '1px solid #2f6b57', color: '#a9c9bb', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700 }}>
            {initials}
          </div>
        )}
        <div style={{ maxWidth: '70%', background: bubbleColor, borderRadius: 12, padding: '10px 12px', color: '#e5f4ec' }}>
          <div style={{ fontSize: 12, color: '#a9c9bb', marginBottom: 4 }}>{name}</div>
          <div style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{msg.body}</div>
          <div style={{ fontSize: 11, color: '#7fa392', marginTop: 6 }}>{formatTimestamp(msg.createdAt)}</div>
        </div>
      </div>
    );
  }

  function formatTimestamp(value) {
    if (!value) return "";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "";
    return date.toLocaleString("de-DE", { hour: "2-digit", minute: "2-digit", day: "2-digit", month: "2-digit" });
  }

  return (
    <div style={{ marginTop: 24, background: "#0f241d", borderRadius: 16, padding: 16, boxShadow: "0 12px 28px rgba(0,0,0,0.5)" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
        <div style={{ fontWeight: 600, color: "#f0fff6" }}>Match-Chat</div>
        {meta?.matchType === "teams" && <div style={{ fontSize: 12, color: "#8fb7a7" }}>Team-zu-Team</div>}
      </div>
      {loading ? (
        <div style={{ color: "#bcd" }}>Lade Chat ...</div>
      ) : error ? (
        <div style={{ color: "#ffb4b4" }}>{error}</div>
      ) : (
        <>
          <div ref={listRef} style={{ height: 420, overflowY: "auto", paddingRight: 8, marginBottom: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 12 }}>
              <div style={{ background: '#12382c', border: '1px solid #285243', color: '#d7efe5', padding: '8px 12px', borderRadius: 999, fontSize: 12 }}>
                Herzlich willkommen zum Match – von Match League
              </div>
            </div>
            {messages.length === 0 ? (
              <div style={{ color: "#92b2a4" }}>Noch keine Nachrichten.</div>
            ) : (
              messages.map(renderMessage)
            )}
          </div>
          <form onSubmit={sendMessage} style={{ display: "flex", gap: 8 }}>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Nachricht schreiben ..."
              style={{ flex: 1, background: "#153129", borderRadius: 10, border: "1px solid #285243", color: "#e5f4ec", padding: 10, resize: "vertical", minHeight: 48 }}
              maxLength={2000}
            />
            <button
              type="submit"
              disabled={sending || !text.trim()}
              style={{ padding: "12px 16px", borderRadius: 10, border: "1px solid #2f6b57", background: sending ? "#264c3e" : "#1c5b47", color: "#f2fff8", cursor: sending ? "wait" : "pointer", minWidth: 90 }}
            >
              Senden
            </button>
          </form>
        </>
      )}
    </div>
  );
}
