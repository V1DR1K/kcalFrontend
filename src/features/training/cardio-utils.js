export function localDateTimeInput(value = new Date()) {
  const date = value instanceof Date ? value : new Date(value);
  const pad = (part) => String(part).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function toOffsetDateTime(value) {
  return new Date(value).toISOString();
}

export function formatCardioDate(value) {
  if (!value) return "Fecha no disponible";
  return new Intl.DateTimeFormat("es-AR", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

export function formatCardioMinutes(value) {
  const minutes = Number(value || 0);
  if (minutes >= 60) return `${Math.floor(minutes / 60)} h ${minutes % 60 ? `${minutes % 60} min` : ""}`.trim();
  return `${minutes} min`;
}

export function cardioProgress(summary = {}) {
  const threshold = Number(summary.thresholdMinutes || 1200);
  return threshold ? Math.min(100, Math.round((Number(summary.totalDurationMinutes || 0) / threshold) * 100)) : 0;
}

export function cardioPayload(form) {
  return {
    equipment: "TREADMILL",
    recordedAt: toOffsetDateTime(form.recordedAt),
    distanceKm: decimalNumber(form.distanceKm),
    durationMinutes: Number(form.durationMinutes),
    inclined: Boolean(form.inclined),
  };
}
import { decimalNumber } from "../../utils/decimal.js";
