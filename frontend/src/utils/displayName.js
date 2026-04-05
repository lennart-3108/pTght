/**
 * Format a user's display name: "Firstname L."
 * Only the first letter of the lastname is shown for privacy.
 */
export function displayName(firstname, lastname) {
  const fn = (firstname || '').trim();
  const ln = (lastname || '').trim();
  if (!fn && !ln) return '';
  if (!ln) return fn;
  if (!fn) return ln.charAt(0) + '.';
  return `${fn} ${ln.charAt(0)}.`;
}
