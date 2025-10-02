// Determine API base URL:
// - If REACT_APP_API_BASE is set, use it.
// - If running locally (localhost/127.0.0.1), default to http://localhost:5001.
// - Otherwise (server behind Caddy/Nginx), use same-origin "/api".
const envBase = (typeof process !== 'undefined' && process.env && process.env.REACT_APP_API_BASE)
	? String(process.env.REACT_APP_API_BASE).trim()
	: "";

function resolveApiBase() {
	if (envBase) return envBase.replace(/\/$/, "");
	const isBrowser = typeof window !== "undefined" && window.location;
	const host = isBrowser ? window.location.hostname : "";
	const isLocal = host === "localhost" || host === "127.0.0.1";
	const base = isLocal ? "http://localhost:5001" : "/api";
	return base.replace(/\/$/, "");
}

export const API_BASE = resolveApiBase();

