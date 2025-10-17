import React, { useEffect, useMemo, useState } from "react";
import { API_BASE } from "../config";

// normalize possibly-relative URLs to absolute using API_BASE
function toAbsolute(url) {
  if (!url) return "";
  const s = String(url);
  if (/^(https?:)?\/\//i.test(s)) return s;
  return `${API_BASE.replace(/\/$/, '')}/${s.replace(/^\//, '')}`;
}

function initialsFrom(name) {
  const s = String(name || '').trim();
  if (!s) return '?';
  const p = s.split(/\s+/);
  const a = (p[0]?.[0] || '').toUpperCase();
  const b = (p[1]?.[0] || '').toUpperCase();
  return (a + b) || a || '?';
}

// Simple in-memory cache for fetched avatars
const avatarCache = new Map(); // key: userId -> absoluteUrl or null

export default function Avatar({ userId, name, src, size = 40, style = {}, className = "", title = "" }) {
  const [fetched, setFetched] = useState(null);

  // Compute a candidate src: explicit prop > fetched > null
  const resolvedSrc = useMemo(() => {
    if (src) return toAbsolute(src);
    if (fetched) return toAbsolute(fetched);
    return null;
  }, [src, fetched]);

  useEffect(() => {
    let mounted = true;
    const id = userId != null ? String(userId).match(/\d+/)?.[0] : null;
    if (!id) return;
    // if cached, use it immediately
    if (avatarCache.has(id)) {
      const v = avatarCache.get(id);
      setFetched(v);
      return;
    }
    // fetch user to get avatar_url
    (async () => {
      try {
        const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
        const r = await fetch(`${API_BASE}/users/${id}`, {
          headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        });
        const j = await r.json().catch(() => ({}));
        const url = j && j.avatar_url ? String(j.avatar_url) : null;
        const abs = url ? toAbsolute(url) : null;
        avatarCache.set(id, abs);
        if (mounted) setFetched(abs);
      } catch {
        avatarCache.set(id, null);
        if (mounted) setFetched(null);
      }
    })();
    return () => { mounted = false; };
  }, [userId]);

  const baseStyle = {
    width: size,
    height: size,
    borderRadius: size,
    overflow: 'hidden',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: '#163a2f',
    color: '#e8efe8',
    fontSize: Math.max(10, Math.round(size * 0.36)),
    fontWeight: 800,
    border: '1px solid #2f6b57',
    ...style,
  };

  if (resolvedSrc) {
    return (
      <img
        alt={title || name || 'avatar'}
        src={resolvedSrc}
        className={className}
        style={{ ...baseStyle, objectFit: 'cover' }}
        title={title || name || ''}
      />
    );
  }

  return (
    <span className={className} style={baseStyle} title={title || name || ''}>
      {initialsFrom(name)}
    </span>
  );
}
