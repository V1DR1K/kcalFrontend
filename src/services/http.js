import { TOKEN_KEY } from "../config/app";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "";

export async function request(path, options = {}) {
  const token = localStorage.getItem(TOKEN_KEY);
  const isFormData = options.body instanceof FormData;
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: { Accept: "application/json", ...(isFormData ? {} : { "Content-Type": "application/json" }), ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(options.headers || {}) },
  });
  if (!response.ok) {
    const text = await response.text();
    if (response.status === 401 || response.status === 403) window.dispatchEvent(new Event("kazaFitness:session-expired"));
    let message = "No se pudo completar la operacion.";
    try { message = JSON.parse(text)?.message || message; } catch { /* El backend puede responder sin JSON. */ }
    throw new Error(message);
  }
  if (response.status === 204) return null;
  const contentType = response.headers.get("content-type") || "";
  return response.headers.get("content-length") === "0" || !contentType.includes("application/json") ? null : response.json();
}
