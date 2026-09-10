import { decimalNumber } from "../../utils/decimal.js";

export function normalizePresetPreviewItem(item) {
  const itemType = item?.itemType || item?.type || "FOOD";
  return {
    ...item,
    id: item?.itemId || item?.id,
    type: itemType,
    name: item?.displayName || item?.name || item?.food?.name || item?.recipe?.name || "Alimento",
    imageUrl: item?.imageUrl || item?.food?.imageUrl || item?.recipe?.imageUrl || null,
    category: item?.category || item?.food?.category || "OTHER",
  };
}

export function serializablePresetItem(item) {
  const allowed = ["itemType", "itemId", "mealType", "quantity", "unit", "displayName", "imageUrl", "calories", "proteinGrams", "carbsGrams", "fatGrams", "aiEstimateConfidence", "aiEstimateDetails", "nutrients"];
  return Object.fromEntries(allowed.filter((key) => item[key] !== undefined).map((key) => [key, key === "quantity" ? decimalNumber(item[key]) : item[key]]));
}

export function scalePresetNutrition(item, nextQuantity) {
  const currentQuantity = decimalNumber(item.quantity); const numericQuantity = decimalNumber(nextQuantity);
  if (!currentQuantity || !numericQuantity || currentQuantity <= 0) return { ...item, quantity: nextQuantity };
  const ratio = numericQuantity / currentQuantity;
  return { ...item, quantity: nextQuantity, calories: Math.round(Number(item.calories || 0) * ratio), proteinGrams: Number(item.proteinGrams || 0) * ratio, carbsGrams: Number(item.carbsGrams || 0) * ratio, fatGrams: Number(item.fatGrams || 0) * ratio };
}
