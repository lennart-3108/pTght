import React, { useState } from 'react';

const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:5001/api';

/**
 * SlotBookingConfirmationPopup - Confirmation dialog for slot booking
 * 
 * Features:
 * - Booking confirmation with cost breakdown
 * - Payment method selection
 * - Split cost option with user search
 */
export default function SlotBookingConfirmationPopup({ slot, onClose, onConfirm, token }) {
  const [paymentMethod, setPaymentMethod] = useState('wallet'); // wallet, paypal, credit_card
  const [splitCost, setSplitCost] = useState(false);
  const [splitUserEmail, setSplitUserEmail] = useState('');
  const [searchingUser, setSearchingUser] = useState(false);
  const [splitUser, setSplitUser] = useState(null);
  const [confirming, setConfirming] = useState(false);

  const price = parseFloat(slot.base_price || 0);
  const userShare = splitCost && splitUser ? price / 2 : price;

  async function searchUser() {
    if (!splitUserEmail.trim()) return;
    
    setSearchingUser(true);
    try {
      const res = await fetch(`${API_BASE}/users/search?email=${encodeURIComponent(splitUserEmail)}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (!res.ok) {
        throw new Error('Benutzer nicht gefunden');
      }
      
      const data = await res.json();
      setSplitUser(data.user);
    } catch (e) {
      alert(`Fehler: ${e.message}`);
      setSplitUser(null);
    } finally {
      setSearchingUser(false);
    }
  }

  async function handleConfirm() {
    setConfirming(true);
    try {
      await onConfirm({
        paymentMethod,
        splitCost,
        splitUserId: splitUser?.id || null
      });
    } catch (e) {
      alert(`Fehler: ${e.message}`);
    } finally {
      setConfirming(false);
    }
  }

  const slotStart = new Date(slot.start_time);
  const slotEnd = new Date(new Date(slot.start_time).getTime() + (slot.duration_minutes || 60) * 60000);

  return (
    <div style={styles.overlay} onClick={onClose}>
      <div style={styles.popup} onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div style={styles.header}>
          <h2 style={styles.title}>Buchung bestätigen</h2>
          <button onClick={onClose} style={styles.closeBtn} disabled={confirming}>✕</button>
        </div>

        {/* Content */}
        <div style={styles.content}>
          {/* Slot Details */}
          <div style={styles.section}>
            <h3 style={styles.sectionTitle}>📍 Platzdetails</h3>
            <div style={styles.detailRow}>
              <span style={styles.label}>Standort:</span>
              <span style={styles.value}>{slot.location_name || 'Unbekannt'}</span>
            </div>
            <div style={styles.detailRow}>
              <span style={styles.label}>Platz:</span>
              <span style={styles.value}>{slot.asset_name || `Platz ${slot.asset_id}`}</span>
            </div>
            {slot.surface && (
              <div style={styles.detailRow}>
                <span style={styles.label}>Belag:</span>
                <span style={styles.value}>{slot.surface}</span>
              </div>
            )}
            <div style={styles.detailRow}>
              <span style={styles.label}>Datum:</span>
              <span style={styles.value}>
                {slotStart.toLocaleDateString('de-DE', { 
                  weekday: 'short', 
                  day: '2-digit', 
                  month: '2-digit',
                  year: 'numeric'
                })}
              </span>
            </div>
            <div style={styles.detailRow}>
              <span style={styles.label}>Uhrzeit:</span>
              <span style={styles.value}>
                {slotStart.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}
                {' - '}
                {slotEnd.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })} Uhr
              </span>
            </div>
            <div style={styles.detailRow}>
              <span style={styles.label}>Dauer:</span>
              <span style={styles.value}>{slot.duration_minutes || 60} Minuten</span>
            </div>
          </div>

          {/* Cost Breakdown */}
          <div style={styles.section}>
            <h3 style={styles.sectionTitle}>💰 Kostenaufstellung</h3>
            <div style={styles.costRow}>
              <span>Platzmiete</span>
              <span style={styles.costValue}>€{price.toFixed(2)}</span>
            </div>
            {splitCost && splitUser && (
              <>
                <div style={styles.divider}></div>
                <div style={styles.costRow}>
                  <span style={{ fontSize: 13, color: '#9db' }}>
                    Geteilt mit {splitUser.name || splitUser.email}
                  </span>
                  <span style={{ fontSize: 13, color: '#9db' }}>€{(price / 2).toFixed(2)}</span>
                </div>
                <div style={styles.costRow}>
                  <span style={{ fontWeight: 700 }}>Dein Anteil</span>
                  <span style={{ ...styles.costValue, color: '#debc7c' }}>€{userShare.toFixed(2)}</span>
                </div>
              </>
            )}
            {!splitCost && (
              <>
                <div style={styles.divider}></div>
                <div style={styles.costRow}>
                  <span style={{ fontWeight: 700 }}>Gesamt</span>
                  <span style={styles.costValue}>€{price.toFixed(2)}</span>
                </div>
              </>
            )}
          </div>

          {/* Split Cost Option */}
          <div style={styles.section}>
            <label style={styles.checkboxLabel}>
              <input
                type="checkbox"
                checked={splitCost}
                onChange={(e) => {
                  setSplitCost(e.target.checked);
                  if (!e.target.checked) {
                    setSplitUser(null);
                    setSplitUserEmail('');
                  }
                }}
                style={styles.checkbox}
              />
              <span style={{ marginLeft: 8 }}>💸 Kosten teilen (50/50)</span>
            </label>

            {splitCost && (
              <div style={{ marginTop: 12 }}>
                <label style={styles.inputLabel}>E-Mail des Mitspielers</label>
                <div style={{ display: 'flex', gap: 8 }}>
                  <input
                    type="email"
                    value={splitUserEmail}
                    onChange={(e) => setSplitUserEmail(e.target.value)}
                    placeholder="spieler@example.com"
                    style={styles.input}
                    onKeyPress={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        searchUser();
                      }
                    }}
                  />
                  <button
                    onClick={searchUser}
                    disabled={searchingUser || !splitUserEmail.trim()}
                    style={styles.searchBtn}
                  >
                    {searchingUser ? '...' : '🔍'}
                  </button>
                </div>
                {splitUser && (
                  <div style={styles.userFound}>
                    ✓ Benutzer gefunden: {splitUser.name || splitUser.email}
                  </div>
                )}
                {splitCost && !splitUser && (
                  <div style={{ fontSize: 12, color: '#9db', marginTop: 6 }}>
                    Der Mitspieler erhält eine Zahlungsanforderung über €{(price / 2).toFixed(2)}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Payment Method */}
          <div style={styles.section}>
            <h3 style={styles.sectionTitle}>💳 Zahlungsart</h3>
            <div style={styles.paymentOptions}>
              <label style={{
                ...styles.paymentOption,
                ...(paymentMethod === 'wallet' ? styles.paymentOptionSelected : {})
              }}>
                <input
                  type="radio"
                  name="payment"
                  value="wallet"
                  checked={paymentMethod === 'wallet'}
                  onChange={(e) => setPaymentMethod(e.target.value)}
                  style={styles.radio}
                />
                <span style={styles.paymentLabel}>
                  <span style={{ fontSize: 18 }}>👛</span>
                  <span>Guthaben</span>
                </span>
              </label>
              <label style={{
                ...styles.paymentOption,
                ...(paymentMethod === 'paypal' ? styles.paymentOptionSelected : {})
              }}>
                <input
                  type="radio"
                  name="payment"
                  value="paypal"
                  checked={paymentMethod === 'paypal'}
                  onChange={(e) => setPaymentMethod(e.target.value)}
                  style={styles.radio}
                />
                <span style={styles.paymentLabel}>
                  <span style={{ fontSize: 18 }}>💙</span>
                  <span>PayPal</span>
                </span>
              </label>
              <label style={{
                ...styles.paymentOption,
                ...(paymentMethod === 'credit_card' ? styles.paymentOptionSelected : {})
              }}>
                <input
                  type="radio"
                  name="payment"
                  value="credit_card"
                  checked={paymentMethod === 'credit_card'}
                  onChange={(e) => setPaymentMethod(e.target.value)}
                  style={styles.radio}
                />
                <span style={styles.paymentLabel}>
                  <span style={{ fontSize: 18 }}>💳</span>
                  <span>Kreditkarte</span>
                </span>
              </label>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div style={styles.actions}>
          <button onClick={onClose} style={styles.cancelBtn} disabled={confirming}>
            Abbrechen
          </button>
          <button
            onClick={handleConfirm}
            disabled={confirming || (splitCost && !splitUser)}
            style={{
              ...styles.confirmBtn,
              opacity: confirming || (splitCost && !splitUser) ? 0.5 : 1,
              cursor: confirming || (splitCost && !splitUser) ? 'not-allowed' : 'pointer'
            }}
          >
            {confirming ? 'Buche...' : `Jetzt buchen für €${userShare.toFixed(2)}`}
          </button>
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
    zIndex: 1000,
    padding: 16
  },
  popup: {
    background: '#0f2b27',
    border: '2px solid #2f6b57',
    borderRadius: 16,
    maxWidth: 600,
    width: '100%',
    maxHeight: '90vh',
    overflow: 'auto',
    boxShadow: '0 20px 60px rgba(0, 0, 0, 0.5)'
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '20px 24px',
    borderBottom: '1px solid #2f6b57'
  },
  title: {
    margin: 0,
    color: '#7fc',
    fontSize: 24,
    fontWeight: 700
  },
  closeBtn: {
    background: 'none',
    border: 'none',
    color: '#9db',
    fontSize: 28,
    cursor: 'pointer',
    padding: 0,
    width: 32,
    height: 32,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 6,
    transition: 'all 0.2s'
  },
  content: {
    padding: 24
  },
  section: {
    marginBottom: 24
  },
  sectionTitle: {
    margin: '0 0 12px 0',
    color: '#debc7c',
    fontSize: 16,
    fontWeight: 700
  },
  detailRow: {
    display: 'flex',
    justifyContent: 'space-between',
    padding: '8px 0',
    borderBottom: '1px solid rgba(47, 107, 87, 0.3)'
  },
  label: {
    color: '#9db',
    fontSize: 14
  },
  value: {
    color: '#e8efe8',
    fontSize: 14,
    fontWeight: 600
  },
  costRow: {
    display: 'flex',
    justifyContent: 'space-between',
    padding: '10px 0',
    color: '#e8efe8',
    fontSize: 15
  },
  costValue: {
    fontWeight: 700,
    color: '#7fc',
    fontSize: 16
  },
  divider: {
    height: 1,
    background: '#2f6b57',
    margin: '8px 0'
  },
  checkboxLabel: {
    display: 'flex',
    alignItems: 'center',
    color: '#e8efe8',
    fontSize: 15,
    fontWeight: 600,
    cursor: 'pointer'
  },
  checkbox: {
    width: 18,
    height: 18,
    cursor: 'pointer',
    accentColor: '#7fc'
  },
  inputLabel: {
    display: 'block',
    color: '#9db',
    fontSize: 13,
    marginBottom: 6
  },
  input: {
    flex: 1,
    padding: '10px 12px',
    background: '#081c19',
    border: '1px solid #2f6b57',
    borderRadius: 8,
    color: '#e8efe8',
    fontSize: 14,
    outline: 'none'
  },
  searchBtn: {
    padding: '10px 16px',
    background: '#2f6b57',
    border: 'none',
    borderRadius: 8,
    color: '#e8efe8',
    fontSize: 18,
    cursor: 'pointer',
    transition: 'background 0.2s'
  },
  userFound: {
    marginTop: 8,
    padding: 8,
    background: 'rgba(127, 252, 204, 0.1)',
    border: '1px solid #7fc',
    borderRadius: 6,
    color: '#7fc',
    fontSize: 13,
    fontWeight: 600
  },
  paymentOptions: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
    gap: 12
  },
  paymentOption: {
    display: 'flex',
    alignItems: 'center',
    padding: 12,
    background: '#081c19',
    border: '2px solid #2f6b57',
    borderRadius: 10,
    cursor: 'pointer',
    transition: 'all 0.2s'
  },
  paymentOptionSelected: {
    background: '#1b4b3d',
    border: '2px solid #7fc'
  },
  radio: {
    cursor: 'pointer',
    accentColor: '#7fc'
  },
  paymentLabel: {
    marginLeft: 10,
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    color: '#e8efe8',
    fontSize: 14,
    fontWeight: 600
  },
  actions: {
    display: 'flex',
    gap: 12,
    padding: 24,
    borderTop: '1px solid #2f6b57'
  },
  cancelBtn: {
    flex: 1,
    padding: '12px 24px',
    background: 'transparent',
    border: '2px solid #2f6b57',
    borderRadius: 10,
    color: '#9db',
    fontSize: 15,
    fontWeight: 700,
    cursor: 'pointer',
    transition: 'all 0.2s'
  },
  confirmBtn: {
    flex: 2,
    padding: '12px 24px',
    background: '#7fc',
    border: 'none',
    borderRadius: 10,
    color: '#081c19',
    fontSize: 15,
    fontWeight: 700,
    cursor: 'pointer',
    transition: 'all 0.2s'
  }
};
