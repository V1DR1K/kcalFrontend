export function recipeIngredientCount(recipe) {
  if (Number.isInteger(recipe?.ingredientCount) && recipe.ingredientCount >= 0) return recipe.ingredientCount;
  return recipe?.ingredients?.length ? recipe.ingredients.length : null;
}

export function recipeIngredientLabel(recipe) {
  const count = recipeIngredientCount(recipe);
  return count == null ? "Ver ingredientes" : `${count} ${count === 1 ? "ingrediente" : "ingredientes"}`;
}
