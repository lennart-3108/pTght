import React, { useEffect, useMemo, useState } from "react";
import { API_BASE } from "../config";

// Generate Gravatar URL from email
function gravatarUrl(email, size = 200) {
  if (!email) return null;
  const hash = email.trim().toLowerCase();
  // Simple hash for demo - in production you'd use MD5
  // For now, we'll just use a default avatar service
  return `https://ui-avatars.com/api/?name=${encodeURIComponent(email.split('@')[0])}&size=${size}&background=163a2f&color=e8efe8&bold=true`;
}

// normalize possibly-relative URLs to absolute using API_BASE
// Also fix hardcoded localhost:5002 references
function toAbsolute(url) {
  if (!url) return "";
  let s = String(url);
  
  // Fix hardcoded localhost:5002 references - replace with current API_BASE
  if (s.includes('localhost:5002')) {
    // Extract just the path part (e.g., /uploads/avatars/3.jpg)
    const match = s.match(/\/uploads\/avatars\/[^?#]+/);
    if (match) {
      s = match[0]; // Now it's a relative path
    }
  }
  
  // If already absolute, return as-is
  if (/^(https?:)?\/\//i.test(s)) return s;
  
  // Convert relative to absolute using API_BASE
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
const avatarCache = new Map(); // key: userId -> { url: string|null, email: string|null }

export default function Avatar({ userId, name, src, size = 40, style = {}, className = "", title = "" }) {
  const [fetched, setFetched] = useState(null);
  const [userEmail, setUserEmail] = useState(null);

  // Compute a candidate src: explicit prop > fetched > gravatar > null
  const resolvedSrc = useMemo(() => {
    if (src) return toAbsolute(src);
    if (fetched) return toAbsolute(fetched);
    if (userEmail) return gravatarUrl(userEmail, size * 2);
    if (name) return `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&size=${size * 2}&background=163a2f&color=e8efe8&bold=true`;
    return null;
  }, [src, fetched, userEmail, name, size]);

  useEffect(() => {
    let mounted = true;
    const id = userId != null ? String(userId).match(/\d+/)?.[0] : null;
    if (!id || id === '0') return; // Skip invalid or zero IDs
    // if cached, use it immediately
    if (avatarCache.has(id)) {
      const cached = avatarCache.get(id);
      setFetched(cached.url);
      setUserEmail(cached.email);
      return;
    }
    // fetch user to get avatar_url and email
    (async () => {
      try {
        const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
        const r = await fetch(`${API_BASE}/users/${id}`, {
          headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        });
        const j = await r.json().catch(() => ({}));
        const url = j && j.avatar_url ? String(j.avatar_url) : null;
        const email = j && j.email ? String(j.email) : null;
        const abs = url ? toAbsolute(url) : null;
        avatarCache.set(id, { url: abs, email });
        if (mounted) {
          setFetched(abs);
          setUserEmail(email);
        }
      } catch {
        avatarCache.set(id, { url: null, email: null });
        if (mounted) {
          setFetched(null);
          setUserEmail(null);
        }
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
