import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { API_BASE } from '../config';

/**
 * MyBookingsPage - View and manage user's bookings
 */
export default function MyBookingsPage() {
  const navigate = useNavigate();
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('all'); // 'all', 'upcoming', 'past', 'cancelled'
  
  const token = localStorage.getItem('token');

  useEffect(() => {
    if (!token) {
      navigate('/login');
      return;
    }
    loadBookings();
  }, [token, navigate]);

  async function loadBookings() {
    try {
      setLoading(true);
      setError('');
      
      const res = await fetch(`${API_BASE}/bookings`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (!res.ok) {
        if (res.status === 401) {
          navigate('/login');
          return;
        }
        throw new Error(`HTTP ${res.status}`);
      }
      
      const data = await res.json();
      setBookings(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err.message || 'Fehler beim Laden der Buchungen');
    } finally {
      setLoading(false);
    }
  }

  async function cancelBooking(bookingId, reason) {
    if (!window.confirm('Buchung wirklich stornieren?')) return;
    
    try {
      setError('');
      
      const res = await fetch(`${API_BASE}/bookings/${bookingId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          status: 'cancelled',
          cancellation_reason: reason || 'User cancellation'
        })
      });
      
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      
      // Reload bookings
      await loadBookings();
      alert('Buchung wurde storniert');
    } catch (err) {
      setError(err.message || 'Fehler beim Stornieren');
    }
  }

  // Filter bookings
  const now = new Date();
  const filteredBookings = bookings.filter(booking => {
    const startTime = new Date(booking.start_time);
    
    if (filter === 'upcoming') {
      return startTime >= now && !['cancelled', 'rejected'].includes(booking.status);
    } else if (filter === 'past') {
      return startTime < now || booking.status === 'completed';
    } else if (filter === 'cancelled') {
      return ['cancelled', 'rejected'].includes(booking.status);
    }
    return true; // 'all'
  });

  // Group by upcoming/past
  const upcomingBookings = filteredBookings.filter(b => new Date(b.start_time) >= now && !['cancelled', 'rejected', 'completed'].includes(b.status));
  const pastBookings = filteredBookings.filter(b => new Date(b.start_time) < now || ['completed', 'cancelled', 'rejected'].includes(b.status));

  if (loading) {
    return (
      <div style={styles.container}>
        <div style={styles.loading}>Lade Buchungen...</div>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h1 style={styles.title}>Meine Buchungen</h1>
        <button
          onClick={() => navigate('/booking')}
          style={styles.newBookingBtn}
        >
          + Neue Buchung
        </button>
      </div>

      {error && (
        <div style={styles.error}>
          {error}
          <button onClick={() => setError('')} style={styles.errorClose}>✕</button>
        </div>
      )}

      {/* Filter Tabs */}
      <div style={styles.filters}>
        <button
          onClick={() => setFilter('all')}
          style={{...styles.filterBtn, ...(filter === 'all' ? styles.filterBtnActive : {})}}
        >
          Alle ({bookings.length})
        </button>
        <button
          onClick={() => setFilter('upcoming')}
          style={{...styles.filterBtn, ...(filter === 'upcoming' ? styles.filterBtnActive : {})}}
        >
          Anstehend ({upcomingBookings.length})
        </button>
        <button
          onClick={() => setFilter('past')}
          style={{...styles.filterBtn, ...(filter === 'past' ? styles.filterBtnActive : {})}}
        >
          Vergangen ({pastBookings.length})
        </button>
        <button
          onClick={() => setFilter('cancelled')}
          style={{...styles.filterBtn, ...(filter === 'cancelled' ? styles.filterBtnActive : {})}}
        >
          Storniert
        </button>
      </div>

      {/* Bookings List */}
      {filteredBookings.length === 0 ? (
        <div style={styles.emptyState}>
          <p style={{color: '#9ca3af'}}>Keine Buchungen gefunden.</p>
          <button
            onClick={() => navigate('/booking')}
            style={styles.bookNowBtn}
          >
            Jetzt einen Platz buchen
          </button>
        </div>
      ) : (
        <div style={styles.bookingsList}>
          {filteredBookings.map(booking => (
            <BookingCard
              key={booking.id}
              booking={booking}
              onCancel={(reason) => cancelBooking(booking.id, reason)}
              onViewDetails={() => navigate(`/bookings/${booking.id}`)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function BookingCard({ booking, onCancel, onViewDetails }) {
  const startTime = new Date(booking.start_time);
  const endTime = new Date(booking.end_time);
  const now = new Date();
  const isUpcoming = startTime >= now && !['cancelled', 'rejected', 'completed'].includes(booking.status);
  const isPast = startTime < now || booking.status === 'completed';
  const isCancelled = ['cancelled', 'rejected'].includes(booking.status);
  
  // Status display
  const statusMap = {
    held: { label: 'Reserviert', color: '#16a34a', icon: '⏳' },
    confirmed: { label: 'Bestätigt', color: '#22c55e', icon: '✓' },
    paid: { label: 'Bezahlt', color: '#4CAF50', icon: '✓' },
    completed: { label: 'Abgeschlossen', color: '#86efac', icon: '✓' },
    cancelled: { label: 'Storniert', color: '#dc2626', icon: '✕' },
    rejected: { label: 'Abgelehnt', color: '#dc2626', icon: '✕' },
    'no-show': { label: 'Nicht erschienen', color: '#ea580c', icon: '⚠' },
    refunded: { label: 'Rückerstattet', color: '#9ca3af', icon: '↩' }
  };
  
  const statusInfo = statusMap[booking.status] || { label: booking.status, color: '#999', icon: '•' };
  
  return (
    <div style={{
      ...styles.bookingCard,
      ...(isCancelled ? styles.bookingCardCancelled : {}),
      ...(isPast && !isCancelled ? styles.bookingCardPast : {})
    }}>
      {/* Header with status */}
      <div style={styles.cardHeader}>
        <div>
          <h3 style={styles.cardTitle}>{booking.location_name}</h3>
          <div style={styles.cardSubtitle}>{booking.asset_name}</div>
        </div>
        <div style={{...styles.statusBadge, background: statusInfo.color}}>
          {statusInfo.icon} {statusInfo.label}
        </div>
      </div>

      {/* Date & Time */}
      <div style={styles.cardContent}>
        <div style={styles.infoRow}>
          <span style={styles.infoLabel}>📅 Datum:</span>
          <span style={styles.infoValue}>
            {startTime.toLocaleDateString('de-DE', {
              weekday: 'long',
              year: 'numeric',
              month: 'long',
              day: 'numeric'
            })}
          </span>
        </div>
        
        <div style={styles.infoRow}>
          <span style={styles.infoLabel}>🕐 Zeit:</span>
          <span style={styles.infoValue}>
            {startTime.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}
            {' - '}
            {endTime.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}
            <span style={{marginLeft: 8, color: '#999', fontSize: 13}}>
              ({booking.duration_minutes} Min.)
            </span>
          </span>
        </div>
        
        <div style={styles.infoRow}>
          <span style={styles.infoLabel}>💰 Preis:</span>
          <span style={styles.infoValue}>
            {booking.price} {booking.currency || 'EUR'}
          </span>
        </div>
        
        {booking.user_notes && (
          <div style={styles.notes}>
            <span style={styles.infoLabel}>📝 Notiz:</span>
            <p style={styles.notesText}>{booking.user_notes}</p>
          </div>
        )}
        
        {booking.cancelled_at && booking.cancellation_reason && (
          <div style={styles.cancellationInfo}>
            <strong>Stornierungsgrund:</strong> {booking.cancellation_reason}
          </div>
        )}
      </div>

      {/* Actions */}
      <div style={styles.cardActions}>
        <button
          onClick={onViewDetails}
          style={styles.detailsBtn}
        >
          Details
        </button>
        
        {isUpcoming && booking.status !== 'cancelled' && (
          <button
            onClick={() => {
              const reason = prompt('Stornierungsgrund (optional):');
              if (reason !== null) {
                onCancel(reason);
              }
            }}
            style={styles.cancelBtn}
          >
            Stornieren
          </button>
        )}
        
        {isUpcoming && booking.status === 'held' && (
          <button
            onClick={() => alert('Zahlung wird implementiert')}
            style={styles.payBtn}
          >
            💳 Jetzt bezahlen
          </button>
        )}
      </div>
    </div>
  );
}

// Styles
const styles = {
  container: {
    maxWidth: 1000,
    margin: '0 auto',
    padding: 20,
    minHeight: '100vh',
    background: '#081c19'
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 30
  },
  title: {
    margin: 0,
    fontSize: 28,
    fontWeight: 600,
    color: '#e5e7eb'
  },
  newBookingBtn: {
    padding: '12px 24px',
    border: 'none',
    borderRadius: 8,
    background: '#0a2221',
    color: '#fff',
    fontSize: 14,
    fontWeight: 600,
    cursor: 'pointer',
    boxShadow: '0 2px 8px rgba(10, 34, 33, 0.3)'
  },
  filters: {
    display: 'flex',
    gap: 12,
    marginBottom: 24,
    borderBottom: '2px solid #374151',
    paddingBottom: 8
  },
  filterBtn: {
    padding: '8px 16px',
    border: 'none',
    background: 'transparent',
    cursor: 'pointer',
    fontSize: 14,
    fontWeight: 500,
    color: '#9ca3af',
    borderBottom: '2px solid transparent',
    marginBottom: -10,
    transition: 'all 0.2s'
  },
  filterBtnActive: {
    color: '#4CAF50',
    borderBottomColor: '#4CAF50',
    fontWeight: 600
  },
  bookingsList: {
    display: 'flex',
    flexDirection: 'column',
    gap: 16
  },
  bookingCard: {
    background: '#111827',
    borderRadius: 12,
    border: '1px solid #374151',
    padding: 20,
    boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
    transition: 'all 0.3s'
  },
  bookingCardPast: {
    opacity: 0.7
  },
  bookingCardCancelled: {
    opacity: 0.6,
    background: '#1f2937'
  },
  cardHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
    paddingBottom: 12,
    borderBottom: '1px solid #374151'
  },
  cardTitle: {
    margin: '0 0 4px 0',
    fontSize: 18,
    fontWeight: 600,
    color: '#e5e7eb'
  },
  cardSubtitle: {
    fontSize: 14,
    color: '#9ca3af'
  },
  statusBadge: {
    padding: '6px 12px',
    borderRadius: 6,
    color: '#fff',
    fontSize: 13,
    fontWeight: 600,
    whiteSpace: 'nowrap'
  },
  cardContent: {
    marginBottom: 16
  },
  infoRow: {
    display: 'flex',
    justifyContent: 'space-between',
    padding: '8px 0',
    fontSize: 14,
    color: '#e5e7eb'
  },
  infoLabel: {
    color: '#9ca3af',
    fontWeight: 500
  },
  infoValue: {
    fontWeight: 600,
    textAlign: 'right',
    color: '#e5e7eb'
  },
  notes: {
    marginTop: 12,
    padding: 12,
    background: '#1f2937',
    borderRadius: 8
  },
  notesText: {
    margin: '4px 0 0 0',
    fontSize: 14,
    lineHeight: 1.5,
    color: '#d1d5db'
  },
  cancellationInfo: {
    marginTop: 12,
    padding: 12,
    background: '#7f1d1d',
    borderRadius: 8,
    fontSize: 13,
    color: '#fecaca'
  },
  cardActions: {
    display: 'flex',
    gap: 8,
    justifyContent: 'flex-end'
  },
  detailsBtn: {
    padding: '8px 16px',
    border: '1px solid #374151',
    borderRadius: 6,
    background: '#111827',
    color: '#e5e7eb',
    fontSize: 14,
    fontWeight: 500,
    cursor: 'pointer'
  },
  cancelBtn: {
    padding: '8px 16px',
    border: 'none',
    borderRadius: 6,
    background: '#991b1b',
    color: '#fff',
    fontSize: 14,
    fontWeight: 500,
    cursor: 'pointer'
  },
  payBtn: {
    padding: '8px 16px',
    border: 'none',
    borderRadius: 6,
    background: '#0a2221',
    color: '#fff',
    fontSize: 14,
    fontWeight: 600,
    cursor: 'pointer'
  },
  emptyState: {
    textAlign: 'center',
    padding: 60,
    background: '#111827',
    borderRadius: 12,
    border: '1px solid #374151'
  },
  bookNowBtn: {
    marginTop: 20,
    padding: '12px 24px',
    border: 'none',
    borderRadius: 8,
    background: '#0a2221',
    color: '#fff',
    fontSize: 14,
    fontWeight: 600,
    cursor: 'pointer'
  },
  loading: {
    textAlign: 'center',
    padding: 40,
    fontSize: 16,
    color: '#9ca3af'
  },
  error: {
    position: 'relative',
    marginBottom: 20,
    padding: 16,
    background: '#ffebee',
    color: '#c62828',
    borderRadius: 8,
    border: '1px solid #ef5350'
  },
  errorClose: {
    position: 'absolute',
    top: 12,
    right: 12,
    border: 'none',
    background: 'transparent',
    fontSize: 18,
    cursor: 'pointer',
    color: '#c62828'
  }
};
