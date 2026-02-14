import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { API_BASE } from '../config';
import './TasksBoardPage.css';

const COLUMNS = ['to-do', 'in progress', 'blocked', 'test', 'prod', 'done'];
const TYPE_OPTIONS = ['story', 'epic', 'project', 'improvement/idea', 'bug'];

const initialForm = {
  title: '',
  description: '',
  type: 'project',
  status: 'to-do',
  assignee: '',
  linked_story_task_id: '',
  blocked_by_task_id: '',
};

function titleCase(value) {
  if (!value) return '';
  return value
    .split(' ')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

export default function TasksBoardPage() {
  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
  const [tasks, setTasks] = useState([]);
  const [filterType, setFilterType] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterEpicMode, setFilterEpicMode] = useState('all');
  const [filterAssignee, setFilterAssignee] = useState('all');
  const [searchText, setSearchText] = useState('');
  const [form, setForm] = useState(initialForm);
  const [editingId, setEditingId] = useState(null);
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const authHeaders = useMemo(() => {
    if (!token) return { 'Content-Type': 'application/json' };
    return {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    };
  }, [token]);

  const loadTasks = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${API_BASE}/tasks`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) throw new Error('Tasks konnten nicht geladen werden.');
      const data = await res.json();
      setTasks(Array.isArray(data) ? data : []);
    } catch (e) {
      setError(e?.message || 'Tasks konnten nicht geladen werden.');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    loadTasks();
  }, [loadTasks]);

  function resetForm() {
    setForm(initialForm);
    setEditingId(null);
  }

  function openCreateModal() {
    resetForm();
    setShowTaskModal(true);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.title.trim()) return;

    setSaving(true);
    setError('');
    try {
      const method = editingId ? 'PATCH' : 'POST';
      const url = editingId ? `${API_BASE}/tasks/${editingId}` : `${API_BASE}/tasks`;

      const payload = {
        ...form,
        linked_story_task_id: form.linked_story_task_id || null,
        blocked_by_task_id: form.blocked_by_task_id || null,
      };

      const res = await fetch(url, {
        method,
        headers: authHeaders,
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const msg = await res.text().catch(() => 'Speichern fehlgeschlagen.');
        throw new Error(msg || 'Speichern fehlgeschlagen.');
      }

      resetForm();
      setShowTaskModal(false);
      await loadTasks();
    } catch (e) {
      setError(e?.message || 'Speichern fehlgeschlagen.');
    } finally {
      setSaving(false);
    }
  }

  function handleEdit(task) {
    setEditingId(task.id);
    setForm({
      title: task.title || '',
      description: task.description || '',
      type: task.type || 'project',
      status: task.status || 'to-do',
      assignee: task.assignee || '',
      linked_story_task_id: task.linked_story_task_id ? String(task.linked_story_task_id) : '',
      blocked_by_task_id: task.blocked_by_task_id ? String(task.blocked_by_task_id) : '',
    });
    setShowTaskModal(true);
  }

  async function moveTask(taskId, status) {
    try {
      const res = await fetch(`${API_BASE}/tasks/${taskId}`, {
        method: 'PATCH',
        headers: authHeaders,
        body: JSON.stringify({ status }),
      });
      if (!res.ok) {
        const msg = await res.text().catch(() => 'Status konnte nicht aktualisiert werden.');
        throw new Error(msg || 'Status konnte nicht aktualisiert werden.');
      }
      await loadTasks();
    } catch (e) {
      setError(e?.message || 'Status konnte nicht aktualisiert werden.');
    }
  }

  const filteredTasks = useMemo(() => {
    return tasks.filter((task) => {
      if (filterType !== 'all' && task.type !== filterType) return false;
      if (filterStatus !== 'all' && task.status !== filterStatus) return false;
      if (filterEpicMode === 'only-epic' && task.type !== 'epic') return false;
      if (filterEpicMode === 'without-epic' && task.type === 'epic') return false;
      if (filterAssignee !== 'all' && (task.assignee || '').trim() !== filterAssignee) return false;
      if (searchText.trim()) {
        const haystack = `${task.title || ''} ${task.description || ''}`.toLowerCase();
        if (!haystack.includes(searchText.trim().toLowerCase())) return false;
      }
      return true;
    });
  }, [tasks, filterType, filterStatus, filterEpicMode, filterAssignee, searchText]);

  const grouped = useMemo(() => {
    const map = Object.fromEntries(COLUMNS.map((column) => [column, []]));
    filteredTasks.forEach((task) => {
      if (map[task.status]) map[task.status].push(task);
    });
    return map;
  }, [filteredTasks]);

  const storyOptions = useMemo(
    () => tasks.filter((task) => task.type === 'story'),
    [tasks]
  );

  const assigneeOptions = useMemo(() => {
    const unique = Array.from(new Set(tasks.map((task) => (task.assignee || '').trim()).filter(Boolean)));
    return unique.sort((a, b) => a.localeCompare(b));
  }, [tasks]);

  return (
    <div className="tasks-board-page">
      <div className="tasks-board-header">
        <div>
          <h1>Tasks</h1>
          <p className="tasks-subtitle">Einfaches Task Board für Stories, Epics und Project Tasks</p>
        </div>
        <button type="button" className="create-task-button" onClick={openCreateModal}>Create Task</button>
      </div>

      <div className="tasks-filters-panel">
        <input
          type="text"
          placeholder="Suche Titel/Beschreibung"
          value={searchText}
          onChange={(e) => setSearchText(e.target.value)}
        />
        <select value={filterType} onChange={(e) => setFilterType(e.target.value)}>
          <option value="all">Type: all</option>
          <option value="story">Type: story</option>
          <option value="epic">Type: epic</option>
          <option value="project">Type: project task</option>
          <option value="improvement/idea">Type: improvement/idea</option>
          <option value="bug">Type: bug</option>
        </select>
        <select value={filterEpicMode} onChange={(e) => setFilterEpicMode(e.target.value)}>
          <option value="all">Epic: all</option>
          <option value="only-epic">Epic: only epics</option>
          <option value="without-epic">Epic: without epics</option>
        </select>
        <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
          <option value="all">Status: all</option>
          {COLUMNS.map((column) => (
            <option key={column} value={column}>Status: {column}</option>
          ))}
        </select>
        <select value={filterAssignee} onChange={(e) => setFilterAssignee(e.target.value)}>
          <option value="all">Assignee: all</option>
          {assigneeOptions.map((assignee) => (
            <option key={assignee} value={assignee}>Assignee: {assignee}</option>
          ))}
        </select>
      </div>

      {loading && <div className="tasks-status">Lade Tasks …</div>}
      {error && <div className="tasks-error">{error}</div>}

      {showTaskModal && (
        <div className="tasks-modal-overlay" onClick={() => setShowTaskModal(false)}>
          <div className="tasks-modal" onClick={(e) => e.stopPropagation()}>
            <div className="tasks-modal-header">
              <h3>{editingId ? 'Task bearbeiten' : 'Task erstellen'}</h3>
              <button type="button" className="ghost-button" onClick={() => setShowTaskModal(false)}>×</button>
            </div>
            <form className="tasks-modal-form" onSubmit={handleSubmit}>
              <div className="tasks-modal-grid">
                <label className="tasks-modal-field tasks-modal-field--full">
                  <span>Title</span>
                  <input
                    type="text"
                    placeholder="Task title"
                    value={form.title}
                    onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))}
                    required
                  />
                </label>

                <label className="tasks-modal-field tasks-modal-field--full">
                  <span>Beschreibung</span>
                  <input
                    type="text"
                    placeholder="Beschreibung (optional)"
                    value={form.description}
                    onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
                  />
                </label>

                <label className="tasks-modal-field">
                  <span>Type</span>
                  <select value={form.type} onChange={(e) => setForm((prev) => ({ ...prev, type: e.target.value }))}>
                    {TYPE_OPTIONS.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="tasks-modal-field">
                  <span>Status</span>
                  <select value={form.status} onChange={(e) => setForm((prev) => ({ ...prev, status: e.target.value }))}>
                    {COLUMNS.map((column) => (
                      <option key={column} value={column}>
                        {column}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="tasks-modal-field">
                  <span>Assignee</span>
                  <input
                    type="text"
                    placeholder="Assignee (optional)"
                    value={form.assignee}
                    onChange={(e) => setForm((prev) => ({ ...prev, assignee: e.target.value }))}
                  />
                </label>

                <label className="tasks-modal-field">
                  <span>Story verlinken</span>
                  <select
                    value={form.linked_story_task_id}
                    onChange={(e) => setForm((prev) => ({ ...prev, linked_story_task_id: e.target.value }))}
                  >
                    <option value="">Story verlinken (optional)</option>
                    {storyOptions.map((story) => (
                      <option key={story.id} value={String(story.id)}>
                        #{story.id} {story.title}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="tasks-modal-field tasks-modal-field--full">
                  <span>Blocked by</span>
                  <select
                    value={form.blocked_by_task_id}
                    onChange={(e) => setForm((prev) => ({ ...prev, blocked_by_task_id: e.target.value }))}
                  >
                    <option value="">Blocked by (optional)</option>
                    {tasks
                      .filter((task) => !editingId || task.id !== editingId)
                      .map((task) => (
                        <option key={task.id} value={String(task.id)}>
                          #{task.id} {task.title}
                        </option>
                      ))}
                  </select>
                </label>
              </div>

              <div className="tasks-modal-actions">
                <button type="submit" disabled={saving}>{editingId ? 'Update' : 'Create'}</button>
                {editingId && (
                  <button type="button" onClick={resetForm} className="ghost-button">Cancel</button>
                )}
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="tasks-board-grid">
        {COLUMNS.map((column) => (
          <section className="tasks-column" key={column}>
            <h2>{titleCase(column)}</h2>
            <div className="tasks-column-list">
              {(grouped[column] || []).map((task) => (
                <article key={task.id} className="task-card">
                  <div className="task-card-top">
                    <strong>{task.title}</strong>
                    <span className={`task-type task-type--${task.type}`}>{task.type}</span>
                  </div>
                  {task.description ? <p>{task.description}</p> : null}
                  <div className="task-meta">
                    <span>#{task.id}</span>
                    {task.assignee ? <span>Assignee: {task.assignee}</span> : null}
                    {task.linked_story_task_id ? <span>Story: #{task.linked_story_task_id}</span> : null}
                    {task.blocked_by_task_id ? <span>Blocked by: #{task.blocked_by_task_id}</span> : null}
                  </div>
                  <div className="task-actions">
                    <button type="button" onClick={() => handleEdit(task)}>Bearbeiten</button>
                    <select
                      value={task.status}
                      onChange={(e) => moveTask(task.id, e.target.value)}
                    >
                      {COLUMNS.map((nextStatus) => (
                        <option key={nextStatus} value={nextStatus}>
                          {nextStatus}
                        </option>
                      ))}
                    </select>
                  </div>
                </article>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
