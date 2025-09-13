import React, { useEffect, useMemo, useState } from "react";

export default function CreatePage() {
  const [schema, setSchema] = useState(null);
  const [table, setTable] = useState("");
  const [form, setForm] = useState({});
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [result, setResult] = useState(null);
  const [cities, setCities] = useState([]);
  const [sports, setSports] = useState([]);
  // Spiele-spezifische Hilfszustände
  const [gameSportId, setGameSportId] = useState("");
  const [leaguesForSport, setLeaguesForSport] = useState([]);
  const [leagueMembers, setLeagueMembers] = useState([]);

  const token = localStorage.getItem("token");

  // Schema laden
  useEffect(() => {
    let mounted = true;
    setLoading(true);
    setErr("");
    fetch("http://localhost:5001/admin/schema", {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(async (r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((json) => mounted && setSchema(json))
      .catch((e) => mounted && setErr(e.message || "Fehler beim Laden des Schemas."))
      .finally(() => mounted && setLoading(false));
    return () => { mounted = false; };
  }, [token]);

  // Hilfsdaten für Ligen (FK-Selects)
  useEffect(() => {
    if (table !== "leagues" && table !== "games") return;
    let mounted = true;
    Promise.all([
      fetch("http://localhost:5001/cities/list").then(r => (table === "leagues" ? (r.ok ? r.json() : []) : [])),
      fetch("http://localhost:5001/sports/list").then(r => (r.ok ? r.json() : [])),
    ])
      .then(([cs, ss]) => {
        if (!mounted) return;
        if (table === "leagues") setCities(Array.isArray(cs) ? cs : []);
        setSports(Array.isArray(ss) ? ss : []);
      })
      .catch(() => {
        if (!mounted) return;
        if (table === "leagues") setCities([]);
        setSports([]);
      });
    return () => { mounted = false; };
  }, [table]);

  // Spiele: Ligen nach Sport filtern
  useEffect(() => {
    if (table !== "games") return;
    let mounted = true;
    setLeaguesForSport([]);
    setLeagueMembers([]);
    // beim Sportwechsel gewählte Liga im Formular zurücksetzen
    setForm((f) => (f.league_id ? { ...f, league_id: null, home: "", away: "" } : f));
    if (!gameSportId) return;
    fetch(`http://localhost:5001/sports/${gameSportId}/leagues`)
      .then(r => (r.ok ? r.json() : []))
      .then(ls => { if (mounted) setLeaguesForSport(Array.isArray(ls) ? ls : []); })
      .catch(() => { if (mounted) setLeaguesForSport([]); });
    return () => { mounted = false; };
  }, [table, gameSportId]);

  // Spiele: Teilnehmer der gewählten Liga laden
  useEffect(() => {
    if (table !== "games") return;
    let mounted = true;
    setLeagueMembers([]);
    const lid = form?.league_id;
    if (!lid) return;
    fetch(`http://localhost:5001/leagues/${lid}/members`)
      .then(r => (r.ok ? r.json() : []))
      .then(ms => { if (mounted) setLeagueMembers(Array.isArray(ms) ? ms : []); })
      .catch(() => { if (mounted) setLeagueMembers([]); });
    return () => { mounted = false; };
  }, [table, form?.league_id]);

  const tables = useMemo(() => (schema?.tables || []).map(t => t.name), [schema]);
  const columns = useMemo(() => {
    const t = schema?.tables?.find((x) => x.name === table);
    return t ? t.columns : [];
  }, [schema, table]);

  function isPk(col) {
    return !!col.pk;
  }

  function inputType(col) {
    const t = (col.type || "").toUpperCase();
    if (t.includes("INT")) return "number";
    if (t.includes("DATE")) return "date";
    if (t.includes("BOOL")) return "checkbox";
    if (col.name === "password") return "password";
    // Spezialfall für Spiele
    if (col.name === "kickoff_at") return "datetime-local";
    return "text";
  }

  function autoComplete(col) {
    const name = col.name.toLowerCase();
    if (name.includes("password")) return "new-password";
    if (name === "email") return "email";
    if (name.includes("firstname")) return "given-name";
    if (name.includes("lastname")) return "family-name";
    if (name.includes("birthday") || name.includes("birth")) return "bday";
    return "off";
  }

  function handleChange(col, value, checked) {
    const key = col.name;
    const type = inputType(col);
    let v = value;
    if (type === "number") v = value === "" ? null : Number(value);
    if (type === "checkbox") v = !!checked;
    setForm((f) => ({ ...f, [key]: v }));
  }

  function visibleColumns(cols) {
    // Auto-PK ausblenden
    return cols.filter((c) => !isPk(c));
  }

  async function preflightDuplicateCheck() {
    if (!table) return;
    const name = (form.name || "").trim();
    if ((table === "cities" || table === "sports") && !name) {
      throw new Error("Name ist erforderlich.");
    }
    if (table === "cities") {
      const r = await fetch("http://localhost:5001/cities/list");
      const rows = r.ok ? await r.json() : [];
      if ((rows || []).some(c => String(c.name).toLowerCase() === name.toLowerCase())) {
        throw new Error("Stadt existiert bereits.");
      }
    }
    if (table === "sports") {
      const r = await fetch("http://localhost:5001/sports/list");
      const rows = r.ok ? await r.json() : [];
      if ((rows || []).some(s => String(s.name).toLowerCase() === name.toLowerCase())) {
        throw new Error("Sportart existiert bereits.");
      }
    }
    if (table === "leagues") {
      const r = await fetch("http://localhost:5001/leagues");
      const rows = r.ok ? await r.json() : [];
      const dup = (rows || []).some(l =>
        String(l.name).toLowerCase() === String(form.name || "").toLowerCase() &&
        String(l.cityId) === String(form.city_id ?? "") &&
        String(l.sportId) === String(form.sport_id ?? "")
      );
      if (dup) throw new Error("Liga existiert bereits für diese Stadt und Sportart.");
    }
  }

  async function onSubmit(e) {
    e.preventDefault();
    setErr("");
    setResult(null);
    try {
      await preflightDuplicateCheck();
      const payload = { table, data: form };
      const r = await fetch("http://localhost:5001/admin/create", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });
      const text = await r.text();
      const json = (() => { try { return JSON.parse(text); } catch { return { error: text }; } })();
      if (!r.ok) {
        // zeige Backenddetails (z. B. field/message)
        const msg = json?.reason || json?.error || `HTTP ${r.status}`;
        const detail = json?.field ? ` (${json.field})` : json?.details ? ` (${json.details})` : "";
        throw new Error(`${msg}${detail}`);
      }
      setResult(json);
      setForm({});
    } catch (e2) {
      setErr(e2.message || "Fehler beim Erstellen.");
    }
  }

  function detailLink(id) {
    if (!id) return null;
    if (table === "leagues") return <a href={`/league/${id}`}>zur Liga</a>;
    if (table === "cities") return <a href={`/cities/${id}`}>zur Stadt</a>;
    if (table === "sports") return <a href={`/sports/${id}`}>zur Sportart</a>;
    return null;
  }

  // Auto-ID Hinweis
  const hasAutoId = useMemo(() => (columns || []).some(c => c.pk && c.name === "id"), [columns]);

  if (loading) return <div style={{ padding: 16 }}>Lade Schema ...</div>;
  if (err) return <div style={{ padding: 16, color: "crimson" }}>Fehler: {err}</div>;
  if (!schema) return <div style={{ padding: 16 }}>Keine Schemainformation verfügbar.</div>;

  return (
    <div style={{ padding: 16 }}>
      <h2>Record erstellen</h2>

      <label>
        Tabelle:&nbsp;
        <select
          value={table}
          onChange={(e) => { setTable(e.target.value); setForm({}); setResult(null); }}
        >
          <option value="">– bitte wählen –</option>
          {tables.map((t) => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>
      </label>

      {!table ? (
        <p style={{ color: "#666", marginTop: 12 }}>Bitte eine Tabelle wählen.</p>
      ) : (
        <>
          {/* Spiele: Sport-Filter oberhalb der Formularfelder */}
          {table === "games" && (
            <div style={{ marginTop: 12, display: "grid", gap: 10, maxWidth: 520 }}>
              <label style={{ display: "grid", gap: 4 }}>
                Sportart (Filter)
                <select
                  value={gameSportId}
                  onChange={(e) => { setGameSportId(e.target.value || ""); }}
                >
                  <option value="">– wählen –</option>
                  {sports.map((s) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </label>
            </div>
          )}

          <form onSubmit={onSubmit} style={{ marginTop: 16, display: "grid", gap: 10, maxWidth: 520 }}>
            {visibleColumns(columns).map((col) => {
              const key = col.name;

              // Spezielle Selects für leagues.city_id / leagues.sport_id
              if (table === "leagues" && key === "city_id") {
                return (
                  <label key={key} style={{ display: "grid", gap: 4 }}>
                    Stadt
                    <select
                      value={form[key] ?? ""}
                      onChange={(e) => handleChange(col, e.target.value === "" ? null : Number(e.target.value))}
                    >
                      <option value="">– wählen –</option>
                      {cities.map((c) => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                  </label>
                );
              }
              if (table === "leagues" && key === "sport_id") {
                return (
                  <label key={key} style={{ display: "grid", gap: 4 }}>
                    Sportart
                    <select
                      value={form[key] ?? ""}
                      onChange={(e) => handleChange(col, e.target.value === "" ? null : Number(e.target.value))}
                    >
                      <option value="">– wählen –</option>
                      {sports.map((s) => (
                        <option key={s.id} value={s.id}>{s.name}</option>
                      ))}
                    </select>
                  </label>
                );
              }

              // Spiele: abhängige Selects und spezielle Felder
              if (table === "games" && key === "league_id") {
                return (
                  <label key={key} style={{ display: "grid", gap: 4 }}>
                    Liga
                    <select
                      value={form[key] ?? ""}
                      onChange={(e) => handleChange(col, e.target.value === "" ? null : Number(e.target.value))}
                      disabled={!gameSportId}
                    >
                      <option value="">{gameSportId ? "– wählen –" : "Bitte zuerst Sportart wählen"}</option>
                      {leaguesForSport.map((l) => (
                        <option key={l.id} value={l.id}>{l.city} – {l.name}</option>
                      ))}
                    </select>
                  </label>
                );
              }
              if (table === "games" && (key === "home" || key === "away")) {
                return (
                  <label key={key} style={{ display: "grid", gap: 4 }}>
                    {key === "home" ? "Spieler/Mannschaft 1" : "Spieler/Mannschaft 2"}
                    <select
                      value={form[key] ?? ""}
                      onChange={(e) => handleChange(col, e.target.value)}
                      disabled={!form.league_id}
                    >
                      <option value="">{form.league_id ? "– wählen –" : "Bitte zuerst Liga wählen"}</option>
                      {leagueMembers.map((m) => (
                        <option key={m.id} value={`${m.firstname} ${m.lastname}`.trim()}>
                          {m.firstname} {m.lastname}
                        </option>
                      ))}
                    </select>
                  </label>
                );
              }
              if (table === "games" && key === "kickoff_at") {
                return (
                  <label key={key} style={{ display: "grid", gap: 4 }}>
                    Anpfiff
                    <input
                      type="datetime-local"
                      value={form[key] ?? ""}
                      onChange={(e) => {
                        const v = e.target.value; // "YYYY-MM-DDTHH:mm"
                        // optional: ISO speichern, ansonsten rohen Wert
                        handleChange(col, v);
                      }}
                    />
                  </label>
                );
              }

              const type = inputType(col);
              return (
                <label key={key} style={{ display: "grid", gap: 4 }}>
                  {key}
                  {type === "checkbox" ? (
                    <input
                      type="checkbox"
                      checked={!!form[key]}
                      onChange={(e) => handleChange(col, e.target.value, e.target.checked)}
                    />
                  ) : (
                    <input
                      type={type}
                      value={form[key] ?? ""}
                      onChange={(e) => handleChange(col, e.target.value)}
                      placeholder={col.type || ""}
                      autoComplete={type === "password" ? "new-password" : autoComplete(col)}
                    />
                  )}
                </label>
              );
            })}

            {hasAutoId && (
              <div style={{ color: "#666", fontSize: 12 }}>
                Hinweis: ID-Felder sind Auto-Increment und werden automatisch vergeben.
              </div>
            )}

            <div>
              <button type="submit" disabled={!table}>Erstellen</button>
            </div>

            {err && <div style={{ color: "crimson" }}>{String(err)}</div>}
            {result && (
              <div style={{ color: "green" }}>
                OK – ID: {result.id} {detailLink(result.id)}
              </div>
            )}
          </form>
        </>
      )}
    </div>
  );
}
