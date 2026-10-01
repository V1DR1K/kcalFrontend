import React from "react";
import { formatNumber } from "../utils/format";

const MACROS = [
  ["proteinGrams", "Proteínas", "protein"],
  ["carbsGrams", "Carbohidratos", "carbs"],
  ["fatGrams", "Grasas", "fat"],
];

function amount(nutrition, key, decimals = 0, unit = "") {
  if (nutrition[key] != null) return `${formatNumber(nutrition[key], decimals)}${unit}`;
  const known = nutrition.knownTotals?.[key];
  return known == null ? "Sin dato" : `≥ ${formatNumber(known, decimals)}${unit} (parcial)`;
}

export function NutritionSummary({ nutrition = {}, className = "", size = "compact" }) {
  return (
    <div className={`nutrition-summary nutrition-summary-${size} ${className}`.trim()} aria-label="Información nutricional">
      <span className="nutrition-kcal">
        <small>kcal</small>
        <strong>{amount(nutrition, "calories")}</strong>
      </span>
      {MACROS.map(([key, label, tone]) => (
        <span className={`nutrition-macro nutrition-${tone}`} key={key}>
          <small><abbr title={label}>{key === "proteinGrams" ? "P" : key === "carbsGrams" ? "C" : "G"}</abbr></small>
          <strong>{amount(nutrition, key, 1, " g")}</strong>
        </span>
      ))}
    </div>
  );
}
