import { scaleNutrition } from "../../utils/nutrition.js";
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
  return scaleNutrition(food, baseQuantity > 0 ? Number(quantity) / baseQuantity : 0);
}
export function scaleRecipeNutrition(recipe, quantity) {
  const weight = Number(recipe?.cookedTotalWeightGrams || recipe?.rawTotalWeightGrams || recipe?.totalWeightGrams || 0);
  return scaleNutrition(recipe, weight > 0 ? Number(quantity) / weight : 0);
}
