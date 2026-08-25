import React, { useId, useState } from "react";
import { Icon } from "../../../components/Icon";
import { ModalShell } from "../../../components/dialog/ModalShell";
import { FoodThumb, NutrientDetails } from "../../catalog/CatalogComponents";
import { formatNumber } from "../../../utils/format";

export function RecipeDetailDialog({ api, recipe, onClose }) {
  const [saving, setSaving] = useState(false);
  const titleId = `${useId().replace(/:/g, "")}-title`;
  async function save() {
    if (saving) return;
    setSaving(true);
    try { await api.runAction({ title: "Guardando receta", description: "Estamos creando tu copia personal..." }, () => api.request(`/api/recipes/${recipe.id}/copy`, { method: "POST" }), { quiet: true }); api.notify("Receta guardada en Mis recetas."); onClose(); }
    catch (error) { api.notify(error.message || "No se pudo guardar la receta.", "error"); } finally { setSaving(false); }
  }
  return (
    <ModalShell onClose={onClose} hideHeader labelledBy={titleId} className="app-modal-compact recipe-detail-dialog" backdropClassName="recipe-detail-backdrop" wrapContent={false}>
        <header><FoodThumb item={{ ...recipe, type: "RECIPE" }} compact /><div><span>Receta compartida</span><h2 id={titleId}>{recipe.name}</h2></div><button type="button" className="icon-button" aria-label="Cerrar" onClick={onClose}><Icon name="close" /></button></header>
        <div className="recipe-detail-body">
          {recipe.description && <p className="recipe-detail-description">{recipe.description}</p>}
          <div className="recipe-detail-summary"><span><small>Peso total</small><strong>{formatNumber(recipe.totalWeightGrams, 1)} g</strong></span><span><small>Kcal</small><strong>{formatNumber(recipe.calories)}</strong></span><span><small>Macros</small><strong>P {formatNumber(recipe.proteinGrams, 1)}g</strong></span></div>
          <NutrientDetails nutrients={recipe.nutrients} label="Ver nutrientes de la receta" />
          <div className="recipe-detail-ingredients"><h3>Ingredientes</h3>{recipe.ingredients.map((ingredient, index) => <div key={`${ingredient.food?.id || "food"}:${index}`}><span>{ingredient.food?.name || "Alimento"}</span><small>{formatNumber(ingredient.quantity, 1)} {ingredient.unit === "GRAM" ? "g" : ingredient.unit}</small></div>)}</div>
        </div>
        <footer><button type="button" className="secondary" onClick={onClose}>Cerrar</button><button type="button" className="primary" disabled={saving} onClick={save}><Icon name="content_copy" />{saving ? "Guardando..." : "Guardar receta"}</button></footer>
  </ModalShell>
  );
}
