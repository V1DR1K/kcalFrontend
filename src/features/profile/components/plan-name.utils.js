export const DUPLICATE_PLAN_NAME_ERROR = "Ya existe un plan con ese nombre.";

export function normalizedPlanName(value) {
  return String(value || "").trim().toLocaleLowerCase();
}

export function hasDuplicatePlanName(plans, name, editingId = null) {
  const normalized = normalizedPlanName(name);
  if (!normalized) return false;
  return (plans || []).some((plan) => plan.id !== editingId && normalizedPlanName(plan.name) === normalized);
}

export function isDuplicatePlanNameError(error) {
  const code = String(error?.code || "").toUpperCase();
  const message = String(error?.message || "").toLocaleLowerCase();
  return Boolean(error?.fields?.name)
    || ["PLAN_NAME_DUPLICATE", "DUPLICATE_PLAN_NAME"].includes(code)
    || message.includes("plan con ese nombre");
}
