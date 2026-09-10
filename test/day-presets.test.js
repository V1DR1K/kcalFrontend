import test from "node:test";
import assert from "node:assert/strict";
import { normalizePresetPreviewItem, scalePresetNutrition, serializablePresetItem } from "../src/features/day-presets/day-preset.utils.js";

test("normaliza fotos y metadatos por item en la preview del día", () => {
  const item = normalizePresetPreviewItem({ itemType: "FOOD", itemId: 12, displayName: "Pollo", imageUrl: "/uploads/pollo.webp", category: "MEAT" });
  assert.deepEqual({ id: item.id, type: item.type, name: item.name, imageUrl: item.imageUrl, category: item.category }, { id: 12, type: "FOOD", name: "Pollo", imageUrl: "/uploads/pollo.webp", category: "MEAT" });
});

test("la preview usa la imagen anidada si el preset antiguo no la guardó", () => {
  const item = normalizePresetPreviewItem({ itemType: "FOOD", itemId: 12, food: { name: "Pollo", imageUrl: "/uploads/pollo.webp", category: "MEAT" } });
  assert.equal(item.imageUrl, "/uploads/pollo.webp");
  assert.equal(item.category, "MEAT");
});

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
