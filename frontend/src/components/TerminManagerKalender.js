import React, { useEffect, useMemo, useState } from 'react';
import { useLanguage } from '../i18n';
import { API_BASE } from '../config';

function fmtDate(dateStr, loc = 'de-DE') {
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString(loc, { weekday: 'short', day: '2-digit', month: '2-digit' });
}

function fmtTime(timeStr) {
  if (!timeStr) return '';
  return timeStr.substring(0, 5);
}

function parseTime(dateStr, timeStr) {
  if (!dateStr || !timeStr) return null;
  const d = new Date(`${dateStr}T${timeStr}`);
  if (Number.isNaN(d.getTime())) return null;
  return d;
}

function getWeekInfo(dateStr) {
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return null;
  const day = (d.getDay() + 6) % 7; // Montag = 0
  const thursday = new Date(d);
  thursday.setDate(d.getDate() - day + 3);
  const weekYear = thursday.getFullYear();
  const firstThursday = new Date(weekYear, 0, 4);
  const week = 1 + Math.round(((thursday - firstThursday) / 86400000 - 3) / 7);
  const weekStart = new Date(d);
  weekStart.setDate(d.getDate() - day);
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 6);
  return {
    key: `${weekYear}-W${String(week).padStart(2, '0')}`,
    week,
    weekYear,
    weekStartStr: weekStart.toISOString().slice(0, 10),
    weekEndStr: weekEnd.toISOString().slice(0, 10)
  };
}

function fmtWeekRange(startStr, endStr, loc = 'de-DE') {
  if (!startStr || !endStr) return '';
  const start = new Date(startStr);
  const end = new Date(endStr);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return '';
  return `${start.toLocaleDateString(loc, { day: '2-digit', month: '2-digit' })} - ${end.toLocaleDateString(loc, { day: '2-digit', month: '2-digit' })}`;
}

function createDefaultRange(start = '18:00', end = '20:00') {
  return { id: `r-${Math.random().toString(36).slice(2, 8)}`, start, end };
}

function parseTimeToMinutes(timeStr) {
  const [h, m] = String(timeStr || '').split(':').map(Number);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return null;
  return h * 60 + m;
}

