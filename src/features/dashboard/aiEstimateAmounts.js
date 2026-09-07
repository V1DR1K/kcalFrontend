import { decimalNumber, normalizeDecimalInput } from "../../utils/decimal.js";

// Preserve the reference while the user clears the field or types a decimal separator.
export function resizeAiEstimateItem(item, value) {
  const estimatedGrams = normalizeDecimalInput(value);
  const previous = Number(item.nutritionBasisGrams) || decimalNumber(item.estimatedGrams);
  const next = decimalNumber(estimatedGrams);
  if (!(next > 0) || !(previous > 0)) return { ...item, estimatedGrams, nutritionBasisGrams: previous };
  const ratio = next / previous;
  return {
    ...item, estimatedGrams, nutritionBasisGrams: next,
    proteinGrams: Number(item.proteinGrams || 0) * ratio,
    carbsGrams: Number(item.carbsGrams || 0) * ratio,
    fatGrams: Number(item.fatGrams || 0) * ratio,
    nutrients: Object.fromEntries(Object.entries(item.nutrients || {}).map(([code, amount]) => [code, Number(amount) * ratio])),
  };
}
