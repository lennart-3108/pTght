// Determine API base URL with flexible overrides:
// Priority:
// 1) URL query ?api=... or ?apiBase=... (persists to localStorage)
// 2) localStorage.API_BASE
// 3) REACT_APP_API_BASE env var
// 4) Default: if running on localhost, use http://localhost:5001/api; else "/api"
function readQueryApiOverride() {
	try {
		const isBrowser = typeof window !== 'undefined' && window.location;
		if (!isBrowser) return null;
		const params = new URLSearchParams(window.location.search || '');
		const q = (params.get('api') || params.get('apiBase') || '').trim();
		if (q) {
			try { window.localStorage && window.localStorage.setItem('API_BASE', q.replace(/\/$/, '')); } catch {}
			return q;
		}
		return null;
	} catch { return null; }
}

function readLocalStorageApi() {
	try { return (window.localStorage && window.localStorage.getItem('API_BASE')) || null; } catch { return null; }
}

const envBase = (typeof process !== 'undefined' && process.env && process.env.REACT_APP_API_BASE)
	? String(process.env.REACT_APP_API_BASE).trim()
	: "";


function ensureLocalApiSuffix(base) {
	const trimmed = (base || "").trim().replace(/\/$/, "");
	if (!trimmed) return trimmed;
	const lower = trimmed.toLowerCase();
	const needsApiSuffix = /^(https?:\/\/)?(localhost|127\.0\.0\.1)(:\\d+)?$/.test(lower);
	if (needsApiSuffix && !lower.endsWith("/api")) {
		return `${trimmed}/api`;
	}
	return trimmed;
}

function resolveApiBase() {
	// Check if running on production domain - if so, ignore localStorage to prevent stale values
	const isBrowser = typeof window !== "undefined" && window.location;
	const host = isBrowser ? window.location.hostname : "";
	const isLocal = host === "localhost" || host === "127.0.0.1" || host === "";
	const isProduction = !isLocal;

	const fromQuery = readQueryApiOverride();
	if (fromQuery) return ensureLocalApiSuffix(fromQuery);
	
	// On production domains, skip localStorage check to avoid stale localhost values
	if (!isProduction) {
		const fromLs = readLocalStorageApi();
		if (fromLs) {
			const normalized = ensureLocalApiSuffix(String(fromLs));
			if (normalized !== fromLs) {
				try { window.localStorage && window.localStorage.setItem('API_BASE', normalized); } catch {}
			}
			return normalized;
		}
	}
	
	if (envBase) return ensureLocalApiSuffix(envBase);

	const base = isLocal ? "http://localhost:5001/api" : "/api";
	return base.replace(/\/$/, "");
}

export const API_BASE = resolveApiBase();

// ============================================================================
// INSTANCE TYPE & FEATURE FLAGS
// ============================================================================
// Determines the deployment instance: 'production', 'test', or 'development'
// Priority: 1) REACT_APP_INSTANCE_TYPE env var, 2) hostname detection, 3) default 'development'
function resolveInstanceType() {
	// Check env var first
	if (typeof process !== 'undefined' && process.env && process.env.REACT_APP_INSTANCE_TYPE) {
		return process.env.REACT_APP_INSTANCE_TYPE;
	}
	
	// Detect from hostname
	if (typeof window !== 'undefined' && window.location) {
		const hostname = window.location.hostname;
		if (hostname === 'matchleague.org' || hostname === 'www.matchleague.org') {
			return 'production';
		}
		if (hostname === 'test.matchleague.org') {
			return 'test';
		}
		if (hostname === 'dev.matchleague.org') {
			return 'development';
		}
	}
	
	return 'development';
}

export const INSTANCE_TYPE = resolveInstanceType();

// Feature flags based on instance type
export const FEATURES = {
	SHOW_ONLY_LANDING: false,
	SHOW_MATCHES: true,
	SHOW_LEAGUES: true,
	SHOW_COMPETITIONS: false,
	SHOW_BOOKINGS: false,
	SHOW_VENUES: false,
	SHOW_TEAMS: false,
	SHOW_CHATS: true,
	SHOW_NEWS: true,
	SHOW_SUBSCRIPTIONS: false,
	SHOW_TEST_DISCLAIMER: INSTANCE_TYPE === 'test',
	RESTRICT_TO_TENNIS_SINGLES: false,
};

/**
 * Filter sports categories for production (Tennis Einzel only).
 * Structure: Category[] → Sport[] → Variant[]
 * SAFETY: If the filter produces zero results, returns ALL sports unfiltered
 * and logs a warning. This prevents an empty sport-selector in production.
 */
export function filterSportsCategories(categories) {
	if (!FEATURES.RESTRICT_TO_TENNIS_SINGLES) return categories;
	if (!Array.isArray(categories) || !categories.length) return categories;

	const filtered = categories
		.map(cat => ({
			...cat,
			sports: (cat.sports || []).map(sport => {
				if (!/tennis/i.test(sport.name)) return null;
				const variants = (sport.variants || []).filter(v =>
					/einzel|singles/i.test(v.name || v.category || '')
				);
				// Keep sport with only matching variants (or sport itself if no variants)
				return { ...sport, variants: variants.length ? variants : sport.variants || [] };
			}).filter(Boolean)
		}))
		.filter(cat => cat.sports.length > 0);

	// SAFETY: never show empty list — fallback to all sports
	if (!filtered.length) {
		console.warn('[PROD SAFETY] Sport filter produced 0 results — showing all sports. Check API data!');
		return categories;
	}

	return filtered;
}

/**
 * Filter flat sports list for production (Tennis only).
 * SAFETY: same fallback as above.
 */
export function filterSportsList(sports) {
	if (!FEATURES.RESTRICT_TO_TENNIS_SINGLES) return sports;
	if (!Array.isArray(sports) || !sports.length) return sports;

	const filtered = sports.filter(s => /tennis/i.test(s.name) && /einzel|singles/i.test(s.name));
	if (!filtered.length) {
		console.warn('[PROD SAFETY] Sport list filter produced 0 results — showing all. Check API data!');
		return sports;
	}
	return filtered;
}

// Small helper: fetch with timeout (default 8s)
export async function fetchWithTimeout(resource, options = {}) {
	const { timeout = 8000, signal } = options;
	const controller = new AbortController();
	const id = setTimeout(() => controller.abort(), timeout);
	try {
		const merged = { ...options, signal: signal || controller.signal };
		try { console.log('[fetchWithTimeout] start', { url: resource, timeout }); } catch {}
		const resp = await fetch(resource, merged);
		try { console.log('[fetchWithTimeout] response', { url: resource, status: resp.status, ok: resp.ok }); } catch {}
		return resp;
	} catch (err) {
		// Suppress "aborted" errors from timeouts - they're expected
		if (err.name !== 'AbortError') {
			console.warn('[fetchWithTimeout] error', { url: resource, error: err.message });
		}
		throw err;
	} finally {
		clearTimeout(id);
	}
}

