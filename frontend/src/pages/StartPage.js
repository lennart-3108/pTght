import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { API_BASE, FEATURES, filterSportsCategories } from "../config";
import smallLogo from "../images/logo/matchleague_logo_4x4-removebg-preview.png";
import Avatar from "../components/Avatar";
import LocationSelector from "../components/LocationSelector";
import SportSelector from "../components/SportSelector";
import AuthNoticeBanner from "../components/AuthNoticeBanner";
import AdBanner from "../components/AdBanner";
import { useLanguage } from "../i18n";
import { formatPlayerName } from "../utils/nameFormat";

// load background images from sports folder and sort
function importAllBackgrounds(r) {
  return r.keys().map((k) => ({ key: k.replace(/^\.\//, ''), src: r(k) }));
}
// Use sports images for hero rotation
const MAX_HERO_BACKGROUNDS = 8;
const backgrounds = importAllBackgrounds(require.context("../images/sports", false, /\.(png|jpe?g|webp|svg)$/));
backgrounds.sort((a, b) => {
  const re = /^(\d+)-/;
  const ma = a.key.match(re);
  const mb = b.key.match(re);
  if (ma && mb) return Number(ma[1]) - Number(mb[1]);
  if (ma) return -1;
  if (mb) return 1;
  return a.key.localeCompare(b.key);
});
const heroBackgrounds = backgrounds.slice(0, MAX_HERO_BACKGROUNDS);

export default function StartPage() {
  const navigate = useNavigate();
  const { lang, t } = useLanguage();
  const uiLocale = lang === 'en' ? 'en-US' : 'de-DE';
  const [leagues, setLeagues] = useState([]);
  const [sports, setSports] = useState([]);
  const [cities, setCities] = useState([]);
  const [countries, setCountries] = useState([]);
  const [states, setStates] = useState([]);
  const [districts, setDistricts] = useState([]);
  const [citiesLoaded, setCitiesLoaded] = useState(false);
  const [selectedSport, setSelectedSport] = useState("");
  const [selectedSportName, setSelectedSportName] = useState("");
  const [selectedCity, setSelectedCity] = useState("");
  const [selectedCityName, setSelectedCityName] = useState("");
  const initialSearchMode = (FEATURES.SHOW_COMPETITIONS || FEATURES.SHOW_BOOKINGS) ? "" : "match";
  const [searchMode, setSearchMode] = useState(initialSearchMode);
  const [openMatches, setOpenMatches] = useState([]);
  const [searching, setSearching] = useState(false);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [gpsLoading, setGpsLoading] = useState(false);
  // dashboard state
  const [myLeagues, setMyLeagues] = useState([]);
  const [myGames, setMyGames] = useState({ upcoming: [], completed: [] });
  const [standings, setStandings] = useState({ leagueId: "", rows: [] });
  const [leagueMembers, setLeagueMembers] = useState([]);
  const [leagueGames, setLeagueGames] = useState({ upcoming: [], completed: [] });
  const [selectedMyLeagueId, setSelectedMyLeagueId] = useState("");
  // news feed state
  const [newsFilter, setNewsFilter] = useState('all'); // 'all' | 'matches' | 'friends'
  const [newsFeed, setNewsFeed] = useState([]);

  const [newsLoading, setNewsLoading] = useState(false);
  // current user id extraction from token for centering table
  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
  const myUserId = useMemo(() => {
    if (!token) return null;
    try {
      const parts = token.split(".");
      if (parts.length < 2) return null;
      const payload = JSON.parse(atob(parts[1]));
      return payload?.user?.id ?? payload?.userId ?? payload?.sub ?? payload?.id ?? null;
    } catch { return null; }
  }, [token]);
  // simple carousel state for backgrounds
  const [index, setIndex] = useState(0);
  // dropdown coordination state
  const [sportDropdownOpen, setSportDropdownOpen] = useState(false);
  const [locationDropdownOpen, setLocationDropdownOpen] = useState(false);

  // Helper: extract numeric user id for a game side (home/away)
  const toId = (g, side) => {
    if (!g) return null;
    const v = g?.[`${side}_id`] ?? g?.[`${side}Id`] ?? g?.[side];
    const m = String(v ?? '').match(/\d+/);
    return m ? m[0] : null;
  };

  const upcomingWithOpponent = useMemo(() => {
    const hasParticipant = (game, side) => {
      const id = game?.[`${side}_user_id`] ?? game?.[`${side}UserId`] ?? game?.[`${side}_id`] ?? game?.[`${side}Id`];
      const name = game?.[side];
      if (id != null) return true;
      if (typeof name === 'string') {
        const trimmed = name.trim();
        return trimmed !== '' && trimmed !== '?';
      }
      return false;
    };
    return (myGames.upcoming || []).filter((g) => {
      // Never show cancelled matches
      if (g.status === 'cancelled') return false;
      // Team matches with participants are always shown
      if (g.participants && g.participants.length > 0) return true;
      if (g.team_count >= 2) return true;
      // 1v1: require both sides
      return hasParticipant(g, 'home') && hasParticipant(g, 'away');
    });
  }, [myGames.upcoming]);

  // rotate backgrounds every 5s
  useEffect(() => {
    if (!heroBackgrounds.length) return;
    const t = setInterval(() => setIndex((i) => (i + 1) % heroBackgrounds.length), 5000);
    return () => clearInterval(t);
  }, []);

  const loadCitiesIfNeeded = useCallback(async () => {
    if (citiesLoaded || cities.length > 0) return;
    try {
      const res = await fetch(`${API_BASE}/cities/list?type=city&compact=1`);
      if (!res.ok) return;
      const list = await res.json();
      if (Array.isArray(list)) {
        setCities(list);
        setCitiesLoaded(true);
      }
    } catch {
      // ignore on purpose; selector still works with currently loaded values
    }
  }, [citiesLoaded, cities.length]);

  const loadDistrictsForCity = useCallback(async (cityId) => {
    const id = Number(cityId);
    if (!Number.isFinite(id) || id <= 0) return;
    const alreadyLoaded = districts.some((district) => Number(district.parentCityId || district.cityId) === id);
    if (alreadyLoaded) return;
    try {
      const res = await fetch(`${API_BASE}/districts/by-city/${id}`);
      if (!res.ok) return;
      const list = await res.json();
      if (!Array.isArray(list) || !list.length) return;
      setDistricts((prev) => {
        const existingIds = new Set(prev.map((d) => String(d.id)));
        const additions = list.filter((d) => !existingIds.has(String(d.id)));
        return additions.length ? [...prev, ...additions] : prev;
      });
    } catch {
      // ignore on purpose; city selection still works
    }
  }, [districts]);


  // Auto-detect location via GPS
  const detectLocation = async (shouldSet = () => true) => {
    if (!navigator.geolocation) {
      console.warn('[StartPage] Geolocation not supported');
      alert(t('start.geo.notSupported'));
      return;
    }

    setGpsLoading(true);
    try {
      const position = await new Promise((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 0 // Don't use cached position
        });
      });

      const { latitude, longitude } = position.coords;
      console.log('[StartPage] GPS coords:', { latitude, longitude });

      // Query backend for nearest city
      const response = await fetch(`${API_BASE}/locations/nearest?lat=${latitude}&lon=${longitude}`);
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.warn('[StartPage] Location API error:', errorData);
        alert(t('start.geo.fetchCityError'));
        return;
      }

      const data = await response.json();
      console.log('[StartPage] Nearest location:', data);

      if (data.city && data.city.id) {
        if (!shouldSet()) return false;
        setSelectedCity(String(data.city.id));
        setSelectedCityName(data.city.name);
        console.log(`[StartPage] Auto-set location: ${data.city.name}${data.state ? ', ' + data.state.name : ''}${data.country ? ', ' + data.country.name : ''}`);
        return true;
      }
      alert(t('start.geo.noCityFound'));
      return false;
    } catch (error) {
      console.warn('[StartPage] Location detection failed:', error);
      if (error.code === 1) {
        alert(t('start.geo.denied'));
      } else if (error.code === 2) {
        alert(t('start.geo.unavailable'));
      } else if (error.code === 3) {
        alert(t('start.geo.timeout'));
      } else {
        alert(error.message || t('start.geo.generic'));
      }
      return false;
    } finally {
      setGpsLoading(false);
    }
  };

  const applyProfileCity = async (shouldSet = () => true) => {
    try {
      const token = localStorage.getItem('token');
      if (!token) return false;
      const res = await fetch(`${API_BASE}/profile`, { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) return false;
      const data = await res.json();
      const profileCityId = data?.city_id || data?.cityId || data?.city?.id;
      if (!profileCityId) return false;
      if (!shouldSet()) return false;
      const cityObj = cities.find(c => String(c.id) === String(profileCityId));
      setSelectedCity(String(profileCityId));
      setSelectedCityName(cityObj?.name || data?.city?.name || selectedCityName || '');
      if (cityObj) {
        setSelectedCityName(cityObj.name);
      }
      return true;
    } catch (e) {
      console.warn('[StartPage] applyProfileCity failed', e);
      return false;
    }
  };

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    setErr("");
    const fetchJsonWithTimeout = async (url, { timeout = 6000, options = {}, fallback = [] } = {}) => {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeout);
      try {
        const res = await fetch(url, { ...options, signal: controller.signal });
        if (!res || !res.ok) return fallback;
        const ct = (res.headers && typeof res.headers.get === 'function') ? (res.headers.get('content-type') || '') : '';
        if (ct.includes('text/html')) return fallback;
        const data = await res.json().catch(() => fallback);
        return data ?? fallback;
      } catch {
        return fallback;
      } finally {
        clearTimeout(timer);
      }
    };

    Promise.all([
      fetchJsonWithTimeout(`${API_BASE}/leagues`, { fallback: [] }),
      fetchJsonWithTimeout(`${API_BASE}/sports/categories`, { fallback: [] }),
      fetchJsonWithTimeout(`${API_BASE}/countries/list?compact=1`, { fallback: [] }),
      fetchJsonWithTimeout(`${API_BASE}/counties/list?compact=1`, { fallback: [] }),
    ])
      .then(([ls, ss, co, sts]) => {
        if (!mounted) return;
        console.log('[StartPage] Data loaded:', { 
          leagues: ls?.length || 0, 
          sports: ss?.length || 0, 
          cities: 0,
          countries: co?.length || 0,
          states: sts?.length || 0,
          districts: 0
        });
        console.log('[StartPage] Sample state:', sts?.[0]);
        setLeagues(Array.isArray(ls) ? ls : []);
        setSports(filterSportsCategories(Array.isArray(ss) ? ss : []));
        setCities([]);
        const initialCountries = Array.isArray(co) ? co : [];
        setCountries(initialCountries);
        setStates(Array.isArray(sts) ? sts : []);
        setDistricts([]);
        // Fallback: if countries are empty (e.g., missing /api proxy on non-local host),
        // try talking directly to localhost:5001
        if (!initialCountries.length) {
          const fallbackBase = 'http://localhost:5001/api';
          // Avoid duplicate fetch if API_BASE already points to localhost
          const isAlreadyLocalhost = String(API_BASE).startsWith('http://localhost:5001');
          if (!isAlreadyLocalhost) {
            fetchJsonWithTimeout(`${fallbackBase}/countries/list`, { fallback: [] })
              .then(list => {
                if (!mounted) return;
                if (Array.isArray(list) && list.length) {
                  try { console.log('[StartPage] Using localhost API fallback for countries'); } catch {}
                  setCountries(list);
                }
              }).catch(() => {});
          }
        }



        // Auto-location priority: 1) GPS, 2) Profil-Stadt, 3) erste Liga-Stadt
        const token = localStorage.getItem('token');
        (async () => {
          let located = false;
          if (token) {
            located = await detectLocation(() => mounted);
            if (!located) {
              located = await applyProfileCity(() => mounted);
            }
          }

          let meLeagues = [];
          try {
            meLeagues = token
              ? await fetchJsonWithTimeout(`${API_BASE}/me/leagues`, {
                  options: { headers: { Authorization: `Bearer ${token}` } },
                  fallback: []
                })
              : [];
            if (!located) {
              const firstCity = (meLeagues || []).find(l => l.cityId)?.cityId;
              if (firstCity && mounted) {
                setSelectedCity(String(firstCity));
                const leagueWithCity = (meLeagues || []).find((l) => String(l.cityId) === String(firstCity));
                if (leagueWithCity?.city) setSelectedCityName(leagueWithCity.city);
              }
            }
            if (mounted) {
              setMyLeagues(Array.isArray(meLeagues) ? meLeagues : []);
            }
            const myGamesResp = token
              ? await fetchJsonWithTimeout(`${API_BASE}/me/games`, {
                  options: { headers: { Authorization: `Bearer ${token}` } },
                  fallback: { upcoming: [], completed: [] }
                })
              : { upcoming: [], completed: [] };
            if (mounted) {
              setMyGames({
                upcoming: Array.isArray(myGamesResp.upcoming) ? myGamesResp.upcoming : [],
                completed: Array.isArray(myGamesResp.completed) ? myGamesResp.completed : [],
              });
            }
            if ((meLeagues || []).length && mounted) {
              const lid = meLeagues[0].id || meLeagues[0].leagueId;
              setSelectedMyLeagueId(String(lid || ""));
              if (lid) {
                const [st, members, games] = await Promise.all([
                  fetchJsonWithTimeout(`${API_BASE}/leagues/${lid}/standings?format=table`, { fallback: [] }),
                  fetchJsonWithTimeout(`${API_BASE}/leagues/${lid}/members`, {
                    options: { headers: { Authorization: `Bearer ${token}` } },
                    fallback: []
                  }),
                  fetchJsonWithTimeout(`${API_BASE}/leagues/${lid}/games`, {
                    fallback: { upcoming: [], completed: [] }
                  })
                ]);
                if (mounted) {
                  setStandings({ leagueId: String(lid), rows: Array.isArray(st) ? st : [] });
                  setLeagueMembers(Array.isArray(members) ? members : []);
                  setLeagueGames({
                    upcoming: Array.isArray(games.upcoming) ? games.upcoming : [],
                    completed: Array.isArray(games.completed) ? games.completed : []
                  });
                }
              }
            }
          } catch {}
        })();
      })
      .catch(e => { if (mounted) setErr(e.message || t('start.loadError')); })
      .finally(() => { if (mounted) setLoading(false); });
    return () => { mounted = false; };
  }, []);

  // Load news feed
  const loadNewsFeed = async (filter = 'all') => {
    setNewsLoading(true);
    try {
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      const res = await fetch(`${API_BASE}/news/feed?filter=${filter}&days=7&limit=3`, { headers });
      if (!res.ok) throw new Error('Failed to load news feed');
      const data = await res.json();
      setNewsFeed(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('[StartPage] News feed error:', err);
      setNewsFeed([]);
    } finally {
      setNewsLoading(false);
    }
  };



  // Update news feed when filter changes
  useEffect(() => {
    loadNewsFeed(newsFilter);
  }, [newsFilter]);

  // Create feed data from my games and leagues (like UserDetailPage)
  const feedData = useMemo(() => {
    const friendFeed = (myGames.completed || []).slice(0, 5).map((game) => {
      const homeScore = game.home_score != null ? game.home_score : '?';
      const awayScore = game.away_score != null ? game.away_score : '?';
      return {
        id: `match-${game.id}`,
        title: `Match: ${game.home} vs ${game.away}`,
        description: `Ergebnis: ${homeScore}:${awayScore} • ${game.league || 'Liga'}`,
        timestamp: game.kickoff_at || null,
        type: 'match',
        feedType: 'friends',
        matchId: game.id
      };
    });

    const teamFeed = (myLeagues || []).map((league) => ({
      id: `league-${league.id || league.leagueId}`,
      title: league.name || 'Liga',
      description: league.city || league.sport || 'Liga-Mitglied',
      timestamp: league.joined_at || null,
      type: 'league',
      feedType: 'team',
      leagueId: league.id || league.leagueId
    }));

    const publicFeed = (upcomingWithOpponent || []).slice(0, 5).map((game) => ({
      id: `upcoming-${game.id}`,
      title: `Anstehendes Match: ${game.home} vs ${game.away}`,
      description: `${game.kickoff_at ? new Date(game.kickoff_at).toLocaleString(uiLocale, { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : (lang === 'en' ? 'Time tbd' : 'Termin tbd')} • ${game.league || 'Match'}`,
      timestamp: game.kickoff_at || null,
      type: 'match',
      feedType: 'public',
      matchId: game.id
    }));

    return {
      friends: friendFeed,
      team: teamFeed,
      public: publicFeed
    };
  }, [myGames.completed, myLeagues, upcomingWithOpponent]);

  if (loading) return <div style={{ padding: 24 }}>{t('start.loading')}</div>;
  if (err) return <div style={{ padding: 24, color: "crimson" }}>{t('start.errorPrefix')}: {err}</div>;

  return (
    <div className="ml-page-shell">
      <AuthNoticeBanner />
      <section className="hero-carousel" style={{ marginBottom: 0 }}>
        {heroBackgrounds.map((b, i) => (
          <div key={i} className={`hero-slide ${i === index ? 'active' : ''}`} style={{ backgroundImage: `url(${b.src})` }} />
        ))}

        <div
          aria-hidden="true"
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            bottom: 0,
            height: '36%',
            background: 'linear-gradient(180deg, rgba(5,15,13,0) 0%, rgba(6,18,15,0.16) 24%, rgba(6,20,17,0.42) 64%, rgba(7,23,22,0.68) 100%)',
            zIndex: 1,
            pointerEvents: 'none'
          }}
        />

        <div className="hero-overlay">
          <div className="hero-inner">
            <div className="hero-stripe">
              <img src={smallLogo} alt="ML" className="hero-small-logo" />
              <h1 className="hero-title">Match League<sup style={{ fontSize: '0.5em', marginLeft: '2px' }}>™</sup></h1>
            </div>
            <p className="hero-sub"><b>{t('start.welcome')}</b></p>
            <div
              className="hero-controls"
              style={{
                marginTop: 18,
                position: 'relative',
                zIndex: 20,
                display: 'flex',
                flexDirection: 'column',
                gap: 12,
                width: '100%'
              }}
            >
              <div style={{ position: 'relative' }}>
                <SportSelector
                  sports={sports}
                  value={selectedSportName}
                  onChange={(sportName, sportId) => {
                    setSelectedSportName(sportName);
                    setSelectedSport(String(sportId));
                  }}
                  placeholder={t('start.sportPlaceholder')}
                  isOpen={sportDropdownOpen}
                  onOpen={() => {
                    setSportDropdownOpen(true);
                    setLocationDropdownOpen(false);
                  }}
                  onClose={() => setSportDropdownOpen(false)}
                />
              </div>
              
              <div style={{ position: 'relative' }}>
                <LocationSelector
                  cities={cities}
                  countries={countries}
                  states={states}
                  districts={districts}
                  value={selectedCityName}
                  onChange={(locationName, cityId, stateId, countryId, districtId) => {
                    setSelectedCityName(locationName);
                    setSelectedCity(String(cityId));
                    console.log('[StartPage] Location selected:', { locationName, cityId, stateId, countryId, districtId });
                  }}
                  placeholder={t('start.cityPlaceholder')}
                  isOpen={locationDropdownOpen}
                  onOpen={() => {
                    setLocationDropdownOpen(true);
                    setSportDropdownOpen(false);
                    loadCitiesIfNeeded();
                  }}
                  onClose={() => setLocationDropdownOpen(false)}
                  onLoadDistricts={loadDistrictsForCity}
                />
              </div>
              
              <div style={{ display: 'grid', gap: 10, width: '100%' }}>
                <div
                  role="group"
                  aria-label={t('start.searchMode')}
                  className="ml-segmented"
                >
                  {[
                    { value: 'match', label: t('start.mode.match'), enabled: true },
                    {
                      value: 'competition',
                      label: FEATURES.SHOW_COMPETITIONS ? t('start.mode.competition') : t('start.mode.competitionSoon'),
                      enabled: !!FEATURES.SHOW_COMPETITIONS,
                    },
                    {
                      value: 'slot',
                      label: FEATURES.SHOW_BOOKINGS ? t('start.mode.slot') : t('start.mode.slotSoon'),
                      enabled: !!FEATURES.SHOW_BOOKINGS,
                    }
                  ].map((opt) => {
                    const active = searchMode === opt.value;
                    return (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => {
                          if (!opt.enabled) return;
                          setSearchMode(active ? '' : opt.value);
                        }}
                        aria-pressed={active}
                        className={`ml-segmented-option ${active ? 'ml-segmented-option--active' : ''}`}
                        disabled={!opt.enabled}
                      >
                        {opt.label}
                      </button>
                    );
                  })}
                </div>

                <button
                  onClick={() => {
                    if (!searchMode) return;
                    const qp = new URLSearchParams();
                    if (selectedSport) qp.set('sportId', selectedSport);
                    if (selectedCity) qp.set('cityId', selectedCity);

                    if (searchMode === 'match') {
                      navigate(`/match-search?${qp.toString()}`);
                      return;
                    }

                    if (searchMode === 'competition') {
                      navigate(`/tournaments?${qp.toString()}`);
                      return;
                    }

                    const slotParams = new URLSearchParams(qp);
                    if (selectedCity) slotParams.set('city', selectedCityName || selectedCity);
                    const now = new Date();
                    slotParams.set('date', now.toISOString().split('T')[0]);
                    slotParams.set('time', now.toTimeString().slice(0, 5));
                    navigate(`/slots?${slotParams.toString()}`);
                  }}
                  className="ml-btn-gold"
                  style={{ width: '100%' }}
                  disabled={searching || !searchMode}
                >
                  {searching ? t('start.searching') : t('start.search')}
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      <div
        aria-hidden="true"
        style={{
          position: 'relative',
          height: 'clamp(72px, 10vw, 108px)',
          marginTop: -33,
          background: 'linear-gradient(180deg, rgba(6, 18, 15, 0) 0%, rgba(6, 18, 15, 0.88) 18%, rgba(6, 18, 15, 0.96) 34%, rgba(6, 18, 15, 0.96) 66%, rgba(6, 18, 15, 0.88) 82%, rgba(6, 18, 15, 0) 100%)',
          overflow: 'hidden',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}
      >
        <div style={{
          position: 'absolute',
          inset: 0,
          background: 'linear-gradient(180deg, rgba(255,255,255,0.012) 0%, rgba(255,255,255,0.01) 16%, rgba(255,255,255,0.018) 50%, rgba(255,255,255,0.01) 84%, rgba(255,255,255,0.012) 100%)'
        }} />
        <div style={{
          width: 'min(100%, 920px)',
          padding: '0 28px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 0,
          position: 'relative',
          zIndex: 1
        }}>
          <div style={{
            flex: 1,
            height: 2,
            maxWidth: 760,
            background: 'linear-gradient(90deg, transparent 0%, rgba(222,188,124,0.06) 12%, rgba(222,188,124,0.42) 26%, rgba(222,188,124,0.5) 50%, rgba(222,188,124,0.42) 74%, rgba(222,188,124,0.06) 88%, transparent 100%)',
            boxShadow: '0 0 14px rgba(222,188,124,0.08)'
          }} />
        </div>
        <div style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 0,
          height: '58%',
          background: 'linear-gradient(180deg, rgba(6,18,15,0) 0%, rgba(6,18,15,0.08) 30%, rgba(6,18,15,0.22) 72%, rgba(6,18,15,0.34) 100%)'
        }} />
      </div>

  <div className="ml-main-container" style={{ marginTop: -8, paddingTop: 16, paddingBottom: 32, position: 'relative', zIndex: 2 }}>
      {/* Dashboard Sections */}
      {/* Row 1: Upcoming and Last games, 3 items each, stacked vertically */}
      <div style={{ display: 'grid', gap: 16 }}>
        {/* Kommende Spiele (max 3) */}
  <section className="ml-card">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', alignItems: 'center', marginBottom: 8 }}>
            <h3 style={{ margin: 0 }}>{t('start.upcoming')}</h3>
            <span />
          </div>
          {(upcomingWithOpponent.length === 0) ? (
            <div style={{ padding: '20px', textAlign: 'center' }}>
              <div style={{ color: '#9db', marginBottom: 16 }}>{t('start.noUpcoming')}</div>
              <Link 
                to="/match-search" 
                style={{ 
                  display: 'inline-block',
                  textDecoration: 'none',
                  minWidth: 190
                }}
                className="ml-btn-gold"
              >
                {t('start.findMatch')}
              </Link>
            </div>
          ) : (
            <div style={{ display: 'grid', gap: 8 }}>
              {upcomingWithOpponent.slice(0, 3).map(g => {
                const toId = (v) => {
                  if (v == null) return null;
                  if (typeof v === 'number') return String(v);
                  const m = String(v).match(/\d+/);
                  return m ? m[0] : null;
                };
                const hId = g.home_user_id || g.homeUserId || g.home_id || g.homeId || toId(g.home);
                const aId = g.away_user_id || g.awayUserId || g.away_id || g.awayId || toId(g.away);
                const kx = g.kickoff_at || g.kickoffAt || g.date || null;
                const when = kx ? new Date(kx).toLocaleDateString(uiLocale, { weekday: 'short', day: 'numeric', month: 'short' }) : '—';
                const isTeamMatch = g.participants && g.participants.length > 0 && g.max_players > 2;
                const team1 = isTeamMatch ? g.participants.filter(p => Number(p.team_index) === 1) : [];
                const team2 = isTeamMatch ? g.participants.filter(p => Number(p.team_index) === 2) : [];

                const TeamAvatars = ({ members, justify }) => (
                  <div style={{ display: 'flex', alignItems: justify === 'end' ? 'center' : 'center', flexDirection: justify === 'end' ? 'row-reverse' : 'row' }}>
                    {members.slice(0, 5).map((m, i) => (
                      <Link key={m.user_id} to={`/user/${m.user_id}`} style={{ marginLeft: i === 0 ? 0 : (justify === 'end' ? 0 : -8), marginRight: i === 0 ? 0 : (justify === 'end' ? -8 : 0), position: 'relative', zIndex: members.length - i }}>
                        <Avatar userId={m.user_id} name={formatPlayerName(m.name)} size={34} title={m.name} />
                      </Link>
                    ))}
                    {members.length > 5 && <span style={{ fontSize: 11, color: '#9db', marginLeft: 4 }}>+{members.length - 5}</span>}
                  </div>
                );

                return (
                  <div key={g.id} className="ml-match" style={{ padding: '10px 2px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                    <div className="ml-match__side">
                      {isTeamMatch && team1.length > 0 ? (
                        <TeamAvatars members={team1} justify="start" />
                      ) : hId ? (
                        <Link to={`/user/${hId}`} style={{ display: 'contents' }}>
                          <Avatar userId={hId} name={formatPlayerName(g.home)} size={44} title={g.home} />
                          <span style={{ color: '#cfe', textDecoration: 'none' }}>{formatPlayerName(g.home)}</span>
                        </Link>
                      ) : (
                        <>
                          <Avatar userId={hId} name={formatPlayerName(g.home)} size={44} />
                          <span>{formatPlayerName(g.home)}</span>
                        </>
                      )}
                    </div>
                    <div className="ml-vs">VS</div>
                    <div className="ml-match__side" style={{ justifyContent: 'flex-end' }}>
                      {isTeamMatch && team2.length > 0 ? (
                        <TeamAvatars members={team2} justify="end" />
                      ) : aId ? (
                        <Link to={`/user/${aId}`} style={{ display: 'contents' }}>
                          <Avatar userId={aId} name={formatPlayerName(g.away)} size={44} title={g.away} />
                          <span style={{ color: '#cfe', textDecoration: 'none' }}>{formatPlayerName(g.away)}</span>
                        </Link>
                      ) : (
                        <>
                          <Avatar userId={aId} name={formatPlayerName(g.away)} size={44} />
                          <span>{formatPlayerName(g.away)}</span>
                        </>
                      )}
                    </div>
                    <div style={{ gridColumn: '1 / -1', color: '#9db', fontSize: 12, display: 'flex', justifyContent: 'space-between' }}>
                      <span>{[g.sport, g.league, g.city].filter(Boolean).join(' · ')}</span>
                      <span>{when}</span>
                    </div>
                    {g?.id ? (
                      <div style={{ gridColumn: '1 / -1', display: 'flex', justifyContent: 'flex-end' }}>
                        <Link to={`/matches/${g.id}`} style={{ color: '#debc7c', fontWeight: 700, textDecoration: 'none' }}>{t('start.details')}</Link>
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          )}
        </section>
        {/* Letzte Spiele (max 3) */}
  <section className="ml-card">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', alignItems: 'center', marginBottom: 8 }}>
            <h3 style={{ margin: 0 }}>{t('start.recent')}</h3>
            <span />
          </div>
          {(!myGames.completed || myGames.completed.length === 0) ? (
            <div style={{ color: '#9db' }}>{t('start.noRecent')}</div>
          ) : (
            <div style={{ display: 'grid', gap: 8 }}>
              {myGames.completed.slice(0, 3).map(g => {
                const toId = (v) => {
                  if (v == null) return null;
                  if (typeof v === 'number') return String(v);
                  const m = String(v).match(/\d+/);
                  return m ? m[0] : null;
                };
                const hId = g.home_user_id || g.homeUserId || g.home_id || g.homeId || toId(g.home);
                const aId = g.away_user_id || g.awayUserId || g.away_id || g.awayId || toId(g.away);
                const score = (g.home_score!=null && g.away_score!=null) ? `${g.home_score}:${g.away_score}` : '— : —';
                const isTeamMatch = g.participants && g.participants.length > 0 && g.max_players > 2;
                const team1 = isTeamMatch ? g.participants.filter(p => Number(p.team_index) === 1) : [];
                const team2 = isTeamMatch ? g.participants.filter(p => Number(p.team_index) === 2) : [];

                const TeamAvatars = ({ members, justify }) => (
                  <div style={{ display: 'flex', alignItems: 'center', flexDirection: justify === 'end' ? 'row-reverse' : 'row' }}>
                    {members.slice(0, 5).map((m, i) => (
                      <Link key={m.user_id} to={`/user/${m.user_id}`} style={{ marginLeft: i === 0 ? 0 : (justify === 'end' ? 0 : -8), marginRight: i === 0 ? 0 : (justify === 'end' ? -8 : 0), position: 'relative', zIndex: members.length - i }}>
                        <Avatar userId={m.user_id} name={formatPlayerName(m.name)} size={34} title={m.name} />
                      </Link>
                    ))}
                    {members.length > 5 && <span style={{ fontSize: 11, color: '#9db', marginLeft: 4 }}>+{members.length - 5}</span>}
                  </div>
                );

                return (
                  <div key={g.id} className="ml-match" style={{ padding: '10px 2px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                    <div className="ml-match__side">
                      {isTeamMatch && team1.length > 0 ? (
                        <TeamAvatars members={team1} justify="start" />
                      ) : hId ? (
                        <Link to={`/user/${hId}`} style={{ display: 'contents' }}>
                          <Avatar userId={hId} name={formatPlayerName(g.home)} size={44} title={g.home} />
                          <span style={{ color: '#cfe', textDecoration: 'none' }}>{formatPlayerName(g.home)}</span>
                        </Link>
                      ) : (
                        <>
                          <Avatar userId={hId} name={formatPlayerName(g.home)} size={44} />
                          <span>{formatPlayerName(g.home)}</span>
                        </>
                      )}
                    </div>
                    <div className="ml-vs" style={{ fontSize: 24 }}>{score}</div>
                    <div className="ml-match__side" style={{ justifyContent: 'flex-end' }}>
                      {isTeamMatch && team2.length > 0 ? (
                        <TeamAvatars members={team2} justify="end" />
                      ) : aId ? (
                        <Link to={`/user/${aId}`} style={{ display: 'contents' }}>
                          <Avatar userId={aId} name={formatPlayerName(g.away)} size={44} title={g.away} />
                          <span style={{ color: '#cfe', textDecoration: 'none' }}>{formatPlayerName(g.away)}</span>
                        </Link>
                      ) : (
                        <>
                          <Avatar userId={aId} name={formatPlayerName(g.away)} size={44} />
                          <span>{formatPlayerName(g.away)}</span>
                        </>
                      )}
                    </div>
                    <div style={{ gridColumn: '1 / -1', color: '#9db', fontSize: 12, display: 'flex', justifyContent: 'space-between' }}>
                      <span>{[g.sport, g.league, g.city].filter(Boolean).join(' · ')}</span>
                      <span>{g.kickoff_at ? new Date(g.kickoff_at).toLocaleDateString(uiLocale, { weekday: 'short', day: 'numeric', month: 'short' }) : '—'}</span>
                    </div>
                    {g?.id ? (
                      <div style={{ gridColumn: '1 / -1', display: 'flex', justifyContent: 'flex-end' }}>
                        <Link to={`/matches/${g.id}`} style={{ color: '#debc7c', fontWeight: 700, textDecoration: 'none' }}>Details</Link>
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>

  {/* Row 2: Tabellen mit Ligen-Auswahl */}
        {/* Standings preview */}
        <section className="ml-card" style={{ gridColumn: '1 / -1' }}>
          <h2 style={{ margin: '0 0 16px 0' }}>{t('start.myLeagues.title')}</h2>
          {myLeagues.length === 0 ? (
            <div style={{ padding: '20px', textAlign: 'center' }}>
              <div style={{ color: '#9db', marginBottom: 16 }}>{t('start.myLeagues.none')}</div>
              <Link 
                to="/leagues" 
                className="ml-btn-gold"
                style={{ 
                  display: 'inline-block',
                  textDecoration: 'none',
                  minWidth: 190
                }}
              >
                {t('start.myLeagues.searchLeague')}
              </Link>
            </div>
          ) : (
            <>
              <div style={{ marginBottom: 16 }}>
                <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                  {t('start.myLeagues.leagueLabel')}
                  <select
                  value={selectedMyLeagueId}
                  onChange={async (e) => {
                    const lid = e.target.value;
                    setSelectedMyLeagueId(lid);
                    if (!lid) { setStandings({ leagueId: "", rows: [] }); return; }
                    try {
                      const [st, members, games] = await Promise.all([
                        fetch(`${API_BASE}/leagues/${lid}/standings?format=table`).then(r => r.ok ? r.json() : []),
                        fetch(`${API_BASE}/leagues/${lid}/members`, { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } }).then(r => r.ok ? r.json() : []),
                        fetch(`${API_BASE}/leagues/${lid}/games`).then(r => r.ok ? r.json() : { upcoming: [], completed: [] })
                      ]);
                      setStandings({ leagueId: String(lid), rows: Array.isArray(st) ? st : [] });
                      setLeagueMembers(Array.isArray(members) ? members : []);
                      setLeagueGames({
                        upcoming: Array.isArray(games.upcoming) ? games.upcoming : [],
                        completed: Array.isArray(games.completed) ? games.completed : []
                      });
                    } catch { 
                      setStandings({ leagueId: String(lid), rows: [] });
                      setLeagueMembers([]);
                      setLeagueGames({ upcoming: [], completed: [] });
                    }
                  }}
                  style={{ padding: '8px 10px', borderRadius: 8, border: '1px solid #2f6b57', background: '#0e2a22', color: '#dfe' }}
                >
                  {myLeagues.map(l => (
                    <option key={l.id || l.leagueId} value={String(l.id || l.leagueId)}>{l.name}</option>
                  ))}
                </select>
              </label>
            </div>
          )}
          {(!standings.rows || standings.rows.length === 0) ? (
            <div style={{ color: '#9db' }}>{t('start.noStandings')}</div>
          ) : (
            <div className="ml-card" style={{ overflowX: 'auto', marginTop: 8 }}>
              {(() => {
                const sel = (myLeagues || []).find(l => String(l.id || l.leagueId) === String(selectedMyLeagueId));
                const name = sel?.name || '';
                return name ? (
                  <div style={{ padding: '10px 6px', fontWeight: 700, color: '#cfe', borderBottom: '1px solid #194638' }}>{name}</div>
                ) : null;
              })()}
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ textAlign: 'left', borderBottom: '2px solid #234' }}>
                    <th style={{ padding: '8px 6px' }}>Platz</th>
                    <th style={{ padding: '8px 6px' }}>Team/Spieler</th>
                    <th style={{ padding: '8px 6px' }}>Sp</th>
                    <th style={{ padding: '8px 6px' }}>S</th>
                    <th style={{ padding: '8px 6px' }}>U</th>
                    <th style={{ padding: '8px 6px' }}>N</th>
                    <th style={{ padding: '8px 6px' }}>Tore</th>
                    <th style={{ padding: '8px 6px' }}>Diff</th>
                    <th style={{ padding: '8px 6px' }}>Pkt</th>
                    <th style={{ padding: '8px 6px' }}>Form</th>
                  </tr>
                </thead>
                <tbody>
                  {(() => {
                    const rows = Array.isArray(standings.rows) ? standings.rows : [];
                    // Resolve UID from league members by matching name when no id on row
                    const norm = (s) => String(s || '').trim().toLowerCase();
                    const memberIndexByName = new Map();
                    (leagueMembers || []).forEach(m => {
                      const uid = m.user_id ?? m.userId ?? m.member_user_id ?? m.memberUserId ?? m.member_id ?? m.memberId ?? m.id;
                      if (uid == null) return;
                      const cand = new Set();
                      const fn = (m.firstname || '').trim();
                      const ln = (m.lastname || '').trim();
                      const username = (m.username || '').trim();
                      const disp = (m.displayName || '').trim();
                      const name = (m.name || '').trim();
                      const combos = [
                        [fn, ln].filter(Boolean).join(' '),
                        [ln, fn].filter(Boolean).join(' '),
                        username,
                        name,
                        disp,
                        String(uid)
                      ].filter(Boolean);
                      combos.forEach(s => {
                        const key = norm(s.replace(/[()]/g, ''));
                        if (key) cand.add(key);
                        // also single tokens for simple usernames/names
                        s.split(/\s+/).forEach(t => { const k2 = norm(t); if (k2) cand.add(k2); });
                      });
                      cand.forEach(k => { if (!memberIndexByName.has(k)) memberIndexByName.set(k, String(uid)); });
                    });
                    // Build form map from completed games like on LeagueDetail
                    const completed = Array.isArray(leagueGames.completed) ? [...leagueGames.completed] : [];
                    completed.sort((a, b) => new Date(b.kickoff_at || b.kickoffAt || b.date || 0) - new Date(a.kickoff_at || a.kickoffAt || a.date || 0));
                    const toId = (g, side) => {
                      const v = g?.[`${side}_id`] ?? g?.[`${side}Id`] ?? g?.[side];
                      const m = String(v ?? '').match(/\d+/);
                      return m ? m[0] : null;
                    };
                    const gScore = (g, k) => g?.[k] ?? g?.[k.replace(/_/, "")] ?? null;
                    const formMap = new Map();
                    const nameFormMap = new Map(); // fallback by display name
                    completed.forEach(g => {
                      const hs = gScore(g, 'home_score');
                      const as = gScore(g, 'away_score');
                      if (hs == null || as == null) return;
                      let hRes = 'U', aRes = 'U';
                      if (Number(hs) > Number(as)) { hRes = 'W'; aRes = 'N'; }
                      else if (Number(hs) < Number(as)) { hRes = 'N'; aRes = 'W'; }

                      // Map by numeric IDs when available
                      const hId = toId(g, 'home');
                      const aId = toId(g, 'away');
                      if (hId) { if (!formMap.has(hId)) formMap.set(hId, []); formMap.get(hId).push(hRes); }
                      if (aId) { if (!formMap.has(aId)) formMap.set(aId, []); formMap.get(aId).push(aRes); }

                      // Always map by display names (fallback)
                      const hName = g.home || g.home_name || g.homeName || '';
                      const aName = g.away || g.away_name || g.awayName || '';
                      if (hName) {
                        const key = norm(hName);
                        if (!nameFormMap.has(key)) nameFormMap.set(key, []);
                        nameFormMap.get(key).push(hRes);
                      }
                      if (aName) {
                        const key = norm(aName);
                        if (!nameFormMap.has(key)) nameFormMap.set(key, []);
                        nameFormMap.get(key).push(aRes);
                      }
                    });
                    for (const [k, arr] of formMap.entries()) formMap.set(k, arr.slice(0, 5));
                    for (const [k, arr] of nameFormMap.entries()) nameFormMap.set(k, arr.slice(0, 5));
                    const findIndex = () => {
                      if (myUserId == null) return -1;
                      const idStr = String(myUserId);
                      return rows.findIndex(r => {
                        const candidate = r.user_id ?? r.userId ?? r.member_id ?? r.memberId ?? r.id;
                        return candidate != null && String(candidate) === idStr;
                      });
                    };
                    const idxMe = findIndex();
                    let start = 0;
                    if (idxMe >= 0) start = Math.max(0, idxMe - 2);
                    const slice = rows.slice(start, start + 5);
                    const initialsFor = (name) => {
                      const s = String(name || '').trim();
                      if (!s) return '?';
                      const p = s.split(/\s+/);
                      const a = (p[0]?.[0] || '').toUpperCase();
                      const b = (p[1]?.[0] || '').toUpperCase();
                      return (a + b) || a || '?';
                    };
                    return slice.map((row, i) => {
                      const nestedUserId = row.user?.id ?? row.user?.userId ?? null;
                      const display = row.name || row.displayName || row.username || row.team || row.player || `User ${nestedUserId ?? ''}`;
                      let uid;
                      const idCandidate = row.user_id ?? row.userId ?? row.member_id ?? row.memberId ?? nestedUserId ?? row.id;
                      if (idCandidate != null) uid = String(idCandidate).match(/\d+/)?.[0];
                      if (!uid) {
                        const byName = memberIndexByName.get(norm(display))
                          || memberIndexByName.get(norm(String(display).replace(/[()]/g, '')));
                        if (byName) uid = String(byName).match(/\d+/)?.[0];
                      }
                      const formArr = Array.isArray(row.form)
                        ? row.form
                        : (String(row.form || '').trim().length ? String(row.form).trim().split(/\s+/) : []);
                      const color = (r) => (r === 'W' ? '#29e0ad' : r === 'N' ? '#ff6b6b' : '#c4d0ca');
                      const key = `${start + i}-${row.id ?? row.user_id ?? row.userId ?? row.member_id ?? row.memberId ?? row.name ?? 'row'}`;
                      return (
                        <tr key={key} style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                          <td style={{ padding: '8px 6px' }}>{row.rank ?? row.platz ?? (start + i + 1)}</td>
                          <td style={{ padding: '10px 8px' }}>
                            <Avatar userId={uid} name={display} size={40} style={{ marginRight: 12 }} />
                            {uid ? (
                              <span style={{ display: 'inline-flex', alignItems: 'center' }}>
                                <Link to={`/user/${uid}`} className="ml-link-profile" title={t('common.openProfile')}>{display}</Link>
                                <span aria-hidden className="ml-link-profile-icon">↗︎</span>
                              </span>
                            ) : (
                              display
                            )}
                          </td>
                          <td style={{ padding: '8px 6px' }}>{row.sp ?? row.played ?? 0}</td>
                          <td style={{ padding: '8px 6px' }}>{row.s ?? row.wins ?? 0}</td>
                          <td style={{ padding: '8px 6px' }}>{row.u ?? row.draws ?? 0}</td>
                          <td style={{ padding: '8px 6px' }}>{row.n ?? row.losses ?? 0}</td>
                          <td style={{ padding: '8px 6px' }}>{
                            (row.goals ?? row.gfga ?? row.gd_text) ??
                            ((row.goals_for != null && row.goals_against != null)
                              ? `${row.goals_for}:${row.goals_against}`
                              : (row.goals || '0:0'))
                          }</td>
                          <td style={{ padding: '8px 6px' }}>{row.diff ?? row.gd ?? 0}</td>
                          <td style={{ padding: '8px 6px' }}>{row.pkt ?? row.points ?? 0}</td>
                          <td style={{ padding: '8px 6px', whiteSpace: 'nowrap' }}>
                            {(() => {
                              // Prefer computed form by uid, fallback to row.form
                              const computed = uid ? (formMap.get(String(uid)) || []) : [];
                              const byName = nameFormMap.get(norm(display)) || [];
                              const effective = computed.length ? computed : (byName.length ? byName : formArr);
                              return effective.length === 0 ? (
                                <span style={{ color: '#9db' }}>—</span>
                              ) : (
                                <span>
                                  {effective.slice(0, 5).map((r, i2) => (
                                    <span key={i2} style={{ color: color(r), fontWeight: 700, display: 'inline-block', marginRight: 6 }}>{r}</span>
                                  ))}
                                </span>
                              );
                            })()}
                          </td>
                        </tr>
                      );
                    });
                  })()}
                </tbody>
              </table>
              {standings.leagueId ? (
                <div style={{ marginTop: 8 }}>
                  <Link to={`/league/${standings.leagueId}`}>{t('start.toLeague')}</Link>
                </div>
              ) : null}
            </div>
          )}
            </>
          )}
        </section>

      {/* Row 3: Aktivitäten statt Neuigkeiten */}
      <section className="ml-card" style={{ marginTop: 16 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', alignItems: 'center', marginBottom: 12 }}>
          <div>
            <h3 style={{ margin: 0 }}>{t('start.activities.title')}</h3>
            <div style={{ color: '#9db', fontSize: 12, marginTop: 4 }}>{t('start.activities.subtitle')}</div>
          </div>
        </div>

        {/* Aktivitäten Content */}
        <div style={{ display: 'grid', gap: 10 }}>
          {(() => {
            // Kombiniere alle Feeds basierend auf dem aktiven Filter
            const combinedFeed = [];
            

            if (newsFilter === 'all') {
              combinedFeed.push(...(feedData.friends || []).map(item => ({...item, feedType: 'friends'})));
              combinedFeed.push(...(feedData.team || []).map(item => ({...item, feedType: 'team'})));
              combinedFeed.push(...(feedData.public || []).map(item => ({...item, feedType: 'public'})));
            } else if (newsFilter === 'matches') {
              combinedFeed.push(...(feedData.friends || []).filter(item => item.type === 'match').map(item => ({...item, feedType: 'friends'})));
              combinedFeed.push(...(feedData.team || []).filter(item => item.type === 'match').map(item => ({...item, feedType: 'team'})));
              combinedFeed.push(...(feedData.public || []).filter(item => item.type === 'match').map(item => ({...item, feedType: 'public'})));
            } else if (newsFilter === 'friends') {
              combinedFeed.push(...(feedData.friends || []).map(item => ({...item, feedType: 'friends'})));
            }
            
            combinedFeed.sort((a, b) => {
              const timeA = new Date(a.timestamp || 0).getTime();
              const timeB = new Date(b.timestamp || 0).getTime();
              return timeB - timeA;
            });
            const sortedFeed = combinedFeed;

            if (sortedFeed.length === 0) {
              const emptyMessages = {
                all: t('start.activities.empty.all'),
                matches: t('start.activities.empty.matches'),
                friends: t('start.activities.empty.friends')
              };
              
              return (
                <div style={{ padding: '20px', borderRadius: 12, background: 'rgba(32,74,58,0.4)', color: '#9db', textAlign: 'center' }}>
                  {emptyMessages[newsFilter] || emptyMessages.all}
                </div>
              );
            }

            return sortedFeed.slice(0, 8).map((item, idx) => {
              // Normale Feed-Items
              const linkTo = item.matchId ? `/matches/${item.matchId}` : item.leagueId ? `/league/${item.leagueId}` : null;
              const Component = linkTo ? Link : 'div';
              const extraProps = linkTo ? { to: linkTo, style: { textDecoration: 'none', color: 'inherit', display: 'block', width: '100%', minWidth: 0 } } : {};
              
              return (
                <Component
                  key={`${item.feedType}-${idx}`}
                  {...extraProps}
                >
                  <div 
                    style={{ 
                      padding: '12px 14px', 
                      borderRadius: 10, 
                      background: 'rgba(15,43,39,0.7)', 
                      border: '1px solid rgba(127,252,204,0.2)',
                      display: 'grid',
                      gridTemplateColumns: '36px minmax(0, 1fr)',
                      alignItems: 'start',
                      columnGap: 12,
                      rowGap: 8,
                      transition: 'all 0.2s',
                      cursor: linkTo ? 'pointer' : 'default',
                      width: '100%',
                      minWidth: 0,
                      boxSizing: 'border-box',
                      overflow: 'hidden'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = 'rgba(32,74,58,0.6)';
                      e.currentTarget.style.borderColor = 'rgba(127,252,204,0.4)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = 'rgba(15,43,39,0.7)';
                      e.currentTarget.style.borderColor = 'rgba(127,252,204,0.2)';
                    }}
                  >
                {/* Activity Icon */}
                <div style={{ 
                  width: 36, 
                  height: 36, 
                  borderRadius: 10, 
                  background: item.type === 'match' ? 'rgba(127,252,204,0.2)' : 
                             item.type === 'league' ? 'rgba(222,188,124,0.2)' : 
                             item.feedType === 'friends' ? 'rgba(161,225,203,0.2)' :
                             'rgba(127,252,204,0.15)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 18,
                  flexShrink: 0
                }}>
                  {item.type === 'match' ? '⚽' : 
                   item.type === 'league' ? '🏆' : 
                   item.feedType === 'friends' ? '👥' :
                   '🌐'}
                </div>

                {/* Activity Content */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, color: '#e8efe8', fontWeight: 600, marginBottom: 2, whiteSpace: 'normal', overflowWrap: 'anywhere', lineHeight: 1.35 }}>
                    {item.title}
                  </div>
                  <div style={{ fontSize: 12, color: '#9db', lineHeight: 1.4, whiteSpace: 'normal', overflowWrap: 'anywhere' }}>
                    {item.description}
                  </div>
                  {item.timestamp && (
                    <div style={{ fontSize: 10, color: '#789', marginTop: 4 }}>
                      {new Date(item.timestamp).toLocaleString(uiLocale, { 
                        day: '2-digit', 
                        month: '2-digit', 
                        year: '2-digit',
                        hour: '2-digit', 
                        minute: '2-digit' 
                      })}
                    </div>
                  )}
                </div>
                  </div>
                </Component>
              );
            }).reduce((acc, el, i) => {
              acc.push(el);
              if (i === 2) acc.push(<AdBanner key="adsense-feed" slot="XXXXXXXXXX" />);
              return acc;
            }, []);
          })()}
        </div>
      </section>

      {/* Extra Listen (Alle Ligen/Sportarten/Städte) entfernt auf Wunsch */}
      
      </div>
    </div>
  );
}


