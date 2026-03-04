import React, { useState } from 'react';
import { API_BASE } from '../config';

export default function ImpressumPage() {
  const [form, setForm] = useState({ name: '', email: '', message: '' });
  const [status, setStatus] = useState(null); // null | 'sending' | 'ok' | 'error'
  const [errorMsg, setErrorMsg] = useState('');

  async function handleSubmit(e) {
    e.preventDefault();
    setStatus('sending');
    setErrorMsg('');
    try {
      const res = await fetch(`${API_BASE}/contact`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (res.ok) {
        setStatus('ok');
        setForm({ name: '', email: '', message: '' });
      } else {
        setStatus('error');
        setErrorMsg(data.error || 'Unbekannter Fehler.');
      }
    } catch {
      setStatus('error');
      setErrorMsg('Netzwerkfehler. Bitte versuche es später erneut.');
    }
  }

  const inputStyle = {
    width: '100%', padding: '10px 12px', background: '#1f2937',
    border: '1px solid #374151', borderRadius: 6, color: '#e5e7eb',
    fontSize: 15, outline: 'none', boxSizing: 'border-box',
  };

  return (
    <div style={{ maxWidth: 900, margin: '40px auto', padding: '0 20px', color: '#e5e7eb', lineHeight: 1.8 }}>
      <h1 style={{ color: '#debc7c', marginBottom: 20, fontSize: 32 }}>Impressum</h1>
      <p style={{ fontSize: 14, color: '#9ca3af', marginBottom: 24 }}>Stand: Februar 2026</p>

      <p>Angaben gemäß § 5 DDG (Digitale-Dienste-Gesetz)</p>
      <p>
        Betreiber der Plattform <strong>MatchLeague</strong> ist eine Privatperson.
      </p>

      <div style={{ marginTop: 20 }}>
        <p><strong>Name:</strong> Lennart Allenstein</p>
        <p><strong>Anschrift:</strong> Osterdeich 54, 28203 Bremen, Deutschland</p>
      </div>

      <p style={{ marginTop: 20 }}>MatchLeague wird nicht als eingetragenes Unternehmen betrieben.</p>

      <div style={{ marginTop: 40, padding: '24px', background: '#111827', borderRadius: 10, border: '1px solid #374151' }}>
        <h2 style={{ color: '#debc7c', fontSize: 20, marginBottom: 16 }}>Kontakt</h2>
        {status === 'ok' ? (
          <p style={{ color: '#4ade80', fontWeight: 600 }}>✓ Nachricht gesendet. Wir melden uns bei dir.</p>
        ) : (
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <input
              style={inputStyle}
              type="text"
              placeholder="Dein Name"
              value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              required
              maxLength={100}
            />
            <input
              style={inputStyle}
              type="email"
              placeholder="Deine E-Mail-Adresse"
              value={form.email}
              onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
              required
              maxLength={200}
            />
            <textarea
              style={{ ...inputStyle, minHeight: 120, resize: 'vertical' }}
              placeholder="Deine Nachricht"
              value={form.message}
              onChange={e => setForm(f => ({ ...f, message: e.target.value }))}
              required
              maxLength={2000}
            />
            {status === 'error' && (
              <p style={{ color: '#f87171', margin: 0 }}>{errorMsg}</p>
            )}
            <button
              type="submit"
              disabled={status === 'sending'}
              style={{
                padding: '10px 24px', background: status === 'sending' ? '#374151' : '#debc7c',
                color: '#111827', border: 'none', borderRadius: 6, fontWeight: 700,
                fontSize: 15, cursor: status === 'sending' ? 'not-allowed' : 'pointer',
                alignSelf: 'flex-start',
              }}
            >
              {status === 'sending' ? 'Wird gesendet...' : 'Nachricht senden'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
