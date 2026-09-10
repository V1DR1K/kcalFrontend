import { decimalNumber } from "../../utils/decimal.js";

export function isSpecificPresetImage(imageUrl) {
  const normalized = String(imageUrl || "").trim();
  return Boolean(normalized) && !/(^|\/)category-assets\//i.test(normalized);
}

function resolvedItemImage(item, resolvedItem) {
  const resolvedIngredientImage = resolvedItem?.ingredients?.map((ingredient) => ingredient?.food?.imageUrl).find(Boolean);
  return resolvedItem?.imageUrl || resolvedIngredientImage || null;
}

export function presetItemCacheKey(item) {
  const itemType = item?.itemType || item?.type || "FOOD";
  const itemId = item?.itemId || item?.id;
  return itemId ? `${itemType}:${itemId}` : null;
}

export function presetItemNeedsImageHydration(item) {
  const itemType = item?.itemType || item?.type || "FOOD";
  return ["FOOD", "RECIPE"].includes(itemType) && Boolean(presetItemCacheKey(item))
    && !isSpecificPresetImage(item?.imageUrl || item?.food?.imageUrl || item?.recipe?.imageUrl);
}

export function normalizePresetPreviewItem(item, resolvedItem) {
  const itemType = item?.itemType || item?.type || "FOOD";
  const savedImage = item?.imageUrl || item?.food?.imageUrl || item?.recipe?.imageUrl || null;
  const currentImage = resolvedItemImage(item, resolvedItem);
  return {
    ...item,
    id: item?.itemId || item?.id,
    type: itemType,
    name: item?.displayName || item?.name || item?.food?.name || item?.recipe?.name || "Alimento",
    imageUrl: isSpecificPresetImage(savedImage) ? savedImage : currentImage || savedImage,
    category: item?.category || item?.food?.category || resolvedItem?.category || "OTHER",
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
