import React, { useEffect, useMemo, useState } from "react";
// use native fetch instead of axios to avoid axios vulnerability
import { API_BASE } from "../config";

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
  const [emailStatus, setEmailStatus] = useState(null);
  const [testMessage, setTestMessage] = useState("");
  const [deletingId, setDeletingId] = useState(null);
  const [editingRow, setEditingRow] = useState(null); // State für den zu bearbeitenden Datensatz

  const token = localStorage.getItem("token");

  // Stats laden
  useEffect(() => {
    let mounted = true;
    setStatsErr("");
    fetch(`${API_BASE}/admin/stats`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then(j => mounted && setStats(j))
      .catch(e => mounted && setStatsErr(e.message || "Fehler"))
    return () => { mounted = false; };
  }, [token]);

  // Schema laden
  // Schema laden (extracted to function so it can be refreshed on demand)
  const loadSchema = async () => {
    setSchemaErr("");
    try {
      const r = await fetch(`${API_BASE}/admin/schema`, { headers: { Authorization: `Bearer ${token}` } });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const j = await r.json();
      setSchema(j);
    } catch (e) {
      setSchemaErr(e.message || "Fehler");
    }
  };

  useEffect(() => {
    let mounted = true;
    // small guard: only run on mount (token might change rarely)
    if (!mounted) return;
    loadSchema();
    return () => { mounted = false; };
  }, [token]);

  // Check email connection status
  useEffect(() => {
    const checkEmailStatus = async () => {
      try {
        const r = await fetch(`${API_BASE}/admin/email-status`, { headers: { Authorization: `Bearer ${token}` } });
        const j = r.ok ? await r.json().catch(() => null) : null;
        setEmailStatus(j || { connected: false });
      } catch {
        setEmailStatus({ connected: false });
      }
    };
    checkEmailStatus();
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
    fetch(`${API_BASE}/admin/table/${encodeURIComponent(table)}?limit=200`, {
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

  const sendTestEmail = async () => {
    setTestMessage("");
    try {
      const r = await fetch(`${API_BASE}/admin/test-email`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ to: 'info@matchleague.org' }),
      });
      const j = await (async () => { const t = await r.text(); try { return JSON.parse(t); } catch { return null; } })();
      if (!r.ok) throw new Error(j?.error || `HTTP ${r.status}`);
      setTestMessage(`Test email sent! id: ${j?.messageId || "n/a"}`);
    } catch (e) {
      setTestMessage(`Failed to send test email: ${e?.message || "unknown error"}`);
    }
  };

  const handleDelete = async (rowId) => {
    if (!table || rowId == null) return;
    if (!window.confirm(`Diesen Datensatz (id=${rowId}) aus "${table}" löschen?`)) return;
    setDeletingId(rowId);
    try {
      const r = await fetch(`${API_BASE}/admin/table/${encodeURIComponent(table)}/${rowId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!r.ok) {
        const t = await r.text();
        let json;
        try { json = JSON.parse(t); } catch { json = null; }
        throw new Error(json?.error || `HTTP ${r.status}`);
      }
      setRows(prev => prev.filter(r => r.id !== rowId));
    } catch (e) {
      alert(`Löschen fehlgeschlagen: ${e?.message || 'unknown error'}`);
    } finally {
      setDeletingId(null);
    }
  };

  const handleEdit = (row) => {
    setEditingRow(row); // Öffne das Formular mit den Daten des ausgewählten Datensatzes
  };

  const handleSaveEdit = async () => {
    if (!editingRow || !table) return;
    try {
      const r = await fetch(`${API_BASE}/admin/table/${encodeURIComponent(table)}/${editingRow.id}`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(editingRow),
      });
      if (!r.ok) {
        const t = await r.text();
        let json;
        try { json = JSON.parse(t); } catch { json = null; }
        throw new Error(json?.error || `HTTP ${r.status}`);
      }
      setRows(prev => prev.map(r => (r.id === editingRow.id ? editingRow : r)));
      setEditingRow(null); // Schließe das Formular nach dem Speichern
    } catch (e) {
      alert(`Speichern fehlgeschlagen: ${e?.message || 'unknown error'}`);
    }
  };

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
            <>
              <select value={table} onChange={(e) => setTable(e.target.value)}>
                <option value="">– bitte wählen –</option>
                {tableNames.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
              &nbsp;
              <button onClick={() => loadSchema()} title="Schema neu laden">Refresh</button>
            </>
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
                    <th>Aktion</th>
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
                      <td>
                        <button onClick={() => handleEdit(r)} style={{ marginRight: 8 }}>
                          Bearbeiten
                        </button>
                        <button onClick={() => handleDelete(r.id)} disabled={deletingId === r.id}>
                          {deletingId === r.id ? "Lösche..." : "Löschen"}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Bearbeitungsformular */}
      {editingRow && (
        <div style={{ marginTop: 16, padding: 16, border: "1px solid #ccc", borderRadius: 8 }}>
          <h3>Datensatz bearbeiten</h3>
          {cols.map((col) => (
            <div key={col} style={{ marginBottom: 8 }}>
              <label>
                {col}:&nbsp;
                <input
                  type="text"
                  value={editingRow[col] || ""}
                  onChange={(e) =>
                    setEditingRow((prev) => ({ ...prev, [col]: e.target.value }))
                  }
                />
              </label>
            </div>
          ))}
          <button onClick={handleSaveEdit} style={{ marginRight: 8 }}>
            Speichern
          </button>
          <button onClick={() => setEditingRow(null)}>Abbrechen</button>
        </div>
      )}

      {/* Email Test */}
      <h3>Email Test</h3>
      <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
        <span>Email Connection:</span>
        <div
          style={{
            width: "20px",
            height: "20px",
            borderRadius: "50%",
            backgroundColor: emailStatus?.connected ? "green" : "red"
          }}
        ></div>
        <span>{emailStatus?.connected ? "Connected" : "Disconnected"}</span>
      </div>
      <div style={{ marginTop: 6, color: "#aaa" }}>
        SMTP: {emailStatus?.host || "-"}:{emailStatus?.port ?? "-"} {emailStatus?.secure ? "(SSL)" : "(TLS/STARTTLS)"}
        {emailStatus?.lastError && (
          <div style={{ color: "crimson", marginTop: 4 }}>Letzter Fehler: {emailStatus.lastError}</div>
        )}
      </div>
      <button onClick={sendTestEmail} style={{ marginTop: "10px" }}>
        Send Test Email
      </button>
      {testMessage && <p>{testMessage}</p>}
    </div>
  );
}
