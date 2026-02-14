import React from 'react';

export default function ImpressumPage() {
  return (
    <div style={{ maxWidth: 900, margin: '40px auto', padding: '0 20px', color: '#e5e7eb', lineHeight: 1.8 }}>
      <h1 style={{ color: '#debc7c', marginBottom: 20, fontSize: 32 }}>Impressum</h1>
      <p style={{ fontSize: 14, color: '#9ca3af', marginBottom: 24 }}>Stand: Februar 2026</p>

      <p>Angaben gemäß § 5 DDG (Digitale-Dienste-Gesetz)</p>
      <p>
        Betreiber der Plattform <strong>MatchLeague</strong> ist eine Privatperson.
      </p>

      <div style={{ marginTop: 20 }}>
        <p><strong>Name:</strong> Lennart Allenstein</p>
        <p><strong>Anschrift:</strong> Osterdeich 54, 28203 Bremen, Deutschland</p>
        <p><strong>E-Mail:</strong> lennart.allenstein@matchleague.org</p>
      </div>

      <p style={{ marginTop: 20 }}>MatchLeague wird nicht als eingetragenes Unternehmen betrieben.</p>
    </div>
  );
}
