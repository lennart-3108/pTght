import React from 'react';

export default function AGBPage() {
  return (
    <div style={{ maxWidth: 900, margin: '40px auto', padding: '0 20px', color: '#e5e7eb', lineHeight: 1.8 }}>
      <h1 style={{ color: '#debc7c', marginBottom: 20, fontSize: 32 }}>Nutzungsbedingungen</h1>
      <p style={{ fontSize: 14, color: '#9ca3af', marginBottom: 24 }}>Stand: Februar 2026</p>

      <section style={{ marginBottom: 24 }}>
        <h2 style={{ color: '#48baa6', fontSize: 22 }}>1. Geltungsbereich</h2>
        <p>Diese Nutzungsbedingungen gelten für die Nutzung der Plattform MatchLeague.</p>
      </section>

      <section style={{ marginBottom: 24 }}>
        <h2 style={{ color: '#48baa6', fontSize: 22 }}>2. Mindestalter</h2>
        <p>Die Nutzung der Plattform ist ab 16 Jahren zulässig. Personen unter 16 Jahren dürfen die Plattform nicht nutzen.</p>
      </section>

      <section style={{ marginBottom: 24 }}>
        <h2 style={{ color: '#48baa6', fontSize: 22 }}>3. Leistungsbeschreibung</h2>
        <p>
          MatchLeague stellt eine technische Plattform zur sportlichen Vernetzung bereit. Der Betreiber übernimmt keine Garantie
          für Zustandekommen von Verabredungen, sportliche Leistungen, Sicherheit oder Erfolg von Treffen.
        </p>
      </section>

      <section style={{ marginBottom: 24 }}>
        <h2 style={{ color: '#48baa6', fontSize: 22 }}>4. Eigenverantwortung der Nutzer</h2>
        <p>
          Nutzer verabreden sich eigenverantwortlich. Der Betreiber ist nicht Vertragspartner von Treffen, Matches oder sonstigen
          Aktivitäten zwischen Nutzern.
        </p>
      </section>

      <section style={{ marginBottom: 24 }}>
        <h2 style={{ color: '#48baa6', fontSize: 22 }}>5. Nutzerinhalte</h2>
        <p>
          Nutzer sind für die von ihnen bereitgestellten Inhalte selbst verantwortlich. Der Betreiber prüft Inhalte nicht vorab
          und haftet nicht für Nutzerinhalte.
        </p>
      </section>

      <section style={{ marginBottom: 24 }}>
        <h2 style={{ color: '#48baa6', fontSize: 22 }}>6. Haftung</h2>
        <p>
          Der Betreiber haftet ausschließlich bei Vorsatz und grober Fahrlässigkeit. Eine Haftung für Nutzerinhalte, Treffen
          zwischen Nutzern, Verletzungen oder Schäden, Ausfälle der Plattform und Datenverluste ist, soweit gesetzlich zulässig,
          ausgeschlossen.
        </p>
      </section>

      <section style={{ marginBottom: 24 }}>
        <h2 style={{ color: '#48baa6', fontSize: 22 }}>7. Werbung</h2>
        <p>Die Plattform enthält Werbung. Diese kann personalisiert erfolgen, sofern der Nutzer eingewilligt hat.</p>
      </section>

      <section style={{ marginBottom: 24 }}>
        <h2 style={{ color: '#48baa6', fontSize: 22 }}>8. Beendigung der Nutzung</h2>
        <p>
          Nutzer können ihr Konto jederzeit löschen. Der Betreiber behält sich vor, Nutzer bei Verstößen gegen diese Bedingungen
          zu sperren oder auszuschließen.
        </p>
      </section>

      <section style={{ marginBottom: 24 }}>
        <h2 style={{ color: '#48baa6', fontSize: 22 }}>9. Anwendbares Recht</h2>
        <p>Es gilt das Recht der Bundesrepublik Deutschland. Zwingende Verbraucherschutzrechte anderer Staaten bleiben unberührt.</p>
      </section>
    </div>
  );
}
