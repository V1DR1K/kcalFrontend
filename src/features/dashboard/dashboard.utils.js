import { formatQuantity } from "../../utils/format";
import { formatRecipeLogAmount } from "../../utils/recipe";
import { preparationLabel } from "../catalog/CatalogComponents";
import { normalizeMealLogReference } from "./mealLogPayload";
import { decimalNumber } from "../../utils/decimal";
export { mealTotals } from "./nutritionTotals.js";

export function isCopyableMealLog(log) { return ["FOOD", "RECIPE"].includes(log?.itemType || log?.type); }

export function aiProposalFood(item) {
  const estimatedGrams = Math.max(1, decimalNumber(item?.estimatedGrams) || 100);
  const factor = 100 / estimatedGrams;
  const nutrients = Object.fromEntries(Object.entries(item?.nutrients || {}).map(([code, value]) => [code, Number(value || 0) * factor]));
  return { name: item?.name?.trim() || "Alimento estimado", category: item?.category || "OTHER", preparation: item?.preparation || "UNSPECIFIED", baseQuantity: 100, proteinGrams: Number(item?.proteinGrams || 0) * factor, carbsGrams: Number(item?.carbsGrams || 0) * factor, fatGrams: Number(item?.fatGrams || 0) * factor, nutrients };
}

export function aiEstimateWithServings(result) {
  return { ...result, items: (result.items || []).map((item) => ({ ...item, estimatedGrams: String(item.estimatedGrams ?? 100), category: item.category || "OTHER", preparation: item.preparation || "UNSPECIFIED" })) };
}

export function aiEstimateDraft(estimate) {
  return { name: estimate.name, description: estimate.description || "", confidence: Number(estimate.confidence) || 0, assumptions: estimate.assumptions || [], items: (estimate.items || []).map(({ name, estimatedGrams, category, preparation, proteinGrams, carbsGrams, fatGrams, nutrients }) => ({ name, estimatedGrams: decimalNumber(estimatedGrams), category: category || "OTHER", preparation: preparation || "UNSPECIFIED", proteinGrams: Number(proteinGrams), carbsGrams: Number(carbsGrams), fatGrams: Number(fatGrams), nutrients: nutrients || {} })) };
}

export function macroValue(log, key) {
  if (key === "PROTEIN") return Number(log.proteinGrams || 0);
  if (key === "CARBS") return Number(log.carbsGrams || 0);
  if (key === "FAT") return Number(log.fatGrams || 0);
  return 0;
}

export async function createMealLogs(api, logs, mealType, logDate) {
  if (logs.some((log) => !isCopyableMealLog(log))) throw new Error("Las estimaciones por foto no se pueden copiar como una comida guardada.");
  const payloads = logs.map((log) => normalizeMealLogReference(log, mealType, logDate));
  return api.request("/api/nutrition/meal-logs/batch", { method: "POST", body: JSON.stringify({ logs: payloads }) });
}

export function mealCopyErrorMessage(error, fallback) {
  if (error?.status === 401) return "Tu sesión expiró. Volvé a ingresar.";
  return error?.message || fallback;
}

export function formatMealLogAmount(log) {
  if (log.itemType === "RECIPE") return formatRecipeLogAmount(log);
  if (log.itemType === "AI_ESTIMATE") return "Estimación por foto";
  return `${formatQuantity(log.quantity)} g`;
}

export function mealLogName(log) { return log.itemType === "RECIPE" ? log.recipe?.name : log.itemType === "AI_ESTIMATE" ? log.displayName || "Comida estimada" : log.food?.name; }
export function mealLogItem(log) {
  if (log.itemType === "RECIPE") return {
    ...log.recipe,
    rawTotalWeightGrams: log.recipeRawTotalWeightGrams ?? log.recipe?.rawTotalWeightGrams ?? log.recipe?.totalWeightGrams,
    cookedTotalWeightGrams: log.recipeCookedTotalWeightGrams ?? log.recipe?.cookedTotalWeightGrams,
    type: "RECIPE",
  };
  if (log.itemType === "AI_ESTIMATE") return { name: mealLogName(log), category: "OTHER", type: "AI_ESTIMATE" };
  return { ...log.food, type: "FOOD" };
}

export function savedAiEstimate(log) {
  try {
    const details = JSON.parse(log.aiEstimateDetails || "{}");
    return { name: log.displayName || "Comida estimada", description: details.description || "", context: details.context || "", confidence: log.aiEstimateConfidence ?? 0, assumptions: details.assumptions || [], items: (details.items || []).map((item) => ({ ...item, category: item.category || "OTHER", preparation: item.preparation || "UNSPECIFIED" })) };
  } catch { return { name: log.displayName || "Comida estimada", description: "", context: "", confidence: log.aiEstimateConfidence ?? 0, assumptions: [], items: [] }; }
}

export function aiQuotaReset(usage) { if (!usage?.blockedUntil) return ""; return new Intl.DateTimeFormat("es-AR", { hour: "2-digit", minute: "2-digit", day: "2-digit", month: "short" }).format(new Date(usage.blockedUntil)); }
export function foodPreparationSuffix(food) { return food?.preparation && food.preparation !== "UNSPECIFIED" ? ` · ${preparationLabel(food.preparation)}` : ""; }
export function macroCalories(proteinGrams, carbsGrams, fatGrams) { return Math.round(Number(proteinGrams || 0) * 4 + Number(carbsGrams || 0) * 4 + Number(fatGrams || 0) * 9); }
export function scaleFoodNutrition(food, quantity) { const baseQuantity = Number(food?.baseQuantity || 100); const grams = Number(quantity || 0); const factor = baseQuantity > 0 ? grams / baseQuantity : 0; const proteinGrams = Number(food?.proteinGrams || 0) * factor; const carbsGrams = Number(food?.carbsGrams || 0) * factor; const fatGrams = Number(food?.fatGrams || 0) * factor; return { calories: macroCalories(proteinGrams, carbsGrams, fatGrams), proteinGrams, carbsGrams, fatGrams }; }
