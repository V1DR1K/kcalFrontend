import React from "react";
import { formatNumber } from "../utils/format";

const MACROS = [
  ["proteinGrams", "P", "protein"],
  ["carbsGrams", "C", "carbs"],
  ["fatGrams", "G", "fat"],
];

export function NutritionSummary({ nutrition = {}, className = "", size = "compact" }) {
  return (
    <div className={`nutrition-summary nutrition-summary-${size} ${className}`.trim()} aria-label="Información nutricional">
      <span className="nutrition-kcal">
        <small>Kcal</small>
        <strong>{formatNumber(nutrition.calories)}</strong>
      </span>
      {MACROS.map(([key, label, tone]) => (
        <span className={`nutrition-macro nutrition-${tone}`} key={key}>
          <small>{label}</small>
          <strong>{formatNumber(nutrition[key], 1)}g</strong>
        </span>
      ))}
    </div>
  );
}
