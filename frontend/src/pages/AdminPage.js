import React, { useEffect, useMemo, useState } from "react";

export default function AdminPage() {
  const [stats, setStats] = useState(null);
  const [statsErr, setStatsErr] = useState("");
  const [schema, setSchema] = useState(null);
  const [schemaErr, setSchemaErr] = useState("");
  const [table, setTable] = useState("");
  const [rows, setRows] = useState([]);
  const [cols, setCols] = useState([]);
  const [rowsErr, setRowsErr] = useState("");
  const [loadingRows, setLoadingRows] = useState(false);

  const token = localStorage.getItem("token");

  // Stats laden
  useEffect(() => {
    let mounted = true;
    setStatsErr("");
    fetch("http://localhost:5001/admin/stats", { headers: { Authorization: `Bearer ${token}` } })
      .then(r => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then(j => mounted && setStats(j))
      .catch(e => mounted && setStatsErr(e.message || "Fehler"))
    return () => { mounted = false; };
  }, [token]);

  // Schema laden
  useEffect(() => {
    let mounted = true;
    setSchemaErr("");
    fetch("http://localhost:5001/admin/schema", { headers: { Authorization: `Bearer ${token}` } })
      .then(r => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then(j => mounted && setSchema(j))
      .catch(e => mounted && setSchemaErr(e.message || "Fehler"));
    return () => { mounted = false; };
  }, [token]);

  const tableNames = useMemo(() => (schema?.tables || []).map(t => t.name), [schema]);
  const selectedMeta = useMemo(() => schema?.tables?.find((t) => t.name === table) || null, [schema, table]);

  // Records laden bei Tabellenauswahl
  useEffect(() => {
    if (!table) {
      setRows([]);
      setCols([]);
      setRowsErr("");
      return;
    }
    let mounted = true;
    setLoadingRows(true);
    setRowsErr("");
    fetch(`http://localhost:5001/admin/table/${encodeURIComponent(table)}?limit=200`, {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(async (r) => {
        const text = await r.text();
        let json;
        try { json = JSON.parse(text); } catch { throw new Error(text || `HTTP ${r.status}`); }
        if (!r.ok) throw new Error(json?.error || `HTTP ${r.status}`);
        return json;
      })
      .then((json) => {
        if (!mounted) return;
        // Spaltenreihenfolge: id zuerst, dann rest gemäß Schema
        const schemaCols = selectedMeta ? selectedMeta.columns.map(c => c.name) : (json.columns || []);
        const ordered = [
          ...schemaCols.filter(c => c === "id"),
          ...schemaCols.filter(c => c !== "id"),
        ];
        setCols(ordered);
        setRows(Array.isArray(json.rows) ? json.rows : []);
      })
      .catch((e) => mounted && setRowsErr(e.message || "Fehler"))
      .finally(() => mounted && setLoadingRows(false));
    return () => { mounted = false; };
  }, [table, token, selectedMeta]);

  return (
    <div style={{ padding: 16 }}>
      <h2>Admin</h2>

      {/* Stats */}
      {!stats ? (
        statsErr ? <div style={{ color: "crimson" }}>Fehler: {statsErr}</div> : <div>Lade Admin-Daten ...</div>
      ) : (
        <div style={{ marginBottom: 16 }}>
          <b>Statistiken</b>
          <ul style={{ marginTop: 6 }}>
            <li>Nutzer gesamt: {stats.users}</li>
            <li>Nutzer bestätigt: {stats.confirmedUsers}</li>
            <li>Admins: {stats.admins}</li>
            <li>Sportarten: {stats.sports}</li>
            <li>Städte: {stats.cities}</li>
            <li>Ligen: {stats.leagues}</li>
          </ul>
        </div>
      )}

      {/* Tabellen-Auswahl */}
      <div style={{ margin: "8px 0" }}>
        <label>
          Tabelle:&nbsp;
          {schemaErr ? (
            <span style={{ color: "crimson" }}>Fehler: {schemaErr}</span>
          ) : !schema ? (
            <span>Lade Schema ...</span>
          ) : (
            <select value={table} onChange={(e) => setTable(e.target.value)}>
              <option value="">– bitte wählen –</option>
              {tableNames.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          )}
        </label>
      </div>

      {/* Records-Tabelle */}
      {table && (
        <div style={{ marginTop: 12 }}>
          <b>Records: {table}</b>
          {rowsErr && <div style={{ color: "crimson" }}>{rowsErr}</div>}
          {loadingRows ? (
            <div>Lade Datensätze ...</div>
          ) : rows.length === 0 ? (
            <div>Keine Datensätze.</div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table border="1" cellPadding="6" style={{ borderCollapse: "collapse", width: "100%" }}>
                <thead>
                  <tr>
                    {cols.map((c) => (
                      <th key={c}>{c}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r, idx) => (
                    <tr key={r.id ?? idx}>
                      {cols.map((c) => (
                        <td key={c}>
                          {r[c] === null || typeof r[c] === "undefined"
                            ? ""
                            : typeof r[c] === "object"
                              ? JSON.stringify(r[c])
                              : String(r[c])}
                        </td>
                      ))}
                  </tr>
                  ))}
                </tbody>
              </table>
              <div style={{ color: "#666", marginTop: 6 }}>Max. 200 Zeilen angezeigt.</div>
            </div>
          )}
        </div>
      )}

         {/* Email-server */}
         <div style={{ margin: "8px 0" }}>
        <label>
        Email-server: https://mailtrap.io/inboxes/4000257/messages
        </label>
      </div>
    </div>
  );
}
