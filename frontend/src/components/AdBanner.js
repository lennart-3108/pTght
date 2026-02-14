import React, { useEffect, useRef } from 'react';
import { getConsentStatus } from './CookieBanner';

/**
 * Google AdSense In-Feed Ad Unit.
 * Only renders when cookie consent is granted.
 * 
 * Props:
 *   slot   – AdSense ad-slot ID (string), e.g. "1234567890"
 *   format – ad format, default "fluid"
 *   layout – layout key for in-feed, default "in-article"
 *   style  – optional style overrides
 */
export default function AdBanner({ slot, format = 'fluid', layout = 'in-article', style = {} }) {
  const adRef = useRef(null);
  const pushed = useRef(false);
  const consent = getConsentStatus();

  useEffect(() => {
    if (consent !== 'granted') return;
    if (pushed.current) return;

    try {
      (window.adsbygoogle = window.adsbygoogle || []).push({});
      pushed.current = true;
    } catch (e) {
      console.warn('[AdBanner] adsbygoogle push failed:', e);
    }
  }, [consent]);

  // No consent → show nothing (no placeholder)
  if (consent !== 'granted') {
    return null;
  }

  return (
    <div style={{ margin: '8px 0', textAlign: 'center', ...style }}>
      <ins
        ref={adRef}
        className="adsbygoogle"
        style={{ display: 'block' }}
        data-ad-client="ca-pub-XXXXXXXXXXXXXXXX"
        data-ad-slot={slot || 'XXXXXXXXXX'}
        data-ad-format={format}
        data-ad-layout-key={layout === 'in-article' ? '-6t+ed+2i-1n-4w' : undefined}
        data-full-width-responsive="true"
      />
      <div style={{ fontSize: 10, color: '#5a7d66', marginTop: 4, letterSpacing: '0.05em' }}>
        ANZEIGE
      </div>
    </div>
  );
}
