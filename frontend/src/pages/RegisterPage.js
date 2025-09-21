import React, { useState } from "react";
// using native fetch instead of axios for smaller dependency surface
import { API_BASE } from "../config";

const SPORT_OPTIONS = [
  "Fußball",
  "Basketball",
  "Tennis",
  "Volleyball",
  "Schwimmen",
  "Laufen",
  "Handball",
];

export default function RegisterPage() {
  const [form, setForm] = useState({
    firstname: "",
    lastname: "",
    birthday: "",
    email: "",
    password: "",
    sports: [],
  });
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  function handleChange(e) {
    const { name, value } = e.target;
    setForm(prev => ({
      ...prev,
      [name]: value,
    }));
  }

  function handleSportsChange(e) {
    const value = e.target.value;
    setForm(prev => ({
      ...prev,
      sports: prev.sports.includes(value)
        ? prev.sports.filter(s => s !== value)
        : [...prev.sports, value]
    }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    setMessage("");
    console.log("Formulardaten:", form);
    try {
      const res = await fetch(`${API_BASE}/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const responseData = await (async () => {
        const t = await res.text();
        try { return JSON.parse(t); } catch { return null; }
      })();
      if (!res.ok) {
        const errMsg = responseData?.error || `HTTP ${res.status}`;
        throw new Error(errMsg);
      }
      console.log("Backend-Antwort /register:", responseData || "(no json)");
      setMessage(
        "Registrierung erfolgreich! Bitte prüfe dein E-Mail-Postfach und bestätige den Link."
      );
      setForm({
        firstname: "",
        lastname: "",
        birthday: "",
        email: "",
        password: "",
        sports: [],
      });
    } catch (err) {
      console.error("Fehler bei Registrierung:", err?.message || err);
      setMessage(
        err?.message || "Registrierung fehlgeschlagen. Bitte überprüfe deine Daten."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ maxWidth: 450, margin: "40px auto", padding: 20, border: "1px solid #eee", borderRadius: 7 }}>
      <h2>Registrieren</h2>
      <form onSubmit={handleSubmit}>
        <label>Vorname:
          <input required name="firstname" value={form.firstname} onChange={handleChange} />
        </label>
        <br />
        <label>Nachname:
          <input required name="lastname" value={form.lastname} onChange={handleChange} />
        </label>
        <br />
        <label>Geburtstag:
          <input required name="birthday" type="date" value={form.birthday} onChange={handleChange} />
        </label>
        <br />
        <label>Email:
          <input required name="email" type="email" value={form.email} onChange={handleChange} />
        </label>
        <br />
        <label>Passwort:
          <input required name="password" type="password" value={form.password} onChange={handleChange} minLength={6} autoComplete="new-password" />
        </label>
        <br />
        <label>Sportarten:
          <div>
            {SPORT_OPTIONS.map(sport => (
              <label key={sport} style={{ marginRight: 10 }}>
                <input
                  type="checkbox"
                  value={sport}
                  checked={form.sports.includes(sport)}
                  onChange={handleSportsChange}
                />
                {sport}
              </label>
            ))}
          </div>
        </label>
        <br />
        <button type="submit" disabled={loading}>
          Registrieren
        </button>
      </form>
      {message && <div style={{ marginTop: 20, color: "green" }}>{message}</div>}
    </div>
  );
}

