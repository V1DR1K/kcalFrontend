import test from "node:test";
import assert from "node:assert/strict";
import { parseNutritionTable } from "../src/services/nutritionOcr.js";

test("extracts kcal and all macros from a typical Argentine label", () => {
  assert.deepEqual(
    parseNutritionTable(`Valor energético 840 kJ / 200 kcal
Carbohidratos 24,5 g
Proteínas 6,2 g
Grasas totales 8,1 g
Grasas saturadas 3,0 g`),
    { calories: 200, proteinGrams: 6.2, carbsGrams: 24.5, fatGrams: 8.1 },
  );
});

test("extracts values split onto the next OCR line and accepts common synonyms", () => {
  assert.deepEqual(
    parseNutritionTable(`Energía
155 kcal
Hidratos de carbono
18 g
Proteina
4.5 gr
Lípidos totales
7 g`),
    { calories: 155, proteinGrams: 4.5, carbsGrams: 18, fatGrams: 7 },
  );
});
