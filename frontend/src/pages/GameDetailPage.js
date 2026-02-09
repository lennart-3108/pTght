import React, { useState, useEffect, useMemo } from "react";
import { Link, useParams, useNavigate } from "react-router-dom";
import { API_BASE } from "../config";
import { handleInvalidToken } from "../utils/auth";
import { useResponsive } from "../hooks/useResponsive";
import Counter from "../components/Counter";
import TimeCounter from "../components/TimeCounter";
import Avatar from "../components/Avatar";
import BookingConfirmationPopup from "../components/BookingConfirmationPopup";
import BookingWidget from "../components/BookingWidget";
import TerminManagerKalender from "../components/TerminManagerKalender";
import LocationSelector from "../components/LocationSelector";
import CommentsSection from "../components/CommentsSection";
import TennisResultEntry from "../components/TennisResultEntry";

export default function GameDetailPage() {
  const { gameId } = useParams();
  const navigate = useNavigate();
  
  // Dynamic responsive hook
  const isMobile = useResponsive(768);
  const isTablet = useResponsive(1024);
  const [game, setGame] = useState(null);
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(true);
  // auth token for optional result submission
  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;

  // decode JWT (locally) to get the current viewer's user id without extra /me call
  function decodeJwt(t) {
    try {
      const p = t.split(".")[1];
      const json = atob(p.replace(/-/g, "+").replace(/_/g, "/"));
      return JSON.parse(
        decodeURIComponent(
          json
            .split("")
            .map((c) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2))
            .join("")
        )
      );
    } catch {
      return null;
    }
  }

  const viewer = token ? decodeJwt(token) : null;
  const viewerId = viewer && (viewer.id || viewer.userId || viewer.user_id);
  const [hScore, setHScore] = useState(0);
  const [aScore, setAScore] = useState(0);
  const [submitMsg, setSubmitMsg] = useState('');
  // Tennis result state
  const [tennisResult, setTennisResult] = useState({ numSets: 1 });
  // permission to submit result (must be declared before any early return)
  const [canSubmit, setCanSubmit] = useState(false);
  const [cannotReason, setCannotReason] = useState('');
  // weekly status for league (to disable join when already has a weekly match)
  const [hasWeeklyMatch, setHasWeeklyMatch] = useState(false);
  const [joinMsg, setJoinMsg] = useState('');
  const [scheduleMsg, setScheduleMsg] = useState('');
  const [scheduleLoading, setScheduleLoading] = useState(false);
  const [submitLoading, setSubmitLoading] = useState(false);
  // calendar-friendly date+time fields (pop up native calendar/time pickers)
  // Initialize with tomorrow's date (for demo, since test slots are for tomorrow)
  const [dateStr, setDateStr] = useState(() => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    return tomorrow.toISOString().split('T')[0];
  });
  const [timeStr, setTimeStr] = useState(""); // HH:mm
  const [location, setLocation] = useState("");
  // Time counter state - default to next full hour
  const [scheduleHours, setScheduleHours] = useState(() => {
    const now = new Date();
    return now.getMinutes() > 0 ? (now.getHours() + 1) % 24 : now.getHours();
  });
  const [scheduleMinutes, setScheduleMinutes] = useState(0);
  const [booking, setBooking] = useState(null); // Store confirmed booking data
  const [chatUnread, setChatUnread] = useState(false); // Chat unread status
  const [userProfile, setUserProfile] = useState(null); // User profile with location
  const [proposalActionMsg, setProposalActionMsg] = useState('');
  const [proposalActionLoading, setProposalActionLoading] = useState(false);
  
  // Comments and likes state
  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState('');
  const [commentLoading, setCommentLoading] = useState(false);
  const [likes, setLikes] = useState(0);
  const [hasLiked, setHasLiked] = useState(false);
  const [likeLoading, setLikeLoading] = useState(false);

  // Layout policy: keep three cards always side-by-side; enable horizontal scrolling on small screens

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    setErr("");
    fetch(`${API_BASE}/matches/${gameId}`)
      .then(async (r) => {
        const j = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(j?.error || `HTTP ${r.status}`);
        return j;
      })
      .then(j => mounted && setGame(j))
      .catch(e => mounted && setErr(e.message || "Fehler"))
      .finally(() => mounted && setLoading(false));
    
    // Fetch booking data for this match
    fetch(`${API_BASE}/bookings/match/${gameId}`)
      .then(async (r) => {
        if (r.status === 404) return null; // No booking yet
        const j = await r.json().catch(() => null);
        if (!r.ok) return null;
        return j;
      })
      .then(bookingData => mounted && setBooking(bookingData))
      .catch(() => {}); // Silently fail if no booking
    
    // Fetch comments
    fetch(`${API_BASE}/matches/${gameId}/comments`)
      .then(async (r) => {
        if (!r.ok) return [];
        const data = await r.json().catch(() => []);
        return Array.isArray(data) ? data : [];
      })
      .then(commentsData => mounted && setComments(commentsData))
      .catch(() => {});
    
    // Fetch likes
    fetch(`${API_BASE}/matches/${gameId}/likes`)
      .then(async (r) => {
        if (!r.ok) return { count: 0, hasLiked: false };
        return r.json().catch(() => ({ count: 0, hasLiked: false }));
      })
      .then(likesData => {
        if (mounted) {
          setLikes(likesData.count || 0);
          setHasLiked(likesData.hasLiked || false);
        }
      })
      .catch(() => {});
    
    // Fetch chat unread status
    if (token) {
      fetch(`${API_BASE}/matches/${gameId}/chat`, {
        headers: { Authorization: `Bearer ${token}` }
      })
        .then(async (r) => {
          if (!r.ok) return null;
          const data = await r.json().catch(() => null);
          return data;
        })
        .then(data => {
          if (mounted && data?.meta) {
            setChatUnread(data.meta.unread > 0);
          }
        })
        .catch(() => {});
      
      // Fetch user profile for location preference
      fetch(`${API_BASE}/profile`, {
        headers: { Authorization: `Bearer ${token}` }
      })
        .then(async (r) => {
          if (!r.ok) return null;
          return r.json().catch(() => null);
        })
        .then(profile => {
          if (mounted && profile) {
            setUserProfile(profile);
          }
        })
        .catch(() => {});
    }
    
    return () => { mounted = false; };
  }, [gameId]);

  function formatDate(input) {
    if (!input) return "-";
    const d = new Date(input);
    if (Number.isNaN(d.getTime())) return "-";
    // German long date
    const opts = { year: 'numeric', month: 'long', day: 'numeric' };
    return d.toLocaleDateString('de-DE', opts);
  }
  function formatTime(input) {
    if (!input) return "";
    const d = new Date(input);
    if (Number.isNaN(d.getTime())) return "";
    return d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
  }

  // Handle booking cancellation
  const handleCancelBooking = async () => {
    setBooking(null); // Clear booking immediately
    // Reload match data to get updated location/asset info
    try {
      const r = await fetch(`${API_BASE}/matches/${gameId}`);
      const j = await r.json();
      if (r.ok) setGame(j);
    } catch (e) {
      console.error('Failed to reload match:', e);
    }
  };

  const relativeFromNow = useMemo(() => (when) => {
    if (!when) return "";
    const d = new Date(when);
    if (Number.isNaN(d.getTime())) return "";
    const now = new Date();
    const diff = d.getTime() - now.getTime();
    const abs = Math.abs(diff);
    const days = Math.floor(abs / (24*60*60*1000));
    if (days >= 2) return diff >= 0 ? `in ${days} Tagen` : `vor ${days} Tagen`;
    const hours = Math.floor(abs / (60*60*1000));
    if (hours >= 1) return diff >= 0 ? `in ${hours} Stunden` : `vor ${hours} Stunden`;
    const mins = Math.max(1, Math.floor(abs / (60*1000)));
    return diff >= 0 ? `in ${mins} Minuten` : `vor ${mins} Minuten`;
  }, []);
  
  // Time remaining until deadline (for kickoff_end_at)
  const timeRemaining = useMemo(() => (when) => {
    if (!when) return "";
    const d = new Date(when);
    if (Number.isNaN(d.getTime())) return "";
    const now = new Date();
    const diff = d.getTime() - now.getTime();
    if (diff < 0) return "abgelaufen";
    const days = Math.floor(diff / (24*60*60*1000));
    if (days >= 2) return `noch ${days} Tage`;
    if (days === 1) return `noch 1 Tag`;
    const hours = Math.floor(diff / (60*60*1000));
    if (hours >= 1) return `noch ${hours} Stunden`;
    const mins = Math.max(1, Math.floor(diff / (60*1000)));
    return `noch ${mins} Minuten`;
  }, []);
  // fetch league games to build player histories
  const [leagueGames, setLeagueGames] = useState([]);
  const leagueId = game?.leagueId || null;
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        if (!leagueId) {
          if (mounted) setLeagueGames([]);
          return;
        }
        const r = await fetch(`${API_BASE}/leagues/${leagueId}/games`);
        if (!r.ok) return;
        const j = await r.json().catch(() => null);
        if (!mounted) return;
        const arr = Array.isArray(j) ? j : (j && j.upcoming ? (j.upcoming.concat(j.completed || [])) : []);
        setLeagueGames(Array.isArray(arr) ? arr : []);
      } catch (e) {
        // ignore
      }
    })();
    return () => { mounted = false; };
  }, [leagueId]);

  // fetch my weekly status for this league (if logged in)
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        if (!token || !leagueId) { if (mounted) setHasWeeklyMatch(false); return; }
        const r = await fetch(`${API_BASE}/leagues/${leagueId}/my-weekly-status`, { headers: { Authorization: `Bearer ${token}` } });
        if (!r.ok) { if (mounted) setHasWeeklyMatch(false); return; }
        const j = await r.json().catch(() => ({ hasWeeklyMatch: false }));
        if (mounted) setHasWeeklyMatch(!!j.hasWeeklyMatch);
      } catch { if (mounted) setHasWeeklyMatch(false); }
    })();
    return () => { mounted = false; };
  }, [token, leagueId]);

  // fetch standings (completed matches) to compute simple table positions
  const [standings, setStandings] = useState([]);
  // control schedule form visibility
  const [showSchedule, setShowSchedule] = useState(true);
  // Termin-Manager
  const [showTerminManager, setShowTerminManager] = useState(false);
  const [terminMeta, setTerminMeta] = useState(null);
  const [terminProposal, setTerminProposal] = useState(null);
    // Load termin-manager status to show the correct button label
    useEffect(() => {
      if (!token || !gameId) return;
      if (!game) return;
      // Only relevant when both sides are assigned and match not completed
      if (!(game.home_score == null && game.away_score == null && ((game.home_user_id != null || game.home) && (game.away_user_id != null || game.away)))) return;

      let cancelled = false;
      const controller = new AbortController();
      (async () => {
        try {
          const res = await fetch(`${API_BASE}/matches/${gameId}/termin-manager`, {
            headers: { Authorization: `Bearer ${token}` },
            signal: controller.signal
          });
          const data = await res.json().catch(() => ({}));
          if (!res.ok) return;
          if (cancelled) return;
          setTerminMeta(data?.meta || null);
          setTerminProposal(data?.proposal || null);
        } catch {
          // ignore
        }
      })();
      return () => {
        cancelled = true;
        controller.abort();
      };
    }, [token, gameId, game]);

    const terminButtonLabel = useMemo(() => {
      const viewerUserId = terminMeta?.viewerUserId || viewerId || null;
      if (terminProposal && terminProposal.status === 'accepted') return 'Termin ändern';
      if (!terminProposal || terminProposal.status !== 'sent') return 'Termin vereinbaren';
      if (viewerUserId != null && Number(terminProposal.proposerUserId) === Number(viewerUserId)) return 'Einladung gesendet';
      return 'Termin vorschlag erhalten';
    }, [terminProposal, terminMeta, viewerId]);
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        if (!leagueId) {
          if (mounted) setStandings([]);
          return;
        }
        const r = await fetch(`${API_BASE}/leagues/${leagueId}/standings`);
        if (!r.ok) return;
        const rows = await r.json().catch(() => []);
        if (!mounted) return;
        setStandings(Array.isArray(rows) ? rows : []);
      } catch (e) {
        // ignore
      }
    })();
    return () => { mounted = false; };
  }, [leagueId]);

  // fetch permission for submitting result
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        if (!token || !gameId) { if (mounted){ setCanSubmit(false); setCannotReason(''); } return; }
        const r = await fetch(`${API_BASE}/matches/${gameId}/can-submit`, { headers: { Authorization: `Bearer ${token}` } });
        const j = await r.json().catch(() => ({ canSubmit: false }));
        if (!mounted) return;
        setCanSubmit(!!j.canSubmit);
        setCannotReason(j.reason || '');
      } catch {
        if (mounted) { setCanSubmit(false); setCannotReason(''); }
      }
    })();
    return () => { mounted = false; };
  }, [token, gameId, game?.kickoff_at]);

  // when game kickoff is present, prefill calendar fields with local date+time
  useEffect(() => {
    if (!game?.kickoff_at) return;
    const d = new Date(game.kickoff_at);
    if (Number.isNaN(d.getTime())) return;
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    const hh = d.getHours();
    const mi = d.getMinutes();
    setDateStr(`${yyyy}-${mm}-${dd}`);
    setScheduleHours(hh);
    setScheduleMinutes(mi);
    // prefill location if present
    setLocation(String(game.location || '').trim());
  }, [game?.kickoff_at]);

  // also prefill location when it loads even if no kickoff set yet
  useEffect(() => {
    if (!game) return;
    setLocation(String(game.location || '').trim());
  }, [game?.location]);

  // decide default visibility of schedule form
  useEffect(() => {
    setShowSchedule(!game?.kickoff_at);
  }, [game?.kickoff_at]);

  // Update timeStr when scheduleHours or scheduleMinutes change
  useEffect(() => {
    const hh = String(scheduleHours).padStart(2, '0');
    const mm = String(scheduleMinutes).padStart(2, '0');
    setTimeStr(`${hh}:${mm}`);
  }, [scheduleHours, scheduleMinutes]);

  if (loading) return <div style={{ padding: 16 }}>Lade Spiel ...</div>;
  if (err) {
    if (handleInvalidToken(err, navigate)) return null;
    return <div style={{ padding: 16, color: "crimson" }}>Fehler: {err}</div>;
  }
  if (!game) return <div style={{ padding: 16 }}>Kein Spiel gefunden.</div>;

  const playerA = { name: game.home_user_name || game.home || "-", id: game.home_user_id || null };
  const playerB = { name: game.away_user_name || game.away || "-", id: game.away_user_id || null };

  const isParticipant = viewerId && (
    (game.home_user_id != null && String(game.home_user_id) === String(viewerId)) ||
    (game.away_user_id != null && String(game.away_user_id) === String(viewerId))
  );
  const isCompleted = (game.home_score != null && game.away_score != null);

  const statusLabel = (() => {
    if (game.home_score != null && game.away_score != null) return 'Absolviert';
    
    // Check if match is scheduled (status = 'scheduled' or has accepted proposal)
    if (game.status === 'scheduled' || (terminProposal && terminProposal.status === 'accepted')) {
      return 'Match geplant';
    }

    const now = new Date();

    // For open time windows (fixed/range), a match is not "absolviert" just because the window started.
    // Only after the window end has passed, we treat it as "Absolviert / ohne Ergebnis".
    const isOpenWindow = game.when_type === 'fixed' || game.when_type === 'range' || (!!game.kickoff_end_at && game.when_type !== 'exact');
    if (isOpenWindow) {
      if (!game.kickoff_end_at) return 'Termin ausstehend';
      const end = new Date(game.kickoff_end_at);
      if (Number.isNaN(end.getTime())) return 'Match ausstehend';
      if (now.getTime() >= end.getTime()) return 'Absolviert / ohne Ergebnis';
      return 'Match ausstehend';
    }

    if (!game.kickoff_at) return 'Termin ausstehend';
    const kickoff = new Date(game.kickoff_at);
    if (Number.isNaN(kickoff.getTime())) return 'Match ausstehend';

    const diffMs = now.getTime() - kickoff.getTime();
    if (diffMs >= 0) {
      const diffMin = diffMs / 60000;
      if (diffMin < 60) return 'Live';
      if (diffMin < 120) return 'Laufend';
      return 'Absolviert / ohne Ergebnis';
    }

    const sameDay = now.getFullYear() === kickoff.getFullYear() && now.getMonth() === kickoff.getMonth() && now.getDate() === kickoff.getDate();
    if (sameDay) return 'Heute';
    return 'Match ausstehend';
  })();

  // compute simple table positions from standings (win=3, draw=1, loss=0)
  function computeTablePositions(rows) {
    const map = Object.create(null);
    (rows || []).forEach(r => {
      const h = String(r.home || '').trim();
      const a = String(r.away || '').trim();
      const hs = Number(r.home_score || 0);
      const as = Number(r.away_score || 0);
      if (!h || !a) return;
      map[h] = map[h] || { name: h, played: 0, points: 0, gf: 0, ga: 0 };
      map[a] = map[a] || { name: a, played: 0, points: 0, gf: 0, ga: 0 };
      map[h].played += 1; map[a].played += 1;
      map[h].gf += hs; map[h].ga += as;
      map[a].gf += as; map[a].ga += hs;
      if (hs > as) { map[h].points += 3; }
      else if (hs < as) { map[a].points += 3; }
      else { map[h].points += 1; map[a].points += 1; }
    });
    const arr = Object.values(map);
    arr.sort((x,y) => (y.points - x.points) || ((y.gf - y.ga) - (x.gf - x.ga)) || (y.gf - x.gf));
    const pos = Object.create(null);
    arr.forEach((row, idx) => { pos[row.name] = { rank: idx + 1, ...row }; });
    return pos;
  }
  const tablePositions = computeTablePositions(standings);


  function filterHistoryForPlayer(player) {
    if (!player) return [];
    return (leagueGames || []).filter(g => {
      // exclude the current match from history
      const currentId = String(game?.id || gameId || '') ;
      if (String(g.id || '') === currentId) return false;
      const homeMatch = String(g.home || g.home_text || "").trim();
      const awayMatch = String(g.away || g.away_text || "").trim();
      // if user ids are present in league games, prefer them
      if (player.id && (g.home_user_id || g.away_user_id)) {
        return String(g.home_user_id) === String(player.id) || String(g.away_user_id) === String(player.id);
      }
      // fallback to name match
      return homeMatch === String(player.name) || awayMatch === String(player.name);
    }).map(g => ({ id: g.id, date: g.kickoff_at || g.date || null, home: g.home, away: g.away, score: (g.home_score != null && g.away_score != null) ? `${g.home_score}:${g.away_score}` : null }));
  }

  const histA = filterHistoryForPlayer(playerA);
  const histB = filterHistoryForPlayer(playerB);

  // Mobile responsive layout styles (now using dynamic hook)
  const containerStyle = { 
    padding: isMobile ? 8 : 16, 
    width: '100%', 
    maxWidth: '900px', 
    margin: '0 auto', 
    fontFamily: 'Inter, Roboto, Arial, sans-serif', 
    color: '#e8efe8' 
  };
  const cardStyle = { 
    background: '#0f2a20', 
    borderRadius: isMobile ? 12 : 16, 
    padding: isMobile ? 12 : 16, 
    boxShadow: isMobile ? '0 8px 24px rgba(0,0,0,0.4)' : '0 16px 40px rgba(0,0,0,0.55)' 
  };

  async function submitResult(e) {
    e.preventDefault();
    setSubmitMsg('');
    setSubmitLoading(true);
    if (!token) { 
      setSubmitMsg('Bitte einloggen.'); 
      setSubmitLoading(false);
      return; 
    }
    try {
      // Add timeout for better UX
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000); // 15s timeout
      
      // Determine if this is tennis and use appropriate data
      const isTennis = game?.sport?.toLowerCase().includes('tennis') || 
                       game?.sportType?.toLowerCase().includes('tennis');
      
      const requestBody = isTennis && tennisResult ? {
        home_score: tennisResult.home_score,
        away_score: tennisResult.away_score,
        sets: tennisResult.sets,
        aborted: tennisResult.aborted,
        abort_reason: tennisResult.abort_reason,
        abort_by: tennisResult.abort_by
      } : {
        home_score: hScore,
        away_score: aScore
      };
      
      const r = await fetch(`${API_BASE}/matches/${gameId}/result`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(requestBody),
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j?.error || `HTTP ${r.status}`);
      
      setSubmitMsg('✅ Ergebnis gespeichert!');
      setGame(j);
      // Redirect to league after confirmation
      setTimeout(() => { window.location.href = `/league/${leagueId || ''}`; }, 1200);
    } catch (e) {
      if (e.name === 'AbortError') {
        setSubmitMsg('⚠️ Zeitüberschreitung - Versuche es nochmal.');
      } else {
        setSubmitMsg('❌ ' + (e.message || 'Fehler beim Speichern.'));
      }
    } finally {
      setSubmitLoading(false);
    }
  }

  async function joinMatch() {
    setJoinMsg('');
    if (!token) { setJoinMsg('Bitte einloggen.'); return; }
    try {
      const r = await fetch(`${API_BASE}/matches/${gameId}/join`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j?.error || `HTTP ${r.status}`);
      setJoinMsg('Beigetreten.');
      // Re-fetch canonical projection to ensure names and permissions are fresh
      const fres = await fetch(`${API_BASE}/matches/${gameId}`);
      const fresh = await fres.json().catch(() => j);
      setGame(fres.ok ? fresh : j);
    } catch (e) {
      setJoinMsg(e.message || 'Beitreten fehlgeschlagen.');
    }
  }

  async function scheduleMatch(e) {
    e.preventDefault();
    setScheduleMsg('');
    setScheduleLoading(true);
    
    if (!token) { 
      setScheduleMsg('Bitte einloggen.'); 
      setScheduleLoading(false);
      return; 
    }
    if (!dateStr || !timeStr) { 
      setScheduleMsg('Bitte Datum und Uhrzeit wählen.'); 
      setScheduleLoading(false);
      return; 
    }
    
    const scheduleAt = `${dateStr}T${timeStr}`; // local time string, backend will parse
    try {
      // Add timeout for better UX
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000); // 15s timeout
      
      setScheduleMsg('⏳ Speichere Termin...');
      
      const r = await fetch(`${API_BASE}/matches/${gameId}/schedule`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ kickoff_at: scheduleAt, location: location && location.trim() ? location.trim() : undefined }),
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j?.error || `HTTP ${r.status}`);
      
      setScheduleMsg('✅ Termin gespeichert!');
      
      // Optimistic update first for instant feedback
      setGame(prevGame => ({
        ...prevGame,
        kickoff_at: scheduleAt,
        location: location?.trim() || prevGame?.location
      }));
      
      // Then reload data in background (non-blocking)
      setTimeout(async () => {
        try {
          const fres = await fetch(`${API_BASE}/matches/${gameId}`);
          const fresh = await fres.json().catch(() => j);
          if (fres.ok) setGame(fresh);
          
          // re-check permission after scheduling
          if (token) {
            const cr = await fetch(`${API_BASE}/matches/${gameId}/can-submit`, { headers: { Authorization: `Bearer ${token}` } });
            const cj = await cr.json().catch(() => ({}));
            setCanSubmit(!!cj.canSubmit);
            setCannotReason(cj.reason || '');
          }
        } catch {}
      }, 100);
      
    } catch (e) {
      if (e.name === 'AbortError') {
        setScheduleMsg('⚠️ Zeitüberschreitung - Versuche es nochmal.');
      } else {
        setScheduleMsg('❌ ' + (e.message || 'Termin setzen fehlgeschlagen.'));
      }
    } finally {
      setScheduleLoading(false);
    }
  }

  async function suggestNextSlot() {
    setScheduleMsg('');
    if (!token) { setScheduleMsg('Bitte einloggen.'); return; }
    try {
      const baseAt = dateStr && timeStr ? `${dateStr}T${timeStr}` : undefined;
      const r = await fetch(`${API_BASE}/matches/${gameId}/suggest-slot`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ base_at: baseAt })
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j?.error || `HTTP ${r.status}`);
      if (j && j.suggested_at) {
        const d = new Date(j.suggested_at);
        if (!Number.isNaN(d.getTime())) {
          const yyyy = d.getFullYear();
          const mm = String(d.getMonth() + 1).padStart(2, '0');
          const dd = String(d.getDate()).padStart(2, '0');
          setDateStr(`${yyyy}-${mm}-${dd}`);
          setScheduleHours(d.getHours());
          setScheduleMinutes(d.getMinutes());
          setScheduleMsg('Vorschlag übernommen. Bitte speichern.');
        }
      }
    } catch (e) {
      setScheduleMsg(e.message || 'Vorschlag fehlgeschlagen.');
    }
  }

  async function cancelMatch() {
    setScheduleMsg('');
    if (!token) { setScheduleMsg('Bitte einloggen.'); return; }
    try {
      const r = await fetch(`${API_BASE}/matches/${gameId}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j?.error || `HTTP ${r.status}`);
      // after deletion, navigate back to league overview
  navigate(leagueId ? `/league/${leagueId}` : '/leagues', { replace: true });
    } catch (e) {
      setScheduleMsg(e.message || 'Absagen fehlgeschlagen.');
    }
  }

  async function acceptProposal(proposalId) {
    if (!token) return;
    setProposalActionLoading(true);
    setProposalActionMsg('');
    try {
      const res = await fetch(`${API_BASE}/matches/${gameId}/termin-manager/proposals/${proposalId}/accept`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Fehler beim Annehmen');
      setProposalActionMsg('✅ Termin angenommen! Match-Startdatum wurde gesetzt.');
      // Reload termin manager data
      const terminRes = await fetch(`${API_BASE}/matches/${gameId}/termin-manager`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const terminData = await terminRes.json().catch(() => ({}));
      if (terminRes.ok) {
        setTerminMeta(terminData?.meta || null);
        setTerminProposal(terminData?.proposal || null);
      }
      // Reload game data to get updated kickoff_at
      const gameRes = await fetch(`${API_BASE}/matches/${gameId}`);
      const gameData = await gameRes.json().catch(() => ({}));
      if (gameRes.ok) setGame(gameData);
    } catch (e) {
      setProposalActionMsg(e.message || 'Fehler');
    } finally {
      setProposalActionLoading(false);
    }
  }

  async function rejectProposal(proposalId) {
    if (!token) return;
    setProposalActionLoading(true);
    setProposalActionMsg('');
    try {
      const res = await fetch(`${API_BASE}/matches/${gameId}/termin-manager/proposals/${proposalId}/reject`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Fehler beim Ablehnen');
      setProposalActionMsg('Terminvorschlag abgelehnt');
      // Reload termin manager data
      const terminRes = await fetch(`${API_BASE}/matches/${gameId}/termin-manager`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const terminData = await terminRes.json().catch(() => ({}));
      if (terminRes.ok) {
        setTerminMeta(terminData?.meta || null);
        setTerminProposal(terminData?.proposal || null);
      }
      setTimeout(() => setProposalActionMsg(''), 3000);
    } catch (e) {
      setProposalActionMsg(e.message || 'Fehler');
    } finally {
      setProposalActionLoading(false);
    }
  }

  function counterProposal() {
    setShowTerminManager(true);
  }

  return (
    <div style={containerStyle}>
      {/* Hero match card */}
      <div style={{ ...cardStyle, padding: isMobile ? 12 : 20, background: 'linear-gradient(145deg, #102a22, #0c1f1a)' }}>
        {/* Join CTA for open matches (viewer is not host and opponent missing) */}
        {(token && game && game.home_score == null && game.away_score == null && (game.away_user_id == null && !game.away) && !(viewerId && game.home_user_id && String(game.home_user_id) === String(viewerId))) && (() => {
          const isOpenMatch = game.league === 'Open Matches' || (game.league && game.league.includes('Open Matches'));
          const canJoin = isOpenMatch || !hasWeeklyMatch;
          return (
            <div style={{
              padding: isMobile ? '16px' : '24px',
              background: 'linear-gradient(135deg, rgba(47, 107, 87, 0.3), rgba(47, 107, 87, 0.18))',
              border: '2px solid rgba(222, 188, 124, 0.6)',
              borderRadius: 16,
              marginBottom: isMobile ? 16 : 20,
              boxShadow: '0 6px 24px rgba(0,0,0,0.35)'
            }}>
              <div style={{ 
                fontSize: isMobile ? 17 : 20, 
                fontWeight: 800, 
                color: '#debc7c', 
                marginBottom: isMobile ? 10 : 12, 
                display: 'flex', 
                alignItems: 'center', 
                gap: 8,
                letterSpacing: '0.3px'
              }}>
                <span style={{ fontSize: isMobile ? 22 : 28 }}>🏆</span>
                Mitspieler gesucht!
              </div>
              <div style={{ 
                color: '#e8efe8', 
                fontSize: isMobile ? 13 : 15, 
                marginBottom: isMobile ? 14 : 18, 
                lineHeight: 1.6,
                fontWeight: 500
              }}>
                {playerA.name} sucht einen Gegner für dieses Match. Tritt bei und fordere ihn heraus!
              </div>
              <button
                onClick={joinMatch}
                disabled={!canJoin}
                style={{
                  padding: isMobile ? '12px 18px' : '16px 28px',
                  borderRadius: 14,
                  border: 'none',
                  background: canJoin ? 'linear-gradient(135deg, #debc7c, #c9a75f)' : 'rgba(58, 74, 69, 0.5)',
                  color: canJoin ? '#10261f' : '#666',
                  cursor: canJoin ? 'pointer' : 'not-allowed',
                  fontWeight: 800,
                  fontSize: isMobile ? 14 : 16,
                  width: '100%',
                  boxShadow: canJoin ? '0 8px 20px rgba(222, 188, 124, 0.45)' : 'none',
                  transition: 'all 0.3s ease',
                  transform: canJoin ? 'scale(1)' : 'scale(0.98)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px'
                }}
                onMouseEnter={(e) => {
                  if (canJoin) {
                    e.target.style.transform = 'scale(1.02)';
                    e.target.style.boxShadow = '0 10px 24px rgba(222, 188, 124, 0.55)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (canJoin) {
                    e.target.style.transform = 'scale(1)';
                    e.target.style.boxShadow = '0 8px 20px rgba(222, 188, 124, 0.45)';
                  }
                }}
              >
                {isOpenMatch ? '✨ Jetzt beitreten' : '⚔️ Challenge annehmen'}
              </button>
              {!canJoin && !isOpenMatch && (
                <div style={{ 
                  marginTop: 12, 
                  color: '#c5d9ce', 
                  fontSize: isMobile ? 12 : 13, 
                  textAlign: 'center',
                  fontWeight: 500,
                  padding: '8px',
                  background: 'rgba(100, 100, 100, 0.2)',
                  borderRadius: 8
                }}>
                  Du hast diese Woche bereits ein Match in dieser Liga.
                </div>
              )}
            </div>
          );
        })()}
        
        {/* Terminvorschlag Widget - 1:1 wie im Termin Manager */}
        {terminProposal && terminProposal.status === 'sent' && (() => {
          const viewerIdNum = Number(viewerId);
          const byYou = viewerIdNum && Number(terminProposal.proposerUserId) === viewerIdNum;
          const canAccept = viewerIdNum && Number(terminProposal.recipientUserId) === viewerIdNum;
          const dt = terminProposal.proposed_datetime ? new Date(terminProposal.proposed_datetime) : null;
          
          return (
            <div style={{ marginTop: isMobile ? 12 : 16 }}>
              <div style={{ 
                marginBottom: isMobile ? 6 : 8,
                fontSize: isMobile ? 12 : 14,
                fontWeight: 600,
                color: '#debc7c'
              }}>
                📅 Terminvorschlag
              </div>
              
              {proposalActionMsg && (
                <div style={{
                  padding: isMobile ? 8 : 10,
                  marginBottom: isMobile ? 8 : 10,
                  borderRadius: 8,
                  background: proposalActionMsg.includes('✅') || proposalActionMsg.includes('angenommen') ? 'rgba(74, 157, 95, 0.15)' : 'rgba(255, 107, 107, 0.15)',
                  border: `1px solid ${proposalActionMsg.includes('✅') || proposalActionMsg.includes('angenommen') ? '#4a9d5f' : '#ff6b6b'}`,
                  color: proposalActionMsg.includes('✅') || proposalActionMsg.includes('angenommen') ? '#6bff9d' : '#ff6b6b',
                  fontSize: isMobile ? 11 : 13
                }}>
                  {proposalActionMsg}
                </div>
              )}
              
              <div style={{
                display: 'flex',
                flexDirection: isMobile ? 'column' : 'row',
                justifyContent: 'space-between',
                alignItems: isMobile ? 'flex-start' : 'center',
                gap: isMobile ? 8 : 12,
                padding: isMobile ? '10px 12px' : '12px 14px',
                backgroundColor: '#0f2a20',
                border: '1px solid #26493c',
                borderRadius: 10
              }}>
                <div>
                  <div style={{ fontWeight: 700, color: '#e8efe8', fontSize: isMobile ? 13 : 14 }}>
                    {dt ? dt.toLocaleString('de-DE', { weekday: 'short', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : 'Terminvorschlag'}
                  </div>
                  <div style={{ color: '#9db', fontSize: isMobile ? 11 : 13 }}>
                    {byYou ? 'von dir' : 'vom Gegner'} · Status: <span style={{ color: '#c9a75f' }}>ausstehend</span>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: isMobile ? 6 : 8, flexWrap: 'wrap' }}>
                  {canAccept ? (
                    <>
                      <button 
                        onClick={() => acceptProposal(terminProposal.id)} 
                        disabled={proposalActionLoading}
                        style={{
                          background: 'linear-gradient(135deg, #debc7c, #c9a75f)',
                          color: '#10261f',
                          border: 'none',
                          padding: isMobile ? '8px 12px' : '10px 16px',
                          fontSize: isMobile ? 12 : 14,
                          fontWeight: 700,
                          cursor: proposalActionLoading ? 'not-allowed' : 'pointer',
                          borderRadius: 10,
                          opacity: proposalActionLoading ? 0.5 : 1
                        }}
                      >
                        Annehmen
                      </button>
                      <button 
                        onClick={counterProposal}
                        disabled={proposalActionLoading}
                        style={{
                          background: 'rgba(222, 188, 124, 0.15)',
                          color: '#debc7c',
                          border: '1px solid #c9a75f',
                          padding: isMobile ? '8px 10px' : '10px 14px',
                          fontSize: isMobile ? 12 : 14,
                          fontWeight: 600,
                          cursor: proposalActionLoading ? 'not-allowed' : 'pointer',
                          borderRadius: 10
                        }}
                      >
                        Gegenvorschlag
                      </button>
                      <button 
                        onClick={() => rejectProposal(terminProposal.id)}
                        disabled={proposalActionLoading}
                        style={{
                          background: 'rgba(38, 73, 60, 0.6)',
                          color: '#cfe',
                          border: '1px solid #26493c',
                          padding: isMobile ? '8px 10px' : '10px 14px',
                          fontSize: isMobile ? 12 : 14,
                          fontWeight: 600,
                          cursor: proposalActionLoading ? 'not-allowed' : 'pointer',
                          borderRadius: 10
                        }}
                      >
                        Ablehnen
                      </button>
                    </>
                  ) : (
                    <button 
                      onClick={() => setShowTerminManager(true)}
                      style={{
                        background: 'rgba(38, 73, 60, 0.6)',
                        color: '#cfe',
                        border: '1px solid #26493c',
                        padding: isMobile ? '8px 10px' : '10px 14px',
                        fontSize: isMobile ? 12 : 14,
                        fontWeight: 600,
                        cursor: 'pointer',
                        borderRadius: 10
                      }}
                    >
                      Details ansehen
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })()}
        
        {/* Mitspieler gesucht Info - für Match Creator (oben im Hero) */}
        {(token && game && game.home_score == null && game.away_score == null && (game.away_user_id == null && !game.away) && viewerId && game.home_user_id && String(game.home_user_id) === String(viewerId)) && (
          <div style={{ 
            marginTop: isMobile ? 16 : 20,
            padding: isMobile ? '16px' : '24px', 
            background: 'linear-gradient(135deg, rgba(47, 107, 87, 0.25), rgba(47, 107, 87, 0.12))',
            border: '2px solid rgba(222, 188, 124, 0.5)',
            borderRadius: 16,
            textAlign: 'center',
            boxShadow: '0 6px 24px rgba(0,0,0,0.3)'
          }}>
            <div style={{ 
              fontSize: isMobile ? 17 : 20, 
              fontWeight: 800, 
              color: '#debc7c', 
              marginBottom: isMobile ? 10 : 14, 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center', 
              gap: 8,
              letterSpacing: '0.3px'
            }}>
              <span style={{ fontSize: isMobile ? 22 : 28 }}>👥</span>
              Mitspieler gesucht
            </div>
            <div style={{ 
              color: '#c5d9ce', 
              fontSize: isMobile ? 13 : 15, 
              lineHeight: 1.6, 
              marginBottom: isMobile ? 10 : 14,
              fontWeight: 500
            }}>
              Dein Match ist veröffentlicht und für alle Spieler sichtbar.
            </div>
            <div style={{ 
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '8px 16px',
              background: 'rgba(222, 188, 124, 0.2)',
              border: '1px solid rgba(222, 188, 124, 0.4)',
              borderRadius: 24,
              fontSize: isMobile ? 12 : 13,
              color: '#debc7c',
              fontWeight: 700
            }}>
              🎯 Spiel aktiv
            </div>
          </div>
        )}

        {/* Header row with action buttons */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8, flexWrap: 'wrap', marginTop: isMobile ? 16 : 20 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
              <div style={{ fontSize: isMobile ? 20 : 28, fontWeight: 800, letterSpacing: '-0.5px', color: '#f4fff8' }}>{game.league || 'Liga'}</div>
              {game.sport && (
                <div style={{
                  padding: '4px 12px',
                  background: 'rgba(47, 107, 87, 0.3)',
                  border: '1px solid rgba(47, 107, 87, 0.5)',
                  borderRadius: 20,
                  fontSize: isMobile ? 12 : 14,
                  fontWeight: 600,
                  color: '#9db',
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px'
                }}>
                  {game.sport}
                </div>
              )}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <div style={{ 
                display: 'inline-flex',
                alignSelf: 'flex-start',
                padding: '4px 10px',
                background: 'rgba(47, 107, 87, 0.25)',
                border: '1px solid rgba(47, 107, 87, 0.5)',
                borderRadius: 6,
                fontSize: isMobile ? 11 : 13,
                color: '#9db',
                fontWeight: 600,
                fontFamily: 'monospace'
              }}>
                Match #{game.id}
              </div>
              <div style={{
                fontSize: isMobile ? 13 : 14,
                color: (booking || (terminProposal && terminProposal.status === 'accepted') || game.kickoff_at) ? '#9db' : '#ff9',
                fontWeight: 500
              }}>
                {booking ? (
                  <>
                    📅 {formatDate(booking.start_time)}
                    {formatTime(booking.start_time) && <span style={{ marginLeft: 6 }}>{formatTime(booking.start_time)}</span>}
                  </>
                ) : (terminProposal && terminProposal.status === 'accepted' && terminProposal.proposed_datetime) ? (
                  <>
                    📅 {formatDate(terminProposal.proposed_datetime)}
                    {formatTime(terminProposal.proposed_datetime) && <span style={{ marginLeft: 6 }}>{formatTime(terminProposal.proposed_datetime)}</span>}
                  </>
                ) : game.kickoff_at ? (
                  <>
                    📅 {formatDate(game.kickoff_at)}
                    {formatTime(game.kickoff_at) && <span style={{ marginLeft: 6 }}>{formatTime(game.kickoff_at)}</span>}
                  </>
                ) : game.when_type === 'range' && game.range_days ? (
                  `📅 In den nächsten ${game.range_days} Tag${game.range_days !== 1 ? 'en' : ''}`
                ) : game.when_type === 'fixed' && game.kickoff_end_at ? (
                  `📅 Zeitraum: ${formatDate(game.kickoff_at || '')} - ${formatDate(game.kickoff_end_at)}`
                ) : game.kickoff_end_at ? (
                  `📅 Bis ${formatDate(game.kickoff_end_at)}`
                ) : (
                  '⏰ Noch kein Termin vereinbart'
                )}
              </div>
            </div>
          </div>
          
          {/* Action buttons moved to top right */}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {token && game && (
              <Link
                to={`/matches/${gameId}/chat`}
                style={{
                  padding: isMobile ? '8px 12px' : '10px 16px',
                  borderRadius: 10,
                  border: '1px solid rgba(47, 107, 87, 0.6)',
                  background: 'linear-gradient(135deg, rgba(14, 42, 34, 0.9), rgba(14, 42, 34, 0.7))',
                  color: '#dfe',
                  fontSize: isMobile ? 13 : 14,
                  fontWeight: 600,
                  textDecoration: 'none',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 8,
                  position: 'relative',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
                  transition: 'all 0.2s ease'
                }}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" style={{ display: 'block' }}>
                  <path d="M4 6C4 4.89543 4.89543 4 6 4H18C19.1046 4 20 4.89543 20 6V14C20 15.1046 19.1046 16 18 16H11.5L7 19.5V16H6C4.89543 16 4 15.1046 4 14V6Z" fill="none" stroke="currentColor" strokeWidth="2" />
                </svg>
                Match-Chat
                {chatUnread && (
                  <span style={{
                    position: 'absolute',
                    top: -6,
                    right: -6,
                    width: 14,
                    height: 14,
                    background: '#ff4444',
                    borderRadius: '50%',
                    border: '2px solid #0c1f1a',
                    boxShadow: '0 0 8px rgba(255, 68, 68, 0.6)'
                  }} />
                )}
              </Link>
            )}
            {(token && game && game.home_score == null && game.away_score == null && !booking && ((game.home_user_id != null || game.home) && (game.away_user_id != null || game.away))) && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'flex-start' }}>
                {game.kickoff_end_at && (
                  <div style={{ fontSize: 13, color: '#ffd35d', fontWeight: 500 }}>
                    {timeRemaining(game.kickoff_end_at).replace('noch', 'Noch')} um den Termin zu vereinbaren
                  </div>
                )}
                <button onClick={() => setShowTerminManager(true)} style={{ 
                  padding: isMobile ? '8px 12px' : '10px 16px', 
                  borderRadius: 10, 
                  border: '1px solid rgba(212, 175, 55, 0.6)', 
                  background: 'linear-gradient(135deg, #d4af37, #b8941f)', 
                  color: '#000', 
                  fontSize: isMobile ? 13 : 14,
                  fontWeight: 600,
                  cursor: 'pointer',
                  boxShadow: '0 6px 20px rgba(212, 175, 55, 0.4)',
                  transition: 'all 0.2s ease'
                }}>
                  {terminButtonLabel}
                </button>
              </div>
            )}
            {(token && game && game.home_score == null && game.away_score == null && (game.away_user_id == null && !game.away) && viewerId && game.home_user_id && String(game.home_user_id) === String(viewerId)) && (
              <button onClick={cancelMatch} style={{ 
                padding: isMobile ? '8px 12px' : '10px 16px', 
                borderRadius: 10, 
                border: '1px solid rgba(85, 63, 63, 0.6)', 
                background: 'linear-gradient(135deg, rgba(42, 27, 27, 0.9), rgba(42, 27, 27, 0.7))', 
                color: '#e9d8d8', 
                fontSize: isMobile ? 13 : 14,
                fontWeight: 600,
                cursor: 'pointer',
                boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
                transition: 'all 0.2s ease'
              }}>ABSAGEN</button>
            )}
          </div>
        </div>

        {/* Date + status in one line */}
        <div style={{ 
          marginTop: isMobile ? 16 : 20, 
          padding: isMobile ? '12px' : '16px 20px',
          background: 'linear-gradient(135deg, rgba(47, 107, 87, 0.15), rgba(47, 107, 87, 0.08))',
          border: '1px solid rgba(47, 107, 87, 0.3)',
          borderRadius: 12,
          display: 'flex', 
          alignItems: 'center', 
          gap: isMobile ? 10 : 16, 
          flexWrap: 'wrap'
        }}>
          <div style={{ fontSize: isMobile ? 15 : 18, fontWeight: 600, color: '#c5d9ce' }}>
            {(game.status === 'scheduled' || (terminProposal && terminProposal.status === 'accepted')) && game.kickoff_at ? (
              <>
                {formatDate(game.kickoff_at)}
                {formatTime(game.kickoff_at) && <span style={{ marginLeft: 8, color: '#9db' }}>{formatTime(game.kickoff_at)}</span>}
              </>
            ) : game.when_type === 'range' && game.kickoff_end_at ? (
              <span>{timeRemaining(game.kickoff_end_at)}</span>
            ) : game.when_type === 'fixed' && game.kickoff_at && game.kickoff_end_at ? (
              <span>Zeitraum: {formatDate(game.kickoff_at)} - {formatDate(game.kickoff_end_at)}</span>
            ) : game.when_type === 'exact' && game.kickoff_at ? (
              <>
                {formatDate(game.kickoff_at)}
                {formatTime(game.kickoff_at) && <span style={{ marginLeft: 8, color: '#9db' }}>{formatTime(game.kickoff_at)}</span>}
              </>
            ) : game.kickoff_at && game.kickoff_end_at ? (
              <span>Zeitraum: {formatDate(game.kickoff_at)} - {formatDate(game.kickoff_end_at)}</span>
            ) : game.kickoff_at ? (
              <>
                {formatDate(game.kickoff_at)}
                {formatTime(game.kickoff_at) && <span style={{ marginLeft: 8, color: '#9db' }}>{formatTime(game.kickoff_at)}</span>}
              </>
            ) : game.kickoff_end_at ? (
              'Zeitraum flexibel'
            ) : (
              'Termin ausstehend'
            )}
          </div>
          <div style={{ 
            display: 'inline-flex', 
            alignItems: 'center', 
            gap: 8,
            padding: '6px 12px',
            background: 'rgba(255, 211, 93, 0.12)',
            border: '1px solid rgba(255, 211, 93, 0.3)',
            borderRadius: 20
          }}>
            <span style={{ width: 10, height: 10, background: '#ffd35d', borderRadius: '50%', boxShadow: '0 0 8px rgba(255, 211, 93, 0.5)' }} />
            <span style={{ color: '#ffd35d', fontSize: isMobile ? 13 : 14, fontWeight: 600 }}>{statusLabel || (isCompleted ? 'Absolviert' : 'Match ausstehend')}</span>
          </div>
          {game.when_type === 'exact' && game.kickoff_at && (
            <div style={{ color: '#9db', fontSize: 14 }}>{relativeFromNow(game.kickoff_at)}</div>
          )}
          {(game.when_type === 'fixed' || game.when_type === 'range') && game.kickoff_end_at && (
            <div style={{ color: '#9db', fontSize: 14 }}>{timeRemaining(game.kickoff_end_at)}</div>
          )}
          {game.kickoff_end_at && !game.kickoff_at && (
            <div style={{ color: '#9db', fontSize: 14 }}>Bis {formatDate(game.kickoff_end_at)}</div>
          )}
        </div>
        
        {/* Date mode indicator when not yet assigned opponent */}
        {(game.home_score == null && game.away_score == null && (game.away_user_id == null && !game.away)) && (
          <div style={{ marginTop: 8, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {game.when_type === 'range' && game.kickoff_end_at && (
              <div style={{ 
                padding: '6px 12px', 
                background: 'rgba(47, 107, 87, 0.2)', 
                border: '1px solid rgba(47, 107, 87, 0.4)',
                borderRadius: 8,
                fontSize: 13,
                color: '#9db'
              }}>
                📅 {timeRemaining(game.kickoff_end_at)}
              </div>
            )}
            {game.when_type === 'fixed' && game.kickoff_at && game.kickoff_end_at && (
              <div style={{ 
                padding: '6px 12px', 
                background: 'rgba(47, 107, 87, 0.2)', 
                border: '1px solid rgba(47, 107, 87, 0.4)',
                borderRadius: 8,
                fontSize: 13,
                color: '#9db'
              }}>
                📅 Zeitraum: {formatDate(game.kickoff_at)} - {formatDate(game.kickoff_end_at)}
              </div>
            )}
            {game.when_type === 'exact' && game.kickoff_at && (
              <div style={{ 
                padding: '6px 12px', 
                background: 'rgba(47, 107, 87, 0.2)', 
                border: '1px solid rgba(47, 107, 87, 0.4)',
                borderRadius: 8,
                fontSize: 13,
                color: '#9db'
              }}>
                📅 Festes Datum
              </div>
            )}
            {!game.when_type && !game.kickoff_at && !game.kickoff_end_at && (
              <div style={{ 
                padding: '6px 12px', 
                background: 'rgba(47, 107, 87, 0.2)', 
                border: '1px solid rgba(47, 107, 87, 0.4)',
                borderRadius: 8,
                fontSize: 13,
                color: '#9db'
              }}>
                🕐 Datum offen
              </div>
            )}
          </div>
        )}

        {/* Spieler/Teams Übersicht - Eine Zeile */}
        <div style={{ 
          marginTop: isMobile ? 20 : 32,
          padding: isMobile ? '20px' : '28px',
          background: 'linear-gradient(135deg, rgba(14, 42, 34, 0.4), rgba(14, 42, 34, 0.2))',
          border: '1px solid rgba(47, 107, 87, 0.3)',
          borderRadius: 16,
          boxShadow: '0 4px 20px rgba(0,0,0,0.2)'
        }}>
          {/* Zeile 1: Spieler */}
          <div style={{ 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'space-between',
            gap: isMobile ? 12 : 20,
            marginBottom: isMobile ? 12 : 16
          }}>
            {/* Spieler/Team 1 */}
            <div style={{ 
              flex: 1, 
              display: 'flex', 
              alignItems: 'center', 
              gap: isMobile ? 10 : 14,
              minWidth: 0 // Allow text truncation
            }}>
              {playerA.id ? (
                <Link to={`/user/${playerA.id}`} style={{ textDecoration: 'none', color: '#f4fff8', display: 'flex', alignItems: 'center', gap: isMobile ? 10 : 14, minWidth: 0 }}>
                  <Avatar 
                    userId={playerA.id} 
                    name={playerA.name} 
                    size={isMobile ? 50 : 70} 
                  />
                  <div style={{ minWidth: 0 }}>
                    <div style={{ 
                      fontSize: isMobile ? 16 : 20, 
                      fontWeight: 800,
                      letterSpacing: '-0.3px',
                      color: '#f4fff8',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap'
                    }}>{playerA.name}</div>
                    {tablePositions[playerA.name] && (
                      <div style={{ 
                        color: '#9db', 
                        fontSize: isMobile ? 12 : 13,
                        fontWeight: 500,
                        marginTop: 2
                      }}>{tablePositions[playerA.name].rank}. Rang</div>
                    )}
                  </div>
                </Link>
              ) : (
                <>
                  <Avatar 
                    userId={null} 
                    name={playerA.name} 
                    size={isMobile ? 50 : 70} 
                  />
                  <div style={{ minWidth: 0 }}>
                    <div style={{ 
                      fontSize: isMobile ? 16 : 20, 
                      fontWeight: 800,
                      letterSpacing: '-0.3px',
                      color: '#f4fff8',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap'
                    }}>{playerA.name}</div>
                    {tablePositions[playerA.name] && (
                      <div style={{ 
                        color: '#9db', 
                        fontSize: isMobile ? 12 : 13,
                        fontWeight: 500,
                        marginTop: 2
                      }}>{tablePositions[playerA.name].rank}. Rang</div>
                    )}
                  </div>
                </>
              )}
            </div>

            {/* Spieler/Team 2 */}
            <div style={{ 
              flex: 1, 
              display: 'flex', 
              alignItems: 'center', 
              gap: isMobile ? 10 : 14,
              justifyContent: 'flex-end',
              minWidth: 0
            }}>
              {playerB.id ? (
                <Link to={`/user/${playerB.id}`} style={{ textDecoration: 'none', color: '#f4fff8', display: 'flex', alignItems: 'center', gap: isMobile ? 10 : 14, minWidth: 0, flexDirection: 'row-reverse' }}>
                  <Avatar 
                    userId={playerB.id} 
                    name={playerB.name} 
                    size={isMobile ? 50 : 70} 
                  />
                  <div style={{ minWidth: 0, textAlign: 'right' }}>
                    <div style={{ 
                      fontSize: isMobile ? 16 : 20, 
                      fontWeight: 800,
                      letterSpacing: '-0.3px',
                      color: '#f4fff8',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap'
                    }}>{playerB.name}</div>
                    {tablePositions[playerB.name] && (
                      <div style={{ 
                        color: '#9db', 
                        fontSize: isMobile ? 12 : 13,
                        fontWeight: 500,
                        marginTop: 2
                      }}>{tablePositions[playerB.name].rank}. Rang</div>
                    )}
                  </div>
                </Link>
              ) : (
                <>
                  <div style={{ minWidth: 0, textAlign: 'right', order: 1 }}>
                    <div style={{ 
                      fontSize: isMobile ? 16 : 20, 
                      fontWeight: 800,
                      letterSpacing: '-0.3px',
                      color: '#f4fff8',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap'
                    }}>{playerB.name}</div>
                    {tablePositions[playerB.name] && (
                      <div style={{ 
                        color: '#9db', 
                        fontSize: isMobile ? 12 : 13,
                        fontWeight: 500,
                        marginTop: 2
                      }}>{tablePositions[playerB.name].rank}. Rang</div>
                    )}
                  </div>
                  <Avatar 
                    userId={null} 
                    name={playerB.name} 
                    size={isMobile ? 50 : 70}
                    style={{ order: 2 }}
                  />
                </>
              )}
            </div>
          </div>

          {/* Zeile 2: Ergebnis / Ergebnis Eintragen */}
          <div>
            {isCompleted ? (
              /* Match abgeschlossen: nur Endergebnis anzeigen */
              <div style={{ 
                display: 'flex', 
                justifyContent: 'center',
                alignItems: 'center',
                marginBottom: isMobile ? 16 : 20
              }}>
                <div style={{ 
                  fontSize: isMobile ? 28 : 40, 
                  fontWeight: 900, 
                  color: '#e8efe8', 
                  letterSpacing: '1px',
                  padding: '8px 16px',
                  background: 'rgba(10, 28, 23, 0.6)',
                  borderRadius: 10,
                  border: '1px solid rgba(38, 73, 60, 0.5)'
                }}>
                  {Number(game.home_score)} : {Number(game.away_score)}
                </div>
              </div>
            ) : (token && isParticipant && !!game.kickoff_at) ? (
              /* Teilnehmer kann Ergebnis eintragen */
              (() => {
                const isTennis = game?.sport?.toLowerCase().includes('tennis');
                const isOpenMatch = game.league === 'Open Matches' || (game.league && game.league.includes('Open Matches'));
                const tennisNumSets = tennisResult?.numSets || 1;
                
                return (
                  <div style={{
                    marginTop: isMobile ? 12 : 16,
                    paddingTop: isMobile ? 12 : 16,
                    borderTop: '1px solid rgba(47, 107, 87, 0.3)'
                  }}>
                    <div style={{ 
                      fontSize: isMobile ? 14 : 16, 
                      fontWeight: 700, 
                      color: '#debc7c', 
                      marginBottom: isMobile ? 14 : 18,
                      textTransform: 'uppercase',
                      letterSpacing: '0.5px',
                      textAlign: 'center'
                    }}>
                      Ergebnis eintragen
                    </div>
                    
                    {/* Anzahl Sätze - nur für Tennis Open Matches */}
                    {isTennis && isOpenMatch && (
                      <div style={{ 
                        display: 'flex',
                        justifyContent: 'center',
                        alignItems: 'center',
                        gap: 12,
                        marginBottom: 16
                      }}>
                        <span style={{ color: '#9db', fontSize: isMobile ? 13 : 14, fontWeight: 600 }}>
                          Anzahl Sätze:
                        </span>
                        <Counter
                          value={tennisNumSets}
                          onChange={(newValue) => {
                            setTennisResult(prev => ({ ...prev, numSets: newValue }));
                          }}
                          min={1}
                          max={5}
                          disabled={!canSubmit}
                        />
                      </div>
                    )}
                    
                    {isTennis ? (
                      tennisNumSets === 1 ? (
                        /* Tennis Bo1: Simple Counter */
                        <>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: isMobile ? 10 : 16, marginBottom: 16 }}>
                            <Counter
                              value={hScore}
                              onChange={setHScore}
                              min={0}
                              max={99}
                              disabled={!canSubmit}
                            />
                            <span style={{ fontSize: isMobile ? 20 : 28, color: '#9db', fontWeight: 700 }}>:</span>
                            <Counter
                              value={aScore}
                              onChange={setAScore}
                              min={0}
                              max={99}
                              disabled={!canSubmit}
                            />
                          </div>
                        </>
                      ) : (
                        /* Tennis Bo3/Bo5: Set Entry */
                        <TennisResultEntry
                          ruleset={game.ruleset}
                          isOpenMatch={isOpenMatch}
                          numSets={tennisNumSets}
                          onResultChange={(result) => {
                            setTennisResult(result);
                            setHScore(result.home_score || 0);
                            setAScore(result.away_score || 0);
                          }}
                          disabled={!canSubmit}
                          isMobile={isMobile}
                        />
                      )
                    ) : (
                      /* Andere Sports: Standard Counter */
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: isMobile ? 10 : 16, marginBottom: 16 }}>
                        <Counter
                          value={hScore}
                          onChange={setHScore}
                          min={0}
                          max={99}
                          disabled={!canSubmit}
                        />
                        <span style={{ fontSize: isMobile ? 20 : 28, color: '#9db', fontWeight: 700 }}>:</span>
                        <Counter
                          value={aScore}
                          onChange={setAScore}
                          min={0}
                          max={99}
                          disabled={!canSubmit}
                        />
                      </div>
                    )}
                    
                    <button disabled={!canSubmit || submitLoading} type="submit" onClick={submitResult} style={{ 
                      marginTop: 16,
                      padding: isMobile ? '10px 18px' : '12px 28px', 
                      borderRadius: 24, 
                      border: 'none',
                      background: (canSubmit && !submitLoading) ? 'linear-gradient(135deg, #d4af37, #b8941f)' : 'rgba(100, 100, 100, 0.3)',
                      color: (canSubmit && !submitLoading) ? '#000' : '#666',
                      fontSize: isMobile ? 13 : 15,
                      fontWeight: 700,
                      cursor: (canSubmit && !submitLoading) ? 'pointer' : 'not-allowed',
                      boxShadow: (canSubmit && !submitLoading) ? '0 6px 20px rgba(212, 175, 55, 0.4)' : 'none',
                      opacity: submitLoading ? 0.7 : 1,
                      transition: 'all 0.2s ease',
                      textTransform: 'uppercase',
                      letterSpacing: '0.5px',
                      width: '100%'
                    }}>
                      {submitLoading ? '⏳ Speichere...' : 'Ergebnis speichern'}
                    </button>
                    
                    {(!canSubmit && cannotReason && cannotReason !== 'OPPONENT_NOT_ASSIGNED') && (
                      <div style={{ 
                        marginTop: 14,
                        padding: '12px 18px',
                        background: 'rgba(255, 200, 100, 0.15)',
                        border: '1px solid rgba(255, 200, 100, 0.4)',
                        borderRadius: 10,
                        fontSize: isMobile ? 12 : 14,
                        color: '#ffc864',
                        textAlign: 'center',
                        fontWeight: 600,
                        boxShadow: '0 2px 8px rgba(255, 200, 100, 0.1)'
                      }}>
                        {cannotReason === 'KICKOFF_NOT_SET' ? '📅 Termin noch nicht festgelegt' : 
                         cannotReason === 'KICKOFF_NOT_REACHED' ? '⏰ Ergebnis kann erst ab Startdatum eingetragen werden' :
                         cannotReason === 'LEAGUE_MEMBERS_ONLY' ? '🔒 Nur Liga-Mitglieder' : cannotReason}
                      </div>
                    )}
                    {submitMsg && (
                      <div style={{ 
                        color: submitMsg.includes('gespeichert') ? '#99ff99' : '#ff9999', 
                        fontSize: isMobile ? 12 : 13, 
                        textAlign: 'center',
                        marginTop: 10,
                        fontWeight: 600,
                        padding: '8px 12px',
                        background: submitMsg.includes('gespeichert') ? 'rgba(153, 255, 153, 0.1)' : 'rgba(255, 153, 153, 0.1)',
                        borderRadius: 8,
                        border: submitMsg.includes('gespeichert') ? '1px solid rgba(153, 255, 153, 0.3)' : '1px solid rgba(255, 153, 153, 0.3)'
                      }}>
                        {submitMsg}
                      </div>
                    )}
                  </div>
                );
              })()
            ) : (
              /* Nur Score anzeigen (kein Participant oder kein Termin) */
              <div style={{ 
                display: 'flex', 
                justifyContent: 'center',
                alignItems: 'center',
                marginBottom: isMobile ? 16 : 20
              }}>
                <div style={{ 
                  fontSize: isMobile ? 24 : 36, 
                  fontWeight: 800,
                  color: '#9db',
                  padding: '4px 12px'
                }}>
                  {hScore} : {aScore}
                </div>
              </div>
            )}
          </div>

          {/* Statistik-Zeile unter der Hauptzeile */}
          {(playerA.id && histA.length > 0) || (playerB.id && histB.length > 0) ? (
            <div style={{ 
              display: 'flex', 
              justifyContent: 'space-between',
              gap: isMobile ? 12 : 20,
              paddingTop: isMobile ? 12 : 16,
              borderTop: '1px solid rgba(47, 107, 87, 0.3)'
            }}>
              {/* Spieler A Statistik */}
              <div style={{ flex: 1 }}>
                {playerA.id && histA.length > 0 && (
                  <div style={{ 
                    fontSize: isMobile ? 11 : 13, 
                    color: '#9db'
                  }}>
                    <div style={{ marginBottom: 6, fontWeight: 700, fontSize: isMobile ? 10 : 11, textTransform: 'uppercase', letterSpacing: '0.5px', opacity: 0.8 }}>Letzte 5</div>
                    <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                      {histA.slice(0, 5).map(h => {
                        const won = (h.home === playerA.name && h.home_score > h.away_score) || 
                                    (h.away === playerA.name && h.away_score > h.home_score);
                        const draw = h.home_score === h.away_score;
                        return (
                          <span key={h.id} style={{
                            width: isMobile ? 20 : 22,
                            height: isMobile ? 20 : 22,
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            background: won ? 'linear-gradient(135deg, #2d5f3f, #1f4a2e)' : draw ? 'linear-gradient(135deg, #5f5f2d, #4a4a22)' : 'linear-gradient(135deg, #5f2d2d, #4a2222)',
                            borderRadius: 6,
                            fontSize: isMobile ? 10 : 11,
                            fontWeight: 800,
                            boxShadow: '0 2px 4px rgba(0,0,0,0.3)',
                            border: won ? '1px solid rgba(45, 95, 63, 0.5)' : draw ? '1px solid rgba(95, 95, 45, 0.5)' : '1px solid rgba(95, 45, 45, 0.5)'
                          }}>
                            {won ? 'S' : draw ? 'U' : 'N'}
                          </span>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              {/* Spacer */}
              <div style={{ flexShrink: 0, width: isMobile ? 60 : 100 }}></div>

              {/* Spieler B Statistik */}
              <div style={{ flex: 1, display: 'flex', justifyContent: 'flex-end' }}>
                {playerB.id && histB.length > 0 && (
                  <div style={{ 
                    fontSize: isMobile ? 11 : 13, 
                    color: '#9db',
                    textAlign: 'right'
                  }}>
                    <div style={{ marginBottom: 6, fontWeight: 700, fontSize: isMobile ? 10 : 11, textTransform: 'uppercase', letterSpacing: '0.5px', opacity: 0.8 }}>Letzte 5</div>
                    <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                      {histB.slice(0, 5).map(h => {
                        const won = (h.home === playerB.name && h.home_score > h.away_score) || 
                                    (h.away === playerB.name && h.away_score > h.home_score);
                        const draw = h.home_score === h.away_score;
                        return (
                          <span key={h.id} style={{
                            width: isMobile ? 20 : 22,
                            height: isMobile ? 20 : 22,
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            background: won ? 'linear-gradient(135deg, #2d5f3f, #1f4a2e)' : draw ? 'linear-gradient(135deg, #5f5f2d, #4a4a22)' : 'linear-gradient(135deg, #5f2d2d, #4a2222)',
                            borderRadius: 6,
                            fontSize: isMobile ? 10 : 11,
                            fontWeight: 800,
                            boxShadow: '0 2px 4px rgba(0,0,0,0.3)',
                            border: won ? '1px solid rgba(45, 95, 63, 0.5)' : draw ? '1px solid rgba(95, 95, 45, 0.5)' : '1px solid rgba(95, 45, 45, 0.5)'
                          }}>
                            {won ? 'S' : draw ? 'U' : 'N'}
                          </span>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </div>
          ) : null}
        </div>

        {/* Info wenn kein Termin festgelegt */}
        {(token && isParticipant && (game.home_score == null && game.away_score == null) && !game.kickoff_at) && (
          <div style={{ 
            marginTop: isMobile ? 16 : 20,
            padding: isMobile ? '16px' : '20px',
            background: 'rgba(255, 200, 100, 0.12)', 
            border: '1px solid rgba(255, 200, 100, 0.35)', 
            borderRadius: 12,
            textAlign: 'center'
          }}>
            <div style={{ 
              fontSize: isMobile ? 13 : 14, 
              color: '#ffc864',
              fontWeight: 500
            }}>
              📅 Ergebnis erst möglich, wenn ein Termin festgelegt ist.
            </div>
          </div>
        )}

        {/* Location */}
        {game.location && (
          <div style={{ 
            marginTop: 16, 
            color: '#bcd', 
            display: 'flex', 
            alignItems: 'center', 
            gap: 10,
            padding: '12px 16px',
            background: 'rgba(47, 107, 87, 0.12)',
            border: '1px solid rgba(47, 107, 87, 0.3)',
            borderRadius: 12,
            fontSize: isMobile ? 14 : 15,
            fontWeight: 500
          }}>
            <span style={{ fontSize: 20 }}>📍</span>
            <span>{game.location}</span>
          </div>
        )}

        {/* Booking Widget - Show confirmed booking if exists */}
        {booking && <BookingWidget booking={booking} onCancel={handleCancelBooking} />}

        {token && game && showTerminManager && (
          <TerminManagerKalender
            matchId={gameId}
            token={token}
            matchInfo={{
              home_player: game.home_player,
              away_player: game.away_player,
              sport: game.sport,
              league: game.league_name
            }}
            onInvitationSent={() => {
              setShowTerminManager(false);
              window.location.reload();
            }}
            onClose={() => {
              setShowTerminManager(false);
              // refresh label state after close
              setTimeout(() => {
                if (!token) return;
                fetch(`${API_BASE}/matches/${gameId}/termin-manager`, { headers: { Authorization: `Bearer ${token}` } })
                  .then((r) => r.json().then((d) => ({ ok: r.ok, d })).catch(() => ({ ok: r.ok, d: {} })))
                  .then(({ ok, d }) => {
                    if (!ok) return;
                    setTerminMeta(d?.meta || null);
                    setTerminProposal(d?.proposal || null);
                  })
                  .catch(() => {});
              }, 200);
            }}
          />
        )}

        {/* Schedule form (toggled) - Hide when booking exists */}
        {(token && game && isParticipant && game.home_score == null && game.away_score == null && showSchedule && !booking) && (
          <ScheduleSection
            open={showSchedule}
            setOpen={setShowSchedule}
            dateStr={dateStr}
            setDateStr={setDateStr}
            hours={scheduleHours}
            minutes={scheduleMinutes}
            setHours={setScheduleHours}
            setMinutes={setScheduleMinutes}
            onSubmit={scheduleMatch}
            onSuggest={suggestNextSlot}
            location={location}
            setLocation={setLocation}
            message={scheduleMsg}
            loading={scheduleLoading}
            game={game}
            userProfile={userProfile}
            onBookingConfirmed={(bookingData) => {
              // Update booking state in main component
              setBooking(bookingData);
              // Close schedule form
              setShowSchedule(false);
              // Reload to show updated booking widget
              setTimeout(() => window.location.reload(), 1000);
            }}
          />
        )}

        {/* Join match CTA wird oben im Hero angezeigt */}
        
        {/* Kommentare und Likes Sektion */}
        <CommentsSection 
          gameId={gameId}
          comments={comments}
          setComments={setComments}
          newComment={newComment}
          setNewComment={setNewComment}
          commentLoading={commentLoading}
          setCommentLoading={setCommentLoading}
          likes={likes}
          setLikes={setLikes}
          hasLiked={hasLiked}
          setHasLiked={setHasLiked}
          likeLoading={likeLoading}
          setLikeLoading={setLikeLoading}
          token={token}
          viewerId={viewerId}
        />
      </div>
    </div>
  );
}

// Collapsible schedule section with counter-based time selection
function ScheduleSection({ open, setOpen, dateStr, setDateStr, hours, minutes, setHours, setMinutes, onSubmit, onSuggest, location, setLocation, message, loading, game, userProfile, onBookingConfirmed }) {
  const [locationMode, setLocationMode] = useState('booking'); // Default to 'booking' to show slots
  const [availableSlots, setAvailableSlots] = useState([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [slotsError, setSlotsError] = useState('');
  const [searchCity, setSearchCity] = useState(''); // City filter for slot search
  const [cities, setCities] = useState([]);
  const [countries, setCountries] = useState([]);
  const [states, setStates] = useState([]);
  const [districts, setDistricts] = useState([]);
  const [selectedLocationName, setSelectedLocationName] = useState('');
  const [selectedCityId, setSelectedCityId] = useState(null);
  const [bookingPopup, setBookingPopup] = useState(null); // Selected slot for booking

  // Load location data
  useEffect(() => {
    fetch(`${API_BASE}/cities/list`)
      .then(r => r.ok ? r.json() : [])
      .then(data => setCities(Array.isArray(data) ? data : []))
      .catch(() => setCities([]));
    
    fetch(`${API_BASE}/countries`)
      .then(r => r.ok ? r.json() : [])
      .then(data => setCountries(Array.isArray(data) ? data : []))
      .catch(() => setCountries([]));
    
    fetch(`${API_BASE}/states`)
      .then(r => r.ok ? r.json() : [])
      .then(data => setStates(Array.isArray(data) ? data : []))
      .catch(() => setStates([]));
  }, []);

  // Pre-select user's location if available
  useEffect(() => {
    if (userProfile?.city_name && !selectedLocationName) {
      setSelectedLocationName(userProfile.city_name);
      if (userProfile.city_id) {
        setSelectedCityId(userProfile.city_id);
        setSearchCity(userProfile.city_name);
      }
    }
  }, [userProfile, selectedLocationName]);

  const handleLoadDistricts = async (cityId) => {
    try {
      const res = await fetch(`${API_BASE}/districts?city_id=${cityId}`);
      if (res.ok) {
        const data = await res.json();
        setDistricts(Array.isArray(data) ? data : []);
      }
    } catch (err) {
      console.error('Failed to load districts:', err);
    }
  };

  const handleLocationChange = (name, cityId, stateId, countryId, districtId) => {
    setSelectedLocationName(name);
    setSelectedCityId(cityId);
    setSearchCity(name);
    setLocation(name);
  };

  async function searchAvailableSlots() {
    if (!dateStr) return;
    
    setLoadingSlots(true);
    setSlotsError('');
    
    try {
      const targetTime = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
      // Build datetime parameter: YYYY-MM-DDTHH:MM:SS
      const datetime = `${dateStr}T${targetTime}:00`;
      
      const params = new URLSearchParams({
        datetime: datetime,
        duration: 60 // Default 60 minutes, could be made configurable
      });
      
      // Add sport_id from game if available
      if (game?.sportId) {
        params.append('sport_id', game.sportId);
      }
      
      // Add city filter - prefer user selection, fallback to game's city
      const targetCity = searchCity || game?.city || '';
      if (targetCity) {
        params.append('city', targetCity);
      }
      
      const res = await fetch(`${API_BASE}/slots/search?${params}`);
      
      if (res.ok) {
        const data = await res.json();
        setAvailableSlots(Array.isArray(data) ? data : []);
      } else {
        setSlotsError('Fehler beim Laden der Slots');
        setAvailableSlots([]);
      }
    } catch (err) {
      console.error('Failed to search slots:', err);
      setSlotsError(err.message || 'Netzwerkfehler');
      setAvailableSlots([]);
    } finally {
      setLoadingSlots(false);
    }
  }

  // Auto-search slots when date/time changes
  useEffect(() => {
    if (locationMode === 'booking' && dateStr && open) {
      searchAvailableSlots();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dateStr, hours, minutes, locationMode, open, searchCity]);

  return (
    <div style={{ marginTop: 16, background: '#0a1c17', padding: 16, borderRadius: 12, border: '1px solid #26493c' }}>
      {!open && (
        <button onClick={() => setOpen(true)} style={{ padding: '8px 12px', borderRadius: 10, border: '1px solid #2f6b57', background: '#0e2a22', color: '#dfe' }}>
          Termin bearbeiten
        </button>
      )}
      {open && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Step 1: Location Selection Mode */}
          <div>
            <h4 style={{ color: '#e8efe8', margin: '0 0 12px 0' }}>1️⃣ Location festlegen</h4>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={() => setLocationMode('manual')}
                style={{
                  padding: '10px 16px',
                  borderRadius: 8,
                  border: locationMode === 'manual' ? '2px solid #2f6b57' : '1px solid #26493c',
                  background: locationMode === 'manual' ? '#1b4b3d' : '#0a1c17',
                  color: '#e8efe8',
                  cursor: 'pointer',
                  flex: '1 1 200px'
                }}
              >
                📍 Ort manuell eingeben
              </button>
              
              <button
                type="button"
                onClick={() => setLocationMode('booking')}
                style={{
                  padding: '10px 16px',
                  borderRadius: 8,
                  border: locationMode === 'booking' ? '2px solid #2f6b57' : '1px solid #26493c',
                  background: locationMode === 'booking' ? '#1b4b3d' : '#0a1c17',
                  color: '#e8efe8',
                  cursor: 'pointer',
                  flex: '1 1 200px'
                }}
              >
                🏟️ Platz buchen
              </button>
            </div>
          </div>

          {/* Manual Location Input */}
          {locationMode === 'manual' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <label style={{ color: '#9db', fontSize: '14px', fontWeight: '500' }}>Ort / Adresse</label>
              <LocationSelector
                cities={cities}
                countries={countries}
                states={states}
                districts={districts}
                value={selectedLocationName}
                onChange={handleLocationChange}
                onLoadDistricts={handleLoadDistricts}
                placeholder="Standort wählen"
              />
            </div>
          )}

          {/* Booking Mode - Date & Time Selection */}
          {locationMode === 'booking' && (
            <>
              {/* Filters Section - Compact */}
              <div style={{ 
                background: '#0f2a20', 
                padding: '16px', 
                borderRadius: 10, 
                border: '1px solid #26493c',
                marginBottom: 16
              }}>
                <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end', flexWrap: 'wrap' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8, flex: '1 1 140px' }}>
                    <label style={{ color: '#9db', fontSize: '13px', fontWeight: '500' }}>📅 Datum</label>
                    <input 
                      type="date" 
                      value={dateStr} 
                      onChange={(e) => setDateStr(e.target.value)} 
                      style={{ 
                        padding: '8px 10px', 
                        borderRadius: 8, 
                        border: '1px solid #26493c', 
                        background: '#0a1c17', 
                        color: '#e8efe8',
                        fontSize: 14
                      }} 
                      required
                    />
                  </div>
                  
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8, flex: '0 0 auto' }}>
                    <label style={{ color: '#9db', fontSize: '13px', fontWeight: '500' }}>🕐 Uhrzeit</label>
                    <TimeCounter
                      hours={hours}
                      minutes={minutes}
                      onHoursChange={(h) => { setHours(h); }}
                      onMinutesChange={(m) => { setMinutes(m); }}
                    />
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8, flex: '1 1 180px' }}>
                    <label style={{ color: '#9db', fontSize: '13px', fontWeight: '500' }}>
                      📍 Stadt {game?.city && <span style={{ color: '#6a8', fontSize: '11px' }}>(Standard: {game.city})</span>}
                    </label>
                    <select
                      value={searchCity}
                      onChange={(e) => setSearchCity(e.target.value)}
                      style={{
                        padding: '8px 10px',
                        borderRadius: 8,
                        border: '1px solid #26493c',
                        background: '#0a1c17',
                        color: '#e8efe8',
                        cursor: 'pointer',
                        fontSize: 14
                      }}
                    >
                      <option value="">{game?.city || 'Alle Städte'}</option>
                      {cities.filter(c => c.name !== game?.city).map(city => (
                        <option key={city.id} value={city.name}>{city.name}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* Available Slots List */}
              <div>
                <div style={{ 
                  display: 'flex', 
                  justifyContent: 'space-between', 
                  alignItems: 'center',
                  marginBottom: 12
                }}>
                  <h4 style={{ color: '#e8efe8', margin: 0, fontSize: 16 }}>
                    Verfügbare Plätze
                    {game?.sport && <span style={{ color: '#6a8', fontSize: 14, fontWeight: 400, marginLeft: 8 }}>· {game.sport}</span>}
                  </h4>
                  {!loadingSlots && availableSlots.length > 0 && (
                    <div style={{ 
                      padding: '4px 12px', 
                      background: '#0a2221', 
                      borderRadius: 6, 
                      fontSize: 13, 
                      color: '#6db', 
                      fontWeight: 600 
                    }}>
                      {availableSlots.length} Plätze
                    </div>
                  )}
                </div>

                {loadingSlots ? (
                  <div style={{ padding: 40, textAlign: 'center', color: '#9db', background: '#0f2a20', borderRadius: 10 }}>
                    <div style={{ fontSize: 32, marginBottom: 8 }}>⏳</div>
                    <div>Suche verfügbare Plätze...</div>
                  </div>
                ) : slotsError ? (
                  <div style={{ padding: 30, textAlign: 'center', color: '#ff6b6b', background: '#2a0f0f', borderRadius: 10 }}>
                    <div style={{ fontSize: 32, marginBottom: 8 }}>❌</div>
                    <div>{slotsError}</div>
                  </div>
                ) : availableSlots.length === 0 ? (
                  <div style={{ padding: 40, textAlign: 'center', color: '#9db', background: '#0f2a20', borderRadius: 10 }}>
                    <div style={{ fontSize: 32, marginBottom: 12 }}>🔍</div>
                    <p style={{ margin: '0 0 8px 0', fontSize: 15 }}>Keine verfügbaren Plätze gefunden</p>
                    <p style={{ fontSize: 13, margin: 0, color: '#789' }}>
                      für {dateStr} um {hours.toString().padStart(2, '0')}:{minutes.toString().padStart(2, '0')} Uhr
                    </p>
                    <p style={{ fontSize: 13, margin: 0, color: '#789' }}>
                      für {dateStr} um {hours.toString().padStart(2, '0')}:{minutes.toString().padStart(2, '0')} Uhr
                    </p>
                    <p style={{ fontSize: 13, marginTop: 12, color: '#789' }}>Versuche ein anderes Datum oder eine andere Uhrzeit.</p>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {availableSlots.map((slot, idx) => {
                      // Parse time strings from API (format: "HH:MM")
                      const displayDate = dateStr;
                      const displayStartTime = slot.start_time || '';
                      const displayEndTime = slot.end_time || '';
                      
                      return (
                      <div 
                        key={slot.id || idx}
                        style={{
                          padding: 16,
                          background: idx === 0 ? 'linear-gradient(135deg, #1b4b3d 0%, #0e2a22 100%)' : '#0f2a20',
                          border: idx === 0 ? '2px solid #2f6b57' : '1px solid #26493c',
                          borderRadius: 10,
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          gap: 16,
                          cursor: 'pointer',
                          transition: 'all 0.2s',
                          position: 'relative'
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.transform = 'translateX(4px)';
                          e.currentTarget.style.borderColor = '#2f6b57';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.transform = 'translateX(0)';
                          e.currentTarget.style.borderColor = idx === 0 ? '#2f6b57' : '#26493c';
                        }}
                      >
                        {idx === 0 && (
                          <div style={{
                            position: 'absolute',
                            top: -10,
                            left: 12,
                            padding: '4px 10px',
                            background: '#2f6b57',
                            color: '#fff',
                            borderRadius: 6,
                            fontSize: 11,
                            fontWeight: 600,
                            letterSpacing: '0.5px'
                          }}>
                            NÄCHSTER FREIER PLATZ
                          </div>
                        )}
                        
                        <div style={{ flex: 1 }}>
                          <div style={{ fontWeight: 600, color: '#e8efe8', fontSize: 16, marginBottom: 6 }}>
                            {slot.location_name}
                          </div>
                          <div style={{ fontSize: 13, color: '#9db', marginBottom: 4 }}>
                            🏟️ {slot.asset_name}
                            {slot.asset_type && ` · ${slot.asset_type}`}
                            {slot.surface && ` · ${slot.surface}`}
                          </div>
                          <div style={{ fontSize: 13, color: '#9db', marginBottom: 4 }}>
                            🕐 {displayStartTime} - {displayEndTime} Uhr
                          </div>
                          {slot.city && slot.address && (
                            <div style={{ fontSize: 12, color: '#789', marginTop: 4 }}>
                              📍 {slot.address}, {slot.city}
                            </div>
                          )}
                        </div>
                        
                        <div style={{ 
                          display: 'flex', 
                          flexDirection: 'column', 
                          alignItems: 'flex-end',
                          gap: 10
                        }}>
                          {slot.base_price > 0 && (
                            <div style={{ 
                              fontSize: 22, 
                              color: '#10b981', 
                              fontWeight: 700,
                              lineHeight: 1
                            }}>
                              {slot.base_price} {slot.currency || 'EUR'}
                            </div>
                          )}
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              // Prepare slot data for booking popup
                              const bookingSlotData = {
                                id: slot.id,
                                location_name: slot.location_name,
                                asset_name: slot.asset_name,
                                asset_type: slot.asset_type,
                                surface: slot.surface,
                                date: displayDate,
                                start_time: displayStartTime,
                                end_time: displayEndTime,
                                base_price: slot.base_price,
                                currency: slot.currency || 'EUR',
                                city: slot.city,
                                address: slot.address
                              };
                              setBookingPopup(bookingSlotData);
                            }}
                            style={{
                              padding: '10px 20px',
                              borderRadius: 8,
                              border: 'none',
                              background: idx === 0 ? '#10b981' : '#2f6b57',
                              color: '#fff',
                              fontSize: 14,
                              fontWeight: 600,
                              cursor: 'pointer',
                              whiteSpace: 'nowrap',
                              transition: 'all 0.2s'
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.background = '#10b981';
                              e.currentTarget.style.transform = 'scale(1.05)';
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.background = idx === 0 ? '#10b981' : '#2f6b57';
                              e.currentTarget.style.transform = 'scale(1)';
                            }}
                          >
                            Jetzt buchen →
                          </button>
                        </div>
                      </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </>
          )}

          {/* Save/Cancel Buttons */}
          {(locationMode === 'manual' || (locationMode === 'booking' && location)) && (
            <div style={{ display: 'flex', gap: 12, marginTop: 8, flexWrap: 'wrap' }}>
              <button 
                type="button"
                onClick={onSubmit}
                disabled={loading || !dateStr || !location}
                style={{ 
                  padding: '10px 20px', 
                  borderRadius: 8, 
                  border: 'none',
                  background: loading || !dateStr || !location ? 'rgba(27, 75, 61, 0.5)' : '#1b4b3d', 
                  color: '#fff',
                  fontWeight: 600,
                  cursor: loading || !dateStr || !location ? 'not-allowed' : 'pointer',
                  opacity: loading || !dateStr || !location ? 0.7 : 1
                }}
              >
                {loading ? '⏳ Speichere...' : '💾 Termin & Ort speichern'}
              </button>
              <button 
                type="button" 
                onClick={() => setOpen(false)} 
                style={{ 
                  padding: '10px 20px', 
                  borderRadius: 8, 
                  border: '1px solid #26493c', 
                  background: 'transparent', 
                  color: '#9db',
                  cursor: 'pointer'
                }}
              >
                Abbrechen
              </button>
            </div>
          )}
          
          {message && (
            <div style={{ 
              padding: '10px 12px', 
              borderRadius: 8,
              background: message.includes('gespeichert') ? '#102a22' : '#2a1212',
              border: `1px solid ${message.includes('gespeichert') ? '#2f6b57' : '#6b2f2f'}`,
              color: message.includes('gespeichert') ? '#9f9' : '#fcc'
            }}>
              {message}
            </div>
          )}
        </div>
      )}

      {/* Booking Confirmation Popup */}
      {bookingPopup && (
        <BookingConfirmationPopup
          slot={bookingPopup}
          match={game}
          onClose={() => setBookingPopup(null)}
          onConfirm={async (bookingData) => {
            setBookingPopup(null);
            
            // Update location display in schedule section
            if (bookingData.location_name && bookingData.asset_name) {
              setLocation(`${bookingData.location_name} - ${bookingData.asset_name}`);
            }
            
            // Call parent handler to update booking state
            if (onBookingConfirmed) {
              onBookingConfirmed(bookingData);
            }
          }}
        />
      )}
    </div>
  );
}
