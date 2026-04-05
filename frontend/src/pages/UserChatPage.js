import React, { useEffect, useMemo, useRef, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { API_BASE } from "../config";
import Avatar from "../components/Avatar";
import { useLanguage } from "../i18n";

function extractUserIdFromToken(token) {
  if (!token) return null;
  try {
    const parts = token.split(".");
    if (parts.length < 2) return null;
    const payload = JSON.parse(atob(parts[1]));
    const rawId = payload?.user?.id ?? payload?.userId ?? payload?.sub ?? payload?.id ?? null;
    const numeric = Number(rawId);
    return Number.isFinite(numeric) ? numeric : null;
  } catch {
    return null;
  }
}

export default function UserChatPage() {
  const { id } = useParams();
  const { t, lang } = useLanguage();
  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
  const myUserId = useMemo(() => extractUserIdFromToken(token), [token]);
  const [state, setState] = useState({ loading: true, err: "", chatUrl: "", chatId: null });
  const [messages, setMessages] = useState([]);
  const [invitations, setInvitations] = useState([]);
  const [inviteSchedules, setInviteSchedules] = useState({});
  const [body, setBody] = useState("");
  const [opponent, setOpponent] = useState({ name: "", avatar_url: "" });
  const [me, setMe] = useState({ avatar_url: "" });
  const [actionMsg, setActionMsg] = useState("");
  const [actionBusy, setActionBusy] = useState(false);
  const [refreshNonce, setRefreshNonce] = useState(0);
  const scrollerRef = useRef(null);
  const uiLocale = lang === 'en' ? 'en-GB' : 'de-DE';

  const threadItems = useMemo(() => {
    const textItems = messages.map((message) => ({ ...message, kind: 'text', sortAt: message.created_at || '' }));
    const inviteItems = invitations.map((invitation) => ({ ...invitation, kind: 'invite', sortAt: invitation.created_at || '' }));
    return [...textItems, ...inviteItems].sort((a, b) => new Date(a.sortAt || 0).getTime() - new Date(b.sortAt || 0).getTime());
  }, [messages, invitations]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        setState(s => ({ ...s, loading: true, err: "" }));
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
            const name = (() => { const fn = (u.firstname || '').trim(); const ln = (u.lastname || '').trim(); return ln ? `${fn} ${ln.charAt(0).toUpperCase()}.`.trim() : fn; })() || u.email || `User ${id}`;
            setOpponent({ name, avatar_url: u.avatar_url || '' });
          }
        } catch {}

        // Load my avatar
        try {
          if (Number.isFinite(myUserId)) {
            const rMe = await fetch(`${API_BASE}/users/${myUserId}`, { headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) } });
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
  }, [id, token, myUserId]);

  // Load messages (polling)
  useEffect(() => {
    let mounted = true;
    let stop = false;
    async function load() {
      try {
        const [messagesRes, invitationsRes] = await Promise.all([
          fetch(`${API_BASE}/users/${id}/messages`, { headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) } }),
          fetch(`${API_BASE}/users/${id}/match-invitations`, { headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) } })
        ]);
        const d = await messagesRes.json().catch(() => ({ messages: [] }));
        const inviteData = await invitationsRes.json().catch(() => ({ invitations: [] }));
        if (!mounted) return;
        if (messagesRes.ok) {
          const list = Array.isArray(d.messages) ? d.messages : [];
          setMessages(list);
          setInvitations(Array.isArray(inviteData.invitations) ? inviteData.invitations : []);
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
  }, [id, token, state.chatId, refreshNonce]);

  useEffect(() => {
    let cancelled = false;
    const acceptedInvitations = invitations.filter((invitation) => invitation.status === 'accepted' && invitation.match_id);
    if (!token || acceptedInvitations.length === 0) {
      setInviteSchedules({});
      return () => { cancelled = true; };
    }
    (async () => {
      const entries = await Promise.all(acceptedInvitations.map(async (invitation) => {
        try {
          const res = await fetch(`${API_BASE}/matches/${invitation.match_id}/termin-manager`, {
            headers: { Authorization: `Bearer ${token}` }
          });
          const data = await res.json().catch(() => ({}));
          if (!res.ok) return [String(invitation.id), null];
          return [String(invitation.id), data];
        } catch {
          return [String(invitation.id), null];
        }
      }));
      if (cancelled) return;
      setInviteSchedules(Object.fromEntries(entries));
    })();
    return () => { cancelled = true; };
  }, [invitations, token]);

  async function sendMessage(e) {
    e.preventDefault();
    const text = body.trim();
    if (!text) return;
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

  async function acceptInvitation(invitationId) {
    if (!token) return;
    setActionBusy(true);
    setActionMsg('');
    try {
      const res = await fetch(`${API_BASE}/match-invitations/${invitationId}/accept`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || 'INVITATION_ACCEPT_FAILED');
      setActionMsg(`Match erstellt: #${data.matchId}`);
      setRefreshNonce((value) => value + 1);
    } catch (e) {
      setActionMsg(e?.message || 'Einladung konnte nicht angenommen werden.');
    } finally {
      setActionBusy(false);
    }
  }

  async function rejectInvitation(invitationId) {
    if (!token) return;
    setActionBusy(true);
    setActionMsg('');
    try {
      const res = await fetch(`${API_BASE}/match-invitations/${invitationId}/reject`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || 'INVITATION_REJECT_FAILED');
      setActionMsg('Einladung abgelehnt.');
      setRefreshNonce((value) => value + 1);
    } catch (e) {
      setActionMsg(e?.message || 'Einladung konnte nicht abgelehnt werden.');
    } finally {
      setActionBusy(false);
    }
  }

  async function acceptProposal(matchId, proposalId) {
    if (!token) return;
    setActionBusy(true);
    setActionMsg('');
    try {
      const res = await fetch(`${API_BASE}/matches/${matchId}/termin-manager/proposals/${proposalId}/accept`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || 'PROPOSAL_ACCEPT_FAILED');
      setActionMsg('Terminvorschlag angenommen.');
      setRefreshNonce((value) => value + 1);
    } catch (e) {
      setActionMsg(e?.message || 'Terminvorschlag konnte nicht angenommen werden.');
    } finally {
      setActionBusy(false);
    }
  }

  async function rejectProposal(matchId, proposalId) {
    if (!token) return;
    setActionBusy(true);
    setActionMsg('');
    try {
      const res = await fetch(`${API_BASE}/matches/${matchId}/termin-manager/proposals/${proposalId}/reject`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || 'PROPOSAL_REJECT_FAILED');
      setActionMsg('Terminvorschlag abgelehnt.');
      setRefreshNonce((value) => value + 1);
    } catch (e) {
      setActionMsg(e?.message || 'Terminvorschlag konnte nicht abgelehnt werden.');
    } finally {
      setActionBusy(false);
    }
  }

  function renderInvitationCard(invitation) {
    const isRequester = Number(invitation.requester_user_id) === Number(myUserId);
    const isRecipient = Number(invitation.recipient_user_id) === Number(myUserId);
    const scheduleState = inviteSchedules[String(invitation.id)] || null;
    const proposal = scheduleState?.proposal || null;
    const canRespondToProposal = proposal && Number(proposal.recipientUserId) === Number(myUserId) && proposal.status === 'sent';
    const proposalDate = proposal?.proposed_datetime || proposal?.startsAt || null;

    return (
      <div key={`invite-${invitation.id}`} style={{ display: 'flex', justifyContent: isRequester ? 'flex-end' : 'flex-start' }}>
        <div style={{ maxWidth: '82%', background: 'rgba(20,51,41,0.95)', border: '1px solid rgba(90,203,165,0.28)', borderRadius: 14, padding: 14 }}>
          <div style={{ fontSize: 12, fontWeight: 800, color: '#7be0bb', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 8 }}>
            Match-Anfrage
          </div>
          <div style={{ fontSize: 16, fontWeight: 800, color: '#f1fbf5', marginBottom: 6 }}>
            {invitation.sport_name || 'Sport'} in {invitation.city_name || 'Stadt'}
          </div>
          <div style={{ fontSize: 12, color: '#9db', marginBottom: 8 }}>
            Status: {invitation.status}
            {invitation.match_id ? ` · Match #${invitation.match_id}` : ''}
          </div>
          {invitation.note && <div style={{ whiteSpace: 'pre-wrap', color: '#d9ebe0', marginBottom: 10 }}>{invitation.note}</div>}
          {invitation.status === 'pending' && isRecipient && (
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button type="button" disabled={actionBusy} onClick={() => acceptInvitation(invitation.id)} style={acceptButtonStyle}>Annehmen</button>
              <button type="button" disabled={actionBusy} onClick={() => rejectInvitation(invitation.id)} style={rejectButtonStyle}>Ablehnen</button>
            </div>
          )}
          {invitation.status === 'pending' && isRequester && (
            <div style={{ color: '#debc7c', fontWeight: 600 }}>Einladung gesendet. Warte auf Antwort.</div>
          )}
          {invitation.status === 'accepted' && invitation.match_id && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <Link to={`/matches/${invitation.match_id}`} style={linkPillStyle}>Zum Match</Link>
                <Link to={`/matches/${invitation.match_id}?openTerminManager=1`} style={linkPillStyle}>Termin-Manager öffnen</Link>
              </div>
              {proposalDate && (
                <div style={{ padding: 10, borderRadius: 10, background: 'rgba(10,28,23,0.75)', border: '1px solid rgba(222,188,124,0.28)' }}>
                  <div style={{ color: '#debc7c', fontWeight: 700, marginBottom: 4 }}>Terminvorschlag im Chat</div>
                  <div style={{ color: '#e8efe8', marginBottom: 8 }}>
                    {new Date(proposalDate).toLocaleString(uiLocale, { weekday: 'short', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                  </div>
                  {canRespondToProposal ? (
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      <button type="button" disabled={actionBusy} onClick={() => acceptProposal(invitation.match_id, proposal.id)} style={acceptButtonStyle}>Annehmen</button>
                      <button type="button" disabled={actionBusy} onClick={() => rejectProposal(invitation.match_id, proposal.id)} style={rejectButtonStyle}>Ablehnen</button>
                      <Link to={`/matches/${invitation.match_id}?openTerminManager=1`} style={linkPillStyle}>Anderen Termin vorschlagen</Link>
                    </div>
                  ) : (
                    <div style={{ color: '#9db', fontSize: 13 }}>
                      {proposal.status === 'sent' ? 'Terminvorschlag läuft.' : `Status: ${proposal.status}`}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
          {invitation.status === 'rejected' && (
            <div style={{ color: '#ffadad', fontWeight: 600 }}>Diese Anfrage wurde abgelehnt.</div>
          )}
        </div>
      </div>
    );
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
            <div>{t('userChat.loading')}</div>
          ) : state.err ? (
            <div style={{ color: 'crimson' }}>{t('userChat.error', { error: state.err })}</div>
          ) : (
            <div>
              <div ref={scrollerRef} style={{ height: 420, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 8, padding: 8, background: '#0b1e19', borderRadius: 12 }}>
                {threadItems.length === 0 && <div style={small}>Keine Nachrichten</div>}
                {threadItems.map(m => {
                  if (m.kind === 'invite') return renderInvitationCard(m);
                  const senderId = Number(m.sender_id);
                  const isOwn = Number.isFinite(myUserId) && Number.isFinite(senderId) && senderId === myUserId;
                  const displayName = isOwn ? 'Ich' : opponent?.name;

                  return (
                    <div key={m.id} style={{ display: 'flex', justifyContent: isOwn ? 'flex-end' : 'flex-start', gap: 8, alignItems: 'flex-end' }}>
                      {!isOwn && Number.isFinite(senderId) && (
                        <Avatar userId={senderId} name={displayName} size={36} />
                      )}
                      <div style={{ background: isOwn ? '#1f5c47' : '#143329', borderRadius: 12, padding: '8px 10px', maxWidth: '75%' }}>
                        <div style={{ whiteSpace: 'pre-wrap' }}>{m.body}</div>
                        <div style={{ ...small, opacity: 0.8 }}>{new Date(m.created_at || Date.now()).toLocaleString('de-DE')}</div>
                      </div>
                      {isOwn && Number.isFinite(myUserId) && (
                        <Avatar userId={myUserId} name="Ich" src={me?.avatar_url} size={36} />
                      )}
                    </div>
                  );
                })}
              </div>
              {actionMsg && <div style={{ marginTop: 12, color: actionMsg.toLowerCase().includes('fehler') || actionMsg.includes('FAILED') ? '#ff8d8d' : '#8ff0b7', fontWeight: 600 }}>{actionMsg}</div>}
              <form onSubmit={sendMessage} style={{ marginTop: 12, display: 'flex', gap: 8 }}>
                <input style={inputStyle} value={body} onChange={e => setBody(e.target.value)} placeholder={t('userChat.placeholder')} />
                <button type="submit" style={sendBtn}>Senden</button>
              </form>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 12 }}>
                <Link to={`/user/${id}`} style={pill}>{t('userChat.toProfile')}</Link>
              </div>
              <div style={{ ...small, marginTop: 8 }}>Interne Chat-URL: {state.chatUrl}</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

const acceptButtonStyle = {
  padding: '9px 14px',
  borderRadius: 10,
  border: 'none',
  background: 'linear-gradient(135deg,#48c9a9,#2f9c7a)',
  color: '#07271f',
  fontWeight: 800,
  cursor: 'pointer'
};

const rejectButtonStyle = {
  padding: '9px 14px',
  borderRadius: 10,
  border: '1px solid rgba(220,90,90,0.4)',
  background: 'rgba(60,20,20,0.45)',
  color: '#ffb0b0',
  fontWeight: 700,
  cursor: 'pointer'
};

const linkPillStyle = {
  display: 'inline-flex',
  alignItems: 'center',
  padding: '9px 14px',
  borderRadius: 10,
  border: '1px solid rgba(90,203,165,0.35)',
  background: 'rgba(10,33,27,0.85)',
  color: '#7be0bb',
  fontWeight: 700,
  textDecoration: 'none'
};
