import React, { useState } from "react";
import axios from "axios";

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
      const response = await axios.post("http://localhost:5001/register", form);
      console.log("Backend-Antwort /register:", response.data);
      setMessage(
        "Registrierung erfolgreich! Bitte prüfe deine Mailbox und bestätige deinen Account über den Link."
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
      console.error("Fehler bei Registrierung:", err?.response?.data || err.message);
      setMessage(
        err?.response?.data?.error ||
        "Registrierung fehlgeschlagen. Bitte überprüfe deine Daten."
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
          <input required name="password" type="password" value={form.password} onChange={handleChange} minLength={6} />
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

