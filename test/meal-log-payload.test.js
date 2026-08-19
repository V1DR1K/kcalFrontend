import test from "node:test";
import assert from "node:assert/strict";
import { buildMealLogPayload, normalizeMealLogReference } from "../src/features/dashboard/mealLogPayload.js";

test("uses the numeric itemId from a recent meal instead of its visual id", () => {
  assert.deepEqual(buildMealLogPayload({
    id: "DINNER:FOOD:43:10:1786537556471",
    itemType: "FOOD",
    itemId: 43,
    quantity: 10,
    unit: "GRAM",
  }, "DINNER", "2026-08-12"), {
    itemType: "FOOD",
    itemId: 43,
    mealType: "DINNER",
    quantity: 10,
    unit: "GRAM",
    logDate: "2026-08-12",
  });
});

test("falls back to the catalog item id for copied backend logs", () => {
  assert.equal(buildMealLogPayload({ itemType: "RECIPE", recipe: { id: 9 }, quantity: 2, unit: "PORTION" }, "LUNCH", "2026-08-12").itemId, 9);
});

test("normalizes dashboard food references and applies the destination meal and date", () => {
  assert.deepEqual(normalizeMealLogReference({
    itemType: "FOOD",
    food: { id: 43 },
    quantity: "150",
    unit: "GRAM",
    mealType: "BREAKFAST",
    logDate: "2026-08-11",
  }, "DINNER", "2026-08-12"), {
    itemType: "FOOD",
    itemId: 43,
    mealType: "DINNER",
    quantity: 150,
    unit: "GRAM",
    logDate: "2026-08-12",
  });
});

test("normalizes recipe references and rejects photo estimates", () => {
  assert.equal(normalizeMealLogReference({ type: "RECIPE", recipe: { id: 9 }, quantity: 1 }, "LUNCH", "2026-08-12").itemId, 9);
  assert.throws(() => normalizeMealLogReference({ itemType: "AI_ESTIMATE", quantity: 1 }, "LUNCH", "2026-08-12"), /reutilizar/);
});

test("rejects a recent meal without a valid numeric item id", () => {
  assert.throws(() => buildMealLogPayload({ id: "LUNCH:FOOD:bad", itemType: "FOOD", quantity: 10, unit: "GRAM" }, "LUNCH", "2026-08-12"), /alimento válido/);
});
