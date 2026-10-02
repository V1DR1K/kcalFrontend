import test from "node:test";
import assert from "node:assert/strict";
import { scaleNutrition, sumNutrition, nutritionWarning } from "../src/utils/nutrition.js";
test("unknown contributions preserve partial totals while zero remains valid", () => {
 const known = { calories: 100, proteinGrams: 10, carbsGrams: 0, fatGrams: 0 };
 const partial = sumNutrition([known, { calories: null, proteinGrams: null, carbsGrams: 0, fatGrams: 0 }]);
 assert.equal(partial.calories, null); assert.equal(partial.knownTotals.calories, 100);
 assert.equal(scaleNutrition(partial, 0.5).knownTotals.calories, 50); assert.equal(partial.carbsGrams, 0);
 assert.match(nutritionWarning(partial), /incompleta/);
 assert.equal(nutritionWarning({ ...known, calories: 0, proteinGrams: 0, category: "OTHER" }), "");
 assert.match(nutritionWarning({ ...known, calories: 0, proteinGrams: 0, category: "PROTEIN" }), /verificar/);
});

test("legacy object nutrients do not crash an AI preview", () => {
  const result = scaleNutrition({calories:100,proteinGrams:10,carbsGrams:0,fatGrams:2,nutrients:{IRON:1}}, 0.5);
  assert.equal(result.calories,50); assert.equal(result.knownTotals.proteinGrams,5);
});
