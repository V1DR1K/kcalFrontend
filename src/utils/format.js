const dateKey = (value) => `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getDate()).padStart(2, "0")}`;

export const today = (date = new Date()) => dateKey(date);
export function shiftDate(date, days) { const value = new Date(`${date}T00:00:00`); value.setDate(value.getDate() + days); return dateKey(value); }
export function readableDate(date) { return new Date(`${date}T00:00:00`).toLocaleDateString("es-AR", { weekday: "short", day: "2-digit", month: "short" }); }
export function formatNumber(value, digits = 0) { return Number(value || 0).toLocaleString("es-AR", { maximumFractionDigits: digits, minimumFractionDigits: digits }); }
export const macroGrams = (calories, percent, caloriesPerGram) => Math.round((Number(calories || 0) * Number(percent || 0)) / 100 / caloriesPerGram);
export const macroValue = (item, key) => Number(item?.[key] ?? item?.[key.replace("Grams", "G")] ?? 0);
