import test from "node:test";
import assert from "node:assert/strict";
import { mealTotals } from "../src/features/dashboard/nutritionTotals.js";
import { aiEstimateDraft, sortMealLogs, sortRecipeIngredients } from "../src/features/dashboard/dashboard.utils.js";

test("suma los totales nutricionales de un preset", () => {
  assert.deepEqual(mealTotals([
    { calories: 420, proteinGrams: 35.5, carbsGrams: 48, fatGrams: 12 },
    { calories: 180, proteinGrams: 10, carbsGrams: 22.5, fatGrams: 6 },
  ]), { calories: 600, proteinGrams: 45.5, carbsGrams: 70.5, fatGrams: 18 });
});

test("preserves catalog matching metadata when refining an AI estimate", () => {
  const draft = aiEstimateDraft({
    name: "Plato estimado",
    confidence: 85,
    items: [{ name: "Avena", estimatedGrams: 100, proteinGrams: 10, carbsGrams: 20, fatGrams: 5,
      catalogFoodId: 42, catalogMatchType: "EXACT", catalogMatchConfidence: 99 }],
  });
  assert.deepEqual(draft.items[0], {
    name: "Avena",
    estimatedGrams: 100,
    category: "OTHER",
    preparation: "UNSPECIFIED",
    proteinGrams: 10,
    carbsGrams: 20,
    fatGrams: 5,
    nutrients: {},
    catalogFoodId: 42,
    catalogMatchType: "EXACT",
    catalogMatchConfidence: 99,
  });
});

test("ordena registros por nombre, acentos y peso sin mutar la lista original", () => {
  const logs = [
    { id: 1, itemType: "FOOD", quantity: 180, food: { name: "Banana" } },
    { id: 2, itemType: "FOOD", quantity: 90, food: { name: "Avena" } },
    { id: 3, itemType: "FOOD", quantity: 120, food: { name: "áVena" } },
  ];

  assert.deepEqual(sortMealLogs(logs).map((log) => log.id), [2, 3, 1]);
  assert.deepEqual(logs.map((log) => log.id), [1, 2, 3]);
});

test("ordena recetas por peso consumido y sus ingredientes por cantidad", () => {
  const logs = [
    { id: 1, itemType: "RECIPE", quantity: 1, unit: "PORTION", recipe: { name: "Tostada", cookedTotalWeightGrams: 300 } },
    { id: 2, itemType: "RECIPE", quantity: 100, unit: "GRAM", recipe: { name: "Tostada" } },
  ];
  const ingredients = [
    { food: { name: "Zanahoria" }, quantity: 80 },
    { food: { name: "Avena" }, quantity: 150 },
    { food: { name: "avena" }, quantity: 60 },
  ];

  assert.deepEqual(sortMealLogs(logs).map((log) => log.id), [2, 1]);
  assert.deepEqual(sortRecipeIngredients(ingredients).map((ingredient) => `${ingredient.food.name}:${ingredient.quantity}`), ["avena:60", "Avena:150", "Zanahoria:80"]);
});
