import React from "react";

export default function DatenschutzPage() {
  return (
    <div style={{ 
      maxWidth: 800, 
      margin: '40px auto', 
      padding: '0 20px',
      color: '#e5e7eb',
      lineHeight: 1.8
    }}>
      <h1 style={{ 
        color: '#48baa6', 
        marginBottom: 30,
        fontSize: 32 
      }}>
        Datenschutzerklärung
      </h1>

      <p style={{ fontSize: 14, color: '#9ca3af', marginBottom: 30 }}>
        Stand: Januar 2026
      </p>

      <section style={{ marginBottom: 40 }}>
        <h2 style={{ color: '#48baa6', fontSize: 24, marginBottom: 16 }}>
          1. Verantwortlicher
        </h2>
        <p>
          Verantwortlich für die Datenverarbeitung auf dieser Plattform ist:<br /><br />
          Match League<br />
          E-Mail: info@matchleague.org
        </p>
      </section>

      <section style={{ marginBottom: 40 }}>
        <h2 style={{ color: '#48baa6', fontSize: 24, marginBottom: 16 }}>
          2. Erhebung und Speicherung personenbezogener Daten
        </h2>
        <p style={{ marginBottom: 12 }}>
          Bei der Registrierung auf unserer Plattform erheben wir folgende Daten:
        </p>
        <ul style={{ marginLeft: 20, marginBottom: 12 }}>
          <li>Vorname und Nachname</li>
          <li>E-Mail-Adresse</li>
          <li>Geburtsdatum</li>
          <li>Geschlecht</li>
          <li>Wohnort (Stadt/Bezirk)</li>
          <li>Sportliche Präferenzen</li>
        </ul>
        <p>
          Diese Daten werden benötigt, um Ihnen die Nutzung der Plattform zu ermöglichen 
          und passende Sportpartner zu finden.
        </p>
      </section>

      <section style={{ marginBottom: 40 }}>
        <h2 style={{ color: '#48baa6', fontSize: 24, marginBottom: 16 }}>
          3. Zweck der Datenverarbeitung
        </h2>
        <p style={{ marginBottom: 12 }}>
          Ihre Daten werden für folgende Zwecke verarbeitet:
        </p>
        <ul style={{ marginLeft: 20 }}>
          <li>Bereitstellung und Verwaltung Ihres Nutzerkontos</li>
          <li>Vermittlung von Sportpartnern und Organisation von Matches</li>
          <li>Buchung von Sportanlagen</li>
          <li>Kommunikation zwischen Nutzern</li>
          <li>Verbesserung unserer Dienstleistungen</li>
          <li>Versand von Benachrichtigungen und Updates</li>
        </ul>
      </section>

      <section style={{ marginBottom: 40 }}>
        <h2 style={{ color: '#48baa6', fontSize: 24, marginBottom: 16 }}>
          4. Rechtsgrundlage der Verarbeitung
        </h2>
        <p style={{ marginBottom: 12 }}>
          Die Verarbeitung Ihrer personenbezogenen Daten erfolgt auf Grundlage von:
        </p>
        <ul style={{ marginLeft: 20 }}>
          <li>Art. 6 Abs. 1 lit. b DSGVO (Vertragserfüllung)</li>
          <li>Art. 6 Abs. 1 lit. a DSGVO (Einwilligung)</li>
          <li>Art. 6 Abs. 1 lit. f DSGVO (berechtigte Interessen)</li>
        </ul>
      </section>

      <section style={{ marginBottom: 40 }}>
        <h2 style={{ color: '#48baa6', fontSize: 24, marginBottom: 16 }}>
          5. Weitergabe von Daten
        </h2>
        <p style={{ marginBottom: 12 }}>
          Wir geben Ihre Daten nur in folgenden Fällen weiter:
        </p>
        <ul style={{ marginLeft: 20 }}>
          <li>An andere Nutzer, soweit dies für die Organisation von Matches erforderlich ist</li>
          <li>An Betreiber von Sportanlagen bei Buchungen</li>
          <li>An technische Dienstleister (z.B. Hosting-Provider)</li>
          <li>Wenn wir gesetzlich dazu verpflichtet sind</li>
        </ul>
      </section>

      <section style={{ marginBottom: 40 }}>
        <h2 style={{ color: '#48baa6', fontSize: 24, marginBottom: 16 }}>
          6. Speicherdauer
        </h2>
        <p>
          Wir speichern Ihre personenbezogenen Daten so lange, wie dies für die Erfüllung 
          der genannten Zwecke erforderlich ist. Nach Löschung Ihres Kontos werden Ihre 
          Daten gelöscht, soweit keine gesetzlichen Aufbewahrungspflichten bestehen.
        </p>
      </section>

      <section style={{ marginBottom: 40 }}>
        <h2 style={{ color: '#48baa6', fontSize: 24, marginBottom: 16 }}>
          7. Ihre Rechte
        </h2>
        <p style={{ marginBottom: 12 }}>
          Sie haben folgende Rechte bezüglich Ihrer personenbezogenen Daten:
        </p>
        <ul style={{ marginLeft: 20 }}>
          <li><strong>Auskunftsrecht:</strong> Sie können Auskunft über Ihre gespeicherten Daten verlangen</li>
          <li><strong>Berichtigungsrecht:</strong> Sie können die Berichtigung unrichtiger Daten verlangen</li>
          <li><strong>Löschungsrecht:</strong> Sie können die Löschung Ihrer Daten verlangen</li>
          <li><strong>Einschränkung der Verarbeitung:</strong> Sie können die Einschränkung der Verarbeitung verlangen</li>
          <li><strong>Datenübertragbarkeit:</strong> Sie können Ihre Daten in einem strukturierten Format erhalten</li>
          <li><strong>Widerspruchsrecht:</strong> Sie können der Verarbeitung Ihrer Daten widersprechen</li>
        </ul>
      </section>

      <section style={{ marginBottom: 40 }}>
        <h2 style={{ color: '#48baa6', fontSize: 24, marginBottom: 16 }}>
          8. Cookies und Tracking
        </h2>
        <p>
          Wir verwenden Cookies, um die Funktionalität der Plattform zu gewährleisten und 
          Ihr Nutzererlebnis zu verbessern. Sie können die Verwendung von Cookies in Ihren 
          Browser-Einstellungen deaktivieren, dies kann jedoch die Funktionalität der 
          Plattform einschränken.
        </p>
      </section>

      <section style={{ marginBottom: 40 }}>
        <h2 style={{ color: '#48baa6', fontSize: 24, marginBottom: 16 }}>
          9. Sicherheit
        </h2>
        <p>
          Wir setzen technische und organisatorische Sicherheitsmaßnahmen ein, um Ihre Daten 
          gegen zufällige oder vorsätzliche Manipulationen, Verlust, Zerstörung oder gegen 
          den Zugriff unberechtigter Personen zu schützen.
        </p>
      </section>

      <section style={{ marginBottom: 40 }}>
        <h2 style={{ color: '#48baa6', fontSize: 24, marginBottom: 16 }}>
          10. Änderungen der Datenschutzerklärung
        </h2>
        <p>
          Wir behalten uns vor, diese Datenschutzerklärung anzupassen, um sie an geänderte 
          Rechtslagen oder Änderungen unserer Dienstleistungen anzupassen. Die aktuelle 
          Version finden Sie stets auf dieser Seite.
        </p>
      </section>

      <section style={{ marginBottom: 40 }}>
        <h2 style={{ color: '#48baa6', fontSize: 24, marginBottom: 16 }}>
          11. Beschwerderecht
        </h2>
        <p>
          Sie haben das Recht, sich bei einer Datenschutz-Aufsichtsbehörde über die 
          Verarbeitung Ihrer personenbezogenen Daten durch uns zu beschweren.
        </p>
      </section>

      <div style={{ 
        marginTop: 60, 
        paddingTop: 30, 
        borderTop: '1px solid #374151',
        fontSize: 14,
        color: '#9ca3af' 
      }}>
        <p>
          <strong>Kontakt für Datenschutzanfragen:</strong><br />
          Match League<br />
          E-Mail: datenschutz@matchleague.org
        </p>
      </div>
    </div>
  );
}