function minutesToTimeString(minutes) {
  const capped = Math.max(0, Math.min(23 * 60 + 45, minutes));
  const h = Math.floor(capped / 60);
  const m = capped % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function snapToQuarter(timeStr) {
  const mins = parseTimeToMinutes(timeStr);
  if (mins === null) return '';
  return minutesToTimeString(Math.round(mins / 15) * 15);
}

function enumerateDates(startIso, endIso) {
  if (!startIso) return [];
  const start = new Date(startIso);
  const end = endIso ? new Date(endIso) : new Date(startIso);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return [];
  const startDay = new Date(start);
  const endDay = new Date(end);
  startDay.setHours(12, 0, 0, 0);
  endDay.setHours(12, 0, 0, 0);
  const dates = [];
  for (let current = new Date(startDay); current <= endDay; current.setDate(current.getDate() + 1)) {
    dates.push(new Date(current).toISOString().slice(0, 10));
  }
  return dates;
}

function generateAvailableTimes(startTime, endTime, durationMinutes) {
  if (!startTime || !endTime) return [];
  const times = [];
  const [startH, startM] = startTime.split(':').map(Number);
  const [endH, endM] = endTime.split(':').map(Number);
  const startMinutes = startH * 60 + startM;
  const endMinutes = endH * 60 + endM;
  const slotEnd = endMinutes - durationMinutes;
  
  for (let m = startMinutes; m <= slotEnd; m += 15) {
    const h = Math.floor(m / 60);
    const min = m % 60;
    times.push(`${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`);
  }
  return times;
}

function groupFramesByWeek(frameList) {
  const grouped = {};
  (frameList || []).forEach((f) => {
    const info = getWeekInfo(f.date);
    if (!info) return;
    if (!grouped[info.key]) grouped[info.key] = { ...info, daysMap: {} };
    if (!grouped[info.key].daysMap[f.date]) grouped[info.key].daysMap[f.date] = [];
    grouped[info.key].daysMap[f.date].push(f);
  });
  return Object.values(grouped)
    .map((w) => ({
      ...w,
      days: Object.entries(w.daysMap)
        .map(([date, arr]) => ({ date, frames: arr.sort((a, b) => (a.time_start || '').localeCompare(b.time_start || '')) }))
        .sort((a, b) => a.date.localeCompare(b.date))
    }))
    .sort((a, b) => (a.weekStartStr || '').localeCompare(b.weekStartStr || ''));
}

export default function TerminManagerKalender({ matchId, token, onClose, onInvitationSent, matchInfo, isTeamMatch: isTeamMatchProp, allTeamsFull }) {
  const { t, lang } = useLanguage();
  const locale = lang === 'en' ? 'en-GB' : 'de-DE';
  const isEn = lang === 'en';
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [frames, setFrames] = useState([]);
  const [slots, setSlots] = useState([]);
  const [meta, setMeta] = useState(null);
  const [myAvailability, setMyAvailability] = useState([]);
  const [otherAvailability, setOtherAvailability] = useState([]);
  const [allAvailability, setAllAvailability] = useState([]);
  const [proposals, setProposals] = useState([]);

  // Eigene Verfügbarkeiten anlegen
  const [showAddSlot, setShowAddSlot] = useState(false);
  const [availabilityMode, setAvailabilityMode] = useState('preset');
  const [presetSelections, setPresetSelections] = useState({ morning: false, midday: false, evening: false });
  const [selectedDates, setSelectedDates] = useState([]);
  const [tempTimesByDate, setTempTimesByDate] = useState({});
  const [savingAvailability, setSavingAvailability] = useState(false);

  // Gast: Wunschstart je Frame
  const [customTimes, setCustomTimes] = useState({});
  const [sending, setSending] = useState(false);

  // Modal für Gegner-Verfügbarkeiten
  const [selectedAvailSlot, setSelectedAvailSlot] = useState(null);
  const [proposedTime, setProposedTime] = useState('');
  const [availableTimes, setAvailableTimes] = useState([]);
  const [timeIndex, setTimeIndex] = useState(0);
  const [rejectingProposal, setRejectingProposal] = useState(null);

  // Direct schedule (team matches only, creator)
  const [scheduleDate, setScheduleDate] = useState('');
  const [scheduleTime, setScheduleTime] = useState('');
  const [scheduling, setScheduling] = useState(false);

  const isTeamMatch = isTeamMatchProp || meta?.isTeamMatch || false;
  const isCreator = meta?.isHost || false;

  const slotDuration = useMemo(() => {
    const candidate = meta?.slotDurationMinutes ?? meta?.matchDurationMinutes ?? 60;
    const n = Number(candidate);
    return Number.isFinite(n) && n > 0 ? n : 60;
  }, [meta]);

  const presetOptions = useMemo(() => ([
    { key: 'morning', label: t('match.search.presetMorning'), start: '08:00', end: '11:00' },
    { key: 'midday', label: t('match.search.presetMidday'), start: '12:00', end: '16:00' },
    { key: 'evening', label: t('match.search.presetEvening'), start: '17:00', end: '21:00' },
  ]), [t]);

  useEffect(() => {
    if (matchId && token) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [matchId, token]);

  // Auto-clear success message
  useEffect(() => {
    if (success) {
      const timer = setTimeout(() => setSuccess(''), 3500);
      return () => clearTimeout(timer);
    }
  }, [success]);

  async function load() {
    setLoading(true);
    setError('');
    try {
      const [slotsRes, availRes, terminRes] = await Promise.all([
        fetch(`${API_BASE}/matches/${matchId}/time-slots`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`${API_BASE}/matches/${matchId}/availability`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`${API_BASE}/matches/${matchId}/termin-manager`, { headers: { Authorization: `Bearer ${token}` } })
      ]);

      const slotsData = await slotsRes.json().catch(() => ({}));
      if (!slotsRes.ok) {
        throw new Error(slotsData.error || `HTTP ${slotsRes.status}: Fehler beim Laden`);
      }

      const availData = await availRes.json().catch(() => ({}));
      // availability endpoint is best-effort; do not block UI if it fails
      if (availRes.ok) {
        setMyAvailability(availData.myAvailability || []);
        setOtherAvailability(availData.theirAvailability || []);
        setAllAvailability(availData.allAvailability || []);
      } else {
        setMyAvailability([]);
        setOtherAvailability([]);
        setAllAvailability([]);
      }

      const terminData = await terminRes.json().catch(() => ({}));
      if (terminRes.ok && terminData.proposal) {
        setProposals([terminData.proposal]);
      } else {
        setProposals([]);
      }

      setFrames(slotsData.frames || []);
      setSlots(slotsData.slots || []);
      setMeta(slotsData.meta || {});
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  function latestStart(frame) {
    const end = parseTime(frame.date, frame.time_end);
    if (!end) return '';
    const latest = new Date(end.getTime() - slotDuration * 60000);
    if (Number.isNaN(latest.getTime())) return '';
    return `${String(latest.getHours()).padStart(2, '0')}:${String(latest.getMinutes()).padStart(2, '0')}`;
  }

  async function proposeSlot(frame) {
    if (!meta?.canProposeSlots && !meta?.canCreateSlots) {
      setError(t('tm.onlyGuestCanSend'));
      return;
    }
    const chosen = customTimes[frame.id] || fmtTime(frame.time_start);
    const start = parseTime(frame.date, chosen);
    const frameStart = parseTime(frame.date, frame.time_start);
    const frameEnd = parseTime(frame.date, frame.time_end);
    if (!start || !frameStart || !frameEnd) {
      setError(t('tm.invalidTime'));
      return;
    }
    const end = new Date(start.getTime() + slotDuration * 60000);
    if (start < frameStart || end > frameEnd) {
      setError(t('tm.outsideFrame'));
      return;
    }
    setSending(true);
    setError('');
    try {
      const res = await fetch(`${API_BASE}/matches/${matchId}/time-slots`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          frameId: frame.id,
          slotStart: start.toISOString(),
          slotEnd: end.toISOString(),
          durationMinutes: slotDuration
        })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || t('tm.sendError'));
      setCustomTimes((prev) => ({ ...prev, [frame.id]: chosen }));
      setSuccess(t('tm.slotProposed'));
      load();
    } catch (e) {
      setError(e.message);
    } finally {
      setSending(false);
    }
  }

  async function acceptSlot(slotId) {
    try {
      const res = await fetch(`${API_BASE}/matches/${matchId}/time-slots/${slotId}/accept`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || t('tm.acceptError'));
      setSuccess(t('tm.slotAccepted'));
      load();
    } catch (e) {
      setError(e.message);
    }
  }

  async function removeSlot(slotId) {
    try {
      const res = await fetch(`${API_BASE}/matches/${matchId}/time-slots/${slotId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || t('tm.deleteError'));
      load();
    } catch (e) {
      setError(e.message);
    }
  }

  function openAvailSlotModal(slot) {
    setSelectedAvailSlot(slot);
    const times = generateAvailableTimes(slot.time_start, slot.time_end, slotDuration);
    setAvailableTimes(times);
    setTimeIndex(0);
    setProposedTime(times[0] || slot.time_start || '');
    setError('');
  }

  function closeAvailSlotModal() {
    setSelectedAvailSlot(null);
    setProposedTime('');
    setAvailableTimes([]);
    setTimeIndex(0);
    setError('');
    setRejectingProposal(null);
  }

  function prevTime() {
    if (timeIndex > 0) {
      const newIndex = timeIndex - 1;
      setTimeIndex(newIndex);
      setProposedTime(availableTimes[newIndex]);
    }
  }

  function nextTime() {
    if (timeIndex < availableTimes.length - 1) {
      const newIndex = timeIndex + 1;
      setTimeIndex(newIndex);
      setProposedTime(availableTimes[newIndex]);
    }
  }

  function latestStartForAvailSlot(slot) {
    if (!slot || !slot.date || !slot.time_end) return '';
    const end = parseTime(slot.date, slot.time_end);
    if (!end) return '';
    const latest = new Date(end.getTime() - slotDuration * 60000);
    if (Number.isNaN(latest.getTime())) return '';
    return `${String(latest.getHours()).padStart(2, '0')}:${String(latest.getMinutes()).padStart(2, '0')}`;
  }

  async function sendAvailabilityInvitation() {
    if (!selectedAvailSlot || !proposedTime) {
      setError(t('tm.selectStartTime'));
      return;
    }
    const start = parseTime(selectedAvailSlot.date, proposedTime);
    const frameStart = parseTime(selectedAvailSlot.date, selectedAvailSlot.time_start);
    const frameEnd = parseTime(selectedAvailSlot.date, selectedAvailSlot.time_end);
    if (!start || !frameStart || !frameEnd) {
      setError(t('tm.invalidTime'));
      return;
    }
    const end = new Date(start.getTime() + slotDuration * 60000);
    if (start < frameStart || end > frameEnd) {
      setError(t('tm.outsideAvail'));
      return;
    }
    setSending(true);
    setError('');
    setSuccess('');
    try {
      // If sending as counter-proposal, reject the original first
      if (rejectingProposal) {
        const rejectRes = await fetch(`${API_BASE}/matches/${matchId}/termin-manager/proposals/${rejectingProposal}/reject`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` }
        });
        if (!rejectRes.ok) {
          const err = await rejectRes.json().catch(() => ({}));
          throw new Error(err.error || t('tm.rejectError'));
        }
      }

      const res = await fetch(`${API_BASE}/matches/${matchId}/availability/propose`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          datetime: start.toISOString(),
          durationMinutes: slotDuration
        })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || t('tm.sendError'));
      
      closeAvailSlotModal();
      
      if (rejectingProposal) {
        setSuccess(t('tm.counterSent'));
        setRejectingProposal(null);
        load();
        setTimeout(() => setSuccess(''), 5000);
      } else {
        setSuccess(t('tm.invitationSent'));
        if (onInvitationSent) {
          setTimeout(() => onInvitationSent(), 500);
        } else {
          load();
          setTimeout(() => setSuccess(''), 5000);
        }
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setSending(false);
    }
  }

  async function acceptProposal(proposalId) {
    setSending(true);
    setError('');
    setSuccess('');
    try {
      const res = await fetch(`${API_BASE}/matches/${matchId}/termin-manager/proposals/${proposalId}/accept`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || t('tm.acceptError'));
      setSuccess('✅ ' + t('tm.accept') + '! ');
      load();
      setTimeout(() => setSuccess(''), 5000);
    } catch (e) {
      setError(e.message);
    } finally {
      setSending(false);
    }
  }

  async function rejectProposal(proposalId, sendCounter = false) {
    if (sendCounter) {
      // User wants to send a counter-proposal
      setRejectingProposal(proposalId);
      return;
    }
    setSending(true);
    setError('');
    try {
      const res = await fetch(`${API_BASE}/matches/${matchId}/termin-manager/proposals/${proposalId}/reject`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || t('tm.rejectError'));
      setSuccess(t('tm.proposalRejected'));
      load();
      setTimeout(() => setSuccess(''), 3000);
    } catch (e) {
      setError(e.message);
    } finally {
      setSending(false);
    }
  }

  // Direct schedule: creator sets match date (team matches)
  async function scheduleMatch() {
    if (!scheduleDate || !scheduleTime) {
      setError(isEn ? 'Please select date and time.' : 'Bitte Datum und Uhrzeit auswählen.');
      return;
    }
    const datetime = new Date(`${scheduleDate}T${scheduleTime}`);
    if (Number.isNaN(datetime.getTime())) {
      setError(isEn ? 'Invalid date/time.' : 'Ungültiges Datum/Uhrzeit.');
      return;
    }
    setScheduling(true);
    setError('');
    setSuccess('');
    try {
      const res = await fetch(`${API_BASE}/matches/${matchId}/schedule`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ datetime: datetime.toISOString() })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || (isEn ? 'Failed to schedule' : 'Termin konnte nicht festgelegt werden'));
      setSuccess(isEn ? 'Match scheduled!' : 'Match-Termin festgelegt!');
      if (onInvitationSent) {
        setTimeout(() => onInvitationSent(), 500);
      } else {
        load();
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setScheduling(false);
    }
  }

  // Split frames into "mine" (created by me) and "opponent" (created by other player)
  const viewerId = meta?.viewerId ? Number(meta.viewerId) : null;

  // Find users whose availability overlaps a given date + time window
  const usersForSlot = (date, timeStart, timeEnd) => {
    const slotStart = parseTimeToMinutes(timeStart);
    const slotEnd = parseTimeToMinutes(timeEnd);
    if (slotStart === null || slotEnd === null) return [];
    const result = [];
    const seen = new Set();
    allAvailability.forEach(day => {
      if (day.date !== date || seen.has(day.userId)) return;
      (day.windows || []).forEach(w => {
        const wStart = parseTimeToMinutes(w.timeStart);
        const wEnd = parseTimeToMinutes(w.timeEnd);
        if (wStart === null || wEnd === null) return;
        if (wStart < slotEnd && wEnd > slotStart && !seen.has(day.userId)) {
          seen.add(day.userId);
          result.push({ userId: day.userId, name: day.userName });
        }
      });
    });
    return result;
  };

  const opponentFramesByWeek = useMemo(() => {
    if (!viewerId) return [];
    const theirFrames = (frames || []).filter(f => Number(f.created_by_user_id) !== viewerId);
    return groupFramesByWeek(theirFrames);
  }, [frames, viewerId]);

  const otherAvailabilityByWeek = useMemo(() => {
    const grouped = {};
    (otherAvailability || []).forEach((day) => {
      const info = getWeekInfo(day.date);
      if (!info) return;
      if (!grouped[info.key]) grouped[info.key] = { ...info, daysMap: {} };
      if (!grouped[info.key].daysMap[day.date]) grouped[info.key].daysMap[day.date] = [];
      (day.windows || []).forEach((w, idx) => {
        grouped[info.key].daysMap[day.date].push({
          id: w.id || `${day.date}-${idx}`,
          date: day.date,
          time_start: w.timeStart,
          time_end: w.timeEnd
        });
      });
    });

    return Object.values(grouped)
      .map((w) => ({
        ...w,
        days: Object.entries(w.daysMap)
          .map(([date, arr]) => ({ date, frames: arr.sort((a, b) => (a.time_start || '').localeCompare(b.time_start || '')) }))
          .sort((a, b) => a.date.localeCompare(b.date))
      }))
      .filter((w) => w.days.length > 0)
      .sort((a, b) => (a.weekStartStr || '').localeCompare(b.weekStartStr || ''));
  }, [otherAvailability]);

  // All participants' availability grouped by week (for team matches)
  const allAvailabilityByWeek = useMemo(() => {
    const grouped = {};
    (allAvailability || []).forEach((day) => {
      const info = getWeekInfo(day.date);
      if (!info) return;
      if (!grouped[info.key]) grouped[info.key] = { ...info, daysMap: {} };
      if (!grouped[info.key].daysMap[day.date]) grouped[info.key].daysMap[day.date] = [];
      (day.windows || []).forEach((w, idx) => {
        grouped[info.key].daysMap[day.date].push({
          id: w.id || `${day.date}-${day.userId}-${idx}`,
          date: day.date,
          time_start: w.timeStart,
          time_end: w.timeEnd,
          userId: day.userId,
          userName: day.userName
        });
      });
    });
    return Object.values(grouped)
      .map((w) => ({
        ...w,
        days: Object.entries(w.daysMap)
          .map(([date, arr]) => ({ date, frames: arr.sort((a, b) => (a.time_start || '').localeCompare(b.time_start || '')) }))
          .sort((a, b) => a.date.localeCompare(b.date))
      }))
      .filter((w) => w.days.length > 0)
      .sort((a, b) => (a.weekStartStr || '').localeCompare(b.weekStartStr || ''));
  }, [allAvailability]);

  // Time Assistant: find best 3 slots with most player overlap
  const bestSlots = useMemo(() => {
    if (!allAvailability || allAvailability.length === 0) return [];
    // Build per-date windows: { date -> [{ userId, startMin, endMin }] }
    const byDate = {};
    allAvailability.forEach((day) => {
      if (!day.date || !day.windows) return;
      if (!byDate[day.date]) byDate[day.date] = [];
      day.windows.forEach((w) => {
        const s = parseTimeToMinutes(w.timeStart);
        const e = parseTimeToMinutes(w.timeEnd);
        if (s !== null && e !== null && e > s) {
          byDate[day.date].push({ userId: day.userId, userName: day.userName, startMin: s, endMin: e });
        }
      });
    });
    const dur = slotDuration || 60;
    const candidates = [];
    Object.entries(byDate).forEach(([date, windows]) => {
      // Collect all unique start/end boundaries as candidate start times (snapped to 15min)
      const starts = new Set();
      windows.forEach((w) => {
        for (let t = Math.ceil(w.startMin / 15) * 15; t + dur <= w.endMin; t += 15) {
          starts.add(t);
        }
      });
      starts.forEach((startMin) => {
        const endMin = startMin + dur;
        const users = new Set();
        const names = [];
        windows.forEach((w) => {
          if (w.startMin <= startMin && w.endMin >= endMin && !users.has(w.userId)) {
            users.add(w.userId);
            names.push(w.userName);
          }
        });
        if (users.size > 0) {
          candidates.push({
            date,
            startTime: minutesToTimeString(startMin),
            endTime: minutesToTimeString(endMin),
            playerCount: users.size,
            playerNames: names
          });
        }
      });
    });
    // Sort by playerCount desc, then date asc, then startTime asc
    candidates.sort((a, b) => b.playerCount - a.playerCount || a.date.localeCompare(b.date) || a.startTime.localeCompare(b.startTime));
    // Deduplicate: skip slots that overlap heavily with already-picked ones
    const picked = [];
    for (const c of candidates) {
      if (picked.length >= 3) break;
      const overlap = picked.some((p) => p.date === c.date && p.startTime === c.startTime);
      if (!overlap) picked.push(c);
    }
    return picked;
  }, [allAvailability, slotDuration]);

  // Total unique participants who submitted availability
  const totalAvailPlayers = useMemo(() => {
    const ids = new Set();
    (allAvailability || []).forEach((d) => ids.add(d.userId));
    return ids.size;
  }, [allAvailability]);

  const selectableDates = useMemo(() => {
    const fromMatch = enumerateDates(matchInfo?.kickoff_at, matchInfo?.kickoff_end_at);
    if (fromMatch.length) return fromMatch;
    const fromAvailability = Array.from(new Set([
      ...(myAvailability || []).map((day) => day.date),
      ...(otherAvailability || []).map((day) => day.date),
      ...(frames || []).map((frame) => frame.date),
    ].filter(Boolean))).sort();
    if (fromAvailability.length) return fromAvailability;
    const today = new Date();
    today.setHours(12, 0, 0, 0);
    return Array.from({ length: 7 }, (_, index) => {
      const current = new Date(today);
      current.setDate(today.getDate() + index);
      return current.toISOString().slice(0, 10);
    });
  }, [matchInfo?.kickoff_at, matchInfo?.kickoff_end_at, myAvailability, otherAvailability, frames]);

  const groupedSelectedDates = useMemo(() => {
    const grouped = {};
    selectedDates.forEach((dateStr) => {
      const info = getWeekInfo(dateStr);
      if (!info) return;
      if (!grouped[info.key]) grouped[info.key] = { ...info, days: [] };
      grouped[info.key].days.push(dateStr);
    });
    return Object.values(grouped)
      .map((group) => ({ ...group, days: group.days.sort((a, b) => a.localeCompare(b)) }))
      .sort((a, b) => (a.weekStartStr || '').localeCompare(b.weekStartStr || ''));
  }, [selectedDates]);

  const myAvailabilityByWeek = useMemo(() => {
    const grouped = {};
    (myAvailability || []).forEach((day) => {
      const info = getWeekInfo(day.date);
      if (!info) return;
      if (!grouped[info.key]) grouped[info.key] = { ...info, daysMap: {} };
      if (!grouped[info.key].daysMap[day.date]) grouped[info.key].daysMap[day.date] = [];
      (day.windows || []).forEach((window, index) => {
        grouped[info.key].daysMap[day.date].push({
          id: window.id || `${day.date}-${index}`,
          date: day.date,
          time_start: window.timeStart,
          time_end: window.timeEnd,
        });
      });
    });

    return Object.values(grouped)
      .map((week) => ({
        ...week,
        days: Object.entries(week.daysMap)
          .map(([date, dayFrames]) => ({ date, frames: dayFrames.sort((a, b) => (a.time_start || '').localeCompare(b.time_start || '')) }))
          .sort((a, b) => a.date.localeCompare(b.date))
      }))
      .filter((week) => week.days.length > 0)
      .sort((a, b) => (a.weekStartStr || '').localeCompare(b.weekStartStr || ''));
  }, [myAvailability]);

  useEffect(() => {
    setSelectedDates((prev) => {
      if (!prev.length) return selectableDates;
      const next = prev.filter((dateStr) => selectableDates.includes(dateStr));
      return next.length ? next : selectableDates;
    });
  }, [selectableDates]);

  useEffect(() => {
    setTempTimesByDate((prev) => {
      const next = {};
      selectedDates.forEach((dateStr) => {
        const existing = myAvailability.find((day) => day.date === dateStr);
        if (existing?.windows?.length) {
          next[dateStr] = existing.windows.map((window, index) => ({
            id: window.id || `r-${dateStr}-${index}`,
            start: snapToQuarter(window.timeStart) || window.timeStart,
            end: snapToQuarter(window.timeEnd) || window.timeEnd,
          }));
        } else if (prev[dateStr]?.length) {
          next[dateStr] = prev[dateStr];
        } else {
          next[dateStr] = [createDefaultRange()];
        }
      });
      return next;
    });
  }, [selectedDates, myAvailability]);

  function toggleDateSelection(dateStr) {
    setSelectedDates((prev) => prev.includes(dateStr) ? prev.filter((entry) => entry !== dateStr) : [...prev, dateStr].sort());
  }

  function buildAvailabilityPayload() {
    if (!selectedDates.length) {
      throw new Error(t('match.search.errorSelectAtLeastOneDate'));
    }

    if (availabilityMode === 'preset') {
      const activePresets = presetOptions.filter((preset) => presetSelections[preset.key]);
      if (!activePresets.length) {
        throw new Error(t('match.search.errorSelectTimePeriod'));
      }
      return selectedDates.flatMap((dateStr) => activePresets.map((preset) => ({
        date: dateStr,
        timeStart: preset.start,
        timeEnd: preset.end,
      })));
    }

    const payload = [];
    selectedDates.forEach((dateStr) => {
      const ranges = tempTimesByDate[dateStr] || [];
      ranges.forEach((range) => {
        const start = snapToQuarter(range.start) || range.start;
        const end = snapToQuarter(range.end) || range.end;
        const startMinutes = parseTimeToMinutes(start);
        const endMinutes = parseTimeToMinutes(end);
        if (startMinutes === null || endMinutes === null || startMinutes >= endMinutes) {
          throw new Error(t('match.search.errorValidTimeRanges'));
        }
        payload.push({ date: dateStr, timeStart: start, timeEnd: end });
      });
    });
    if (!payload.length) {
      throw new Error(t('match.search.errorEnterAvailability'));
    }
    return payload;
  }

  async function saveAvailabilityConfiguration() {
    setSavingAvailability(true);
    setError('');
    setSuccess('');
    try {
      const payload = buildAvailabilityPayload();
      for (const day of myAvailability) {
        await fetch(`${API_BASE}/matches/${matchId}/availability/days/${day.id}`, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${token}` }
        });
      }

      const grouped = payload.reduce((acc, item) => {
        if (!acc[item.date]) acc[item.date] = [];
        acc[item.date].push(item);
        return acc;
      }, {});

      for (const [dateStr, windowsForDay] of Object.entries(grouped)) {
        const dayRes = await fetch(`${API_BASE}/matches/${matchId}/availability/days`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify({ date: dateStr })
        });
        const dayData = await dayRes.json().catch(() => ({}));
        if (!dayRes.ok) throw new Error(dayData.error || t('tm.saveError'));

        for (const window of windowsForDay) {
          const windowRes = await fetch(`${API_BASE}/matches/${matchId}/availability/days/${dayData.id}/windows`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`
            },
            body: JSON.stringify({ timeStart: window.timeStart, timeEnd: window.timeEnd })
          });
          const windowData = await windowRes.json().catch(() => ({}));
          if (!windowRes.ok) throw new Error(windowData.error || t('tm.saveError'));
        }
      }

      setShowAddSlot(false);
      setSuccess(t('tm.frameSaved'));
      await load();
    } catch (e) {
      setError(e.message || t('tm.saveError'));
    } finally {
      setSavingAvailability(false);
    }
  }

  if (loading) return <div style={styles.overlay}><div style={styles.modal}>{t('tm.loading')}</div></div>;

  return (
    <div style={styles.overlay} onClick={onClose}>
      <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div style={styles.headerRow}>
          <h1 style={styles.title}>{t('tm.title')}</h1>
          <button onClick={onClose} style={styles.closeBtn}>×</button>
        </div>

        {matchInfo && (
          <div style={styles.matchInfo}>
            {matchInfo.home_player || t('tm.player1')} vs. {matchInfo.away_player || t('tm.player2')} · {matchInfo.sport || 'Tennis'} {matchInfo.league ? `· ${matchInfo.league}` : ''}
          </div>
        )}

        {error && <div style={styles.error}>{error}</div>}
        {success && <div style={styles.success}>{success}</div>}

        {/* ── Team Match: Info Box ── */}
        {isTeamMatch && (
          <div style={{ ...styles.instructions, display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div style={{ color: '#e8efe8', fontWeight: 700, fontSize: 14 }}>
              {isEn ? 'How it works' : 'So funktioniert\'s'}
            </div>
            <div style={{ fontSize: 13 }}>
              {isEn
                ? `${meta?.hostName || 'The match creator'} is the organizer and can set the match date once all players have joined.`
                : `${meta?.hostName || 'Der Match-Ersteller'} ist der Organisator und kann den Termin festlegen, sobald alle Spieler beigetreten sind.`}
            </div>
            <div style={{ fontSize: 13 }}>
              {isEn
                ? 'Please enter your availabilities so the best time slot can be found for everyone.'
                : 'Bitte trage deine Verfügbarkeiten ein, damit der beste Zeitslot für alle gefunden werden kann.'}
            </div>
          </div>
        )}

        {/* ── Team Match: Time Assistant (best slots) — shown at top ── */}
        {isTeamMatch && allTeamsFull && bestSlots.length > 0 && (
          <div style={{ ...styles.configCard, marginBottom: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
              <span style={{ fontSize: 18 }}>⏱</span>
              <span style={{ color: '#debc7c', fontWeight: 700, fontSize: 15 }}>{isEn ? 'Time Assistant' : 'Zeit-Assistent'}</span>
              <span style={{ color: '#9db', fontSize: 13 }}> — {isEn ? 'Best slots based on availability' : 'Beste Slots basierend auf Verfügbarkeit'}</span>
            </div>
            <div style={{ display: 'grid', gap: 8 }}>
              {bestSlots.map((slot) => {
                const isSelected = scheduleDate === slot.date && scheduleTime === slot.startTime;
                return (
                  <button
                    key={`${slot.date}-${slot.startTime}`}
                    onClick={() => { setScheduleDate(slot.date); setScheduleTime(slot.startTime); }}
                    style={{
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                      background: isSelected ? 'rgba(222, 188, 124, 0.16)' : '#0a1c17',
                      border: isSelected ? '2px solid #debc7c' : '1px solid #26493c',
                      borderRadius: 10, padding: '12px 14px', cursor: 'pointer',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'flex-start' }}>
                      <div style={{ color: '#e8efe8', fontWeight: 700, fontSize: 15 }}>
                        {fmtDate(slot.date, locale)} · {fmtTime(slot.startTime)} - {fmtTime(slot.endTime)}
                      </div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                        {slot.playerNames.map((name, ni) => (
                          <span key={ni} style={{
                            background: 'rgba(72, 186, 166, 0.15)', color: '#48baa6',
                            borderRadius: 6, padding: '2px 8px', fontSize: 12, fontWeight: 600
                          }}>{name}</span>
                        ))}
                      </div>
                    </div>
                    <div style={{
                      background: slot.playerCount === totalAvailPlayers ? 'rgba(107, 255, 157, 0.15)' : 'rgba(222, 188, 124, 0.15)',
                      color: slot.playerCount === totalAvailPlayers ? '#6bff9d' : '#debc7c',
                      borderRadius: 8, padding: '4px 10px', fontSize: 13, fontWeight: 700, whiteSpace: 'nowrap'
                    }}>
                      {slot.playerCount}/{totalAvailPlayers} {isEn ? 'players' : 'Spieler'}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* ── My Availability ── */}
        <div style={styles.sectionHeader}>
          <div>
            <h3 style={{ margin: 0, color: '#e8efe8' }}>{t('tm.myTimes')}</h3>
            <div style={{ color: '#9db', fontSize: 13, marginTop: 2 }}>{t('tm.myTimesHint')}</div>
          </div>
          <button onClick={() => setShowAddSlot((v) => !v)} style={styles.btnPrimary}>
              {showAddSlot ? t('tm.closeSlot') : t('tm.addSlot')}
          </button>
        </div>

        {showAddSlot && (
          <div style={styles.addForm}>
            <div style={{ display: 'grid', gap: 12 }}>
              <div style={styles.formGroup}>
                <label style={styles.label}>{t('match.search.configuration')}</label>
                <div style={styles.modeGroup}>
                  <button
                    type="button"
                    onClick={() => setAvailabilityMode('preset')}
                    style={{ ...styles.modeBtn, ...(availabilityMode === 'preset' ? styles.modeBtnActive : null) }}
                  >
                    {t('match.search.periodsForAllDays')}
                  </button>
                  <button
                    type="button"
                    onClick={() => setAvailabilityMode('per-day')}
                    style={{ ...styles.modeBtn, ...(availabilityMode === 'per-day' ? styles.modeBtnActive : null) }}
                  >
                    {t('match.search.availabilityPerDay')}
                  </button>
                </div>
              </div>

              <div style={styles.configCard}>
                <div style={{ fontSize: 12, color: '#9db', marginBottom: 8 }}>{t('tm.date')}</div>
                <div style={styles.dateGrid}>
                  {selectableDates.map((dateStr) => {
                    const active = selectedDates.includes(dateStr);
                    return (
                      <button
                        key={dateStr}
                        type="button"
                        onClick={() => toggleDateSelection(dateStr)}
                        style={{ ...styles.dateToggle, ...(active ? styles.dateToggleActive : null) }}
                      >
                        {fmtDate(dateStr, locale)}
                      </button>
                    );
                  })}
                </div>
              </div>

              {availabilityMode === 'preset' && (
                <div style={styles.configCard}>
                  <div style={{ fontSize: 12, color: '#9db', marginBottom: 8 }}>{t('match.search.presetHint')}</div>
                  <div style={styles.presetGrid}>
                    {presetOptions.map((preset) => (
                      <button
                        key={preset.key}
                        type="button"
                        onClick={() => setPresetSelections((prev) => ({ ...prev, [preset.key]: !prev[preset.key] }))}
                        style={{ ...styles.presetBtn, ...(presetSelections[preset.key] ? styles.presetBtnActive : null) }}
                      >
                        <span>{preset.label}</span>
                        <span style={{ fontSize: 11, color: '#9db' }}>{preset.start} - {preset.end}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {availabilityMode === 'per-day' && (
                <div style={{ display: 'grid', gap: 10 }}>
                  {groupedSelectedDates.map((week) => (
                    <div key={week.key} style={styles.weekCard}>
                      <div style={styles.weekHeader}>
                        <div style={{ fontWeight: 800, color: '#debc7c' }}>{lang === 'en' ? 'W' : 'KW'} {week.week}</div>
                        <div style={{ color: '#9db', fontSize: 12 }}>{fmtWeekRange(week.weekStartStr, week.weekEndStr, locale)}</div>
                      </div>

                      <div style={{ display: 'grid', gap: 10 }}>
                        {week.days.map((dateStr) => {
                          const ranges = tempTimesByDate[dateStr] || [];
                          return (
                            <div key={dateStr} style={styles.dateCard}>
                              <div style={styles.dateHeader}>
                                <div style={{ fontWeight: 700 }}>{fmtDate(dateStr, locale)}</div>
                              </div>

                              <div style={{ display: 'grid', gap: 8 }}>
                                {ranges.map((range) => (
                                  <div key={range.id} style={styles.rangeRow}>
                                    <div style={styles.formGroup}>
                                      <label style={styles.label}>{t('tm.from')}</label>
                                      <input
                                        type="time"
                                        step={900}
                                        value={range.start}
                                        onChange={(e) => setTempTimesByDate((prev) => ({
                                          ...prev,
                                          [dateStr]: (prev[dateStr] || []).map((entry) => entry.id === range.id ? { ...entry, start: snapToQuarter(e.target.value) || e.target.value } : entry)
                                        }))}
                                        style={styles.input}
                                      />
                                    </div>
                                    <div style={styles.formGroup}>
                                      <label style={styles.label}>{t('tm.to')}</label>
                                      <input
                                        type="time"
                                        step={900}
                                        value={range.end}
                                        onChange={(e) => setTempTimesByDate((prev) => ({
                                          ...prev,
                                          [dateStr]: (prev[dateStr] || []).map((entry) => entry.id === range.id ? { ...entry, end: snapToQuarter(e.target.value) || e.target.value } : entry)
                                        }))}
                                        style={styles.input}
                                      />
                                    </div>
                                    <button
                                      type="button"
                                      onClick={() => setTempTimesByDate((prev) => ({
                                        ...prev,
                                        [dateStr]: (prev[dateStr] || []).filter((entry) => entry.id !== range.id)
                                      }))}
                                      style={{ ...styles.btnGhost, color: '#ff6b6b', borderColor: '#ff6b6b44', padding: '10px 12px' }}
                                    >
                                      {t('tm.delete')}
                                    </button>
                                  </div>
                                ))}
                                <button
                                  type="button"
                                  onClick={() => setTempTimesByDate((prev) => {
                                    const current = prev[dateStr] || [];
                                    const last = current[current.length - 1];
                                    const nextStart = last?.end || '18:00';
                                    const nextEnd = minutesToTimeString((parseTimeToMinutes(nextStart) || (18 * 60)) + 120);
                                    return {
                                      ...prev,
                                      [dateStr]: [...current, createDefaultRange(snapToQuarter(nextStart), snapToQuarter(nextEnd))]
                                    };
                                  })}
                                  style={styles.btnSecondary}
                                >
                                  {t('tm.addSlot')}
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div style={styles.formActions}>
                <button onClick={saveAvailabilityConfiguration} disabled={savingAvailability} style={{ ...styles.btnPrimary, opacity: savingAvailability ? 0.6 : 1 }}>
                  {savingAvailability ? t('tm.loading') : t('tm.save')}
                </button>
                <button onClick={() => setShowAddSlot(false)} style={styles.btnGhost}>{t('tm.cancel')}</button>
              </div>
            </div>
          </div>
        )}

        {myAvailabilityByWeek.length === 0 && !showAddSlot && (
          <div style={styles.empty}>{t('tm.noMyTimes')}</div>
        )}

        <div style={{ display: 'grid', gap: 14 }}>
          {myAvailabilityByWeek.map((week) => (
            <div key={week.key} style={styles.weekCard}>
              <div style={styles.weekHeader}>
                <div style={{ fontWeight: 800, color: '#debc7c' }}>{lang === 'en' ? 'W' : 'KW'} {week.week}</div>
                <div style={{ color: '#9db', fontSize: 12 }}>{fmtWeekRange(week.weekStartStr, week.weekEndStr, locale)}</div>
              </div>

              <div style={{ display: 'grid', gap: 10 }}>
                {week.days.map(({ date, frames: dayFrames }) => (
                  <div key={date} style={styles.dateCard}>
                    <div style={styles.dateHeader}>
                      <div style={{ fontWeight: 700 }}>{fmtDate(date, locale)}</div>
                      <div style={{ color: '#9db', fontSize: 13 }}>{dayFrames.length} Slot{dayFrames.length !== 1 ? 's' : ''}</div>
                    </div>

                    <div style={{ display: 'grid', gap: 10 }}>
                      {dayFrames.map((frame) => {
                        return (
                          <div key={frame.id} style={styles.frameRow}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                              <div style={{ fontWeight: 700, color: '#e8efe8' }}>{fmtTime(frame.time_start)} – {fmtTime(frame.time_end)}</div>
                              <div style={{ color: '#9db', fontSize: 13 }}>{t('tm.duration', { min: slotDuration })}</div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* ── Opponent Frames (with propose slot) — only for 1v1 ── */}
        {!isTeamMatch && opponentFramesByWeek.length > 0 && (
          <div style={{ marginTop: 22 }}>
            <div style={styles.sectionHeaderSimple}>
              <h3 style={{ margin: 0, color: '#e8efe8' }}>{t('tm.opponentTimes')}</h3>
              <div style={{ color: '#9db', fontSize: 13 }}>{t('tm.opponentTimesHint')}</div>
            </div>

            <div style={{ display: 'grid', gap: 14 }}>
              {opponentFramesByWeek.map((week) => (
                <div key={week.key} style={styles.weekCard}>
                  <div style={styles.weekHeader}>
                    <div style={{ fontWeight: 800, color: '#debc7c' }}>{lang === 'en' ? 'W' : 'KW'} {week.week}</div>
                    <div style={{ color: '#9db', fontSize: 12 }}>{fmtWeekRange(week.weekStartStr, week.weekEndStr, locale)}</div>
                  </div>

                  <div style={{ display: 'grid', gap: 10 }}>
                    {week.days.map(({ date, frames: dayFrames }) => (
                      <div key={date} style={styles.dateCard}>
                        <div style={styles.dateHeader}>
                          <div style={{ fontWeight: 700 }}>{fmtDate(date, locale)}</div>
                          <div style={{ color: '#9db', fontSize: 13 }}>{dayFrames.length} Slot{dayFrames.length !== 1 ? 's' : ''}</div>
                        </div>

                        <div style={{ display: 'grid', gap: 10 }}>
                          {dayFrames.map((frame) => {
                            const latest = latestStart(frame);
                            const chosen = customTimes[frame.id] || fmtTime(frame.time_start);
                            const availUsers = usersForSlot(date, frame.time_start, frame.time_end);
                            return (
                              <div key={frame.id} style={styles.frameRow}>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                                  <div style={{ fontWeight: 700, color: '#e8efe8' }}>{fmtTime(frame.time_start)} – {fmtTime(frame.time_end)}</div>
                                  <div style={{ color: '#9db', fontSize: 13 }}>{t('tm.latestStart', { time: latest || '—' })} · {t('tm.duration', { min: slotDuration })}</div>
                                  {availUsers.length > 0 && (
                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 2 }}>
                                      {availUsers.map(u => (
                                        <span key={u.userId} style={{ fontSize: 11, padding: '2px 8px', borderRadius: 8, background: 'rgba(72,186,166,0.15)', color: '#48baa6', border: '1px solid rgba(72,186,166,0.3)' }}>{u.name}</span>
                                      ))}
                                    </div>
                                  )}
                                </div>
                                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                                  <input
                                    type="time"
                                    value={chosen}
                                    min={fmtTime(frame.time_start)}
                                    max={latest || undefined}
                                    onChange={(e) => setCustomTimes((prev) => ({ ...prev, [frame.id]: e.target.value }))}
                                    style={styles.inputTime}
                                  />
                                  <button
                                    onClick={() => proposeSlot(frame)}
                                    disabled={sending}
                                    style={{ ...styles.btnPrimary, opacity: sending ? 0.5 : 1, cursor: sending ? 'not-allowed' : 'pointer' }}
                                  >
                                    {t('tm.sendInvitation')}
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Opponent / All Availability ── */}
        {!isTeamMatch && otherAvailabilityByWeek.length > 0 && (
          <div style={{ marginTop: 18 }}>
            <div style={styles.sectionHeaderSimple}>
              <h3 style={{ margin: 0, color: '#e8efe8' }}>{t('tm.opponentAvailability')}</h3>
            </div>

            <div style={{ display: 'grid', gap: 14 }}>
              {otherAvailabilityByWeek.map((week) => (
                <div key={week.key} style={styles.weekCard}>
                  <div style={styles.weekHeader}>
                    <div style={{ fontWeight: 800, color: '#debc7c' }}>{lang === 'en' ? 'W' : 'KW'} {week.week}</div>
                    <div style={{ color: '#9db', fontSize: 12 }}>{fmtWeekRange(week.weekStartStr, week.weekEndStr, locale)}</div>
                  </div>

                  <div style={{ display: 'grid', gap: 10 }}>
                    {week.days.map(({ date, frames }) => (
                      <div key={date} style={styles.dateCard}>
                        <div style={styles.dateHeader}>
                          <div style={{ fontWeight: 700 }}>{fmtDate(date, locale)}</div>
                          <div style={{ color: '#9db', fontSize: 13 }}>{frames.length} Slot{frames.length !== 1 ? 's' : ''}</div>
                        </div>

                        <div style={{ display: 'grid', gap: 8 }}>
                          {frames.map((frame) => {
                            const availUsers = usersForSlot(date, frame.time_start, frame.time_end);
                            return (
                              <div key={frame.id} style={styles.windowRow}>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: 1 }}>
                                  <div style={{ fontWeight: 700, color: '#e8efe8' }}>{fmtTime(frame.time_start)} - {fmtTime(frame.time_end)}</div>
                                  {availUsers.length > 0 && (
                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                                      {availUsers.map(u => (
                                        <span key={u.userId} style={{ fontSize: 11, padding: '2px 8px', borderRadius: 8, background: 'rgba(72,186,166,0.15)', color: '#48baa6', border: '1px solid rgba(72,186,166,0.3)' }}>{u.name}</span>
                                      ))}
                                    </div>
                                  )}
                                </div>
                                <button
                                  onClick={() => openAvailSlotModal({ ...frame, date })}
                                  style={{ ...styles.btnPrimary, fontSize: 12, padding: '6px 12px' }}
                                >
                                  {t('tm.sendInvitation')}
                                </button>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Team Match: All Participants' Availability ── */}
        {isTeamMatch && allAvailabilityByWeek.length > 0 && (
          <div style={{ marginTop: 18 }}>
            <div style={styles.sectionHeaderSimple}>
              <h3 style={{ margin: 0, color: '#e8efe8' }}>{isEn ? 'All Availabilities' : 'Alle Verfügbarkeiten'}</h3>
              <div style={{ color: '#9db', fontSize: 13 }}>{isEn ? 'Overview of all participants' : 'Übersicht aller Teilnehmer'}</div>
            </div>

            <div style={{ display: 'grid', gap: 14 }}>
              {allAvailabilityByWeek.map((week) => (
                <div key={week.key} style={styles.weekCard}>
                  <div style={styles.weekHeader}>
                    <div style={{ fontWeight: 800, color: '#debc7c' }}>{lang === 'en' ? 'W' : 'KW'} {week.week}</div>
                    <div style={{ color: '#9db', fontSize: 12 }}>{fmtWeekRange(week.weekStartStr, week.weekEndStr, locale)}</div>
                  </div>

                  <div style={{ display: 'grid', gap: 10 }}>
                    {week.days.map(({ date, frames: dayFrames }) => {
                      const availUsers = usersForSlot(date, dayFrames[0]?.time_start, dayFrames[dayFrames.length - 1]?.time_end);
                      return (
                        <div key={date} style={styles.dateCard}>
                          <div style={styles.dateHeader}>
                            <div style={{ fontWeight: 700 }}>{fmtDate(date, locale)}</div>
                            <div style={{ color: '#9db', fontSize: 13 }}>{dayFrames.length} Slot{dayFrames.length !== 1 ? 's' : ''}</div>
                          </div>

                          <div style={{ display: 'grid', gap: 8 }}>
                            {dayFrames.map((frame) => (
                              <div key={frame.id} style={styles.windowRow}>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: 1 }}>
                                  <div style={{ fontWeight: 700, color: '#e8efe8' }}>{fmtTime(frame.time_start)} - {fmtTime(frame.time_end)}</div>
                                  <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 8, background: 'rgba(72,186,166,0.15)', color: '#48baa6', border: '1px solid rgba(72,186,166,0.3)', alignSelf: 'flex-start' }}>{frame.userName}</span>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Team Match: Schedule (creator only) ── */}
        {isTeamMatch && isCreator && (
          <div style={{ marginTop: 22 }}>
            <div style={styles.sectionHeaderSimple}>
              <h3 style={{ margin: 0, color: '#e8efe8' }}>{isEn ? 'Set Match Date' : 'Match-Termin festlegen'}</h3>
              <div style={{ color: '#9db', fontSize: 13 }}>
                {allTeamsFull
                  ? (isEn ? 'All players have joined — choose the date and time for this match.' : 'Alle Spieler sind beigetreten — wähle Datum und Uhrzeit für dieses Match.')
                  : (isEn ? 'Waiting for all players to join before scheduling.' : 'Warte bis alle Spieler beigetreten sind.')}
              </div>
            </div>

            {allTeamsFull ? (
              <div style={{ ...styles.configCard, display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'flex-end' }}>
              <div style={styles.formGroup}>
                <label style={styles.label}>{isEn ? 'Date' : 'Datum'}</label>
                <input
                  type="date"
                  value={scheduleDate}
                  onChange={(e) => setScheduleDate(e.target.value)}
                  style={styles.input}
                />
              </div>
              <div style={styles.formGroup}>
                <label style={styles.label}>{isEn ? 'Time' : 'Uhrzeit'}</label>
                <input
                  type="time"
                  value={scheduleTime}
                  step={900}
                  onChange={(e) => setScheduleTime(e.target.value)}
                  style={styles.input}
                />
              </div>
              <button
                onClick={scheduleMatch}
                disabled={scheduling || !scheduleDate || !scheduleTime}
                style={{ ...styles.btnPrimary, opacity: (scheduling || !scheduleDate || !scheduleTime) ? 0.5 : 1, cursor: (scheduling || !scheduleDate || !scheduleTime) ? 'not-allowed' : 'pointer', padding: '10px 20px' }}
              >
                {scheduling ? (isEn ? 'Saving...' : 'Speichern...') : (isEn ? 'Schedule Match' : 'Termin festlegen')}
              </button>
            </div>
            ) : (
              <div style={{ ...styles.configCard, padding: '14px 16px', color: '#9db', fontSize: 14, textAlign: 'center' }}>
                {isEn ? 'The schedule can be set once all teams are full.' : 'Der Termin kann festgelegt werden, sobald alle Teams voll sind.'}
              </div>
            )}
          </div>
        )}

        {/* ── Proposals — only for 1v1 ── */}
        {!isTeamMatch && (
        <div style={{ marginTop: 24 }}>
          <div style={styles.sectionHeaderSimple}>
            <h3 style={{ margin: 0, color: '#e8efe8' }}>{t('tm.proposals')}</h3>
          </div>
          {slots.length === 0 && proposals.length === 0 ? (
            <div style={styles.empty}>{t('tm.noRequests')}</div>
          ) : (
            <div style={{ display: 'grid', gap: 10 }}>
              {proposals.map((p) => {
                const viewerIdNum = Number(meta?.viewerId);
                const byYou = viewerIdNum && Number(p.proposerUserId) === viewerIdNum;
                const canAccept = viewerIdNum && Number(p.recipientUserId) === viewerIdNum && p.status === 'sent';
                const dt = p.proposed_datetime ? new Date(p.proposed_datetime) : null;
                return (
                  <div key={p.id} style={styles.slotItem}>
                    <div>
                      <div style={{ fontWeight: 700, color: '#e8efe8' }}>
                        {dt ? dt.toLocaleString(locale, { weekday: 'short', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : t('tm.proposal')}
                      </div>
                      <div style={{ color: '#9db', fontSize: 13 }}>{byYou ? t('tm.byYou') : t('tm.byOpponent')} · {t('tm.status')}: <span style={{ color: '#c9a75f' }}>{p.status === 'sent' ? t('tm.pending') : p.status}</span></div>
                    </div>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      {canAccept && (
                        <>
                          <button onClick={() => acceptProposal(p.id)} disabled={sending} style={{ ...styles.btnPrimary, opacity: sending ? 0.5 : 1 }}>{t('tm.accept')}</button>
                          <button onClick={() => rejectProposal(p.id, true)} disabled={sending} style={styles.btnSecondary}>{t('tm.counterProposal')}</button>
                          <button onClick={() => rejectProposal(p.id, false)} disabled={sending} style={styles.btnGhost}>{t('tm.reject')}</button>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
              {slots.map((s) => {
                const statusColor = s.status === 'accepted' ? '#4a9d5f' : '#c9a75f';
                const viewerIdNum = Number(meta?.viewerId);
                const byYou = viewerIdNum && Number(s.selected_by_user_id) === viewerIdNum;
                return (
                  <div key={s.id} style={styles.slotItem}>
                    <div>
                      <div style={{ fontWeight: 700, color: '#e8efe8' }}>{fmtDate(s.slot_start, locale)} · {new Date(s.slot_start).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' })} - {new Date(s.slot_end).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' })}</div>
                      <div style={{ color: '#9db', fontSize: 13 }}>{t('tm.duration', { min: s.duration_minutes })} · {byYou ? t('tm.byYou') : t('tm.byHost')} · {t('tm.status')}: <span style={{ color: statusColor }}>{s.status}</span></div>
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      {s.status !== 'accepted' && meta?.canCreateSlots && (
                        <button onClick={() => removeSlot(s.id)} style={styles.btnGhost}>{t('tm.withdraw')}</button>
                      )}
                      {s.status === 'proposed' && meta?.canCreateFrames && (
                        <button onClick={() => acceptSlot(s.id)} style={styles.btnPrimary}>{t('tm.acceptSlot')}</button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
        )}

        {/* ── Invitation modal — only for 1v1 ── */}
        {!isTeamMatch && selectedAvailSlot && (
          <div style={styles.overlay} onClick={closeAvailSlotModal}>
            <div style={{ ...styles.modal, maxWidth: 500 }} onClick={(e) => e.stopPropagation()}>
              <div style={styles.headerRow}>
                <h2 style={{ margin: 0, fontSize: 20, color: '#e8efe8' }}>
                  {rejectingProposal ? t('tm.sendCounter') : t('tm.proposeTime')}
                </h2>
                <button onClick={closeAvailSlotModal} style={styles.closeBtn}>×</button>
              </div>

              <div style={{ marginBottom: 16, padding: 12, background: '#0f2a20', borderRadius: 10, border: '1px solid #26493c' }}>
                <div style={{ fontWeight: 700, color: '#e8efe8', marginBottom: 4 }}>{fmtDate(selectedAvailSlot.date, locale)}</div>
                <div style={{ color: '#9db', fontSize: 14 }}>{t('tm.availableRange', { from: fmtTime(selectedAvailSlot.time_start), to: fmtTime(selectedAvailSlot.time_end) })}</div>
                <div style={{ color: '#9db', fontSize: 13, marginTop: 4 }}>{t('tm.playTime', { min: slotDuration })} · {t('tm.latestStart', { time: latestStartForAvailSlot(selectedAvailSlot) || '—' })}</div>
              </div>

              {error && <div style={styles.error}>{error}</div>}

              <div style={{ marginBottom: 16 }}>
                <label style={{ ...styles.label, display: 'block', marginBottom: 8 }}>{t('tm.desiredStart')}</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <button
                    onClick={prevTime}
                    disabled={timeIndex === 0}
                    style={{
                      width: 44,
                      height: 44,
                      borderRadius: 10,
                      border: '2px solid #26493c',
                      background: timeIndex === 0 ? '#0a1c17' : '#0f2a20',
                      color: timeIndex === 0 ? '#555' : '#e8efe8',
                      fontWeight: 800,
                      fontSize: 20,
                      cursor: timeIndex === 0 ? 'not-allowed' : 'pointer',
                      opacity: timeIndex === 0 ? 0.3 : 1
                    }}
                  >
                    −
                  </button>
                  <div style={{
                    flex: 1,
                    padding: '14px 16px',
                    borderRadius: 10,
                    border: '2px solid #26493c',
                    background: '#0f2a20',
                    color: '#debc7c',
                    textAlign: 'center',
                    fontWeight: 700,
                    fontSize: 22
                  }}>
                    {proposedTime || '—'}
                  </div>
                  <button
                    onClick={nextTime}
                    disabled={timeIndex >= availableTimes.length - 1}
                    style={{
                      width: 44,
                      height: 44,
                      borderRadius: 10,
                      border: '2px solid #26493c',
                      background: timeIndex >= availableTimes.length - 1 ? '#0a1c17' : '#0f2a20',
                      color: timeIndex >= availableTimes.length - 1 ? '#555' : '#e8efe8',
                      fontWeight: 800,
                      fontSize: 20,
                      cursor: timeIndex >= availableTimes.length - 1 ? 'not-allowed' : 'pointer',
                      opacity: timeIndex >= availableTimes.length - 1 ? 0.3 : 1
                    }}
                  >
                    +
                  </button>
                </div>
                <div style={{ color: '#9db', fontSize: 12, marginTop: 6, textAlign: 'center' }}>
                  {t('tm.ofAvailable', { current: timeIndex + 1, total: availableTimes.length })}
                </div>
              </div>

              <div style={{ display: 'flex', gap: 10 }}>
                <button
                  onClick={sendAvailabilityInvitation}
                  disabled={sending || !proposedTime}
                  style={{ ...styles.btnPrimary, flex: 1, opacity: sending || !proposedTime ? 0.5 : 1, cursor: sending || !proposedTime ? 'not-allowed' : 'pointer' }}
                >
                  {sending ? t('tm.sending') : t('tm.sendInvitationFull')}
                </button>
                <button onClick={closeAvailSlotModal} style={{ ...styles.btnGhost, flex: 1 }}>{t('tm.cancel')}</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

const styles = {
  overlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.8)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 9999,
    backdropFilter: 'blur(6px)'
  },
  modal: {
    backgroundColor: '#0a1c17',
    color: '#e8efe8',
    borderRadius: 16,
    padding: 28,
    width: '95%',
    maxWidth: 1100,
    maxHeight: '90vh',
    overflow: 'auto',
    border: '1px solid #26493c',
    boxShadow: '0 20px 60px rgba(0,0,0,0.6)'
  },
  headerRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12
  },
  title: {
    margin: 0,
    fontSize: 28,
    fontWeight: 800,
    color: '#e8efe8'
  },
  closeBtn: {
    background: 'none',
    border: 'none',
    color: '#9db',
    fontSize: 28,
    cursor: 'pointer',
    lineHeight: 1
  },
  matchInfo: {
    backgroundColor: '#0f2a20',
    color: '#cfe',
    padding: '12px 14px',
    fontSize: 15,
    marginBottom: 10,
    borderRadius: 10,
    border: '1px solid #26493c'
  },
  instructions: {
    backgroundColor: '#0f2a20',
    color: '#9db',
    padding: '12px 14px',
    fontSize: 14,
    marginBottom: 16,
    borderRadius: 10,
    border: '1px solid #26493c'
  },
  error: {
    backgroundColor: '#2a0f0f',
    color: '#ff6b6b',
    padding: 12,
    marginBottom: 14,
    borderRadius: 8,
    border: '1px solid #ff6b6b'
  },
  success: {
    backgroundColor: '#0f2a1a',
    color: '#6bff9d',
    padding: 12,
    marginBottom: 14,
    borderRadius: 8,
    border: '1px solid #4a9d5f'
  },
  sectionHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12
  },
  sectionHeaderSimple: {
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
    marginBottom: 8
  },
  btnPrimary: {
    background: 'linear-gradient(135deg, #debc7c, #c9a75f)',
    color: '#10261f',
    border: 'none',
    padding: '10px 16px',
    fontSize: 14,
    fontWeight: 700,
    cursor: 'pointer',
    borderRadius: 10,
    boxShadow: '0 6px 16px rgba(222, 188, 124, 0.3)',
    transition: 'all 0.2s ease'
  },
  btnGhost: {
    background: 'rgba(38, 73, 60, 0.6)',
    color: '#cfe',
    border: '1px solid #26493c',
    padding: '10px 14px',
    fontSize: 14,
    fontWeight: 600,
    cursor: 'pointer',
    borderRadius: 10
  },
  btnSecondary: {
    background: 'rgba(222, 188, 124, 0.15)',
    color: '#debc7c',
    border: '1px solid #c9a75f',
    padding: '10px 14px',
    fontSize: 14,
    fontWeight: 600,
    cursor: 'pointer',
    borderRadius: 10
  },
  addForm: {
    backgroundColor: '#0f2a20',
    border: '1px solid #26493c',
    borderRadius: 10,
    padding: 12,
    marginBottom: 14
  },
  formRow: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr 1fr',
    gap: 12
  },
  modeGroup: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 8
  },
  modeBtn: {
    background: '#0a1c17',
    color: '#cfe',
    border: '1px solid #26493c',
    padding: '10px 14px',
    fontSize: 13,
    fontWeight: 700,
    cursor: 'pointer',
    borderRadius: 10
  },
  modeBtnActive: {
    background: 'rgba(222, 188, 124, 0.16)',
    color: '#debc7c',
    borderColor: '#c9a75f'
  },
  configCard: {
    backgroundColor: '#08241c',
    border: '1px solid #26493c',
    borderRadius: 10,
    padding: 12
  },
  dateGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
    gap: 8
  },
  dateToggle: {
    background: '#0a1c17',
    color: '#cfe',
    border: '1px solid #26493c',
    padding: '10px 12px',
    fontSize: 13,
    fontWeight: 600,
    cursor: 'pointer',
    borderRadius: 10,
    textAlign: 'left'
  },
  dateToggleActive: {
    background: 'rgba(222, 188, 124, 0.16)',
    color: '#debc7c',
    borderColor: '#c9a75f'
  },
  presetGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
    gap: 8
  },
  presetBtn: {
    background: '#0a1c17',
    color: '#e8efe8',
    border: '1px solid #26493c',
    padding: '12px 14px',
    fontSize: 13,
    fontWeight: 700,
    cursor: 'pointer',
    borderRadius: 10,
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
    alignItems: 'flex-start',
    textAlign: 'left'
  },
  presetBtnActive: {
    background: 'rgba(222, 188, 124, 0.16)',
    borderColor: '#c9a75f'
  },
  formGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: 6
  },
  label: {
    color: '#9db',
    fontSize: 13,
    fontWeight: 600
  },
  input: {
    width: '100%',
    padding: 10,
    fontSize: 14,
    border: '1px solid #26493c',
    borderRadius: 8,
    backgroundColor: '#0a1c17',
    color: '#e8efe8'
  },
  inputTime: {
    padding: 10,
    fontSize: 14,
    border: '1px solid #26493c',
    borderRadius: 8,
    backgroundColor: '#0a1c17',
    color: '#e8efe8'
  },
  formActions: {
    marginTop: 10,
    display: 'flex',
    gap: 10
  },
  empty: {
    color: '#9db',
    backgroundColor: '#0f2a20',
    border: '1px solid #26493c',
    padding: 12,
    borderRadius: 10,
    textAlign: 'center'
  },
  weekCard: {
    backgroundColor: '#08241c',
    border: '1px solid #26493c',
    borderRadius: 12,
    padding: 12,
    display: 'grid',
    gap: 10
  },
  weekHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: 6,
    borderBottom: '1px solid #26493c'
  },
  dateCard: {
    backgroundColor: '#0f2a20',
    border: '1px solid #26493c',
    borderRadius: 12,
    padding: 12
  },
  dateHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10
  },
  frameRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#0a1c17',
    border: '1px solid #26493c',
    borderRadius: 10,
    padding: '10px 12px'
  },
  rangeRow: {
    display: 'grid',
    gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr) auto',
    gap: 10,
    alignItems: 'end',
    backgroundColor: '#0a1c17',
    border: '1px solid #26493c',
    borderRadius: 10,
    padding: '10px 12px'
  },
  windowRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#0a1c17',
    border: '1px solid #26493c',
    borderRadius: 10,
    padding: '10px 12px'
  },
  slotItem: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
    padding: '12px 14px',
    backgroundColor: '#0f2a20',
    border: '1px solid #26493c',
    borderRadius: 10
  }
};
