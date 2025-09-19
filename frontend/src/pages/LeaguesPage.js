import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { API_BASE } from "../config";

export default function LeaguesPage() {
  const [leagues, setLeagues] = useState([]);
  const [cities, setCities] = useState([]);
  const [sports, setSports] = useState([]);
  const [selectedCity, setSelectedCity] = useState("");
  const [selectedSport, setSelectedSport] = useState("");
  const [membersCount, setMembersCount] = useState({});
  const [loading, setLoading] = useState(true);
  const [loadingCounts, setLoadingCounts] = useState(false);
  const [err, setErr] = useState("");

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
    Promise.all([
      fetch(`${API_BASE}/leagues`).then(r => (r.ok ? r.json() : Promise.reject(new Error(`/leagues ${r.status}`)))),
      fetch(`${API_BASE}/cities/list`).then(r => (r.ok ? r.json() : [])),
      fetch(`${API_BASE}/sports/list`).then(r => (r.ok ? r.json() : [])),
    ])
      .then(([leaguesData, citiesData, sportsData]) => {
        if (!mounted) return;
        setLeagues(Array.isArray(leaguesData) ? leaguesData : []);
        setCities(Array.isArray(citiesData) ? citiesData : []);
        setSports(Array.isArray(sportsData) ? sportsData : []);
      })
      .catch(e => {
        if (!mounted) return;
        setErr(e.message || "Fehler beim Laden");
      })
      .finally(() => { if (mounted) setLoading(false); });
    return () => { mounted = false; };
  }, []);

  // visibleLeagues MUST be declared before effects that reference it -> moved here
  // Show all leagues by default; apply city/sport filters only when set
  const visibleLeagues = useMemo(() => {
    return leagues.filter(l => {
      const byCity = selectedCity ? (selectedCityObj ? leagueMatchesCity(l, selectedCityObj, false) : true) : true;
      const leagueSportId = l.sportId ?? l.sport_id ?? l.sport ?? l.sportName ?? "";
      const bySport = selectedSport ? (
            String(leagueSportId) === String(selectedSportObj?.id)
            || (typeof leagueSportId === "string" && normalize(leagueSportId) === normalize(selectedSportObj?.name || ""))
          ) : true;
      return byCity && bySport;
    });
  }, [leagues, selectedCity, selectedSport, selectedCityObj, selectedSportObj]);

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
    <div style={{ padding: 16 }}>
      <h2>Ligen</h2>

      <div style={{ margin: "12px 0", display: "flex", gap: 12, alignItems: "center" }}>
        <label>
          Stadt:
          <select value={selectedCity} onChange={e => handleCitySelect(e.target.value)} style={{ marginLeft: 8 }}>
            <option value="">— alle Städte —</option>
            {cities.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </label>

        <label>
          Sport:
          <select value={selectedSport} onChange={e => setSelectedSport(e.target.value)} style={{ marginLeft: 8 }}>
            <option value="">— alle —</option>
            {sports.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </label>

        <button onClick={() => { setSelectedCity(""); setSelectedSport(""); }}>Zurücksetzen</button>
      </div>

      {/* summary (kept minimal) */}
      <div style={{ fontSize: 12, color: "#666", marginBottom: 10 }}>
        <div>Gefundene Ligen: {visibleLeagues.length} (Filter: Stadt={selectedCity || "alle"}, Sport={selectedSport || "alle"})</div>
      </div>

      {/* Table view of visible leagues */}
      {visibleLeagues.length === 0 ? (
        <div>Keine Ligen gefunden.</div>
      ) : (
        <div style={{ overflowX: "auto", marginTop: 8 }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ textAlign: "left", borderBottom: "2px solid #444" }}>
                <th style={{ padding: "8px 6px" }}>ID</th>
                <th style={{ padding: "8px 6px" }}>Name</th>
                <th style={{ padding: "8px 6px" }}>Stadt</th>
                <th style={{ padding: "8px 6px" }}>Sport</th>
                <th style={{ padding: "8px 6px" }}>Mitglieder</th>
                <th style={{ padding: "8px 6px" }}>Aktion</th>
              </tr>
            </thead>
            <tbody>
              {visibleLeagues.map(l => {
                const idKey = l.id;
                const memberCount = membersCount[idKey] ?? membersCount[String(idKey)] ?? (loadingCounts ? "…" : 0);
                return (
                  <tr key={idKey} style={{ borderBottom: "1px solid rgba(255,255,255,0.03)" }}>
                    <td style={{ padding: "8px 6px", verticalAlign: "middle" }}>{idKey}</td>
                    <td style={{ padding: "8px 6px", verticalAlign: "middle", fontWeight: 600 }}>
                      <Link to={`/league/${idKey}`}>{l.name || `Liga ${idKey}`}</Link>
                      {reachable[idKey] && !reachable[idKey].ok ? (
                        <span style={{ color: "crimson", marginLeft: 8, fontSize: 12 }}>
                          (Detail nicht erreichbar)
                        </span>
                      ) : null}
                    </td>
                    <td style={{ padding: "8px 6px", verticalAlign: "middle" }}>{l.city || l.cityName || l.city_id || l.cityId || "-"}</td>
                    <td style={{ padding: "8px 6px", verticalAlign: "middle" }}>{l.sport || l.sportName || l.sport_id || l.sportId || "-"}</td>
                    <td style={{ padding: "8px 6px", verticalAlign: "middle" }}>{memberCount}</td>
                    <td style={{ padding: "8px 6px", verticalAlign: "middle" }}>
                      <Link to={`/league/${idKey}`} style={{ marginRight: 8 }}>Zur Liga</Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}