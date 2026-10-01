export const MAX_DECIMAL_PLACES = 2;

// Preserve the entered text; validation must never turn -1 into 1 or discard pasted characters.
export function normalizeDecimalInput(value) { return String(value ?? "").replace(/,/g, "."); }
export function decimalNumber(value, maxFractionDigits = MAX_DECIMAL_PLACES) {
  const normalized = normalizeDecimalInput(value).trim();
  const pattern = new RegExp(`^-?(?:\\d+(?:\\.\\d{0,${maxFractionDigits}})?|\\.\\d{1,${maxFractionDigits}})$`);
  return pattern.test(normalized) ? Number(normalized) : NaN;
}
