import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { API_BASE } from '../config';
import Avatar from '../components/Avatar';
import LocationSelector from '../components/LocationSelector';
import SportSelector from '../components/SportSelector';

export default function SearchMatchDialog() {
  const navigate = useNavigate();
  const [sp, setSp] = useSearchParams();
  const [sports, setSports] = useState([]);
  const [sportCategories, setSportCategories] = useState([]);
  const [cities, setCities] = useState([]);
  const [searching, setSearching] = useState(false);
  const [rows, setRows] = useState([]);
  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
  const authed = !!token;

  // Dropdown coordination state
  const [sportDropdownOpen, setSportDropdownOpen] = useState(false);
  const [locationDropdownOpen, setLocationDropdownOpen] = useState(false);
  
  // View mode state
  const [viewMode, setViewMode] = useState('table'); // 'table' | 'cards' | 'map'

  // local state reflects query params
  const [sportId, setSportId] = useState(sp.get('sportId') || '');
  const [countryId, setCountryId] = useState(sp.get('countryId') || '');
  const [stateId, setStateId] = useState(sp.get('stateId') || '');
  const [cityId, setCityId] = useState(sp.get('cityId') || '');
  
  // Date filter
  const [dateFilterMode, setDateFilterMode] = useState(sp.get('dateFilterMode') || 'range'); // 'range' or 'custom'
  const [rangeDays, setRangeDays] = useState(sp.get('rangeDays') || '14');
  const [fromDate, setFromDate] = useState(sp.get('fromDate') || '');
  const [toDate, setToDate] = useState(sp.get('toDate') || '');

  // create match modal
  const [showCreate, setShowCreate] = useState(false);
  const [myLeagues, setMyLeagues] = useState([]);
  const [cmSportId, setCmSportId] = useState('');
  const [cmCountryId, setCmCountryId] = useState('');
  const [cmStateId, setCmStateId] = useState('');
  const [cmCityId, setCmCityId] = useState('');
  const [cmLocationId, setCmLocationId] = useState(''); // Selected location
  const [cmWhenType, setCmWhenType] = useState(''); // 'exact' | 'range' | 'timewindow'
  const [cmExactDate, setCmExactDate] = useState('');
  const [cmTimeMode, setCmTimeMode] = useState('specific'); // 'specific' | 'timeofday'
  const [cmTimeFrom, setCmTimeFrom] = useState('14:00');
  const [cmTimeTo, setCmTimeTo] = useState('15:00');
  const [cmTimeOfDay, setCmTimeOfDay] = useState(''); // 'morning' | 'afternoon' | 'evening'
  const [cmRangeDays, setCmRangeDays] = useState(7);
  const [cmTimeWindowStart, setCmTimeWindowStart] = useState('');
  const [cmTimeWindowEnd, setCmTimeWindowEnd] = useState('');
  const [cmWhen, setCmWhen] = useState(''); // ISO for datetime-local (computed)
  const [cmType, setCmType] = useState(''); // Starter | Experienced | Pro - PFLICHTFELD!
  const [creating, setCreating] = useState(false);
  const [createErr, setCreateErr] = useState('');
  const [availableLocations, setAvailableLocations] = useState([]);
  const [loadingLocations, setLoadingLocations] = useState(false);
  
  // Schritt 4: Verfügbarkeit
  const [cmSlotDuration, setCmSlotDuration] = useState(60); // Standard 1:00h
  const [cmAvailability, setCmAvailability] = useState([]); // Array of {date, timeStart, timeEnd, endDate?}
  const [tempTimesByDate, setTempTimesByDate] = useState({}); // { [isoDate]: [{ id, start, end }] }
  const [selectedDates, setSelectedDates] = useState([]); // ISO date strings
  const [availabilityMode, setAvailabilityMode] = useState('per-day'); // 'per-day' | 'preset'
  const [presetSelections, setPresetSelections] = useState({ morning: false, midday: false, evening: false });
  const [defaultsLoaded, setDefaultsLoaded] = useState(false);
  const [locationPrefillDone, setLocationPrefillDone] = useState(false);

  const parseTimeToMinutes = (timeStr) => {
    const [h, m] = (timeStr || '').split(':').map(Number);
    if (!Number.isFinite(h) || !Number.isFinite(m)) return null;
    return h * 60 + m;
  };

  const addDaysIso = (isoDate, days) => {
    if (!isoDate) return '';
    const d = new Date(isoDate);
    d.setDate(d.getDate() + days);
    return d.toISOString().slice(0, 10);
  };


  const minutesToTimeString = (minutes) => {
    const capped = Math.max(0, Math.min(23 * 60 + 45, minutes));
    const h = Math.floor(capped / 60);
    const m = capped % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  };

  const snapToQuarter = (timeStr) => {
    const mins = parseTimeToMinutes(timeStr);
    if (mins === null) return '';
    const snapped = Math.round(mins / 15) * 15;
    return minutesToTimeString(snapped);
  };

  const setCityFromId = (cityIdVal) => {
    setCmCityId(String(cityIdVal));
    setCityId(String(cityIdVal));
    const cityObj = cities.find(c => String(c.id) === String(cityIdVal));
    if (cityObj) {
      setCmCountryId(cityObj.countryId || '');
      setCmStateId(cityObj.stateId || '');
      setCountryId(cityObj.countryId || '');
      setStateId(cityObj.stateId || '');
    }
  };

  const findDefaultTennisSportId = () => {
    const lower = (s) => (s || '').toLowerCase();
    const byName = (name) => lower(name).includes('tennis') && (lower(name).includes('einzel') || lower(name).includes('single'));
    const exact = sports.find(s => byName(s.name));
    if (exact) return exact.id;
    const tennisOnly = sports.find(s => lower(s.name).includes('tennis'));
    if (tennisOnly) return tennisOnly.id;
    // Try variants from categories
    for (const cat of sportCategories || []) {
      for (const sport of cat.sports || []) {
        for (const variant of sport.variants || []) {
          if (byName(variant.name)) return variant.id;
          if (lower(variant.name).includes('tennis')) return variant.id;
        }
        if (byName(sport.name)) return sport.id;
        if (lower(sport.name).includes('tennis')) return sport.id;
      }
    }
    return null;
  };

  const detectLocationCreate = async () => {
    if (locationPrefillDone) return false;
    if (typeof navigator === 'undefined' || !navigator.geolocation) return false;
    try {
      const position = await new Promise((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 0
        });
      });
      const { latitude, longitude } = position.coords;
      const response = await fetch(`${API_BASE}/locations/nearest?lat=${latitude}&lon=${longitude}`);
      if (!response.ok) return false;
      const data = await response.json();
      if (data.city && data.city.id) {
        setCityFromId(data.city.id);
        return true;
      }
    } catch (err) {
      console.warn('[CreateMatch] detectLocation failed', err);
    }
    return false;
  };

  const applyProfileCityCreate = async () => {
    if (!authed || locationPrefillDone) return false;
    try {
      const res = await fetch(`${API_BASE}/profile`, { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) return false;
      const data = await res.json();
      const profileCityId = data?.city_id || data?.cityId || data?.city?.id;
      if (profileCityId) {
        setCityFromId(profileCityId);
        return true;
      }
    } catch (err) {
      console.warn('[CreateMatch] applyProfileCity failed', err);
    }
    return false;
  };

  const applyLeagueCityCreate = async () => {
    if (!authed || locationPrefillDone) return false;
    try {
      const res = await fetch(`${API_BASE}/me/leagues`, { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) return false;
      const leagues = await res.json();
      const firstCityId = (leagues || []).find(l => l.cityId)?.cityId;
      if (firstCityId) {
        setCityFromId(firstCityId);
        return true;
      }
    } catch (err) {
      console.warn('[CreateMatch] applyLeagueCity failed', err);
    }
    return false;
  };

  const prefillLocationCreate = useCallback(async () => {
    if (locationPrefillDone || !authed) return;
    let applied = await detectLocationCreate();
    if (!applied) {
      applied = await applyProfileCityCreate();
    }
    if (!applied) {
      applied = await applyLeagueCityCreate();
    }
    setLocationPrefillDone(true);
  }, [authed, locationPrefillDone, applyLeagueCityCreate, applyProfileCityCreate, detectLocationCreate]);

  useEffect(() => {
    prefillLocationCreate();
  }, [prefillLocationCreate]);

  const createDefaultRange = (start = '18:00', end = '20:00') => ({ id: `r-${Math.random().toString(36).slice(2, 8)}`, start, end });

  const presetOptions = [
    { key: 'morning', label: '🌅 Morgens', start: '08:00', end: '11:00' },
    { key: 'midday', label: '☀️ Mittags', start: '12:00', end: '16:00' },
    { key: 'evening', label: '🌙 Abends', start: '17:00', end: '21:00' },
  ];

  const getIsoWeekInfo = (isoDate) => {
    if (!isoDate) return null;
    const d = new Date(`${isoDate}T12:00:00`);
    const day = d.getDay() || 7; // 1=Mon ... 7=Sun
    const thursday = new Date(d);
    thursday.setDate(d.getDate() + 4 - day);
    const weekYear = thursday.getFullYear();
    const yearStart = new Date(weekYear, 0, 1);
    const weekNumber = Math.ceil(((thursday - yearStart) / 86400000 + 1) / 7);
    const weekStart = new Date(thursday);
    weekStart.setDate(thursday.getDate() - ((thursday.getDay() + 6) % 7));
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6);
    return {
      weekYear,
      weekNumber,
      weekStart: weekStart.toISOString().slice(0, 10),
      weekEnd: weekEnd.toISOString().slice(0, 10)
    };
  };

  const toggleDate = (dateStr) => {
    setSelectedDates(prev => {
      const removing = prev.includes(dateStr);
      if (removing) {
        setCmAvailability(curr => curr.filter(s => s.date !== dateStr));
      }
      return removing ? prev.filter(d => d !== dateStr) : [...prev, dateStr];
    });
  };

  const formatDuration = (minutes) => {
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return `${h}:${String(m).padStart(2, '0')}`;
  };

  const computeSlotEnd = (slotDate, slotTime, durationMinutes) => {
    if (!slotDate || !slotTime) return { endDate: '', endTime: '' };
    const [h, m] = slotTime.split(':').map(Number);
    const start = new Date(slotDate);
    start.setHours(Number.isFinite(h) ? h : 0, Number.isFinite(m) ? m : 0, 0, 0);
    const end = new Date(start.getTime() + durationMinutes * 60000);
    const endDate = end.toISOString().slice(0, 10);
    const endTime = end.toTimeString().slice(0, 5);
    return { endDate, endTime };
  };

  useEffect(() => {
    let mounted = true;
    Promise.all([
      fetch(`${API_BASE}/sports/list`).then(r => r.ok ? r.json() : []),
      fetch(`${API_BASE}/sports/categories`).then(r => r.ok ? r.json() : []),
      fetch(`${API_BASE}/cities/list`).then(r => r.ok ? r.json() : []),
      fetch(`${API_BASE}/countries/list`).then(r => r.ok ? r.json() : []),
      fetch(`${API_BASE}/states/list`).then(r => r.ok ? r.json() : []),
    ]).then(([ss, scat, cs, cos, sts]) => {
      if (!mounted) return;
      setSports(Array.isArray(ss) ? ss : []);
      setSportCategories(Array.isArray(scat) ? scat : []);
      setCities(Array.isArray(cs) ? cs : []);
      // Store in window for LocationSelector
      window.__countriesData = Array.isArray(cos) ? cos : [];
      window.__statesData = Array.isArray(sts) ? sts : [];
    });
    return () => { mounted = false; };
  }, []);

  // Prefill defaults: sport -> Tennis Einzel (fallback tennis), city -> user's league city
  useEffect(() => {
    if (!authed || defaultsLoaded) return;
    if (!cities.length || !sports.length) return;
    (async () => {
      try {
        // Sport default
        if (!cmSportId) {
          const foundId = findDefaultTennisSportId();
          if (foundId) {
            setCmSportId(String(foundId));
            setSportId(String(foundId));
          }
        }

        // City default from user's leagues
        if (!cmCityId && !cityId) {
          const token = localStorage.getItem('token');
          if (token) {
            const meLeagues = await fetch(`${API_BASE}/me/leagues`, { headers: { Authorization: `Bearer ${token}` } }).then(r => r.ok ? r.json() : []);
            const firstCity = (meLeagues || []).find(l => l.cityId)?.cityId;
            if (firstCity) {
              const cityObj = cities.find(c => String(c.id) === String(firstCity));
              setCmCityId(String(firstCity));
              setCityId(String(firstCity));
              if (cityObj) {
                setCmCountryId(cityObj.countryId || '');
                setCmStateId(cityObj.stateId || '');
                setCountryId(cityObj.countryId || '');
                setStateId(cityObj.stateId || '');
              }
            }
          }
        }
      } catch (err) {
        console.error('Default prefill failed', err);
      } finally {
        setDefaultsLoaded(true);
      }
    })();
  }, [authed, cities, sports, cmSportId, cmCityId, cityId, defaultsLoaded]);

  // Auto-search when filters change
  useEffect(() => {
    runSearch();
  }, [sportId, countryId, stateId, cityId, dateFilterMode, rangeDays, fromDate, toDate]);

  // Load available locations for sport and city
  const loadAvailableLocations = async (sportId, cityId) => {
    if (!sportId || !cityId) {
      setAvailableLocations([]);
      return;
    }

    setLoadingLocations(true);
    try {
      const params = new URLSearchParams({
        sport_id: sportId,
        city_id: cityId
      });

      const res = await fetch(`${API_BASE}/locations/list?${params.toString()}`);
      if (!res.ok) throw new Error('Failed to load locations');
      const data = await res.json();
      setAvailableLocations(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Location load error:', err);
      setAvailableLocations([]);
    } finally {
      setLoadingLocations(false);
    }
  };

  // Load locations when sport or city changes
  useEffect(() => {
    if (cmSportId && cmCityId) {
      loadAvailableLocations(cmSportId, cmCityId);
    }
  }, [cmSportId, cmCityId]);

  // Recalculate end times for existing slots when duration changes
  useEffect(() => {
    if (!cmAvailability.length) return;
    setCmAvailability(prev => prev.map(slot => {
      const { endDate, endTime } = computeSlotEnd(slot.date, slot.timeStart, cmSlotDuration);
      const endDateField = endDate && endDate !== slot.date ? { endDate } : {};
      return { ...slot, timeEnd: endTime, ...endDateField };
    }));
  }, [cmSlotDuration]);

  const countries = useMemo(() => {
    return [...new Map(cities.filter(c => c.countryId).map(c => [c.countryId, { id: c.countryId, name: c.countryName }])).values()];
  }, [cities]);
  const states = useMemo(() => {
    return [...new Map(cities.filter(c => (!countryId || String(c.countryId) === String(countryId)) && c.stateId).map(c => [c.stateId, { id: c.stateId, name: c.stateName }])).values()];
  }, [cities, countryId]);
  const filteredCities = useMemo(() => {
    return cities.filter(c => (!countryId || String(c.countryId) === String(countryId)) && (!stateId || String(c.stateId) === String(stateId)));
  }, [cities, countryId, stateId]);

  // For create match modal
  const cmCountries = useMemo(() => {
    return [...new Map(cities.filter(c => c.countryId).map(c => [c.countryId, { id: c.countryId, name: c.countryName }])).values()];
  }, [cities]);
  const cmStates = useMemo(() => {
    return [...new Map(cities.filter(c => (!cmCountryId || String(c.countryId) === String(cmCountryId)) && c.stateId).map(c => [c.stateId, { id: c.stateId, name: c.stateName }])).values()];
  }, [cities, cmCountryId]);
  const cmFilteredCities = useMemo(() => {
    return cities.filter(c => (!cmCountryId || String(c.countryId) === String(cmCountryId)) && (!cmStateId || String(c.stateId) === String(cmStateId)));
  }, [cities, cmCountryId, cmStateId]);
  // Schritt-Freigaben für den Match-Flow
  const step1Complete = !!(cmSportId && cmCityId);
  const whenDataComplete = cmWhenType === 'exact'
    ? !!cmExactDate
    : cmWhenType === 'range'
      ? !!cmRangeDays
      : cmWhenType === 'timewindow'
        ? !!(cmTimeWindowStart && cmTimeWindowEnd)
        : false;
  const step2Complete = step1Complete && !!cmType;
  const step3Complete = step2Complete && !!cmWhenType && whenDataComplete;
  const step4Complete = step3Complete; // Slotdauer wählbar nach Zeitpunkt

  const selectableDates = useMemo(() => {
    const res = [];
    const todayIso = new Date().toISOString().slice(0, 10);
    if (cmWhenType === 'exact' && cmExactDate) {
      res.push(cmExactDate);
    } else if (cmWhenType === 'range' && cmRangeDays) {
      const start = new Date();
      for (let i = 0; i < Number(cmRangeDays); i++) {
        const d = new Date(start);
        d.setDate(start.getDate() + i);
        res.push(d.toISOString().slice(0, 10));
      }
    } else if (cmWhenType === 'timewindow' && cmTimeWindowStart && cmTimeWindowEnd) {
      const start = new Date(cmTimeWindowStart);
      const end = new Date(cmTimeWindowEnd);
      for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        res.push(new Date(d).toISOString().slice(0, 10));
      }
    } else if (cmWhenType === 'exact') {
      res.push(todayIso);
    }
    return res;
  }, [cmWhenType, cmExactDate, cmRangeDays, cmTimeWindowStart, cmTimeWindowEnd]);

  const groupedSelectedDates = useMemo(() => {
    const sorted = [...selectedDates].sort();
    const groups = [];
    sorted.forEach(ds => {
      const info = getIsoWeekInfo(ds);
      if (!info) return;
      const key = `${info.weekYear}-W${info.weekNumber}`;
      let g = groups.find(x => x.key === key);
      if (!g) {
        g = { key, weekNumber: info.weekNumber, weekYear: info.weekYear, weekStart: info.weekStart, weekEnd: info.weekEnd, days: [] };
        groups.push(g);
      }
      g.days.push(ds);
    });
    return groups;
  }, [selectedDates]);

  const addAvailabilitySlot = (dateStr, start, end) => {
    const startSanitized = snapToQuarter(start);
    const endSanitized = snapToQuarter(end);
    if (!step3Complete) {
      setCreateErr('Bitte Schritt 3 abschließen, bevor Verfügbarkeiten gesetzt werden.');
      return false;
    }
    if (!dateStr) {
      setCreateErr('Bitte Datum wählen.');
      return false;
    }
    const startM = parseTimeToMinutes(startSanitized);
    const endM = parseTimeToMinutes(endSanitized);
    if (startM === null || endM === null || startM >= endM) {
      setCreateErr('Bitte gültige Zeitspanne wählen (von < bis).');
      return false;
    }
    const newStartDate = new Date(`${dateStr}T${startSanitized}:00`);
    const newEndDate = new Date(`${dateStr}T${endSanitized}:00`);
    const conflict = cmAvailability.some(slot => {
      if (slot.date !== dateStr) return false;
      const existingStartDate = new Date(`${slot.date}T${slot.timeStart}:00`);
      const endDateStr = slot.endDate && slot.endDate !== slot.date ? slot.endDate : slot.date;
      const existingEndDate = new Date(`${endDateStr}T${slot.timeEnd}:00`);
      return newStartDate < existingEndDate && existingStartDate < newEndDate;
    });
    if (conflict) {
      setCreateErr('Konflikt: Überschneidung mit bestehendem Slot.');
      return false;
    }
    setCmAvailability(prev => [...prev, { date: dateStr, timeStart: startSanitized, timeEnd: endSanitized }]);
    setCreateErr('');
    return true;
  };

  const updateDayAvailability = (dateStr, ranges) => {
    if (!step3Complete) {
      setCreateErr('Bitte Schritt 3 abschließen, bevor Verfügbarkeiten gesetzt werden.');
      return false;
    }
    if (!dateStr) {
      setCreateErr('Bitte Datum wählen.');
      return false;
    }
    if (!ranges || ranges.length === 0) {
      setCmAvailability(prev => prev.filter(s => s.date !== dateStr));
      setCreateErr('');
      return true;
    }

    const normalized = ranges.map(r => {
      const startSanitized = snapToQuarter(r.start);
      const endSanitized = snapToQuarter(r.end);
      const startM = parseTimeToMinutes(startSanitized);
      const endM = parseTimeToMinutes(endSanitized);
      return { ...r, start: startSanitized, end: endSanitized, startM, endM };
    });

    if (normalized.some(n => n.startM === null || n.endM === null || n.startM >= n.endM)) {
      setCreateErr('Bitte gültige Zeitspannen wählen (von < bis).');
      return false;
    }

    const sorted = [...normalized].sort((a, b) => a.startM - b.startM);
    for (let i = 1; i < sorted.length; i++) {
      if (sorted[i].startM < sorted[i - 1].endM) {
        setCreateErr('Konflikt: Überlappende Slots am selben Tag.');
        return false;
      }
    }

    const newSlots = sorted.map(n => ({ date: dateStr, timeStart: n.start, timeEnd: n.end }));
    setCmAvailability(prev => [...prev.filter(s => s.date !== dateStr), ...newSlots]);
    setCreateErr('');
    return true;
  };

  const applyPresetsToAllDays = () => {
    if (!step3Complete) {
      setCreateErr('Bitte Schritt 3 abschließen, bevor Verfügbarkeiten gesetzt werden.');
      return;
    }
    const activePresets = presetOptions.filter(p => presetSelections[p.key]);
    if (activePresets.length === 0) {
      setCreateErr('Bitte mindestens einen Zeitraum auswählen.');
      return;
    }
    if (selectedDates.length === 0) {
      setCreateErr('Bitte Datum wählen.');
      return;
    }

    let added = 0;
    let next = [...cmAvailability];

    selectedDates.forEach(ds => {
      activePresets.forEach(p => {
        const newStartDate = new Date(`${ds}T${p.start}:00`);
        const newEndDate = new Date(`${ds}T${p.end}:00`);
        const conflict = next.some(slot => {
          if (slot.date !== ds) return false;
          const existingStartDate = new Date(`${slot.date}T${slot.timeStart}:00`);
          const endDateStr = slot.endDate && slot.endDate !== slot.date ? slot.endDate : slot.date;
          const existingEndDate = new Date(`${endDateStr}T${slot.timeEnd}:00`);
          return newStartDate < existingEndDate && existingStartDate < newEndDate;
        });
        if (!conflict) {
          next.push({ date: ds, timeStart: p.start, timeEnd: p.end });
          added += 1;
        }
      });
    });

    if (added === 0) {
      setCreateErr('Kein Zeitraum hinzugefügt (evtl. Konflikte).');
      return;
    }

    setCmAvailability(next);
    setCreateErr('');
  };

  useEffect(() => {
    if (availabilityMode !== 'per-day') return;
    selectedDates.forEach(ds => {
      const ranges = tempTimesByDate[ds];
      if (ranges && ranges.length) {
        updateDayAvailability(ds, ranges);
      }
    });
  }, [availabilityMode, tempTimesByDate, selectedDates]);

  useEffect(() => {
    // Initialize default ranges for newly selected dates
    setTempTimesByDate(prev => {
      const next = { ...prev };
      selectedDates.forEach(ds => {
        if (!next[ds]) next[ds] = [createDefaultRange()];
      });
      // Remove entries for deselected dates
      Object.keys(next).forEach(k => {
        if (!selectedDates.includes(k)) delete next[k];
      });
      return next;
    });
  }, [selectedDates]);


  useEffect(() => {
    if (selectableDates.length > 0) {
      setSelectedDates(selectableDates);
    } else {
      setSelectedDates([]);
    }
  }, [selectableDates]);

  async function runSearch(paramsOverride) {
    const qp = new URLSearchParams({
      ...(sportId ? { sportId } : {}),
      ...(countryId ? { countryId } : {}),
      ...(stateId ? { stateId } : {}),
      ...(cityId ? { cityId } : {}),
      ...(dateFilterMode === 'range' && rangeDays ? { rangeDays } : {}),
      ...(dateFilterMode === 'custom' && fromDate ? { fromDate } : {}),
      ...(dateFilterMode === 'custom' && toDate ? { toDate } : {}),
      ...(paramsOverride || {}),
    });
    // keep URL in sync
    setSp(qp, { replace: true });
    setSearching(true);
    try {
      const res = await fetch(`${API_BASE}/open-matches?${qp.toString()}`);
      const data = await res.json();
      setRows(Array.isArray(data) ? data : []);
    } finally {
      setSearching(false);
    }
  }

  // auto-run search on mount if any param present
  useEffect(() => {
    const had = sp.get('sportId') || sp.get('countryId') || sp.get('stateId') || sp.get('cityId');
    if (had) runSearch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // open modal → prefill and load user's leagues
  function openCreate() {
    setCreateErr('');
    setCmSportId(sportId || '');
    setCmCityId(cityId || '');
  // no league selection for open matches
    setCmWhen('');
    setCmType('Liga');
    setShowCreate(true);
    if (authed) {
      fetch(`${API_BASE}/me/leagues`, { headers: { Authorization: `Bearer ${token}` } })
        .then(r => r.ok ? r.json() : [])
        .then(ls => setMyLeagues(Array.isArray(ls) ? ls : []))
        .catch(() => setMyLeagues([]));
    }
  }

  function closeCreate() { setShowCreate(false); }

  const leaguesFiltered = useMemo(() => [], []);

  async function handleCreate() {
    if (!authed) { setCreateErr('Bitte zuerst anmelden.'); return; }
    if (!cmSportId || !cmCityId) {
      setCreateErr('Bitte Sportart und Stadt auswählen.');
      return;
    }
    if (!cmType) {
      setCreateErr('Bitte wähle ein Level aus');
      return;
    }
    if (cmAvailability.length === 0) {
      setCreateErr('Bitte mindestens einen verfügbaren Zeitraum eintragen');
      return;
    }
    try {
      setCreating(true);
      setCreateErr('');
      
      // Validierung: Level ist Pflicht
      if (!cmType) {
        setCreateErr('Bitte wähle ein Level aus');
        setCreating(false);
        return;
      }
      
      // Build request body with time range information
      const body = {
        sportId: Number(cmSportId),
        cityId: Number(cmCityId),
        when_type: cmWhenType || null,
        player_level: cmType,
        slot_duration: cmSlotDuration, // Slot-Dauer in Minuten
        availability: cmAvailability, // Verfügbare Zeiträume
      };
      
      // Add location if selected
      if (cmLocationId) {
        body.location_id = Number(cmLocationId);
      }
      
      // Add time information based on mode
      if (cmTimeMode === 'timeofday' && cmTimeOfDay) {
        body.time_of_day = cmTimeOfDay;
      } else if (cmTimeMode === 'specific' && cmTimeFrom) {
        body.time_from = cmTimeFrom;
        body.time_to = cmTimeTo || cmTimeFrom;
      }
      
      // Add kickoff times based on when_type
      if (cmWhenType === 'exact' && cmExactDate) {
        const exactStart = new Date(`${cmExactDate}T12:00:00`);
        const { endDate, endTime } = computeSlotEnd(cmExactDate, '12:00', cmSlotDuration);
        const endIso = endDate && endTime ? new Date(`${endDate}T${endTime}:00`).toISOString() : null;
        body.kickoff_at = exactStart.toISOString();
        if (endIso) body.kickoff_end_at = endIso;
      } else if (cmWhenType === 'range' && cmRangeDays) {
        const now = new Date();
        const end = new Date(now);
        end.setDate(end.getDate() + Number(cmRangeDays));
        body.kickoff_at = now.toISOString();
        body.kickoff_end_at = end.toISOString();
        body.range_days = Number(cmRangeDays);
      } else if (cmWhenType === 'timewindow' && cmTimeWindowStart && cmTimeWindowEnd) {
        body.kickoff_at = new Date(cmTimeWindowStart).toISOString();
        body.kickoff_end_at = new Date(cmTimeWindowEnd).toISOString();
      }
      
      const resp = await fetch(`${API_BASE}/open-matches`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(body)
      });
      if (!resp.ok) {
        const t = await resp.json().catch(() => ({}));
        throw new Error(t.error || 'Konnte Match nicht erstellen');
      }
      const match = await resp.json();
      setShowCreate(false);
      navigate(`/matches/${match.id}`);
    } catch (e) {
      setCreateErr(e?.message || 'Fehler beim Erstellen');
    } finally {
      setCreating(false);
    }
  }

  return (
    <div style={{ maxWidth: 1000, margin: '20px auto', padding: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h1 style={{ marginTop: 0, marginBottom: 0 }}>Match suchen</h1>
        <button onClick={openCreate} disabled={!authed} style={{ 
          background: '#debc7c', 
          color: '#10261f', 
          padding: '10px 18px', 
          borderRadius: 10, 
          border: 'none', 
          cursor: authed ? 'pointer' : 'not-allowed', 
          fontWeight: 700,
          opacity: authed ? 1 : 0.5
        }}>{authed ? 'Match erstellen' : 'Einloggen um zu erstellen'}</button>
      </div>
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center', marginBottom: 12 }}>
        <div style={{ minWidth: 200 }}>
          <SportSelector
            sports={sportCategories}
            value={sportId ? (sports.find(s => String(s.id) === String(sportId))?.name || '') : ''}
            onChange={(sportName, sportIdVal) => setSportId(sportIdVal)}
            placeholder="Sportart wählen"
            isOpen={sportDropdownOpen}
            onOpen={() => {
              setSportDropdownOpen(true);
              setLocationDropdownOpen(false);
            }}
            onClose={() => setSportDropdownOpen(false)}
          />
        </div>
        
        <div style={{ minWidth: 200, position: 'relative' }}>
          <LocationSelector
            cities={cities}
            countries={window.__countriesData || []}
            states={window.__statesData || []}
            value={cityId ? (cities.find(c => String(c.id) === String(cityId))?.name || '') : ''}
            onChange={(cityName, cityIdVal) => {
              setCityId(cityIdVal);
              const selectedCity = cities.find(c => String(c.id) === String(cityIdVal));
              if (selectedCity) {
                setCountryId(selectedCity.countryId || '');
                setStateId(selectedCity.stateId || '');
              }
            }}
            placeholder="Stadt"
            isOpen={locationDropdownOpen}
            onOpen={() => {
              setLocationDropdownOpen(true);
              setSportDropdownOpen(false);
            }}
            onClose={() => setLocationDropdownOpen(false)}
          />
        </div>
        
        {/* Date Filter */}
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          {dateFilterMode === 'range' ? (
            <select 
              value={rangeDays} 
              onChange={(e) => setRangeDays(e.target.value)}
              style={{ 
                background: '#0e2a22', 
                color: '#e8efe8', 
                border: '1px solid #2f6b57', 
                borderRadius: 8, 
                padding: '10px 12px',
                fontSize: 14,
                cursor: 'pointer'
              }}
            >
              <option value="3">In den nächsten 3 Tagen</option>
              <option value="7">In den nächsten 7 Tagen</option>
              <option value="14">In den nächsten 14 Tagen</option>
              <option value="30">In den nächsten 30 Tagen</option>
            </select>
          ) : (
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <input 
                type="date" 
                value={fromDate} 
                onChange={(e) => setFromDate(e.target.value)}
                style={{ 
                  background: '#0e2a22', 
                  color: '#e8efe8', 
                  border: '1px solid #2f6b57', 
                  borderRadius: 8, 
                  padding: '9px 12px',
                  fontSize: 14
                }}
              />
              <span style={{ color: '#9db' }}>–</span>
              <input 
                type="date" 
                value={toDate} 
                onChange={(e) => setToDate(e.target.value)}
                style={{ 
                  background: '#0e2a22', 
                  color: '#e8efe8', 
                  border: '1px solid #2f6b57', 
                  borderRadius: 8, 
                  padding: '9px 12px',
                  fontSize: 14
                }}
              />
            </div>
          )}
          <button 
            onClick={() => setDateFilterMode(dateFilterMode === 'range' ? 'custom' : 'range')}
            style={{ 
              background: '#1a3c33', 
              color: '#debc7c', 
              border: '1px solid #2f6b57', 
              borderRadius: 8, 
              padding: '10px 14px',
              fontSize: 13,
              cursor: 'pointer',
              fontWeight: 600
            }}
            title={dateFilterMode === 'range' ? 'Zeitraum wählen' : 'Tage wählen'}
          >
            {dateFilterMode === 'range' ? '📅' : '🔢'}
          </button>
        </div>
        
        {/* View mode toggle */}
        <div style={{ display: 'flex', gap: 4, marginLeft: 'auto' }}>
          <button 
            onClick={() => setViewMode('table')}
            style={{ 
              background: viewMode === 'table' ? '#debc7c' : '#1a3c33', 
              color: viewMode === 'table' ? '#10261f' : '#debc7c', 
              border: '1px solid #2f6b57', 
              borderRadius: 8, 
              padding: '10px 14px',
              fontSize: 13,
              cursor: 'pointer',
              fontWeight: 600
            }}
            title="Tabellenansicht"
          >
            📋
          </button>
          <button 
            onClick={() => setViewMode('cards')}
            style={{ 
              background: viewMode === 'cards' ? '#debc7c' : '#1a3c33', 
              color: viewMode === 'cards' ? '#10261f' : '#debc7c', 
              border: '1px solid #2f6b57', 
              borderRadius: 8, 
              padding: '10px 14px',
              fontSize: 13,
              cursor: 'pointer',
              fontWeight: 600
            }}
            title="Kartenansicht"
          >
            🃏
          </button>
          <button 
            onClick={() => setViewMode('map')}
            style={{ 
              background: viewMode === 'map' ? '#debc7c' : '#1a3c33', 
              color: viewMode === 'map' ? '#10261f' : '#debc7c', 
              border: '1px solid #2f6b57', 
              borderRadius: 8, 
              padding: '10px 14px',
              fontSize: 13,
              cursor: 'pointer',
              fontWeight: 600
            }}
            title="Kartenansicht"
          >
            🗺️
          </button>
        </div>
      </div>

      {/* Results */}
      {viewMode === 'table' && (
        <div style={{ marginTop: 20, overflowX: 'auto' }}>
          {rows.length === 0 ? (
            <div style={{ color: '#9db', padding: 20, textAlign: 'center' }}>Keine offenen Matches gefunden.</div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
              <thead>
                <tr style={{ borderBottom: '2px solid #2f6b57' }}>
                  <th style={{ textAlign: 'left', padding: '12px 8px', color: '#debc7c', fontWeight: 700 }}>Sport</th>
                  <th style={{ textAlign: 'left', padding: '12px 8px', color: '#debc7c', fontWeight: 700 }}>Level</th>
                  <th style={{ textAlign: 'left', padding: '12px 8px', color: '#debc7c', fontWeight: 700 }}>Spieler</th>
                  <th style={{ textAlign: 'left', padding: '12px 8px', color: '#debc7c', fontWeight: 700 }}>Ort</th>
                  <th style={{ textAlign: 'left', padding: '12px 8px', color: '#debc7c', fontWeight: 700 }}>Zeit</th>
                  <th style={{ textAlign: 'left', padding: '12px 8px', color: '#debc7c', fontWeight: 700 }}>Status</th>
                  <th style={{ textAlign: 'right', padding: '12px 8px', color: '#debc7c', fontWeight: 700 }}>Aktion</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(m => {
                  const aName = m.home || m.home_name || 'A';
                  const bName = m.away || m.away_name || 'Gegner gesucht';
                  const status = (m.status || 'Ausstehend');
                  
                  let dateText = 'Datum: offen';
                  if (m.when_type === 'range' && m.range_days) {
                    dateText = `In ${m.range_days} Tag${m.range_days !== 1 ? 'en' : ''}`;
                  } else if (m.when_type === 'fixed' && m.kickoff_at && m.kickoff_end_at) {
                    try {
                      const start = new Date(m.kickoff_at);
                      const end = new Date(m.kickoff_end_at);
                      const dateStr = start.toLocaleDateString('de-DE', { day: 'numeric', month: 'numeric' });
                      const startTime = start.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
                      const endTime = end.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
                      dateText = `${dateStr}, ${startTime}-${endTime}`;
                    } catch (e) {
                      dateText = 'Zeitraum: offen';
                    }
                  } else if (m.when_type === 'exact' && m.kickoff_at) {
                    try {
                      const date = new Date(m.kickoff_at);
                      const dateStr = date.toLocaleDateString('de-DE', { day: 'numeric', month: 'numeric' });
                      const time = date.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
                      dateText = `${dateStr}, ${time}`;
                    } catch (e) {
                      dateText = 'Datum: offen';
                    }
                  } else if (m.kickoff_at) {
                    try {
                      const date = new Date(m.kickoff_at);
                      const dateStr = date.toLocaleDateString('de-DE', { day: 'numeric', month: 'numeric' });
                      const time = date.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
                      dateText = `${dateStr}, ${time}`;
                    } catch (e) {
                      dateText = 'Datum: offen';
                    }
                  }
                  
                  return (
                    <tr key={m.id} style={{ borderBottom: '1px solid rgba(47,107,87,0.3)', transition: 'background 0.2s' }} 
                        onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(47,107,87,0.15)'}
                        onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}>
                      <td style={{ padding: '12px 8px' }}>
                        <div style={{ fontWeight: 600 }}>{m.league || 'Open Match'}</div>
                        <div style={{ fontSize: 12, color: '#8bbfad' }}>{m.sport_name || 'Sport'}</div>
                      </td>
                      <td style={{ padding: '12px 8px' }}>
                        <span style={{ 
                          background: m.type === 'Pro' ? '#debc7c' : m.type === 'Experienced' ? '#7fc' : '#9db', 
                          color: '#081c19', 
                          padding: '4px 8px', 
                          borderRadius: 6, 
                          fontSize: 11, 
                          fontWeight: 700 
                        }}>
                          {m.type || 'Offen'}
                        </span>
                      </td>
                      <td style={{ padding: '12px 8px' }}>
                        <div style={{ fontWeight: 600 }}>{aName}</div>
                        {bName !== 'Gegner gesucht' && <div style={{ fontSize: 12, color: '#8bbfad' }}>vs {bName}</div>}
                      </td>
                      <td style={{ padding: '12px 8px' }}>
                        <div>{m.location_name || m.city_name || '-'}</div>
                        <div style={{ fontSize: 11, color: '#8bbfad' }}>{m.city_name || ''}</div>
                      </td>
                      <td style={{ padding: '12px 8px', fontSize: 13 }}>{dateText}</td>
                      <td style={{ padding: '12px 8px' }}>
                        <span style={{ 
                          color: status === 'open' ? '#7fc' : status === 'scheduled' ? '#debc7c' : '#9db',
                          fontSize: 12,
                          fontWeight: 600
                        }}>
                          {status === 'open' ? '🟢 Offen' : status === 'scheduled' ? '📅 Geplant' : status}
                        </span>
                      </td>
                      <td style={{ padding: '12px 8px', textAlign: 'right' }}>
                        <Link 
                          to={`/matches/${m.id}`} 
                          style={{ 
                            background: '#debc7c', 
                            color: '#10261f', 
                            padding: '6px 12px', 
                            borderRadius: 8, 
                            fontSize: 12, 
                            fontWeight: 700,
                            textDecoration: 'none',
                            display: 'inline-block'
                          }}
                        >
                          Details
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      )}

      {viewMode === 'cards' && (
      <div style={{ display: 'grid', gap: 10, marginTop: 20 }}>
        {rows.length === 0 ? (
          <div style={{ color: '#9db' }}>Keine offenen Matches gefunden.</div>
        ) : rows.map(m => {
          const aName = m.home || m.home_name || 'A';
          const bName = m.away || m.away_name || 'Gegner gesucht';
          const status = (m.status || 'Ausstehend');
          
          // Format date based on when_type
          let dateText = 'Datum: offen';
          
          if (m.when_type === 'range' && m.range_days) {
            dateText = `In den nächsten ${m.range_days} Tag${m.range_days !== 1 ? 'en' : ''}`;
          } else if (m.when_type === 'fixed' && m.kickoff_at && m.kickoff_end_at) {
            try {
              const start = new Date(m.kickoff_at);
              const end = new Date(m.kickoff_end_at);
              const dayName = start.toLocaleDateString('de-DE', { weekday: 'long' });
              const dateStr = start.toLocaleDateString('de-DE', { day: 'numeric', month: 'numeric', year: '2-digit' });
              const startTime = start.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
              const endTime = end.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
              dateText = `am ${dayName} ${dateStr}, zwischen ${startTime}-${endTime} Uhr`;
            } catch (e) {
              dateText = 'Zeitraum: offen';
            }
          } else if (m.when_type === 'exact' && m.kickoff_at) {
            try {
              const date = new Date(m.kickoff_at);
              const dayName = date.toLocaleDateString('de-DE', { weekday: 'long' });
              const dateStr = date.toLocaleDateString('de-DE', { day: 'numeric', month: 'numeric', year: '2-digit' });
              const time = date.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
              dateText = `am ${dayName} ${dateStr}, um ${time} Uhr`;
            } catch (e) {
              dateText = 'Datum: offen';
            }
          } else if (m.kickoff_at) {
            try {
              const date = new Date(m.kickoff_at);
              const dayName = date.toLocaleDateString('de-DE', { weekday: 'long' });
              const dateStr = date.toLocaleDateString('de-DE', { day: 'numeric', month: 'numeric', year: '2-digit' });
              const time = date.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
              dateText = `am ${dayName} ${dateStr}, um ${time} Uhr`;
            } catch (e) {
              dateText = 'Datum: offen';
            }
          }
          
          return (
            <div key={m.id} className="ml-card" style={{ display: 'grid', gap: 10 }}>
              {/* Header row: league/sport, level and status */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', alignItems: 'center' }}>
                <div style={{ fontWeight: 700 }}>
                  {m.league || 'Open Match'}
                  {m.sport ? <span style={{ color: '#9db' }}> · {m.sport}</span> : null}
                  {m.player_level ? <span style={{ color: '#debc7c', fontWeight: 600 }}> · {m.player_level}</span> : null}
                  {m.player_level ? <span style={{ color: '#debc7c', fontWeight: 600 }}> · {m.player_level}</span> : null}
                </div>
                <div className="ml-chip"><span className="ml-status-dot" /> {status}</div>
              </div>

              {/* VS layout */}
              <div className="ml-match">
                {/* Left side */}
                <div className="ml-match__side">
                  <Avatar userId={m.home_id} name={aName} size={64} />
                  <div>
                    <div style={{ fontWeight: 700 }}>{aName}</div>
                    <div style={{ color: '#9db', fontSize: 12 }}>—</div>
                  </div>
                </div>

                {/* VS */}
                <div style={{ textAlign: 'center' }}><div className="ml-vs">VS</div></div>

                {/* Right side */}
                <div className="ml-match__side" style={{ justifyContent: 'end' }}>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontWeight: 700 }}>{bName}</div>
                    <div style={{ color: '#9db', fontSize: 12 }}>—</div>
                  </div>
                  <Avatar userId={m.away_id} name={bName} size={64} />
                </div>
              </div>

              {/* Footer: date + location + details */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', alignItems: 'center', gap: 10 }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <div style={{ color: '#9db', fontSize: 12 }}>{dateText}</div>
                  <div style={{ color: '#9db', fontSize: 12 }}>{[m.city, m.state, m.country].filter(Boolean).join(' · ')}</div>
                </div>
                <div>
                  <Link to={`/matches/${m.id}`} className="ml-btn-secondary">Details</Link>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      )}

      {viewMode === 'map' && (
        <div style={{ marginTop: 20 }}>
          <div style={{ 
            background: 'linear-gradient(135deg, #0f2b27 0%, #1a3c33 100%)', 
            borderRadius: 12, 
            padding: '60px 20px', 
            textAlign: 'center',
            border: '1px solid #2f6b57'
          }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>🗺️</div>
            <h3 style={{ margin: '0 0 12px 0', color: '#debc7c' }}>Kartenansicht</h3>
            <p style={{ color: '#8bbfad', margin: 0, maxWidth: 400, marginLeft: 'auto', marginRight: 'auto' }}>
              Die Kartenansicht zeigt alle verfügbaren Matches auf einer interaktiven Karte mit ihren Standorten.
            </p>
            <p style={{ color: '#9db', fontSize: 13, marginTop: 16 }}>
              🚧 In Entwicklung - Verfügbar in einer kommenden Version
            </p>
          </div>
        </div>
      )}

      {/* Centered secondary create button as in mock */}
      <div style={{ marginTop: 18, display: 'flex', justifyContent: 'center' }}>
        <button onClick={openCreate} disabled={!authed} style={{ 
          padding: '12px 18px', 
          background: '#dEBC7C', 
          color: '#10261f', 
          borderRadius: '10px', 
          border: 'none', 
          cursor: !authed ? 'not-allowed' : 'pointer', 
          fontWeight: 700,
          opacity: !authed ? 0.6 : 1
        }}>Eigenes Match eröffnen</button>
      </div>

      {/* Create Match Modal */}
      {showCreate && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', zIndex: 1000, padding: '16px', overflowY: 'auto' }} onClick={closeCreate}>
          <div className="ml-card" style={{ width: '100%', maxWidth: 600, maxHeight: 'calc(100vh - 32px)', overflowY: 'auto', marginTop: 'auto', marginBottom: 'auto', scrollbarWidth: 'none', msOverflowStyle: 'none' }} onClick={(e) => e.stopPropagation()}>
            {/* Header */}
            <div style={{ marginBottom: 20, paddingBottom: 16, borderBottom: '1px solid #1a3c33' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: 6 }}>
                <h2 style={{ margin: 0, fontSize: 22, fontWeight: 700 }}>Öffentliches Match erstellen</h2>
                <button 
                  onClick={closeCreate}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: '#e8efe8',
                    fontSize: 28,
                    cursor: 'pointer',
                    padding: 0,
                    lineHeight: 1,
                    marginTop: -4
                  }}
                >×</button>
              </div>
              <p style={{ margin: 0, color: '#9db', fontSize: 14, lineHeight: 1.4 }}>
                Erstelle ein öffentliches Match, das andere Spieler finden und beitreten können.
              </p>
            </div>

            <div style={{ display: 'grid', gap: 20 }}>
              {/* 1. Sport und Ort */}
              <div style={{ display: 'grid', gap: 10 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ 
                    width: 28, 
                    height: 28, 
                    borderRadius: '50%', 
                    background: cmSportId && cmCityId ? '#4a9d7f' : '#debc7c', 
                    color: '#10261f',
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'center', 
                    fontWeight: 700,
                    fontSize: 14,
                    transition: 'all 0.3s'
                  }}>1</div>
                  <span style={{ fontWeight: 700, fontSize: 16, color: '#debc7c' }}>Sport und Ort</span>
                </div>
                
                <div style={{ display: 'grid', gap: 10, marginLeft: 36 }}>
                  <SportSelector
                    sports={sportCategories}
                    value={cmSportId ? (sports.find(s => String(s.id) === String(cmSportId))?.name || '') : ''}
                    onChange={(sportName, sportIdVal) => setCmSportId(sportIdVal)}
                    placeholder="🏃 Sportart wählen"
                  />
                  
                  <LocationSelector
                    cities={cities}
                    countries={window.__countriesData || []}
                    states={window.__statesData || []}
                    value={cmCityId ? (cities.find(c => String(c.id) === String(cmCityId))?.name || '') : ''}
                    onChange={(cityName, cityId) => {
                      setCmCityId(cityId);
                      const selectedCity = cities.find(c => String(c.id) === String(cityId));
                      if (selectedCity) {
                        setCmCountryId(selectedCity.countryId || '');
                        setCmStateId(selectedCity.stateId || '');
                      }
                      // Load locations for this city and sport
                      if (cityId && cmSportId) {
                        loadAvailableLocations(cmSportId, cityId);
                      }
                    }}
                    placeholder="Stadt wählen"
                  />
                  
                  {/* Location Selection */}
                  {cmSportId && cmCityId && availableLocations.length > 0 && (
                    <div style={{ marginTop: 4 }}>
                      <label style={{ display: 'block', fontSize: 12, color: '#9db', marginBottom: 6, fontWeight: 600 }}>
                        🏟️ Platz buchen (optional)
                      </label>
                      <select
                        value={cmLocationId}
                        onChange={(e) => setCmLocationId(e.target.value)}
                        style={{
                          width: '100%',
                          padding: '10px 12px',
                          borderRadius: 8,
                          border: '2px solid #2f6b57',
                          background: '#0e2a22',
                          color: '#e8efe8',
                          fontSize: 14,
                          cursor: 'pointer'
                        }}
                      >
                        <option value="">Kein Platz ausgewählt</option>
                        {availableLocations.map(loc => (
                          <option key={loc.id} value={loc.id}>
                            {loc.name} {loc.hourly_rate ? `(${loc.hourly_rate}€/h)` : ''}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>
              </div>

              {/* 2. Level */}
              <div style={{ display: 'grid', gap: 10 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ 
                    width: 28, 
                    height: 28, 
                    borderRadius: '50%', 
                    background: cmType ? '#4a9d7f' : '#debc7c', 
                    color: '#10261f',
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'center', 
                    fontWeight: 700,
                    fontSize: 14,
                    transition: 'all 0.3s'
                  }}>2</div>
                  <span style={{ fontWeight: 700, fontSize: 16, color: '#debc7c' }}>Level</span>
                </div>
                
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginLeft: 36, opacity: step1Complete ? 1 : 0.5 }}>
                  {['Starter','Experienced','Pro'].map(t => (
                    <button
                      key={t}
                      type="button"
                      onClick={()=> step1Complete && setCmType(t)}
                      disabled={!step1Complete}
                      style={{ 
                        padding: '12px 10px', 
                        borderRadius: 8, 
                        border: cmType===t ? '2px solid #debc7c' : '2px solid #2f6b57', 
                        background: cmType===t ? '#1a3c33' : '#0e2a22',
                        color: cmType===t ? '#debc7c' : '#e8efe8',
                        cursor: step1Complete ? 'pointer' : 'not-allowed',
                        fontWeight: 600,
                        fontSize: 13,
                        transition: 'all 0.2s'
                      }}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>

              {/* 3. Gewünschter Zeitpunkt */}
              <div style={{ display: 'grid', gap: 10 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ 
                    width: 28, 
                    height: 28, 
                    borderRadius: '50%', 
                    background: cmWhenType ? '#4a9d7f' : '#debc7c', 
                    color: '#10261f',
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'center', 
                    fontWeight: 700,
                    fontSize: 14,
                    transition: 'all 0.3s'
                  }}>3</div>
                  <span style={{ fontWeight: 700, fontSize: 16, color: '#debc7c' }}>Gewünschter Zeitpunkt</span>
                </div>
                
                {/* Wann-Typ Auswahl */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginLeft: 36, opacity: step2Complete ? 1 : 0.5 }}>
                  <button 
                    type="button"
                    onClick={() => step2Complete && setCmWhenType('exact')}
                    disabled={!step2Complete}
                    style={{
                      padding: '14px 8px',
                      borderRadius: 10,
                      border: cmWhenType === 'exact' ? '2px solid #debc7c' : '2px solid #2f6b57',
                      background: cmWhenType === 'exact' ? '#1a3c33' : '#0e2a22',
                      color: cmWhenType === 'exact' ? '#debc7c' : '#e8efe8',
                      cursor: step2Complete ? 'pointer' : 'not-allowed',
                      fontWeight: 600,
                      fontSize: 13,
                      textAlign: 'center',
                      transition: 'all 0.2s',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 4
                    }}
                  >
                    <div style={{ fontSize: 20 }}>📅</div>
                    <div>Fester Tag</div>
                  </button>
                  <button 
                    type="button"
                    onClick={() => step2Complete && setCmWhenType('range')}
                    disabled={!step2Complete}
                    style={{
                      padding: '14px 8px',
                      borderRadius: 10,
                      border: cmWhenType === 'range' ? '2px solid #debc7c' : '2px solid #2f6b57',
                      background: cmWhenType === 'range' ? '#1a3c33' : '#0e2a22',
                      color: cmWhenType === 'range' ? '#debc7c' : '#e8efe8',
                      cursor: step2Complete ? 'pointer' : 'not-allowed',
                      fontWeight: 600,
                      fontSize: 13,
                      textAlign: 'center',
                      transition: 'all 0.2s',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 4
                    }}
                  >
                    <div style={{ fontSize: 20 }}>📆</div>
                    <div>Zeitraum</div>
                  </button>
                  <button 
                    type="button"
                    onClick={() => step2Complete && setCmWhenType('timewindow')}
                    disabled={!step2Complete}
                    style={{
                      padding: '14px 8px',
                      borderRadius: 10,
                      border: cmWhenType === 'timewindow' ? '2px solid #debc7c' : '2px solid #2f6b57',
                      background: cmWhenType === 'timewindow' ? '#1a3c33' : '#0e2a22',
                      color: cmWhenType === 'timewindow' ? '#debc7c' : '#e8efe8',
                      cursor: step2Complete ? 'pointer' : 'not-allowed',
                      fontWeight: 600,
                      fontSize: 13,
                      textAlign: 'center',
                      transition: 'all 0.2s',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 4
                    }}
                  >
                    <div style={{ fontSize: 20 }}>🗓️</div>
                    <div>Zeitfenster</div>
                  </button>
                </div>

                {/* Option 1: Fester Tag (nur Datum) */}
                {cmWhenType === 'exact' && (
                  <div style={{ marginLeft: 36, padding: 14, background: 'rgba(26, 60, 51, 0.3)', borderRadius: 10, border: '1px solid #2f6b57' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: 12, color: '#9db', marginBottom: 6, fontWeight: 600 }}>Datum</label>
                      <input 
                        type="date" 
                        value={cmExactDate} 
                        onChange={(e) => setCmExactDate(e.target.value)}
                        min={new Date().toISOString().split('T')[0]}
                        style={{ padding: '10px 12px', borderRadius: 8, border: '2px solid #2f6b57', background: '#0e2a22', color: '#e8efe8', fontSize: 14, width: '100%' }} 
                      />
                    </div>
                  </div>
                )}

                {/* Option 2: Zeitraum */}
                {cmWhenType === 'range' && (
                  <div style={{ marginLeft: 36, padding: 14, background: 'rgba(26, 60, 51, 0.3)', borderRadius: 10, border: '1px solid #2f6b57' }}>
                    <div style={{ fontSize: 12, color: '#9db', marginBottom: 10, fontWeight: 600 }}>In den nächsten:</div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
                      {[
                        { label: '3 Tage', days: 3 },
                        { label: '7 Tage', days: 7 },
                        { label: '14 Tage', days: 14 },
                      ].map(opt => (
                        <button
                          key={opt.days}
                          type="button"
                          onClick={() => setCmRangeDays(opt.days)}
                          style={{
                            padding: '10px 8px',
                            borderRadius: 8,
                            border: cmRangeDays === opt.days ? '2px solid #debc7c' : '2px solid #2f6b57',
                            background: cmRangeDays === opt.days ? '#1a3c33' : '#0e2a22',
                            color: cmRangeDays === opt.days ? '#debc7c' : '#e8efe8',
                            cursor: 'pointer',
                            fontSize: 13,
                            fontWeight: 600,
                            transition: 'all 0.2s'
                          }}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Option 3: Zeitfenster mit optionaler Uhrzeit */}
                {cmWhenType === 'timewindow' && (
                  <div style={{ marginLeft: 36, padding: 14, background: 'rgba(26, 60, 51, 0.3)', borderRadius: 10, border: '1px solid #2f6b57' }}>
                    <div style={{ display: 'grid', gap: 10 }}>
                      <div>
                        <label style={{ display: 'block', fontSize: 12, color: '#9db', marginBottom: 6, fontWeight: 600 }}>Von (Start-Datum)</label>
                        <input 
                          type="date" 
                          value={cmTimeWindowStart} 
                          onChange={(e) => {
                            const next = e.target.value;
                            setCmTimeWindowStart(next);
                            if (cmTimeWindowEnd) {
                              const maxAllowed = addDaysIso(next, 13);
                              const clampedEnd = next && cmTimeWindowEnd > maxAllowed ? maxAllowed : cmTimeWindowEnd;
                              setCmTimeWindowEnd(clampedEnd);
                            }
                          }}
                          min={new Date().toISOString().split('T')[0]}
                          max={cmTimeWindowEnd ? cmTimeWindowEnd : undefined}
                          style={{ padding: '10px 12px', borderRadius: 8, border: '2px solid #2f6b57', background: '#0e2a22', color: '#e8efe8', fontSize: 14, width: '100%' }} 
                        />
                      </div>
                      <div>
                        <label style={{ display: 'block', fontSize: 12, color: '#9db', marginBottom: 6, fontWeight: 600 }}>Bis (End-Datum)</label>
                        <input 
                          type="date" 
                          value={cmTimeWindowEnd} 
                          onChange={(e) => {
                            const next = e.target.value;
                            const maxAllowed = addDaysIso(cmTimeWindowStart, 13);
                            const clamped = cmTimeWindowStart ? (next > maxAllowed ? maxAllowed : next) : next;
                            setCmTimeWindowEnd(clamped);
                          }}
                          min={cmTimeWindowStart || new Date().toISOString().split('T')[0]}
                          max={cmTimeWindowStart ? addDaysIso(cmTimeWindowStart, 13) : undefined}
                          style={{ padding: '10px 12px', borderRadius: 8, border: '2px solid #2f6b57', background: '#0e2a22', color: '#e8efe8', fontSize: 14, width: '100%' }} 
                        />
                      </div>
                      
                      {/* Time preference */}
                      <div style={{ marginTop: 8 }}>
                        <label style={{ display: 'block', fontSize: 12, color: '#9db', marginBottom: 6, fontWeight: 600 }}>Bevorzugte Zeit (optional)</label>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 10 }}>
                          <button
                            type="button"
                            onClick={() => setCmTimeMode('specific')}
                            style={{
                              padding: '8px',
                              borderRadius: 8,
                              border: cmTimeMode === 'specific' ? '2px solid #debc7c' : '2px solid #2f6b57',
                              background: cmTimeMode === 'specific' ? '#1a3c33' : '#0e2a22',
                              color: cmTimeMode === 'specific' ? '#debc7c' : '#e8efe8',
                              cursor: 'pointer',
                              fontSize: 12,
                              fontWeight: 600
                            }}
                          >
                            Konkrete Zeit
                          </button>
                          <button
                            type="button"
                            onClick={() => setCmTimeMode('timeofday')}
                            style={{
                              padding: '8px',
                              borderRadius: 8,
                              border: cmTimeMode === 'timeofday' ? '2px solid #debc7c' : '2px solid #2f6b57',
                              background: cmTimeMode === 'timeofday' ? '#1a3c33' : '#0e2a22',
                              color: cmTimeMode === 'timeofday' ? '#debc7c' : '#e8efe8',
                              cursor: 'pointer',
                              fontSize: 12,
                              fontWeight: 600
                            }}
                          >
                            Tageszeit
                          </button>
                        </div>
                        
                        {cmTimeMode === 'specific' ? (
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                            <div>
                              <label style={{ display: 'block', fontSize: 11, color: '#9db', marginBottom: 4 }}>Von</label>
                              <input 
                                type="time" 
                                value={cmTimeFrom} 
                                onChange={(e) => setCmTimeFrom(e.target.value)}
                                style={{ padding: '8px 10px', borderRadius: 8, border: '2px solid #2f6b57', background: '#0e2a22', color: '#e8efe8', fontSize: 13, width: '100%' }} 
                              />
                            </div>
                            <div>
                              <label style={{ display: 'block', fontSize: 11, color: '#9db', marginBottom: 4 }}>Bis</label>
                              <input 
                                type="time" 
                                value={cmTimeTo} 
                                onChange={(e) => setCmTimeTo(e.target.value)}
                                style={{ padding: '8px 10px', borderRadius: 8, border: '2px solid #2f6b57', background: '#0e2a22', color: '#e8efe8', fontSize: 13, width: '100%' }} 
                              />
                            </div>
                          </div>
                        ) : (
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6 }}>
                            {[
                              { value: 'morning', label: '🌅 Morgens', time: '6-12' },
                              { value: 'afternoon', label: '☀️ Mittags', time: '12-18' },
                              { value: 'evening', label: '🌙 Abends', time: '18-22' }
                            ].map(tod => (
                              <button
                                key={tod.value}
                                type="button"
                                onClick={() => setCmTimeOfDay(tod.value)}
                                style={{
                                  padding: '8px 6px',
                                  borderRadius: 8,
                                  border: cmTimeOfDay === tod.value ? '2px solid #debc7c' : '2px solid #2f6b57',
                                  background: cmTimeOfDay === tod.value ? '#1a3c33' : '#0e2a22',
                                  color: cmTimeOfDay === tod.value ? '#debc7c' : '#e8efe8',
                                  cursor: 'pointer',
                                  fontSize: 11,
                                  fontWeight: 600,
                                  display: 'flex',
                                  flexDirection: 'column',
                                  gap: 2,
                                  textAlign: 'center'
                                }}
                              >
                                <div>{tod.label}</div>
                                <div style={{ fontSize: 9, opacity: 0.7 }}>{tod.time}h</div>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* 4. Spiellänge festlegen */}
              <div style={{ display: 'grid', gap: 10 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ 
                    width: 28, 
                    height: 28, 
                    borderRadius: '50%', 
                    background: step4Complete ? '#4a9d7f' : '#debc7c', 
                    color: '#10261f',
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'center', 
                    fontWeight: 700,
                    fontSize: 14,
                    transition: 'all 0.3s'
                  }}>4</div>
                  <span style={{ fontWeight: 700, fontSize: 16, color: '#debc7c' }}>Spiellänge</span>
                </div>
                
                <div style={{ marginLeft: 36, padding: 14, background: 'rgba(26, 60, 51, 0.3)', borderRadius: 10, border: '1px solid #2f6b57', opacity: step4Complete ? 1 : 0.8 }}>
                  {/* Slot-Dauer als eigener Punkt */}
                  <div style={{ marginBottom: 0 }}>
                    <label style={{ display: 'block', fontSize: 12, color: '#9db', marginBottom: 6, fontWeight: 600 }}>
                      Spiellänge (gilt für das gesamte Match)
                    </label>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, width: '100%', maxWidth: 320, margin: '0 auto' }}>
                      <button
                        type="button"
                        onClick={() => setCmSlotDuration(Math.max(15, cmSlotDuration - 15))}
                        style={{
                          width: 44,
                          height: 44,
                          borderRadius: 10,
                          border: '2px solid #2f6b57',
                          background: '#0e2a22',
                          color: '#e8efe8',
                          fontWeight: 800,
                          fontSize: 18,
                          cursor: 'pointer'
                        }}
                        aria-label="Slotdauer verkürzen"
                      >
                        −
                      </button>
                      <div style={{
                        flex: 1,
                        padding: '12px 14px',
                        borderRadius: 10,
                        border: '2px solid #2f6b57',
                        background: '#0e2a22',
                        color: '#debc7c',
                        textAlign: 'center',
                        fontWeight: 700,
                        fontSize: 18
                      }}>
                        {formatDuration(cmSlotDuration)}
                      </div>
                      <button
                        type="button"
                        onClick={() => setCmSlotDuration(Math.min(240, cmSlotDuration + 15))}
                        style={{
                          width: 44,
                          height: 44,
                          borderRadius: 10,
                          border: '2px solid #2f6b57',
                          background: '#0e2a22',
                          color: '#e8efe8',
                          fontWeight: 800,
                          fontSize: 18,
                          cursor: 'pointer'
                        }}
                        aria-label="Slotdauer verlängern"
                      >
                        +
                      </button>
                    </div>
                    <div style={{ marginTop: 6, fontSize: 12, color: '#9db', textAlign: 'center' }}>Gilt für alle Verfügbarkeiten dieses Matches.</div>
                  </div>
                </div>
              </div>

              {/* 5. Verfügbarkeiten eintragen */}
              <div style={{ display: 'grid', gap: 10 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ 
                    width: 28, 
                    height: 28, 
                    borderRadius: '50%', 
                    background: cmAvailability.length > 0 ? '#4a9d7f' : '#debc7c', 
                    color: '#10261f',
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'center', 
                    fontWeight: 700,
                    fontSize: 14,
                    transition: 'all 0.3s'
                  }}>5</div>
                  <span style={{ fontWeight: 700, fontSize: 16, color: '#debc7c' }}>Verfügbarkeiten eintragen</span>
                </div>

                <div style={{ marginLeft: 36, padding: 14, background: 'rgba(26, 60, 51, 0.3)', borderRadius: 10, border: '1px solid #2f6b57' }}>
                  <div style={{ display: 'grid', gap: 12 }}>
                    {/* Modus: Presets für alle Tage oder pro Tag */}
                    <div style={{ display: 'grid', gap: 8 }}>
                      <label style={{ fontSize: 12, color: '#9db', fontWeight: 600 }}>Konfiguration</label>
                      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                        <button
                          type="button"
                          onClick={() => {
                            setAvailabilityMode('preset');
                            setCmAvailability([]);
                            setCreateErr('');
                          }}
                          style={{
                            padding: '10px 12px',
                            borderRadius: 8,
                            border: availabilityMode === 'preset' ? '2px solid #debc7c' : '2px solid #2f6b57',
                            background: availabilityMode === 'preset' ? '#1a3c33' : '#0e2a22',
                            color: availabilityMode === 'preset' ? '#debc7c' : '#e8efe8',
                            fontWeight: 700,
                            cursor: 'pointer'
                          }}
                        >
                          Zeiträume für alle Tage
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setAvailabilityMode('per-day');
                            setCmAvailability([]);
                            setCreateErr('');
                          }}
                          style={{
                            padding: '10px 12px',
                            borderRadius: 8,
                            border: availabilityMode === 'per-day' ? '2px solid #debc7c' : '2px solid #2f6b57',
                            background: availabilityMode === 'per-day' ? '#1a3c33' : '#0e2a22',
                            color: availabilityMode === 'per-day' ? '#debc7c' : '#e8efe8',
                            fontWeight: 700,
                            cursor: 'pointer'
                          }}
                        >
                          Verfügbarkeit pro Tag
                        </button>
                      </div>
                    </div>

                    {availabilityMode === 'preset' && (
                      <div style={{ display: 'grid', gap: 10, padding: 12, borderRadius: 10, border: '1px solid #2f6b57', background: '#0e2a22' }}>
                        <div style={{ fontSize: 12, color: '#9db' }}>Wähle einen oder mehrere Zeiträume. Sie werden auf alle markierten Tage angewendet (ohne Überschneidungen).</div>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 8 }}>
                          {presetOptions.map(p => (
                            <button
                              key={p.key}
                              type="button"
                              onClick={() => setPresetSelections(prev => ({ ...prev, [p.key]: !prev[p.key] }))}
                              style={{
                                padding: '12px 10px',
                                borderRadius: 10,
                                border: presetSelections[p.key] ? '2px solid #debc7c' : '2px solid #2f6b57',
                                background: presetSelections[p.key] ? '#1a3c33' : '#0e2a22',
                                color: presetSelections[p.key] ? '#debc7c' : '#e8efe8',
                                fontWeight: 700,
                                cursor: 'pointer',
                                display: 'grid',
                                gap: 4,
                                textAlign: 'center'
                              }}
                            >
                              <span>{p.label}</span>
                              <span style={{ fontSize: 11, color: '#9db' }}>{p.start} – {p.end}</span>
                            </button>
                          ))}
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                          <button
                            type="button"
                            onClick={applyPresetsToAllDays}
                            style={{
                              background: '#debc7c',
                              color: '#10261f',
                              border: 'none',
                              padding: '10px 14px',
                              borderRadius: 10,
                              fontWeight: 800,
                              cursor: 'pointer',
                              fontSize: 13
                            }}
                          >
                            Auf alle markierten Tage anwenden
                          </button>
                        </div>
                      </div>
                    )}

                    {availabilityMode === 'per-day' && (
                      <div style={{ display: 'grid', gap: 8 }}>
                        {groupedSelectedDates.length === 0 ? (
                          <div style={{ fontSize: 12, color: '#9db' }}>Bitte oben einen Zeitraum wählen.</div>
                        ) : (
                          groupedSelectedDates.map(group => (
                            <div key={group.key} style={{ border: '1px solid #2f6b57', borderRadius: 10, padding: 8, background: 'rgba(26,60,51,0.2)' }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                                <span style={{ color: '#debc7c', fontWeight: 700, fontSize: 14 }}>KW {group.weekNumber}</span>
                                <span style={{ color: '#9db', fontSize: 11 }}>{new Date(group.weekStart).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' })} - {new Date(group.weekEnd).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' })}</span>
                              </div>
                              <div style={{ display: 'grid', gap: 8 }}>
                                {group.days.map(ds => {
                                  const d = new Date(ds);
                                  const label = d.toLocaleDateString('de-DE', { weekday: 'short', day: '2-digit', month: '2-digit' });
                                  const ranges = tempTimesByDate[ds] || [createDefaultRange()];
                                  return (
                                    <div key={ds} style={{ border: '1px solid #2f6b57', borderRadius: 10, padding: 10, background: '#0e2a22', display: 'grid', gap: 8 }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                          <div style={{ color: '#e8efe8', fontWeight: 700 }}>{label}</div>
                                        </div>

                                      <div style={{ display: 'grid', gap: 6 }}>
                                        {ranges.map((range, idx) => {
                                          const handleUpdate = (key, value) => {
                                            const sanitized = snapToQuarter(value) || value;
                                            setTempTimesByDate(prev => {
                                              const rangesForDay = prev[ds] || [];
                                              const nextRanges = rangesForDay.map(r => r.id === range.id ? { ...r, [key]: sanitized } : r);
                                              const ok = updateDayAvailability(ds, nextRanges);
                                              if (!ok) return prev;
                                              return { ...prev, [ds]: nextRanges };
                                            });
                                          };
                                          return (
                                            <div key={range.id} style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(140px, 1fr)) auto', gap: 8, alignItems: 'center', opacity: step3Complete ? 1 : 0.5 }}>
                                              <div style={{ display: 'grid', gap: 4 }}>
                                                <label style={{ fontSize: 11, color: '#9db', fontWeight: 600 }}>Von</label>
                                                <input
                                                  type="time"
                                                  value={range.start}
                                                  onChange={(e) => handleUpdate('start', e.target.value)}
                                                  disabled={!step3Complete}
                                                  step={900}
                                                  style={{ padding: '9px 10px', borderRadius: 8, border: '2px solid #2f6b57', background: '#10261f', color: '#e8efe8', fontSize: 14 }}
                                                />
                                              </div>
                                              <div style={{ display: 'grid', gap: 4 }}>
                                                <label style={{ fontSize: 11, color: '#9db', fontWeight: 600 }}>Bis</label>
                                                <input
                                                  type="time"
                                                  value={range.end}
                                                  onChange={(e) => handleUpdate('end', e.target.value)}
                                                  disabled={!step3Complete}
                                                  step={900}
                                                  style={{ padding: '9px 10px', borderRadius: 8, border: '2px solid #2f6b57', background: '#10261f', color: '#e8efe8', fontSize: 14 }}
                                                />
                                              </div>
                                              <button
                                                type="button"
                                                onClick={() => setTempTimesByDate(prev => {
                                                  const rangesForDay = (prev[ds] || []).filter(r => r.id !== range.id);
                                                  const nextRanges = rangesForDay.length ? rangesForDay : [];
                                                  const ok = updateDayAvailability(ds, nextRanges);
                                                  if (!ok) return prev;
                                                  return { ...prev, [ds]: nextRanges };
                                                })}
                                                style={{
                                                  background: 'transparent',
                                                  border: '1px solid #2f6b57',
                                                  color: '#ff6b6b',
                                                  borderRadius: 8,
                                                  padding: '8px 10px',
                                                  cursor: 'pointer',
                                                  fontWeight: 700,
                                                  fontSize: 12
                                                }}
                                                aria-label="Zeile entfernen"
                                              >
                                                Zeile entfernen
                                              </button>
                                            </div>
                                          );
                                        })}

                                        <button
                                          type="button"
                                          onClick={() => {
                                            setTempTimesByDate(prev => {
                                              const rangesForDay = prev[ds] || [];
                                              const last = rangesForDay[rangesForDay.length - 1];
                                              const lastEndM = last ? parseTimeToMinutes(last.end) : null;
                                              const nextStart = lastEndM !== null ? minutesToTimeString(lastEndM) : '18:00';
                                              const nextEndM = lastEndM !== null ? Math.min(lastEndM + 120, 23 * 60 + 45) : (parseTimeToMinutes(nextStart) || 0) + 120;
                                              const nextEnd = minutesToTimeString(nextEndM);
                                              const nextRanges = [...rangesForDay, createDefaultRange(snapToQuarter(nextStart), snapToQuarter(nextEnd))];
                                              const ok = updateDayAvailability(ds, nextRanges);
                                              if (!ok) return prev;
                                              return { ...prev, [ds]: nextRanges };
                                            });
                                          }}
                                          style={{
                                            background: 'transparent',
                                            border: '1px dashed #2f6b57',
                                            color: '#debc7c',
                                            borderRadius: 8,
                                            padding: '9px 12px',
                                            cursor: 'pointer',
                                            fontWeight: 700,
                                            fontSize: 13,
                                            justifySelf: 'start'
                                          }}
                                        >
                                          + Neue Zeile
                                        </button>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    )}

                  </div>
                </div>
              </div>


              {/* Available Locations */}
              {cmSportId && cmCityId && cmWhen && (
                <div style={{ marginTop: 8 }}>
                  <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 12, color: '#debc7c' }}>
                    Verfügbare Plätze
                  </h3>

                  {loadingLocations && (
                    <div style={{ padding: 16, textAlign: 'center', color: '#9db', fontSize: 14 }}>
                      Suche verfügbare Plätze...
                    </div>
                  )}

                  {!loadingLocations && availableLocations.length === 0 && (
                    <div style={{ padding: 16, textAlign: 'center', color: '#9db', fontSize: 14 }}>
                      Keine freien Plätze für diese Auswahl verfügbar
                    </div>
                  )}

                  {!loadingLocations && availableLocations.length > 0 && (
                    <div style={{ display: 'grid', gap: 10 }}>
                      {availableLocations.map(loc => {
                        const photos = loc.photos ? (typeof loc.photos === 'string' ? JSON.parse(loc.photos) : loc.photos) : [];
                        const firstPhoto = photos.length > 0 ? photos[0] : null;
                        const priceText = loc.hourly_rate ? `${loc.hourly_rate}€/h` : 'Preis auf Anfrage';

                        return (
                          <div 
                            key={loc.id}
                            style={{
                              padding: 12,
                              border: '2px solid #2f6b57',
                              borderRadius: 10,
                              background: '#0b1e19',
                              display: 'flex',
                              gap: 12,
                              alignItems: 'center'
                            }}
                          >
                            {firstPhoto && (
                              <img 
                                src={firstPhoto} 
                                alt={loc.name}
                                style={{
                                  width: 50,
                                  height: 50,
                                  borderRadius: 8,
                                  objectFit: 'cover',
                                  border: '1px solid #2f6b57'
                                }}
                              />
                            )}
                            <div style={{ flex: 1 }}>
                              <div style={{ fontWeight: 700, fontSize: 14, color: '#e8efe8', marginBottom: 3 }}>
                                {loc.name}
                              </div>
                              {loc.address && (
                                <div style={{ fontSize: 12, color: '#9db', marginBottom: 4 }}>
                                  {loc.address}
                                </div>
                              )}
                              <div style={{ fontSize: 13, color: '#debc7c', fontWeight: 600 }}>
                                {loc.available_slots} {loc.available_slots === 1 ? 'freier Platz' : 'freie Plätze'} • {priceText}
                              </div>
                            </div>
                            <button
                              onClick={() => {
                                // TODO: Implement booking logic
                                alert(`Platz bei ${loc.name} buchen`);
                              }}
                              style={{
                                background: '#debc7c',
                                color: '#0e2a22',
                                border: 'none',
                                padding: '8px 16px',
                                borderRadius: 8,
                                fontWeight: 700,
                                cursor: 'pointer',
                                fontSize: 13,
                                whiteSpace: 'nowrap'
                              }}
                            >
                              Platz buchen
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* Error Message */}
              {createErr && (
                <div style={{ padding: 12, background: '#4a1a1a', border: '1px solid #8a2a2a', borderRadius: 10, color: '#ffa5a5', fontSize: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 18 }}>⚠️</span>
                  <span>{createErr}</span>
                </div>
              )}

              {/* Footer Buttons */}
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, paddingTop: 16, borderTop: '1px solid #1a3c33' }}>
                <button 
                  onClick={closeCreate} 
                  style={{ 
                    padding: '12px 20px', 
                    borderRadius: 10, 
                    border: '2px solid #2f6b57', 
                    background: 'transparent', 
                    color: '#e8efe8', 
                    cursor: 'pointer', 
                    fontWeight: 600,
                    fontSize: 14,
                    transition: 'all 0.2s'
                  }}
                >
                  Abbrechen
                </button>
                <button 
                  onClick={handleCreate} 
                  disabled={creating || !cmSportId || !cmCityId || !cmWhenType || !cmType || cmAvailability.length === 0} 
                  style={{ 
                    background: (!cmSportId || !cmCityId || !cmWhenType || !cmType || cmAvailability.length === 0) ? '#5a5a5a' : '#debc7c', 
                    color: (!cmSportId || !cmCityId || !cmWhenType || !cmType || cmAvailability.length === 0) ? '#9a9a9a' : '#10261f', 
                    padding: '12px 24px', 
                    borderRadius: 10, 
                    border: 'none', 
                    fontWeight: 700,
                    fontSize: 14,
                    cursor: creating || !cmSportId || !cmCityId || !cmWhenType || !cmType || cmAvailability.length === 0 ? 'not-allowed' : 'pointer',
                    transition: 'all 0.2s',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8
                  }}
                >
                  {creating && <span>⏳</span>}
                  <span>{creating ? 'Erstelle Match...' : 'Match erstellen'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}