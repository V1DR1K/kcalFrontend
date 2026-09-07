import { decimalNumber } from "../../utils/decimal.js";

export const CARDIO_STEP_LENGTH_FACTOR = 0.415;

export function cardioDistanceFromSpeed(speedKmh, durationMinutes) {
  const speed = Number(speedKmh);
  const duration = Number(durationMinutes);
  if (!Number.isFinite(speed) || !Number.isFinite(duration) || speed < 0 || duration <= 0) return null;
  return Number((speed * duration / 60).toFixed(3));
}

export function cardioEstimatedSteps(distanceKm, heightCm) {
  const distance = Number(distanceKm);
  const height = Number(heightCm);
  if (!Number.isFinite(distance) || distance < 0 || !Number.isFinite(height) || height <= 0) return null;
  const stepLengthMeters = height * CARDIO_STEP_LENGTH_FACTOR / 100;
  return Math.round(distance * 1000 / stepLengthMeters);
}

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

export function formatCardioDistance(value) {
  if (value === null || value === undefined || !Number.isFinite(Number(value))) return "Distancia no disponible";
  return `${new Intl.NumberFormat("es-AR", { maximumFractionDigits: 3 }).format(Number(value))} km`;
}

export function formatCardioSpeed(value) {
  if (value === null || value === undefined || !Number.isFinite(Number(value))) return "Velocidad no disponible";
  return `${new Intl.NumberFormat("es-AR", { maximumFractionDigits: 2 }).format(Number(value))} km/h`;
}

export function formatCardioSteps(value) {
  if (value === null || value === undefined || !Number.isFinite(Number(value))) return "No disponible";
  return new Intl.NumberFormat("es-AR", { maximumFractionDigits: 0 }).format(Number(value));
}

export function cardioProgress(summary = {}) {
  const threshold = Number(summary.thresholdMinutes || 1200);
  return threshold ? Math.min(100, Math.round((Number(summary.totalDurationMinutes || 0) / threshold) * 100)) : 0;
}

export function cardioPayload(form) {
  const speedKmh = decimalNumber(form.speedKmh);
  return {
    equipment: "TREADMILL",
    recordedAt: toOffsetDateTime(form.recordedAt),
    speedKmh: Number.isFinite(speedKmh) ? speedKmh : undefined,
    durationMinutes: Number(form.durationMinutes),
    inclined: Boolean(form.inclined),
  };
}

export function localTimeZone() {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || "America/Argentina/Buenos_Aires";
}
