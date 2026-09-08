import { PREPARATION_OPTIONS } from "../../config/app.js";

export function preparationLabel(preparation) {
  return PREPARATION_OPTIONS.find(({ value }) => value === preparation)?.label || "Sin especificar";
}
