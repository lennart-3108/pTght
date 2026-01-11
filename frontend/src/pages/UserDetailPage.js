import React, { useEffect, useMemo, useState, useRef } from "react";
import { Link, useParams } from "react-router-dom";
import { API_BASE } from "../config";
import Avatar from "../components/Avatar";
import { useResponsive } from "../hooks/useResponsive";
import AvatarEditor from "react-avatar-editor";

// Responsive page styling function (now dynamic)
const getPageStyle = (isMobile) => ({
  minHeight: "100vh",
  background: "radial-gradient(circle at top, rgba(26,73,59,0.45), rgba(4,17,14,0.95) 55%)",
  padding: isMobile ? "12px 8px" : "32px min(6vw, 64px)",
  color: "#e8efe8",
  fontFamily: "Inter, system-ui, sans-serif"
});

// Responsive card styling functions
const getBaseCard = (isMobile) => ({
  background: "linear-gradient(135deg, rgba(9,26,21,0.92), rgba(18,44,37,0.92))",
  borderRadius: isMobile ? 12 : 24,
  boxShadow: isMobile ? "0 8px 24px rgba(0,0,0,0.3)" : "0 24px 60px rgba(0,0,0,0.45)",
  overflow: "hidden",
  position: "relative"
});

const getBodyCard = (isMobile) => ({
  ...getBaseCard(isMobile),
  padding: isMobile ? "16px" : "28px"
});

function formatDateTime(value) {
  if (!value) return "Termin tbd";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "Termin tbd";
  return d.toLocaleString("de-DE", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function firstValueOr(array, fallback) {
  return Array.isArray(array) && array.length ? array[0] : fallback;
}

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

function formatShortDate(value) {
  if (!value) return "-";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "2-digit" });
}

function nextMatchTimeFromList(list) {
  if (!Array.isArray(list) || !list.length) return null;
  const candidate = list.find((item) => item && item.kickoff_at) || list[0];
  if (!candidate) return null;
  const dt = candidate.kickoff_at ? new Date(candidate.kickoff_at) : null;
  if (!dt || Number.isNaN(dt.getTime())) {
    return { time: "—", date: "—" };
  }
  return {
    time: dt.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" }),
    date: formatShortDate(candidate.kickoff_at)
  };
}

function analyzeGame(game, myId, displayName) {
  const hs = Number(game.home_score);
  const as = Number(game.away_score);
  const homeId = Number(game.home_user_id);
  const awayId = Number(game.away_user_id);
  let isHome = Number.isFinite(homeId) && homeId === myId;
  let isAway = Number.isFinite(awayId) && awayId === myId;

  const myLower = (displayName || "").toLowerCase();
  if (!isHome && !isAway && myLower) {
    const homeLower = String(game.home || "").toLowerCase();
    const awayLower = String(game.away || "").toLowerCase();
    if (homeLower.includes(myLower)) isHome = true;
    if (awayLower.includes(myLower)) isAway = true;
  }

  let opponentId = null;
  let opponentName = "Gegner unbekannt";
  if (isHome) {
    opponentId = Number.isFinite(awayId) ? awayId : null;
    opponentName = game.away || opponentName;
  } else if (isAway) {
    opponentId = Number.isFinite(homeId) ? homeId : null;
    opponentName = game.home || opponentName;
  } else {
    opponentName = [game.home, game.away].filter(Boolean).join(" vs ") || opponentName;
  }

  let outcome = null;
  if (Number.isFinite(hs) && Number.isFinite(as)) {
    if (isHome) outcome = hs > as ? "W" : hs < as ? "L" : "D";
    else if (isAway) outcome = as > hs ? "W" : as < hs ? "L" : "D";
    else outcome = hs === as ? "D" : null;
  }

  return {
    isHome,
    isAway,
    opponentId,
    opponentName,
    outcome,
    scoreText: Number.isFinite(hs) && Number.isFinite(as) ? `${hs}:${as}` : "vs"
  };
}

function calculateStats(completed, myId, displayName) {
  let wins = 0;
  let draws = 0;
  let losses = 0;
  let goalsFor = 0;
  let goalsAgainst = 0;
  let longestWinStreak = 0;
  let currentWinStreak = 0;

  const sorted = [...completed].sort((a, b) => (a.ts || 0) - (b.ts || 0));
  for (const game of sorted) {
    const hs = Number(game.home_score);
    const as = Number(game.away_score);
    if (!Number.isFinite(hs) || !Number.isFinite(as)) continue;
    const analysis = analyzeGame(game, myId, displayName);
    if (analysis.isHome) {
      goalsFor += hs;
      goalsAgainst += as;
    } else if (analysis.isAway) {
      goalsFor += as;
      goalsAgainst += hs;
    }

    if (analysis.outcome === "W") {
      wins += 1;
      currentWinStreak += 1;
      longestWinStreak = Math.max(longestWinStreak, currentWinStreak);
    } else {
      if (analysis.outcome === "D") draws += 1;
      if (analysis.outcome === "L") losses += 1;
      currentWinStreak = 0;
    }
  }

  const matches = completed.length;
  const winRate = matches ? Math.round((wins / matches) * 100) : 0;
  return {
    wins,
    draws,
    losses,
    matches,
    goalsFor,
    goalsAgainst,
    winRate,
    longestWinStreak
  };
}

function extractOpponents(games, myId, displayName) {
  const map = new Map();
  games.forEach((game) => {
    const { opponentId, opponentName } = analyzeGame(game, myId, displayName);
    const key = opponentId ? String(opponentId) : opponentName;
    const prev = map.get(key) || { id: opponentId, name: opponentName, matches: 0 };
    prev.matches += 1;
    map.set(key, prev);
  });
  return Array.from(map.values()).sort((a, b) => b.matches - a.matches).slice(0, 4);
}

