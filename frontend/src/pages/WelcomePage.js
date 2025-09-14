import React from "react";
import { Link, useLocation } from "react-router-dom";
import matchLeagueLogo from "../images/MatchLeague2.png";

function useQuery() {
  const { search } = useLocation();
  return React.useMemo(() => new URLSearchParams(search), [search]);
}

export default function WelcomePage() {
  const q = useQuery();
  const confirmed = q.get("confirmed") === "1";
  const next = q.get("next");

  return (
    <div style={{ maxWidth: 800, margin: "24px auto", padding: 16 }}>
      <img src={matchLeagueLogo} alt="MatchLeague" className="hero-logo" />
      <h2 style={{ marginTop: 12 }}>Willkommen bei Match League</h2>

      {confirmed ? (
        <div style={{ color: "green", margin: "8px 0" }}>✅ Deine E-Mail wurde bestätigt.</div>
      ) : next === "confirm-email" ? (
        <div style={{ color: "#555", margin: "8px 0" }}>
          Bitte bestätige deine E-Mail-Adresse. Prüfe ggf. den Spam-Ordner.
        </div>
      ) : null}

      <h3>Was du jetzt machen kannst</h3>
      <ul>
        <li>Profil vervollständigen (Name, Geburtstag, Sportarten)</li>
        <li>Sportarten durchsuchen und Ligen in deiner Stadt finden</li>
        <li>Spiele, Ergebnisse und Tabellen verfolgen</li>
        <li>Mit Teams vernetzen und an Spielen teilnehmen</li>
        <li>Als Admin: Admin-Bereich nutzen (Statistiken, Datensätze prüfen)</li>
      </ul>

      <div style={{ marginTop: 16, display: "flex", gap: 8, flexWrap: "wrap" }}>
        <Link to="/login"><button>Zum Login</button></Link>
        <Link to="/sports"><button>Sportarten ansehen</button></Link>
        <Link to="/"><button>Zur Startseite</button></Link>
      </div>
    </div>
  );
}
