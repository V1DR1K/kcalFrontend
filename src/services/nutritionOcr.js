import Tesseract from "tesseract.js";

export async function recognizeNutrition(image) {
  const { data } = await Tesseract.recognize(image, "spa", {
    workerPath: "/tessdata/worker.min.js",
    corePath: "/tessdata/tesseract-core-simd-lstm.wasm.js",
    langPath: "/tessdata",
    gzip: true,
    logger: () => {},
  });
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
    ...findNutritionBasis(windows),
    ...findField(windows, "calories", [/(?:valor\s*energetico|energia|calorias?)/i], "kcal"),
    ...findField(windows, "proteinGrams", [/proteinas?(?:\s*totales?)?/i], "g"),
    ...findField(windows, "carbsGrams", [/(?:carbohidratos?|hidratos?\s*de\s*carbono|hc)(?:\s*totales?)?/i], "g"),
    ...findField(windows, "fatGrams", [/(?:grasas?\s*totales?|lipidos?\s*totales?)/i, /(?:grasas?|lipidos?)(?!\s*saturad)/i], "g"),
  };
}

function findNutritionBasis(windows) {
  const servingGrams = findServingGrams(windows);
  const hasPerHundredGrams = windows.some((text) => /(?:por|cada)\s*100\s*(?:g|gr|gramos?)\b/i.test(text));
  if (hasPerHundredGrams && servingGrams != null) return { basisAmbiguous: true };
  if (hasPerHundredGrams) return { baseQuantity: 100 };
  return servingGrams != null ? { baseQuantity: servingGrams } : {};
}

function findServingGrams(windows) {
  const servingLabel = /(?:tamano\s+(?:de\s+(?:la\s+)?|por\s+)?porcion|porcion|serving\s+size)/i;
  for (const text of windows) {
    const labelMatch = text.match(servingLabel);
    if (!labelMatch) continue;
    const tail = text.slice(labelMatch.index + labelMatch[0].length, labelMatch.index + labelMatch[0].length + 50);
    const valueMatch = tail.match(/(\d[\d.,]*)\s*(?:g|gr|gramos?)\b/i);
    const value = valueMatch ? parseNumber(valueMatch[1]) : null;
    if (value != null && value > 0) return value;
  }
  return null;
}

function findField(windows, key, labels, unit) {
  for (const label of labels) {
    for (const text of windows) {
      const labelMatch = text.match(label);
      if (!labelMatch) continue;
      const tail = text.slice(labelMatch.index + labelMatch[0].length, labelMatch.index + labelMatch[0].length + 70);
      const unitPattern = unit === "kcal" ? /(\d[\d.,]*)\s*k\s*cal\b/i : /(\d[\d.,]*)\s*(?:g|gr|gramos?)\b/i;
      const valueMatch = tail.match(unitPattern);
      const nextNutrient = tail.search(/(?:valor\s*energetico|energia|calorias?|proteinas?|carbohidratos?|hidratos?\s*de\s*carbono|grasas?|lipidos?)/i);
      if (nextNutrient >= 0 && (!valueMatch || nextNutrient < valueMatch.index)) continue;
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
