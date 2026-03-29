import React from 'react';
import { useLanguage } from '../i18n';

export default function ImpressumPage() {
  const { lang } = useLanguage();
  const isEn = lang === 'en';

  return (
    <div style={{ maxWidth: 900, margin: '40px auto', padding: '0 20px', color: '#e5e7eb', lineHeight: 1.8 }}>
      <h1 style={{ color: '#debc7c', marginBottom: 20, fontSize: 32 }}>{isEn ? 'Imprint' : 'Impressum'}</h1>
      <p style={{ fontSize: 14, color: '#9ca3af', marginBottom: 24 }}>{isEn ? 'As of: February 2026' : 'Stand: Februar 2026'}</p>

      <p>{isEn ? 'Information pursuant to § 5 DDG (Digital Services Act)' : 'Angaben gemäß § 5 DDG (Digitale-Dienste-Gesetz)'}</p>
      <p>
        {isEn
          ? <>The operator of the platform <strong>MatchLeague</strong> is a private individual.</>
          : <>Betreiber der Plattform <strong>MatchLeague</strong> ist eine Privatperson.</>}
      </p>

      <div style={{ marginTop: 20 }}>
        <p><strong>{isEn ? 'Name:' : 'Name:'}</strong> Lennart Allenstein</p>
        <p><strong>{isEn ? 'Address:' : 'Anschrift:'}</strong> Osterdeich 54, 28203 Bremen, {isEn ? 'Germany' : 'Deutschland'}</p>
      </div>

      <p style={{ marginTop: 20 }}>{isEn ? 'MatchLeague is not operated as a registered business.' : 'MatchLeague wird nicht als eingetragenes Unternehmen betrieben.'}</p>
    </div>
  );
}
