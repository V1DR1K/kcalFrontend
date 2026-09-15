import { preparationLabel } from "../catalog/catalog.utils.js";

const recipeItemCollator = new Intl.Collator("es-AR", { sensitivity: "base", numeric: true });

export function sortRecipeIngredients(ingredients = []) {
  return ingredients
    .map((ingredient, index) => ({ ingredient, index }))
    .sort((left, right) => (
      recipeItemCollator.compare(left.ingredient.food?.name || "Alimento", right.ingredient.food?.name || "Alimento")
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
