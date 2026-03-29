import React from 'react';
import { useLanguage } from '../i18n';

export default function AGBPage() {
  const { lang } = useLanguage();
  const isEn = lang === 'en';

  const sections = isEn ? [
    { title: '1. Scope', text: 'These terms of use apply to the use of the MatchLeague platform.' },
    { title: '2. Minimum age', text: 'Use of the platform is permitted from 16 years of age. Persons under 16 may not use the platform.' },
    { title: '3. Description of services', text: 'MatchLeague provides a technical platform for sports networking. The operator does not guarantee the conclusion of arrangements, sports performances, safety, or success of meetings.' },
    { title: '4. User responsibility', text: 'Users arrange meetings at their own responsibility. The operator is not a contractual party of meetings, matches, or other activities between users.' },
    { title: '5. User content', text: 'Users are solely responsible for the content they provide. The operator does not review content in advance and is not liable for user content.' },
    { title: '6. Liability', text: 'The operator is only liable in cases of intent and gross negligence. Liability for user content, meetings between users, injuries or damages, platform outages, and data loss is excluded to the extent permitted by law.' },
    { title: '7. Advertising', text: 'The platform contains advertising. This may be personalised if the user has given consent.' },
    { title: '8. Termination of use', text: 'Users can delete their account at any time. The operator reserves the right to block or exclude users who violate these terms.' },
    { title: '9. Applicable law', text: 'The law of the Federal Republic of Germany applies. Mandatory consumer protection rights of other countries remain unaffected.' },
  ] : [
    { title: '1. Geltungsbereich', text: 'Diese Nutzungsbedingungen gelten für die Nutzung der Plattform MatchLeague.' },
    { title: '2. Mindestalter', text: 'Die Nutzung der Plattform ist ab 16 Jahren zulässig. Personen unter 16 Jahren dürfen die Plattform nicht nutzen.' },
    { title: '3. Leistungsbeschreibung', text: 'MatchLeague stellt eine technische Plattform zur sportlichen Vernetzung bereit. Der Betreiber übernimmt keine Garantie für Zustandekommen von Verabredungen, sportliche Leistungen, Sicherheit oder Erfolg von Treffen.' },
    { title: '4. Eigenverantwortung der Nutzer', text: 'Nutzer verabreden sich eigenverantwortlich. Der Betreiber ist nicht Vertragspartner von Treffen, Matches oder sonstigen Aktivitäten zwischen Nutzern.' },
    { title: '5. Nutzerinhalte', text: 'Nutzer sind für die von ihnen bereitgestellten Inhalte selbst verantwortlich. Der Betreiber prüft Inhalte nicht vorab und haftet nicht für Nutzerinhalte.' },
    { title: '6. Haftung', text: 'Der Betreiber haftet ausschließlich bei Vorsatz und grober Fahrlässigkeit. Eine Haftung für Nutzerinhalte, Treffen zwischen Nutzern, Verletzungen oder Schäden, Ausfälle der Plattform und Datenverluste ist, soweit gesetzlich zulässig, ausgeschlossen.' },
    { title: '7. Werbung', text: 'Die Plattform enthält Werbung. Diese kann personalisiert erfolgen, sofern der Nutzer eingewilligt hat.' },
    { title: '8. Beendigung der Nutzung', text: 'Nutzer können ihr Konto jederzeit löschen. Der Betreiber behält sich vor, Nutzer bei Verstößen gegen diese Bedingungen zu sperren oder auszuschließen.' },
    { title: '9. Anwendbares Recht', text: 'Es gilt das Recht der Bundesrepublik Deutschland. Zwingende Verbraucherschutzrechte anderer Staaten bleiben unberührt.' },
  ];

  return (
    <div style={{ maxWidth: 900, margin: '40px auto', padding: '0 20px', color: '#e5e7eb', lineHeight: 1.8 }}>
      <h1 style={{ color: '#debc7c', marginBottom: 20, fontSize: 32 }}>{isEn ? 'Terms of Use' : 'Nutzungsbedingungen'}</h1>
      <p style={{ fontSize: 14, color: '#9ca3af', marginBottom: 24 }}>{isEn ? 'As of: February 2026' : 'Stand: Februar 2026'}</p>

      {sections.map((s, i) => (
        <section key={i} style={{ marginBottom: 24 }}>
          <h2 style={{ color: '#48baa6', fontSize: 22 }}>{s.title}</h2>
          <p>{s.text}</p>
        </section>
      ))}
    </div>
  );
}
