import Tesseract from "tesseract.js";

export async function recognizeNutrition(image) {
  const { data } = await Tesseract.recognize(image, "spa", {
    logger: () => {},
  });
  return parseNutritionTable(data.text);
}

export function parseNutritionTable(text) {
  const result = {};
  const lines = text.split("\n").filter(Boolean);

  for (const line of lines) {
    const kcal = extractValue(line, /(?:valor\s*energ[ée]tico|energ[íi]a|calor[íi]as?)[^0-9]*(\d[\d.,]*)\s*kcal/i);
    if (kcal != null) result.calories = kcal;

    const protein = extractValue(line, /prote[íi]nas?[^0-9]*(\d[\d.,]*)\s*g/i);
    if (protein != null) result.proteinGrams = protein;

    const carbs = extractValue(line, /(?:hidratos?\s*de\s*carbono|carbohidratos?|carbohidratos?|hc\s*totales?|hidratos?\s*totales?)[^0-9]*(\d[\d.,]*)\s*g/i);
    if (carbs != null) result.carbsGrams = carbs;

    const fat = extractValue(line, /(?:grasas?\s*totales?|grasas?|grasa)[^0-9]*(\d[\d.,]*)\s*g/i);
    if (fat != null) result.fatGrams = fat;

    if (result.calories != null && result.proteinGrams != null && result.carbsGrams != null && result.fatGrams != null) break;
  }

  return result;
}

function extractValue(text, regex) {
  const match = text.match(regex);
  if (!match) return null;
  const num = parseFloat(match[1].replace(",", "."));
  return isNaN(num) ? null : num;
}
