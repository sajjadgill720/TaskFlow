/**
 * Public base URL for absolute links and `fetch` calls (no trailing slash).
 *
 * Set in `.env` / `.env.local`:
 *   VITE_API_BASE_URL=http://localhost:5173
 *   VITE_API_BASE_URL=https://task-flow-five-vert.vercel.app
 *
 * If unset, uses `window.location.origin` in the browser so local dev keeps working.
 */
function stripTrailingSlashes(s: string): string {
  return s.replace(/\/+$/, "");
}

const fromEnv = stripTrailingSlashes((import.meta.env.VITE_API_BASE_URL as string | undefined)?.trim() ?? "");

export function getApiBaseUrl(): string {
  if (fromEnv) return fromEnv;
  if (typeof window !== "undefined" && window.location?.origin) {
    return window.location.origin;
  }
  return "";
}

/** Absolute URL: base + path (path must start with `/` or a single segment is prefixed with `/`). */
export function apiUrl(path: string): string {
  const base = getApiBaseUrl();
  const p = path.startsWith("/") ? path : `/${path}`;
  return `${base}${p}`;
}

/** `fetch` against the configured API base, e.g. `apiFetch("/api/events")`. */
export function apiFetch(path: string, init?: RequestInit): Promise<Response> {
  return fetch(apiUrl(path), init);
}
