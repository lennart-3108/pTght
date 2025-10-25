import React, { useState, useEffect } from 'react';
import { API_BASE } from '../config';

export default function BookingReportingPage() {
  const [overviewStats, setOverviewStats] = useState(null);
  const [locationStats, setLocationStats] = useState([]);
  const [assetStats, setAssetStats] = useState([]);
  const [utilization, setUtilization] = useState(null);
  const [monthlyStats, setMonthlyStats] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedLocation, setSelectedLocation] = useState('');
  const [locations, setLocations] = useState([]);
  const [dateRange, setDateRange] = useState({
    startDate: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0]
  });

  // Fetch locations for filter
  useEffect(() => {
    fetch(`${API_BASE}/locations`)
      .then(r => r.json())
      .then(data => setLocations(data))
      .catch(err => console.error('Failed to load locations:', err));
  }, []);

  // Fetch all statistics
  useEffect(() => {
    setLoading(true);
    const queryParams = new URLSearchParams({
      ...(selectedLocation && { locationId: selectedLocation }),
      ...(dateRange.startDate && { startDate: dateRange.startDate }),
      ...(dateRange.endDate && { endDate: dateRange.endDate })
    }).toString();

    Promise.all([
      fetch(`${API_BASE}/booking-stats/overview?${queryParams}`).then(r => r.json()),
      fetch(`${API_BASE}/booking-stats/by-location?${queryParams}`).then(r => r.json()),
      fetch(`${API_BASE}/booking-stats/by-asset?${queryParams}`).then(r => r.json()),
      fetch(`${API_BASE}/booking-stats/utilization?${queryParams}`).then(r => r.json()),
      fetch(`${API_BASE}/booking-stats/monthly?${queryParams}`).then(r => r.json())
    ])
      .then(([overview, byLocation, byAsset, util, monthly]) => {
        setOverviewStats(overview);
        setLocationStats(byLocation);
        setAssetStats(byAsset);
        setUtilization(util);
        setMonthlyStats(monthly);
      })
      .catch(err => console.error('Failed to load statistics:', err))
      .finally(() => setLoading(false));
  }, [selectedLocation, dateRange]);

  if (loading) {
    return (
      <div style={styles.container}>
        <div style={styles.loading}>Lade Statistiken...</div>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h1 style={styles.title}>📊 Buchungsstatistiken</h1>
        <p style={styles.subtitle}>Auslastung und Umsatz Ihrer Locations</p>
      </div>

      {/* Filters */}
      <div style={styles.filters}>
        <div style={styles.filterGroup}>
          <label style={styles.label}>Location</label>
          <select
            value={selectedLocation}
            onChange={(e) => setSelectedLocation(e.target.value)}
            style={styles.select}
          >
            <option value="">Alle Locations</option>
            {locations.map(loc => (
              <option key={loc.id} value={loc.id}>{loc.name} - {loc.city}</option>
            ))}
          </select>
        </div>
        <div style={styles.filterGroup}>
          <label style={styles.label}>Von</label>
          <input
            type="date"
            value={dateRange.startDate}
            onChange={(e) => setDateRange({ ...dateRange, startDate: e.target.value })}
            style={styles.input}
          />
        </div>
        <div style={styles.filterGroup}>
          <label style={styles.label}>Bis</label>
          <input
            type="date"
            value={dateRange.endDate}
            onChange={(e) => setDateRange({ ...dateRange, endDate: e.target.value })}
            style={styles.input}
          />
        </div>
      </div>

      {/* Overview Cards */}
      <div style={styles.cardsGrid}>
        <div style={styles.card}>
          <div style={styles.cardIcon}>📅</div>
          <div style={styles.cardContent}>
            <div style={styles.cardLabel}>Gesamte Buchungen</div>
            <div style={styles.cardValue}>{overviewStats?.total_bookings || 0}</div>
          </div>
        </div>
        <div style={styles.card}>
          <div style={styles.cardIcon}>💰</div>
          <div style={styles.cardContent}>
            <div style={styles.cardLabel}>Gesamtumsatz</div>
            <div style={styles.cardValue}>
              €{(overviewStats?.total_revenue || 0).toFixed(2)}
            </div>
          </div>
        </div>
        <div style={styles.card}>
          <div style={styles.cardIcon}>📈</div>
          <div style={styles.cardContent}>
            <div style={styles.cardLabel}>Durchschnitt pro Buchung</div>
            <div style={styles.cardValue}>
              €{(overviewStats?.average_booking_value || 0).toFixed(2)}
            </div>
          </div>
        </div>
        <div style={styles.card}>
          <div style={styles.cardIcon}>⚡</div>
          <div style={styles.cardContent}>
            <div style={styles.cardLabel}>Auslastung</div>
            <div style={styles.cardValue}>
              {utilization?.utilization_rate || 0}%
            </div>
          </div>
        </div>
      </div>

      {/* Utilization Details */}
      {utilization && (
        <div style={styles.section}>
          <h2 style={styles.sectionTitle}>🎯 Slot-Auslastung</h2>
          <div style={styles.utilizationGrid}>
            <div style={styles.utilizationCard}>
              <div style={styles.utilizationLabel}>Gesamt Slots</div>
              <div style={styles.utilizationValue}>{utilization.total_slots}</div>
            </div>
            <div style={styles.utilizationCard}>
              <div style={styles.utilizationLabel}>Gebucht</div>
              <div style={styles.utilizationValue}>{utilization.booked_slots}</div>
            </div>
            <div style={styles.utilizationCard}>
              <div style={styles.utilizationLabel}>Verfügbar</div>
              <div style={styles.utilizationValue}>{utilization.available_slots}</div>
            </div>
          </div>
        </div>
      )}

      {/* By Location */}
      <div style={styles.section}>
        <h2 style={styles.sectionTitle}>📍 Buchungen pro Location</h2>
        {locationStats.length === 0 ? (
          <div style={styles.empty}>Keine Daten verfügbar</div>
        ) : (
          <div style={styles.table}>
            <div style={styles.tableHeader}>
              <div style={styles.tableCell}>Location</div>
              <div style={styles.tableCell}>Stadt</div>
              <div style={styles.tableCell}>Buchungen</div>
              <div style={styles.tableCell}>Umsatz</div>
            </div>
            {locationStats.map((stat, idx) => (
              <div key={idx} style={styles.tableRow}>
                <div style={styles.tableCell}>{stat.location_name}</div>
                <div style={styles.tableCell}>{stat.city}</div>
                <div style={styles.tableCell}>{stat.booking_count}</div>
                <div style={styles.tableCell}>€{stat.total_revenue.toFixed(2)}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* By Asset */}
      <div style={styles.section}>
        <h2 style={styles.sectionTitle}>🏟️ Buchungen pro Asset</h2>
        {assetStats.length === 0 ? (
          <div style={styles.empty}>Keine Daten verfügbar</div>
        ) : (
          <div style={styles.table}>
            <div style={styles.tableHeader}>
              <div style={styles.tableCell}>Asset</div>
              <div style={styles.tableCell}>Typ</div>
              <div style={styles.tableCell}>Location</div>
              <div style={styles.tableCell}>Buchungen</div>
              <div style={styles.tableCell}>Umsatz</div>
              <div style={styles.tableCell}>Ø Preis</div>
            </div>
            {assetStats.map((stat, idx) => (
              <div key={idx} style={styles.tableRow}>
                <div style={styles.tableCell}>{stat.asset_name}</div>
                <div style={styles.tableCell}>{stat.asset_type}</div>
                <div style={styles.tableCell}>{stat.location_name}</div>
                <div style={styles.tableCell}>{stat.booking_count}</div>
                <div style={styles.tableCell}>€{stat.total_revenue.toFixed(2)}</div>
                <div style={styles.tableCell}>€{stat.avg_price.toFixed(2)}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Monthly Trend */}
      <div style={styles.section}>
        <h2 style={styles.sectionTitle}>📆 Monatliche Entwicklung</h2>
        <div style={styles.monthlyChart}>
          {monthlyStats.map((stat, idx) => {
            const maxRevenue = Math.max(...monthlyStats.map(s => s.revenue));
            const heightPercent = maxRevenue > 0 ? (stat.revenue / maxRevenue) * 100 : 0;
            const monthNames = ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'];
            
            return (
              <div key={idx} style={styles.monthlyBar}>
                <div style={styles.barWrapper}>
                  <div 
                    style={{
                      ...styles.bar,
                      height: `${Math.max(heightPercent, 5)}%`
                    }}
                    title={`${monthNames[parseInt(stat.month) - 1]}: ${stat.booking_count} Buchungen, €${stat.revenue}`}
                  >
                    <span style={styles.barLabel}>{stat.booking_count}</span>
                  </div>
                </div>
                <div style={styles.monthLabel}>{monthNames[parseInt(stat.month) - 1]}</div>
                <div style={styles.revenueLabel}>€{stat.revenue}</div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

const styles = {
  container: {
    maxWidth: 1400,
    margin: '0 auto',
    padding: 24,
    background: '#0a1c17',
    minHeight: '100vh'
  },
  header: {
    marginBottom: 32
  },
  title: {
    fontSize: 32,
    fontWeight: 700,
    color: '#e8efe8',
    margin: 0
  },
  subtitle: {
    fontSize: 16,
    color: '#9db',
    marginTop: 8
  },
  loading: {
    textAlign: 'center',
    padding: 60,
    fontSize: 18,
    color: '#9db'
  },
  filters: {
    display: 'flex',
    gap: 16,
    marginBottom: 24,
    flexWrap: 'wrap'
  },
  filterGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
    flex: '1 1 200px'
  },
  label: {
    fontSize: 14,
    color: '#9db',
    fontWeight: 500
  },
  select: {
    padding: '10px 12px',
    borderRadius: 8,
    border: '1px solid #26493c',
    background: '#0f2a20',
    color: '#e8efe8',
    fontSize: 14
  },
  input: {
    padding: '10px 12px',
    borderRadius: 8,
    border: '1px solid #26493c',
    background: '#0f2a20',
    color: '#e8efe8',
    fontSize: 14
  },
  cardsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
    gap: 16,
    marginBottom: 32
  },
  card: {
    background: 'linear-gradient(135deg, #1b4b3d 0%, #0e2a22 100%)',
    padding: 24,
    borderRadius: 12,
    border: '1px solid #2f6b57',
    display: 'flex',
    alignItems: 'center',
    gap: 16
  },
  cardIcon: {
    fontSize: 40
  },
  cardContent: {
    flex: 1
  },
  cardLabel: {
    fontSize: 14,
    color: '#9db',
    marginBottom: 8
  },
  cardValue: {
    fontSize: 28,
    fontWeight: 700,
    color: '#e8efe8'
  },
  section: {
    marginBottom: 32,
    background: '#0f2a20',
    padding: 24,
    borderRadius: 12,
    border: '1px solid #26493c'
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 600,
    color: '#e8efe8',
    marginTop: 0,
    marginBottom: 20
  },
  utilizationGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
    gap: 16
  },
  utilizationCard: {
    background: '#1b4b3d',
    padding: 16,
    borderRadius: 8,
    textAlign: 'center'
  },
  utilizationLabel: {
    fontSize: 12,
    color: '#9db',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: '0.5px'
  },
  utilizationValue: {
    fontSize: 32,
    fontWeight: 700,
    color: '#10b981'
  },
  table: {
    display: 'flex',
    flexDirection: 'column',
    gap: 2
  },
  tableHeader: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))',
    gap: 8,
    padding: '12px 16px',
    background: '#1b4b3d',
    borderRadius: 8,
    fontWeight: 600,
    fontSize: 14,
    color: '#9db',
    textTransform: 'uppercase',
    letterSpacing: '0.5px'
  },
  tableRow: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))',
    gap: 8,
    padding: '12px 16px',
    background: '#0a1c17',
    borderRadius: 8,
    color: '#e8efe8',
    fontSize: 14
  },
  tableCell: {
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap'
  },
  empty: {
    textAlign: 'center',
    padding: 40,
    color: '#789',
    fontSize: 16
  },
  monthlyChart: {
    display: 'flex',
    gap: 12,
    alignItems: 'flex-end',
    height: 300,
    padding: '20px 0'
  },
  monthlyBar: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 8
  },
  barWrapper: {
    flex: 1,
    width: '100%',
    display: 'flex',
    alignItems: 'flex-end',
    justifyContent: 'center'
  },
  bar: {
    width: '80%',
    background: 'linear-gradient(180deg, #10b981 0%, #0a7a5a 100%)',
    borderRadius: '8px 8px 0 0',
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'center',
    padding: '8px 0',
    transition: 'all 0.3s ease',
    cursor: 'pointer',
    boxShadow: '0 2px 8px rgba(16, 185, 129, 0.3)'
  },
  barLabel: {
    fontSize: 12,
    fontWeight: 600,
    color: '#fff'
  },
  monthLabel: {
    fontSize: 12,
    fontWeight: 500,
    color: '#9db'
  },
  revenueLabel: {
    fontSize: 11,
    color: '#789'
  }
};
