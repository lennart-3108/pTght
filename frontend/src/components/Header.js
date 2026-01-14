import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import matchLeagueLogo from "../images/header/match_league_header_long.png"; // use long branded logo
import { API_BASE, fetchWithTimeout } from "../config";
import Avatar from "./Avatar";
import "./Header.css";

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

function formatShortTimestamp(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString("de-DE", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function truncate(text, max = 140) {
  if (!text) return "";
  if (text.length <= max) return text;
  return `${text.slice(0, max - 1)}…`;
}

const NOTIF_CACHE_KEY = "ml:cache:news";
const CHATS_CACHE_KEY = "ml:cache:chats";

function readCache(key) {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object") return parsed;
  } catch {}
  return null;
}

function writeCache(key, value) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {}
}

function formatDebugTime(value) {
  if (!value) return "–";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "–";
  return date.toLocaleTimeString("de-DE", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

export default function Header() {
  const navigate = useNavigate();
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [chatsOpen, setChatsOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [notifLoading, setNotifLoading] = useState(false);
  const [notifError, setNotifError] = useState("");
  const [acceptingFriendRequests, setAcceptingFriendRequests] = useState({});
  const [proposalActions, setProposalActions] = useState({});
  const [chatThreads, setChatThreads] = useState([]);
  const [chatsLoading, setChatsLoading] = useState(false);
  const [chatsError, setChatsError] = useState("");
  const [notifLastLoadedAt, setNotifLastLoadedAt] = useState(null);
  const [chatsLastLoadedAt, setChatsLastLoadedAt] = useState(null);
  const [notifLastStartedAt, setNotifLastStartedAt] = useState(null);
  const [chatsLastStartedAt, setChatsLastStartedAt] = useState(null);
  const [notifLastStatus, setNotifLastStatus] = useState("idle");
  const [chatsLastStatus, setChatsLastStatus] = useState("idle");
  const [notifDataSource, setNotifDataSource] = useState("live");
  const [chatsDataSource, setChatsDataSource] = useState("live");
  const [userRoles, setUserRoles] = useState([]);
  const headerRef = useRef(null);
  const isMountedRef = useRef(true);

  const initialNewsSeen = useCallback(() => {
    if (typeof window === "undefined") return 0;
    const raw = window.localStorage.getItem("ml:lastNewsSeen");
    const parsed = raw ? Number(raw) : 0;
    return Number.isFinite(parsed) ? parsed : 0;
  }, []);

  const [lastNewsSeen, setLastNewsSeen] = useState(() => initialNewsSeen());

  // One-time debug banner
  useEffect(() => {
    try {
      // eslint-disable-next-line no-console
      console.log("[Header] mount", { API_BASE, path: window.location && window.location.pathname, hasToken: !!localStorage.getItem("token") });
    } catch {}
  }, []);

  useEffect(() => {
    const onPop = () => setOpen(false);
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  useEffect(() => {
    setOpen(false);
    setNotificationsOpen(false);
    setChatsOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    // Ensure flag is true on mount (React 18 StrictMode runs effects twice in dev)
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (!notificationsOpen && !chatsOpen && !open) return;
    function handleClickOutside(e) {
      if (!headerRef.current) return;
      if (headerRef.current.contains(e.target)) return;
      setNotificationsOpen(false);
      setChatsOpen(false);
      setOpen(false);
    }
    document.addEventListener("click", handleClickOutside);
    return () => document.removeEventListener("click", handleClickOutside);
  }, [notificationsOpen, chatsOpen, open]);

  useEffect(() => {
    const handleKey = (e) => {
      if (e.key === "Escape") {
        setNotificationsOpen(false);
        setChatsOpen(false);
        setOpen(false);
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, []);

  const isAdmin = localStorage.getItem("is_admin") === "1";
  const token = localStorage.getItem("token");
  const myUserId = useMemo(() => extractUserIdFromToken(token), [token]);

  function handleLogout(e) {
    e.preventDefault();
    localStorage.removeItem("token");
    localStorage.removeItem("is_admin");
    navigate("/login");
    window.location.reload();
  }

  const handleNavigate = () => {
    setOpen(false);
    setNotificationsOpen(false);
    setChatsOpen(false);
  };

  const fetchNotifications = useCallback(async ({ showLoader = false } = {}) => {
    if (!token) return;
    const started = Date.now();
    try { console.log("[Header] /news fetch start", { at: new Date(started).toISOString(), showLoader }); } catch {}
    if (isMountedRef.current) {
      setNotifLoading(true);
      if (showLoader) setNotifError("");
      setNotifLastStartedAt(Date.now());
      setNotifLastStatus("pending");
    }
    try {
      const res = await fetchWithTimeout(`${API_BASE}/news`, {
        headers: { Authorization: `Bearer ${token}` },
        timeout: 2500,
      });
      try { console.log("[Header] /news response", { ok: res.ok, status: res.status }); } catch {}
      if (!res.ok) {
        const msg = await res.text().catch(() => "");
        throw new Error(`[${res.status}] ${msg || "Neuigkeiten konnten nicht geladen werden."}`);
      }
      // Debug: peek at body
      let data;
      try {
        const raw = await res.clone().text();
        try { console.log('[Header] /news body', (raw || '').slice(0, 300)); } catch {}
        data = JSON.parse(raw || '{}');
      } catch (e) {
        // fallback to res.json()
        data = await res.json();
      }
      if (!isMountedRef.current) return;
      const items = Array.isArray(data?.items) ? data.items : [];
      const now = Date.now();
      try { console.log("[Header] /news success", { items: items.length, tookMs: now - started }); } catch {}
      setNotifications(items);
      setNotifError("");
      setNotifLastStatus("success");
      setNotifDataSource("live");
      setNotifLastLoadedAt(now);
      writeCache(NOTIF_CACHE_KEY, { timestamp: now, items });
    } catch (e) {
      try { console.warn("[Header] /news error", e && (e.message || e)); } catch {}
      if (!isMountedRef.current) return;
      if (e?.name === "AbortError") {
        setNotifError("Timeout beim Laden der Neuigkeiten.");
        setNotifLastStatus("timeout");
      } else {
        setNotifError(e?.message || "Neuigkeiten konnten nicht geladen werden.");
        setNotifLastStatus("error");
      }
      const cached = readCache(NOTIF_CACHE_KEY);
      if (cached && Array.isArray(cached.items) && cached.items.length) {
        try { console.log("[Header] /news using cache", { items: cached.items.length }); } catch {}
        setNotifications(cached.items);
        setNotifLastLoadedAt(cached.timestamp || Date.now());
        setNotifDataSource("cache");
        setNotifError((prev) => {
          const base = prev || "Neuigkeiten konnten nicht geladen werden.";
          return base.includes("(Zeige Cache)") ? base : `${base} (Zeige Cache)`;
        });
      }
    } finally {
      if (isMountedRef.current) {
        setNotifLoading(false);
  setNotifLastLoadedAt((prev) => (prev ?? Date.now()));
      }
      try { console.log("[Header] /news finished", { tookMs: Date.now() - started }); } catch {}
    }
  }, [token]);

  const acceptFriendRequest = useCallback(async (fromUserId) => {
    const id = Number(fromUserId);
    if (!token) return;
    if (!Number.isFinite(id) || id <= 0) return;
    if (acceptingFriendRequests[id]) return;
    setAcceptingFriendRequests((prev) => ({ ...prev, [id]: true }));
    try {
      const res = await fetchWithTimeout(`${API_BASE}/users/${id}/friendships`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        timeout: 2500,
      });
      if (!res.ok) {
        const msg = await res.text().catch(() => "");
        throw new Error(msg || "Freundschaftsanfrage konnte nicht angenommen werden.");
      }
      await fetchNotifications();
    } catch (e) {
      if (isMountedRef.current) setNotifError(e?.message || "Freundschaftsanfrage konnte nicht angenommen werden.");
    } finally {
      if (isMountedRef.current) {
        setAcceptingFriendRequests((prev) => {
          const next = { ...prev };
          delete next[id];
          return next;
        });
      }
    }
  }, [token, fetchNotifications, acceptingFriendRequests]);

  const acceptProposal = useCallback(async (matchId, proposalId) => {
    if (!token || proposalActions[proposalId]) return;
    setProposalActions((prev) => ({ ...prev, [proposalId]: 'accepting' }));
    try {
      const res = await fetchWithTimeout(`${API_BASE}/matches/${matchId}/termin-manager/proposals/${proposalId}/accept`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        timeout: 10000,
      });
      if (!res.ok) {
        const msg = await res.text().catch(() => "");
        throw new Error(msg || "Terminvorschlag konnte nicht angenommen werden.");
      }
      await fetchNotifications();
    } catch (e) {
      if (isMountedRef.current) setNotifError(e?.message || "Terminvorschlag konnte nicht angenommen werden.");
    } finally {
      if (isMountedRef.current) {
        setProposalActions((prev) => {
          const next = { ...prev };
          delete next[proposalId];
          return next;
        });
      }
    }
  }, [token, fetchNotifications, proposalActions]);

  const rejectProposal = useCallback(async (matchId, proposalId) => {
    if (!token || proposalActions[proposalId]) return;
    setProposalActions((prev) => ({ ...prev, [proposalId]: 'rejecting' }));
    try {
      const res = await fetchWithTimeout(`${API_BASE}/matches/${matchId}/termin-manager/proposals/${proposalId}/reject`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        timeout: 10000,
      });
      if (!res.ok) {
        const msg = await res.text().catch(() => "");
        throw new Error(msg || "Terminvorschlag konnte nicht abgelehnt werden.");
      }
      await fetchNotifications();
    } catch (e) {
      if (isMountedRef.current) setNotifError(e?.message || "Terminvorschlag konnte nicht abgelehnt werden.");
    } finally {
      if (isMountedRef.current) {
        setProposalActions((prev) => {
          const next = { ...prev };
          delete next[proposalId];
          return next;
        });
      }
    }
  }, [token, fetchNotifications, proposalActions]);

  const fetchChats = useCallback(async ({ showLoader = false } = {}) => {
    if (!token) return;
    const started = Date.now();
    try { console.log("[Header] /chats fetch start", { at: new Date(started).toISOString(), showLoader }); } catch {}
    if (isMountedRef.current) {
      setChatsLoading(true);
      if (showLoader) setChatsError("");
      setChatsLastStartedAt(Date.now());
      setChatsLastStatus("pending");
    }
    try {
      const res = await fetchWithTimeout(`${API_BASE}/chats`, {
        headers: { Authorization: `Bearer ${token}` },
        timeout: 2500,
      });
      try { console.log("[Header] /chats response", { ok: res.ok, status: res.status }); } catch {}
      if (!res.ok) {
        const msg = await res.text().catch(() => "");
        throw new Error(`[${res.status}] ${msg || "Chats konnten nicht geladen werden."}`);
      }
      // Debug: peek at body
      let data;
      try {
        const raw = await res.clone().text();
        try { console.log('[Header] /chats body', (raw || '').slice(0, 300)); } catch {}
        data = JSON.parse(raw || '{}');
      } catch (e) {
        // fallback to res.json()
        data = await res.json();
      }
      if (!isMountedRef.current) return;
      const chats = Array.isArray(data?.chats)
        ? data.chats
        : (Array.isArray(data) ? data : []);
      const now = Date.now();
      try { console.log("[Header] /chats success", { chats: chats.length, tookMs: now - started }); } catch {}
      setChatThreads(chats);
      setChatsError("");
      setChatsLastStatus("success");
      setChatsDataSource("live");
      setChatsLastLoadedAt(now);
      writeCache(CHATS_CACHE_KEY, { timestamp: now, chats });
    } catch (e) {
      try { console.warn("[Header] /chats error", e && (e.message || e)); } catch {}
      if (!isMountedRef.current) return;
      if (e?.name === "AbortError") {
        setChatsError("Timeout beim Laden der Chats.");
        setChatsLastStatus("timeout");
      } else {
        setChatsError(e?.message || "Chats konnten nicht geladen werden.");
        setChatsLastStatus("error");
      }
      const cached = readCache(CHATS_CACHE_KEY);
      if (cached && Array.isArray(cached.chats) && cached.chats.length) {
        try { console.log("[Header] /chats using cache", { chats: cached.chats.length }); } catch {}
        setChatThreads(cached.chats);
        setChatsLastLoadedAt(cached.timestamp || Date.now());
        setChatsDataSource("cache");
        setChatsError((prev) => {
          const base = prev || "Chats konnten nicht geladen werden.";
          return base.includes("(Zeige Cache)") ? base : `${base} (Zeige Cache)`;
        });
      }
    } finally {
      if (isMountedRef.current) {
        setChatsLoading(false);
  setChatsLastLoadedAt((prev) => (prev ?? Date.now()));
      }
      try { console.log("[Header] /chats finished", { tookMs: Date.now() - started }); } catch {}
    }
  }, [token]);

  useEffect(() => {
    if (!token) {
      setNotifications([]);
      setChatThreads([]);
      return;
    }
    fetchNotifications({ showLoader: true });
    fetchChats({ showLoader: true });
    const notifTimer = window.setInterval(() => fetchNotifications(), 45000);
    const chatTimer = window.setInterval(() => fetchChats(), 25000);
    return () => {
      window.clearInterval(notifTimer);
      window.clearInterval(chatTimer);
    };
  }, [token, fetchNotifications, fetchChats]);

  useEffect(() => {
    if (!token) {
      setNotifDataSource("live");
      setChatsDataSource("live");
      return;
    }
    const cachedNews = readCache(NOTIF_CACHE_KEY);
    if (cachedNews && Array.isArray(cachedNews.items) && cachedNews.items.length) {
      setNotifications(cachedNews.items);
      setNotifLastLoadedAt(cachedNews.timestamp || null);
      setNotifLastStatus((prev) => (prev === "idle" ? "cache" : prev));
      setNotifDataSource("cache");
    }
    const cachedChats = readCache(CHATS_CACHE_KEY);
    if (cachedChats && Array.isArray(cachedChats.chats) && cachedChats.chats.length) {
      setChatThreads(cachedChats.chats);
      setChatsLastLoadedAt(cachedChats.timestamp || null);
      setChatsLastStatus((prev) => (prev === "idle" ? "cache" : prev));
      setChatsDataSource("cache");
    }
  }, [token]);

  useEffect(() => {
    if (notificationsOpen) fetchNotifications();
  }, [notificationsOpen, fetchNotifications]);

  useEffect(() => {
    if (chatsOpen) fetchChats();
  }, [chatsOpen, fetchChats]);

  // Fetch user roles on mount if logged in
  useEffect(() => {
    if (!token || !myUserId) {
      setUserRoles([]);
      return;
    }
    
    async function loadUserRoles() {
      try {
        const res = await fetch(`${API_BASE}/roles/users/${myUserId}/roles`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (res.ok) {
          const roles = await res.json();
          setUserRoles(roles.map(r => r.name));
        }
      } catch (err) {
        console.error('Failed to load user roles:', err);
      }
    }
    
    loadUserRoles();
  }, [token, myUserId]);

  const markNotificationsRead = useCallback(() => {
    if (!notifications.length) return;
    const now = Date.now();
    setLastNewsSeen(now);
    if (typeof window !== "undefined") {
      window.localStorage.setItem("ml:lastNewsSeen", String(now));
    }
  }, [notifications.length]);

  const markChatsRead = useCallback(async () => {
    if (!token) return;
    const unread = chatThreads.filter((c) => c?.unread);
    if (!unread.length) return;
    try {
      await Promise.all(unread.map(async (chat) => {
        const url = chat.type === "direct"
          ? `${API_BASE}/chats/direct/${chat.chatId}/read`
          : `${API_BASE}/chats/match/${chat.matchId}/read`;
        try {
          await fetch(url, { method: "POST", headers: { Authorization: `Bearer ${token}` } });
        } catch {}
      }));
    } finally {
      if (isMountedRef.current) setChatThreads((prev) => prev.map((chat) => ({ ...chat, unread: false })));
    }
  }, [chatThreads, token]);

  useEffect(() => {
    if (notificationsOpen) markNotificationsRead();
  }, [notificationsOpen, markNotificationsRead]);

  // Do NOT mark chats as read when merely opening the popover; only mark when opening a chat view.
  // (kept for reference)
  // useEffect(() => {
  //   if (chatsOpen) markChatsRead();
  // }, [chatsOpen, markChatsRead]);

  const unreadNotificationsCount = useMemo(() => {
    if (!notifications.length) return 0;
    return notifications.reduce((count, item) => {
      const ts = item?.timestamp ? Date.parse(item.timestamp) || 0 : 0;
      return ts > lastNewsSeen ? count + 1 : count;
    }, 0);
  }, [notifications, lastNewsSeen]);

  const unreadChatsCount = useMemo(() => {
    if (!chatThreads.length) return 0;
    return chatThreads.reduce((count, chat) => count + (chat?.unread ? 1 : 0), 0);
  }, [chatThreads]);

  const latestNotifications = useMemo(() => notifications.slice(0, 6), [notifications]);
  const latestChats = useMemo(() => chatThreads.slice(0, 6), [chatThreads]);
  const notifHasUnread = unreadNotificationsCount > 0;
  const chatHasUnread = unreadChatsCount > 0;

  const handleToggleNotifications = () => {
    try { console.log('[Header] click bell'); } catch {}
    setNotificationsOpen((prev) => {
      const next = !prev;
      if (next) {
        setChatsOpen(false);
        setOpen(false);
      }
      return next;
    });
  };

  const handleToggleChats = () => {
    try { console.log('[Header] click chat'); } catch {}
    setChatsOpen((prev) => {
      const next = !prev;
      if (next) {
        setNotificationsOpen(false);
        setOpen(false);
      }
      return next;
    });
  };

  const badgeValue = (value) => {
    if (!value) return null;
    return value > 9 ? "9+" : String(value);
  };

  return (
    <header className="ml-header" ref={headerRef}>
      <div className="ml-header-container">
        <div className="ml-header__logo">
          <Link to="/start" className="ml-logo-link" aria-label="Start">
            <img src={matchLeagueLogo} alt="MatchLeague" className="ml-logo-full" />
          </Link>
        </div>

        <div className={"ml-header__menu" + (open ? " is-open" : "")}>
        <nav className="ml-nav">
          {!token && (
            <>
              <Link to="/login" className="ml-nav__item" onClick={handleNavigate}>Login</Link>
              <Link to="/leagues" className="ml-nav__item" onClick={handleNavigate}>Ligen</Link>
              <Link to="/abos" className="ml-nav__item" onClick={handleNavigate}>Abos</Link>
              <Link to="/register" className="ml-nav__item" onClick={handleNavigate}>Registrieren</Link>
            </>
          )}

          {token && (
            <>
              <Link to={`/user/${myUserId}`} className="ml-nav__item" onClick={handleNavigate}>Profil</Link>
              <Link to="/teams" className="ml-nav__item" onClick={handleNavigate}>Teams</Link>
              <Link to="/leagues" className="ml-nav__item" onClick={handleNavigate}>Ligen</Link>
              <Link to="/abos" className="ml-nav__item" onClick={handleNavigate}>Abos</Link>
              <Link to="/booking" className="ml-nav__item" onClick={handleNavigate}>Platz buchen</Link>
              {userRoles.includes('location_provider') && (
                <Link to="/location-manager" className="ml-nav__item" onClick={handleNavigate}>Location Manager</Link>
              )}
              {userRoles.includes('trainer') && (
                <Link to="/training" className="ml-nav__item" onClick={handleNavigate}>Training</Link>
              )}
              {userRoles.includes('club_admin') && (
                <Link to="/clubs" className="ml-nav__item" onClick={handleNavigate}>Vereine</Link>
              )}
              <Link to="/chats" className="ml-nav__item" onClick={handleNavigate}>Chats</Link>
              <Link to="/news" className="ml-nav__item" onClick={handleNavigate}>Neuigkeiten</Link>
            </>
          )}

          {isAdmin && (
            <>
              <Link to="/admin" className="ml-nav__item" onClick={handleNavigate}>Admin</Link>
              <Link to="/create" className="ml-nav__item" onClick={handleNavigate}>Create</Link>
            </>
          )}
        </nav>

        {token && (
          <div className="ml-logout">
            <a href="#logout" onClick={(e) => { handleNavigate(); handleLogout(e); }} className="ml-nav__item">Abmelden</a>
          </div>
        )}
      </div>

      <div className="ml-header__actions">
        {token && (
          <>
            <div className="ml-actionWrap">
              <button
                type="button"
                className={`ml-action${notificationsOpen ? " is-active" : ""}${notifHasUnread ? " has-unread" : ""}`}
                aria-label="Neuigkeiten"
                title="Neuigkeiten"
                onClick={handleToggleNotifications}
              >
                <span className="ml-action__icon" aria-hidden="true">
                  <svg width="20" height="20" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" className="ml-icon ml-icon--bell">
                    <path d="M18 15V11C18 8.23858 15.7614 6 13 6H11C8.23858 6 6 8.23858 6 11V15" fill="none" stroke="currentColor" />
                    <path d="M4 15H20" fill="none" stroke="currentColor" />
                    <path d="M10 18C10.3333 18.6667 11.3333 20 12 20C12.6667 20 13.6667 18.6667 14 18" fill="none" stroke="currentColor" />
                  </svg>
                </span>
                {badgeValue(unreadNotificationsCount) && (
                  <span className="ml-action__badge">{badgeValue(unreadNotificationsCount)}</span>
                )}
              </button>
              {notificationsOpen && (
                <div className="ml-popover" role="dialog" aria-label="Neuigkeiten">
                  <div className="ml-popover__header">
                    <div className="ml-popover__title">Neuigkeiten</div>
                    <div className="ml-popover__headerActions">
                      <Link to="/news" className="ml-popover__link" onClick={handleNavigate}>Alle anzeigen</Link>
                    </div>
                  </div>
                  <div className="ml-popover__body">
                    {notifLoading ? (
                      <div className="ml-popover__status">Lade Neuigkeiten …</div>
                    ) : notifError ? (
                      <div className="ml-popover__error">{notifError}</div>
                    ) : latestNotifications.length ? (
                      <ul className="ml-popover__list">
                        {latestNotifications.map((item) => {
                          if (item?.type === "friend_request" && item?.fromUserId) {
                            const fromName = item.fromUserName || item.fromName || `User ${item.fromUserId}`;
                            const busy = !!acceptingFriendRequests[Number(item.fromUserId)];
                            const details = item.details || `${fromName} hat dir eine Freundschaftsanfrage gesendet.`;
                            return (
                              <li key={item.id} className="ml-popover__item">
                                <div className="ml-popover__itemLinkBody">
                                  <div className="ml-popover__avatar">
                                    <Link
                                      to={`/user/${item.fromUserId}`}
                                      onClick={handleNavigate}
                                      aria-label={`Profil von ${fromName}`}
                                      style={{ display: "block", width: "100%", height: "100%", textDecoration: "none", color: "inherit" }}
                                    >
                                      <Avatar
                                        userId={item.fromUserId}
                                        name={fromName}
                                        src={item.fromAvatarUrl}
                                        size={38}
                                      />
                                    </Link>
                                  </div>
                                  <div className="ml-popover__itemContent">
                                    <div className="ml-popover__itemRow">
                                      <div className="ml-popover__itemTitle">{item.title || "Freundschaftsanfrage"}</div>
                                      <button
                                        type="button"
                                        className="ml-popover__itemLink"
                                        disabled={busy}
                                        onClick={(e) => {
                                          e.preventDefault();
                                          e.stopPropagation();
                                          acceptFriendRequest(item.fromUserId);
                                        }}
                                      >
                                        {busy ? "…" : "Annehmen"}
                                      </button>
                                    </div>
                                    <div className="ml-popover__itemMeta">{formatShortTimestamp(item.timestamp)}</div>
                                    <div className="ml-popover__itemText">{truncate(details, 180)}</div>
                                  </div>
                                </div>
                              </li>
                            );
                          }

                          return (
                            <li key={item.id} className="ml-popover__item">
                              {(item.type === 'schedule_proposal' || item.type === 'player_joined' || item.type === 'availability_shared' || item.type === 'schedule_accepted' || item.type === 'schedule_rejected') && item.avatarUrl ? (
                                <div style={{
                                  display: 'flex',
                                  gap: 12,
                                  alignItems: 'flex-start',
                                  background: '#1a2e26',
                                  border: '2px solid #2f6b57',
                                  borderRadius: 12,
                                  padding: 12
                                }}>
                                  <div style={{ flexShrink: 0, width: 38, height: 38, borderRadius: 8, overflow: 'hidden' }}>
                                    <Link
                                      to={`/matches/${item.matchId}`}
                                      onClick={handleNavigate}
                                      aria-label={
                                        item.type === 'schedule_proposal' ? `Terminvorschlag ansehen` : 
                                        item.type === 'availability_shared' ? `Verfügbarkeiten ansehen` :
                                        item.type === 'schedule_accepted' ? `Match ansehen` :
                                        item.type === 'schedule_rejected' ? `Match ansehen` :
                                        `Match ansehen`
                                      }
                                      style={{ display: "block", width: "100%", height: "100%", textDecoration: "none", color: "inherit" }}
                                    >
                                      <Avatar
                                        userId={
                                          item.type === 'schedule_proposal' ? item.proposerUserId : 
                                          item.type === 'player_joined' ? item.joinedUserId :
                                          item.fromUserId
                                        }
                                        name={
                                          item.type === 'schedule_proposal' ? item.proposerName : 
                                          item.type === 'player_joined' ? item.joinedUserName :
                                          item.fromUserName
                                        }
                                        src={item.avatarUrl}
                                        size={38}
                                      />
                                    </Link>
                                  </div>
                                  <div className="ml-popover__itemContent" style={{ flex: 1 }}>
                                    <div className="ml-popover__itemRow">
                                      <div className="ml-popover__itemTitle" style={{ color: '#debc7c', fontWeight: 700 }}>
                                        {item.type === 'schedule_proposal' && '📩 '}
                                        {item.type === 'schedule_accepted' && '✅ '}
                                        {item.type === 'schedule_rejected' && '❌ '}
                                        {item.type === 'player_joined' && '🎾 '}
                                        {item.type === 'availability_shared' && '📅 '}
                                        {item.title}
                                      </div>
                                    </div>
                                    <div className="ml-popover__itemMeta">
                                      {formatShortTimestamp(item.timestamp)}
                                      {item.leagueName ? ` · ${item.leagueName}` : ""}
                                    </div>
                                    <div className="ml-popover__itemText">{truncate(item.details, 180)}</div>
                                    {item.type === 'schedule_proposal' && (
                                      <div style={{ display: 'flex', gap: 10, marginTop: 12 }}>
                                        <button
                                          disabled={proposalActions[item.proposalId]}
                                          onClick={(e) => {
                                            e.preventDefault();
                                            e.stopPropagation();
                                            acceptProposal(item.matchId, item.proposalId);
                                          }}
                                          style={{
                                            padding: '10px 16px',
                                            borderRadius: 10,
                                            border: '1px solid #2f6b57',
                                            background: '#1c5b47',
                                            color: '#f2fff8',
                                            cursor: proposalActions[item.proposalId] ? 'not-allowed' : 'pointer',
                                            fontWeight: 600,
                                            fontSize: 14,
                                            opacity: proposalActions[item.proposalId] ? 0.6 : 1
                                          }}
                                        >
                                          {proposalActions[item.proposalId] === 'accepting' ? "…" : "✓ Annehmen"}
                                        </button>
                                        <button
                                          disabled={proposalActions[item.proposalId]}
                                          onClick={(e) => {
                                            e.preventDefault();
                                            e.stopPropagation();
                                            rejectProposal(item.matchId, item.proposalId);
                                          }}
                                          style={{
                                            padding: '10px 16px',
                                            borderRadius: 10,
                                            border: '1px solid #553f3f',
                                            background: '#2a1b1b',
                                            color: '#e9d8d8',
                                            cursor: proposalActions[item.proposalId] ? 'not-allowed' : 'pointer',
                                            fontSize: 14,
                                            opacity: proposalActions[item.proposalId] ? 0.6 : 1
                                          }}
                                        >
                                          {proposalActions[item.proposalId] === 'rejecting' ? "…" : "✗ Ablehnen"}
                                        </button>
                                      </div>
                                    )}
                                    {item.type === 'player_joined' && (
                                      <div style={{ display: 'flex', gap: 10, marginTop: 12 }}>
                                        <Link
                                          to={`/matches/${item.matchId}`}
                                          onClick={handleNavigate}
                                          style={{
                                            textDecoration: 'none',
                                            textAlign: 'center',
                                            padding: '10px 16px',
                                            borderRadius: 10,
                                            border: '2px solid #debc7c',
                                            background: '#1c5b47',
                                            color: '#f2fff8',
                                            fontWeight: 600,
                                            fontSize: 14,
                                            display: 'inline-block'
                                          }}
                                        >
                                          Termin vereinbaren
                                        </Link>
                                      </div>
                                    )}
                                    {item.type === 'availability_shared' && (
                                      <div style={{ display: 'flex', gap: 10, marginTop: 12 }}>
                                        <Link
                                          to={`/matches/${item.matchId}`}
                                          onClick={handleNavigate}
                                          style={{
                                            textDecoration: 'none',
                                            textAlign: 'center',
                                            padding: '10px 16px',
                                            borderRadius: 10,
                                            border: '2px solid #debc7c',
                                            background: '#1c5b47',
                                            color: '#f2fff8',
                                            fontWeight: 600,
                                            fontSize: 14,
                                            display: 'inline-block'
                                          }}
                                        >
                                          Termin vereinbaren
                                        </Link>
                                      </div>
                                    )}
                                    {(item.type === 'schedule_accepted' || item.type === 'schedule_rejected') && (
                                      <div style={{ display: 'flex', gap: 10, marginTop: 12 }}>
                                        <Link
                                          to={`/matches/${item.matchId}`}
                                          onClick={handleNavigate}
                                          style={{
                                            textDecoration: 'none',
                                            textAlign: 'center',
                                            padding: '10px 16px',
                                            borderRadius: 10,
                                            border: '2px solid #debc7c',
                                            background: '#1c5b47',
                                            color: '#f2fff8',
                                            fontWeight: 600,
                                            fontSize: 14,
                                            display: 'inline-block'
                                          }}
                                        >
                                          Zum Match
                                        </Link>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              ) : (
                                <>
                                  <div className="ml-popover__itemRow">
                                    <div className="ml-popover__itemTitle">{item.title}</div>
                                  </div>
                                  <div className="ml-popover__itemMeta">
                                    {formatShortTimestamp(item.timestamp)}
                                    {item.leagueName ? ` · ${item.leagueName}` : ""}
                                    {item.sportName ? ` · ${item.sportName}` : ""}
                                  </div>
                                  {item.details && (
                                    <div className="ml-popover__itemText">{truncate(item.details, 180)}</div>
                                  )}
                                  {item.matchId ? (
                                    <Link
                                      to={`/matches/${item.matchId}`}
                                      className="ml-popover__itemLink"
                                      onClick={handleNavigate}
                                    >
                                      Zum Match
                                    </Link>
                                  ) : null}
                                </>
                              )}
                            </li>
                          );
                        })}
                      </ul>
                    ) : (
                      <div className="ml-popover__empty">Keine Neuigkeiten vorhanden.</div>
                    )}
                    {/* debug hidden as requested */}
                  </div>
                </div>
              )}
            </div>

            <div className="ml-actionWrap">
              <button
                type="button"
                className={`ml-action${chatsOpen ? " is-active" : ""}${chatHasUnread ? " has-unread" : ""}`}
                aria-label="Nachrichten"
                title="Nachrichten"
                onClick={handleToggleChats}
              >
                <span className="ml-action__icon" aria-hidden="true">
                  <svg width="20" height="20" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" className="ml-icon ml-icon--chat">
                    <path d="M4 6C4 4.89543 4.89543 4 6 4H18C19.1046 4 20 4.89543 20 6V14C20 15.1046 19.1046 16 18 16H11.5L7 19.5V16H6C4.89543 16 4 15.1046 4 14V6Z" fill="none" stroke="currentColor" />
                  </svg>
                </span>
                {badgeValue(unreadChatsCount) && (
                  <span className="ml-action__badge">{badgeValue(unreadChatsCount)}</span>
                )}
              </button>
              {chatsOpen && (
                <div className="ml-popover" role="dialog" aria-label="Nachrichten">
                  <div className="ml-popover__header">
                    <div className="ml-popover__title">Nachrichten</div>
                    <div className="ml-popover__headerActions">
                      <Link to="/chats" className="ml-popover__link" onClick={handleNavigate}>Alle Chats</Link>
                    </div>
                  </div>
                  <div className="ml-popover__body">
                    {chatsLoading ? (
                      <div className="ml-popover__status">Lade Chats …</div>
                    ) : chatsError ? (
                      <div className="ml-popover__error">{chatsError}</div>
                    ) : latestChats.length ? (
                      <ul className="ml-popover__list">
                        {latestChats.map((chat) => {
                          const href = chat.type === "direct"
                            ? `/chat/user/${chat.opponentUserId}`
                            : `/matches/${chat.matchId}/chat`;
                          const name = chat.opponentName || chat.leagueName || (chat.matchId ? `Match ${chat.matchId}` : "Chat");
                          const preview = chat.lastMessage?.body || "Noch keine Nachrichten.";
                          const ts = chat.lastActivityAt || chat.lastMessage?.createdAt;
                          const typeLabel = chat.type === "direct" ? "Privater Chat" : "Match-Chat";
                          return (
                            <li key={`${chat.type}-${chat.type === "direct" ? chat.chatId : chat.matchId}`} className={`ml-popover__item ml-popover__item--link${chat.unread ? ' ml-popover__item--unread' : ''}`}>
                              <Link to={href} onClick={handleNavigate}>
                                <div className="ml-popover__itemLinkBody">
                                  <div className="ml-popover__avatar">
                                    <Avatar 
                                      userId={chat.opponentUserId} 
                                      name={name} 
                                      src={chat.opponentAvatar} 
                                      size={40} 
                                    />
                                  </div>
                                  <div className="ml-popover__itemContent">
                                    <div className="ml-popover__itemRow">
                                      <div className="ml-popover__itemTitle">{name}</div>
                                      {chat.unread ? <span className="ml-popover__pill">Neu</span> : null}
                                    </div>
                                    <div className="ml-popover__itemMeta">{typeLabel} · {formatShortTimestamp(ts)}</div>
                                    <div className="ml-popover__itemText">{truncate(preview, 160)}</div>
                                  </div>
                                </div>
                              </Link>
                            </li>
                          );
                        })}
                      </ul>
                    ) : (
                      <div className="ml-popover__empty">Keine Chats vorhanden.</div>
                    )}
                    {/* debug hidden as requested */}
                  </div>
                </div>
              )}
            </div>
          </>
        )}

        {token && (
          <button
            className={"ml-burger" + (open ? " is-open" : "")}
            onClick={() => setOpen((v) => {
              const next = !v;
              if (next) {
                setNotificationsOpen(false);
                setChatsOpen(false);
              }
              return next;
            })}
            aria-label="Menü"
          >
            <span />
            <span />
            <span />
          </button>
        )}
      </div>
      </div>
    </header>
  );
}

