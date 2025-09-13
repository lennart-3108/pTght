import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";

export default function RegistrationPage() {
  const navigate = useNavigate();
  const [firstname, setFirstname] = useState("");
  const [lastname, setLastname] = useState("");
  const [birthday, setBirthday] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [availableSports, setAvailableSports] = useState([]);
  const [selectedSports, setSelectedSports] = useState([]);
  const [message, setMessage] = useState("");

  useEffect(() => {
    fetch("http://localhost:5001/sports")
      .then(res => res.json())
      .then(data => setAvailableSports(data || []))
      .catch(() => setAvailableSports([]));
  }, []);

  const handleRegister = async (e) => {
    e.preventDefault();
    setMessage("");
    if (password !== confirmPassword) {
      setMessage("Passwörter stimmen nicht überein.");
      return;
    }
    if (selectedSports.length === 0) {
      setMessage("Bitte mindestens eine Sportart wählen.");
      return;
    }
    try {
      const res = await fetch("http://localhost:5001/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firstname,
          lastname,
          birthday,
          email,
          password,
          sports: selectedSports
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setMessage("✅ Registrierung erfolgreich! Prüfe deine E-Mail (Mailtrap).");
        // navigate("/login");
      } else {
        setMessage(data.error || "Registrierung fehlgeschlagen.");
      }
    } catch {
      setMessage("Server nicht erreichbar.");
    }
  };

  return (
    <div style={{ maxWidth: 420, margin: "60px auto", padding: 20, border: "1px solid #ccc", borderRadius: 8 }}>
      <h2>Registrieren</h2>
      <form onSubmit={handleRegister}>
        <input type="text" placeholder="Vorname" value={firstname} onChange={(e) => setFirstname(e.target.value)} required style={{ display: "block", marginBottom: 8, width: "100%" }} />
        <input type="text" placeholder="Nachname" value={lastname} onChange={(e) => setLastname(e.target.value)} required style={{ display: "block", marginBottom: 8, width: "100%" }} />
        <input type="date" placeholder="Geburtstag" value={birthday} onChange={(e) => setBirthday(e.target.value)} required style={{ display: "block", marginBottom: 8, width: "100%" }} />
        <input type="email" placeholder="E-Mail" value={email} onChange={(e) => setEmail(e.target.value)} required style={{ display: "block", marginBottom: 8, width: "100%" }} />
        <input type="password" placeholder="Passwort" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} style={{ display: "block", marginBottom: 8, width: "100%" }} />
        <input type="password" placeholder="Passwort bestätigen" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required style={{ display: "block", marginBottom: 8, width: "100%" }} />
        <div style={{ margin: "8px 0" }}>
          <label style={{ display: "block", marginBottom: 4 }}>Sportarten</label>
          <select
            multiple
            value={selectedSports}
            onChange={(e) => setSelectedSports(Array.from(e.target.selectedOptions).map(o => o.value))}
            style={{ width: "100%", minHeight: 90 }}
            required
          >
            {availableSports.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>
        <button type="submit" style={{ width: "100%" }}>Registrieren</button>
        {message && <div style={{ marginTop: 8 }}>{message}</div>}
      </form>
    </div>
  );
}
