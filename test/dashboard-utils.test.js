import test from "node:test";
import assert from "node:assert/strict";
import { mealTotals } from "../src/features/dashboard/nutritionTotals.js";

test("suma los totales nutricionales de un preset", () => {
  assert.deepEqual(mealTotals([
    { calories: 420, proteinGrams: 35.5, carbsGrams: 48, fatGrams: 12 },
    { calories: 180, proteinGrams: 10, carbsGrams: 22.5, fatGrams: 6 },
  ]), { calories: 600, proteinGrams: 45.5, carbsGrams: 70.5, fatGrams: 18 });
});
