import React, { useEffect, useRef, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { API_BASE } from "../config";
import Avatar from "../components/Avatar";

export default function UserChatPage() {
  const { id } = useParams();
  const [state, setState] = useState({ loading: true, err: "", chatUrl: "", chatId: null });
  const [messages, setMessages] = useState([]);
  const [body, setBody] = useState("");
  const [opponent, setOpponent] = useState({ name: "", avatar_url: "" });
  const [me, setMe] = useState({ avatar_url: "" });
  const scrollerRef = useRef(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        setState(s => ({ ...s, loading: true, err: "" }));
        const token = typeof window !== 'undefined' ? localStorage.getItem('token') : '';
        // Ask backend for a chat URL placeholder; can be used later to deep-link
        const res = await fetch(`${API_BASE}/users/${id}/start-chat`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {})
          },
          body: '{}'
        });
        const data = await res.json().catch(async () => {
          const t = await res.text().catch(() => '');
          return { error: t || 'Fehler' };
        });
        if (!mounted) return;
        setState({ loading: false, err: res.ok ? "" : (data?.error || "Fehler"), chatUrl: data?.url || `/chat/user/${id}`, chatId: data?.chatId || null });

        // Load opponent meta (name/avatar) for rendering
        try {
          const rUser = await fetch(`${API_BASE}/users/${id}`, { headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) } });
          if (rUser.ok) {
            const u = await rUser.json();
            const name = `${u.firstname || ''} ${u.lastname || ''}`.trim() || u.email || `User ${id}`;
            setOpponent({ name, avatar_url: u.avatar_url || '' });
          }
        } catch {}

        // Load my avatar
        try {
          const myId = Number(localStorage.getItem('userId'));
          if (Number.isFinite(myId)) {
            const rMe = await fetch(`${API_BASE}/users/${myId}`, { headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) } });
            if (rMe.ok) {
              const u = await rMe.json();
              setMe({ avatar_url: u.avatar_url || '' });
            }
          }
        } catch {}
      } catch (e) {
        if (!mounted) return;
        setState({ loading: false, err: e?.message || String(e), chatUrl: `/chat/user/${id}`, chatId: null });
      }
    })();
    return () => { mounted = false; };
  }, [id]);

  // Load messages (polling)
  useEffect(() => {
    let mounted = true;
    let stop = false;
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : '';
    async function load() {
      try {
        const r = await fetch(`${API_BASE}/users/${id}/messages`, { headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) } });
        const d = await r.json().catch(() => ({ messages: [] }));
        if (!mounted) return;
        if (r.ok) {
          setMessages(Array.isArray(d.messages) ? d.messages : []);
          // scroll to bottom
          setTimeout(() => {
            if (scrollerRef.current) scrollerRef.current.scrollTop = scrollerRef.current.scrollHeight;
          }, 0);
          // optimistic: mark direct chat as read if chatId known
          try {
            const chatId = d?.chatId || state.chatId;
            if (chatId && token) {
              await fetch(`${API_BASE}/chats/direct/${chatId}/read`, { method: 'POST', headers: { Authorization: `Bearer ${token}` } });
            }
          } catch {}
        }
      } catch {}
      if (!stop) setTimeout(load, 2000);
    }
    load();
    return () => { mounted = false; stop = true; };
  }, [id]);

  async function sendMessage(e) {
    e.preventDefault();
    const text = body.trim();
    if (!text) return;
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : '';
    const r = await fetch(`${API_BASE}/users/${id}/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {})
      },
      body: JSON.stringify({ body: text })
    });
    if (r.ok) {
      setBody("");
      // trigger reload next tick
      setTimeout(() => {
        const ev = new Event('forcePoll');
        window.dispatchEvent(ev);
      }, 10);
    }
  }

  const wrap = { padding: 16, color: '#e8efe8' };
  const card = { background: '#0f2a20', borderRadius: 16, boxShadow: '0 14px 36px rgba(0,0,0,0.5)' };
  const pad = { padding: 16 };
  const small = { fontSize: 12, color: '#a6bfb3' };
  const pill = { display: 'inline-block', padding: '6px 12px', borderRadius: 999, border: '1px solid #2f6b57', background: '#0e2a22', color: '#dfe' };
  const inputStyle = { width: '100%', padding: 10, borderRadius: 8, border: '1px solid #2f6b57', background: '#0b1e19', color: '#e8efe8' };
  const sendBtn = { ...pill, borderRadius: 8 };

  return (
    <div style={wrap}>
      <div style={{ ...card }}>
        <div style={{ ...pad }}>
          <div style={{ fontSize: 24, fontWeight: 900, marginBottom: 6 }}>Direkter Chat</div>
          <div style={small}>Mit Nutzer #{id}</div>
        </div>
        <div style={{ ...pad, paddingTop: 0 }}>
          {state.loading ? (
            <div>Wird geladen…</div>
          ) : state.err ? (
            <div style={{ color: 'crimson' }}>Fehler: {state.err}</div>
          ) : (
            <div>
              <div ref={scrollerRef} style={{ height: 420, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 8, padding: 8, background: '#0b1e19', borderRadius: 12 }}>
                {messages.length === 0 && <div style={small}>Keine Nachrichten</div>}
                {messages.map(m => {
                  const isOwn = m.sender_id === Number(localStorage.getItem('userId'));
                  return (
                    <div key={m.id} style={{ display: 'flex', justifyContent: isOwn ? 'flex-end' : 'flex-start', gap: 8, alignItems: 'flex-end' }}>
                      {!isOwn && (
                        <Avatar userId={id} name={opponent?.name} src={opponent?.avatar_url} size={36} />
                      )}
                      <div style={{ background: isOwn ? '#1f5c47' : '#143329', borderRadius: 12, padding: '8px 10px', maxWidth: '75%' }}>
                        <div style={{ whiteSpace: 'pre-wrap' }}>{m.body}</div>
                        <div style={{ ...small, opacity: 0.8 }}>{new Date(m.created_at || Date.now()).toLocaleString('de-DE')}</div>
                      </div>
                      {isOwn && (
                        <Avatar userId={Number(localStorage.getItem('userId'))} name={"Ich"} src={me?.avatar_url} size={36} />
                      )}
                    </div>
                  );
                })}
              </div>
              <form onSubmit={sendMessage} style={{ marginTop: 12, display: 'flex', gap: 8 }}>
                <input style={inputStyle} value={body} onChange={e => setBody(e.target.value)} placeholder="Nachricht schreiben…" />
                <button type="submit" style={sendBtn}>Senden</button>
              </form>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 12 }}>
                <Link to={`/user/${id}`} style={pill}>Zum Profil</Link>
              </div>
              <div style={{ ...small, marginTop: 8 }}>Interne Chat-URL: {state.chatUrl}</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