export default function UserDetailPage() {
  const { id } = useParams();
  const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
  const viewerId = useMemo(() => extractUserIdFromToken(token), [token]);
  
  // Dynamic responsive hook
  const isMobile = useResponsive(768);

  const [user, setUser] = useState(null);
  const [leagues, setLeagues] = useState([]);
  const [games, setGames] = useState({ upcoming: [], completed: [] });
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [activeLeagueId, setActiveLeagueId] = useState(null);
  const [standings, setStandings] = useState([]);
  const [standingsLoading, setStandingsLoading] = useState(false);
  const [standingsErr, setStandingsErr] = useState("");
  const [friends, setFriends] = useState([]);
  const [mutualFriends, setMutualFriends] = useState([]);
  const [friendship, setFriendship] = useState({ status: token ? "loading" : "none", pendingDirection: null });
  const [friendActionMsg, setFriendActionMsg] = useState("");
  const [friendActionError, setFriendActionError] = useState("");
  const [friendActionBusy, setFriendActionBusy] = useState(false);
  const [socialRefreshKey, setSocialRefreshKey] = useState(0);
  const [toggleBusy, setToggleBusy] = useState(false);
  const [feedFilters, setFeedFilters] = useState({ friends: true, team: true, public: true });
  const [activeFeedCategory, setActiveFeedCategory] = useState("all"); // "all", "matches", "friends", "public"
  const [showAvatarViewer, setShowAvatarViewer] = useState(false);
  const [showAvatarUpload, setShowAvatarUpload] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [avatarComments, setAvatarComments] = useState([]);
  const [avatarLikes, setAvatarLikes] = useState(0);
  const [avatarLiked, setAvatarLiked] = useState(false);
  const [newComment, setNewComment] = useState("");
  const [avatarImage, setAvatarImage] = useState(null);
  const [avatarScale, setAvatarScale] = useState(1);
  const editorRef = useRef(null);

  const isOwnProfile = user && Number(user.id) === Number(viewerId);

  const triggerSocialRefresh = () => setSocialRefreshKey((key) => key + 1);

  const handleFriendAction = async () => {
    if (!user) return;
    if (isOwnProfile) return;
    if (!token) {
      setFriendActionError("Bitte melde dich an, um Freundschaften zu verwalten.");
      return;
    }

    const removing = friendship.status === "accepted";
    setFriendActionBusy(true);
    setFriendActionError("");
    try {
      const url = `${API_BASE}/users/${user.id}/friendships`;
      const res = await fetch(url, {
        method: removing ? "DELETE" : "POST",
        headers: removing
          ? { Authorization: `Bearer ${token}` }
          : {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`
            },
        body: removing ? undefined : "{}"
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Aktion fehlgeschlagen.");

      if (removing) {
        setFriendship({ status: "none", pendingDirection: null });
        setFriendActionMsg(data.message || "Freundschaft beendet.");
      } else {
        setFriendship({ status: data.status || "pending", pendingDirection: data.pendingDirection || null });
        setFriendActionMsg(
          data.message || ((data.status || "pending") === "accepted" ? "Freundschaft bestätigt." : "Freundschaftsanfrage gesendet.")
        );
      }
      triggerSocialRefresh();
    } catch (e) {
      setFriendActionError(e.message || "Aktion fehlgeschlagen.");
    } finally {
      setFriendActionBusy(false);
    }
  };

  const handleToggleMatchRequests = async () => {
    if (!user || !isOwnProfile) return;
    if (!token) {
      setFriendActionError("Bitte melde dich an, um deine Match-Anfragen zu verwalten.");
      return;
    }
    const next = !user.open_for_matches;
    setToggleBusy(true);
    try {
      const res = await fetch(`${API_BASE}/profile`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ open_for_matches: next })
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Speichern fehlgeschlagen.");
      }
      setUser((prev) => (prev ? { ...prev, open_for_matches: next } : prev));
      setFriendActionMsg(next ? "Match-Anfragen aktiviert." : "Match-Anfragen deaktiviert.");
    } catch (e) {
      setFriendActionError(e.message || "Speichern fehlgeschlagen.");
    } finally {
      setToggleBusy(false);
    }
  };

  useEffect(() => {
    let mounted = true;
    if (!id) {
      setErr("Ungültige Benutzer-ID.");
      setLoading(false);
      return () => {};
    }

    (async () => {
      try {
        setLoading(true);
        setErr("");
        const headers = token ? { Authorization: `Bearer ${token}` } : {};
        const [userRes, leaguesRes, gamesRes] = await Promise.all([
          fetch(`${API_BASE}/users/${id}`, { headers }),
          fetch(`${API_BASE}/users/${id}/leagues`, { headers }),
          fetch(`${API_BASE}/users/${id}/games`, { headers })
        ]);

        if (!userRes.ok) throw new Error(`HTTP ${userRes.status}: Nutzer nicht gefunden`);
        const userData = await userRes.json();
        const leaguesData = leaguesRes.ok ? await leaguesRes.json() : [];
        const gamesData = gamesRes.ok ? await gamesRes.json() : { upcoming: [], completed: [] };

        if (!mounted) return;
        setUser(userData);
        setLeagues(Array.isArray(leaguesData) ? leaguesData : []);
        if (Array.isArray(gamesData.upcoming) && Array.isArray(gamesData.completed)) {
          setGames({ upcoming: gamesData.upcoming, completed: gamesData.completed });
        } else if (Array.isArray(gamesData)) {
          const upcoming = gamesData.filter((g) => g.home_score == null && g.away_score == null);
          const completed = gamesData.filter((g) => g.home_score != null && g.away_score != null);
          setGames({ upcoming, completed });
        } else {
          setGames({ upcoming: [], completed: [] });
        }

        const primary = firstValueOr(Array.isArray(leaguesData) ? leaguesData : [], null);
        setActiveLeagueId(primary?.id || null);
      } catch (e) {
        if (mounted) setErr(e.message || "Fehler beim Laden der Benutzerdaten.");
      } finally {
        if (mounted) setLoading(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, [id, token]);

  useEffect(() => {
    let cancelled = false;
    const targetId = Number(id);
    if (!Number.isFinite(targetId)) return undefined;

    async function loadSocial() {
      setFriendActionMsg("");
      setFriendActionError("");
      try {
        const res = await fetch(`${API_BASE}/users/${targetId}/friends`);
        if (!cancelled) {
          if (res.ok) {
            const data = await res.json().catch(() => []);
            setFriends(Array.isArray(data) ? data : []);
          } else {
            setFriends([]);
          }
        }
      } catch {
        if (!cancelled) setFriends([]);
      }

      if (token && Number.isFinite(viewerId) && viewerId !== targetId) {
        try {
          const statusRes = await fetch(`${API_BASE}/users/${targetId}/friendship-status`, {
            headers: { Authorization: `Bearer ${token}` }
          });
          if (!cancelled) {
            if (statusRes.ok) {
              const statusData = await statusRes.json().catch(() => ({}));
              setFriendship({
                status: statusData.status || 'none',
                pendingDirection: statusData.pendingDirection || null
              });
            } else {
              setFriendship({ status: 'none', pendingDirection: null });
            }
          }
        } catch {
          if (!cancelled) setFriendship({ status: 'none', pendingDirection: null });
        }

        try {
          const mutualRes = await fetch(`${API_BASE}/users/${targetId}/mutual-friends`, {
            headers: { Authorization: `Bearer ${token}` }
          });
          if (!cancelled) {
            if (mutualRes.ok) {
              const mf = await mutualRes.json().catch(() => []);
              setMutualFriends(Array.isArray(mf) ? mf : []);
            } else {
              setMutualFriends([]);
            }
          }
        } catch {
          if (!cancelled) setMutualFriends([]);
        }
      } else {
        if (!cancelled) {
          setMutualFriends([]);
          if (Number.isFinite(viewerId) && viewerId === targetId) {
            setFriendship({ status: 'self', pendingDirection: null });
          } else {
            setFriendship(prev => prev.status === 'loading' ? { status: 'none', pendingDirection: null } : prev);
          }
        }
      }
    }

    loadSocial();
    return () => { cancelled = true; };
  }, [id, token, viewerId, socialRefreshKey]);

  useEffect(() => {
    let mounted = true;
    if (!activeLeagueId) {
      setStandings([]);
      return () => {};
    }

    (async () => {
      try {
        setStandingsLoading(true);
        setStandingsErr("");
        const res = await fetch(`${API_BASE}/leagues/${activeLeagueId}/standings?format=table`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (mounted) setStandings(Array.isArray(data) ? data : []);
      } catch (e) {
        if (mounted) {
          setStandingsErr(e.message || "Standings konnten nicht geladen werden.");
          setStandings([]);
        }
      } finally {
        if (mounted) setStandingsLoading(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, [activeLeagueId]);

  // Load avatar likes and comments when viewer is opened
  useEffect(() => {
    if (!showAvatarViewer || !user) return;
    
    let mounted = true;
    
    (async () => {
      try {
        const headers = token ? { Authorization: `Bearer ${token}` } : {};
        
        // Load likes
        const likesRes = await fetch(`${API_BASE}/users/${user.id}/avatar/likes`, { headers });
        if (likesRes.ok && mounted) {
          const likesData = await likesRes.json();
          setAvatarLikes(likesData.count || 0);
          setAvatarLiked(likesData.userLiked || false);
        }
        
        // Load comments
        const commentsRes = await fetch(`${API_BASE}/users/${user.id}/avatar/comments`, { headers });
        if (commentsRes.ok && mounted) {
          const commentsData = await commentsRes.json();
          setAvatarComments(Array.isArray(commentsData) ? commentsData : []);
        }
      } catch (err) {
        console.error('Error loading avatar data:', err);
      }
    })();
    
    return () => { mounted = false; };
  }, [showAvatarViewer, user, token]);

  const displayName = useMemo(() => {
    if (!user) return "";
    const name = `${user.firstname || ""} ${user.lastname || ""}`.trim();
    return name || user.email || `User ${user.id}`;
  }, [user]);

  const primaryCity = useMemo(() => {
    const counts = new Map();
    leagues.forEach((l) => {
      if (!l.city) return;
      const key = l.city.trim();
      counts.set(key, (counts.get(key) || 0) + 1);
    });
    if (!counts.size) return null;
    return Array.from(counts.entries()).sort((a, b) => b[1] - a[1])[0][0];
  }, [leagues]);

  const sportsChips = useMemo(() => {
    if (!user?.sports?.length) return [];
    return user.sports.map((s) => s.name || s.id).filter(Boolean);
  }, [user]);

  const stats = useMemo(() => {
    if (!user) return { wins: 0, draws: 0, losses: 0, matches: 0, winRate: 0, goalsFor: 0, goalsAgainst: 0, longestWinStreak: 0 };
    
    // Filter games by active league if one is selected
    let filteredGames = games.completed || [];
    if (activeLeagueId) {
      filteredGames = filteredGames.filter(game => 
        game.league_id === activeLeagueId || game.leagueId === activeLeagueId
      );
    }
    
    return calculateStats(filteredGames, Number(user.id), displayName);
  }, [games.completed, user, displayName, activeLeagueId]);

  const opponents = useMemo(() => {
    if (!user) return [];
    return extractOpponents(games.completed || [], Number(user.id), displayName);
  }, [games.completed, user, displayName]);

  const rankingEntry = useMemo(() => {
    if (!user || !standings.length) return null;
    const byKey = standings.find((row) => String(row.key || "").includes(`u:${user.id}`));
    if (byKey) return byKey;
    
    // Only use name-based fallback if the user key exists in standings but key format is different
    // This prevents showing wrong user data when current user is not in the league standings
    const exactKeyMatch = standings.find((row) => row.key === `u:${user.id}`);
    if (exactKeyMatch) return exactKeyMatch;
    
    return null; // Don't fallback to name matching to prevent showing wrong user data
  }, [standings, user, displayName]);

  const leaderboardSummary = useMemo(() => {
    if (!rankingEntry || !standings.length) return null;
    const total = standings.length;
    const pct = rankingEntry.rank ? Math.round((rankingEntry.rank / total) * 100) : null;
    if (rankingEntry.rank === 1) return `Spitzenreiter der Liga (#1 von ${total})`;
    if (pct && pct <= 20) return `Top ${pct}% der Liga`;
    return `Platz ${rankingEntry.rank} von ${total}`;
  }, [rankingEntry, standings.length]);

  const placementValue = rankingEntry ? `#${rankingEntry.rank}` : "-";
  const placementSubtitle = rankingEntry
    ? (standings.length ? `von ${standings.length}` : "Aktuelle Liga")
    : "Noch keine Tabelle";

  const earliestJoined = useMemo(() => {
    const joinedDates = leagues
      .map((l) => (l.joined_at ? Date.parse(l.joined_at) : null))
      .filter((ts) => Number.isFinite(ts));
    if (joinedDates.length) {
      const min = new Date(Math.min(...joinedDates));
      return `Aktiv seit ${min.toLocaleDateString("de-DE", { month: "long", year: "numeric" })}`;
    }
    const completed = (games.completed || []).map((g) => g.ts).filter((ts) => Number.isFinite(ts));
    if (completed.length) {
      const min = new Date(Math.min(...completed));
      return `Aktiv seit ${min.toLocaleDateString("de-DE", { year: "numeric" })}`;
    }
    return null;
  }, [leagues, games.completed]);

  const numericUserId = user ? Number(user.id) : null;

  const upcomingSlice = useMemo(() => (games.upcoming || []).slice(0, 5), [games.upcoming]);
  const lastMatches = useMemo(() => {
    return [...(games.completed || [])]
      .sort((a, b) => (b.ts || 0) - (a.ts || 0))
      .slice(0, 5)
      .map((game) => ({
        ...game,
        analysis: analyzeGame(game, numericUserId, displayName)
      }));
  }, [games.completed, numericUserId, displayName]);
  
  const lastThreeMatches = useMemo(() => lastMatches.slice(0, 3), [lastMatches]);

  const standingsWindow = useMemo(() => {
    if (!standings.length) return [];
    if (!rankingEntry) return standings.slice(0, Math.min(5, standings.length));
    const idx = standings.findIndex((row) => row === rankingEntry);
    if (idx === -1) return standings.slice(0, Math.min(5, standings.length));
    const start = Math.max(0, idx - 2);
    return standings.slice(start, Math.min(start + 5, standings.length));
  }, [standings, rankingEntry]);

  const nextMatch = nextMatchTimeFromList(upcomingSlice);
  const nextMatchTimeText = nextMatch?.time || "—";
  const nextMatchDateText = nextMatch?.date || "—";
  const record = `${stats.wins}-${stats.draws}-${stats.losses}`;

  const heroMetrics = [
    { label: "Spiele", value: stats.matches || 0, detail: "Gesamt" },
    { label: "Winrate", value: stats.matches ? `${stats.winRate}%` : "—", detail: `Bilanz ${record}` },
    { label: "Nächstes Match", value: nextMatchTimeText, detail: nextMatchDateText },
    { label: "Serie", value: stats.longestWinStreak ? `${stats.longestWinStreak} Siege` : "—", detail: "Beste Serie" }
  ];

  // Form calculation - last 5 matches
  const formLetters = useMemo(() => {
    return lastMatches.slice(0, 5).map(game => {
      const outcome = game.analysis?.outcome;
      return {
        letter: outcome || "?",
        color: outcome === "W" ? "#22c55e" : outcome === "L" ? "#ef4444" : outcome === "D" ? "#f59e0b" : "#6b7280"
      };
    });
  }, [lastMatches]);

  const feedData = useMemo(() => {
    const friendFeed = (lastMatches || []).map((game) => {
      const outcome = game.analysis?.outcome;
      const title = outcome === "W"
        ? `Sieg gegen ${game.analysis?.opponentName || "Gegner"}`
        : outcome === "L"
        ? `Niederlage gegen ${game.analysis?.opponentName || "Gegner"}`
        : `Remis gegen ${game.analysis?.opponentName || "Gegner"}`;
      return {
        id: `match-${game.id}`,
        title,
        subtitle: `${formatShortDate(game.kickoff_at)} • ${game.analysis?.scoreText || "?"}`,
        timestamp: game.kickoff_at || null
      };
    });

    const teamFeed = (leagues || []).map((league) => ({
      id: `league-${league.id}`,
      title: league.name,
      subtitle: league.joined_at
        ? `Mitglied seit ${formatShortDate(league.joined_at)}`
        : [league.city, league.sport].filter(Boolean).join(" · ") || "Liga-Mitglied",
      timestamp: league.joined_at || null
    }));

    const publicFeed = (upcomingSlice || []).map((game) => ({
      id: `upcoming-${game.id}`,
      title: `Anstehendes Match gegen ${game.away || game.analysis?.opponentName || "Opponent"}`,
      subtitle: `${formatDateTime(game.kickoff_at)} • ${game.league || "Match"}`,
      timestamp: game.kickoff_at || null
    }));

    return {
      friends: friendFeed,
      team: teamFeed,
      public: publicFeed
    };
  }, [lastMatches, leagues, upcomingSlice]);

  if (loading) return <div style={{ padding: 24 }}>Lade Profil …</div>;
  if (err) return <div style={{ padding: 24, color: "crimson" }}>Fehler: {err}</div>;
  if (!user) return <div style={{ padding: 24 }}>Benutzer nicht gefunden.</div>;

  const heroBadges = [leaderboardSummary, earliestJoined].filter(Boolean);
  const matchAvailability = stats.matches > 0 ? stats.matches < 5 ? "Trau dich – offen für Matches" : "Match-Anfragen willkommen" : "Neu in der Liga";

  const heroTiles = [
    { title: "Tabellenplatz", value: placementValue, subtitle: placementSubtitle },
    { title: "Bilanz", value: `${stats.wins}-${stats.draws}-${stats.losses}`, subtitle: "S-U-N" }
  ];

  return (
    <div style={getPageStyle(isMobile)}>
      {/* Hero Section - Kompakter und strukturierter */}
      <section style={{ ...getBaseCard(isMobile), padding: isMobile ? "16px" : "24px", marginBottom: isMobile ? 16 : 24 }}>
        <div style={{ position: "absolute", inset: 0, background: "radial-gradient(circle at 20% 20%, rgba(31,94,74,0.35), transparent 60%)" }} />
        <div style={{ position: "relative", display: "grid", gridTemplateColumns: isMobile ? "1fr" : "auto 1fr auto", gap: isMobile ? 16 : 32, alignItems: "center" }}>
          
          {/* Avatar & Sports */}
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 16 }}>
            <div style={{ position: "relative" }}>
              <div
                onClick={() => setShowAvatarViewer(true)}
                style={{ cursor: "pointer" }}
              >
                <Avatar 
                  userId={user.id} 
                  name={displayName} 
                  size={isMobile ? 80 : 120} 
                  style={{ 
                    border: isMobile ? "2px solid rgba(88,204,171,0.45)" : "3px solid rgba(88,204,171,0.45)", 
                    boxShadow: isMobile ? "0 6px 16px rgba(9,23,17,0.6)" : "0 12px 32px rgba(9,23,17,0.6)" 
                  }} 
                />
              </div>
              {isOwnProfile && (
                <button
                  onClick={() => setShowAvatarUpload(true)}
                  style={{
                    position: "absolute",
                    bottom: 0,
                    right: 0,
                    width: isMobile ? 28 : 36,
                    height: isMobile ? 28 : 36,
                    borderRadius: "50%",
                    background: "linear-gradient(135deg, rgba(92,200,165,0.95), rgba(72,201,169,0.95))",
                    border: "2px solid rgba(9,26,21,0.9)",
                    color: "#0a1a15",
                    fontSize: isMobile ? 18 : 22,
                    fontWeight: "bold",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    boxShadow: "0 4px 12px rgba(0,0,0,0.4)",
                    transition: "transform 0.2s ease",
                    padding: 0,
                    lineHeight: 1
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.transform = "scale(1.1)"}
                  onMouseLeave={(e) => e.currentTarget.style.transform = "scale(1)"}
                  title="Neues Profilbild hochladen"
                >
                  +
                </button>
              )}
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, justifyContent: "center", maxWidth: 160 }}>
              {sportsChips.length ? sportsChips.map((chip) => (
                <span key={chip} style={{ 
                  padding: "6px 10px", 
                  borderRadius: 12, 
                  border: "1px solid rgba(92,200,165,0.4)", 
                  background: "rgba(16,60,46,0.8)", 
                  fontSize: 12,
                  fontWeight: 500
                }}>{chip}</span>
              )) : (
                <span style={{ 
                  padding: "6px 10px", 
                  borderRadius: 12, 
                  background: "rgba(14,44,34,0.7)", 
                  border: "1px solid rgba(92,200,165,0.2)", 
                  fontSize: 12 
                }}>Allrounder</span>
              )}
            </div>
            
            {/* Abzeichen Widget */}
            <div style={{ display: "flex", flexWrap: "wrap", gap: 4, justifyContent: "center", maxWidth: 160 }}>
              {/* Community League Gold Medaille */}
              {leagues.some(league => league.name?.toLowerCase().includes('community')) && rankingEntry?.rank === 1 && (
                <div style={{ 
                  display: "flex", 
                  alignItems: "center", 
                  gap: 4, 
                  padding: "4px 8px", 
                  borderRadius: 10, 
                  background: "linear-gradient(135deg, rgba(255,215,0,0.2), rgba(218,165,32,0.15))", 
                  border: "1px solid rgba(255,215,0,0.4)",
                  fontSize: 11,
                  fontWeight: 600,
                  color: "#ffd700"
                }}>
                  <span>🏆</span>
                  <span>Community Gold</span>
                </div>
              )}
              
              {/* Liga-Sieger Abzeichen */}
              {rankingEntry?.rank === 1 && (
                <div style={{ 
                  display: "flex", 
                  alignItems: "center", 
                  gap: 3, 
                  padding: "4px 8px", 
                  borderRadius: 10, 
                  background: "linear-gradient(135deg, rgba(127,217,186,0.25), rgba(72,201,169,0.15))", 
                  border: "1px solid rgba(127,217,186,0.5)",
                  fontSize: 11,
                  fontWeight: 600,
                  color: "#7fd9ba"
                }}>
                  <span>👑</span>
                  <span>Liga-Leader</span>
                </div>
              )}
              
              {/* Veteran Abzeichen (mehr als 10 Spiele) */}
              {stats.matches >= 10 && (
                <div style={{ 
                  display: "flex", 
                  alignItems: "center", 
                  gap: 3, 
                  padding: "4px 8px", 
                  borderRadius: 10, 
                  background: "linear-gradient(135deg, rgba(138,43,226,0.2), rgba(75,0,130,0.15))", 
                  border: "1px solid rgba(138,43,226,0.4)",
                  fontSize: 11,
                  fontWeight: 600,
                  color: "#ba55d3"
                }}>
                  <span>⭐</span>
                  <span>Veteran</span>
                </div>
              )}
              
              {/* High-Win-Rate Abzeichen (über 70%) */}
              {stats.matches >= 5 && stats.winRate >= 70 && (
                <div style={{ 
                  display: "flex", 
                  alignItems: "center", 
                  gap: 3, 
                  padding: "4px 8px", 
                  borderRadius: 10, 
                  background: "linear-gradient(135deg, rgba(255,140,0,0.2), rgba(255,69,0,0.15))", 
                  border: "1px solid rgba(255,140,0,0.4)",
                  fontSize: 11,
                  fontWeight: 600,
                  color: "#ff8c00"
                }}>
                  <span>🔥</span>
                  <span>Hot Streak</span>
                </div>
              )}
              
              {/* Neuling Abzeichen */}
              {stats.matches <= 2 && (
                <div style={{ 
                  display: "flex", 
                  alignItems: "center", 
                  gap: 3, 
                  padding: "4px 8px", 
                  borderRadius: 10, 
                  background: "linear-gradient(135deg, rgba(50,205,50,0.2), rgba(34,139,34,0.15))", 
                  border: "1px solid rgba(50,205,50,0.4)",
                  fontSize: 11,
                  fontWeight: 600,
                  color: "#32cd32"
                }}>
                  <span>🌱</span>
                  <span>Newcomer</span>
                </div>
              )}
            </div>
          </div>

          {/* Main Info */}
          <div style={{ display: "flex", flexDirection: "column", gap: isMobile ? 12 : 20, minWidth: 0 }}>
            <div>
              <div style={{ fontSize: isMobile ? 24 : 32, fontWeight: 900, letterSpacing: 0.2 }}>{displayName}</div>
              <div style={{ marginTop: 4, fontSize: 14, color: "#a9cabd" }}>
                {primaryCity ? `${primaryCity}, Germany` : "Ort unbekannt"}
              </div>
              {heroBadges.length > 0 && (
                <div style={{ marginTop: 12, display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {heroBadges.map((badge) => (
                    <span key={badge} style={{ 
                      padding: "6px 12px", 
                      borderRadius: 16, 
                      border: "1px solid rgba(120,216,177,0.6)", 
                      background: "rgba(12,39,31,0.65)", 
                      color: "#c0f0dc", 
                      fontSize: 12,
                      fontWeight: 500
                    }}>{badge}</span>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Action Buttons */}
          <div style={{ display: "flex", flexDirection: "column", gap: isMobile ? 8 : 10, minWidth: isMobile ? "100%" : 180 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
              <span style={{ width: 8, height: 8, borderRadius: 999, background: "#5ccd9b", boxShadow: "0 0 8px #5ccd9b" }} />
              <span style={{ fontSize: 12, color: "#bfead4" }}>{matchAvailability}</span>
            </div>
            
            {isOwnProfile ? (
              <>
                <button
                  onClick={handleToggleMatchRequests}
                  disabled={toggleBusy}
                  style={{
                    fontWeight: 600,
                    background: user.open_for_matches 
                      ? "linear-gradient(135deg,#48c9a9,#2f9c7a)" 
                      : "rgba(10,33,27,0.85)",
                    border: user.open_for_matches 
                      ? "none" 
                      : "1px solid rgba(90,203,165,0.45)",
                    color: user.open_for_matches ? "#07271f" : "#7be0bb",
                    padding: isMobile ? "8px 12px" : "10px 16px",
                    borderRadius: isMobile ? 10 : 12,
                    fontSize: isMobile ? 12 : 13,
                    cursor: toggleBusy ? "wait" : "pointer",
                    opacity: toggleBusy ? 0.6 : 1
                  }}
                >
                  {toggleBusy ? "..." : (user.open_for_matches ? "Match-Anfragen deaktivieren" : "Match-Anfragen aktivieren")}
                </button>
                <Link
                  to="/profile/edit"
                  style={{ 
                    textDecoration: "none", 
                    fontWeight: 600, 
                    background: "rgba(10,33,27,0.85)", 
                    border: "1px solid rgba(90,203,165,0.45)", 
                    color: "#7be0bb", 
                    padding: "9px 16px", 
                    borderRadius: 12, 
                    textAlign: "center",
                    fontSize: 13
                  }}
                >
                  Profil bearbeiten
                </Link>
              </>
            ) : (
              <>
                <Link
                  to={`/chat/user/${user.id}`}
                  style={{
                    textDecoration: "none",
                    fontWeight: 600,
                    background: "linear-gradient(135deg,#48c9a9,#2f9c7a)",
                    color: "#07271f",
                    padding: "10px 16px",
                    borderRadius: 12,
                    textAlign: "center",
                    fontSize: 13
                  }}
                >
                  Match anfragen
                </Link>
                
                {/* Freund hinzufügen Button */}
                {friendship.status === "accepted" && (
                  <button
                    onClick={handleFriendAction}
                    disabled={friendActionBusy}
                    style={{
                      background: "rgba(220,90,90,0.8)",
                      border: "1px solid rgba(220,90,90,0.4)",
                      color: "#ffe5e5",
                      padding: "6px 12px",
                      borderRadius: 10,
                      fontSize: 12,
                      cursor: friendActionBusy ? "wait" : "pointer",
                      opacity: friendActionBusy ? 0.6 : 1
                    }}
                  >
                    {friendActionBusy ? "..." : "Freundschaft beenden"}
                  </button>
                )}
                
                {friendship.status === "none" && (
                  <button
                    onClick={handleFriendAction}
                    disabled={friendActionBusy}
                    style={{
                      background: "linear-gradient(135deg,#48c9a9,#2f9c7a)",
                      border: "none",
                      color: "#07271f",
                      padding: "6px 12px",
                      borderRadius: 10,
                      fontSize: 12,
                      fontWeight: 600,
                      cursor: friendActionBusy ? "wait" : "pointer",
                      opacity: friendActionBusy ? 0.6 : 1
                    }}
                  >
                    {friendActionBusy ? "..." : "Freund hinzufügen"}
                  </button>
                )}
                
                {friendship.status === "pending" && friendship.pendingDirection === "outgoing" && (
                  <button
                    onClick={handleFriendAction}
                    disabled={friendActionBusy}
                    style={{
                      background: "rgba(14,44,34,0.7)",
                      border: "1px solid rgba(92,200,165,0.4)",
                      color: "#bfead4",
                      padding: "6px 12px",
                      borderRadius: 10,
                      fontSize: 12,
                      cursor: friendActionBusy ? "wait" : "pointer",
                      opacity: friendActionBusy ? 0.6 : 1
                    }}
                  >
                    {friendActionBusy ? "..." : "Anfrage zurückziehen"}
                  </button>
                )}
                
                {friendship.status === "pending" && friendship.pendingDirection === "incoming" && (
                  <button
                    onClick={handleFriendAction}
                    disabled={friendActionBusy}
                    style={{
                      background: "linear-gradient(135deg,#e0c162,#d4a650)",
                      border: "none",
                      color: "#2a2416",
                      padding: "6px 12px",
                      borderRadius: 10,
                      fontSize: 12,
                      fontWeight: 600,
                      cursor: friendActionBusy ? "wait" : "pointer",
                      opacity: friendActionBusy ? 0.6 : 1
                    }}
                  >
                    {friendActionBusy ? "..." : "Anfrage annehmen"}
                  </button>
                )}

                <Link
                  to={`/chat/user/${user.id}`}
                  style={{ 
                    textDecoration: "none", 
                    fontWeight: 600, 
                    background: "rgba(10,33,27,0.85)", 
                    border: "1px solid rgba(90,203,165,0.45)", 
                    color: "#7be0bb", 
                    padding: "9px 16px", 
                    borderRadius: 12, 
                    textAlign: "center",
                    fontSize: 13
                  }}
                >
                  Nachricht senden
                </Link>
              </>
            )}
          </div>
        </div>
      </section>

      {/* Statistiken Container - Kompakt & Stylisch */}
      <section style={{ ...getBodyCard(isMobile), padding: isMobile ? "12px" : "16px" }}>
        <header style={{ marginBottom: isMobile ? 12 : 14 }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: "#e1f5ed" }}>Statistiken</div>
          <div style={{ color: "#8bbfad", fontSize: 11 }}>Leistung & Form</div>
        </header>

        {/* 2x2 Grid mit Form als erstes Element */}
        <div style={{ display: "grid", gap: isMobile ? 10 : 12, gridTemplateColumns: "1fr 1fr" }}>
          
          {/* Letzte Form - Erstes Element */}
          {formLetters.length > 0 && (
            <div style={{ 
              padding: isMobile ? "10px" : "12px", 
              borderRadius: 12, 
              background: "linear-gradient(135deg, rgba(7,28,22,0.8), rgba(15,40,32,0.6))", 
              border: "1px solid rgba(74,162,131,0.35)", 
              textAlign: "center"
            }}>
              <div style={{ fontSize: isMobile ? 9 : 10, color: "#8cbfad", fontWeight: 600, marginBottom: isMobile ? 4 : 6 }}>
                Letzte Form
              </div>
              <div style={{ display: "flex", justifyContent: "center", gap: isMobile ? 3 : 4, marginBottom: isMobile ? 2 : 4 }}>
                {formLetters.slice(0, 5).map((form, index) => (
                  <div key={index} style={{
                    width: isMobile ? 18 : 20,
                    height: isMobile ? 18 : 20,
                    borderRadius: 4,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    backgroundColor: form.color,
                    color: "#fff",
                    fontSize: isMobile ? 10 : 11,
                    fontWeight: 700
                  }}>
                    {form.letter}
                  </div>
                ))}
              </div>
              <div style={{ fontSize: isMobile ? 7 : 8, color: "#6b9688" }}>
                Neueste Form
              </div>
            </div>
          )}

          {/* Restliche Statistiken */}
          {heroMetrics.map((item) => (
            <div key={item.label} style={{ 
              padding: isMobile ? "10px" : "12px", 
              borderRadius: 12, 
              background: "linear-gradient(135deg, rgba(7,28,22,0.8), rgba(15,40,32,0.6))", 
              border: "1px solid rgba(74,162,131,0.35)", 
              textAlign: "center"
            }}>
              <div style={{ fontSize: isMobile ? 16 : 18, fontWeight: 800, color: "#e6fbf1", marginBottom: isMobile ? 3 : 4 }}>{item.value}</div>
              <div style={{ fontSize: isMobile ? 9 : 10, color: "#8cbfad", fontWeight: 600 }}>{item.label}</div>
              <div style={{ fontSize: isMobile ? 7 : 8, color: "#6b9688", marginTop: 1 }}>{item.detail}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Main Content Grid - bessere Organisation */}
      <div style={{ display: "grid", gap: 24, gridTemplateColumns: "1fr", maxWidth: "100%" }}>
        
        {/* Match Highlights - Volle Breite */}
        <section style={{ ...getBodyCard(isMobile), padding: isMobile ? "16px" : "24px" }}>
          <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: isMobile ? 8 : 16, marginBottom: isMobile ? 12 : 20 }}>
            <div>
              <div style={{ fontSize: 18, fontWeight: 700 }}>Match Highlights</div>
              <div style={{ color: "#8bbfad", fontSize: 12 }}>Nächste Begegnungen & aktuelle Form</div>
            </div>
            <Link to="/match-search" style={{ fontSize: 12, color: "#75d4b7", textDecoration: "none" }}>Weitere Matches finden</Link>
          </header>

          <div style={{ display: "grid", gap: isMobile ? 12 : 20, gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr" }}>
            
            {/* Nächste Matches */}
            <div>
              <div style={{ fontSize: 14, color: "#8ecab5", letterSpacing: 0.4, marginBottom: 12, fontWeight: 600 }}>Nächste Matches</div>
              {upcomingSlice.length === 0 ? (
                <div style={{ padding: "16px", borderRadius: 14, background: "rgba(12,35,27,0.7)", border: "1px dashed rgba(118,215,180,0.3)", color: "#9dcfbf", textAlign: "center", fontSize: 13 }}>
                  Keine kommenden Matches
                </div>
              ) : (
                <div style={{ display: "grid", gap: 12 }}>
                  {upcomingSlice.map((game) => {
                    const analysis = analyzeGame(game, numericUserId, displayName);
                    const leagueLinkId = game.league_id || game.leagueId;
                    return (
                      <div key={game.id} style={{ 
                        padding: "12px", 
                        borderRadius: 14, 
                        background: "rgba(9,26,21,0.78)", 
                        border: "1px solid rgba(74,162,131,0.18)"
                      }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                          {leagueLinkId ? (
                            <Link to={`/league/${leagueLinkId}`} style={{ fontSize: 11, color: "#8ce2c5", textDecoration: "none" }}>{game.league || "Match"}</Link>
                          ) : (
                            <span style={{ fontSize: 11, color: "#8ce2c5" }}>{game.league || "Match"}</span>
                          )}
                          <div style={{ fontSize: 11, color: "#94cabb" }}>{formatDateTime(game.kickoff_at)}</div>
                        </div>
                        <div style={{ fontSize: 13, fontWeight: 600, color: "#d6f8ea", marginBottom: 8, display: "flex", alignItems: "center", gap: 8 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                            {analysis.isHome ? (
                              <>
                                <Avatar userId={game.home_user_id} name={displayName} size={20} />
                                <div style={{ display: "flex", flexDirection: "column" }}>
                                  <strong>{displayName}</strong>
                                  <div style={{ fontSize: 10, color: "#8cbfad" }}>
                                    {user.first_name} {user.last_name}
                                    {sportsChips.length > 0 && (
                                      <span style={{ marginLeft: 8, opacity: 0.7 }}>🏆 {sportsChips.slice(0, 2).join(", ")}</span>
                                    )}
                                  </div>
                                </div>
                              </>
                            ) : (
                              <>
                                <Avatar userId={game.home_user_id} name={game.home} size={20} />
                                <div style={{ display: "flex", flexDirection: "column" }}>
                                  {game.home_user_id ? (
                                    <Link to={`/user/${game.home_user_id}`} style={{ color: "#d6f8ea", textDecoration: "none", fontSize: 13, fontWeight: 600 }}>
                                      {game.home}
                                    </Link>
                                  ) : (
                                    <span>{game.home || "-"}</span>
                                  )}
                                  <div style={{ fontSize: 10, color: "#8cbfad" }}>Profil anzeigen</div>
                                </div>
                              </>
                            )}
                          </div>
                          <span style={{ opacity: 0.5, margin: "0 6px" }}>vs</span>
                          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                            {analysis.isAway ? (
                              <>
                                <Avatar userId={game.away_user_id} name={displayName} size={20} />
                                <div style={{ display: "flex", flexDirection: "column" }}>
                                  <strong>{displayName}</strong>
                                  <div style={{ fontSize: 10, color: "#8cbfad" }}>
                                    {user.first_name} {user.last_name}
                                    {sportsChips.length > 0 && (
                                      <span style={{ marginLeft: 8, opacity: 0.7 }}>🏆 {sportsChips.slice(0, 2).join(", ")}</span>
                                    )}
                                  </div>
                                </div>
                              </>
                            ) : (
                              <>
                                <Avatar userId={game.away_user_id} name={game.away || analysis.opponentName} size={20} />
                                <div style={{ display: "flex", flexDirection: "column" }}>
                                  {game.away_user_id ? (
                                    <Link to={`/user/${game.away_user_id}`} style={{ color: "#d6f8ea", textDecoration: "none", fontSize: 13, fontWeight: 600 }}>
                                      {game.away || analysis.opponentName}
                                    </Link>
                                  ) : (
                                    <span>{game.away || analysis.opponentName}</span>
                                  )}
                                  <div style={{ fontSize: 10, color: "#8cbfad" }}>Profil anzeigen</div>
                                </div>
                              </>
                            )}
                          </div>
                        </div>
                        <div style={{ display: "flex", gap: 8 }}>
                          {analysis.opponentId && (
                            <Link to={`/user/${analysis.opponentId}`} style={{ fontSize: 10, color: "#7fd9ba", textDecoration: "none" }}>Gegner</Link>
                          )}
                          <Link to={`/matches/${game.id}`} style={{ fontSize: 10, color: "#7fd9ba", textDecoration: "none" }}>Details</Link>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Letzte 3 Spiele */}
            <div>
              <div style={{ fontSize: 14, color: "#8ecab5", letterSpacing: 0.4, marginBottom: 12, fontWeight: 600 }}>Letzte 3 Spiele</div>
              {lastThreeMatches.length === 0 ? (
                <div style={{ padding: "16px", borderRadius: 14, background: "rgba(12,35,27,0.7)", border: "1px dashed rgba(118,215,180,0.3)", color: "#9dcfbf", textAlign: "center", fontSize: 13 }}>
                  Noch keine Ergebnisse
                </div>
              ) : (
                <div style={{ display: "grid", gap: 12 }}>
                  {lastThreeMatches.map((game) => {
                    const analysis = analyzeGame(game, numericUserId, displayName);
                    const leagueLinkId = game.league_id || game.leagueId;
                    const indicator = analysis.outcome === "W" ? "#52d49f" : analysis.outcome === "L" ? "#d45757" : "#e0c162";
                    const label = analysis.outcome || "-";
                    return (
                      <div key={game.id} style={{ 
                        padding: "12px", 
                        borderRadius: 14, 
                        background: "rgba(9,26,21,0.78)", 
                        border: "1px solid rgba(74,162,131,0.18)"
                      }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                          {leagueLinkId ? (
                            <Link to={`/league/${leagueLinkId}`} style={{ fontSize: 11, color: "#8ce2c5", textDecoration: "none" }}>{game.league || "Liga"}</Link>
                          ) : (
                            <span style={{ fontSize: 11, color: "#8ce2c5" }}>{game.league || "Liga"}</span>
                          )}
                          <div style={{ fontSize: 11, color: "#94cabb" }}>{formatDateTime(game.kickoff_at)}</div>
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                          <span style={{ 
                            display: "inline-flex", 
                            alignItems: "center", 
                            justifyContent: "center", 
                            width: 24, 
                            height: 24, 
                            borderRadius: 8, 
                            background: indicator, 
                            color: "#041410", 
                            fontWeight: 700,
                            fontSize: 11
                          }}>{label}</span>
                          <div style={{ fontSize: 13, fontWeight: 600, color: "#d6f8ea", flex: 1, display: "flex", alignItems: "center", gap: 8 }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                              {analysis.isHome ? (
                                <>
                                  <Avatar userId={game.home_user_id} name={displayName} size={20} />
                                  <div style={{ display: "flex", flexDirection: "column" }}>
                                    <strong>{displayName}</strong>
                                    <div style={{ fontSize: 10, color: "#9ca3af" }}>
                                      {user.first_name} {user.last_name}
                                      {sportsChips.length > 0 && (
                                        <span style={{ marginLeft: 8, opacity: 0.7 }}>🏆 {sportsChips.slice(0, 2).join(", ")}</span>
                                      )}
                                    </div>
                                  </div>
                                </>
                              ) : (
                                <>
                                  <Avatar userId={game.home_user_id} name={game.home} size={20} />
                                  <div style={{ display: "flex", flexDirection: "column" }}>
                                    {game.home_user_id ? (
                                      <Link to={`/user/${game.home_user_id}`} style={{ color: "#d6f8ea", textDecoration: "none", fontSize: 13, fontWeight: 600 }}>
                                        {game.home}
                                      </Link>
                                    ) : (
                                      <span>{game.home || "-"}</span>
                                    )}
                                    <div style={{ fontSize: 10, color: "#9ca3af" }}>Profil anzeigen</div>
                                  </div>
                                </>
                              )}
                            </div>
                            <span style={{ opacity: 0.5, margin: "0 6px" }}>vs</span>
                            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                              {analysis.isAway ? (
                                <>
                                  <Avatar userId={game.away_user_id} name={displayName} size={20} />
                                  <div style={{ display: "flex", flexDirection: "column" }}>
                                    <strong>{displayName}</strong>
                                    <div style={{ fontSize: 10, color: "#9ca3af" }}>
                                      {user.first_name} {user.last_name}
                                      {sportsChips.length > 0 && (
                                        <span style={{ marginLeft: 8, opacity: 0.7 }}>🏆 {sportsChips.slice(0, 2).join(", ")}</span>
                                      )}
                                    </div>
                                  </div>
                                </>
                              ) : (
                                <>
                                  <Avatar userId={game.away_user_id} name={game.away || analysis.opponentName} size={20} />
                                  <div style={{ display: "flex", flexDirection: "column" }}>
                                    {game.away_user_id ? (
                                      <Link to={`/user/${game.away_user_id}`} style={{ color: "#d6f8ea", textDecoration: "none", fontSize: 13, fontWeight: 600 }}>
                                        {game.away || analysis.opponentName}
                                      </Link>
                                    ) : (
                                      <span>{game.away || analysis.opponentName}</span>
                                    )}
                                    <div style={{ fontSize: 10, color: "#9ca3af" }}>Profil anzeigen</div>
                                  </div>
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                        <div style={{ display: "flex", gap: 8 }}>
                          {analysis.opponentId && (
                            <Link to={`/user/${analysis.opponentId}`} style={{ fontSize: 10, color: "#7fd9ba", textDecoration: "none" }}>Gegner</Link>
                          )}
                          <Link to={`/matches/${game.id}`} style={{ fontSize: 10, color: "#7fd9ba", textDecoration: "none" }}>Details</Link>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </section>
      </div>

      {/* Liga-Statistiken Section - Volle Breite */}
      <section style={{ ...getBodyCard(isMobile), padding: isMobile ? "16px" : "28px" }}>
        {/* Liga-Statistiken - kleiner und heller */}
        <div style={{ marginBottom: isMobile ? 12 : 20, display: "grid", gap: isMobile ? 8 : 12, gridTemplateColumns: "1fr 1fr" }}>
          {heroTiles.map((tile) => (
            <div key={tile.title} style={{ 
              position: "relative", 
              padding: "12px 14px", 
              borderRadius: 12, 
              background: "linear-gradient(135deg, rgba(32,74,58,0.8), rgba(45,88,73,0.6))", 
              border: "1px solid rgba(127,217,186,0.4)",
              textAlign: "center"
            }}>
              <div style={{ fontSize: 10, color: "#7fd9ba", textTransform: "uppercase", letterSpacing: 1, marginBottom: 6 }}>{tile.title}</div>
              <div style={{ fontSize: 20, fontWeight: 800, color: "#e1f5ed", marginBottom: 3 }}>{tile.value}</div>
              <div style={{ fontSize: 10, color: "#a9d7c4" }}>{tile.subtitle}</div>
            </div>
          ))}
        </div>

        <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, marginBottom: 16 }}>
          <div>
            <div style={{ fontSize: 18, fontWeight: 700 }}>Liga-Statistiken</div>
            <div style={{ fontSize: 12, color: "#8bbfad" }}>
              {isOwnProfile ? "Deine Platzierungen in den Ligen" : `Platzierungen von ${displayName}`}
            </div>
          </div>
          {leagues.length > 0 && (
            <select
              value={activeLeagueId || ""}
              onChange={(e) => setActiveLeagueId(e.target.value ? Number(e.target.value) : null)}
              style={{ 
                background: "rgba(32,74,58,0.7)", 
                border: "1px solid rgba(127,217,186,0.4)", 
                color: "#e1f5ed", 
                borderRadius: 10, 
                padding: "6px 10px", 
                fontSize: 12,
                minWidth: 120
              }}
            >
              <option value="">Alle Ligen</option>
              {leagues.map((league) => (
                <option key={league.id} value={league.id}>{league.name}</option>
              ))}
            </select>
          )}
        </header>

        <div style={{ marginTop: 20 }}>
          <div style={{ fontSize: 14, color: "#7fd9ba", letterSpacing: 0.4, marginBottom: 12 }}>Tabellenausschnitt</div>
          {standingsLoading ? (
            <div style={{ marginTop: 12, padding: 16, borderRadius: 12, background: "rgba(32,74,58,0.4)", color: "#b8dec9" }}>Lade Tabelle …</div>
          ) : standingsErr ? (
            <div style={{ marginTop: 12, padding: 16, borderRadius: 12, background: "rgba(80,30,30,0.5)", color: "#ffb3b3" }}>Fehler: {standingsErr}</div>
          ) : standingsWindow.length === 0 ? (
            <div style={{ marginTop: 12, padding: 16, borderRadius: 12, background: "rgba(32,74,58,0.4)", color: "#b8dec9" }}>Keine Tabellendaten verfügbar.</div>
          ) : (
            <div style={{ marginTop: 14 }}>
              <div style={{ display: "grid", gridTemplateColumns: "40px 40px 1fr 60px 60px 50px 50px", gap: 10, fontSize: 11, color: "#7fd9ba", textTransform: "uppercase", letterSpacing: 0.6, marginBottom: 8 }}>
                <div>Platz</div>
                <div></div>
                <div>Team</div>
                <div style={{ textAlign: "center" }}>Sp.</div>
                <div style={{ textAlign: "center" }}>S-U-N</div>
                <div style={{ textAlign: "center" }}>Diff</div>
                <div style={{ textAlign: "center" }}>Pkt.</div>
              </div>
              <div style={{ display: "grid", gap: 6 }}>
                {standingsWindow.map((row) => {
                  const isMe = rankingEntry && row === rankingEntry;
                  const userIdMatch = typeof row.key === "string" && row.key.startsWith("u:") ? Number(row.key.split(":" )[1]) : null;
                  const teamLink = userIdMatch ? `/user/${userIdMatch}` : undefined;
                  const diff = typeof row.gd === "number" ? row.gd : (typeof row.gf === "number" && typeof row.ga === "number" ? row.gf - row.ga : "-");
                  return (
                    <div
                      key={`${row.key || row.name}`}
                      style={{
                        display: "grid",
                        gridTemplateColumns: "40px 40px 1fr 60px 60px 50px 50px",
                        gap: 10,
                        alignItems: "center",
                        padding: "8px 10px",
                        borderRadius: 10,
                        background: isMe ? "rgba(127,217,186,0.2)" : "rgba(32,74,58,0.4)",
                        border: isMe ? "1px solid rgba(127,217,186,0.5)" : "1px solid rgba(127,217,186,0.2)",
                        fontSize: 12
                      }}
                    >
                      <div style={{ fontWeight: 700, color: isMe ? "#7fd9ba" : "#b8dec9" }}>{row.rank}</div>
                      <div>
                        <Avatar userId={userIdMatch} name={row.name} size={24} />
                      </div>
                      <div style={{ fontWeight: 600, color: isMe ? "#e1f5ed" : "#d6f8ea" }}>
                        {teamLink ? (
                          <Link to={teamLink} style={{ color: isMe ? "#e1f5ed" : "#d6f8ea", textDecoration: "none" }}>{row.name}</Link>
                        ) : (
                          row.name
                        )}
                      </div>
                      <div style={{ textAlign: "center", color: "#a9d7c4" }}>{row.played}</div>
                      <div style={{ textAlign: "center", color: "#a9d7c4" }}>{row.won}-{row.drawn}-{row.lost}</div>
                      <div style={{ textAlign: "center", color: "#a9d7c4" }}>{diff}</div>
                      <div style={{ textAlign: "center", fontWeight: 700, color: isMe ? "#7fd9ba" : "#b8dec9" }}>{row.points}</div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
          
          {/* Zur Liga Button */}
          {activeLeagueId && (
            <div style={{ marginTop: 16, textAlign: "center" }}>
              <Link 
                to={`/league/${activeLeagueId}`}
                style={{
                  display: "inline-block",
                  padding: "8px 16px",
                  borderRadius: 8,
                  background: "rgba(127,217,186,0.2)",
                  border: "1px solid rgba(127,217,186,0.4)",
                  color: "#7fd9ba",
                  textDecoration: "none",
                  fontSize: 12,
                  fontWeight: 600,
                  transition: "all 0.2s ease"
                }}
                onMouseEnter={(e) => {
                  e.target.style.background = "rgba(127,217,186,0.3)";
                  e.target.style.borderColor = "rgba(127,217,186,0.6)";
                }}
                onMouseLeave={(e) => {
                  e.target.style.background = "rgba(127,217,186,0.2)";
                  e.target.style.borderColor = "rgba(127,217,186,0.4)";
                }}
              >
                Zur Liga →
              </Link>
            </div>
          )}
        </div>
      </section>

      {/* Activity Feed Section - Heller und kompakter */}
      <section style={{ ...getBodyCard(isMobile), padding: isMobile ? "12px" : "18px", marginTop: isMobile ? 12 : 20 }}>
        <header style={{ marginBottom: isMobile ? 10 : 14 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, flexWrap: "wrap" }}>
            <div>
              <div style={{ fontSize: 16, fontWeight: 700 }}>Aktivitäten</div>
              <div style={{ color: "#94cabf", fontSize: 11 }}>Neueste Updates</div>
            </div>
            
            {/* Feed Category Buttons */}
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {[
                { id: "all", label: "Alle", icon: "📋" },
                { id: "matches", label: "Match-News", icon: "⚽" },
                { id: "friends", label: "Friends-Feed", icon: "👥" },
                { id: "public", label: "Public-Feed", icon: "🌐" }
              ].map((category) => (
                <button
                  key={category.id}
                  onClick={() => setActiveFeedCategory(category.id)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 4,
                    padding: "4px 8px",
                    borderRadius: 8,
                    border: "1px solid rgba(127,217,186,0.3)",
                    background: activeFeedCategory === category.id 
                      ? "rgba(127,217,186,0.25)" 
                      : "rgba(32,74,58,0.4)",
                    color: activeFeedCategory === category.id 
                      ? "#e1f5ed" 
                      : "#b8dec9",
                    fontSize: 10,
                    fontWeight: 600,
                    cursor: "pointer",
                    transition: "all 0.2s ease"
                  }}
                >
                  <span>{category.icon}</span>
                  <span>{category.label}</span>
                </button>
              ))}
            </div>
          </div>
        </header>

        {/* Feed Content - heller und kompakter */}
        <div style={{ display: "grid", gap: 10 }}>
          {(() => {
            // Kombiniere alle Feeds basierend auf der aktiven Kategorie
            const combinedFeed = [];
            
            if (activeFeedCategory === "all") {
              combinedFeed.push(...(feedData.friends || []).map(item => ({...item, feedType: 'friends'})));
              combinedFeed.push(...(feedData.team || []).map(item => ({...item, feedType: 'team'})));
              combinedFeed.push(...(feedData.public || []).map(item => ({...item, feedType: 'public'})));
            } else if (activeFeedCategory === "matches") {
              // Filtere nach Match-bezogenen Aktivitäten aus allen Feeds
              combinedFeed.push(...(feedData.friends || []).filter(item => item.type === "match").map(item => ({...item, feedType: 'friends'})));
              combinedFeed.push(...(feedData.team || []).filter(item => item.type === "match").map(item => ({...item, feedType: 'team'})));
              combinedFeed.push(...(feedData.public || []).filter(item => item.type === "match").map(item => ({...item, feedType: 'public'})));
            } else if (activeFeedCategory === "friends") {
              combinedFeed.push(...(feedData.friends || []).map(item => ({...item, feedType: 'friends'})));
            } else if (activeFeedCategory === "public") {
              combinedFeed.push(...(feedData.public || []).map(item => ({...item, feedType: 'public'})));
            }
            
            // Sortiere nach Zeitstempel (neueste zuerst)
            combinedFeed.sort((a, b) => {
              const timeA = new Date(a.timestamp || 0).getTime();
              const timeB = new Date(b.timestamp || 0).getTime();
              return timeB - timeA;
            });

            if (combinedFeed.length === 0) {
              const emptyMessages = {
                all: "Keine Aktivitäten verfügbar.",
                matches: "Keine Match-News verfügbar.",
                friends: "Keine Freundes-Aktivitäten verfügbar.",
                public: "Keine öffentlichen Aktivitäten verfügbar."
              };
              
              return (
                <div style={{ padding: "20px 14px", borderRadius: 12, background: "rgba(32,74,58,0.4)", color: "#b8dec9", textAlign: "center", fontSize: 11 }}>
                  {emptyMessages[activeFeedCategory] || emptyMessages.all}
                </div>
              );
            }

            return combinedFeed.slice(0, 8).map((item, idx) => (
              <div 
                key={`${item.feedType}-${idx}`} 
                style={{ 
                  padding: "10px 12px", 
                  borderRadius: 10, 
                  background: "rgba(32,74,58,0.5)", 
                  border: "1px solid rgba(127,217,186,0.25)",
                  display: "flex",
                  alignItems: "center",
                  gap: 10
                }}
              >
                {/* Activity Icon - kleiner und heller */}
                <div style={{ 
                  width: 28, 
                  height: 28, 
                  borderRadius: 8, 
                  background: item.type === "match" ? "rgba(127,217,186,0.25)" : 
                             item.type === "league" ? "rgba(255,213,107,0.25)" : 
                             item.feedType === "friends" ? "rgba(161,225,203,0.25)" :
                             item.feedType === "team" ? "rgba(255,213,107,0.25)" :
                             "rgba(127,217,186,0.2)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 13,
                  flexShrink: 0
                }}>
                  {item.type === "match" ? "⚽" : 
                   item.type === "league" ? "🏆" : 
                   item.feedType === "friends" ? "👥" :
                   item.feedType === "team" ? "🏆" : "🌐"}
                </div>

                {/* Activity Content - hellere Farben */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 11, color: "#e1f5ed", fontWeight: 600, marginBottom: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {item.title}
                  </div>
                  <div style={{ fontSize: 10, color: "#b8dec9", lineHeight: 1.3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {item.description}
                  </div>
                  {item.timestamp && (
                    <div style={{ fontSize: 8, color: "#94cabf", marginTop: 3 }}>
                      {item.timestamp}
                    </div>
                  )}
                </div>

                {/* Feed Type Badge - heller */}
                <div style={{
                  fontSize: 8,
                  color: "#7fd9ba",
                  background: "rgba(127,217,186,0.2)",
                  padding: "1px 3px",
                  borderRadius: 4,
                  flexShrink: 0
                }}>
                  {item.feedType === "friends" ? "👥" : item.feedType === "team" ? "🏆" : "🌐"}
                </div>

                {/* Action Link */}
                {item.link && (
                  <Link 
                    to={item.link}
                    style={{ 
                      fontSize: 10, 
                      color: "#7fd9ba", 
                      textDecoration: "none",
                      padding: "3px 6px",
                      borderRadius: 6,
                      background: "rgba(127,217,186,0.1)",
                      flexShrink: 0
                    }}
                  >
                    Details
                  </Link>
                )}
              </div>
            ));
          })()}
        </div>

        {(() => {
          const totalItems = (feedData.friends || []).length + (feedData.team || []).length + (feedData.public || []).length;
          
          return totalItems > 8 ? (
            <div style={{ textAlign: "center", marginTop: 16 }}>
              <button style={{
                background: "rgba(14,44,34,0.7)",
                border: "1px solid rgba(92,200,165,0.4)",
                color: "#bfead4",
                padding: "8px 16px",
                borderRadius: 10,
                fontSize: 11,
                cursor: "pointer"
              }}>
                Mehr anzeigen ({totalItems - 8} weitere)
              </button>
            </div>
          ) : null;
        })()}
      </section>

      {/* Avatar Upload Dialog */}
      {showAvatarUpload && (
        <div style={{
          position: "fixed",
          inset: 0,
          background: "rgba(0,0,0,0.9)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 9999,
          padding: 20
        }} onClick={() => {
          setShowAvatarUpload(false);
          setAvatarImage(null);
          setAvatarScale(1);
        }}>
          <div style={{
            background: "linear-gradient(135deg, rgba(9,26,21,0.98), rgba(18,44,37,0.98))",
            borderRadius: 24,
            padding: 32,
            maxWidth: 500,
            width: "100%",
            boxShadow: "0 24px 60px rgba(0,0,0,0.6)",
            border: "1px solid rgba(92,200,165,0.3)"
          }} onClick={e => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <h2 style={{ margin: 0, fontSize: 24, color: "#e8efe8" }}>Profilbild hochladen</h2>
              <button 
                onClick={() => {
                  setShowAvatarUpload(false);
                  setAvatarImage(null);
                  setAvatarScale(1);
                }}
                style={{
                  background: "transparent",
                  border: "none",
                  color: "#e8efe8",
                  fontSize: 28,
                  cursor: "pointer",
                  padding: 0,
                  lineHeight: 1
                }}
              >×</button>
            </div>
            
            {!avatarImage ? (
              <>
                <input 
                  type="file" 
                  accept="image/*"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    const reader = new FileReader();
                    reader.onload = () => {
                      setAvatarImage(reader.result);
                      setAvatarScale(1);
                    };
                    reader.readAsDataURL(file);
                  }}
                  style={{
                    width: "100%",
                    padding: 12,
                    background: "rgba(14,44,34,0.7)",
                    border: "1px solid rgba(92,200,165,0.4)",
                    borderRadius: 12,
                    color: "#e8efe8",
                    marginBottom: 16
                  }}
                />
                <p style={{ color: "#bfead4", fontSize: 14, marginTop: 12 }}>
                  Wähle ein Bild aus und schneide es dann zu.
                </p>
              </>
            ) : (
              <>
                <div style={{ 
                  display: 'flex', 
                  justifyContent: 'center', 
                  marginBottom: 20,
                  position: 'relative'
                }}>
                  <AvatarEditor
                    ref={editorRef}
                    image={avatarImage}
                    width={250}
                    height={250}
                    border={50}
                    borderRadius={125}
                    color={[8, 28, 25, 0.8]}
                    scale={avatarScale}
                    rotate={0}
                  />
                </div>
                
                <div style={{ marginBottom: 20 }}>
                  <label style={{ color: "#bfead4", fontSize: 14, marginBottom: 8, display: 'block' }}>
                    Zoom
                  </label>
                  <input
                    type="range"
                    min="1"
                    max="3"
                    step="0.01"
                    value={avatarScale}
                    onChange={(e) => setAvatarScale(parseFloat(e.target.value))}
                    style={{
                      width: "100%",
                      accentColor: "#5cc8a5"
                    }}
                  />
                </div>
                
                <div style={{ display: 'flex', gap: 12 }}>
                  <button 
                    onClick={() => {
                      setAvatarImage(null);
                      setAvatarScale(1);
                    }}
                    style={{
                      flex: 1,
                      background: "rgba(14,44,34,0.7)",
                      border: "1px solid rgba(92,200,165,0.4)",
                      color: "#bfead4",
                      padding: "10px 20px",
                      borderRadius: 12,
                      cursor: "pointer",
                      fontWeight: 600
                    }}
                  >
                    Neues Bild
                  </button>
                  
                  <button 
                    onClick={async () => {
                      if (!editorRef.current) return;
                      
                      setUploadingAvatar(true);
                      try {
                        const canvas = editorRef.current.getImageScaledToCanvas();
                        const dataUrl = canvas.toDataURL('image/png');
                        
                        const res = await fetch(`${API_BASE}/users/${user.id}/avatar`, {
                          method: 'POST',
                          headers: { 
                            'Content-Type': 'application/json',
                            Authorization: `Bearer ${token}` 
                          },
                          body: JSON.stringify({ avatar: dataUrl })
                        });
                        
                        if (!res.ok) {
                          const errorData = await res.json().catch(() => ({}));
                          throw new Error(errorData.error || 'Upload fehlgeschlagen');
                        }
                        
                        const data = await res.json();
                        let newAvatarUrl = data.url || data.avatar_url;
                        // Add cache-busting timestamp to force image reload
                        if (newAvatarUrl) {
                          const separator = newAvatarUrl.includes('?') ? '&' : '?';
                          newAvatarUrl = `${newAvatarUrl}${separator}t=${Date.now()}`;
                        }
                        setUser(prev => ({ ...prev, avatar_url: newAvatarUrl }));
                        setShowAvatarUpload(false);
                        setAvatarImage(null);
                        setAvatarScale(1);
                      } catch (err) {
                        console.error('Avatar upload error:', err);
                        alert(err.message || 'Fehler beim Hochladen');
                      } finally {
                        setUploadingAvatar(false);
                      }
                    }}
                    disabled={uploadingAvatar}
                    style={{
                      flex: 1,
                      background: uploadingAvatar ? "rgba(92,200,165,0.3)" : "rgba(92,200,165,0.9)",
                      border: "none",
                      color: "#0a1f18",
                      padding: "10px 20px",
                      borderRadius: 12,
                      cursor: uploadingAvatar ? "not-allowed" : "pointer",
                      fontWeight: 700
                    }}
                  >
                    {uploadingAvatar ? 'Lädt...' : 'Speichern'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Avatar Viewer Dialog */}
      {showAvatarViewer && (
        <div style={{
          position: "fixed",
          inset: 0,
          background: "rgba(0,0,0,0.9)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 9999,
          padding: 20
        }} onClick={() => setShowAvatarViewer(false)}>
          <div style={{
            background: "linear-gradient(135deg, rgba(9,26,21,0.98), rgba(18,44,37,0.98))",
            borderRadius: 24,
            padding: 32,
            maxWidth: 700,
            width: "100%",
            maxHeight: "90vh",
            overflow: "auto",
            boxShadow: "0 24px 60px rgba(0,0,0,0.6)",
            border: "1px solid rgba(92,200,165,0.3)"
          }} onClick={e => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <h2 style={{ margin: 0, fontSize: 24, color: "#e8efe8" }}>Profilbild</h2>
              <button 
                onClick={() => setShowAvatarViewer(false)}
                style={{
                  background: "transparent",
                  border: "none",
                  color: "#e8efe8",
                  fontSize: 32,
                  cursor: "pointer",
                  padding: 0,
                  lineHeight: 1
                }}
              >×</button>
            </div>
            
            {/* Large Avatar */}
            <div style={{ 
              width: "100%", 
              aspectRatio: "1", 
              borderRadius: 16, 
              overflow: "hidden",
              marginBottom: 20,
              background: "rgba(14,44,34,0.5)"
            }}>
              <Avatar 
                userId={user.id} 
                name={displayName} 
                size={600}
                style={{ width: "100%", height: "100%", objectFit: "cover" }}
              />
            </div>

            {/* Likes */}
            <div style={{ marginBottom: 20, display: "flex", alignItems: "center", gap: 12 }}>
              <button
                onClick={async () => {
                  try {
                    const res = await fetch(`${API_BASE}/users/${user.id}/avatar/like`, {
                      method: avatarLiked ? 'DELETE' : 'POST',
                      headers: { Authorization: `Bearer ${token}` }
                    });
                    if (res.ok) {
                      setAvatarLiked(!avatarLiked);
                      setAvatarLikes(prev => avatarLiked ? prev - 1 : prev + 1);
                    }
                  } catch (err) {
                    console.error('Like error:', err);
                  }
                }}
                style={{
                  background: avatarLiked ? "rgba(255,92,92,0.3)" : "rgba(14,44,34,0.7)",
                  border: `1px solid ${avatarLiked ? "rgba(255,92,92,0.6)" : "rgba(92,200,165,0.4)"}`,
                  color: avatarLiked ? "#ff5c5c" : "#bfead4",
                  padding: "8px 16px",
                  borderRadius: 12,
                  cursor: "pointer",
                  fontSize: 16
                }}
              >
                {avatarLiked ? "❤️" : "🤍"} {avatarLikes}
              </button>
            </div>

            {/* Comments */}
            <div style={{ marginBottom: 20 }}>
              <h3 style={{ margin: "0 0 12px 0", fontSize: 18, color: "#e8efe8" }}>Kommentare</h3>
              <div style={{ maxHeight: 200, overflow: "auto", marginBottom: 12 }}>
                {avatarComments.length === 0 ? (
                  <p style={{ color: "#a9cabd", fontSize: 14 }}>Noch keine Kommentare</p>
                ) : (
                  avatarComments.map((comment, idx) => (
                    <div key={idx} style={{ 
                      padding: 10, 
                      background: "rgba(14,44,34,0.5)", 
                      borderRadius: 8, 
                      marginBottom: 8,
                      border: "1px solid rgba(92,200,165,0.2)"
                    }}>
                      <div style={{ fontWeight: 600, color: "#7fd9ba", fontSize: 13, marginBottom: 4 }}>
                        {comment.username}
                      </div>
                      <div style={{ color: "#e8efe8", fontSize: 14 }}>{comment.text}</div>
                    </div>
                  ))
                )}
              </div>
              
              {/* Add Comment */}
              <div style={{ display: "flex", gap: 8 }}>
                <input 
                  type="text"
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  placeholder="Kommentar schreiben..."
                  style={{
                    flex: 1,
                    padding: 10,
                    background: "rgba(14,44,34,0.7)",
                    border: "1px solid rgba(92,200,165,0.4)",
                    borderRadius: 12,
                    color: "#e8efe8",
                    fontSize: 14
                  }}
                  onKeyPress={async (e) => {
                    if (e.key === 'Enter' && newComment.trim()) {
                      try {
                        const res = await fetch(`${API_BASE}/users/${user.id}/avatar/comment`, {
                          method: 'POST',
                          headers: { 
                            'Content-Type': 'application/json',
                            Authorization: `Bearer ${token}` 
                          },
                          body: JSON.stringify({ text: newComment })
                        });
                        if (res.ok) {
                          const comment = await res.json();
                          setAvatarComments(prev => [...prev, comment]);
                          setNewComment('');
                        }
                      } catch (err) {
                        console.error('Comment error:', err);
                      }
                    }
                  }}
                />
                <button
                  onClick={async () => {
                    if (!newComment.trim()) return;
                    try {
                      const res = await fetch(`${API_BASE}/users/${user.id}/avatar/comment`, {
                        method: 'POST',
                        headers: { 
                          'Content-Type': 'application/json',
                          Authorization: `Bearer ${token}` 
                        },
                        body: JSON.stringify({ text: newComment })
                      });
                      if (res.ok) {
                        const comment = await res.json();
                        setAvatarComments(prev => [...prev, comment]);
                        setNewComment('');
                      }
                    } catch (err) {
                      console.error('Comment error:', err);
                    }
                  }}
                  style={{
                    background: "rgba(92,200,165,0.3)",
                    border: "1px solid rgba(92,200,165,0.6)",
                    color: "#7fd9ba",
                    padding: "10px 20px",
                    borderRadius: 12,
                    cursor: "pointer",
                    fontSize: 14
                  }}
                >
                  Senden
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
