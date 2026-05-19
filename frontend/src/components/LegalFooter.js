import React from 'react';
import { Link } from 'react-router-dom';
import { useLanguage } from '../i18n';

export default function LegalFooter() {
  const { t } = useLanguage();
  return (
    <footer
      style={{
        marginTop: 32,
        padding: '20px 16px 26px',
        borderTop: '1px solid rgba(222, 188, 124, 0.2)',
        background: 'rgba(8, 28, 25, 0.85)',
      }}
    >
      <div
        style={{
          maxWidth: 1200,
          margin: '0 auto',
          display: 'flex',
          flexWrap: 'wrap',
          gap: 14,
          alignItems: 'center',
          justifyContent: 'space-between',
          color: '#9db3aa',
          fontSize: 13,
        }}
      >
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
          <Link to="/impressum" style={{ color: '#debc7c', textDecoration: 'none' }}>{t('footer.impressum')}</Link>
          <Link to="/datenschutz" style={{ color: '#debc7c', textDecoration: 'none' }}>{t('footer.privacy')}</Link>
          <Link to="/agb" style={{ color: '#debc7c', textDecoration: 'none' }}>{t('footer.terms')}</Link>
          <Link to="/meldung-rechtswidriger-inhalte" style={{ color: '#debc7c', textDecoration: 'none' }}>
            {t('footer.report')}
          </Link>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <span>© {new Date().getFullYear()} Match League</span>
          <span>Made with 🧡 in Bremen</span>
          <span style={{ opacity: 0.5, fontSize: 11 }}>v{process.env.REACT_APP_VERSION || require('../../package.json').version}</span>
        </div>
      </div>
    </footer>
  );
}
