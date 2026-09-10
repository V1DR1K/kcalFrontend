import test from "node:test";
import assert from "node:assert/strict";
import { DUPLICATE_PLAN_NAME_ERROR, hasDuplicatePlanName, isDuplicatePlanNameError } from "../src/features/profile/components/plan-name.utils.js";

test("detects active plan names ignoring case and surrounding whitespace", () => {
  assert.equal(hasDuplicatePlanName([{ id: 1, name: "Plan de fuerza" }], "  PLAN DE FUERZA "), true);
});

test("allows the plan being edited to keep its current name", () => {
  assert.equal(hasDuplicatePlanName([{ id: 7, name: "Plan actual" }], "plan actual", 7), false);
});

test("recognizes backend duplicate-name responses", () => {
  assert.equal(isDuplicatePlanNameError({ code: "PLAN_NAME_DUPLICATE" }), true);
  assert.equal(isDuplicatePlanNameError({ fields: { name: DUPLICATE_PLAN_NAME_ERROR } }), true);
});
