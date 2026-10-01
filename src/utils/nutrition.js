export const NUTRITION_FIELDS = ["calories", "proteinGrams", "carbsGrams", "fatGrams"];
const codes = { calories: "CALORIES", proteinGrams: "PROTEIN", carbsGrams: "CARBOHYDRATE", fatGrams: "FAT" };
export function scaleNutrition(source = {}, factor = 1) {
  const result = {}; const knownTotals = {};
  for (const key of NUTRITION_FIELDS) {
    const value = source[key];
    result[key] = value == null ? null : Number(value) * factor;
    const subtotal = source.knownTotals?.[key] ?? source.nutrients?.find(item => item.code === codes[key])?.knownValue ?? value;
    knownTotals[key] = subtotal == null ? null : Number(subtotal) * factor;
  }
  if (result.calories != null) result.calories = Math.round(result.calories);
  return { ...result, knownTotals, energyComplete: result.calories != null, nutritionComplete: NUTRITION_FIELDS.every(key => result[key] != null) };
}
export function sumNutrition(items = []) {
  const result = {}; const knownTotals = {};
  for (const key of NUTRITION_FIELDS) {
    result[key] = items.some(item => item[key] == null) ? null : items.reduce((sum, item) => sum + Number(item[key]), 0);
    const known = items.map(item => item.knownTotals?.[key] ?? item[key]).filter(value => value != null);
    knownTotals[key] = known.length ? known.reduce((sum, value) => sum + Number(value), 0) : null;
  }
  return { ...result, knownTotals, energyComplete: result.calories != null, nutritionComplete: NUTRITION_FIELDS.every(key => result[key] != null) };
}
export function nutritionWarning(food = {}) {
  if (food.nutritionWarning) return food.nutritionWarning;
  if (NUTRITION_FIELDS.some(key => food[key] == null)) return "Información nutricional incompleta. Los totales incluirán solo los datos informados.";
  if (food.category === "PROTEIN" && NUTRITION_FIELDS.every(key => Number(food[key]) === 0)) return "Composición pendiente de verificar. Compará con otra variante.";
  return "";
}
