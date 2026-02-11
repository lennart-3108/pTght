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
	// Production: only show "coming soon" landing page
	SHOW_ONLY_LANDING: INSTANCE_TYPE === 'production',
	
	// Test instance: limited features
	SHOW_MATCHES: INSTANCE_TYPE === 'test' || INSTANCE_TYPE === 'development',
	SHOW_LEAGUES: INSTANCE_TYPE === 'development', // Hidden in test with "coming soon"
	SHOW_COMPETITIONS: INSTANCE_TYPE === 'development', // Hidden in test with "coming soon"
	SHOW_BOOKINGS: INSTANCE_TYPE === 'development', // Hidden in test with "coming soon"
	SHOW_VENUES: INSTANCE_TYPE === 'development', // Hidden in test with "coming soon"
	
	// Test disclaimer
	SHOW_TEST_DISCLAIMER: INSTANCE_TYPE === 'test',
	
	// Sport restrictions for test
	RESTRICT_TO_TENNIS_SINGLES: INSTANCE_TYPE === 'test',
};

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
	} finally {
		clearTimeout(id);
	}
}

