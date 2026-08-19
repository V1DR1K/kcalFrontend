import test from "node:test";
import assert from "node:assert/strict";
import { macroCalories, normalizeNumericInput, OCR_MACRO_FIELDS } from "../src/features/catalog/utils/catalog.utils.js";

test("calcula calorías a partir de macronutrientes", () => {
  assert.equal(macroCalories(10, 20, 5), 165);
});

test("normaliza valores decimales ingresados desde etiquetas", () => {
  assert.equal(normalizeNumericInput("12,5 g"), "12.5");
  assert.equal(normalizeNumericInput("1.2.3"), "1.23");
});

test("mantiene el contrato de campos OCR", () => {
  assert.deepEqual(OCR_MACRO_FIELDS, ["proteinGrams", "carbsGrams", "fatGrams"]);
});
