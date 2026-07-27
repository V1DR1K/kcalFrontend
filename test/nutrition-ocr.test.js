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

test("extracts the serving weight to preserve the label's nutrition basis", () => {
  assert.deepEqual(
    parseNutritionTable(`Información nutricional
Tamaño de la porción: 1 unidad (70 g)
Valor energético 200 kcal
Carbohidratos 24,5 g
Proteínas 6,2 g
Grasas totales 8,1 g`),
    { baseQuantity: 70, calories: 200, proteinGrams: 6.2, carbsGrams: 24.5, fatGrams: 8.1 },
  );
});

test("uses 100 g when the label explicitly declares that basis", () => {
  assert.deepEqual(
    parseNutritionTable(`Información nutricional por 100 g
Proteínas 8 g
Carbohidratos 12 g
Grasas totales 4 g`),
    { baseQuantity: 100, proteinGrams: 8, carbsGrams: 12, fatGrams: 4 },
  );
});

test("requires confirmation when the label contains serving and per-100-gram columns", () => {
  assert.deepEqual(
    parseNutritionTable(`Porción: 70 g
Información nutricional por 100 g
Proteínas 8 g
Carbohidratos 12 g
Grasas totales 4 g`),
    { basisAmbiguous: true, proteinGrams: 8, carbsGrams: 12, fatGrams: 4 },
  );
});

test("does not take a nutrient value from the following row", () => {
  assert.deepEqual(
    parseNutritionTable(`Proteínas
Carbohidratos 18 g
Grasas totales 7 g`),
    { carbsGrams: 18, fatGrams: 7 },
  );
});
