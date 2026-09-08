import test from "node:test";
import assert from "node:assert/strict";
import { mealTotals } from "../src/features/dashboard/nutritionTotals.js";
import { aiEstimateDraft } from "../src/features/dashboard/dashboard.utils.js";

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
