const dateKey = (value) => `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getDate()).padStart(2, "0")}`;

export const today = (date = new Date()) => dateKey(date);
export function shiftDate(date, days) { const value = new Date(`${date}T00:00:00`); value.setDate(value.getDate() + days); return dateKey(value); }
export function readableDate(date) { return new Date(`${date}T00:00:00`).toLocaleDateString("es-AR", { weekday: "short", day: "2-digit", month: "short" }); }
export function formatNumber(value, digits = 0) { return Number(value || 0).toLocaleString("es-AR", { maximumFractionDigits: digits, minimumFractionDigits: digits }); }
export function formatQuantity(value) { return Number(value || 0).toLocaleString("es-AR", { maximumFractionDigits: 2 }); }
export const macroGrams = (calories, percent, caloriesPerGram) => Math.round((Number(calories || 0) * Number(percent || 0)) / 100 / caloriesPerGram);
export const macroValue = (item, key) => Number(item?.[key] ?? item?.[key.replace("Grams", "G")] ?? 0);

export function formatMeasure(value, unit = "GRAM") {
  if (value == null || !Number.isFinite(Number(value))) return "Sin dato";
  const singular = Number(value) === 1;
  const label = ({ GRAM: "g", MILLILITER: "ml", PORTION: singular ? "porción" : "porciones", UNIT: singular ? "unidad" : "unidades" })[unit] || unit;
  return `${formatQuantity(value)} ${label}`;
}
export function formatNutrient(value, digits = 0, unit = "") {
  return value == null || !Number.isFinite(Number(value)) ? "Sin dato" : `${formatNumber(value, digits)}${unit ? ` ${unit}` : ""}`;
}
export const macroLabel = (macro) => ({ PROTEIN: "Proteínas", CARBS: "Carbohidratos", FAT: "Grasas" })[String(macro?.key).toUpperCase()] || macro?.label || "Nutriente";
