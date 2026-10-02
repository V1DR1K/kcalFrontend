import { test } from "node:test";
import assert from "node:assert/strict";
import { formatMeasure, formatNutrient } from "../src/utils/format.js";
test("cantidades argentinas distinguen unidades, decimales y datos ausentes", () => {
  assert.equal(formatMeasure(1.25, "PORTION"), "1,25 porciones");
  assert.equal(formatMeasure(1, "PORTION"), "1 porción");
  assert.equal(formatMeasure(250, "MILLILITER"), "250 ml");
  assert.equal(formatMeasure(null), "Sin dato");
  assert.equal(formatNutrient(0, 1, "g"), "0,0 g");
  assert.equal(formatNutrient(null, 1, "g"), "Sin dato");
});
