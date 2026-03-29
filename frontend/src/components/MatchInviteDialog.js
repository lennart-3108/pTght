import React, { useEffect, useState } from "react";
import { API_BASE } from "../config";
import { useLanguage } from "../i18n";

function emptyAvailabilityRow() {
  return { id: Math.random().toString(36).slice(2, 9), date: "", timeStart: "", timeEnd: "" };
}

export default function MatchInviteDialog({ open, onClose, targetUserId, targetUserName, onCreated }) {
  const { t } = useLanguage();
  const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
  const [sports, setSports] = useState([]);
  const [cities, setCities] = useState([]);
  const [sportId, setSportId] = useState("");
  const [cityId, setCityId] = useState("");
  const [note, setNote] = useState("");
  const [availability, setAvailability] = useState([emptyAvailabilityRow()]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    setError("");
    Promise.all([
      fetch(`${API_BASE}/sports/list`).then((r) => (r.ok ? r.json() : [])),
      fetch(`${API_BASE}/cities/list`).then((r) => (r.ok ? r.json() : [])),
    ])
      .then(([sportsData, citiesData]) => {
        if (cancelled) return;
        setSports(Array.isArray(sportsData) ? sportsData : []);
        setCities(Array.isArray(citiesData) ? citiesData : []);
      })
      .catch(() => {
        if (!cancelled) setError(t("match.errorPrefix") + ": Daten konnten nicht geladen werden.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, t]);

  if (!open) return null;

  function updateAvailabilityRow(rowId, key, value) {
    setAvailability((rows) => rows.map((row) => (row.id === rowId ? { ...row, [key]: value } : row)));
  }

  function addAvailabilityRow() {
    setAvailability((rows) => [...rows, emptyAvailabilityRow()]);
  }

  function removeAvailabilityRow(rowId) {
    setAvailability((rows) => (rows.length > 1 ? rows.filter((row) => row.id !== rowId) : [emptyAvailabilityRow()]));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    if (!token) {
      setError("Bitte zuerst einloggen.");
      return;
    }
    if (!sportId || !cityId) {
      setError("Bitte Sportart und Stadt auswählen.");
      return;
    }
    const normalizedAvailability = availability
      .map((slot) => ({
        date: String(slot.date || "").trim(),
        timeStart: String(slot.timeStart || "").trim(),
        timeEnd: String(slot.timeEnd || "").trim(),
      }))
      .filter((slot) => slot.date && slot.timeStart && slot.timeEnd);
    if (!normalizedAvailability.length) {
      setError("Bitte mindestens eine Verfügbarkeit eintragen.");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`${API_BASE}/users/${targetUserId}/match-invitations`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          sportId: Number(sportId),
          cityId: Number(cityId),
          note: note.trim(),
          availability: normalizedAvailability,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`);
      onCreated?.(data.invitation || null);
      setSportId("");
      setCityId("");
      setNote("");
      setAvailability([emptyAvailabilityRow()]);
      onClose?.();
    } catch (err) {
      setError(err?.message || "Einladung konnte nicht gesendet werden.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(3, 10, 8, 0.72)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
        zIndex: 2000,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "min(760px, 100%)",
          maxHeight: "90vh",
          overflowY: "auto",
          background: "linear-gradient(135deg, rgba(9,26,21,0.98), rgba(18,44,37,0.96))",
          borderRadius: 20,
          border: "1px solid rgba(90,203,165,0.18)",
          boxShadow: "0 24px 60px rgba(0,0,0,0.45)",
          padding: 24,
          color: "#e8efe8",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16, marginBottom: 20 }}>
          <div>
            <div style={{ fontSize: 28, fontWeight: 900, marginBottom: 6 }}>Match anfragen</div>
            <div style={{ color: "#9db", fontSize: 14 }}>
              Erstelle eine direkte Match-Einladung für {targetUserName || `User #${targetUserId}`}. Das Match wird erst erstellt, wenn die Einladung angenommen wird.
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              border: "1px solid rgba(90,203,165,0.25)",
              background: "transparent",
              color: "#9db",
              borderRadius: 10,
              padding: "8px 12px",
              cursor: "pointer",
            }}
          >
            {t("common.cancel")}
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 14 }}>
            <label style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <span style={{ color: "#9db", fontSize: 13, fontWeight: 600 }}>Sportart</span>
              <select value={sportId} onChange={(e) => setSportId(e.target.value)} style={fieldStyle}>
                <option value="">Sportart wählen</option>
                {sports.map((sport) => (
                  <option key={sport.id} value={sport.id}>{sport.name}</option>
                ))}
              </select>
            </label>
            <label style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <span style={{ color: "#9db", fontSize: 13, fontWeight: 600 }}>Stadt</span>
              <select value={cityId} onChange={(e) => setCityId(e.target.value)} style={fieldStyle}>
                <option value="">Stadt wählen</option>
                {cities.map((city) => (
                  <option key={city.id} value={city.id}>{city.name}</option>
                ))}
              </select>
            </label>
          </div>

          <label style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <span style={{ color: "#9db", fontSize: 13, fontWeight: 600 }}>Nachricht</span>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={3}
              placeholder="Optionaler Hinweis zum Match"
              style={{ ...fieldStyle, resize: "vertical", minHeight: 90 }}
            />
          </label>

          <div style={{ padding: 16, background: "rgba(10,28,23,0.58)", borderRadius: 16, border: "1px solid rgba(47,107,87,0.35)" }}>
            <div style={{ fontSize: 18, fontWeight: 800, marginBottom: 6 }}>Verfügbarkeiten</div>
            <div style={{ color: "#9db", fontSize: 13, marginBottom: 14 }}>
              Trage direkt freie Zeitfenster ein. Diese werden nach Annahme automatisch auf das Match übertragen.
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {availability.map((slot) => (
                <div key={slot.id} style={{ display: "grid", gridTemplateColumns: "minmax(140px, 1fr) minmax(120px, 1fr) minmax(120px, 1fr) auto", gap: 10, alignItems: "end" }}>
                  <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    <span style={smallLabelStyle}>Datum</span>
                    <input type="date" value={slot.date} onChange={(e) => updateAvailabilityRow(slot.id, "date", e.target.value)} style={fieldStyle} />
                  </label>
                  <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    <span style={smallLabelStyle}>Von</span>
                    <input type="time" value={slot.timeStart} onChange={(e) => updateAvailabilityRow(slot.id, "timeStart", e.target.value)} style={fieldStyle} />
                  </label>
                  <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    <span style={smallLabelStyle}>Bis</span>
                    <input type="time" value={slot.timeEnd} onChange={(e) => updateAvailabilityRow(slot.id, "timeEnd", e.target.value)} style={fieldStyle} />
                  </label>
                  <button type="button" onClick={() => removeAvailabilityRow(slot.id)} style={removeButtonStyle}>
                    Entfernen
                  </button>
                </div>
              ))}
            </div>

            <button type="button" onClick={addAvailabilityRow} style={secondaryButtonStyle}>
              Weitere Verfügbarkeit hinzufügen
            </button>
          </div>

          {loading && <div style={{ color: "#9db" }}>Lade Auswahldaten…</div>}
          {error && <div style={{ color: "#ff8d8d", fontWeight: 600 }}>{error}</div>}

          <div style={{ display: "flex", justifyContent: "flex-end", gap: 12 }}>
            <button type="button" onClick={onClose} style={secondaryButtonStyle}>{t("common.cancel")}</button>
            <button type="submit" disabled={saving || loading} style={primaryButtonStyle}>
              {saving ? "Wird gesendet…" : "Einladung senden"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

const fieldStyle = {
  padding: "10px 12px",
  borderRadius: 10,
  border: "1px solid rgba(47,107,87,0.45)",
  background: "#0a1c17",
  color: "#e8efe8",
  fontSize: 14,
};

const smallLabelStyle = {
  color: "#9db",
  fontSize: 12,
  fontWeight: 600,
};

const primaryButtonStyle = {
  padding: "11px 16px",
  borderRadius: 10,
  border: "none",
  background: "linear-gradient(135deg,#48c9a9,#2f9c7a)",
  color: "#07271f",
  fontWeight: 800,
  cursor: "pointer",
};

const secondaryButtonStyle = {
  padding: "10px 14px",
  borderRadius: 10,
  border: "1px solid rgba(90,203,165,0.35)",
  background: "rgba(10,33,27,0.85)",
  color: "#7be0bb",
  fontWeight: 700,
  cursor: "pointer",
  width: "fit-content",
};

const removeButtonStyle = {
  padding: "10px 12px",
  borderRadius: 10,
  border: "1px solid rgba(220,90,90,0.35)",
  background: "rgba(60,20,20,0.45)",
  color: "#ffb0b0",
  cursor: "pointer",
};