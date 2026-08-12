import test from "node:test";
import assert from "node:assert/strict";
import { buildMealLogPayload } from "../src/features/dashboard/mealLogPayload.js";

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

test("rejects a recent meal without a valid numeric item id", () => {
  assert.throws(() => buildMealLogPayload({ id: "LUNCH:FOOD:bad", itemType: "FOOD", quantity: 10, unit: "GRAM" }, "LUNCH", "2026-08-12"), /alimento válido/);
});
