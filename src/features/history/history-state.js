export function nutritionDayState(day) {
  if (day?.recordState) return day.recordState;
  return Number(day?.recordCount || 0) > 0 || Number(day?.caloriesConsumed || 0) > 0 ? "COMPLETE" : "NONE";
}
export function nutritionDayHasActivity(day) { return nutritionDayState(day) !== "NONE"; }
export function historyDayLabel(day, today) {
  if (day.date > today) return nutritionDayHasActivity(day) ? "Futuro, con registros" : "Futuro";
  if (!nutritionDayHasActivity(day)) return "Sin registros";
  if (day.energyComplete === false) return "Calorías incompletas";
  if (nutritionDayState(day) === "PARTIAL") return "Nutrición incompleta";
  return day.goalReached ? "Registrado, dentro de la meta" : "Registrado";
}
