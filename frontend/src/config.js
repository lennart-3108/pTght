// Determine API base URL with flexible overrides:
// Priority:
// 1) URL query ?api=... or ?apiBase=... (persists to localStorage)
// 2) localStorage.API_BASE
// 3) REACT_APP_API_BASE env var
// 4) Default: if running on localhost, use http://localhost:5002 (matches dev smoke task); else "/api"
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

function resolveApiBase() {
	const fromQuery = readQueryApiOverride();
	if (fromQuery) return fromQuery.replace(/\/$/, "");
	const fromLs = readLocalStorageApi();
	if (fromLs) return String(fromLs).trim().replace(/\/$/, "");
	if (envBase) return envBase.replace(/\/$/, "");

	const isBrowser = typeof window !== "undefined" && window.location;
	const host = isBrowser ? window.location.hostname : "";
	const isLocal = host === "localhost" || host === "127.0.0.1";
	const base = isLocal ? "http://localhost:5002" : "/api";
	return base.replace(/\/$/, "");
}

export const API_BASE = resolveApiBase();

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

