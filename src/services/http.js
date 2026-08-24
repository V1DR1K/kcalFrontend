import { REFRESH_KEY, TOKEN_KEY, USER_KEY } from "../config/app.js";

const API_BASE_URL = import.meta.env?.VITE_API_BASE_URL || "";
let refreshPromise = null;
const REFRESH_LOCK_KEY = "scalegrams.auth.refresh.lock";
const REFRESH_MARKER_KEY = "scalegrams.auth.refresh.marker";
const INSTANCE_ID = typeof crypto !== "undefined" && typeof crypto.randomUUID === "function" ? crypto.randomUUID() : Math.random().toString(36).slice(2);

function sleep(milliseconds) { return new Promise((resolve) => setTimeout(resolve, milliseconds)); }
function refreshedAfter(startedAt) { return Number(localStorage.getItem(REFRESH_MARKER_KEY) || 0) > startedAt; }

async function withRefreshLock(startedAt, action) {
  const lockValue = `${INSTANCE_ID}:${Date.now()}`;
  const deadline = Date.now() + 12000;
  let acquired = false;
  while (Date.now() < deadline) {
    if (refreshedAfter(startedAt)) return localStorage.getItem(TOKEN_KEY);
    const current = localStorage.getItem(REFRESH_LOCK_KEY);
    if (!current || Number(current.split(":")[1] || 0) < Date.now() - 12000) {
      localStorage.setItem(REFRESH_LOCK_KEY, lockValue);
      acquired = localStorage.getItem(REFRESH_LOCK_KEY) === lockValue;
      if (acquired) break;
    }
    await sleep(50);
  }
  if (!acquired) return null;
  try { return await action(); }
  finally { if (localStorage.getItem(REFRESH_LOCK_KEY) === lockValue) localStorage.removeItem(REFRESH_LOCK_KEY); }
}

async function refreshTokens() {
  const refreshToken = localStorage.getItem(REFRESH_KEY);
  if (!refreshToken) return null;
  const response = await fetch(`${API_BASE_URL}/api/auth/refresh`, {
    method: "POST",
    headers: { Accept: "application/json", "Content-Type": "application/json" },
    body: JSON.stringify({ refreshToken }),
  });
  if (!response.ok) return null;
  const payload = await response.json();
  const accessToken = payload.accessToken || payload.token;
  if (!accessToken || !payload.refreshToken) return null;
  localStorage.setItem(TOKEN_KEY, accessToken);
  localStorage.setItem(REFRESH_KEY, payload.refreshToken);
  if (payload.user) localStorage.setItem(USER_KEY, JSON.stringify(payload.user));
  localStorage.setItem(REFRESH_MARKER_KEY, String(Date.now()));
  return accessToken;
}

function refreshTokensOnce(startedAt) {
  if (!refreshPromise) {
    const action = async () => {
      if (refreshedAfter(startedAt)) return localStorage.getItem(TOKEN_KEY);
      return refreshTokens();
    };
    const coordinated = typeof navigator !== "undefined" && navigator.locks
      ? navigator.locks.request("scalegrams-auth-refresh", { mode: "exclusive" }, action)
      : withRefreshLock(startedAt, action);
    refreshPromise = coordinated.finally(() => {
      refreshPromise = null;
    });
  }
  return refreshPromise;
}

async function requestInner(path, options, accessToken) {
  const isFormData = options.body instanceof FormData;
  const headers = {
    Accept: "application/json",
    ...(isFormData ? {} : { "Content-Type": "application/json" }),
    ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
    ...(options.headers || {}),
  };
  if (isFormData) delete headers["Content-Type"];
  const response = await fetch(`${API_BASE_URL}${path}`, { ...options, headers });
  const text = await response.text();
  let body = null;
  if (text) { try { body = JSON.parse(text); } catch { body = text; } }
  return { ok: response.ok, status: response.status, body };
}

function toError(status, body) {
  const payload = typeof body === "object" && body ? body : null;
  let message = "No se pudo completar la operación.";
  if (payload?.message) message = payload.message;
  const error = new Error(message);
  error.status = status;
  error.code = payload?.code;
  error.fields = payload?.fields || {};
  return error;
}

export async function request(path, options = {}) {
  let accessToken = localStorage.getItem(TOKEN_KEY);
  let result = await requestInner(path, options, accessToken);
  if (!result.ok && result.status === 401 && !path.startsWith("/api/auth/")) {
    let fresh = null;
    let refreshFailed = false;
    try {
      fresh = await refreshTokensOnce(Date.now());
    } catch {
      // A network failure is not proof that the session is invalid.
      refreshFailed = true;
    }
    if (fresh) {
      result = await requestInner(path, options, fresh);
    } else if (!refreshFailed) {
      window.dispatchEvent(new Event("scalegrams:session-expired"));
    }
  }
  if (!result.ok) throw toError(result.status, result.body);
  return result.body;
}
