import React, { useState, useEffect, useRef } from 'react';
import { API_BASE } from '../config';

// Very small autocomplete: calls GET /users?search=term
export default function UserSearch({ onSelect, placeholder = 'Search user by name or email' }) {
  const [q, setQ] = useState('');
  const [results, setResults] = useState([]);
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);
  const timer = useRef(null);
  const containerRef = useRef();
  const [highlightIndex, setHighlightIndex] = useState(-1);

  useEffect(() => {
    return () => clearTimeout(timer.current);
  }, []);

  useEffect(() => {
    if (!q) return setResults([]);
    clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(`${API_BASE}/users?search=${encodeURIComponent(q)}`);
        if (!res.ok) throw new Error('search failed');
        const data = await res.json();
        setResults(data || []);
        setShow(true);
      } catch (e) {
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 300);
  }, [q]);

  useEffect(() => {
    function onDoc(e) {
      if (!containerRef.current) return;
      if (!containerRef.current.contains(e.target)) setShow(false);
    }
    document.addEventListener('click', onDoc);
    return () => document.removeEventListener('click', onDoc);
  }, []);

  useEffect(() => {
    // reset highlight when results change
    setHighlightIndex(results && results.length ? 0 : -1);
  }, [results]);

  const onKeyDown = (e) => {
    if (!show) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightIndex(i => Math.min((results || []).length - 1, Math.max(0, i + 1)));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightIndex(i => Math.max(0, (i === -1 ? (results.length - 1) : i - 1)));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const u = results && results[highlightIndex];
      if (u) {
        onSelect && onSelect(u);
        setShow(false);
        setQ('');
        setResults([]);
      }
    } else if (e.key === 'Escape') {
      setShow(false);
    }
  };

  return (
    <div ref={containerRef} style={{ position: 'relative' }}>
      <input
        value={q}
        onChange={e => { setQ(e.target.value); }}
        onFocus={() => setShow(true)}
        onKeyDown={onKeyDown}
        placeholder={placeholder}
        style={{ width: 220 }}
      />
      {show && (results.length > 0 || loading) && (
        <div style={{ position: 'absolute', left: 0, right: 0, background: '#fff', border: '1px solid #ccc', zIndex: 40, maxHeight: 220, overflow: 'auto' }}>
          {loading && <div style={{ padding: 8 }}>Searching…</div>}
          {!loading && results.map((u, idx) => (
            <div
              key={u.id}
              style={{ padding: 8, cursor: 'pointer', background: idx === highlightIndex ? '#eef' : '#fff' }}
              onMouseEnter={() => setHighlightIndex(idx)}
              onClick={() => { onSelect && onSelect(u); setShow(false); setQ(''); setResults([]); }}
            >
              <div style={{ fontWeight: 600 }}>{u.displayName || u.email}</div>
              <div style={{ fontSize: 12, color: '#666' }}>{u.email}</div>
            </div>
          ))}
          {!loading && results.length === 0 && <div style={{ padding: 8, color: '#666' }}>No results</div>}
        </div>
      )}
    </div>
  );
}
