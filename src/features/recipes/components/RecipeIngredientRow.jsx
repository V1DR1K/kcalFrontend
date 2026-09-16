import React from "react";
import { Icon } from "../../../components/Icon";
import { NutritionSummary } from "../../../components/NutritionSummary";
import { decimalNumber, normalizeDecimalInput } from "../../../utils/decimal";
import { formatNumber, formatQuantity } from "../../../utils/format";
import { foodPreparationSuffix, scaleFoodNutrition, scaleRecipeNutrition } from "../recipe.utils";
import { FoodThumb } from "../../catalog/CatalogComponents";

export function RecipeIngredientRow({ ingredient, index, locked = false, onChange, onRemove }) {
  const referencedItem = ingredient?.food || ingredient?.recipe || ingredient || {};
  const isRecipe = Boolean(ingredient?.recipe || ingredient?.recipeId || ingredient?.type === "RECIPE");
  const name = ingredient?.name || referencedItem.name || (isRecipe ? "Receta" : "Alimento");
  const nutrition = isRecipe
    ? scaleRecipeNutrition(referencedItem, decimalNumber(ingredient?.quantity))
    : scaleFoodNutrition(referencedItem, decimalNumber(ingredient?.quantity));
  const secondaryLabel = isRecipe ? "Receta usada como ingrediente" : foodPreparationSuffix(referencedItem) || "Ingrediente de la receta";

  return (
    <div className={`daily-recipe-ingredient ${onRemove ? "recipe-editor-ingredient" : ""}`.trim()}>
      <FoodThumb item={{ ...referencedItem, type: isRecipe ? "RECIPE" : "FOOD" }} compact />
      <div className="daily-recipe-ingredient-copy">
        <strong>{name}</strong>
        <small>{secondaryLabel}</small>
        {onRemove && <NutritionSummary nutrition={nutrition} />}
      </div>
      <div className="daily-recipe-ingredient-meta">
        <span className="daily-recipe-ingredient-kcal">{formatNumber(nutrition.calories)} kcal</span>
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
        {onRemove && (
          <button type="button" className="ingredient-remove recipe-ingredient-remove" aria-label="Quitar" title={`Quitar ingrediente ${name}`} onClick={() => onRemove(index)}>
            <Icon name="delete" /><span className="sr-only">Quitar</span>
          </button>
        )}
      </div>
    </div>
  );
}
