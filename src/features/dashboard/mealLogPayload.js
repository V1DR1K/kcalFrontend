const ITEM_TYPES = new Set(["FOOD", "RECIPE"]);
const MEAL_TYPES = new Set(["BREAKFAST", "LUNCH", "AFTERNOON_SNACK", "DINNER"]);
const UNITS = new Set(["GRAM", "MILLILITER", "UNIT", "PORTION"]);

export function buildMealLogPayload(log, mealType, logDate) {
  const itemType = log?.itemType || log?.type;
  const rawItemId = log?.itemId ?? (itemType === "RECIPE" ? log?.recipe?.id : log?.food?.id);
  const itemId = Number(rawItemId);
  const quantity = Number(log?.quantity);
  const unit = log?.unit || (itemType === "RECIPE" ? "PORTION" : "GRAM");

  if (!ITEM_TYPES.has(itemType)) throw new Error("Solo se pueden reutilizar alimentos o recetas guardados.");
  if (!Number.isInteger(itemId) || itemId <= 0) throw new Error("La comida reciente no tiene un alimento válido.");
  if (!MEAL_TYPES.has(mealType)) throw new Error("La comida seleccionada no es válida.");
  if (!Number.isFinite(quantity) || quantity <= 0) throw new Error("La cantidad guardada no es válida.");
  if (!UNITS.has(unit)) throw new Error("La unidad guardada no es válida.");

  return { itemType, itemId, mealType, quantity, unit, logDate };
}
