import test from "node:test";
import assert from "node:assert/strict";
import { buildRecipePayload, formatRecipeLogAmount, recipeServingFactor, recipeYieldPercent } from "../src/utils/recipe.js";

test("builds a recipe payload with a measured cooked weight", () => {
  assert.deepEqual(buildRecipePayload({
    name: " Arroz con pollo ",
    description: " Cena ",
    ingredients: [{ foodId: 4, quantity: "150", unit: "GRAM" }],
    cookedTotalWeightGrams: "220",
  }), {
    name: "Arroz con pollo",
    description: "Cena",
    ingredients: [{ foodId: 4, quantity: 150, unit: "GRAM" }],
    cookedTotalWeightGrams: 220,
    clearCookedTotalWeight: false,
  });
});

test("clears an invalidated cooked weight from the recipe payload", () => {
  assert.deepEqual(buildRecipePayload({
    name: "Sopa",
    description: "",
    ingredients: [{ foodId: 7, quantity: 300, unit: "GRAM" }],
    cookedTotalWeightGrams: "",
    clearCookedTotalWeight: true,
  }).cookedTotalWeightGrams, null);
  assert.equal(buildRecipePayload({
    name: "Sopa",
    description: "",
    ingredients: [{ foodId: 7, quantity: 300, unit: "GRAM" }],
    clearCookedTotalWeight: true,
  }).clearCookedTotalWeight, true);
});

test("normalizes comma decimals in recipe payloads", () => {
  assert.deepEqual(buildRecipePayload({
    name: "Salsa",
    description: "",
    ingredients: [{ foodId: 4, quantity: "42,5", unit: "GRAM" }],
    cookedTotalWeightGrams: "84,25",
  }), {
    name: "Salsa",
    description: "",
    ingredients: [{ foodId: 4, quantity: 42.5, unit: "GRAM" }],
    cookedTotalWeightGrams: 84.25,
    clearCookedTotalWeight: false,
  });
});

test("uses cooked recipe weight for gram servings and formats them explicitly", () => {
  const recipe = { rawTotalWeightGrams: 500, cookedTotalWeightGrams: 400 };
  assert.equal(recipeServingFactor(recipe, 100, "GRAM"), 0.25);
  assert.equal(recipeServingFactor(recipe, 2, "PORTION"), 2);
  assert.equal(recipeYieldPercent(recipe), 80);
  assert.equal(formatRecipeLogAmount({ quantity: 125, unit: "GRAM" }), "125 g cocidos");
  assert.equal(formatRecipeLogAmount({ quantity: 2, unit: "PORTION" }), "2 porciones");
});
