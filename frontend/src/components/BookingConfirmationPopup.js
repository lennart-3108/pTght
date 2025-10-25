import React, { useState } from 'react';
import { API_BASE } from '../config';

/**
 * BookingConfirmationPopup - Confirm slot booking and process PayPal payment
 * 
 * @param {Object} slot - Selected slot details
 * @param {Object} match - Current match details
 * @param {Function} onClose - Close popup callback
 * @param {Function} onConfirm - Booking confirmed callback
 */
export default function BookingConfirmationPopup({ slot, match, onClose, onConfirm }) {
  const [processing, setProcessing] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState('paypal'); // 'paypal' or 'later'
  const [simulateMode, setSimulateMode] = useState(false);

  if (!slot) return null;

  async function handleSimulatePayPal() {
    setProcessing(true);
    
    try {
      // Simulate PayPal payment with fake data
      const fakeBooking = {
        id: Math.floor(Math.random() * 10000),
        match_id: match.id,
        slot_id: slot.id,
        location_name: slot.location_name,
        asset_name: slot.asset_name,
        booking_date: slot.date,
        start_time: slot.start_time,
        end_time: slot.end_time,
        base_price: slot.base_price,
        currency: slot.currency || 'EUR',
        invoice_number: `INV-SIM-${Date.now()}`,
        payment_status: 'paid',
        status: 'confirmed',
        paypal_transaction_id: `PAYPAL-${Date.now()}-SIMULATED`
      };

      // Simulate API delay
      await new Promise(resolve => setTimeout(resolve, 1500));

      // Show success message
      alert(`✅ PayPal-Zahlung simuliert!\n\n💳 Transaction ID: ${fakeBooking.paypal_transaction_id}\n📄 Rechnung: ${fakeBooking.invoice_number}\n💰 Betrag: ${fakeBooking.base_price} ${fakeBooking.currency}\n\n✓ Status: BEZAHLT`);

      // Call parent confirmation handler
      if (onConfirm) await onConfirm(fakeBooking);
      
      // Close popup
      onClose();

    } catch (error) {
      console.error('Simulation error:', error);
      alert('❌ Simulation fehlgeschlagen: ' + (error.message || 'Unbekannter Fehler'));
    } finally {
      setProcessing(false);
    }
  }

  async function handleBooking() {
    setProcessing(true);
    
    try {
      // Get auth token
      const token = localStorage.getItem('token');
      
      // Create booking via API
      const response = await fetch(`${API_BASE}/bookings`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        body: JSON.stringify({
          match_id: match.id,
          slot_id: slot.id,
          payment_method: paymentMethod === 'paypal' ? 'paypal' : 'cash',
          notes: `Match booking: ${match.sport_name || 'Sport'} in ${match.city || 'City'}`
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Booking failed');
      }

      // Success!
      if (paymentMethod === 'paypal') {
        // In real scenario: Redirect to PayPal with invoice
        // For now: Show confirmation
        alert(`✅ Buchung erfolgreich!\n\nRechnungsnummer: ${data.booking.invoice_number}\nBetrag: ${data.booking.base_price} ${data.booking.currency}\n\n(In Produktion würdest du jetzt zu PayPal weitergeleitet)`);
      } else {
        alert(`✅ Buchung erfolgreich!\n\nRechnungsnummer: ${data.booking.invoice_number}\nBitte bezahle ${data.booking.base_price} ${data.booking.currency} vor Ort.`);
      }

      // Call parent confirmation handler
      if (onConfirm) await onConfirm(data.booking);
      
      // Close popup
      onClose();

    } catch (error) {
      console.error('Booking error:', error);
      alert('❌ Buchung fehlgeschlagen: ' + (error.message || 'Unbekannter Fehler'));
    } finally {
      setProcessing(false);
    }
  }

  return (
    <div style={styles.overlay} onClick={onClose}>
      <div style={styles.popup} onClick={(e) => e.stopPropagation()}>
        <div style={styles.header}>
          <h2 style={styles.title}>Buchung bestätigen</h2>
          <button onClick={onClose} style={styles.closeBtn} disabled={processing}>✕</button>
        </div>

        <div style={styles.content}>
          {/* Slot Details */}
          <div style={styles.slotCard}>
            <div style={styles.slotLocation}>{slot.location_name}</div>
            <div style={styles.slotAsset}>🏟️ {slot.asset_name}</div>
            {slot.asset_type && (
              <div style={styles.slotDetail}>Typ: {slot.asset_type}</div>
            )}
            {slot.surface && (
              <div style={styles.slotDetail}>Oberfläche: {slot.surface}</div>
            )}
            <div style={styles.slotTime}>
              🕐 {slot.date} · {slot.start_time} - {slot.end_time} Uhr
            </div>
            {slot.address && (
              <div style={styles.slotAddress}>
                📍 {slot.address}, {slot.city}
              </div>
            )}
          </div>

          {/* Price */}
          <div style={styles.priceSection}>
            <div style={styles.priceLabel}>Gesamtpreis</div>
            <div style={styles.priceAmount}>
              {slot.base_price} {slot.currency || 'EUR'}
            </div>
          </div>

          {/* Payment Method Selection */}
          <div style={styles.paymentSection}>
            <div style={styles.paymentLabel}>Zahlungsart wählen</div>
            
            <div 
              style={{
                ...styles.paymentOption,
                ...(paymentMethod === 'paypal' ? styles.paymentOptionSelected : {})
              }}
              onClick={() => setPaymentMethod('paypal')}
            >
              <div style={styles.paymentOptionHeader}>
                <div style={styles.radio}>
                  {paymentMethod === 'paypal' && <div style={styles.radioInner} />}
                </div>
                <div style={styles.paymentOptionTitle}>
                  <span style={{ fontSize: 20, marginRight: 8 }}>💳</span>
                  Mit PayPal bezahlen
                </div>
              </div>
              <div style={styles.paymentOptionDesc}>
                Sichere Zahlung über PayPal
              </div>
            </div>

            <div 
              style={{
                ...styles.paymentOption,
                ...(paymentMethod === 'later' ? styles.paymentOptionSelected : {})
              }}
              onClick={() => setPaymentMethod('later')}
            >
              <div style={styles.paymentOptionHeader}>
                <div style={styles.radio}>
                  {paymentMethod === 'later' && <div style={styles.radioInner} />}
                </div>
                <div style={styles.paymentOptionTitle}>
                  <span style={{ fontSize: 20, marginRight: 8 }}>📝</span>
                  Später bezahlen
                </div>
              </div>
              <div style={styles.paymentOptionDesc}>
                Zahlung vor Ort beim Anbieter
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div style={styles.actions}>
            <button
              onClick={onClose}
              disabled={processing}
              style={styles.cancelBtn}
            >
              Abbrechen
            </button>
            <button
              onClick={handleBooking}
              disabled={processing}
              style={styles.confirmBtn}
            >
              {processing ? (
                <>⏳ Verarbeite...</>
              ) : paymentMethod === 'paypal' ? (
                <>💳 Jetzt mit PayPal bezahlen</>
              ) : (
                <>✓ Buchung bestätigen</>
              )}
            </button>
          </div>

          {/* Simulate PayPal Button */}
          <div style={styles.simulateSection}>
            <div style={styles.divider}>
              <span style={styles.dividerText}>Demo / Testing</span>
            </div>
            <button
              onClick={handleSimulatePayPal}
              disabled={processing}
              style={styles.simulateBtn}
            >
              {processing ? (
                <>⏳ Simuliere...</>
              ) : (
                <>🧪 PayPal-Zahlung simulieren</>
              )}
            </button>
            <div style={styles.simulateNote}>
              Erstellt eine Fake-Buchung ohne echte API-Calls
            </div>
          </div>

          {paymentMethod === 'paypal' && !simulateMode && (
            <div style={styles.notice}>
              Du wirst zu PayPal weitergeleitet, um die Zahlung abzuschließen.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

const styles = {
  overlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: 'rgba(0, 0, 0, 0.85)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2000,
    padding: 20,
    backdropFilter: 'blur(4px)'
  },
  popup: {
    background: '#0a1c17',
    borderRadius: 16,
    border: '2px solid #2f6b57',
    maxWidth: 540,
    width: '100%',
    maxHeight: '90vh',
    display: 'flex',
    flexDirection: 'column',
    boxShadow: '0 20px 60px rgba(0, 0, 0, 0.7)',
    overflow: 'hidden'
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '20px 24px',
    borderBottom: '1px solid #26493c',
    background: '#0f2a20'
  },
  title: {
    margin: 0,
    fontSize: 22,
    fontWeight: 600,
    color: '#e8efe8'
  },
  closeBtn: {
    padding: 8,
    border: 'none',
    background: 'transparent',
    color: '#9db',
    fontSize: 24,
    cursor: 'pointer',
    lineHeight: 1,
    transition: 'color 0.2s'
  },
  content: {
    padding: 24,
    overflowY: 'auto',
    flex: 1
  },
  slotCard: {
    background: '#1b4b3d',
    border: '1px solid #2f6b57',
    borderRadius: 12,
    padding: 20,
    marginBottom: 20
  },
  slotLocation: {
    fontSize: 20,
    fontWeight: 700,
    color: '#e8efe8',
    marginBottom: 8
  },
  slotAsset: {
    fontSize: 16,
    color: '#9db',
    marginBottom: 6
  },
  slotDetail: {
    fontSize: 14,
    color: '#789',
    marginBottom: 4
  },
  slotTime: {
    fontSize: 15,
    color: '#10b981',
    marginTop: 12,
    fontWeight: 600
  },
  slotAddress: {
    fontSize: 13,
    color: '#789',
    marginTop: 8
  },
  priceSection: {
    background: '#0f2a20',
    border: '1px solid #26493c',
    borderRadius: 10,
    padding: 16,
    marginBottom: 20,
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  priceLabel: {
    fontSize: 15,
    color: '#9db',
    fontWeight: 500
  },
  priceAmount: {
    fontSize: 28,
    fontWeight: 700,
    color: '#10b981'
  },
  paymentSection: {
    marginBottom: 20
  },
  paymentLabel: {
    fontSize: 15,
    color: '#9db',
    fontWeight: 500,
    marginBottom: 12
  },
  paymentOption: {
    background: '#0f2a20',
    border: '2px solid #26493c',
    borderRadius: 10,
    padding: 14,
    marginBottom: 10,
    cursor: 'pointer',
    transition: 'all 0.2s'
  },
  paymentOptionSelected: {
    background: '#1b4b3d',
    border: '2px solid #2f6b57'
  },
  paymentOptionHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    marginBottom: 6
  },
  radio: {
    width: 20,
    height: 20,
    borderRadius: '50%',
    border: '2px solid #2f6b57',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0
  },
  radioInner: {
    width: 10,
    height: 10,
    borderRadius: '50%',
    background: '#10b981'
  },
  paymentOptionTitle: {
    fontSize: 16,
    fontWeight: 600,
    color: '#e8efe8'
  },
  paymentOptionDesc: {
    fontSize: 13,
    color: '#789',
    marginLeft: 32
  },
  actions: {
    display: 'flex',
    gap: 12
  },
  cancelBtn: {
    flex: 1,
    padding: '12px 20px',
    borderRadius: 10,
    border: '1px solid #26493c',
    background: 'transparent',
    color: '#9db',
    fontSize: 15,
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'all 0.2s'
  },
  confirmBtn: {
    flex: 2,
    padding: '12px 20px',
    borderRadius: 10,
    border: 'none',
    background: '#10b981',
    color: '#fff',
    fontSize: 15,
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'all 0.2s'
  },
  simulateSection: {
    marginTop: 20,
    paddingTop: 20,
    borderTop: '1px dashed #26493c'
  },
  divider: {
    textAlign: 'center',
    marginBottom: 12
  },
  dividerText: {
    fontSize: 12,
    color: '#789',
    textTransform: 'uppercase',
    letterSpacing: '1px',
    fontWeight: 600
  },
  simulateBtn: {
    width: '100%',
    padding: '12px 20px',
    borderRadius: 10,
    border: '2px dashed #f59e0b',
    background: 'rgba(245, 158, 11, 0.1)',
    color: '#f59e0b',
    fontSize: 15,
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'all 0.2s'
  },
  simulateNote: {
    marginTop: 8,
    fontSize: 12,
    color: '#789',
    textAlign: 'center',
    fontStyle: 'italic'
  },
  notice: {
    marginTop: 16,
    padding: 12,
    background: '#0a2221',
    border: '1px solid #2f6b57',
    borderRadius: 8,
    fontSize: 13,
    color: '#9db',
    textAlign: 'center'
  }
};
