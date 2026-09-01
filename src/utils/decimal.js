export const MAX_DECIMAL_PLACES = 2;

export function normalizeDecimalInput(value, maxFractionDigits = MAX_DECIMAL_PLACES) {
  const cleaned = String(value ?? "").replace(/,/g, ".").replace(/[^\d.]/g, "");
  const separatorIndex = cleaned.indexOf(".");
  if (separatorIndex < 0) return cleaned;

  const whole = cleaned.slice(0, separatorIndex);
  const fraction = cleaned.slice(separatorIndex + 1).replace(/\./g, "");
  return `${whole}.${fraction.slice(0, maxFractionDigits)}`;
}

export function decimalNumber(value) {
  const normalized = normalizeDecimalInput(value);
  if (!normalized || normalized === ".") return NaN;
  return Number(normalized);
}
