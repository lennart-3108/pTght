import React, { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { API_BASE } from "../config";
import LocationSelector from "../components/LocationSelector";
import SportSelector from "../components/SportSelector";

export default function LeaguesPage() {
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
  const [loadingCounts, setLoadingCounts] = useState(false);
  const [err, setErr] = useState("");
  const [userProfile, setUserProfile] = useState(null);

  // Reachability state: { [leagueId]: { ok: boolean, status: number|null, error: string|null } }
  const [reachable, setReachable] = useState({});

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
  async function handleCitySelect(value) {
    console.log("[LeaguesPage] City selection changed (raw):", value);
    setSelectedCity(value);
    const raw = String(value || "").trim();
    const byId = cities.find(c => String(c.id) === raw);
    const byName = cities.find(c => normalize(c.name) === normalize(raw));
    const resolved = byId || byName || (raw ? { id: raw, name: raw } : null);
    console.log("[LeaguesPage] Resolved selectedCityObj:", resolved);

    // Try to fetch a fresh full list from server for a complete scan.
    // Backend typically returns all leagues for /leagues; adding ?full=1 as a hint.
    let allLeagues = leagues || [];
    try {
      const r = await fetch(`${API_BASE}/leagues?full=1`);
      if (r.ok) {
        const json = await r.json().catch(() => null);
        if (Array.isArray(json) && json.length > (allLeagues.length || 0)) {
          allLeagues = json;
          console.log("[LeaguesPage] Fetched full leagues list for preview, count:", allLeagues.length);
        } else {
          console.log("[LeaguesPage] Server returned leagues (count):", Array.isArray(json) ? json.length : "n/a");
        }
      } else {
        console.warn("[LeaguesPage] Could not fetch full leagues list, using cached leagues. HTTP", r.status);
      }
    } catch (e) {
      console.warn("[LeaguesPage] Fetch full leagues failed, using cached leagues:", e && e.message);
    }

    // Scan all entries and log matches. Keep per-item verbose limited to avoid huge console output.
    const previewAll = allLeagues;
    const total = previewAll.length;
    console.group(`[LeaguesPage] Detailed match preview for city=${JSON.stringify(resolved)} — scanning ${total} leagues`);
    let matchCount = 0;
    const matchedIds = [];
    const VERBOSE_LIMIT = 200; // verbose per-league logs for first N entries
    for (let i = 0; i < previewAll.length; i++) {
      const l = previewAll[i];
      const verbose = i < VERBOSE_LIMIT;
      const ok = leagueMatchesCity(l, resolved, verbose);
      if (ok) {
        matchCount++;
        matchedIds.push(l.id);
      }
    }
    console.log(`[LeaguesPage] Preview scanned ${total} leagues, matched ${matchCount}`, { matchedIds: matchedIds.slice(0, 200) });
    if (matchedIds.length > 200) console.log(`[LeaguesPage] ...and ${matchedIds.length - 200} more matched IDs omitted from sample`);
    console.groupEnd();
  }

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    setErr("");
    
    // Lade Benutzerprofil für Auto-Auswahl der Stadt
    const token = localStorage.getItem("token");
    if (token) {
      // Lade Benutzer-Profil
      fetch(`${API_BASE}/me`, { headers: { Authorization: `Bearer ${token}` } })
        .then(r => r.ok ? r.json() : null)
        .then(data => {
          if (mounted && data) {
            setUserProfile(data);
            // Auto-select user's city if available
            if (data.city_id || data.cityId) {
              setSelectedCity(String(data.city_id || data.cityId));
            }
          }
        })
        .catch(() => {});
      
      // Lade Benutzer-Ligen
      fetch(`${API_BASE}/me/leagues`, { headers: { Authorization: `Bearer ${token}` } })
        .then(r => r.ok ? r.json() : [])
        .then(data => {
          if (mounted && Array.isArray(data)) {
            setUserLeagues(data);
            console.log("[LeaguesPage] User leagues loaded:", data);
          }
        })
        .catch(error => {
          console.warn("[LeaguesPage] Failed to load user leagues:", error);
        });
    }

    Promise.all([
      fetch(`${API_BASE}/leagues`).then(r => (r.ok ? r.json() : Promise.reject(new Error(`/leagues ${r.status}`)))),
      fetch(`${API_BASE}/cities/list`).then(r => (r.ok ? r.json() : [])),
      fetch(`${API_BASE}/sports/list`).then(r => (r.ok ? r.json() : [])),
      fetch(`${API_BASE}/countries/list`).then(r => (r.ok ? r.json() : [])),
      fetch(`${API_BASE}/states/list`).then(r => (r.ok ? r.json() : [])),
    ])
      .then(([leaguesData, citiesData, sportsData, countriesData, statesData]) => {
        if (!mounted) return;
        setLeagues(Array.isArray(leaguesData) ? leaguesData : []);
        setCities(Array.isArray(citiesData) ? citiesData : []);
        setSports(Array.isArray(sportsData) ? sportsData : []);
        setCountries(Array.isArray(countriesData) ? countriesData : []);
        setStates(Array.isArray(statesData) ? statesData : []);
      })
      .catch(e => {
        if (!mounted) return;
        setErr(e.message || "Fehler beim Laden");
      })
      .finally(() => { if (mounted) setLoading(false); });
    return () => { mounted = false; };
  }, []);

  // Show all leagues by default; apply filters
  const visibleLeagues = useMemo(() => {
    return leagues.filter(l => {
      // City filter
      const byCity = selectedCity ? (selectedCityObj ? leagueMatchesCity(l, selectedCityObj, false) : true) : true;
      
      // Sport filter
      const leagueSportId = l.sportId ?? l.sport_id ?? l.sport ?? l.sportName ?? "";
      const bySport = selectedSport ? (
            String(leagueSportId) === String(selectedSportObj?.id)
            || (typeof leagueSportId === "string" && normalize(leagueSportId) === normalize(selectedSportObj?.name || ""))
          ) : true;
      
      // Search query filter
      const bySearch = searchQuery ? (
        normalize(l.name || "").includes(normalize(searchQuery)) ||
        normalize(l.city || l.cityName || "").includes(normalize(searchQuery)) ||
        normalize(l.sport || l.sportName || "").includes(normalize(searchQuery))
      ) : true;
      
      // "Meine Ligen" filter
      const byMyLeagues = showMyLeaguesOnly ? 
        userLeagues.some(userLeague => String(userLeague.id) === String(l.id)) : true;
      
      return byCity && bySport && bySearch && byMyLeagues;
    });
  }, [leagues, selectedCity, selectedSport, searchQuery, showMyLeaguesOnly, userLeagues, selectedCityObj, selectedSportObj]);

  // Log whenever visibleLeagues changes
  useEffect(() => {
    console.log("[LeaguesPage] visibleLeagues changed:", {
      selectedCity,
      selectedCityObj,
      selectedSport,
      selectedSportObj,
      count: visibleLeagues.length,
      sample: visibleLeagues.slice(0, 8).map(l => ({ id: l.id, name: l.name, city: l.city || l.cityName })),
    });
  }, [visibleLeagues, selectedCity, selectedSport, selectedCityObj, selectedSportObj]);

  // Reachability check: try GET /leagues/:id for relevant leagues
  useEffect(() => {
    let mounted = true;
    const targets = (visibleLeagues && visibleLeagues.length > 0) ? visibleLeagues : leagues;
    if (!targets || targets.length === 0) {
      // nothing to check
      return;
    }

    console.log("[LeaguesPage] Starting reachability checks for", targets.length, "leagues");
    const ctrls = {};
    (async () => {
      const out = {};
      await Promise.all(targets.map(async (l) => {
        const id = l.id;
        const controller = new AbortController();
        ctrls[id] = controller;
        const timeout = setTimeout(() => controller.abort(), 3000);
        try {
          const r = await fetch(`${API_BASE}/leagues/${id}`, { signal: controller.signal });
          clearTimeout(timeout);
          out[id] = { ok: r.ok, status: r.status, error: r.ok ? null : `HTTP ${r.status}` };
          if (!r.ok) console.warn(`[LeaguesPage] league ${id} detail returned ${r.status}`);
        } catch (e) {
          clearTimeout(timeout);
          out[id] = { ok: false, status: null, error: (e && e.name === "AbortError") ? "timeout" : (e && e.message) || "fetch error" };
          console.error(`[LeaguesPage] league ${id} detail fetch error:`, out[id].error);
        }
      }));
      if (!mounted) return;
      setReachable(prev => ({ ...prev, ...out }));
      console.log("[LeaguesPage] reachability results:", out);
    })();

    return () => {
      mounted = false;
      Object.values(ctrls).forEach(c => c.abort && c.abort());
    };
  }, [leagues, visibleLeagues]);

  // load members count for visible leagues
  useEffect(() => {
    let mounted = true;
    if (!visibleLeagues || visibleLeagues.length === 0) {
      // clear counts when none visible
      setMembersCount(prev => {
        // keep existing counts (optional) — here we keep existing
        return prev;
      });
      return;
    }
    // debug: log which leagues we will fetch counts for
    console.log("[LeaguesPage] Loading members counts for leagues:", visibleLeagues.map(l => ({ id: l.id, name: l.name })));
    setLoadingCounts(true);
    (async () => {
      try {
        const results = await Promise.all(visibleLeagues.map(async (l) => {
          try {
            const r = await fetch(`${API_BASE}/leagues/${l.id}/members`);
            if (!r.ok) {
              console.warn(`[LeaguesPage] members fetch returned ${r.status} for league ${l.id}`);
              return { id: l.id, count: 0 };
            }
            const arr = await r.json().catch(() => []);
            return { id: l.id, count: Array.isArray(arr) ? arr.length : 0 };
          } catch (err) {
            console.error(`[LeaguesPage] members fetch error for league ${l.id}:`, err && (err.message || err));
            return { id: l.id, count: 0 };
          }
        }));
        if (!mounted) return;
        console.log("[LeaguesPage] members counts fetched:", results);
        setMembersCount(prev => {
          const copy = { ...prev };
          results.forEach(x => { copy[x.id] = x.count; });
          return copy;
        });
      } finally {
        if (mounted) setLoadingCounts(false);
      }
    })();
    return () => { mounted = false; };
  }, [visibleLeagues]);

  if (loading) return <div style={{ padding: 16 }}>Lade Ligen …</div>;
  if (err) return <div style={{ padding: 16, color: "crimson" }}>Fehler: {err}</div>;

  return (
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
                  <th style={{ 
                    padding: "16px 20px", 
                    textAlign: "left",
                    fontWeight: 600,
                    color: "#e5e7eb",
                    fontSize: 13,
                    textTransform: "uppercase",
                    letterSpacing: "0.5px"
                  }}>Liga</th>
                  <th style={{ 
                    padding: "16px 20px", 
                    textAlign: "left",
                    fontWeight: 600,
                    color: "#e5e7eb",
                    fontSize: 13,
                    textTransform: "uppercase",
                    letterSpacing: "0.5px"
                  }}>Ort</th>
                  <th style={{ 
                    padding: "16px 20px", 
                    textAlign: "left",
                    fontWeight: 600,
                    color: "#e5e7eb",
                    fontSize: 13,
                    textTransform: "uppercase",
                    letterSpacing: "0.5px"
                  }}>Sport</th>
                  <th style={{ 
                    padding: "16px 20px", 
                    textAlign: "center",
                    fontWeight: 600,
                    color: "#e5e7eb",
                    fontSize: 13,
                    textTransform: "uppercase",
                    letterSpacing: "0.5px"
                  }}>Mitglieder</th>
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
                {visibleLeagues.map((l, index) => {
                  const idKey = l.id;
                  const memberCount = membersCount[idKey] ?? membersCount[String(idKey)] ?? (loadingCounts ? "…" : 0);
                  return (
                    <tr 
                      key={idKey} 
                      style={{ 
                        borderBottom: index < visibleLeagues.length - 1 ? "1px solid rgba(255,255,255,0.05)" : "none",
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
                            {l.name || `Liga ${idKey}`}
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
    </div>
  );
}