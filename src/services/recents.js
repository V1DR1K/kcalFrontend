export function getSavedUser(userKey) { const saved = localStorage.getItem(userKey); return saved ? JSON.parse(saved) : null; }
const key = (user) => `kazaFitness.recents.${user?.id || "guest"}`;
export function readRecents(user) { try { return JSON.parse(localStorage.getItem(key(user))) || { items: [], meals: [] }; } catch { return { items: [], meals: [] }; } }
function write(user, value) { localStorage.setItem(key(user), JSON.stringify(value)); }
export function rememberItem(user, item) { const value = readRecents(user); const id = `${item.type}:${item.id}`; value.items = [item, ...value.items.filter((saved) => `${saved.type}:${saved.id}` !== id)].slice(0, 20); write(user, value); }
export function rememberMeal(user, mealType, log) {
  const value = readRecents(user); const item = log.itemType === "RECIPE" ? log.recipe : log.food;
  const entry = { id: `${mealType}:${log.itemType}:${item?.id}:${log.quantity}:${Date.now()}`, mealType, label: item?.name || "Comida", itemType: log.itemType, itemId: item?.id, quantity: log.quantity, unit: log.unit, lastUsedAt: new Date().toISOString() };
  value.meals = [entry, ...value.meals.filter((saved) => saved.itemId !== entry.itemId || saved.itemType !== entry.itemType)].slice(0, 10); write(user, value);
}
