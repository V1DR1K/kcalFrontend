export const OCR_MACRO_FIELDS = ["proteinGrams", "carbsGrams", "fatGrams"];

export function macroCalories(proteinGrams, carbsGrams, fatGrams) {
  return Math.round(Number(proteinGrams || 0) * 4 + Number(carbsGrams || 0) * 4 + Number(fatGrams || 0) * 9);
}

export function normalizeNumericInput(value) {
  const cleaned = String(value ?? "").replace(",", ".").replace(/[^\d.]/g, "");
  const [whole, ...decimals] = cleaned.split(".");
  return decimals.length ? `${whole}.${decimals.join("")}` : whole;
}
