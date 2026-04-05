import React, { useState, useEffect } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { API_BASE } from "../config";
import { useLanguage } from "../i18n";

export default function ResetpasswordPage() {
  const { t } = useLanguage();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get("token");
  const error = searchParams.get("error");

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [msg, setMsg] = useState("");
  const [success, setSuccess] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const API = (typeof API_BASE === "string" && API_BASE.trim()) ? API_BASE : "/api";

  useEffect(() => {
    if (error === "invalid_token") {
      setMsg("Der Link ist ungültig oder abgelaufen. Bitte fordere einen neuen Reset-Link an.");
    }
  }, [error]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMsg("");

    if (!token) {
      setMsg("Kein Reset-Token vorhanden.");
      return;
    }
    if (newPassword.length < 6) {
      setMsg("Passwort muss mindestens 6 Zeichen lang sein.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setMsg("Passwörter stimmen nicht überein.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch(`${API}/reset-password-with-token`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, newPassword }),
      });
      const data = await res.json();
      if (data.success) {
        setSuccess(true);
        setMsg("Passwort erfolgreich geändert! Du kannst dich jetzt einloggen.");
      } else {
        setMsg(data.error || "Fehler beim Zurücksetzen des Passworts.");
      }
    } catch {
      setMsg("Server nicht erreichbar.");
    } finally {
      setSubmitting(false);
    }
  };

  const containerStyle = {
    maxWidth: 420,
    margin: "60px auto",
    padding: "32px 24px",
    background: "rgba(20,40,30,0.92)",
    borderRadius: 16,
    border: "1px solid rgba(180,160,80,0.25)",
    color: "#e8efe8",
  };

  const inputStyle = {
    width: "100%",
    padding: "10px 12px",
    borderRadius: 8,
    border: "1px solid rgba(180,160,80,0.3)",
    background: "rgba(255,255,255,0.06)",
    color: "#e8efe8",
    fontSize: 15,
    marginBottom: 14,
    boxSizing: "border-box",
  };

  const btnStyle = {
    width: "100%",
    padding: "12px",
    borderRadius: 8,
    border: "none",
    background: "linear-gradient(135deg, #b8943e 0%, #d4af37 100%)",
    color: "#1a2e1a",
    fontWeight: 700,
    fontSize: 15,
    cursor: submitting ? "wait" : "pointer",
    opacity: submitting ? 0.6 : 1,
  };

  if (!token && !error) {
    return (
      <div style={containerStyle}>
        <h2 style={{ margin: "0 0 16px" }}>Passwort zurücksetzen</h2>
        <p>Kein Reset-Token vorhanden. Bitte nutze den Link aus deiner E-Mail.</p>
        <button onClick={() => navigate("/login")} style={{ ...btnStyle, marginTop: 16 }}>
          Zum Login
        </button>
      </div>
    );
  }

  return (
    <div style={containerStyle}>
      <h2 style={{ margin: "0 0 8px" }}>Neues Passwort festlegen</h2>
      <p style={{ color: "#9db", fontSize: 14, marginBottom: 20 }}>
        Gib dein neues Passwort ein.
      </p>

      {msg && (
        <div style={{
          padding: "10px 14px",
          borderRadius: 8,
          marginBottom: 16,
          background: success ? "rgba(80,180,80,0.15)" : "rgba(220,80,80,0.15)",
          border: `1px solid ${success ? "rgba(80,180,80,0.3)" : "rgba(220,80,80,0.3)"}`,
          color: success ? "#8f8" : "#f88",
          fontSize: 14,
        }}>
          {msg}
        </div>
      )}

      {success ? (
        <button onClick={() => navigate("/login")} style={btnStyle}>
          Zum Login
        </button>
      ) : error ? (
        <button onClick={() => navigate("/login")} style={btnStyle}>
          Zum Login — neuen Link anfordern
        </button>
      ) : (
        <form onSubmit={handleSubmit}>
          <label style={{ fontSize: 13, color: "#9db", marginBottom: 4, display: "block" }}>Neues Passwort</label>
          <input
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            placeholder="Mindestens 6 Zeichen"
            style={inputStyle}
            autoFocus
            required
            minLength={6}
          />
          <label style={{ fontSize: 13, color: "#9db", marginBottom: 4, display: "block" }}>Passwort bestätigen</label>
          <input
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="Passwort wiederholen"
            style={inputStyle}
            required
            minLength={6}
          />
          <button type="submit" disabled={submitting} style={btnStyle}>
            {submitting ? "Wird gespeichert..." : "Passwort ändern"}
          </button>
        </form>
      )}
    </div>
  );
}
