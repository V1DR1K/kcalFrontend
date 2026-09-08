import test from "node:test";
import assert from "node:assert/strict";
import { readRecents, rememberMeal } from "../src/services/recents.js";

function installStorage() {
  const values = new Map();
  globalThis.localStorage = {
    getItem: (key) => values.get(key) || null,
    setItem: (key, value) => values.set(key, String(value)),
  };
}

test("stores and reads AI meals without requiring a catalog item id", () => {
  installStorage();
  const user = { id: 7 };
  rememberMeal(user, "LUNCH", {
    id: 18,
    itemType: "AI_ESTIMATE",
    displayName: "Plato estimado",
    quantity: 1,
    unit: "PORTION",
    calories: 420,
    proteinGrams: 30,
    carbsGrams: 40,
    fatGrams: 12,
    aiEstimateConfidence: 86,
    aiEstimateDetails: '{"items":[]}',
    nutrients: [{ code: "SODIUM", value: 40, source: "AI", status: "ESTIMATED" }],
  });

  const saved = readRecents(user).meals[0];
  assert.equal(saved.itemType, "AI_ESTIMATE");
  assert.equal(saved.itemId, null);
  assert.equal(saved.aiEstimateConfidence, 86);
  assert.deepEqual(saved.nutrients, [{ code: "SODIUM", value: 40, source: "AI", status: "ESTIMATED" }]);
});
