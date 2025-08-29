import React, { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";

export default function ResetPage() {
  const location = useLocation();
  const navigate = useNavigate();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [msg, setMsg] = useState("");

  useEffect(() => {
    if (location.state && location.state.email) {
      setUsername(location.state.email);
    }
  }, [location.state]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMsg("");
    try {
      const res = await fetch("http://localhost:5001/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json();
      if (data.success) {
        setMsg("✅ Passwort erfolgreich geändert. Du kannst dich jetzt einloggen.");
        setTimeout(() => navigate("/login"), 1200);
      } else {
        setMsg(data.error || "Fehler beim Zurücksetzen.");
      }
    } catch {
      setMsg("Server nicht erreichbar.");
    }
  };

  return (
    <div style={{ maxWidth: 350, margin: "60px auto", padding: 20, border: "1px solid #ccc", borderRadius: 8 }}>
      <h2>Passwort zurücksetzen</h2>
      <form onSubmit={handleSubmit}>
        <input
          type="text"
          placeholder="Benutzername oder E-Mail"
          value={username}
          onChange={e => setUsername(e.target.value)}
          required
          style={{ display: "block", marginBottom: 8, width: "100%" }}
        />
        <input
          type="password"
          placeholder="Neues Passwort"
          value={password}
          onChange={e => setPassword(e.target.value)}
          required
          minLength={6}
          style={{ display: "block", marginBottom: 8, width: "100%" }}
        />
        <button type="submit" style={{ width: "100%" }}>Zurücksetzen</button>
        {msg && <div style={{ marginTop: 8 }}>{msg}</div>}
      </form>
    </div>
  );
}