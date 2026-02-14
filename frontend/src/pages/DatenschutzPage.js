import React from 'react';

export default function DatenschutzPage() {
  return (
    <div style={{ maxWidth: 900, margin: '40px auto', padding: '0 20px', color: '#e5e7eb', lineHeight: 1.8 }}>
      <h1 style={{ color: '#debc7c', marginBottom: 20, fontSize: 32 }}>Datenschutzerklärung</h1>
      <p style={{ fontSize: 14, color: '#9ca3af', marginBottom: 24 }}>Stand: Februar 2026</p>

      <section style={{ marginBottom: 22 }}>
        <h2 style={{ color: '#48baa6', fontSize: 22 }}>1. Verantwortlicher</h2>
        <p>
          Lennart Allenstein<br />
          Osterdeich 54, 28203 Bremen<br />
          E-Mail: lennart.allenstein@matchleague.org
        </p>
      </section>

      <section style={{ marginBottom: 22 }}>
        <h2 style={{ color: '#48baa6', fontSize: 22 }}>2. Art der Plattform</h2>
        <p>MatchLeague ist eine soziale Plattform zur sportlichen Vernetzung von Nutzerinnen und Nutzern.</p>
      </section>

      <section style={{ marginBottom: 22 }}>
        <h2 style={{ color: '#48baa6', fontSize: 22 }}>3. Verarbeitete personenbezogene Daten</h2>
        <ul style={{ marginLeft: 20 }}>
          <li>Vorname</li>
          <li>Nachname (öffentlich sichtbar ausschließlich als Anfangsbuchstabe)</li>
          <li>Profilbild</li>
          <li>E-Mail-Adresse</li>
          <li>sportbezogene Aktivitäten (z. B. Matches, Ergebnisse, Zeitpunkte)</li>
          <li>technische Daten (IP-Adresse, Browser, Gerätetyp)</li>
        </ul>
      </section>

      <section style={{ marginBottom: 22 }}>
        <h2 style={{ color: '#48baa6', fontSize: 22 }}>4. Öffentliche Sichtbarkeit</h2>
        <p>
          Für andere registrierte Nutzer sichtbar sind Vorname, erster Buchstabe des Nachnamens, Profilbild sowie sportbezogene
          Aktivitäten und Ergebnisse. Diese Sichtbarkeit ist ein wesentlicher Bestandteil der Plattform.
        </p>
      </section>

      <section style={{ marginBottom: 22 }}>
        <h2 style={{ color: '#48baa6', fontSize: 22 }}>5. Zwecke der Datenverarbeitung</h2>
        <ul style={{ marginLeft: 20 }}>
          <li>Betrieb und Bereitstellung der Plattform</li>
          <li>Darstellung sportlicher Aktivitäten</li>
          <li>Vernetzung von Nutzern</li>
          <li>Sicherheit und Missbrauchsprävention</li>
          <li>Finanzierung der Plattform durch Werbung</li>
        </ul>
      </section>

      <section style={{ marginBottom: 22 }}>
        <h2 style={{ color: '#48baa6', fontSize: 22 }}>6. Werbung & Drittanbieter</h2>
        <p>
          Zur Finanzierung der Plattform wird Werbung eingebunden. Dabei können personenbezogene Daten an Google (z. B. Google Ad
          Manager / AdMob) übermittelt werden, insbesondere IP-Adresse, Geräteinformationen und Interaktionsdaten. Eine weitere
          Weitergabe personenbezogener Daten an andere Dritte erfolgt nicht.
        </p>
      </section>

      <section style={{ marginBottom: 22 }}>
        <h2 style={{ color: '#48baa6', fontSize: 22 }}>7. Rechtsgrundlagen</h2>
        <p>Die Datenverarbeitung erfolgt gemäß Art. 6 DSGVO auf Grundlage von Einwilligung, Vertragserfüllung und berechtigtem Interesse.</p>
      </section>

      <section style={{ marginBottom: 22 }}>
        <h2 style={{ color: '#48baa6', fontSize: 22 }}>8. Freiwilligkeit & Widerruf</h2>
        <p>Die Bereitstellung personenbezogener Daten erfolgt freiwillig. Einwilligungen können jederzeit mit Wirkung für die Zukunft widerrufen werden.</p>
      </section>

      <section style={{ marginBottom: 22 }}>
        <h2 style={{ color: '#48baa6', fontSize: 22 }}>9. Speicherdauer</h2>
        <p>Personenbezogene Daten werden nur so lange gespeichert, wie dies für den Betrieb der Plattform erforderlich ist oder gesetzliche Aufbewahrungspflichten bestehen.</p>
      </section>

      <section style={{ marginBottom: 22 }}>
        <h2 style={{ color: '#48baa6', fontSize: 22 }}>10. Rechte betroffener Personen</h2>
        <ul style={{ marginLeft: 20 }}>
          <li>Auskunft</li>
          <li>Berichtigung</li>
          <li>Löschung</li>
          <li>Einschränkung der Verarbeitung</li>
          <li>Datenübertragbarkeit</li>
          <li>Beschwerde bei einer Aufsichtsbehörde</li>
        </ul>
      </section>

      <section style={{ marginBottom: 22 }}>
        <h2 style={{ color: '#48baa6', fontSize: 22 }}>11. Meldung von Datenschutzverstößen</h2>
        <p>
          Datenschutzverstöße können gemeldet werden über:
          <br />
          <a href="mailto:lennart.allenstein@matchleague.org?subject=Datenschutzversto%C3%9F%20MatchLeague" style={{ color: '#debc7c' }}>
            lennart.allenstein@matchleague.org
          </a>
        </p>
      </section>

      <section style={{ marginBottom: 22 }}>
        <h2 style={{ color: '#48baa6', fontSize: 22 }}>12. Internationale Nutzer</h2>
        <p>
          Die Plattform orientiert sich an den Vorgaben der DSGVO. Zusätzlich gelten die zwingenden gesetzlichen Datenschutzbestimmungen
          des jeweiligen Landes.
        </p>
      </section>
    </div>
  );
}
