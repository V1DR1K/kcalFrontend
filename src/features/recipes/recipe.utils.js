import { preparationLabel } from "../catalog/catalog.utils.js";

const recipeItemCollator = new Intl.Collator("es-AR", { sensitivity: "base", numeric: true });

export function sortRecipeIngredients(ingredients = []) {
  return ingredients
    .map((ingredient, index) => ({ ingredient, index }))
    .sort((left, right) => (
      recipeItemCollator.compare(left.ingredient.food?.name || left.ingredient.recipe?.name || "Alimento", right.ingredient.food?.name || right.ingredient.recipe?.name || "Alimento")
      || Number(left.ingredient.quantity || 0) - Number(right.ingredient.quantity || 0)
      || left.index - right.index
    ))
    .map(({ ingredient }) => ingredient);
}

export function foodPreparationSuffix(food) {
  return food?.preparation && food.preparation !== "UNSPECIFIED" ? ` · ${preparationLabel(food.preparation)}` : "";
}

export function scaleFoodNutrition(food, quantity) {
  const baseQuantity = Number(food?.baseQuantity || 100);
  const factor = baseQuantity > 0 ? Number(quantity || 0) / baseQuantity : 0;
  const proteinGrams = Number(food?.proteinGrams || 0) * factor;
  const carbsGrams = Number(food?.carbsGrams || 0) * factor;
  const fatGrams = Number(food?.fatGrams || 0) * factor;
  return {
    calories: Math.round(proteinGrams * 4 + carbsGrams * 4 + fatGrams * 9),
    proteinGrams,
    carbsGrams,
    fatGrams,
  };
}

export function scaleRecipeNutrition(recipe, quantity) {
  const weight = Number(recipe?.cookedTotalWeightGrams || recipe?.rawTotalWeightGrams || recipe?.totalWeightGrams || 0);
  const factor = weight > 0 ? Number(quantity || 0) / weight : 0;
  const proteinGrams = Number(recipe?.proteinGrams || 0) * factor;
  const carbsGrams = Number(recipe?.carbsGrams || 0) * factor;
  const fatGrams = Number(recipe?.fatGrams || 0) * factor;
  return {
    calories: Math.round(proteinGrams * 4 + carbsGrams * 4 + fatGrams * 9),
    proteinGrams,
    carbsGrams,
    fatGrams,
  };
}
