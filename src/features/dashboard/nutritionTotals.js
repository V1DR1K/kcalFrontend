export function mealTotals(items) {
  return items.reduce((totals, item) => ({
    calories: totals.calories + Number(item.calories || 0),
    proteinGrams: totals.proteinGrams + Number(item.proteinGrams || 0),
    carbsGrams: totals.carbsGrams + Number(item.carbsGrams || 0),
    fatGrams: totals.fatGrams + Number(item.fatGrams || 0),
  }), { calories: 0, proteinGrams: 0, carbsGrams: 0, fatGrams: 0 });
}
