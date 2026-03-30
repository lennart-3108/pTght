import React, { useState, useEffect, useMemo } from "react";
import { Link, useParams, useNavigate, useSearchParams } from "react-router-dom";
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
import { useLanguage } from "../i18n";

function localizeSportName(rawSportName, lang) {
  const normalized = String(rawSportName || '').trim();
  if (!normalized) return '';
  const sportNames = {
    'Tennis Einzel': 'Tennis Singles',
    'Tennis Doppel': 'Tennis Doubles',
    'Tennis Mixed Doppel': 'Tennis Mixed Doubles',
    'Badminton Doppel': 'Badminton Doubles',
    'Tischtennis Doppel': 'Table Tennis Doubles',
    'Fußball': 'Football',
    'Fußball 5 vs 5': 'Football 5v5',
    'Fußball 7 vs 7': 'Football 7v7',
    'Fußball 11 vs 11': 'Football 11v11',
    'Padel': 'Padel',
  };
  return lang === 'en' ? (sportNames[normalized] || normalized) : normalized;
}

export default function GameDetailPage() {
  const { gameId } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { t, lang } = useLanguage();
  const uiLocale = lang === 'en' ? 'en-GB' : 'de-DE';
  
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
  // Result confirmation state
  const [resultPending, setResultPending] = useState(false);
  const [resultIsSubmitter, setResultIsSubmitter] = useState(false);
  const [pendingScore, setPendingScore] = useState(null);
  const [confirmLoading, setConfirmLoading] = useState(false);
  const [confirmMsg, setConfirmMsg] = useState('');
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
      .catch(e => mounted && setErr(e.message || t('match.errorPrefix')))
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
    fetch(`${API_BASE}/matches/${gameId}/comments`, token ? { headers: { Authorization: `Bearer ${token}` } } : {})
      .then(async (r) => {
        if (!r.ok) return [];
        const data = await r.json().catch(() => []);
        return Array.isArray(data) ? data : [];
      })
      .then(commentsData => mounted && setComments(commentsData))
      .catch(() => {});
    
    // Fetch likes
    fetch(`${API_BASE}/matches/${gameId}/likes`, token ? { headers: { Authorization: `Bearer ${token}` } } : {})
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
    const opts = { year: 'numeric', month: 'long', day: 'numeric' };
    return d.toLocaleDateString(uiLocale, opts);
  }
  function formatTime(input) {
    if (!input) return "";
    const d = new Date(input);
    if (Number.isNaN(d.getTime())) return "";
    return d.toLocaleTimeString(uiLocale, { hour: '2-digit', minute: '2-digit' });
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
    if (days >= 2) return diff >= 0 ? t('match.time.inDays', { count: days }) : t('match.time.agoDays', { count: days });
    const hours = Math.floor(abs / (60*60*1000));
    if (hours >= 1) return diff >= 0 ? t('match.time.inHours', { count: hours }) : t('match.time.agoHours', { count: hours });
    const mins = Math.max(1, Math.floor(abs / (60*1000)));
    return diff >= 0 ? t('match.time.inMinutes', { count: mins }) : t('match.time.agoMinutes', { count: mins });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lang]);
  
  // Time remaining until deadline (for kickoff_end_at)
  const timeRemaining = useMemo(() => (when) => {
    if (!when) return "";
    const d = new Date(when);
    if (Number.isNaN(d.getTime())) return "";
    const now = new Date();
    const diff = d.getTime() - now.getTime();
    if (diff < 0) return t('match.time.expired');
    const days = Math.floor(diff / (24*60*60*1000));
    if (days >= 2) return t('match.time.remainDays', { count: days });
    if (days === 1) return t('match.time.remain1Day');
    const hours = Math.floor(diff / (60*60*1000));
    if (hours >= 1) return t('match.time.remainHours', { count: hours });
    const mins = Math.max(1, Math.floor(diff / (60*1000)));
    return t('match.time.remainMinutes', { count: mins });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lang]);
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
      const tc = Number(game?.team_count); const ppt = Number(game?.players_per_team);
      const isTeam = tc >= 2 && ppt > 1;
      if (isTeam) {
        return game?.status === 'scheduled' ? t('match.termin.change') : t('match.termin.arrange');
      }
      if (terminProposal && terminProposal.status === 'accepted') return t('match.termin.change');
      if (!terminProposal || terminProposal.status !== 'sent') return t('match.termin.arrange');
      if (viewerUserId != null && Number(terminProposal.proposerUserId) === Number(viewerUserId)) return t('match.termin.invitationSent');
      return t('match.termin.proposalReceived');
    }, [terminProposal, terminMeta, viewerId, game]);
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
        if (!token || !gameId) { if (mounted){ setCanSubmit(false); setCannotReason(''); setResultPending(false); } return; }
        const r = await fetch(`${API_BASE}/matches/${gameId}/can-submit`, { headers: { Authorization: `Bearer ${token}` } });
        const j = await r.json().catch(() => ({ canSubmit: false }));
        if (!mounted) return;
        setCanSubmit(!!j.canSubmit);
        setCannotReason(j.reason || '');
        // Handle result_pending confirmation flow
        if (j.resultPending) {
          setResultPending(true);
          setResultIsSubmitter(!!j.isSubmitter);
          setPendingScore(j.pendingScore || null);
        } else {
          setResultPending(false);
          setResultIsSubmitter(false);
          setPendingScore(null);
        }
      } catch {
        if (mounted) { setCanSubmit(false); setCannotReason(''); setResultPending(false); }
      }
    })();
    return () => { mounted = false; };
  }, [token, gameId, game?.kickoff_at, game?.status]);

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

  useEffect(() => {
    if (!token || !game) return;
    if (searchParams.get('openTerminManager') === '1') {
      setShowTerminManager(true);
    }
  }, [game, searchParams, token]);

  // Update timeStr when scheduleHours or scheduleMinutes change
  useEffect(() => {
    const hh = String(scheduleHours).padStart(2, '0');
    const mm = String(scheduleMinutes).padStart(2, '0');
    setTimeStr(`${hh}:${mm}`);
  }, [scheduleHours, scheduleMinutes]);

  if (loading) return <div style={{ padding: 16 }}>{t('match.loading')}</div>;
  if (err) {
    if (handleInvalidToken(err, navigate)) return null;
    return <div style={{ padding: 16, color: "crimson" }}>{t('match.errorPrefix')}: {err}</div>;
  }
  if (!game) return <div style={{ padding: 16 }}>{t('match.notFound')}</div>;

  const playerA = { name: game.home_user_name || game.home || "-", id: game.home_user_id || null };
  const playerB = { name: game.away_user_name || game.away || "-", id: game.away_user_id || null };

  const participants = Array.isArray(game.participants) ? game.participants : [];
  const format = game.format || {};
  const maxPlayers = Number.isFinite(Number(format.maxPlayers)) ? Number(format.maxPlayers) : (Number.isFinite(Number(game.max_players)) ? Number(game.max_players) : null);
  const joinedCount = Number.isFinite(Number(format.joinedCount))
    ? Number(format.joinedCount)
    : (participants.length || [game.home_user_id, game.away_user_id].filter(v => v != null).length);
  const viewerParticipant = viewerId ? participants.find(p => String(p.user_id) === String(viewerId)) : null;
  const isParticipantByParticipants = !!viewerParticipant;
  const isParticipant = viewerId && (
    isParticipantByParticipants ||
    (game.home_user_id != null && String(game.home_user_id) === String(viewerId)) ||
    (game.away_user_id != null && String(game.away_user_id) === String(viewerId))
  );
  const hasCapacity = (maxPlayers == null) ? true : (joinedCount < maxPlayers);
  const teamCount = Number.isFinite(Number(format.teamCount)) ? Number(format.teamCount) : (Number.isFinite(Number(game.team_count)) ? Number(game.team_count) : 0);
  const allowTeamChoice = (format.allowTeamChoice != null) ? !!format.allowTeamChoice : (game.allow_team_choice != null ? Number(game.allow_team_choice) !== 0 : true);
  const viewerTeamIndex = viewerParticipant && viewerParticipant.team_index != null ? Number(viewerParticipant.team_index) : null;
  const playersPerTeam = Number.isFinite(Number(format.playersPerTeam)) ? Number(format.playersPerTeam) : (Number.isFinite(Number(game.players_per_team)) ? Number(game.players_per_team) : null);
  const isTeamMatch = teamCount >= 2 && allowTeamChoice && playersPerTeam > 1;
  const team1Count = participants.filter(p => Number(p.team_index) === 1).length;
  const team2Count = participants.filter(p => Number(p.team_index) === 2).length;
  const team1Full = playersPerTeam ? team1Count >= playersPerTeam : false;
  const team2Full = playersPerTeam ? team2Count >= playersPerTeam : false;
  const teamDisplayA = String(game.home_team_name || '').trim() || t('match.team.team1');
  const teamDisplayB = String(game.away_team_name || '').trim() || t('match.team.team2');
  const localizedSportName = localizeSportName(game.sport, lang);
  const hasRecordedResult = game.home_score != null && game.away_score != null;

  function getParticipantDisplayName(userId) {
    if (userId == null) return '';
    const participant = participants.find((entry) => String(entry.user_id) === String(userId));
    if (participant?.display_name) return participant.display_name;
    if (String(game.home_user_id) === String(userId)) return playerA.name;
    if (String(game.away_user_id) === String(userId)) return playerB.name;
    return '';
  }

  function inferSideIndex(userId) {
    if (userId == null) return null;
    const participant = participants.find((entry) => String(entry.user_id) === String(userId));
    if (participant?.team_index != null) return Number(participant.team_index);
    if (String(game.home_user_id) === String(userId)) return 1;
    if (String(game.away_user_id) === String(userId)) return 2;
    return null;
  }

  function getSideDisplayName(sideIndex) {
    if (sideIndex === 1) {
      if (isTeamMatch) {
        const firstMember = participants.find((entry) => Number(entry.team_index) === 1);
        return String(game.home_team_name || '').trim() || firstMember?.display_name || playerA.name || t('match.team.team1');
      }
      return playerA.name;
    }
    if (sideIndex === 2) {
      if (isTeamMatch) {
        const firstMember = participants.find((entry) => Number(entry.team_index) === 2);
        return String(game.away_team_name || '').trim() || firstMember?.display_name || playerB.name || t('match.team.team2');
      }
      return playerB.name;
    }
    return '';
  }

  const submittedBySide = inferSideIndex(game.result_submitted_by);
  const viewerSide = viewerTeamIndex != null
    ? Number(viewerTeamIndex)
    : (String(game.home_user_id) === String(viewerId) ? 1 : (String(game.away_user_id) === String(viewerId) ? 2 : null));
  const submittedByName = getParticipantDisplayName(game.result_submitted_by)
    || (submittedBySide != null ? getSideDisplayName(submittedBySide) : '');
  const confirmationTargetName = (() => {
    const sideToConfirm = submittedBySide != null
      ? (submittedBySide === 1 ? 2 : 1)
      : (viewerSide != null ? (viewerSide === 1 ? 2 : 1) : null);
    return sideToConfirm != null ? getSideDisplayName(sideToConfirm) : '';
  })();
  const waitingForConfirmationText = confirmationTargetName
    ? (lang === 'en' ? `Waiting for confirmation from ${confirmationTargetName}...` : `Warte auf Bestätigung von ${confirmationTargetName}...`)
    : t('match.result.waitingForOpponent', 'Warte auf Bestätigung durch deinen Gegner...');
  const opponentSubmittedText = submittedByName
    ? (lang === 'en' ? `${submittedByName} submitted this result. Do you agree?` : `${submittedByName} hat dieses Ergebnis eingetragen. Stimmt das?`)
    : t('match.result.opponentSubmitted', 'Dein Gegner hat dieses Ergebnis eingetragen. Stimmt das?');

  const isCompleted = (game.status === 'completed') || (game.home_score != null && game.away_score != null && game.status !== 'result_pending');
  const isResultPending = game.status === 'result_pending';
  const isResultDisputed = game.status === 'result_disputed';
  const isCancelled = game.status === 'cancelled';
  const showCountdown = !isCancelled && !isCompleted && !isResultPending && !hasRecordedResult;

  const statusLabel = (() => {
    if (game.status === 'cancelled') return t('match.status.cancelled', 'Abgesagt');
    if (game.status === 'result_pending') return t('match.status.resultPending', 'Ergebnis ausstehend');
    if (game.status === 'result_disputed') return t('match.status.resultDisputed', 'Ergebnis abgelehnt');
    if (game.home_score != null && game.away_score != null) return t('match.status.completed');
    
    // Check if match is scheduled (status = 'scheduled' or has accepted proposal)
    if (game.status === 'scheduled' || (terminProposal && terminProposal.status === 'accepted')) {
      return t('match.status.scheduled');
    }

    const now = new Date();

    // For open time windows (fixed/range), a match is not completed just because the window started.
    // Only after the window end has passed, we treat it as completed without result.
    const isOpenWindow = game.when_type === 'fixed' || game.when_type === 'range' || (!!game.kickoff_end_at && game.when_type !== 'exact');
    if (isOpenWindow) {
      if (!game.kickoff_end_at) return t('match.status.datePending');
      const end = new Date(game.kickoff_end_at);
      if (Number.isNaN(end.getTime())) return t('match.status.pending');
      if (now.getTime() >= end.getTime()) return t('match.status.completedNoResult');
      return t('match.status.pending');
    }

    if (!game.kickoff_at) return t('match.status.datePending');
    const kickoff = new Date(game.kickoff_at);
    if (Number.isNaN(kickoff.getTime())) return t('match.status.pending');

    const diffMs = now.getTime() - kickoff.getTime();
    if (diffMs >= 0) {
      const diffMin = diffMs / 60000;
      if (diffMin < 60) return t('match.status.live');
      if (diffMin < 120) return t('match.status.ongoing');
      return t('match.status.completedNoResult');
    }

    const sameDay = now.getFullYear() === kickoff.getFullYear() && now.getMonth() === kickoff.getMonth() && now.getDate() === kickoff.getDate();
    if (sameDay) return t('match.status.today');
    return t('match.status.pending');
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
      setSubmitMsg(t('match.join.loginRequired')); 
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
      
      setSubmitMsg(t('match.result.pendingConfirmation', 'Ergebnis eingetragen — warte auf Bestätigung durch Gegner.'));
      setGame(j);
      setResultPending(true);
      setResultIsSubmitter(true);
    } catch (e) {
      if (e.name === 'AbortError') {
        setSubmitMsg(t('match.timeoutRetry'));
      } else {
        setSubmitMsg('❌ ' + (e.message || t('match.save.error')));
      }
    } finally {
      setSubmitLoading(false);
    }
  }

  async function confirmResult() {
    setConfirmLoading(true);
    setConfirmMsg('');
    try {
      const r = await fetch(`${API_BASE}/matches/${gameId}/result/confirm`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j?.error || j?.message || `HTTP ${r.status}`);
      setConfirmMsg(t('match.result.confirmed', 'Ergebnis bestätigt!'));
      setGame(j);
      setResultPending(false);
      setTimeout(() => { window.location.href = `/league/${leagueId || ''}`; }, 1500);
    } catch (e) {
      setConfirmMsg('❌ ' + (e.message || 'Fehler'));
    } finally {
      setConfirmLoading(false);
    }
  }

  async function rejectResult() {
    setConfirmLoading(true);
    setConfirmMsg('');
    try {
      const r = await fetch(`${API_BASE}/matches/${gameId}/result/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j?.error || j?.message || `HTTP ${r.status}`);
      setConfirmMsg(t('match.result.rejected', 'Ergebnis abgelehnt. Ein neues Ergebnis kann eingetragen werden.'));
      setGame(j);
      setResultPending(false);
      setCanSubmit(true);
      setCannotReason('');
    } catch (e) {
      setConfirmMsg('❌ ' + (e.message || 'Fehler'));
    } finally {
      setConfirmLoading(false);
    }
  }

  async function joinMatch(teamIndex) {
    setJoinMsg('');
    if (!token) { setJoinMsg(t('match.join.loginRequired')); return; }
    try {
      const opts = {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      };
      if (teamIndex != null) {
        opts.headers['Content-Type'] = 'application/json';
        opts.body = JSON.stringify({ team_index: teamIndex });
      }
      const r = await fetch(`${API_BASE}/matches/${gameId}/join`, opts);
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j?.error || `HTTP ${r.status}`);
      setJoinMsg(isTeamMatch ? t('match.teamAvailability.prompt') : t('match.join.ok'));
      // Re-fetch canonical projection to ensure names and permissions are fresh
      const fres = await fetch(`${API_BASE}/matches/${gameId}`);
      const fresh = await fres.json().catch(() => j);
      const freshGame = fres.ok ? fresh : j;
      setGame(freshGame);
      if (isTeamMatch && freshGame?.status !== 'scheduled' && freshGame?.status !== 'completed') {
        setShowTerminManager(true);
      }
    } catch (e) {
      setJoinMsg(e.message || t('match.join.failed'));
    }
  }

  async function selectTeam(teamIndex) {
    setJoinMsg('');
    if (!token) { setJoinMsg(t('match.join.loginRequired')); return; }
    try {
      const r = await fetch(`${API_BASE}/matches/${gameId}/select-team`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ team_index: teamIndex })
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j?.error || `HTTP ${r.status}`);
      setJoinMsg(isTeamMatch ? t('match.teamAvailability.prompt') : t('match.team.selected'));
      setGame(j);
    } catch (e) {
      setJoinMsg(e.message || t('match.team.selectFailed'));
    }
  }

  async function scheduleMatch(e) {
    e.preventDefault();
    setScheduleMsg('');
    setScheduleLoading(true);
    
    if (!token) { 
      setScheduleMsg(t('match.join.loginRequired')); 
      setScheduleLoading(false);
      return; 
    }
    if (!dateStr || !timeStr) { 
      setScheduleMsg(t('match.schedule.pickDateTime')); 
      setScheduleLoading(false);
      return; 
    }
    
    const scheduleAt = `${dateStr}T${timeStr}`; // local time string, backend will parse
    try {
      // Add timeout for better UX
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000); // 15s timeout
      
      setScheduleMsg(t('match.schedule.saving'));
      
      const r = await fetch(`${API_BASE}/matches/${gameId}/schedule`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ kickoff_at: scheduleAt, location: location && location.trim() ? location.trim() : undefined }),
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j?.error || `HTTP ${r.status}`);
      
      setScheduleMsg(t('match.schedule.saved'));
      
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
        setScheduleMsg(t('match.timeoutRetry'));
      } else {
        setScheduleMsg('❌ ' + (e.message || t('match.schedule.failed')));
      }
    } finally {
      setScheduleLoading(false);
    }
  }

  async function suggestNextSlot() {
    setScheduleMsg('');
    if (!token) { setScheduleMsg(t('match.join.loginRequired')); return; }
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
          setScheduleMsg(t('match.schedule.proposalTaken'));
        }
      }
    } catch (e) {
      setScheduleMsg(e.message || t('match.suggest.failed'));
    }
  }

  async function cancelMatch() {
    setScheduleMsg('');
    if (!token) { setScheduleMsg(t('match.join.loginRequired')); return; }
    if (!window.confirm(t('match.cancel.confirm'))) return;
    try {
      const r = await fetch(`${API_BASE}/matches/${gameId}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j?.error || `HTTP ${r.status}`);
      // Soft-delete: match is now cancelled, refresh page to show new status
      setScheduleMsg(t('match.cancel.success'));
      // Reload match data to reflect cancelled status
      setTimeout(() => window.location.reload(), 800);
    } catch (e) {
      setScheduleMsg(e.message || t('match.cancel.failed'));
    }
  }

  async function leaveMatch() {
    setScheduleMsg('');
    if (!token) { setScheduleMsg(t('match.join.loginRequired')); return; }
    if (!window.confirm(lang === 'en' ? 'Leave this match?' : 'Match verlassen?')) return;
    try {
      const r = await fetch(`${API_BASE}/matches/${gameId}/leave`, { method: 'POST', headers: { Authorization: `Bearer ${token}` } });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j?.error || `HTTP ${r.status}`);
      setScheduleMsg(lang === 'en' ? 'You left the match.' : 'Du hast das Match verlassen.');
      setTimeout(() => window.location.reload(), 800);
    } catch (e) {
      setScheduleMsg(e.message || (lang === 'en' ? 'Could not leave match.' : 'Match verlassen fehlgeschlagen.'));
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
      if (!res.ok) throw new Error(data.error || t('match.proposal.acceptError'));
      setProposalActionMsg(t('match.proposal.accepted'));
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
      setProposalActionMsg(e.message || t('match.errorPrefix'));
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
      if (!res.ok) throw new Error(data.error || t('match.proposal.rejectError'));
      setProposalActionMsg(t('match.proposal.rejected'));
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
      setProposalActionMsg(e.message || t('match.errorPrefix'));
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
        {(token && game && game.home_score == null && game.away_score == null && !isParticipant && hasCapacity) && (() => {
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
                {t('match.cta.title')}
              </div>
              <div style={{ 
                color: '#e8efe8', 
                fontSize: isMobile ? 13 : 15, 
                marginBottom: isMobile ? 14 : 18, 
                lineHeight: 1.6,
                fontWeight: 500
              }}>
                {isTeamMatch
                  ? t('match.cta.teamText', { name: playerA.name, joined: joinedCount, cap: maxPlayers ? `/${maxPlayers}` : '' })
                  : teamCount && teamCount >= 2
                    ? t('match.cta.teamText', { name: playerA.name, joined: joinedCount, cap: maxPlayers ? `/${maxPlayers}` : '' })
                    : t('match.cta.opponentText', { name: playerA.name })}
              </div>
              {isTeamMatch ? (
                <div style={{ display: 'flex', gap: 10 }}>
                  {[1, 2].map(ti => {
                    const cnt = ti === 1 ? team1Count : team2Count;
                    const full = ti === 1 ? team1Full : team2Full;
                    const canJoinTeam = canJoin && !full;
                    return (
                      <button
                        key={ti}
                        onClick={() => joinMatch(ti)}
                        disabled={!canJoinTeam}
                        style={{
                          flex: 1,
                          padding: isMobile ? '12px 10px' : '16px 20px',
                          borderRadius: 14,
                          border: 'none',
                          background: canJoinTeam ? (ti === 1 ? 'linear-gradient(135deg, #48baaa, #2f8f7f)' : 'linear-gradient(135deg, #debc7c, #c9a75f)') : 'rgba(58, 74, 69, 0.5)',
                          color: canJoinTeam ? '#10261f' : '#666',
                          cursor: canJoinTeam ? 'pointer' : 'not-allowed',
                          fontWeight: 800,
                          fontSize: isMobile ? 13 : 15,
                          boxShadow: canJoinTeam ? '0 6px 16px rgba(0,0,0,0.3)' : 'none',
                          transition: 'all 0.2s ease',
                          textTransform: 'uppercase',
                          letterSpacing: '0.3px'
                        }}
                      >
                        Team {ti} ({cnt}/{playersPerTeam})
                      </button>
                    );
                  })}
                </div>
              ) : (
              <button
                onClick={() => joinMatch()}
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
                {isOpenMatch ? t('match.cta.joinNow') : t('match.cta.acceptChallenge')}
              </button>
              )}
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
                  {t('match.cta.weeklyLimit')}
                </div>
              )}
            </div>
          );
        })()}

        {/* Terminvorschlag Widget - only for 1v1 matches */}
        {!isTeamMatch && terminProposal && terminProposal.status === 'sent' && (() => {
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
                📅 {t('match.proposal.title')}
              </div>
              
              {proposalActionMsg && (
                <div style={{
                  padding: isMobile ? 8 : 10,
                  marginBottom: isMobile ? 8 : 10,
                  borderRadius: 8,
                  background: proposalActionMsg.includes('✅') || proposalActionMsg.includes('accepted') || proposalActionMsg.includes('angenommen') ? 'rgba(74, 157, 95, 0.15)' : 'rgba(255, 107, 107, 0.15)',
                  border: `1px solid ${proposalActionMsg.includes('✅') || proposalActionMsg.includes('accepted') || proposalActionMsg.includes('angenommen') ? '#4a9d5f' : '#ff6b6b'}`,
                  color: proposalActionMsg.includes('✅') || proposalActionMsg.includes('accepted') || proposalActionMsg.includes('angenommen') ? '#6bff9d' : '#ff6b6b',
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
                    {dt ? dt.toLocaleString(uiLocale, { weekday: 'short', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : t('match.proposal.title')}
                  </div>
                  <div style={{ color: '#9db', fontSize: isMobile ? 11 : 13 }}>
                    {byYou ? t('match.proposal.byYou') : t('match.proposal.byOpponent')} · Status: <span style={{ color: '#c9a75f' }}>{t('match.proposal.pending')}</span>
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
                        {t('match.proposal.accept')}
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
                        {t('match.proposal.counter')}
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
                        {t('match.proposal.reject')}
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
                      {t('match.proposal.details')}
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
              {t('match.creator.title')}
            </div>
            <div style={{ 
              color: '#c5d9ce', 
              fontSize: isMobile ? 13 : 15, 
              lineHeight: 1.6, 
              marginBottom: isMobile ? 10 : 14,
              fontWeight: 500
            }}>
              {t('match.creator.subtitle')}
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
              {t('match.creator.badgeActive')}
            </div>
          </div>
        )}

        {/* Header row with action buttons */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: isMobile ? 12 : 14, marginTop: isMobile ? 16 : 20 }}>
          {/* Row 1: Title + Sport + Status */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <div style={{ fontSize: isMobile ? 22 : 30, fontWeight: 800, letterSpacing: '-0.5px', color: '#f4fff8' }}>{game.league || 'Liga'}</div>
              {localizedSportName && (
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
                  {localizedSportName}
                </div>
              )}
              <div style={{ 
                display: 'inline-flex', 
                alignItems: 'center', 
                gap: 6,
                padding: '4px 10px',
                background: isCompleted ? 'rgba(74, 222, 128, 0.12)' : isCancelled ? 'rgba(248, 113, 113, 0.12)' : 'rgba(255, 211, 93, 0.12)',
                border: `1px solid ${isCompleted ? 'rgba(74, 222, 128, 0.3)' : isCancelled ? 'rgba(248, 113, 113, 0.3)' : 'rgba(255, 211, 93, 0.3)'}`,
                borderRadius: 20
              }}>
                <span style={{ width: 8, height: 8, background: isCompleted ? '#4ade80' : isCancelled ? '#f87171' : '#ffd35d', borderRadius: '50%' }} />
                <span style={{ color: isCompleted ? '#4ade80' : isCancelled ? '#f87171' : '#ffd35d', fontSize: isMobile ? 11 : 12, fontWeight: 600 }}>{statusLabel || (isCompleted ? t('match.status.completed') : t('match.status.pending'))}</span>
              </div>
            </div>

            {/* Row 2: Match ID + Date/Time */}
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
                color: (booking || (terminProposal && terminProposal.status === 'accepted') || game.status === 'scheduled') ? '#9db' : '#ff9',
                fontWeight: 500
              }}>
                {/* Option 2: Termin vereinbart — Datum + Uhrzeit + Counter */}
                {(booking || (terminProposal && terminProposal.status === 'accepted') || game.status === 'scheduled') ? (
                  (() => {
                    const dt = booking ? booking.start_time : (terminProposal?.status === 'accepted' && terminProposal.proposed_datetime) ? terminProposal.proposed_datetime : game.kickoff_at;
                    return dt ? (
                      <>
                        📅 {formatDate(dt)}
                        {formatTime(dt) && <span style={{ marginLeft: 6 }}>{formatTime(dt)}</span>}
                        <span style={{ marginLeft: 8, color: '#9db', fontSize: isMobile ? 12 : 13 }}>({relativeFromNow(dt)})</span>
                      </>
                    ) : t('match.date.noneYet');
                  })()
                ) : (
                  /* Option 1: Kein Termin — Zeitraum/Deadline des Erstellers */
                  game.when_type === 'range' && game.kickoff_end_at ? (
                    <>{timeRemaining(game.kickoff_end_at)}</>
                  ) : game.when_type === 'exact' && game.kickoff_at ? (
                    <>{lang === 'en' ? 'on' : 'am'} {formatDate(game.kickoff_at)}</>
                  ) : game.when_type === 'fixed' && game.kickoff_at && game.kickoff_end_at ? (
                    <>{t('match.date.period', { from: formatDate(game.kickoff_at), to: formatDate(game.kickoff_end_at) })}</>
                  ) : game.kickoff_end_at ? (
                    <>{timeRemaining(game.kickoff_end_at)}</>
                  ) : (
                    t('match.date.noneYet')
                  )
                )}
              </div>
            </div>
          
          {/* Row 3: Action buttons */}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
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
                {t('match.chat')}
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
            )}
            {(token && game && !isCancelled && game.home_score == null && game.away_score == null && (game.away_user_id == null && !game.away) && viewerId && game.home_user_id && String(game.home_user_id) === String(viewerId)) && (
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
              }}>{t('match.cancel')}</button>
            )}
          </div>
        </div>
        {/* Availability section - above participants */}
        {(token && game && isParticipant && game.home_score == null && game.away_score == null && game.status !== 'scheduled' && game.status !== 'completed' && !isCancelled) && (
          <div style={{
            marginTop: isMobile ? 16 : 20,
            padding: isMobile ? '16px' : '20px',
            background: (terminMeta?.myDaysCount > 0) ? 'rgba(47, 107, 87, 0.12)' : 'rgba(72, 186, 170, 0.12)',
            border: `1px solid ${(terminMeta?.myDaysCount > 0) ? 'rgba(47, 107, 87, 0.35)' : 'rgba(72, 186, 170, 0.35)'}`,
            borderRadius: 12,
            display: 'flex',
            flexDirection: isMobile ? 'column' : 'row',
            alignItems: isMobile ? 'stretch' : 'center',
            justifyContent: 'space-between',
            gap: 12
          }}>
            {(terminMeta?.myDaysCount > 0) ? (
              <>
                <div style={{ fontSize: isMobile ? 13 : 14, color: '#9db', fontWeight: 500 }}>
                  {lang === 'en' ? 'Your availability is saved.' : 'Deine Verfügbarkeiten sind hinterlegt.'}
                </div>
                <button
                  onClick={() => setShowTerminManager(true)}
                  style={{
                    padding: isMobile ? '8px 14px' : '10px 16px',
                    borderRadius: 10,
                    border: '1px solid rgba(47, 107, 87, 0.55)',
                    background: 'rgba(47, 107, 87, 0.3)',
                    color: '#9db',
                    fontSize: isMobile ? 13 : 14,
                    fontWeight: 600,
                    cursor: 'pointer',
                    whiteSpace: 'nowrap'
                  }}
                >
                  {lang === 'en' ? 'Change availability' : 'Verfügbarkeiten ändern'}
                </button>
              </>
            ) : (
              <>
                <div>
                  <div style={{ fontSize: isMobile ? 14 : 15, color: '#48baaa', fontWeight: 700, marginBottom: 4 }}>
                    {t('match.teamAvailability.title')}
                  </div>
                  <div style={{ fontSize: isMobile ? 12 : 13, color: '#d7efe8', lineHeight: 1.5 }}>
                    {t('match.teamAvailability.hint')}
                  </div>
                </div>
                <button
                  onClick={() => setShowTerminManager(true)}
                  style={{
                    padding: isMobile ? '10px 14px' : '12px 16px',
                    borderRadius: 10,
                    border: '1px solid rgba(72, 186, 170, 0.55)',
                    background: 'linear-gradient(135deg, #48baaa, #2f8f7f)',
                    color: '#071716',
                    fontSize: isMobile ? 13 : 14,
                    fontWeight: 700,
                    cursor: 'pointer',
                    whiteSpace: 'nowrap'
                  }}
                >
                  {t('match.teamAvailability.open')}
                </button>
              </>
            )}
          </div>
        )}

        {/* Team selection for participant-based team matches */}
        {(token && game && isParticipant && allowTeamChoice && teamCount >= 2 && (maxPlayers == null || maxPlayers > 2) && !isCompleted) && (
          <div style={{
            padding: isMobile ? '12px' : '14px',
            background: 'rgba(47, 107, 87, 0.12)',
            border: '1px solid rgba(47, 107, 87, 0.35)',
            borderRadius: 14,
            marginTop: isMobile ? 14 : 18,
            marginBottom: isMobile ? 4 : 6,
          }}>
            <div style={{ fontWeight: 800, color: '#debc7c', marginBottom: 10 }}>
              {t('match.team.selectTitle')}
            </div>
            {viewerTeamIndex == null && (
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: isMobile ? '10px 12px' : '12px 16px',
                marginBottom: 12,
                background: 'rgba(222, 188, 124, 0.08)',
                border: '1px dashed rgba(222, 188, 124, 0.4)',
                borderRadius: 12,
                color: '#e8efe8',
                fontSize: isMobile ? 13 : 14,
                lineHeight: 1.5,
              }}>
                <span style={{ fontSize: 22, flexShrink: 0 }}>👋</span>
                <span>{t('match.team.notSelected')}</span>
              </div>
            )}
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <button
                onClick={() => selectTeam(1)}
                style={{
                  padding: '10px 14px',
                  borderRadius: 12,
                  border: '1px solid #2f6b57',
                  background: viewerTeamIndex === 1 ? 'linear-gradient(135deg, #debc7c, #c9a75f)' : '#0f2a20',
                  color: viewerTeamIndex === 1 ? '#10261f' : '#e8efe8',
                  cursor: 'pointer',
                  fontWeight: 800,
                }}
              >
                {t('match.team.team1')}
              </button>
              <button
                onClick={() => selectTeam(2)}
                style={{
                  padding: '10px 14px',
                  borderRadius: 12,
                  border: '1px solid #2f6b57',
                  background: viewerTeamIndex === 2 ? 'linear-gradient(135deg, #debc7c, #c9a75f)' : '#0f2a20',
                  color: viewerTeamIndex === 2 ? '#10261f' : '#e8efe8',
                  cursor: 'pointer',
                  fontWeight: 800,
                }}
              >
                {t('match.team.team2')}
              </button>
            </div>
            {joinMsg && (
              <div style={{ marginTop: 10, fontSize: 13, color: '#cfe8dc' }}>{joinMsg}</div>
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
          {/* Zeile 1: Spieler oder Teams */}
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
              {isTeamMatch ? (
                <>
                  <div style={{
                    width: isMobile ? 50 : 70,
                    height: isMobile ? 50 : 70,
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: 'linear-gradient(135deg, rgba(72,186,170,0.35), rgba(47,143,127,0.18))',
                    border: '1px solid rgba(72,186,170,0.45)',
                    color: '#7de5d2',
                    fontWeight: 900,
                    fontSize: isMobile ? 16 : 22,
                    letterSpacing: '0.5px',
                    flexShrink: 0
                  }}>
                    T1
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ 
                      fontSize: isMobile ? 16 : 20, 
                      fontWeight: 800,
                      letterSpacing: '-0.3px',
                      color: '#f4fff8',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap'
                    }}>{teamDisplayA}</div>
                    <div style={{ 
                      color: '#9db', 
                      fontSize: isMobile ? 12 : 13,
                      fontWeight: 500,
                      marginTop: 2
                    }}>{t('match.team.team1')}</div>
                  </div>
                </>
              ) : playerA.id ? (
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
                      }}>{t('match.rank', { rank: tablePositions[playerA.name].rank })}</div>
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
                      }}>{t('match.rank', { rank: tablePositions[playerA.name].rank })}</div>
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
              {isTeamMatch ? (
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
                    }}>{teamDisplayB}</div>
                    <div style={{ 
                      color: '#9db', 
                      fontSize: isMobile ? 12 : 13,
                      fontWeight: 500,
                      marginTop: 2
                    }}>{t('match.team.team2')}</div>
                  </div>
                  <div style={{
                    width: isMobile ? 50 : 70,
                    height: isMobile ? 50 : 70,
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: 'linear-gradient(135deg, rgba(222,188,124,0.35), rgba(201,167,95,0.18))',
                    border: '1px solid rgba(222,188,124,0.45)',
                    color: '#f0cd8a',
                    fontWeight: 900,
                    fontSize: isMobile ? 16 : 22,
                    letterSpacing: '0.5px',
                    flexShrink: 0,
                    order: 2
                  }}>
                    T2
                  </div>
                </>
              ) : playerB.id ? (
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
                      }}>{t('match.rank', { rank: tablePositions[playerB.name].rank })}</div>
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
                      }}>{t('match.rank', { rank: tablePositions[playerB.name].rank })}</div>
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

          {/* Zeile 2: Team-Teilnehmer (nur bei Team-Matches) */}
          {isTeamMatch && participants.length > 0 && (
            <div style={{ display: 'flex', gap: isMobile ? 10 : 16, marginBottom: isMobile ? 12 : 16 }}>
              {[1, 2].map(ti => {
                const teamMembers = participants.filter(p => Number(p.team_index) === ti);
                const ppt = playersPerTeam || '?';
                return (
                  <div key={ti} style={{ flex: 1, padding: isMobile ? 10 : 14, background: 'rgba(10, 28, 23, 0.5)', borderRadius: 12, border: `1px solid ${ti === 1 ? 'rgba(72,186,170,0.3)' : 'rgba(222,188,124,0.3)'}` }}>
                    <div style={{ fontSize: isMobile ? 12 : 13, fontWeight: 700, color: ti === 1 ? '#48baaa' : '#debc7c', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                      Team {ti} ({teamMembers.length}/{ppt})
                    </div>
                    {teamMembers.length === 0 ? (
                      <div style={{ fontSize: isMobile ? 11 : 12, color: '#7a9a8a', fontStyle: 'italic' }}>Noch keine Spieler</div>
                    ) : (
                      teamMembers.map(p => (
                        <Link key={p.user_id} to={`/user/${p.user_id}`} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, textDecoration: 'none' }}>
                          <Avatar userId={p.user_id} name={p.display_name || p.username || `Spieler ${p.user_id}`} size={28} />
                          <span style={{ fontSize: isMobile ? 12 : 13, color: '#e8efe8', fontWeight: 500 }}>{p.display_name || p.username || `Spieler ${p.user_id}`}</span>
                        </Link>
                      ))
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Teams full message - creator will schedule */}
          {isTeamMatch && team1Full && team2Full && game.status === 'open' && (
            <div style={{
              padding: isMobile ? '10px 14px' : '12px 16px',
              marginBottom: isMobile ? 12 : 16,
              background: 'rgba(222, 188, 124, 0.1)',
              border: '1px solid rgba(222, 188, 124, 0.3)',
              borderRadius: 10,
              display: 'flex',
              alignItems: 'center',
              gap: 8
            }}>
              <span style={{ fontSize: 16 }}>&#9203;</span>
              <span style={{ fontSize: isMobile ? 12 : 13, color: '#debc7c', fontWeight: 500 }}>
                {lang === 'en'
                  ? `All teams are full! ${playerA.name} will set the date for this match.`
                  : `Alle Teams sind voll! ${playerA.name} wird das Datum für dieses Match festlegen.`}
              </span>
            </div>
          )}

          {/* Zeile 3: Ergebnis / Ergebnis Eintragen */}
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
            ) : isResultPending ? (
              /* Ergebnis wartet auf Bestätigung */
              <div style={{
                marginBottom: isMobile ? 16 : 20,
                padding: isMobile ? 16 : 20,
                background: 'rgba(15, 42, 32, 0.8)',
                borderRadius: 12,
                border: '1px solid rgba(212, 175, 55, 0.4)',
                textAlign: 'center'
              }}>
                <div style={{ 
                  fontSize: isMobile ? 13 : 15, 
                  fontWeight: 700, 
                  color: '#debc7c', 
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px',
                  marginBottom: 12
                }}>
                  {t('match.result.pendingTitle', 'Ergebnis wartet auf Bestätigung')}
                </div>
                <div style={{ 
                  fontSize: isMobile ? 28 : 40, 
                  fontWeight: 900, 
                  color: '#e8efe8',
                  marginBottom: 16
                }}>
                  {game.home_score != null ? Number(game.home_score) : (pendingScore?.home_score ?? '?')} : {game.away_score != null ? Number(game.away_score) : (pendingScore?.away_score ?? '?')}
                </div>
                {resultIsSubmitter ? (
                  <div style={{ 
                    fontSize: isMobile ? 12 : 14,
                    color: '#9db',
                    fontStyle: 'italic'
                  }}>
                    {waitingForConfirmationText}
                  </div>
                ) : (
                  <div>
                    <div style={{ 
                      fontSize: isMobile ? 12 : 14,
                      color: '#c8dcc8',
                      marginBottom: 14
                    }}>
                      {opponentSubmittedText}
                    </div>
                    <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
                      <button 
                        onClick={confirmResult}
                        disabled={confirmLoading}
                        style={{
                          padding: isMobile ? '10px 20px' : '12px 28px',
                          borderRadius: 24,
                          border: 'none',
                          background: 'linear-gradient(135deg, #2ecc71, #27ae60)',
                          color: '#fff',
                          fontSize: isMobile ? 13 : 15,
                          fontWeight: 700,
                          cursor: confirmLoading ? 'not-allowed' : 'pointer',
                          opacity: confirmLoading ? 0.6 : 1,
                          textTransform: 'uppercase',
                          letterSpacing: '0.5px',
                          boxShadow: '0 4px 12px rgba(46, 204, 113, 0.3)',
                          transition: 'all 0.2s ease'
                        }}
                      >
                        {t('match.result.confirm', 'Bestätigen')}
                      </button>
                      <button 
                        onClick={rejectResult}
                        disabled={confirmLoading}
                        style={{
                          padding: isMobile ? '10px 20px' : '12px 28px',
                          borderRadius: 24,
                          border: '1px solid rgba(231, 76, 60, 0.5)',
                          background: 'rgba(231, 76, 60, 0.15)',
                          color: '#e74c3c',
                          fontSize: isMobile ? 13 : 15,
                          fontWeight: 700,
                          cursor: confirmLoading ? 'not-allowed' : 'pointer',
                          opacity: confirmLoading ? 0.6 : 1,
                          textTransform: 'uppercase',
                          letterSpacing: '0.5px',
                          transition: 'all 0.2s ease'
                        }}
                      >
                        {t('match.result.reject', 'Ablehnen')}
                      </button>
                    </div>
                    {confirmMsg && (
                      <div style={{ 
                        marginTop: 12, 
                        fontSize: isMobile ? 12 : 14, 
                        color: confirmMsg.startsWith('❌') ? '#e74c3c' : '#2ecc71',
                        fontWeight: 600
                      }}>
                        {confirmMsg}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ) : (token && isParticipant && !!game.kickoff_at && (game.away_user_id != null || game.away)) ? (
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
                      {t('match.result.entryTitle')}
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
                          {t('match.tennis.setCount')}
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
                      {submitLoading ? t('match.save.loading') : t('match.saveResult')}
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
                        {cannotReason === 'KICKOFF_NOT_SET' ? t('match.cannot.kickoffNotSet') : 
                         cannotReason === 'KICKOFF_NOT_REACHED' ? t('match.cannot.kickoffNotReached') :
                         cannotReason === 'LEAGUE_MEMBERS_ONLY' ? t('match.cannot.leagueMembersOnly') : cannotReason}
                      </div>
                    )}
                    {submitMsg && (
                      <div style={{ 
                        color: submitMsg.includes('✅') ? '#99ff99' : '#ff9999', 
                        fontSize: isMobile ? 12 : 13, 
                        textAlign: 'center',
                        marginTop: 10,
                        fontWeight: 600,
                        padding: '8px 12px',
                        background: submitMsg.includes('✅') ? 'rgba(153, 255, 153, 0.1)' : 'rgba(255, 153, 153, 0.1)',
                        borderRadius: 8,
                        border: submitMsg.includes('✅') ? '1px solid rgba(153, 255, 153, 0.3)' : '1px solid rgba(255, 153, 153, 0.3)'
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
          {!isTeamMatch && ((playerA.id && histA.length > 0) || (playerB.id && histB.length > 0)) ? (
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
                    <div style={{ marginBottom: 6, fontWeight: 700, fontSize: isMobile ? 10 : 11, textTransform: 'uppercase', letterSpacing: '0.5px', opacity: 0.8 }}>{t('match.lastForm')}</div>
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
                            {won ? t('match.form.win') : draw ? t('match.form.draw') : t('match.form.loss')}
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
                    <div style={{ marginBottom: 6, fontWeight: 700, fontSize: isMobile ? 10 : 11, textTransform: 'uppercase', letterSpacing: '0.5px', opacity: 0.8 }}>{t('match.lastForm')}</div>
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
                            {won ? t('match.form.win') : draw ? t('match.form.draw') : t('match.form.loss')}
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
            isTeamMatch={isTeamMatch}
            allTeamsFull={isTeamMatch && team1Full && team2Full}
            matchInfo={{
              home_player: isTeamMatch ? teamDisplayA : (game.home_user_name || game.home || t('tm.player1')),
              away_player: isTeamMatch ? teamDisplayB : (game.away_user_name || game.away || t('tm.player2')),
              sport: game.sport,
              league: game.league_name,
              when_type: game.when_type,
              kickoff_at: game.kickoff_at,
              kickoff_end_at: game.kickoff_end_at
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

        {/* Join match CTA wird oben im Hero angezeigt */}

        {/* Match verlassen Button */}
        {(token && game && !isCancelled && isParticipant && game.home_score == null && game.away_score == null && game.status !== 'scheduled' && game.status !== 'completed' && viewerId && game.home_user_id && String(game.home_user_id) !== String(viewerId)) && (
          <div style={{ marginTop: 20, textAlign: 'center' }}>
            <button onClick={leaveMatch} style={{ 
              padding: isMobile ? '10px 16px' : '12px 20px', 
              borderRadius: 10, 
              border: '1px solid rgba(85, 63, 63, 0.6)', 
              background: 'linear-gradient(135deg, rgba(42, 27, 27, 0.9), rgba(42, 27, 27, 0.7))', 
              color: '#e9d8d8', 
              fontSize: isMobile ? 13 : 14,
              fontWeight: 600,
              cursor: 'pointer',
              boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
              transition: 'all 0.2s ease'
            }}>{lang === 'en' ? 'Leave Match' : 'Match verlassen'}</button>
          </div>
        )}
        
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
  const { t, lang } = useLanguage();
  const localizedSportName = localizeSportName(game?.sport, lang);
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
        setSlotsError(t('match.slots.loadError'));
        setAvailableSlots([]);
      }
    } catch (err) {
      console.error('Failed to search slots:', err);
      setSlotsError(err.message || t('match.networkError'));
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
          {t('match.schedule.editDate')}
        </button>
      )}
      {open && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Step 1: Location Selection Mode */}
          <div>
            <h4 style={{ color: '#e8efe8', margin: '0 0 12px 0' }}>1️⃣ {t('match.schedule.setLocation')}</h4>
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
                📍 {t('match.schedule.manualLocation')}
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
                🏟️ {t('match.schedule.bookCourt')}
              </button>
            </div>
          </div>

          {/* Manual Location Input */}
          {locationMode === 'manual' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <label style={{ color: '#9db', fontSize: '14px', fontWeight: '500' }}>{t('match.booking.locationLabel')}</label>
              <LocationSelector
                cities={cities}
                countries={countries}
                states={states}
                districts={districts}
                value={selectedLocationName}
                onChange={handleLocationChange}
                onLoadDistricts={handleLoadDistricts}
                placeholder={t('match.booking.locationPlaceholder')}
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
                    <label style={{ color: '#9db', fontSize: '13px', fontWeight: '500' }}>{t('match.booking.date')}</label>
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
                    <label style={{ color: '#9db', fontSize: '13px', fontWeight: '500' }}>{t('match.booking.time')}</label>
                    <TimeCounter
                      hours={hours}
                      minutes={minutes}
                      onHoursChange={(h) => { setHours(h); }}
                      onMinutesChange={(m) => { setMinutes(m); }}
                    />
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8, flex: '1 1 180px' }}>
                    <label style={{ color: '#9db', fontSize: '13px', fontWeight: '500' }}>
                      {t('match.booking.city')} {game?.city && <span style={{ color: '#6a8', fontSize: '11px' }}>({t('match.booking.cityDefault', { city: game.city })})</span>}
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
                      <option value="">{game?.city || t('match.booking.allCities')}</option>
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
                    {t('match.booking.availableCourts')}
                    {localizedSportName && <span style={{ color: '#6a8', fontSize: 14, fontWeight: 400, marginLeft: 8 }}>· {localizedSportName}</span>}
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
                      {t('match.booking.courtsCount', { count: availableSlots.length })}
                    </div>
                  )}
                </div>

                {loadingSlots ? (
                  <div style={{ padding: 40, textAlign: 'center', color: '#9db', background: '#0f2a20', borderRadius: 10 }}>
                    <div style={{ fontSize: 32, marginBottom: 8 }}>⏳</div>
                    <div>{t('match.booking.searchingCourts')}</div>
                  </div>
                ) : slotsError ? (
                  <div style={{ padding: 30, textAlign: 'center', color: '#ff6b6b', background: '#2a0f0f', borderRadius: 10 }}>
                    <div style={{ fontSize: 32, marginBottom: 8 }}>❌</div>
                    <div>{slotsError}</div>
                  </div>
                ) : availableSlots.length === 0 ? (
                  <div style={{ padding: 40, textAlign: 'center', color: '#9db', background: '#0f2a20', borderRadius: 10 }}>
                    <div style={{ fontSize: 32, marginBottom: 12 }}>🔍</div>
                    <p style={{ margin: '0 0 8px 0', fontSize: 15 }}>{t('match.booking.noCourtsFound')}</p>
                    <p style={{ fontSize: 13, margin: 0, color: '#789' }}>
                      {t('match.booking.forTime', { date: dateStr, time: `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}` })}
                    </p>
                    <p style={{ fontSize: 13, marginTop: 12, color: '#789' }}>{t('match.booking.tryOther')}</p>
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
                            {t('match.booking.nextFree')}
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
                            🕐 {t('match.schedule.timeDisplay', { from: displayStartTime, to: displayEndTime })}
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
                            {t('match.schedule.bookNow')} →
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
                {loading ? t('match.save.loading') : t('match.timeLocation.save')}
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
                {t('common.cancel')}
              </button>
            </div>
          )}
          
          {message && (
            <div style={{ 
              padding: '10px 12px', 
              borderRadius: 8,
              background: message.includes('✅') ? '#102a22' : '#2a1212',
              border: `1px solid ${message.includes('✅') ? '#2f6b57' : '#6b2f2f'}`,
              color: message.includes('✅') ? '#9f9' : '#fcc'
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
