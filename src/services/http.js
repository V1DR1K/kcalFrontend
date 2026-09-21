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
    if (refreshedAfter(startedAt)) return true;
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
  const response = await fetch(`${API_BASE_URL}/api/auth/refresh`, {
    method: "POST",
    headers: { Accept: "application/json" },
    credentials: "include",
  });
  if (!response.ok) return { ok: false, definitive: response.status === 400 || response.status === 401 };
  localStorage.setItem(REFRESH_MARKER_KEY, String(Date.now()));
  return { ok: true, definitive: true };
}

function refreshTokensOnce(startedAt) {
  if (!refreshPromise) {
    const action = async () => {
      if (refreshedAfter(startedAt)) return { ok: true, definitive: true };
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

async function requestInner(path, options) {
  const isFormData = options.body instanceof FormData;
  const headers = {
    Accept: "application/json",
    ...(isFormData ? {} : { "Content-Type": "application/json" }),
    ...(options.headers || {}),
  };
  if (isFormData) delete headers["Content-Type"];
  const response = await fetch(`${API_BASE_URL}${path}`, { ...options, credentials: options.credentials || "include", headers });
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
  const { skipAuthRefresh = false, ...fetchOptions } = options;
  let result = await requestInner(path, fetchOptions);
  let retryableAuthFailure = false;
  const isAuthBootstrapRequest = path === "/api/auth/me";
  const isAuthSessionRequest = ["/api/auth/login", "/api/auth/refresh", "/api/auth/logout"].includes(path);
  if (!result.ok && result.status === 401 && !skipAuthRefresh && (isAuthBootstrapRequest || !isAuthSessionRequest)) {
    let refreshResult = null;
    try {
      refreshResult = await refreshTokensOnce(Date.now());
    } catch {
      // A network failure is not proof that the session is invalid.
      retryableAuthFailure = true;
    }
    if (refreshResult?.ok) {
      result = await requestInner(path, fetchOptions);
    } else if (refreshResult?.definitive) {
      window.dispatchEvent(new Event("scalegrams:session-expired"));
    } else {
      retryableAuthFailure = true;
    }
  }
  if (!result.ok) {
    const error = toError(result.status, result.body);
    error.retryable = retryableAuthFailure;
    throw error;
  }
  return result.body;
}
