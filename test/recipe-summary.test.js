import { test } from "node:test";
import assert from "node:assert/strict";
import { recipeIngredientLabel } from "../src/utils/recipe-summary.js";
test("recipe summaries use the declared count without treating unloaded ingredients as zero", () => {
  assert.equal(recipeIngredientLabel({ ingredientCount: 3, ingredients: [] }), "3 ingredientes");
  assert.equal(recipeIngredientLabel({ ingredients: [] }), "Ver ingredientes");
  assert.equal(recipeIngredientLabel({ ingredientCount: 0 }), "0 ingredientes");
  assert.equal(recipeIngredientLabel({ ingredients: [{}] }), "1 ingrediente");
});
