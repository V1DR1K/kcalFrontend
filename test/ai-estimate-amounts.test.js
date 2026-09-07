import test from "node:test";
import assert from "node:assert/strict";
import { resizeAiEstimateItem } from "../src/features/dashboard/aiEstimateAmounts.js";

const item = { estimatedGrams: 100, proteinGrams: 20, carbsGrams: 10, fatGrams: 5, nutrients: { sodium: 30 } };
test("AI serving edits scale macros and micronutrients without changing the original", () => {
  const resized = resizeAiEstimateItem(item, "250");
  assert.equal(resized.proteinGrams, 50);
  assert.equal(resized.fatGrams, 12.5);
  assert.equal(resized.nutrients.sodium, 75);
  assert.equal(item.proteinGrams, 20);
});
test("clearing and retyping comma decimals preserves nutritional density", () => {
  const resized = resizeAiEstimateItem(resizeAiEstimateItem(item, ""), "42,5");
  assert.equal(resized.proteinGrams, 8.5);
  assert.equal(resized.estimatedGrams, "42.5");
  assert.equal(resizeAiEstimateItem(resized, "100").proteinGrams, 20);
});
