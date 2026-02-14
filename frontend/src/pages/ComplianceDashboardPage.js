import React, { useCallback, useMemo, useState } from 'react';
import { API_BASE } from '../config';
import { useLanguage } from '../i18n';

export default function ComplianceDashboardPage() {
  const { t } = useLanguage();
  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
  const isAdmin = typeof window !== 'undefined' && localStorage.getItem('is_admin') === '1';

  const statusLabel = useCallback((value) => {
    if (value === 'open') return t('compliance.open');
    if (value === 'in_review') return t('compliance.inReview');
    if (value === 'resolved') return t('compliance.resolved');
    if (value === 'rejected') return t('compliance.rejected');
    return value || t('compliance.unknown');
  }, [t]);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [summary, setSummary] = useState({ open: 0, in_review: 0, resolved: 0, total: 0 });
  const [reports, setReports] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [busyReportId, setBusyReportId] = useState(null);

  const authHeaders = useMemo(() => {
    if (!token) return { 'Content-Type': 'application/json' };
    return {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    };
  }, [token]);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [summaryRes, reportsRes, tasksRes] = await Promise.all([
        fetch(`${API_BASE}/compliance/summary`, { headers: token ? { Authorization: `Bearer ${token}` } : {} }),
        fetch(`${API_BASE}/compliance/reports?status=open`, { headers: token ? { Authorization: `Bearer ${token}` } : {} }),
        fetch(`${API_BASE}/tasks`, { headers: token ? { Authorization: `Bearer ${token}` } : {} }),
      ]);

      if (!summaryRes.ok || !reportsRes.ok || !tasksRes.ok) {
        throw new Error(t('compliance.errorLoad'));
      }

      const [summaryData, reportsData, tasksData] = await Promise.all([
        summaryRes.json(),
        reportsRes.json(),
        tasksRes.json(),
      ]);

      setSummary(summaryData || { open: 0, in_review: 0, resolved: 0, total: 0 });
      setReports(Array.isArray(reportsData) ? reportsData : []);
      setTasks(Array.isArray(tasksData) ? tasksData : []);
    } catch (e) {
      setError(e?.message || t('compliance.errorLoad'));
    } finally {
      setLoading(false);
    }
  }, [token, t]);

  React.useEffect(() => {
    if (!isAdmin) return;
    loadData();
  }, [isAdmin, loadData]);

  async function updateReport(reportId, payload) {
    setBusyReportId(reportId);
    setError('');
    try {
      const res = await fetch(`${API_BASE}/compliance/reports/${reportId}`, {
        method: 'PATCH',
        headers: authHeaders,
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error(t('compliance.errorUpdate'));
      await loadData();
    } catch (e) {
      setError(e?.message || t('compliance.errorUpdate'));
    } finally {
      setBusyReportId(null);
    }
  }

  async function createTaskFromReport(report) {
    setBusyReportId(report.id);
    setError('');
    try {
      const taskPayload = {
        title: `Compliance: ${report.subject || `Meldung #${report.id}`}`,
        description: [
          `Report-ID: ${report.id}`,
          `Gemeldete User-ID: ${report.reported_user_id || '-'}`,
          `Kategorie: ${report.category || '-'}`,
          `URL: ${report.content_url || '-'}`,
          '',
          report.message || '',
        ].join('\n'),
        type: 'bug',
        status: 'to-do',
        assignee: 'Compliance',
      };

      const createRes = await fetch(`${API_BASE}/tasks`, {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify(taskPayload),
      });
      if (!createRes.ok) throw new Error(t('compliance.errorTaskCreate'));
      const createdTask = await createRes.json();

      const patchRes = await fetch(`${API_BASE}/compliance/reports/${report.id}`, {
        method: 'PATCH',
        headers: authHeaders,
        body: JSON.stringify({
          status: 'in_review',
          assigned_task_id: createdTask?.id || null,
        }),
      });
      if (!patchRes.ok) throw new Error(t('compliance.errorTaskLink'));

      await loadData();
    } catch (e) {
      setError(e?.message || t('compliance.errorTaskCreate'));
    } finally {
      setBusyReportId(null);
    }
  }

  const openTasks = useMemo(
    () => tasks.filter((task) => task && task.status !== 'done').slice(0, 20),
    [tasks]
  );

  if (!isAdmin) {
    return (
      <div style={{ maxWidth: 960, margin: '36px auto', padding: '0 20px', color: '#e5e7eb' }}>
        <h1 style={{ color: '#debc7c', marginBottom: 10 }}>Compliance Dashboard</h1>
        <p>{t('compliance.noAccess')}</p>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 1100, margin: '28px auto', padding: '0 20px', color: '#e5e7eb' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginBottom: 18 }}>
        <div>
          <h1 style={{ color: '#debc7c', margin: 0 }}>{t('compliance.title')}</h1>
          <p style={{ margin: '6px 0 0', color: '#9ca3af' }}>{t('compliance.subtitle')}</p>
        </div>
        <button
          type="button"
          onClick={loadData}
          disabled={loading}
          style={{
            border: '1px solid #374151',
            background: '#111827',
            color: '#e5e7eb',
            borderRadius: 8,
            padding: '8px 12px',
            cursor: loading ? 'default' : 'pointer',
            opacity: loading ? 0.7 : 1,
          }}
        >
          {t('compliance.refresh')}
        </button>
      </div>

      {error && <div style={{ marginBottom: 16, color: '#fca5a5' }}>{error}</div>}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 10, marginBottom: 20 }}>
        <div style={{ border: '1px solid #374151', borderRadius: 10, padding: 12, background: '#111827' }}>
          <div style={{ color: '#9ca3af', fontSize: 12 }}>{t('compliance.open')}</div>
          <div style={{ fontSize: 24, fontWeight: 700 }}>{summary.open || 0}</div>
        </div>
        <div style={{ border: '1px solid #374151', borderRadius: 10, padding: 12, background: '#111827' }}>
          <div style={{ color: '#9ca3af', fontSize: 12 }}>{t('compliance.inReview')}</div>
          <div style={{ fontSize: 24, fontWeight: 700 }}>{summary.in_review || 0}</div>
        </div>
        <div style={{ border: '1px solid #374151', borderRadius: 10, padding: 12, background: '#111827' }}>
          <div style={{ color: '#9ca3af', fontSize: 12 }}>{t('compliance.resolved')}</div>
          <div style={{ fontSize: 24, fontWeight: 700 }}>{summary.resolved || 0}</div>
        </div>
        <div style={{ border: '1px solid #374151', borderRadius: 10, padding: 12, background: '#111827' }}>
          <div style={{ color: '#9ca3af', fontSize: 12 }}>{t('compliance.total')}</div>
          <div style={{ fontSize: 24, fontWeight: 700 }}>{summary.total || 0}</div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 14 }}>
        <section style={{ border: '1px solid #374151', borderRadius: 12, padding: 14, background: '#0f172a' }}>
          <h2 style={{ marginTop: 0, marginBottom: 12, color: '#debc7c' }}>{t('compliance.openReports')}</h2>
          {loading && <div style={{ color: '#9ca3af' }}>{t('compliance.loadingReports')}</div>}
          {!loading && reports.length === 0 && <div style={{ color: '#9ca3af' }}>{t('compliance.noReports')}</div>}

          {reports.map((report) => (
            <article key={report.id} style={{ borderTop: '1px solid #1f2937', paddingTop: 12, marginTop: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
                <strong>#{report.id} · {report.subject}</strong>
                <span style={{ color: '#9ca3af', fontSize: 13 }}>{statusLabel(report.status)}</span>
              </div>
              <div style={{ fontSize: 13, color: '#9ca3af', marginTop: 4 }}>
                {t('compliance.category')}: {report.category || '-'} · {t('compliance.reporter')}: {report.reporter_name || report.reporter_email || t('compliance.unknown')}
              </div>
              <div style={{ fontSize: 13, color: '#9ca3af', marginTop: 2 }}>
                {t('compliance.reportedUserId')}: {report.reported_user_id || '-'}
              </div>
              {report.content_url && (
                <div style={{ marginTop: 4, fontSize: 13 }}>
                  {t('compliance.url')}: <a href={report.content_url} target="_blank" rel="noreferrer" style={{ color: '#93c5fd' }}>{report.content_url}</a>
                </div>
              )}
              <p style={{ whiteSpace: 'pre-wrap', marginTop: 8 }}>{report.message}</p>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <button
                  type="button"
                  disabled={busyReportId === report.id}
                  onClick={() => updateReport(report.id, { status: 'in_review' })}
                  style={{ border: '1px solid #374151', background: '#111827', color: '#e5e7eb', borderRadius: 8, padding: '6px 10px' }}
                >
                  {t('compliance.setInReview')}
                </button>
                <button
                  type="button"
                  disabled={busyReportId === report.id}
                  onClick={() => updateReport(report.id, { status: 'resolved' })}
                  style={{ border: '1px solid #065f46', background: '#064e3b', color: '#d1fae5', borderRadius: 8, padding: '6px 10px' }}
                >
                  {t('compliance.markResolved')}
                </button>
                {!report.assigned_task_id && (
                  <button
                    type="button"
                    disabled={busyReportId === report.id}
                    onClick={() => createTaskFromReport(report)}
                    style={{ border: '1px solid #7c2d12', background: '#7c2d12', color: '#ffedd5', borderRadius: 8, padding: '6px 10px' }}
                  >
                    {t('compliance.createTask')}
                  </button>
                )}
                {report.assigned_task_id ? (
                  <span style={{ color: '#9ca3af', fontSize: 13, alignSelf: 'center' }}>{t('compliance.taskLinked', { id: report.assigned_task_id })}</span>
                ) : null}
              </div>
            </article>
          ))}
        </section>

        <section style={{ border: '1px solid #374151', borderRadius: 12, padding: 14, background: '#0f172a' }}>
          <h2 style={{ marginTop: 0, marginBottom: 12, color: '#debc7c' }}>{t('compliance.taskboardOpen')}</h2>
          {openTasks.length === 0 && <div style={{ color: '#9ca3af' }}>{t('compliance.noOpenTasks')}</div>}
          {openTasks.map((task) => (
            <div key={task.id} style={{ borderTop: '1px solid #1f2937', paddingTop: 10, marginTop: 10 }}>
              <div style={{ fontWeight: 600 }}>{task.title}</div>
              <div style={{ color: '#9ca3af', fontSize: 13 }}>
                #{task.id} · {task.type} · {task.status}
              </div>
              {task.assignee ? <div style={{ color: '#9ca3af', fontSize: 13 }}>{t('compliance.assignee')}: {task.assignee}</div> : null}
            </div>
          ))}
        </section>
      </div>
    </div>
  );
}
