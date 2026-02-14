import React, { useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { API_BASE } from '../config';
import { useLanguage } from '../i18n';

export default function ReportIllegalContentPage() {
  const { t } = useLanguage();
  const location = useLocation();
  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
  const createDefaultForm = () => ({
    reporter_name: '',
    reporter_email: '',
    reported_user_id: '',
    category: 'illegal_content',
    subject: '',
    content_url: '',
    message: '',
  });

  const readPrefillFromQuery = (search) => {
    const params = new URLSearchParams(search || '');
    return {
      reported_user_id: params.get('reported_user_id') || '',
      category: params.get('category') || 'illegal_content',
      subject: params.get('subject') || '',
      content_url: params.get('content_url') || '',
      message: params.get('message') || '',
    };
  };

  const [form, setForm] = useState({
    ...createDefaultForm(),
    ...readPrefillFromQuery(location.search),
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [successId, setSuccessId] = useState(null);

  useEffect(() => {
    const prefill = readPrefillFromQuery(location.search);
    setForm((prev) => ({
      ...prev,
      reported_user_id: prefill.reported_user_id || prev.reported_user_id,
      category: prefill.category || prev.category,
      subject: prefill.subject || prev.subject,
      content_url: prefill.content_url || prev.content_url,
      message: prefill.message || prev.message,
    }));
  }, [location.search]);

  const headers = useMemo(() => {
    if (!token) return { 'Content-Type': 'application/json' };
    return {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    };
  }, [token]);

  async function onSubmit(e) {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    setSuccessId(null);
    try {
      const res = await fetch(`${API_BASE}/compliance/reports`, {
        method: 'POST',
        headers,
        body: JSON.stringify(form),
      });
      if (!res.ok) {
        throw new Error(t('report.errSend'));
      }
      const data = await res.json();
      setSuccessId(data?.report?.id || null);
      setForm(createDefaultForm());
    } catch (err) {
      setError(err?.message || t('report.errSend'));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div style={{ maxWidth: 900, margin: '40px auto', padding: '0 20px', color: '#e5e7eb', lineHeight: 1.8 }}>
      <h1 style={{ color: '#debc7c', marginBottom: 20, fontSize: 32 }}>{t('report.title')}</h1>
      <p style={{ fontSize: 14, color: '#9ca3af', marginBottom: 24 }}>{t('report.subtitle')}</p>

      <p>{t('report.intro')}</p>
      <p>{t('report.reportable')}</p>
      <ul style={{ marginLeft: 20 }}>
        <li>{t('report.item1')}</li>
        <li>{t('report.item2')}</li>
        <li>{t('report.item3')}</li>
        <li>{t('report.item4')}</li>
      </ul>

      <p style={{ marginTop: 18 }}>{t('report.info')}</p>
      <p style={{ marginTop: 8, color: '#9ca3af', fontSize: 14 }}>{t('report.requiredUserId')}</p>

      <form onSubmit={onSubmit} style={{ marginTop: 18, display: 'grid', gap: 12 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <input
            type="text"
            placeholder={t('report.name')}
            value={form.reporter_name}
            onChange={(e) => setForm((prev) => ({ ...prev, reporter_name: e.target.value }))}
            style={{ background: '#111827', color: '#e5e7eb', border: '1px solid #374151', borderRadius: 8, padding: 10 }}
          />
          <input
            type="email"
            placeholder={t('report.email')}
            value={form.reporter_email}
            onChange={(e) => setForm((prev) => ({ ...prev, reporter_email: e.target.value }))}
            style={{ background: '#111827', color: '#e5e7eb', border: '1px solid #374151', borderRadius: 8, padding: 10 }}
          />
        </div>

        <input
          type="number"
          min="1"
          required
          placeholder={t('report.reportedUserId')}
          value={form.reported_user_id}
          onChange={(e) => setForm((prev) => ({ ...prev, reported_user_id: e.target.value }))}
          style={{ background: '#111827', color: '#e5e7eb', border: '1px solid #374151', borderRadius: 8, padding: 10 }}
        />

        <select
          value={form.category}
          onChange={(e) => setForm((prev) => ({ ...prev, category: e.target.value }))}
          style={{ background: '#111827', color: '#e5e7eb', border: '1px solid #374151', borderRadius: 8, padding: 10 }}
        >
          <option value="illegal_content">{t('report.cat.illegal')}</option>
          <option value="insult_defamation">{t('report.cat.insultDefamation')}</option>
          <option value="hate_speech">{t('report.cat.hate')}</option>
          <option value="profile_image">{t('report.cat.profile')}</option>
          <option value="abuse">{t('report.cat.abuse')}</option>
          <option value="other">{t('report.cat.other')}</option>
        </select>

        <input
          type="text"
          required
          placeholder={t('report.subject')}
          value={form.subject}
          onChange={(e) => setForm((prev) => ({ ...prev, subject: e.target.value }))}
          style={{ background: '#111827', color: '#e5e7eb', border: '1px solid #374151', borderRadius: 8, padding: 10 }}
        />

        <input
          type="url"
          placeholder={t('report.url')}
          value={form.content_url}
          onChange={(e) => setForm((prev) => ({ ...prev, content_url: e.target.value }))}
          style={{ background: '#111827', color: '#e5e7eb', border: '1px solid #374151', borderRadius: 8, padding: 10 }}
        />

        <textarea
          required
          rows={7}
          placeholder={t('report.message')}
          value={form.message}
          onChange={(e) => setForm((prev) => ({ ...prev, message: e.target.value }))}
          style={{ background: '#111827', color: '#e5e7eb', border: '1px solid #374151', borderRadius: 8, padding: 10 }}
        />

        <button
          type="submit"
          disabled={submitting}
          style={{
            background: '#debc7c',
            color: '#1f2937',
            border: 'none',
            borderRadius: 8,
            padding: '10px 14px',
            fontWeight: 700,
            cursor: submitting ? 'default' : 'pointer',
            opacity: submitting ? 0.75 : 1,
          }}
        >
          {submitting ? t('report.sending') : t('report.send')}
        </button>
      </form>

      {error ? <p style={{ marginTop: 12, color: '#fca5a5' }}>{error}</p> : null}
      {successId ? <p style={{ marginTop: 12, color: '#86efac' }}>{t('report.success', { id: successId })}</p> : null}
    </div>
  );
}
