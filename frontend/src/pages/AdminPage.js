import React, { useEffect, useMemo, useState } from "react";
// use native fetch instead of axios to avoid axios vulnerability
import { API_BASE } from "../config";
import { useNavigate } from "react-router-dom";

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
  const [logoutAllStatus, setLogoutAllStatus] = useState(null);
  const [sortColumn, setSortColumn] = useState(null);
  const [sortDirection, setSortDirection] = useState('asc');
  const [selectedRows, setSelectedRows] = useState(new Set());
  const [bulkDeleting, setBulkDeleting] = useState(false);

  const token = localStorage.getItem("token");
  const navigate = useNavigate();

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

  // Sortierte Rows
  const sortedRows = useMemo(() => {
    if (!sortColumn) return rows;
    const sorted = [...rows].sort((a, b) => {
      let aVal = a[sortColumn];
      let bVal = b[sortColumn];
      
      // Handle null/undefined
      if (aVal == null && bVal == null) return 0;
      if (aVal == null) return 1;
      if (bVal == null) return -1;
      
      // Convert to comparable values
      if (typeof aVal === 'number' && typeof bVal === 'number') {
        return sortDirection === 'asc' ? aVal - bVal : bVal - aVal;
      }
      
      aVal = String(aVal).toLowerCase();
      bVal = String(bVal).toLowerCase();
      
      if (sortDirection === 'asc') {
        return aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
      } else {
        return aVal > bVal ? -1 : aVal < bVal ? 1 : 0;
      }
    });
    return sorted;
  }, [rows, sortColumn, sortDirection]);

  const handleSort = (column) => {
    if (sortColumn === column) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(column);
      setSortDirection('asc');
    }
  };

  const toggleSelectAll = () => {
    if (selectedRows.size === rows.length) {
      setSelectedRows(new Set());
    } else {
      setSelectedRows(new Set(rows.map(r => r.id)));
    }
  };

  const toggleSelectRow = (rowId) => {
    setSelectedRows(prev => {
      const newSet = new Set(prev);
      if (newSet.has(rowId)) {
        newSet.delete(rowId);
      } else {
        newSet.add(rowId);
      }
      return newSet;
    });
  };

  const handleBulkDelete = async () => {
    if (selectedRows.size === 0) return;
    if (!window.confirm(`${selectedRows.size} Datensätze aus "${table}" löschen?`)) return;
    
    setBulkDeleting(true);
    const deletePromises = Array.from(selectedRows).map(async (rowId) => {
      try {
        const r = await fetch(`${API_BASE}/admin/table/${encodeURIComponent(table)}/${rowId}`, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${token}` }
        });
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return { success: true, id: rowId };
      } catch (e) {
        return { success: false, id: rowId, error: e.message };
      }
    });
    
    const results = await Promise.all(deletePromises);
    const successful = results.filter(r => r.success).map(r => r.id);
    const failed = results.filter(r => !r.success);
    
    if (successful.length > 0) {
      setRows(prev => prev.filter(r => !successful.includes(r.id)));
      setSelectedRows(new Set());
    }
    
    if (failed.length > 0) {
      alert(`${failed.length} Datensätze konnten nicht gelöscht werden:\n${failed.map(f => `ID ${f.id}: ${f.error}`).join('\n')}`);
    }
    
    setBulkDeleting(false);
  };

  // Reset selection when table changes
  useEffect(() => {
    setSelectedRows(new Set());
    setSortColumn(null);
    setSortDirection('asc');
  }, [table]);

  const sendTestEmail = async () => {
    setTestMessage("");
    try {
      const r = await fetch(`${API_BASE}/admin/test-email`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ to: 'info@dev.matchleague.org' }),
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
    <div style={{ padding: 16, maxWidth: '1400px', margin: '0 auto' }}>
      <h2 style={{ 
        marginBottom: 24,
        fontSize: '28px',
        fontWeight: 700,
        color: 'var(--text, #e5e7eb)'
      }}>
        Admin Panel
      </h2>

      {/* Global Logout */}
      <div style={{ 
        marginBottom: 16, 
        padding: 16, 
        backgroundColor: 'var(--surface, #1f2937)',
        border: "1px solid rgba(255,255,255,0.1)", 
        borderRadius: 8 
      }}>
        <div style={{ marginBottom: 8, fontWeight: 600, color: 'var(--text, #e5e7eb)' }}>🔒 Sicherheit</div>
        <button
          onClick={async () => {
            setLogoutAllStatus(null);
            try {
              const r = await fetch(`${API_BASE}/admin/logout-all`, {
                method: "POST",
                headers: { Authorization: `Bearer ${token}` },
              });
              const text = await r.text();
              let json;
              try { json = JSON.parse(text); } catch { json = null; }
              if (!r.ok || !json?.success) {
                throw new Error(json?.error || `HTTP ${r.status}`);
              }

              // Direkt auch diesen Admin-Client ausloggen
              try {
                if (typeof localStorage !== "undefined") {
                  localStorage.removeItem("token");
                  localStorage.setItem("authNotice", "Du wurdest automatisch ausgeloggt.");
                }
              } catch (e) {
                // non-fatal
              }

              setLogoutAllStatus({ ok: true, message: "Alle aktiven Logins wurden beendet." });
              // Zur Login-Seite wechseln
              navigate("/login");
            } catch (e) {
              setLogoutAllStatus({ ok: false, message: e?.message || "Fehler beim Beenden aller Logins" });
            }
          }}
          style={{
            padding: '10px 16px',
            backgroundColor: 'rgba(220, 38, 38, 0.1)',
            color: '#dc2626',
            border: '1px solid rgba(220, 38, 38, 0.3)',
            borderRadius: '6px',
            cursor: 'pointer',
            fontSize: '14px',
            fontWeight: 500
          }}
        >
          🚪 Alle aktiven Logins beenden
        </button>
        {logoutAllStatus && (
          <div
            style={{
              marginTop: 8,
              color: logoutAllStatus.ok ? "#066e3c" : "crimson",
              fontSize: 14,
            }}
          >
            {logoutAllStatus.message}
          </div>
        )}
      </div>

      {/* Stats */}
      {!stats ? (
        statsErr ? <div style={{ color: "crimson" }}>Fehler: {statsErr}</div> : <div>Lade Admin-Daten ...</div>
      ) : (
        <div style={{ 
          marginBottom: 16,
          padding: 16,
          backgroundColor: 'var(--surface, #1f2937)',
          borderRadius: 8,
          border: '1px solid rgba(255,255,255,0.1)'
        }}>
          <div style={{ marginBottom: 12, fontWeight: 600, color: 'var(--text, #e5e7eb)' }}>📊 Statistiken</div>
          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: '12px'
          }}>
            {[
              { label: 'Nutzer gesamt', value: stats.users, icon: '👥' },
              { label: 'Nutzer bestätigt', value: stats.confirmedUsers, icon: '✓' },
              { label: 'Admins', value: stats.admins, icon: '👑' },
              { label: 'Sportarten', value: stats.sports, icon: '⚽' },
              { label: 'Städte', value: stats.cities, icon: '🏙️' },
              { label: 'Ligen', value: stats.leagues, icon: '🏆' }
            ].map(({ label, value, icon }) => (
              <div 
                key={label}
                style={{
                  padding: '12px',
                  backgroundColor: 'var(--bg, #111827)',
                  borderRadius: '6px',
                  border: '1px solid rgba(255,255,255,0.05)'
                }}
              >
                <div style={{ 
                  fontSize: '12px', 
                  color: 'var(--muted, #9ca3af)',
                  marginBottom: '4px'
                }}>
                  {icon} {label}
                </div>
                <div style={{ 
                  fontSize: '20px', 
                  fontWeight: 700,
                  color: 'var(--text, #e5e7eb)'
                }}>
                  {value}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tabellen-Auswahl */}
      <div style={{ 
        margin: "16px 0", 
        padding: "16px",
        backgroundColor: "var(--surface, #1f2937)",
        borderRadius: "8px",
        border: "1px solid rgba(255,255,255,0.1)"
      }}>
        <div style={{ marginBottom: 8, fontWeight: 600, color: 'var(--text, #e5e7eb)' }}>Datenbank-Tabelle</div>
        {schemaErr ? (
          <span style={{ color: "crimson" }}>Fehler: {schemaErr}</span>
        ) : !schema ? (
          <span>Lade Schema ...</span>
        ) : (
          <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
            <select 
              value={table} 
              onChange={(e) => setTable(e.target.value)}
              style={{
                padding: '10px 14px',
                backgroundColor: 'var(--bg, #111827)',
                color: 'var(--text, #e5e7eb)',
                border: '1px solid rgba(255,255,255,0.2)',
                borderRadius: '6px',
                fontSize: '14px',
                cursor: 'pointer',
                minWidth: '200px',
                outline: 'none'
              }}
            >
              <option value="">– Tabelle auswählen –</option>
              {tableNames.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
            <button 
              onClick={() => loadSchema()} 
              title="Schema neu laden"
              style={{
                padding: '10px 16px',
                backgroundColor: 'rgba(59, 130, 246, 0.1)',
                color: '#3b82f6',
                border: '1px solid rgba(59, 130, 246, 0.3)',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: 500
              }}
            >
              🔄 Refresh
            </button>
            {table && selectedMeta && (
              <span style={{ 
                color: 'var(--muted, #9ca3af)', 
                fontSize: '13px',
                marginLeft: '8px'
              }}>
                {selectedMeta.columns.length} Spalten
              </span>
            )}
          </div>
        )}
      </div>

      {/* Records-Tabelle */}
      {table && (
        <div style={{ marginTop: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <b>Records: {table} ({rows.length})</b>
            {selectedRows.size > 0 && (
              <button 
                onClick={handleBulkDelete}
                disabled={bulkDeleting}
                style={{
                  padding: '8px 16px',
                  backgroundColor: '#dc2626',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: bulkDeleting ? 'not-allowed' : 'pointer',
                  opacity: bulkDeleting ? 0.6 : 1
                }}
              >
                {bulkDeleting ? 'Lösche...' : `${selectedRows.size} ausgewählte löschen`}
              </button>
            )}
          </div>
          {rowsErr && <div style={{ color: "crimson" }}>{rowsErr}</div>}
          {loadingRows ? (
            <div>Lade Datensätze ...</div>
          ) : rows.length === 0 ? (
            <div>Keine Datensätze.</div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ 
                borderCollapse: "collapse", 
                width: "100%",
                backgroundColor: 'var(--surface, #1f2937)',
                borderRadius: '8px',
                overflow: 'hidden'
              }}>
                <thead style={{ backgroundColor: 'var(--bg, #111827)' }}>
                  <tr>
                    <th style={{
                      padding: '16px 20px',
                      textAlign: 'left',
                      fontWeight: 600,
                      color: 'var(--text, #e5e7eb)',
                      fontSize: '13px',
                      textTransform: 'uppercase',
                      letterSpacing: '0.5px',
                      borderBottom: '1px solid rgba(255,255,255,0.1)'
                    }}>
                      <input 
                        type="checkbox"
                        checked={selectedRows.size === rows.length && rows.length > 0}
                        onChange={toggleSelectAll}
                        style={{ cursor: 'pointer' }}
                      />
                    </th>
                    {cols.map((c) => (
                      <th 
                        key={c}
                        onClick={() => handleSort(c)}
                        style={{
                          padding: '16px 20px',
                          textAlign: 'left',
                          fontWeight: 600,
                          color: 'var(--text, #e5e7eb)',
                          fontSize: '13px',
                          textTransform: 'uppercase',
                          letterSpacing: '0.5px',
                          cursor: 'pointer',
                          userSelect: 'none',
                          borderBottom: '1px solid rgba(255,255,255,0.1)',
                          transition: 'background-color 0.2s'
                        }}
                        onMouseEnter={(e) => e.target.style.backgroundColor = 'rgba(255,255,255,0.05)'}
                        onMouseLeave={(e) => e.target.style.backgroundColor = 'transparent'}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          {c}
                          {sortColumn === c && (
                            <span style={{ fontSize: '10px' }}>
                              {sortDirection === 'asc' ? '▲' : '▼'}
                            </span>
                          )}
                        </div>
                      </th>
                    ))}
                    <th style={{
                      padding: '16px 20px',
                      textAlign: 'left',
                      fontWeight: 600,
                      color: 'var(--text, #e5e7eb)',
                      fontSize: '13px',
                      textTransform: 'uppercase',
                      letterSpacing: '0.5px',
                      borderBottom: '1px solid rgba(255,255,255,0.1)'
                    }}>Aktion</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedRows.map((r, idx) => (
                    <tr 
                      key={r.id ?? idx}
                      style={{
                        backgroundColor: selectedRows.has(r.id) ? 'rgba(59, 130, 246, 0.1)' : 'transparent',
                        borderBottom: '1px solid rgba(255,255,255,0.05)'
                      }}
                      onMouseEnter={(e) => {
                        if (!selectedRows.has(r.id)) {
                          e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.02)';
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (!selectedRows.has(r.id)) {
                          e.currentTarget.style.backgroundColor = 'transparent';
                        }
                      }}
                    >
                      <td style={{ 
                        padding: '12px 20px',
                        color: 'var(--text, #e5e7eb)',
                        fontSize: '14px'
                      }}>
                        <input 
                          type="checkbox"
                          checked={selectedRows.has(r.id)}
                          onChange={() => toggleSelectRow(r.id)}
                          style={{ cursor: 'pointer' }}
                        />
                      </td>
                      {cols.map((c) => (
                        <td 
                          key={c}
                          style={{ 
                            padding: '12px 20px',
                            color: 'var(--muted, #9ca3af)',
                            fontSize: '14px',
                            maxWidth: '300px',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap'
                          }}
                          title={r[c] === null || typeof r[c] === "undefined" ? "" : 
                                 typeof r[c] === "object" ? JSON.stringify(r[c]) : String(r[c])}
                        >
                          {r[c] === null || typeof r[c] === "undefined"
                            ? <span style={{ color: 'rgba(156, 163, 175, 0.4)' }}>null</span>
                            : typeof r[c] === "object"
                              ? <span style={{ fontFamily: 'monospace', fontSize: '12px' }}>{JSON.stringify(r[c])}</span>
                              : c === 'id' 
                                ? <span style={{ fontWeight: 600, color: 'var(--text, #e5e7eb)' }}>{String(r[c])}</span>
                                : String(r[c])}
                        </td>
                      ))}
                      <td style={{ padding: '12px 20px' }}>
                        <button 
                          onClick={() => handleEdit(r)} 
                          style={{ 
                            marginRight: 8,
                            padding: '6px 12px',
                            backgroundColor: 'rgba(59, 130, 246, 0.1)',
                            color: '#3b82f6',
                            border: '1px solid rgba(59, 130, 246, 0.3)',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            fontSize: '12px'
                          }}
                        >
                          Bearbeiten
                        </button>
                        <button 
                          onClick={() => handleDelete(r.id)} 
                          disabled={deletingId === r.id}
                          style={{
                            padding: '6px 12px',
                            backgroundColor: 'rgba(220, 38, 38, 0.1)',
                            color: '#dc2626',
                            border: '1px solid rgba(220, 38, 38, 0.3)',
                            borderRadius: '4px',
                            cursor: deletingId === r.id ? 'not-allowed' : 'pointer',
                            opacity: deletingId === r.id ? 0.6 : 1,
                            fontSize: '12px'
                          }}
                        >
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
