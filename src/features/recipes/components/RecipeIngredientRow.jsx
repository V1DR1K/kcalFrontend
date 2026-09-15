import React from "react";
import { Icon } from "../../../components/Icon";
import { NutritionSummary } from "../../../components/NutritionSummary";
import { decimalNumber, normalizeDecimalInput } from "../../../utils/decimal";
import { formatNumber, formatQuantity } from "../../../utils/format";
import { foodPreparationSuffix, scaleFoodNutrition } from "../recipe.utils";
import { FoodThumb } from "../../catalog/CatalogComponents";

export function RecipeIngredientRow({ ingredient, index, locked = false, onChange, onRemove }) {
  const food = ingredient?.food || ingredient || {};
  const name = ingredient?.name || food.name || "Alimento";
  const nutrition = scaleFoodNutrition(food, decimalNumber(ingredient?.quantity));
  const secondaryLabel = foodPreparationSuffix(food) || "Ingrediente de la receta";

  return (
    <div className={`daily-recipe-ingredient ${onRemove ? "recipe-editor-ingredient" : ""}`.trim()}>
      <FoodThumb item={{ ...food, type: "FOOD" }} compact />
      <div className="daily-recipe-ingredient-copy">
        <strong>{name}</strong>
        <small>{secondaryLabel}</small>
        {onRemove && <NutritionSummary nutrition={nutrition} />}
      </div>
      <div className="daily-recipe-ingredient-meta">
        {locked ? (
          <span className="daily-recipe-ingredient-quantity"><strong>{formatQuantity(ingredient?.quantity)}</strong><small>g</small></span>
        ) : (
          <label className="daily-recipe-ingredient-quantity">
            <span className="sr-only">Cantidad de {name} en gramos</span>
            <input
              aria-label={`Cantidad de ${name} en gramos`}
              type="text"
              inputMode="decimal"
              min="0.1"
              step="0.01"
              value={ingredient?.quantity ?? ""}
              onFocus={(event) => event.currentTarget.select()}
              onPointerUp={(event) => { event.preventDefault(); event.currentTarget.select(); }}
              onKeyDown={(event) => { if (["e", "E", "+", "-"].includes(event.key)) event.preventDefault(); }}
              onChange={(event) => onChange?.(index, normalizeDecimalInput(event.target.value))}
            />
            <small>g</small>
          </label>
        )}
        <span className="daily-recipe-ingredient-kcal">{formatNumber(nutrition.calories)} kcal</span>
        {onRemove && (
          <button type="button" className="ingredient-remove recipe-ingredient-remove" onClick={() => onRemove(index)}>
            <Icon name="delete" /><span>Quitar</span>
          </button>
        )}
      </div>
    </div>
  );
}
