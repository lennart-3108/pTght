export function formatPlayerName(value) {
  const raw = String(value || '').trim();
  if (!raw) return '';

  // Handle emails gracefully
  if (raw.includes('@')) {
    const userPart = raw.split('@')[0].trim();
    if (!userPart) return raw;
    return userPart;
  }

  // Collapse whitespace
  const parts = raw.split(/\s+/).filter(Boolean);
  if (!parts.length) return '';
  if (parts.length === 1) return parts[0];

  const first = parts[0];
  const last = parts[parts.length - 1];
  const initial = last && last[0] ? `${last[0].toUpperCase()}.` : '';

  // If last part already looks like an initial (e.g. "A."), keep it
  if (/^[A-Za-zÄÖÜäöü]\.$/.test(last)) {
    return `${first} ${last}`;
  }

  return initial ? `${first} ${initial}` : first;
}
