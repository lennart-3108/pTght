import React, { useState } from 'react';
import { API_BASE } from '../config';

/**
 * BookingWidget - Display confirmed booking details in match view
 * 
 * @param {Object} booking - Booking data with location, asset, and time details
 * @param {Function} onCancel - Callback when booking is cancelled
 */
export default function BookingWidget({ booking, onCancel }) {
  const [cancelling, setCancelling] = useState(false);

  if (!booking) return null;

  async function handleCancelBooking() {
    if (!window.confirm('Möchtest du diese Buchung wirklich stornieren?')) {
      return;
    }

    setCancelling(true);
    
    try {
      const response = await fetch(`${API_BASE}/bookings/${booking.id}/cancel`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        }
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Stornierung fehlgeschlagen');
      }

      alert('✅ Buchung erfolgreich storniert!');
      
      // Call parent callback
      if (onCancel) {
        onCancel();
      }

    } catch (error) {
      console.error('Cancel booking error:', error);
      alert('❌ Stornierung fehlgeschlagen: ' + (error.message || 'Unbekannter Fehler'));
    } finally {
      setCancelling(false);
    }
  }

  // Format date and time
  const formatDate = (dateStr) => {
    if (!dateStr) return 'Datum nicht verfügbar';
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return 'Datum nicht verfügbar';
    return date.toLocaleDateString('de-DE', { 
      weekday: 'short', 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric' 
    });
  };

  const formatTime = (timeStr) => {
    if (!timeStr) return '--:--';
    const date = new Date(timeStr);
    if (isNaN(date.getTime())) return '--:--';
    return date.toLocaleTimeString('de-DE', { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <div style={styles.badge}>
          <span style={styles.badgeIcon}>✓</span>
          <span style={styles.badgeText}>Platz gebucht</span>
        </div>
        {booking.payment_status === 'paid' && (
          <div style={styles.paidBadge}>
            💳 BEZAHLT
          </div>
        )}
      </div>

      <div style={styles.content}>
        {/* Date & Time */}
        <div style={styles.section}>
          <div style={styles.iconRow}>
            <span style={styles.icon}>📅</span>
            <div style={styles.infoBlock}>
              <div style={styles.label}>Datum & Uhrzeit</div>
              <div style={styles.value}>
                {formatDate(booking.start_time)}
              </div>
              <div style={styles.timeRange}>
                {formatTime(booking.start_time)} - {formatTime(booking.end_time)} Uhr
              </div>
            </div>
          </div>
        </div>

        {/* Location */}
        <div style={styles.section}>
          <div style={styles.iconRow}>
            <span style={styles.icon}>📍</span>
            <div style={styles.infoBlock}>
              <div style={styles.label}>Adresse</div>
              <div style={styles.value}>
                {booking.location_address || booking.address}
              </div>
              <div style={styles.city}>
                {booking.location_city || booking.city}
              </div>
            </div>
          </div>
        </div>

        {/* Facility */}
        <div style={styles.section}>
          <div style={styles.iconRow}>
            <span style={styles.icon}>🏟️</span>
            <div style={styles.infoBlock}>
              <div style={styles.label}>Location</div>
              <div style={styles.value}>
                {booking.location_name}
              </div>
            </div>
          </div>
        </div>

        {/* Asset */}
        <div style={styles.section}>
          <div style={styles.iconRow}>
            <span style={styles.icon}>🎯</span>
            <div style={styles.infoBlock}>
              <div style={styles.label}>Platz / Court</div>
              <div style={styles.value}>
                {booking.asset_name}
              </div>
              {/* Asset Properties */}
              {(booking.asset_type || booking.surface) && (
                <div style={styles.properties}>
                  {booking.asset_type && (
                    <span style={styles.tag}>
                      🏷️ {booking.asset_type}
                    </span>
                  )}
                  {booking.surface && (
                    <span style={styles.tag}>
                      🎾 {booking.surface}
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Price */}
        {booking.base_price > 0 && (
          <div style={styles.priceSection}>
            <div style={styles.priceLabel}>Preis</div>
            <div style={styles.priceValue}>
              {booking.base_price} {booking.currency || 'EUR'}
            </div>
          </div>
        )}

        {/* Invoice Number */}
        {booking.invoice_number && (
          <div style={styles.invoiceSection}>
            <span style={styles.invoiceLabel}>Rechnung:</span>
            <span style={styles.invoiceNumber}>{booking.invoice_number}</span>
          </div>
        )}

        {/* Cancel Booking Button */}
        <div style={styles.cancelSection}>
          <button
            onClick={handleCancelBooking}
            disabled={cancelling || booking.status === 'cancelled'}
            style={{
              ...styles.cancelBtn,
              ...(cancelling || booking.status === 'cancelled' ? styles.cancelBtnDisabled : {})
            }}
          >
            {cancelling ? '⏳ Storniere...' : booking.status === 'cancelled' ? '✓ Storniert' : '🗑️ Buchung stornieren'}
          </button>
          {booking.status !== 'cancelled' && (
            <div style={styles.cancelNote}>
              Die Buchung kann kostenlos storniert werden
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

const styles = {
  container: {
    background: 'linear-gradient(135deg, #1b4b3d 0%, #0e2a22 100%)',
    border: '2px solid #2f6b57',
    borderRadius: 16,
    padding: 20,
    marginTop: 16,
    marginBottom: 16,
    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)'
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    paddingBottom: 12,
    borderBottom: '1px solid rgba(47, 107, 87, 0.3)'
  },
  badge: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    background: '#10b981',
    padding: '6px 14px',
    borderRadius: 20,
    fontWeight: 700
  },
  badgeIcon: {
    fontSize: 16,
    color: '#fff'
  },
  badgeText: {
    fontSize: 14,
    color: '#fff',
    textTransform: 'uppercase',
    letterSpacing: '0.5px'
  },
  paidBadge: {
    background: 'rgba(16, 185, 129, 0.2)',
    border: '1px solid #10b981',
    padding: '4px 10px',
    borderRadius: 12,
    fontSize: 11,
    color: '#10b981',
    fontWeight: 700
  },
  content: {
    display: 'flex',
    flexDirection: 'column',
    gap: 16
  },
  section: {
    paddingBottom: 12,
    borderBottom: '1px solid rgba(47, 107, 87, 0.2)'
  },
  iconRow: {
    display: 'flex',
    gap: 12,
    alignItems: 'flex-start'
  },
  icon: {
    fontSize: 24,
    width: 32,
    textAlign: 'center',
    flexShrink: 0
  },
  infoBlock: {
    flex: 1
  },
  label: {
    fontSize: 11,
    color: '#789',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
    fontWeight: 600,
    marginBottom: 4
  },
  value: {
    fontSize: 16,
    color: '#e8efe8',
    fontWeight: 600,
    marginBottom: 4
  },
  timeRange: {
    fontSize: 18,
    color: '#10b981',
    fontWeight: 700
  },
  city: {
    fontSize: 14,
    color: '#9db',
    fontWeight: 500
  },
  properties: {
    display: 'flex',
    gap: 8,
    marginTop: 8,
    flexWrap: 'wrap'
  },
  tag: {
    background: 'rgba(16, 185, 129, 0.15)',
    border: '1px solid rgba(16, 185, 129, 0.3)',
    padding: '4px 10px',
    borderRadius: 8,
    fontSize: 12,
    color: '#10b981',
    fontWeight: 500
  },
  priceSection: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    background: 'rgba(16, 185, 129, 0.1)',
    border: '1px solid rgba(16, 185, 129, 0.2)',
    borderRadius: 10
  },
  priceLabel: {
    fontSize: 14,
    color: '#9db',
    fontWeight: 600
  },
  priceValue: {
    fontSize: 22,
    color: '#10b981',
    fontWeight: 700
  },
  invoiceSection: {
    display: 'flex',
    gap: 8,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 8,
    fontSize: 12,
    color: '#789'
  },
  invoiceLabel: {
    fontWeight: 500
  },
  invoiceNumber: {
    fontFamily: 'monospace',
    color: '#9db',
    fontWeight: 600
  },
  cancelSection: {
    marginTop: 20,
    paddingTop: 20,
    borderTop: '2px dashed rgba(255, 255, 255, 0.2)',
    display: 'flex',
    flexDirection: 'column',
    gap: 10
  },
  cancelBtn: {
    width: '100%',
    padding: '14px 24px',
    backgroundColor: '#dc3545',
    color: 'white',
    border: 'none',
    borderRadius: 8,
    fontSize: 16,
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'all 0.3s ease',
    boxShadow: '0 2px 8px rgba(220, 53, 69, 0.3)'
  },
  cancelBtnDisabled: {
    backgroundColor: '#999',
    cursor: 'not-allowed',
    opacity: 0.6,
    boxShadow: 'none'
  },
  cancelNote: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.7)',
    textAlign: 'center',
    fontStyle: 'italic'
  }
};
