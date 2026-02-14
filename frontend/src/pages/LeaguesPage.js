import React, { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams, useNavigate } from "react-router-dom";
import { API_BASE } from "../config";
import { handleInvalidToken } from "../utils/auth";
import LocationSelector from "../components/LocationSelector";
import SportSelector from "../components/SportSelector";
import { LeaguesFeature } from "../components/FeatureWrapper";

export default function LeaguesPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [leagues, setLeagues] = useState([]);
  const [cities, setCities] = useState([]);
  const [countries, setCountries] = useState([]);
  const [states, setStates] = useState([]);
  const [sports, setSports] = useState([]);
  
  // Initialize filters from URL params
  const [selectedCity, setSelectedCity] = useState(searchParams.get('cityId') || "");
  const [selectedCityName, setSelectedCityName] = useState("");
  const [selectedSport, setSelectedSport] = useState(searchParams.get('sportId') || "");
  const [selectedSportName, setSelectedSportName] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [showMyLeaguesOnly, setShowMyLeaguesOnly] = useState(false);
  const [userLeagues, setUserLeagues] = useState([]);
  const [membersCount, setMembersCount] = useState({});
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [loadingCounts, setLoadingCounts] = useState(false);
  const [err, setErr] = useState("");
  const [userProfile, setUserProfile] = useState(null);
  
  // Pagination state
  const [totalCount, setTotalCount] = useState(0);
  const [currentOffset, setCurrentOffset] = useState(0);
  const pageSize = 50; // Load 50 leagues at a time
  
  // Sorting state
  const [sortColumn, setSortColumn] = useState(null);
  const [sortDirection, setSortDirection] = useState('asc');

  // Reachability state: { [leagueId]: { ok: boolean, status: number|null, error: string|null } }
  const [reachable, setReachable] = useState({});

  // Track loaded cities per state for lazy-loading
  const [loadedStateCities, setLoadedStateCities] = useState(() => new Set());

  // helper: normalize strings
  const normalize = (s) => {
    if (s == null) return "";
    return String(s).normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "");
  };

  // Resolve selected items to objects (id or name) — needed by filter logic
  const selectedCityObj = useMemo(() => {
    if (!selectedCity) return null;
    const raw = String(selectedCity).trim();
    const byId = cities.find(c => String(c.id) === raw);
    if (byId) return byId;
    const byName = cities.find(c => normalize(c.name) === normalize(raw));
    if (byName) return byName;
    return { id: raw, name: raw };
  }, [selectedCity, cities]);

  const selectedSportObj = useMemo(() => {
    if (!selectedSport) return null;
    const raw = String(selectedSport).trim();
    const byId = sports.find(s => String(s.id) === raw);
    if (byId) return byId;
    const byName = sports.find(s => normalize(s.name) === normalize(raw));
    if (byName) return byName;
    return { id: raw, name: raw };
  }, [selectedSport, sports]);

  // Robust city matching with verbose logging (returns boolean)
  function leagueMatchesCity(league, selectedCityObj, log = false) {
    if (!selectedCityObj) return true;
    const selId = String(selectedCityObj.id);
    const selNameNorm = normalize(selectedCityObj.name || selId);

    // candidate league city/id/name variants
    const leagueCityId = league.cityId ?? league.city_id ?? league.cityId ?? league.city_id;
    const leagueCityField = league.city ?? league.cityName ?? league.city_name ?? "";
    const leagueCityNameNorm = normalize(leagueCityField);
    // also consider the league's own name (some imports/store use "City Name ...")
    const leagueNameField = league.name ?? "";
    const leagueNameNorm = normalize(leagueNameField);

    const checks = [];
    // direct id comparisons (numeric or string)
    if (leagueCityId != null) {
      checks.push({ kind: "id-eq", pass: String(leagueCityId) === selId });
    } else {
      checks.push({ kind: "id-missing", pass: false });
    }
    // name exact/contains matches
    checks.push({ kind: "name-exact", pass: !!leagueCityNameNorm && leagueCityNameNorm === selNameNorm });
    checks.push({ kind: "name-includes", pass: !!leagueCityNameNorm && (leagueCityNameNorm.includes(selNameNorm) || selNameNorm.includes(leagueCityNameNorm)) });
    // new: match when the league's own name contains the city (e.g. "Bonn Fußball ...")
    checks.push({ kind: "league-name-contains-city", pass: !!leagueNameNorm && leagueNameNorm.includes(selNameNorm) });

    const passed = checks.some(c => c.pass);
    if (log) {
      console.log(`[LeaguesPage][match] league=${league.id} "${league.name}" cityField="${leagueCityField}" cityId=${leagueCityId} -> selId=${selId} selName=${selectedCityObj.name}`, checks, "=>", passed);
    }
    return passed;
  }

  // Handler: set selected city and log immediate info
  function handleCitySelect(value) {
    console.log("[LeaguesPage] City selection changed:", value);
    setSelectedCity(value);
    setCurrentOffset(0); // Reset pagination when filter changes
    // fetchLeagues will be triggered by useEffect
  }

  // Fetch leagues from server with current filters
  const fetchLeagues = async (append = false) => {
    try {
      // Scale optimization: do not load leagues until a city is selected.
      if (!selectedCityObj?.id) {
        setLeagues([]);
        setTotalCount(0);
        setCurrentOffset(0);
        setLoading(false);
        setLoadingMore(false);
        return;
      }

      if (append) {
        setLoadingMore(true);
      } else {
        setLoading(true);
        setLeagues([]);
      }
      setErr("");

      // Build query parameters for server-side filtering
      const params = new URLSearchParams();
      params.set('limit', String(pageSize));
      params.set('offset', String(append ? currentOffset : 0));
      
      if (selectedCityObj?.id) {
        params.set('cityId', String(selectedCityObj.id));
      }
      if (selectedSportObj?.id) {
        params.set('sportId', String(selectedSportObj.id));
      }
      if (searchQuery) {
        params.set('search', searchQuery);
      }

      const response = await fetch(`${API_BASE}/leagues?${params.toString()}`);
      if (!response.ok) {
        throw new Error(`Server error: ${response.status}`);
      }

      const result = await response.json();
      
      // Handle both old format (array) and new format ({data, total, limit, offset})
      let leaguesData, total;
      if (Array.isArray(result)) {
        // Old format - backward compatibility
        leaguesData = result;
        total = result.length;
      } else {
        // New format with pagination info
        leaguesData = result.data || [];
        total = result.total || 0;
      }

      if (append) {
        setLeagues(prev => [...prev, ...leaguesData]);
        setCurrentOffset(prev => prev + leaguesData.length);
      } else {
        setLeagues(leaguesData);
        setCurrentOffset(leaguesData.length);
      }
      setTotalCount(total);

    } catch (e) {
      console.error("[LeaguesPage] Failed to fetch leagues:", e);
      setErr(e.message || "Fehler beim Laden der Ligen");
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  // Initial load: fetch metadata (cities, sports, etc.) and user info
  useEffect(() => {
    let mounted = true;
    
    const token = localStorage.getItem("token");
    const fetchPromises = [
      fetch(`${API_BASE}/sports/categories`).then(r => r.ok ? r.json() : []),
      fetch(`${API_BASE}/countries/list`).then(r => r.ok ? r.json() : []),
      fetch(`${API_BASE}/states/list`).then(r => r.ok ? r.json() : []),
    ];

    if (token) {
      fetchPromises.push(
        fetch(`${API_BASE}/me`, { headers: { Authorization: `Bearer ${token}` } })
          .then(r => r.ok ? r.json() : null)
          .then(data => {
            if (mounted && data) {
              setUserProfile(data);
              if (data.city_id || data.cityId) {
                setSelectedCity(String(data.city_id || data.cityId));
              }
            }
            return data;
          })
          .catch(() => null),
        
        fetch(`${API_BASE}/me/leagues`, { headers: { Authorization: `Bearer ${token}` } })
          .then(r => r.ok ? r.json() : [])
          .then(data => {
            if (mounted && Array.isArray(data)) {
              setUserLeagues(data);
            }
            return data;
          })
          .catch(() => [])
      );
    }

    Promise.all(fetchPromises)
      .then(([sportsData, countriesData, statesData]) => {
        if (!mounted) return;
        setSports(Array.isArray(sportsData) ? sportsData : []);
        setCountries(Array.isArray(countriesData) ? countriesData : []);
        setStates(Array.isArray(statesData) ? statesData : []);
      })
      .catch(e => {
        console.error("[LeaguesPage] Failed to load metadata:", e);
      });

    return () => { mounted = false; };
  }, []);

  // If a cityId is set (from URL or profile), resolve its display name without loading all cities.
  useEffect(() => {
    let mounted = true;

    async function loadCityNameIfNeeded() {
      try {
        if (!selectedCity) return;
        if (selectedCityName) return;
        const id = String(selectedCity).trim();
        if (!id) return;
        const r = await fetch(`${API_BASE}/cities/${encodeURIComponent(id)}`);
        if (!r.ok) return;
        const json = await r.json();
        const city = json && json.city ? json.city : json;
        if (!mounted) return;
        if (city && city.name) {
          setSelectedCityName(String(city.name));
        }
      } catch (e) {
        // non-fatal
      }
    }

    loadCityNameIfNeeded();
    return () => { mounted = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCity]);

  // Lazy-load cities for a state when user expands it in the LocationSelector.
  const handleLoadCitiesForState = async (stateId) => {
    const sid = String(stateId || '').trim();
    if (!sid) return;
    if (loadedStateCities.has(sid)) return;

    setLoadedStateCities((prev) => {
      const next = new Set(prev);
      next.add(sid);
      return next;
    });

    try {
      const params = new URLSearchParams();
      params.set('compact', '1');
      params.set('state_id', sid);
      params.set('limit', '500');
      const r = await fetch(`${API_BASE}/cities/list?${params.toString()}`);
      const rows = r.ok ? await r.json() : [];
      const list = Array.isArray(rows) ? rows : [];
      setCities((prev) => {
        const seen = new Set((prev || []).map((c) => String(c.id)));
        const merged = [...(prev || [])];
        for (const c of list) {
          if (!c || c.id == null) continue;
          const key = String(c.id);
          if (seen.has(key)) continue;
          seen.add(key);
          merged.push(c);
        }
        return merged;
      });
    } catch (e) {
      // non-fatal
    }
  };

  // Fetch leagues whenever filters change (with debouncing for search)
  useEffect(() => {
    // Don't fetch until sports are loaded (cities are lazy)
    if (sports.length === 0) return;
    
    // Debounce search queries to avoid API spam on every keystroke
    const debounceTimer = setTimeout(() => {
      setCurrentOffset(0);
      fetchLeagues(false);
    }, searchQuery ? 500 : 0); // 500ms delay for search, instant for other filters
    
    return () => clearTimeout(debounceTimer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCity, selectedSport, searchQuery, sports.length]);

  // Apply client-side filters only for "Meine Ligen" (can't be done server-side without auth)
  const visibleLeagues = useMemo(() => {
    if (!showMyLeaguesOnly) {
      return leagues; // Server already filtered by city, sport, search
    }
    
    // Filter for user's leagues only
    return leagues.filter(l => 
      userLeagues.some(userLeague => String(userLeague.id) === String(l.id))
    );
  }, [leagues, showMyLeaguesOnly, userLeagues]);

  // Handle sort
  const handleSort = (column) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(column);
      setSortDirection('asc');
    }
  };

  // Sorted leagues
  const sortedVisibleLeagues = useMemo(() => {
    if (!sortColumn) return visibleLeagues;

    return [...visibleLeagues].sort((a, b) => {
      let aVal, bVal;

      switch (sortColumn) {
        case 'name':
          aVal = (a.name || '').toLowerCase();
          bVal = (b.name || '').toLowerCase();
          break;
        case 'city':
          aVal = (a.city || a.cityName || '').toLowerCase();
          bVal = (b.city || b.cityName || '').toLowerCase();
          break;
        case 'sport':
          aVal = (a.sport || a.sportName || '').toLowerCase();
          bVal = (b.sport || b.sportName || '').toLowerCase();
          break;
        case 'members':
          aVal = membersCount[a.id] ?? 0;
          bVal = membersCount[b.id] ?? 0;
          break;
        default:
          return 0;
      }

      // Handle null/undefined
      if (aVal === null || aVal === undefined) return 1;
      if (bVal === null || bVal === undefined) return -1;

      // Compare
      let comparison = 0;
      if (typeof aVal === 'number' && typeof bVal === 'number') {
        comparison = aVal - bVal;
      } else {
        comparison = String(aVal).localeCompare(String(bVal));
      }

      return sortDirection === 'asc' ? comparison : -comparison;
    });
  }, [visibleLeagues, sortColumn, sortDirection, membersCount]);

  // PERFORMANCE: Removed verbose logging that was spamming console

  // PERFORMANCE FIX: Disable reachability checks (causes N parallel API calls)
  // Reachability check disabled - was causing 20+ parallel API calls per page load
  // TODO: Create bulk endpoint /api/leagues/reachability if needed
  useEffect(() => {
    // Skip reachability checks for performance
    // Each check was making a separate API call per league
    return () => {};
  }, [leagues, visibleLeagues]);

  // TEMPORARILY DISABLED: Members count loading (too many API calls)
  // TODO: Create bulk endpoint /api/leagues/members-count that accepts league IDs
  useEffect(() => {
    setLoadingCounts(false);
    // Don't load individual member counts - causes 200+ API calls
    return () => {};
  }, [visibleLeagues]);

  // Format league name: special logic for community leagues
  function formatLeagueName(l) {
    const rawName = String(l.name || "").trim();

    // heuristics or flags for community leagues
    const isCommunity =
      Boolean(l.is_community || l.community || l.isCommunity || l.type === "community") ||
      /community/i.test(rawName);

    if (!isCommunity) {
      return rawName || `Liga ${l.id}`;
    }

    const sport = l.sportName || l.sport || l.sport_id || l.sportId || "";
    const city = l.cityName || l.city || l.city_id || l.cityId || "";

    const sportPart = String(sport || "").trim();
    const cityPart = String(city || "").trim();

    if (sportPart && cityPart) {
      return `${cityPart} ${sportPart} Match League`;
    }
    if (sportPart) {
      return `${sportPart} Community League`;
    }
    if (cityPart) {
      return `${cityPart} Community League`;
    }
    return rawName || `Community League ${l.id}`;
  }

  if (loading) return <div style={{ padding: 16 }}>Lade Ligen …</div>;
  if (err) {
    if (handleInvalidToken(err, navigate)) return null;
    return <div style={{ padding: 16, color: "crimson" }}>Fehler: {err}</div>;
  }

  return (
    <LeaguesFeature>
      <div className="ml-container" style={{ padding: "32px 24px" }}>
        <div style={{ marginBottom: 32 }}>
        <h1 style={{ 
          margin: "0 0 8px 0", 
          fontSize: 32, 
          fontWeight: 700, 
          color: "#e5e7eb" 
        }}>
          Ligen
        </h1>
        <p style={{ 
          margin: 0, 
          color: "#9ca3af", 
          fontSize: 16,
          lineHeight: 1.5 
        }}>
          Finde die perfekte Liga für deinen Sport in deiner Region
        </p>
      </div>

      {/* Enhanced Filter Section */}
      <div style={{ 
        background: 'linear-gradient(135deg,#071716,#0d2422)',
        border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: 16,
        padding: 24,
        marginBottom: 32,
        boxShadow: '0 8px 32px -8px rgba(0,0,0,0.4)'
      }}>
        <h3 style={{ 
          margin: "0 0 20px 0", 
          fontSize: 18, 
          fontWeight: 600, 
          color: "#e5e7eb" 
        }}>
          Filter & Suche
        </h3>
        
        {/* Search Field */}
        <div style={{ marginBottom: 20 }}>
          <label style={{ 
            display: 'block',
            marginBottom: 8,
            fontWeight: 600,
            color: '#e5e7eb',
            fontSize: 14
          }}>
            Suche
          </label>
          <input
            type="text"
            placeholder="Liga, Stadt oder Sport suchen..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            style={{
              width: '100%',
              padding: '12px 16px',
              border: '1px solid rgba(255,255,255,0.12)',
              borderRadius: 8,
              fontSize: 15,
              background: 'rgba(255,255,255,0.05)',
              color: '#e5e7eb',
              outline: 'none',
              transition: 'border-color 0.2s'
            }}
            onFocus={(e) => e.target.style.borderColor = '#48baa6'}
            onBlur={(e) => e.target.style.borderColor = 'rgba(255,255,255,0.12)'}
          />
        </div>

        {/* Filter Grid - 2 columns: Sport + Stadt */}
        <div style={{ 
          display: "grid", 
          gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))", 
          gap: 16,
          marginBottom: 20
        }}>
          <div>
            <label style={{ 
              display: 'block',
              marginBottom: 8,
              fontWeight: 600,
              color: '#e5e7eb',
              fontSize: 14
            }}>
              Sport
            </label>
            <SportSelector
              sports={sports}
              value={selectedSportName}
              onChange={(sportName, sportId) => {
                setSelectedSportName(sportName);
                setSelectedSport(String(sportId));
              }}
              placeholder="Sportart wählen..."
            />
          </div>

          <div>
            <label style={{ 
              display: 'block',
              marginBottom: 8,
              fontWeight: 600,
              color: '#e5e7eb',
              fontSize: 14
            }}>
              Stadt
            </label>
            <LocationSelector
              cities={cities}
              countries={countries}
              states={states}
              value={selectedCityName}
              onChange={(cityName, cityId) => {
                setSelectedCityName(cityName);
                setSelectedCity(String(cityId));
                handleCitySelect(String(cityId));
              }}
              onLoadCities={handleLoadCitiesForState}
              placeholder="Stadt wählen..."
            />
          </div>
        </div>

        {/* My Leagues Filter */}
        {userLeagues.length > 0 && (
          <div style={{ marginBottom: 20 }}>
            <label style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              cursor: 'pointer',
              fontSize: 14,
              color: '#e5e7eb'
            }}>
              <input
                type="checkbox"
                checked={showMyLeaguesOnly}
                onChange={e => setShowMyLeaguesOnly(e.target.checked)}
                style={{
                  width: 18,
                  height: 18,
                  accentColor: '#48baa6'
                }}
              />
              <span style={{ fontWeight: 600 }}>
                Nur meine Ligen anzeigen 
                <span style={{ 
                  color: '#9ca3af', 
                  fontWeight: 400,
                  marginLeft: 4
                }}>
                  ({userLeagues.length})
                </span>
              </span>
            </label>
          </div>
        )}

        {/* Action Buttons */}
        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
          <button 
            onClick={() => { 
              setSelectedCity(""); 
              setSelectedCityName("");
              setSelectedSport(""); 
              setSelectedSportName("");
              setSearchQuery("");
              setShowMyLeaguesOnly(false);
            }}
            className="btn btn-primary"
            style={{ fontSize: 14 }}
          >
            Alle Filter zurücksetzen
          </button>
          
          <div style={{ 
            padding: "8px 12px",
            background: "rgba(72,186,170,0.1)",
            border: "1px solid rgba(72,186,170,0.2)",
            borderRadius: 6,
            fontSize: 13,
            color: "#48baa6"
          }}>
            {visibleLeagues.length} Ligen gefunden
          </div>
        </div>
      </div>

      {/* Enhanced League Cards/Table */}
      {visibleLeagues.length === 0 ? (
        <div style={{ 
          textAlign: 'center',
          padding: 48,
          background: 'rgba(255,255,255,0.02)',
          borderRadius: 16,
          border: '1px solid rgba(255,255,255,0.05)'
        }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>🔍</div>
          <h3 style={{ margin: "0 0 8px", color: "#e5e7eb" }}>Keine Ligen gefunden</h3>
          <p style={{ margin: 0, color: "#9ca3af" }}>
            Versuche andere Filter oder erweitere deine Suche
          </p>
        </div>
      ) : (
        <div style={{ 
          background: 'rgba(255,255,255,0.02)',
          borderRadius: 16,
          border: '1px solid rgba(255,255,255,0.08)',
          overflow: 'hidden'
        }}>
          <div style={{ overflowX: "auto" }}>
            <table style={{ 
              width: "100%", 
              borderCollapse: "collapse",
              fontSize: 14
            }}>
              <thead>
                <tr style={{ 
                  background: 'rgba(255,255,255,0.05)',
                  borderBottom: "1px solid rgba(255,255,255,0.1)"
                }}>
                  <th 
                    onClick={() => handleSort('name')}
                    style={{ 
                      padding: "16px 20px", 
                      textAlign: "left",
                      fontWeight: 600,
                      color: "#e5e7eb",
                      fontSize: 13,
                      textTransform: "uppercase",
                      letterSpacing: "0.5px",
                      cursor: "pointer",
                      userSelect: "none",
                      transition: "background-color 0.2s"
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.08)'}
                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                  >
                    Liga {sortColumn === 'name' && (sortDirection === 'asc' ? '▲' : '▼')}
                  </th>
                  <th 
                    onClick={() => handleSort('city')}
                    style={{ 
                      padding: "16px 20px", 
                      textAlign: "left",
                      fontWeight: 600,
                      color: "#e5e7eb",
                      fontSize: 13,
                      textTransform: "uppercase",
                      letterSpacing: "0.5px",
                      cursor: "pointer",
                      userSelect: "none",
                      transition: "background-color 0.2s"
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.08)'}
                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                  >
                    Ort {sortColumn === 'city' && (sortDirection === 'asc' ? '▲' : '▼')}
                  </th>
                  <th 
                    onClick={() => handleSort('sport')}
                    style={{ 
                      padding: "16px 20px", 
                      textAlign: "left",
                      fontWeight: 600,
                      color: "#e5e7eb",
                      fontSize: 13,
                      textTransform: "uppercase",
                      letterSpacing: "0.5px",
                      cursor: "pointer",
                      userSelect: "none",
                      transition: "background-color 0.2s"
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.08)'}
                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                  >
                    Sport {sortColumn === 'sport' && (sortDirection === 'asc' ? '▲' : '▼')}
                  </th>
                  <th 
                    onClick={() => handleSort('members')}
                    style={{ 
                      padding: "16px 20px", 
                      textAlign: "center",
                      fontWeight: 600,
                      color: "#e5e7eb",
                      fontSize: 13,
                      textTransform: "uppercase",
                      letterSpacing: "0.5px",
                      cursor: "pointer",
                      userSelect: "none",
                      transition: "background-color 0.2s"
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.08)'}
                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                  >
                    Mitglieder {sortColumn === 'members' && (sortDirection === 'asc' ? '▲' : '▼')}
                  </th>
                  <th style={{ 
                    padding: "16px 20px", 
                    textAlign: "right",
                    fontWeight: 600,
                    color: "#e5e7eb",
                    fontSize: 13,
                    textTransform: "uppercase",
                    letterSpacing: "0.5px"
                  }}>Aktion</th>
                </tr>
              </thead>
              <tbody>
                {sortedVisibleLeagues.map((l, index) => {
                  const idKey = l.id;
                  const memberCount = membersCount[idKey] ?? membersCount[String(idKey)] ?? (loadingCounts ? "…" : 0);
                  return (
                    <tr 
                      key={idKey} 
                      style={{ 
                        borderBottom: index < sortedVisibleLeagues.length - 1 ? "1px solid rgba(255,255,255,0.05)" : "none",
                        transition: "background-color 0.2s",
                        cursor: "pointer"
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.03)'}
                      onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                    >
                      <td style={{ padding: "20px", verticalAlign: "middle" }}>
                        <div>
                          <Link 
                            to={`/league/${idKey}`}
                            style={{ 
                              color: "#e5e7eb",
                              textDecoration: "none",
                              fontWeight: 600,
                              fontSize: 15
                            }}
                            onMouseEnter={(e) => e.target.style.color = '#48baa6'}
                            onMouseLeave={(e) => e.target.style.color = '#e5e7eb'}
                          >
                            {formatLeagueName(l)}
                          </Link>
                          {reachable[idKey] && !reachable[idKey].ok && (
                            <div style={{ 
                              color: "#ef4444", 
                              fontSize: 11,
                              marginTop: 4,
                              opacity: 0.8
                            }}>
                              Detail nicht verfügbar
                            </div>
                          )}
                        </div>
                      </td>
                      <td style={{ padding: "20px", verticalAlign: "middle" }}>
                        <span style={{ color: "#9ca3af" }}>
                          {l.city || l.cityName || l.city_id || l.cityId || "-"}
                        </span>
                      </td>
                      <td style={{ padding: "20px", verticalAlign: "middle" }}>
                        <span style={{ 
                          background: "rgba(72,186,170,0.1)",
                          color: "#48baa6",
                          padding: "4px 8px",
                          borderRadius: 4,
                          fontSize: 12,
                          fontWeight: 500
                        }}>
                          {l.sport || l.sportName || l.sport_id || l.sportId || "-"}
                        </span>
                      </td>
                      <td style={{ padding: "20px", verticalAlign: "middle", textAlign: "center" }}>
                        <span style={{ 
                          background: "rgba(255,255,255,0.05)",
                          color: "#e5e7eb",
                          padding: "6px 10px",
                          borderRadius: 12,
                          fontSize: 13,
                          fontWeight: 600,
                          minWidth: 40,
                          display: "inline-block"
                        }}>
                          {memberCount}
                        </span>
                      </td>
                      <td style={{ padding: "20px", verticalAlign: "middle", textAlign: "right" }}>
                        {(() => {
                          const isUserMember = userLeagues.some(userLeague => String(userLeague.id) === String(idKey));
                          
                          if (isUserMember) {
                            return (
                              <Link 
                                to={`/league/${idKey}`}
                                className="btn"
                                style={{ 
                                  padding: "8px 16px",
                                  fontSize: 13,
                                  textDecoration: "none",
                                  display: "inline-block",
                                  background: "rgba(72,186,170,0.2)",
                                  color: "#48baa6",
                                  border: "1px solid #48baa6"
                                }}
                              >
                                ℹ️ Info
                              </Link>
                            );
                          } else {
                            return (
                              <Link 
                                to={`/league/${idKey}`}
                                className="btn btn-gold"
                                style={{ 
                                  padding: "8px 16px",
                                  fontSize: 13,
                                  textDecoration: "none",
                                  display: "inline-block"
                                }}
                              >
                                Beitreten
                              </Link>
                            );
                          }
                        })()}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Load More Button */}
      {!loading && leagues.length > 0 && currentOffset < totalCount && (
        <div style={{ 
          textAlign: 'center', 
          marginTop: 24,
          padding: 16
        }}>
          <button
            onClick={() => fetchLeagues(true)}
            disabled={loadingMore}
            className="btn"
            style={{
              padding: "12px 32px",
              fontSize: 14,
              fontWeight: 600,
              background: loadingMore ? 'rgba(255,255,255,0.05)' : 'rgba(72,186,170,0.2)',
              color: loadingMore ? '#9ca3af' : '#48baa6',
              border: loadingMore ? '1px solid rgba(255,255,255,0.1)' : '1px solid #48baa6',
              cursor: loadingMore ? 'not-allowed' : 'pointer',
              transition: 'all 0.2s'
            }}
          >
            {loadingMore ? 'Lädt...' : `Mehr laden (${currentOffset} von ${totalCount})`}
          </button>
          <div style={{ 
            marginTop: 8, 
            color: '#9ca3af',
            fontSize: 13
          }}>
            {totalCount - currentOffset} weitere Ligen verfügbar
          </div>
        </div>
      )}

      {/* Total count info */}
      {!loading && totalCount > 0 && (
        <div style={{ 
          textAlign: 'center',
          marginTop: 16,
          padding: 8,
          color: '#9ca3af',
          fontSize: 13
        }}>
          Zeige {Math.min(currentOffset, totalCount)} von {totalCount} Ligen
        </div>
      )}
      </div>
    </LeaguesFeature>
  );
}