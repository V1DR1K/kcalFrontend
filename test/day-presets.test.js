import test from "node:test";
import assert from "node:assert/strict";
import { scalePresetNutrition, serializablePresetItem } from "../src/features/day-presets/day-preset.utils.js";

test("escala nutrición al cambiar cantidad sin perder el item", () => {
  const next = scalePresetNutrition({ itemType: "FOOD", itemId: 7, quantity: 100, calories: 200, proteinGrams: 20, carbsGrams: 10, fatGrams: 5 }, "150");
  assert.equal(next.quantity, "150");
  assert.equal(next.calories, 300);
  assert.equal(next.proteinGrams, 30);
  assert.equal(next.itemId, 7);
});

test("serializa el item completo para guardar el draft", () => {
  const item = serializablePresetItem({ itemType: "FOOD", itemId: 7, mealType: "LUNCH", quantity: "180,5", unit: "GRAM", displayName: "Pollo", imageUrl: "/pollo.webp", calories: 297, proteinGrams: 55, carbsGrams: 0, fatGrams: 7, transient: "no enviar" });
  assert.deepEqual(item, { itemType: "FOOD", itemId: 7, mealType: "LUNCH", quantity: 180.5, unit: "GRAM", displayName: "Pollo", imageUrl: "/pollo.webp", calories: 297, proteinGrams: 55, carbsGrams: 0, fatGrams: 7 });
});
