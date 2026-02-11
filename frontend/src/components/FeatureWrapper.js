import React from 'react';
import { FEATURES } from '../config';
import ComingSoonOverlay from './ComingSoonOverlay';

/**
 * FeatureWrapper - Wraps content with Coming Soon overlay if feature is disabled
 * Used to hide features in test instance while keeping them visible
 */
export default function FeatureWrapper({ feature, message, children }) {
  // If feature is enabled, render children normally
  if (feature) {
    return <>{children}</>;
  }

  // If feature is disabled, show coming soon overlay
  return (
    <ComingSoonOverlay message={message}>
      {children}
    </ComingSoonOverlay>
  );
}

// Convenience wrappers for specific features
export function LeaguesFeature({ children }) {
  return (
    <FeatureWrapper 
      feature={FEATURES.SHOW_LEAGUES} 
      message="Ligen Coming Soon"
    >
      {children}
    </FeatureWrapper>
  );
}

export function CompetitionsFeature({ children }) {
  return (
    <FeatureWrapper 
      feature={FEATURES.SHOW_COMPETITIONS} 
      message="Wettbewerbe Coming Soon"
    >
      {children}
    </FeatureWrapper>
  );
}

export function BookingsFeature({ children }) {
  return (
    <FeatureWrapper 
      feature={FEATURES.SHOW_BOOKINGS} 
      message="Platz-Buchung Coming Soon"
    >
      {children}
    </FeatureWrapper>
  );
}

export function VenuesFeature({ children }) {
  return (
    <FeatureWrapper 
      feature={FEATURES.SHOW_VENUES} 
      message="Locations Coming Soon"
    >
      {children}
    </FeatureWrapper>
  );
}
