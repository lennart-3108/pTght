import React, { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { API_BASE } from "../config";
import Avatar from "../components/Avatar";

const pageStyle = {
  minHeight: "100vh",
  background: "radial-gradient(circle at top, rgba(26,73,59,0.45), rgba(4,17,14,0.95) 55%)",
  padding: "32px min(6vw, 64px)",
  color: "#e8efe8",
  fontFamily: "Inter, system-ui, sans-serif"
};

const baseCard = {
  background: "linear-gradient(135deg, rgba(9,26,21,0.92), rgba(18,44,37,0.92))",
  borderRadius: 24,
  boxShadow: "0 24px 60px rgba(0,0,0,0.45)",
  overflow: "hidden",
  position: "relative"
};

const bodyCard = {
  ...baseCard,
  padding: "28px"
};

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
  const [activeFeed, setActiveFeed] = useState("friends");

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
    return calculateStats(games.completed || [], Number(user.id), displayName);
  }, [games.completed, user, displayName]);

  const opponents = useMemo(() => {
    if (!user) return [];
    return extractOpponents(games.completed || [], Number(user.id), displayName);
  }, [games.completed, user, displayName]);

  const rankingEntry = useMemo(() => {
    if (!user || !standings.length) return null;
    const byKey = standings.find((row) => String(row.key || "").includes(`u:${user.id}`));
    if (byKey) return byKey;
    return standings.find((row) => String(row.name).toLowerCase() === displayName.toLowerCase()) || null;
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

  const socialSection = useMemo(() => {
    const mutualList = (mutualFriends || []).map((f) => ({
      id: f.id,
      name: f.displayName || f.name || "Unbekannt",
      avatar: f.avatar_url || null
    }));
    const friendList = (friends || []).map((f) => ({
      id: f.id,
      name: f.displayName || f.name || "Unbekannt",
      avatar: f.avatar_url || null,
      since: f.since || null
    }));
    const rivalList = (opponents || []).map((opp) => ({
      id: opp.id || opp.name,
      name: opp.name,
      avatar: null,
      matches: opp.matches
    }));

    if (mutualList.length) return { title: "Gemeinsame Freunde", items: mutualList.slice(0, 3), kind: "mutual" };
    if (friendList.length) return { title: isOwnProfile ? "Deine Freunde" : "Freunde", items: friendList.slice(0, 4), kind: "friends" };
    return { title: "Gemeinsame Gegner", items: rivalList.slice(0, 4), kind: "rivals" };
  }, [friends, mutualFriends, opponents, isOwnProfile]);

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

  const activeFeedItems = feedData[activeFeed] || [];

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
    <div style={pageStyle}>
      <section style={{ ...baseCard, padding: "32px" }}>
        <div style={{ position: "absolute", inset: 0, background: "radial-gradient(circle at 20% 20%, rgba(31,94,74,0.35), transparent 60%)" }} />
        <div style={{ position: "relative", display: "grid", gridTemplateColumns: "minmax(220px, 280px) 1fr", gap: 32 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            <Avatar userId={user.id} name={displayName} size={128} style={{ border: "3px solid rgba(88,204,171,0.45)", boxShadow: "0 12px 32px rgba(9,23,17,0.6)" }} />
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {sportsChips.length ? sportsChips.map((chip) => (
                <span key={chip} style={{ padding: "6px 12px", borderRadius: 999, border: "1px solid rgba(92,200,165,0.4)", background: "rgba(16,60,46,0.8)", fontSize: 13 }}>{chip}</span>
              )) : (
                <span style={{ padding: "6px 12px", borderRadius: 999, background: "rgba(14,44,34,0.7)", border: "1px solid rgba(92,200,165,0.2)", fontSize: 13 }}>Allrounder</span>
              )}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ width: 12, height: 12, borderRadius: 999, background: "#5ccd9b", boxShadow: "0 0 12px #5ccd9b" }} />
                <span style={{ fontSize: 14, color: "#bfead4" }}>{matchAvailability}</span>
              </div>
              <div style={{ display: "grid", gap: 10 }}>
                <Link
                  to={`/chat/user/${user.id}`}
                  style={{ textDecoration: "none", fontWeight: 600, background: "linear-gradient(135deg,#48c9a9,#2f9c7a)", color: "#07271f", padding: "12px 20px", borderRadius: 14, textAlign: "center" }}
                >
                  Match anfragen
                </Link>
                <Link
                  to={`/chat/user/${user.id}`}
                  style={{ textDecoration: "none", fontWeight: 600, background: "rgba(10,33,27,0.85)", border: "1px solid rgba(90,203,165,0.45)", color: "#7be0bb", padding: "11px 20px", borderRadius: 14, textAlign: "center" }}
                >
                  Nachricht senden
                </Link>
              </div>
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
            <div>
              <div style={{ fontSize: 36, fontWeight: 900, letterSpacing: 0.3 }}>{displayName}</div>
              <div style={{ marginTop: 6, fontSize: 16, color: "#a9cabd" }}>{primaryCity ? `${primaryCity}, Germany` : "Ort unbekannt"}</div>
              {heroBadges.length > 0 && (
                <div style={{ marginTop: 14, display: "flex", gap: 10, flexWrap: "wrap" }}>
                  {heroBadges.map((badge) => (
                    <span key={badge} style={{ padding: "6px 12px", borderRadius: 999, border: "1px solid rgba(120,216,177,0.6)", background: "rgba(12,39,31,0.65)", color: "#c0f0dc", fontSize: 12 }}>{badge}</span>
                  ))}
                </div>
              )}
            </div>

            <div style={{ display: "grid", gap: 14, gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))" }}>
              {heroMetrics.map((item) => (
                <div key={item.label} style={{ padding: "14px 16px", borderRadius: 18, background: "rgba(7,28,22,0.65)", border: "1px solid rgba(74,162,131,0.28)", display: "flex", flexDirection: "column", gap: 4 }}>
                  <span style={{ fontSize: 24, fontWeight: 700, color: "#e6fbf1" }}>{item.value}</span>
                  <span style={{ fontSize: 13, color: "#8cbfad" }}>{item.label}</span>
                </div>
              ))}
            </div>

            <div style={{ display: "grid", gap: 18, gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))" }}>
              {heroTiles.map((tile) => (
                <div key={tile.title} style={{ position: "relative", padding: "18px 20px", borderRadius: 20, background: "linear-gradient(135deg, rgba(13,45,35,0.9), rgba(27,68,53,0.65))", border: "1px solid rgba(88,204,171,0.35)" }}>
                  <div style={{ fontSize: 13, color: "#91d7bf", textTransform: "uppercase", letterSpacing: 1 }}>{tile.title}</div>
                  <div style={{ marginTop: 12, fontSize: 32, fontWeight: 800, color: "#f0fff8" }}>{tile.value}</div>
                  <div style={{ marginTop: 4, fontSize: 12, color: "#9bcfbf" }}>{tile.subtitle}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <div style={{ marginTop: 32, display: "grid", gap: 24, gridTemplateColumns: "minmax(0, 2fr) minmax(0, 1.2fr)" }}>
        <section style={{ ...bodyCard, padding: "28px" }}>
          <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16 }}>
            <div>
              <div style={{ fontSize: 20, fontWeight: 700 }}>Match Highlights</div>
              <div style={{ color: "#8bbfad", fontSize: 13 }}>Nächste Begegnungen & aktuelle Form</div>
            </div>
            <Link to="/match-search" style={{ fontSize: 13, color: "#75d4b7" }}>Weitere Matches finden</Link>
          </header>

          <div style={{ marginTop: 24, display: "grid", gap: 24, gridTemplateColumns: "minmax(0, 1.2fr) minmax(0, 1fr)" }}>
            <div style={{ display: "grid", gap: 16 }}>
              <div style={{ fontSize: 15, color: "#8ecab5", letterSpacing: 0.4 }}>Nächste Matches</div>
              {upcomingSlice.length === 0 ? (
                <div style={{ padding: "20px", borderRadius: 18, background: "rgba(12,35,27,0.7)", border: "1px dashed rgba(118,215,180,0.3)", color: "#9dcfbf" }}>
                  Keine kommenden Matches eingetragen.
                </div>
              ) : (
                <div style={{ display: "grid", gap: 14 }}>
                  {upcomingSlice.map((game) => {
                    const analysis = analyzeGame(game, numericUserId, displayName);
                    const leagueLinkId = game.league_id || game.leagueId;
                    return (
                      <div key={game.id} style={{ padding: "16px", borderRadius: 18, background: "rgba(9,26,21,0.78)", border: "1px solid rgba(74,162,131,0.18)", display: "grid", gap: 12 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                          {leagueLinkId ? (
                            <Link to={`/league/${leagueLinkId}`} style={{ fontSize: 13, color: "#8ce2c5", textDecoration: "none" }}>{game.league || "Match"}</Link>
                          ) : (
                            <span style={{ fontSize: 13, color: "#8ce2c5" }}>{game.league || "Match"}</span>
                          )}
                          <div style={{ fontSize: 13, color: "#94cabb" }}>{formatDateTime(game.kickoff_at)}</div>
                        </div>
                        <div style={{ fontSize: 16, fontWeight: 600, color: "#d6f8ea", display: "flex", gap: 8, flexWrap: "wrap" }}>
                          <span>{analysis.isHome ? <strong>{displayName}</strong> : (game.home || "-")}</span>
                          <span style={{ opacity: 0.5 }}>vs</span>
                          <span>{analysis.isAway ? <strong>{displayName}</strong> : (game.away || analysis.opponentName)}</span>
                        </div>
                        <div style={{ display: "flex", gap: 10 }}>
                          {analysis.opponentId && (
                            <Link to={`/user/${analysis.opponentId}`} style={{ fontSize: 12, color: "#7fd9ba" }}>Gegner ansehen</Link>
                          )}
                          <Link to={`/matches/${game.id}`} style={{ fontSize: 12, color: "#7fd9ba" }}>Match Details</Link>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div style={{ display: "grid", gap: 16 }}>
              <div style={{ fontSize: 15, color: "#8ecab5", letterSpacing: 0.4 }}>Letzte 3 Spiele</div>
              {lastThreeMatches.length === 0 ? (
                <div style={{ padding: "20px", borderRadius: 18, background: "rgba(12,35,27,0.7)", color: "#9dcfbf" }}>Noch keine Ergebnisse vorhanden.</div>
              ) : (
                <div style={{ display: "grid", gap: 12 }}>
                  {lastThreeMatches.map((game) => {
                    const indicator = game.analysis.outcome === "W" ? "#52d49f" : game.analysis.outcome === "L" ? "#d45757" : "#e0c162";
                    const label = game.analysis.outcome || "-";
                    const leagueLinkId = game.league_id || game.leagueId;
                    return (
                      <div key={game.id} style={{ padding: "14px 16px", borderRadius: 16, background: "rgba(8,28,22,0.78)", border: "1px solid rgba(74,162,131,0.18)", display: "grid", gap: 12 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                          {leagueLinkId ? (
                            <Link to={`/league/${leagueLinkId}`} style={{ fontSize: 13, color: "#8ce2c5", textDecoration: "none" }}>{game.league || "Liga"}</Link>
                          ) : (
                            <span style={{ fontSize: 13, color: "#8ce2c5" }}>{game.league || "Liga"}</span>
                          )}
                          <div style={{ fontSize: 12, color: "#94cabb" }}>{formatDateTime(game.kickoff_at)}</div>
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                          <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 32, height: 32, borderRadius: 12, background: indicator, color: "#041410", fontWeight: 700 }}>{label}</span>
                          <div style={{ fontSize: 15, color: "#d4f7e8", fontWeight: 600 }}>{game.analysis.opponentName}</div>
                        </div>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 13, color: "#8ecab5" }}>
                          <div>{game.analysis.isHome ? "Heim" : game.analysis.isAway ? "Auswärts" : "Neutral"}</div>
                          <div style={{ fontSize: 16, fontWeight: 700 }}>{game.analysis.scoreText}</div>
                        </div>
                        <div style={{ display: "flex", gap: 10 }}>
                          {game.analysis.opponentId && (
                            <Link to={`/user/${game.analysis.opponentId}`} style={{ fontSize: 12, color: "#7fd9ba" }}>Gegnerprofil</Link>
                          )}
                          <Link to={`/matches/${game.id}`} style={{ fontSize: 12, color: "#7fd9ba" }}>Match Details</Link>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          <div style={{ marginTop: 28 }}>
            <div style={{ fontSize: 15, color: "#8ecab5", letterSpacing: 0.4, marginBottom: 16 }}>Social</div>
            
            {/* Friendship Action Buttons */}
            {!isOwnProfile && (
              <div style={{ marginBottom: 20, display: "flex", gap: 12, flexWrap: "wrap" }}>
                {friendship.status === "accepted" && (
                  <button
                    onClick={handleFriendAction}
                    disabled={friendActionBusy}
                    style={{
                      background: "rgba(220,90,90,0.8)",
                      border: "1px solid rgba(220,90,90,0.4)",
                      color: "#ffe5e5",
                      padding: "8px 16px",
                      borderRadius: 12,
                      fontSize: 13,
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
                      padding: "8px 16px",
                      borderRadius: 12,
                      fontSize: 13,
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
                      padding: "8px 16px",
                      borderRadius: 12,
                      fontSize: 13,
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
                      background: "linear-gradient(135deg,#48c9a9,#2f9c7a)",
                      border: "none",
                      color: "#07271f",
                      padding: "8px 16px",
                      borderRadius: 12,
                      fontSize: 13,
                      fontWeight: 600,
                      cursor: friendActionBusy ? "wait" : "pointer",
                      opacity: friendActionBusy ? 0.6 : 1
                    }}
                  >
                    {friendActionBusy ? "..." : "Anfrage annehmen"}
                  </button>
                )}
              </div>
            )}

            {/* Feedback Messages */}
            {friendActionMsg && (
              <div style={{ marginBottom: 16, padding: "12px", borderRadius: 12, background: "rgba(48,180,120,0.15)", border: "1px solid rgba(48,180,120,0.3)", color: "#90e5b8", fontSize: 13 }}>
                {friendActionMsg}
              </div>
            )}
            
            {friendActionError && (
              <div style={{ marginBottom: 16, padding: "12px", borderRadius: 12, background: "rgba(220,90,90,0.15)", border: "1px solid rgba(220,90,90,0.3)", color: "#f5a5a5", fontSize: 13 }}>
                {friendActionError}
              </div>
            )}

            {/* Friends List */}
            {friends.length > 0 && (
              <div style={{ marginBottom: 20 }}>
                <div style={{ fontSize: 14, color: "#a9d7c4", marginBottom: 12, fontWeight: 600 }}>
                  Freunde ({friends.length})
                </div>
                <div style={{ display: "grid", gap: 12 }}>
                  {friends.slice(0, 6).map((friend) => (
                    <div key={friend.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 12px", borderRadius: 14, background: "rgba(8,28,22,0.78)", border: "1px solid rgba(74,162,131,0.18)" }}>
                      <Avatar userId={friend.id} name={friend.displayName} size={36} />
                      <div style={{ flex: 1 }}>
                        <Link to={`/user/${friend.id}`} style={{ fontWeight: 600, color: "#d6f8ea", textDecoration: "none", fontSize: 14 }}>
                          {friend.displayName}
                        </Link>
                      </div>
                      <Link 
                        to={`/chat/user/${friend.id}`} 
                        style={{ fontSize: 11, color: "#7fd9ba", textDecoration: "none", padding: "4px 8px", borderRadius: 8, background: "rgba(127,217,186,0.1)" }}
                      >
                        Chat
                      </Link>
                    </div>
                  ))}
                  {friends.length > 6 && (
                    <div style={{ textAlign: "center", padding: "8px", color: "#8ecab5", fontSize: 13 }}>
                      +{friends.length - 6} weitere Freunde
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Mutual Friends */}
            {mutualFriends.length > 0 && !isOwnProfile && (
              <div style={{ marginBottom: 20 }}>
                <div style={{ fontSize: 14, color: "#a9d7c4", marginBottom: 12, fontWeight: 600 }}>
                  Gemeinsame Freunde ({mutualFriends.length})
                </div>
                <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                  {mutualFriends.slice(0, 4).map((mutual) => (
                    <Link 
                      key={mutual.id} 
                      to={`/user/${mutual.id}`}
                      style={{ 
                        display: "flex", 
                        alignItems: "center", 
                        gap: 8, 
                        padding: "6px 10px", 
                        borderRadius: 12, 
                        background: "rgba(8,28,22,0.78)", 
                        border: "1px solid rgba(74,162,131,0.18)",
                        textDecoration: "none",
                        fontSize: 13,
                        color: "#d6f8ea"
                      }}
                    >
                      <Avatar userId={mutual.id} name={mutual.displayName} size={24} />
                      {mutual.displayName}
                    </Link>
                  ))}
                </div>
              </div>
            )}

            {/* Rivals Section */}
            <div style={{ fontSize: 14, color: "#a9d7c4", marginBottom: 12, fontWeight: 600 }}>Freunde & Rivalen</div>
            {opponents.length === 0 ? (
              <div style={{ padding: "18px", borderRadius: 16, background: "rgba(12,35,27,0.7)", color: "#9dcfbf" }}>Noch keine Rivalen – starte ein Match!</div>
            ) : (
              <div style={{ display: "grid", gap: 14 }}>
                {opponents.map((opp) => (
                  <div key={opp.id ? `u:${opp.id}` : opp.name} style={{ display: "flex", alignItems: "center", gap: 14, padding: "12px 14px", borderRadius: 16, background: "rgba(8,28,22,0.78)", border: "1px solid rgba(74,162,131,0.18)" }}>
                    <Avatar userId={opp.id || undefined} name={opp.name} size={40} />
                    <div style={{ flex: 1 }}>
                      <Link to={opp.id ? `/user/${opp.id}` : "#"} style={{ fontWeight: 600, color: "#d6f8ea", textDecoration: "none" }}>{opp.name}</Link>
                      <div style={{ fontSize: 12, color: "#8ecab5" }}>{opp.matches} gemeinsame Spiele</div>
                    </div>
                    {opp.id && (
                      <Link to={`/chat/user/${opp.id}`} style={{ fontSize: 12, color: "#7fd9ba" }}>Nachricht</Link>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

        <section style={{ ...bodyCard, padding: "28px" }}>
          <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
            <div>
              <div style={{ fontSize: 20, fontWeight: 700 }}>Ligen & Tabelle</div>
              <div style={{ fontSize: 13, color: "#8bbfad" }}>Wechsle zwischen deinen aktuellen Ligen</div>
            </div>
            {leagues.length > 0 && (
              <select
                value={activeLeagueId || ""}
                onChange={(e) => setActiveLeagueId(e.target.value ? Number(e.target.value) : null)}
                style={{ background: "rgba(9,26,21,0.6)", border: "1px solid rgba(74,162,131,0.35)", color: "#d9f6eb", borderRadius: 12, padding: "6px 10px", fontSize: 13 }}
              >
                {leagues.map((league) => (
                  <option key={league.id} value={league.id}>{league.name}</option>
                ))}
              </select>
            )}
          </header>

          <div style={{ marginTop: 20, display: "grid", gap: 16 }}>
            {leagues.length === 0 ? (
              <div style={{ padding: "18px", borderRadius: 16, background: "rgba(12,35,27,0.7)", color: "#9dcfbf" }}>Noch keiner Liga beigetreten.</div>
            ) : (
              <div style={{ display: "grid", gap: 12 }}>
                {leagues.map((league) => (
                  <div key={league.id} style={{ padding: "14px 18px", borderRadius: 16, background: "rgba(8,28,22,0.78)", border: "1px solid rgba(74,162,131,0.18)", display: "grid", gap: 8 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <Link to={`/league/${league.id}`} style={{ fontSize: 16, fontWeight: 600, color: "#d6f8ea", textDecoration: "none" }}>{league.name}</Link>
                      {league?.joined_at && (
                        <div style={{ fontSize: 12, color: "#8ecab5" }}>seit {new Date(league.joined_at).toLocaleDateString("de-DE")}</div>
                      )}
                    </div>
                    <div style={{ fontSize: 13, color: "#8bbfad" }}>{[league.city, league.sport].filter(Boolean).join(" · ")}</div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div style={{ marginTop: 26 }}>
            <div style={{ fontSize: 15, color: "#8ecab5", letterSpacing: 0.4 }}>Tabellenausschnitt</div>
            {standingsLoading ? (
              <div style={{ marginTop: 14, padding: 18, borderRadius: 16, background: "rgba(12,35,27,0.7)", color: "#9dcfbf" }}>Lade Tabelle …</div>
            ) : standingsErr ? (
              <div style={{ marginTop: 14, padding: 18, borderRadius: 16, background: "rgba(60,20,20,0.6)", color: "#ffb1b1" }}>Fehler: {standingsErr}</div>
            ) : standingsWindow.length === 0 ? (
              <div style={{ marginTop: 14, padding: 18, borderRadius: 16, background: "rgba(12,35,27,0.7)", color: "#9dcfbf" }}>Keine Tabellendaten verfügbar.</div>
            ) : (
              <div style={{ marginTop: 16 }}>
                <div style={{ display: "grid", gridTemplateColumns: "48px 1fr 70px 70px 60px 60px", gap: 12, fontSize: 12, color: "#8bbfad", textTransform: "uppercase", letterSpacing: 0.8 }}>
                  <div>Platz</div>
                  <div>Team</div>
                  <div style={{ textAlign: "center" }}>Sp.</div>
                  <div style={{ textAlign: "center" }}>S-U-N</div>
                  <div style={{ textAlign: "center" }}>Diff</div>
                  <div style={{ textAlign: "center" }}>Pkt.</div>
                </div>
                <div style={{ display: "grid", gap: 8, marginTop: 10 }}>
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
                          gridTemplateColumns: "48px 1fr 70px 70px 60px 60px",
                          gap: 12,
                          alignItems: "center",
                          padding: "11px 12px",
                          borderRadius: 14,
                          background: isMe ? "rgba(76,184,144,0.25)" : "rgba(8,28,22,0.78)",
                          border: isMe ? "1px solid rgba(108,225,190,0.6)" : "1px solid rgba(74,162,131,0.18)"
                        }}
                      >
                        <div style={{ fontWeight: 700 }}>{row.rank}</div>
                        <div style={{ fontWeight: 600 }}>
                          {teamLink ? (
                            <Link to={teamLink} style={{ color: "#d6f8ea", textDecoration: "none" }}>{row.name}</Link>
                          ) : (
                            row.name
                          )}
                        </div>
                        <div style={{ textAlign: "center" }}>{row.played}</div>
                        <div style={{ textAlign: "center" }}>{row.won}-{row.drawn}-{row.lost}</div>
                        <div style={{ textAlign: "center" }}>{diff}</div>
                        <div style={{ textAlign: "center", fontWeight: 700 }}>{row.points}</div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
