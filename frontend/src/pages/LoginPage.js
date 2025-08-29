import React, { useState } from "react";
import { useNavigate } from "react-router-dom";

export default function LoginPage() {
  const navigate = useNavigate();
  
  // Login-Form-States
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loginMsg, setLoginMsg] = useState("");

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
      if (data.success) {
        setLoginMsg("✅ Login erfolgreich!");
        // Weiterleitung etc. hier
      } else {
        setLoginMsg(data.error || "Login fehlgeschlagen.");
      }
    } catch {
      setLoginMsg("Server nicht erreichbar.");
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
          style={{ display: "block", marginBottom: 8, width: "100%" }}
        />
        <input
          type="password"
          placeholder="Passwort"
          value={password}
          onChange={e => setPassword(e.target.value)}
          required
          style={{ display: "block", marginBottom: 8, width: "100%" }}
        />
        <button type="submit" style={{ width: "100%" }}>Login</button>
        {loginMsg && <div style={{ marginTop: 8 }}>{loginMsg}</div>}
      </form>

      {/* Passwort vergessen Button */}
      <button
        onClick={() => navigate('/reset', { state: { email } })}
        style={{ marginTop: 24, width: "100%" }}
        type="button"
      >
        Passwort vergessen?
      </button>
    </div>
  );
}