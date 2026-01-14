import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { API_BASE } from '../config';
import './SubscriptionsPage.css';

export default function SubscriptionsPage() {
  const navigate = useNavigate();
  const token = localStorage.getItem('token');
  const [roles, setRoles] = useState([]);
  const [licensePlans, setLicensePlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [bookingPlan, setBookingPlan] = useState(null);
  const [showPayPalModal, setShowPayPalModal] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const handleBuyPlan = (plan) => {
    if (!token) {
      navigate('/login');
      return;
    }
    setSelectedPlan(plan);
    setShowPayPalModal(true);
  };

  const handlePayPalConfirm = async () => {
    if (!selectedPlan) return;

    setIsProcessing(true);

    try {
      // Simuliere PayPal-Zahlung
      const response = await fetch(`${API_BASE}/roles/purchase`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          license_plan_id: selectedPlan.id,
          payment_method: 'paypal_simulated',
          amount: selectedPlan.price
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Buchung fehlgeschlagen');
      }

      const result = await response.json();

      // Erfolg - Modal schließen und Bestätigung anzeigen
      setShowPayPalModal(false);
      setSelectedPlan(null);
      
      alert(`✓ Zahlung erfolgreich!\n\nLizenz "${result.message}" wurde aktiviert.\n\nEine Bestätigung wurde an deine E-Mail gesendet.`);
      
      // Reload page to show new role
      setTimeout(() => window.location.reload(), 2000);

    } catch (err) {
      console.error('Error purchasing license:', err);
      alert('Fehler beim Buchen der Lizenz: ' + err.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const handlePayPalCancel = () => {
    setShowPayPalModal(false);
    setSelectedPlan(null);
    setIsProcessing(false);
  };

  useEffect(() => {
    async function fetchData() {
      try {
        setLoading(true);
        const [rolesRes, plansRes] = await Promise.all([
          fetch(`${API_BASE}/roles`),
          fetch(`${API_BASE}/roles/license-plans`)
        ]);

        if (!rolesRes.ok || !plansRes.ok) {
          throw new Error('Fehler beim Laden der Daten');
        }

        const rolesData = await rolesRes.json();
        const plansData = await plansRes.json();

        setRoles(rolesData);
        setLicensePlans(plansData);
      } catch (err) {
        console.error('Error loading subscriptions:', err);
        setError('Fehler beim Laden der Abos');
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, []);

  const getRoleIcon = (roleName) => {
    const icons = {
      free_user: '👤',
      team_captain: '⚽',
      trainer: '🎓',
      club_admin: '🏛️',
      location_provider: '🏟️',
      league_organizer: '🏆'
    };
    return icons[roleName] || '📋';
  };

  const getBillingPeriodLabel = (period) => {
    const labels = {
      monthly: 'Monatlich',
      seasonal: 'Saisonal',
      annual: 'Jährlich',
      per_event: 'Pro Event'
    };
    return labels[period] || period;
  };

  const groupedPlans = licensePlans.reduce((acc, plan) => {
    if (!acc[plan.role_name]) {
      acc[plan.role_name] = [];
    }
    acc[plan.role_name].push(plan);
    return acc;
  }, {});

  if (loading) {
    return (
      <div className="subscriptions-page">
        <div className="subscriptions-container">
          <div style={{ textAlign: 'center', padding: '40px', color: '#9ca3af' }}>
            Lädt...
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="subscriptions-page">
        <div className="subscriptions-container">
          <div style={{ textAlign: 'center', padding: '40px', color: '#ef4444' }}>
            {error}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="subscriptions-page">
      <div className="subscriptions-container">
        <div className="subscriptions-header">
          <h1>Rollen & Lizenzen</h1>
          <p className="subscriptions-subtitle">
            Finde die passende Lizenz für deine Bedürfnisse
          </p>
        </div>

        <div className="roles-section">
          <h2>Verfügbare Rollen</h2>
          <div className="roles-grid">
            {roles.map(role => {
              const plans = groupedPlans[role.name] || [];
              const requiresLicense = role.requires_license || plans.length > 0;
              
              return (
                <div key={role.id} className="role-card">
                  <div className="role-card-header">
                    <span className="role-icon">{getRoleIcon(role.name)}</span>
                    <h3>{role.display_name}</h3>
                  </div>
                  <p className="role-description">{role.description}</p>
                  <div className="role-license-status">
                    {requiresLicense ? (
                      <span className="license-required">Lizenz erforderlich</span>
                    ) : (
                      <span className="license-free">Kostenlos</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {Object.keys(groupedPlans).length > 0 && (
          <div className="plans-section">
            <h2>Lizenzpläne</h2>
            
            {Object.entries(groupedPlans).map(([roleName, plans]) => {
              const role = roles.find(r => r.name === roleName);
              if (!role) return null;

              return (
                <div key={roleName} className="role-plans-group">
                  <h3 className="role-plans-title">
                    <span className="role-icon">{getRoleIcon(roleName)}</span>
                    {role.display_name}
                  </h3>
                  
                  <div className="plans-grid">
                    {plans.map(plan => (
                      <div key={plan.id} className="plan-card">
                        <div className="plan-header">
                          <h4>{plan.name}</h4>
                          <div className="plan-price">
                            <span className="price-amount">€{plan.price}</span>
                            <span className="price-period">
                              /{getBillingPeriodLabel(plan.billing_period)}
                            </span>
                          </div>
                        </div>

                        {plan.description && (
                          <p className="plan-description">{plan.description}</p>
                        )}

                        {plan.features && plan.features.length > 0 && (
                          <div className="plan-features">
                            <h5>Funktionen:</h5>
                            <ul>
                              {plan.features.map((feature, idx) => (
                                <li key={idx}>✓ {feature}</li>
                              ))}
                            </ul>
                          </div>
                        )}

                        {plan.limits && Object.keys(plan.limits).length > 0 && (
                          <div className="plan-limits">
                            <h5>Limits:</h5>
                            <ul>
                              {Object.entries(plan.limits).map(([key, value]) => (
                                <li key={key}>
                                  {key.replace(/_/g, ' ')}: {value}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}

                        {plan.duration_days && (
                          <div className="plan-duration">
                            Laufzeit: {plan.duration_days} Tage
                          </div>
                        )}

                        {token && (
                          <button
                            className="plan-buy-button"
                            onClick={() => handleBuyPlan(plan)}
                            disabled={bookingPlan === plan.id}
                          >
                            {bookingPlan === plan.id ? 'Wird gebucht...' : 'Jetzt buchen'}
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <div className="subscriptions-footer">
          <p>
            Für weitere Informationen oder individuelle Angebote kontaktiere uns bitte.
          </p>
        </div>
      </div>

      {/* PayPal Simulations-Modal */}
      {showPayPalModal && selectedPlan && (
        <div className="paypal-modal-overlay" onClick={handlePayPalCancel}>
          <div className="paypal-modal" onClick={(e) => e.stopPropagation()}>
            <div className="paypal-header">
              <img 
                src="https://www.paypalobjects.com/webstatic/mktg/logo/pp_cc_mark_111x69.jpg" 
                alt="PayPal" 
                className="paypal-logo"
              />
            </div>

            <div className="paypal-content">
              <h3>Zahlung bestätigen</h3>
              
              <div className="payment-details">
                <div className="detail-row">
                  <span className="detail-label">Artikel:</span>
                  <span className="detail-value">{selectedPlan.name}</span>
                </div>
                <div className="detail-row">
                  <span className="detail-label">Rolle:</span>
                  <span className="detail-value">{selectedPlan.role_display_name}</span>
                </div>
                <div className="detail-row">
                  <span className="detail-label">Zeitraum:</span>
                  <span className="detail-value">{getBillingPeriodLabel(selectedPlan.billing_period)}</span>
                </div>
                <div className="detail-row total">
                  <span className="detail-label">Gesamtbetrag:</span>
                  <span className="detail-value">€{selectedPlan.price}</span>
                </div>
              </div>

              <p className="paypal-notice">
                <strong>Simulation:</strong> Dies ist eine simulierte PayPal-Zahlung. 
                Keine echte Abbuchung wird durchgeführt.
              </p>

              <div className="paypal-actions">
                <button 
                  className="paypal-cancel-btn"
                  onClick={handlePayPalCancel}
                  disabled={isProcessing}
                >
                  Abbrechen
                </button>
                <button 
                  className="paypal-confirm-btn"
                  onClick={handlePayPalConfirm}
                  disabled={isProcessing}
                >
                  {isProcessing ? 'Wird verarbeitet...' : 'Jetzt bezahlen'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
