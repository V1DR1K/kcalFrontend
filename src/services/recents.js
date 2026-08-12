export function getSavedUser(userKey) {
  try {
    const saved = localStorage.getItem(userKey);
    return saved ? JSON.parse(saved) : null;
  } catch {
    return null;
  }
}
const key = (user) => `scalegrams.recents.${user?.id || "guest"}`;
export function readRecents(user) {
  try {
    const saved = JSON.parse(localStorage.getItem(key(user)) || "{}");
    const items = Array.isArray(saved.items)
      ? saved.items.filter((item) => Number.isInteger(Number(item?.id)) && Number(item.id) > 0).map((item) => ({ ...item, id: Number(item.id) }))
      : [];
    const meals = Array.isArray(saved.meals)
      ? saved.meals.filter((meal) => Number.isInteger(Number(meal?.itemId)) && Number(meal.itemId) > 0).map((meal) => ({ ...meal, itemId: Number(meal.itemId) }))
      : [];
    return { items, meals };
  } catch {
    return { items: [], meals: [] };
  }
}
function write(user, value) { localStorage.setItem(key(user), JSON.stringify(value)); }
export function rememberItem(user, item) { const value = readRecents(user); const id = `${item.type}:${item.id}`; value.items = [item, ...value.items.filter((saved) => `${saved.type}:${saved.id}` !== id)].slice(0, 20); write(user, value); }
export function rememberMeal(user, mealType, log) {
  const value = readRecents(user); const item = log.itemType === "RECIPE" ? log.recipe : log.food;
  const entry = {
    id: `${mealType}:${log.itemType}:${item?.id}:${log.quantity}:${Date.now()}`,
    mealType,
    label: item?.name || "Comida",
    itemType: log.itemType,
    itemId: item?.id ?? log.itemId,
    quantity: log.quantity,
    unit: log.unit,
    calories: log.calories,
    proteinGrams: log.proteinGrams,
    carbsGrams: log.carbsGrams,
    fatGrams: log.fatGrams,
    imageUrl: item?.imageUrl,
    category: item?.category,
    lastUsedAt: new Date().toISOString(),
  };
  value.meals = [entry, ...value.meals.filter((saved) => saved.itemId !== entry.itemId || saved.itemType !== entry.itemType)].slice(0, 10); write(user, value);
}
