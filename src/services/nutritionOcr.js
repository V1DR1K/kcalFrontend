import Tesseract from "tesseract.js";

export async function recognizeNutrition(image) {
  const { data } = await Tesseract.recognize(image, "spa", { logger: () => {} });
  return parseNutritionTable(data.text);
}

export function parseNutritionTable(text) {
  const lines = String(text || "")
    .split(/\r?\n/)
    .map(cleanLine)
    .filter(Boolean);
  // OCR suele separar la etiqueta y su valor en dos renglones. Cada ventana conserva
  // la fila original y, además, una versión unida con la siguiente.
  const windows = lines.flatMap((line, index) => [line, `${line} ${lines[index + 1] || ""}`]);

  return {
    ...findField(windows, "calories", [/(?:valor\s*energetico|energia|calorias?)/i], "kcal"),
    ...findField(windows, "proteinGrams", [/proteinas?(?:\s*totales?)?/i], "g"),
    ...findField(windows, "carbsGrams", [/(?:carbohidratos?|hidratos?\s*de\s*carbono|hc)(?:\s*totales?)?/i], "g"),
    ...findField(windows, "fatGrams", [/(?:grasas?\s*totales?|lipidos?\s*totales?)/i, /(?:grasas?|lipidos?)(?!\s*saturad)/i], "g"),
  };
}

function findField(windows, key, labels, unit) {
  for (const label of labels) {
    for (const text of windows) {
      const labelMatch = text.match(label);
      if (!labelMatch) continue;
      const tail = text.slice(labelMatch.index + labelMatch[0].length, labelMatch.index + labelMatch[0].length + 70);
      const unitPattern = unit === "kcal" ? /(\d[\d.,]*)\s*k\s*cal\b/i : /(\d[\d.,]*)\s*(?:g|gr|gramos?)?\b/i;
      const valueMatch = tail.match(unitPattern);
      const value = valueMatch ? parseNumber(valueMatch[1]) : null;
      if (value != null) return { [key]: value };
    }
  }
  return {};
}

function cleanLine(value) {
  return value
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/[|;:=]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function parseNumber(value) {
  const normalized = value.replace(/\s/g, "").replace(",", ".");
  const number = Number.parseFloat(normalized);
  return Number.isFinite(number) && number >= 0 ? number : null;
}
