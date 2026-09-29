import test from "node:test";
import assert from "node:assert/strict";
import { resizeAiEstimateItem } from "../src/features/dashboard/aiEstimateAmounts.js";
import { aiProposalFood } from "../src/features/dashboard/dashboard.utils.js";

const item = { estimatedGrams: 100, proteinGrams: 20, carbsGrams: 10, fatGrams: 5, nutrients: { sodium: 30 } };
test("AI serving edits scale macros and micronutrients without changing the original", () => {
  const resized = resizeAiEstimateItem(item, "250");
  assert.equal(resized.proteinGrams, 50);
  assert.equal(resized.fatGrams, 12.5);
  assert.equal(resized.nutrients.sodium, 75);
  assert.equal(item.proteinGrams, 20);
});

test("preserves positive sub-gram AI portions when normalizing nutritional density", () => {
  const food = aiProposalFood({ estimatedGrams: 0.5, proteinGrams: 0.1, carbsGrams: 0.2, fatGrams: 0.05, nutrients: { IRON: 0.01 } });

  assert.equal(food.proteinGrams, 20);
  assert.equal(food.carbsGrams, 40);
  assert.equal(food.fatGrams, 10);
  assert.equal(food.nutrients.IRON, 2);
});
test("clearing and retyping comma decimals preserves nutritional density", () => {
  const resized = resizeAiEstimateItem(resizeAiEstimateItem(item, ""), "42,5");
  assert.equal(resized.proteinGrams, 8.5);
  assert.equal(resized.estimatedGrams, "42.5");
  assert.equal(resizeAiEstimateItem(resized, "100").proteinGrams, 20);
});
