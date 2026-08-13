import { REFRESH_KEY, TOKEN_KEY } from "../config/app";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "";
let refreshPromise = null;

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
  if (!payload.token || !payload.refreshToken) return null;
  localStorage.setItem(TOKEN_KEY, payload.token);
  localStorage.setItem(REFRESH_KEY, payload.refreshToken);
  return payload.token;
}

function refreshTokensOnce() {
  if (!refreshPromise) {
    refreshPromise = refreshTokens().finally(() => {
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
      fresh = await refreshTokensOnce();
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
