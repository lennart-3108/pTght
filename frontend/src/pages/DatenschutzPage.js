import React from 'react';
import { useLanguage } from '../i18n';

export default function DatenschutzPage() {
  const { lang } = useLanguage();
  const isEn = lang === 'en';

  return (
    <div style={{ maxWidth: 900, margin: '40px auto', padding: '0 20px', color: '#e5e7eb', lineHeight: 1.8 }}>
      <h1 style={{ color: '#debc7c', marginBottom: 20, fontSize: 32 }}>{isEn ? 'Privacy Policy' : 'Datenschutzerklärung'}</h1>
      <p style={{ fontSize: 14, color: '#9ca3af', marginBottom: 24 }}>{isEn ? 'As of: February 2026' : 'Stand: Februar 2026'}</p>

      <section style={{ marginBottom: 22 }}>
        <h2 style={{ color: '#48baa6', fontSize: 22 }}>{isEn ? '1. Data Controller' : '1. Verantwortlicher'}</h2>
        <p>
          Lennart Allenstein<br />
          Osterdeich 54, 28203 Bremen<br />
          {isEn ? 'Email' : 'E-Mail'}: lennart.allenstein@matchleague.org
        </p>
      </section>

      <section style={{ marginBottom: 22 }}>
        <h2 style={{ color: '#48baa6', fontSize: 22 }}>{isEn ? '2. Type of Platform' : '2. Art der Plattform'}</h2>
        <p>{isEn ? 'MatchLeague is a social platform for sports networking between users.' : 'MatchLeague ist eine soziale Plattform zur sportlichen Vernetzung von Nutzerinnen und Nutzern.'}</p>
      </section>

      <section style={{ marginBottom: 22 }}>
        <h2 style={{ color: '#48baa6', fontSize: 22 }}>{isEn ? '3. Personal Data Processed' : '3. Verarbeitete personenbezogene Daten'}</h2>
        <ul style={{ marginLeft: 20 }}>
          <li>{isEn ? 'First name' : 'Vorname'}</li>
          <li>{isEn ? 'Last name (publicly visible only as initial)' : 'Nachname (öffentlich sichtbar ausschließlich als Anfangsbuchstabe)'}</li>
          <li>{isEn ? 'Profile picture' : 'Profilbild'}</li>
          <li>{isEn ? 'Email address' : 'E-Mail-Adresse'}</li>
          <li>{isEn ? 'Sports-related activities (e.g. matches, results, times)' : 'sportbezogene Aktivitäten (z. B. Matches, Ergebnisse, Zeitpunkte)'}</li>
          <li>{isEn ? 'Technical data (IP address, browser, device type)' : 'technische Daten (IP-Adresse, Browser, Gerätetyp)'}</li>
        </ul>
      </section>

      <section style={{ marginBottom: 22 }}>
        <h2 style={{ color: '#48baa6', fontSize: 22 }}>{isEn ? '4. Public Visibility' : '4. Öffentliche Sichtbarkeit'}</h2>
        <p>
          {isEn
            ? 'Visible to other registered users are the first name, first letter of the last name, profile picture, as well as sports-related activities and results. This visibility is an essential part of the platform.'
            : 'Für andere registrierte Nutzer sichtbar sind Vorname, erster Buchstabe des Nachnamens, Profilbild sowie sportbezogene Aktivitäten und Ergebnisse. Diese Sichtbarkeit ist ein wesentlicher Bestandteil der Plattform.'}
        </p>
      </section>

      <section style={{ marginBottom: 22 }}>
        <h2 style={{ color: '#48baa6', fontSize: 22 }}>{isEn ? '5. Purposes of Data Processing' : '5. Zwecke der Datenverarbeitung'}</h2>
        <ul style={{ marginLeft: 20 }}>
          <li>{isEn ? 'Operation and provision of the platform' : 'Betrieb und Bereitstellung der Plattform'}</li>
          <li>{isEn ? 'Display of sports activities' : 'Darstellung sportlicher Aktivitäten'}</li>
          <li>{isEn ? 'Connecting users' : 'Vernetzung von Nutzern'}</li>
          <li>{isEn ? 'Security and abuse prevention' : 'Sicherheit und Missbrauchsprävention'}</li>
          <li>{isEn ? 'Financing the platform through advertising' : 'Finanzierung der Plattform durch Werbung'}</li>
        </ul>
      </section>

      <section style={{ marginBottom: 22 }}>
        <h2 style={{ color: '#48baa6', fontSize: 22 }}>{isEn ? '6. Advertising & Third Parties' : '6. Werbung & Drittanbieter'}</h2>
        <p>
          {isEn
            ? 'To finance the platform, advertising is integrated. Personal data may be transmitted to Google (e.g. Google Ad Manager / AdMob), in particular IP address, device information, and interaction data. No further disclosure of personal data to other third parties takes place.'
            : 'Zur Finanzierung der Plattform wird Werbung eingebunden. Dabei können personenbezogene Daten an Google (z. B. Google Ad Manager / AdMob) übermittelt werden, insbesondere IP-Adresse, Geräteinformationen und Interaktionsdaten. Eine weitere Weitergabe personenbezogener Daten an andere Dritte erfolgt nicht.'}
        </p>
      </section>

      <section style={{ marginBottom: 22 }}>
        <h2 style={{ color: '#48baa6', fontSize: 22 }}>{isEn ? '7. Legal Basis' : '7. Rechtsgrundlagen'}</h2>
        <p>{isEn ? 'Data processing is carried out in accordance with Art. 6 GDPR on the basis of consent, contract fulfilment, and legitimate interest.' : 'Die Datenverarbeitung erfolgt gemäß Art. 6 DSGVO auf Grundlage von Einwilligung, Vertragserfüllung und berechtigtem Interesse.'}</p>
      </section>

      <section style={{ marginBottom: 22 }}>
        <h2 style={{ color: '#48baa6', fontSize: 22 }}>{isEn ? '8. Voluntariness & Revocation' : '8. Freiwilligkeit & Widerruf'}</h2>
        <p>{isEn ? 'The provision of personal data is voluntary. Consent can be revoked at any time with effect for the future.' : 'Die Bereitstellung personenbezogener Daten erfolgt freiwillig. Einwilligungen können jederzeit mit Wirkung für die Zukunft widerrufen werden.'}</p>
      </section>

      <section style={{ marginBottom: 22 }}>
        <h2 style={{ color: '#48baa6', fontSize: 22 }}>{isEn ? '9. Storage Duration' : '9. Speicherdauer'}</h2>
        <p>{isEn ? 'Personal data is only stored as long as necessary for the operation of the platform or as required by statutory retention obligations.' : 'Personenbezogene Daten werden nur so lange gespeichert, wie dies für den Betrieb der Plattform erforderlich ist oder gesetzliche Aufbewahrungspflichten bestehen.'}</p>
      </section>

      <section style={{ marginBottom: 22 }}>
        <h2 style={{ color: '#48baa6', fontSize: 22 }}>{isEn ? '10. Rights of Data Subjects' : '10. Rechte betroffener Personen'}</h2>
        <ul style={{ marginLeft: 20 }}>
          <li>{isEn ? 'Access' : 'Auskunft'}</li>
          <li>{isEn ? 'Rectification' : 'Berichtigung'}</li>
          <li>{isEn ? 'Erasure' : 'Löschung'}</li>
          <li>{isEn ? 'Restriction of processing' : 'Einschränkung der Verarbeitung'}</li>
          <li>{isEn ? 'Data portability' : 'Datenübertragbarkeit'}</li>
          <li>{isEn ? 'Complaint to a supervisory authority' : 'Beschwerde bei einer Aufsichtsbehörde'}</li>
        </ul>
      </section>

      <section style={{ marginBottom: 22 }}>
        <h2 style={{ color: '#48baa6', fontSize: 22 }}>{isEn ? '11. Reporting Data Breaches' : '11. Meldung von Datenschutzverstößen'}</h2>
        <p>
          {isEn ? 'Data breaches can be reported via:' : 'Datenschutzverstöße können gemeldet werden über:'}
          <br />
          <a href="mailto:lennart.allenstein@matchleague.org?subject=Datenschutzversto%C3%9F%20MatchLeague" style={{ color: '#debc7c' }}>
            lennart.allenstein@matchleague.org
          </a>
        </p>
      </section>

      <section style={{ marginBottom: 22 }}>
        <h2 style={{ color: '#48baa6', fontSize: 22 }}>{isEn ? '12. International Users' : '12. Internationale Nutzer'}</h2>
        <p>
          {isEn
            ? 'The platform is oriented towards the requirements of the GDPR. In addition, the mandatory data protection provisions of the respective country apply.'
            : 'Die Plattform orientiert sich an den Vorgaben der DSGVO. Zusätzlich gelten die zwingenden gesetzlichen Datenschutzbestimmungen des jeweiligen Landes.'}
        </p>
      </section>
    </div>
  );
}
