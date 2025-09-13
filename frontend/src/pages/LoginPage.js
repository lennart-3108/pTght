import React, { useState } from "react";
import { useNavigate } from "react-router-dom";

export default function LoginPage({ setToken, setIsAdminFlag }) {
  const navigate = useNavigate();
  // Login-Form-States
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loginMsg, setLoginMsg] = useState("");

  // Reset-Form-States
  const [showReset, setShowReset] = useState(false);
  const [resetUsername, setResetUsername] = useState("");
  const [resetPassword, setResetPassword] = useState("");
  const [resetMsg, setResetMsg] = useState("");

  // Login-Handler (hier an dein Backend anpassen!)
  const handleLogin = async (e) => {
    e.preventDefault();
    setLoginMsg("");
    try {
      const res = await fetch("http://localhost:5001/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setLoginMsg(data.error || "Login fehlgeschlagen.");
        return;
      }
      // Erfolg: Backend liefert { token, is_admin }
      localStorage.setItem("token", data.token);
      localStorage.setItem("is_admin", data.is_admin ? "1" : "0");
      setToken(data.token);
      setIsAdminFlag(!!data.is_admin);
      setLoginMsg("✅ Login erfolgreich!");
      // Banner-Flags für App setzen und anschließend weiterleiten
      sessionStorage.setItem("loginSuccessAt", new Date().toISOString());
      sessionStorage.setItem("loginEmail", email);
      navigate("/");
    } catch {
      setLoginMsg("Server nicht erreichbar.");
    }
  };

  // Reset-Handler (hier an dein Backend anpassen!)
  const handleReset = async (e) => {
    e.preventDefault();
    setResetMsg("");
    try {
      const response = await fetch("http://localhost:5001/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: resetUsername,
          password: resetPassword,
        }),
      });
      const data = await response.json();
      if (data.success) {
        setResetMsg("✅ Passwort erfolgreich geändert!");
      } else {
        setResetMsg(data.error || "Fehler beim Zurücksetzen.");
      }
    } catch {
      setResetMsg("Server nicht erreichbar.");
    }
  };

  return (
    <div style={{ maxWidth: 350, margin: "60px auto", padding: 20, border: "1px solid #ccc", borderRadius: 8 }}>
      <h2>Login</h2>
      {/* Login-Formular */}
      <form onSubmit={handleLogin}>
        <input
          type="email"
          placeholder="E-Mail"
          value={email}
          onChange={e => setEmail(e.target.value)}
          required
          autoComplete="email"
          style={{ display: "block", marginBottom: 8, width: "100%" }}
        />
        <input
          type="password"
          placeholder="Passwort"
          value={password}
          onChange={e => setPassword(e.target.value)}
          required
          autoComplete="current-password"
          style={{ display: "block", marginBottom: 8, width: "100%" }}
        />
        <button type="submit" style={{ width: "100%" }}>Login</button>
        {loginMsg && <div style={{ marginTop: 8 }}>{loginMsg}</div>}
      </form>

      {/* Passwort vergessen Button */}
      <button
        onClick={() => setShowReset((s) => !s)}
        style={{ marginTop: 24, width: "100%" }}
        type="button"
      >
        Passwort vergessen?
      </button>

      {/* Reset-Formular */}
      {showReset && (
        <form
          onSubmit={handleReset}
          style={{ marginTop: 16, border: "1px solid #eee", padding: 16, borderRadius: 8 }}
        >
          <h4>Passwort zurücksetzen</h4>
          <input
            type="text"
            placeholder="Benutzername oder E-Mail"
            value={resetUsername}
            onChange={e => setResetUsername(e.target.value)}
            required
            autoComplete="username"
            style={{ display: "block", marginBottom: 8, width: "100%" }}
          />
          <input
            type="password"
            placeholder="Neues Passwort"
            value={resetPassword}
            onChange={e => setResetPassword(e.target.value)}
            required
            minLength={6}
            autoComplete="new-password"
            style={{ display: "block", marginBottom: 8, width: "100%" }}
          />
          <button type="submit" style={{ width: "100%" }}>Zurücksetzen</button>
          {resetMsg && <div style={{ marginTop: 8 }}>{resetMsg}</div>}
        </form>
      )}
    </div>
  );
}
