import { formatQuantity } from "./format.js";
import { decimalNumber } from "./decimal.js";

export function rawRecipeWeight(recipe) {
  return Number(recipe?.rawTotalWeightGrams ?? recipe?.totalWeightGrams ?? 0);
}

export function cookedRecipeWeight(recipe) {
  return Number(recipe?.cookedTotalWeightGrams ?? 0);
}

export function hasCookedRecipeWeight(recipe) {
  return cookedRecipeWeight(recipe) > 0;
}

export function recipeYieldPercent(recipe) {
  const rawWeight = rawRecipeWeight(recipe);
  const cookedWeight = cookedRecipeWeight(recipe);
  return rawWeight > 0 && cookedWeight > 0 ? cookedWeight / rawWeight * 100 : null;
}

export function recipeServingFactor(recipe, quantity, unit) {
  const numericQuantity = decimalNumber(quantity);
  if (!Number.isFinite(numericQuantity) || numericQuantity <= 0) return 0;
  if (unit !== "GRAM") return numericQuantity;
  const cookedWeight = cookedRecipeWeight(recipe);
  return cookedWeight > 0 ? numericQuantity / cookedWeight : 0;
}

export function formatRecipeLogAmount(log) {
  if (log?.unit === "GRAM") return `${formatQuantity(log.quantity)} g cocidos`;
  return `${formatQuantity(log?.quantity)} ${decimalNumber(log?.quantity) === 1 ? "porción" : "porciones"}`;
}

export function buildRecipePayload({ name, description, ingredients, cookedTotalWeightGrams, clearCookedTotalWeight = false }) {
  const cookedWeight = decimalNumber(cookedTotalWeightGrams);
  return {
    name: name.trim(),
    description: description.trim(),
    ingredients: ingredients.map((item) => ({ foodId: item.foodId, quantity: decimalNumber(item.quantity), unit: item.unit })),
    cookedTotalWeightGrams: Number.isFinite(cookedWeight) && cookedWeight > 0 ? cookedWeight : null,
    clearCookedTotalWeight: Boolean(clearCookedTotalWeight),
  };
}
