import React, { useId, useState } from "react";
import { Icon } from "../../../components/Icon";
import { Input } from "../../../components/FormControls";
import { ModalShell } from "../../../components/dialog/ModalShell";
import { FoodThumb } from "../../catalog/CatalogComponents";
import { formatNumber } from "../../../utils/format";

export function EditRecipeModal({ api, recipe, onClose, onDone }) {
  const titleId = `${useId().replace(/:/g, "")}-title`;
  const [name, setName] = useState(recipe.name || "");
  const [description, setDescription] = useState(recipe.description || "");
  const [ingredients, setIngredients] = useState(() => (recipe.ingredients || []).map((item) => ({
    foodId: item.food?.id,
    name: item.food?.name,
    quantity: item.quantity,
    unit: item.unit || "GRAM",
  })).filter((item) => item.foodId));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const totalWeight = ingredients.reduce((total, item) => total + (Number(item.quantity) || 0), 0);
  async function submit(event) {
    event.preventDefault();
    setError("");
    if (!name.trim()) return setError("Pone un nombre para la receta.");
    if (!ingredients.length) return setError("La receta necesita al menos un ingrediente.");
    if (ingredients.some((item) => !Number.isFinite(Number(item.quantity)) || Number(item.quantity) <= 0)) return setError("Cada ingrediente debe tener una cantidad mayor a cero.");
    setSaving(true);
    try {
      await api.runAction(
        { title: "Guardando receta", description: "Estamos actualizando los ingredientes..." },
        () => api.request(`/api/recipes/${recipe.id}`, {
          method: "PUT",
          body: JSON.stringify({
            name: name.trim(),
            description: description.trim(),
            totalWeightGrams: totalWeight,
            ingredients: ingredients.map((item) => ({ foodId: item.foodId, quantity: Number(item.quantity), unit: item.unit })),
          }),
        }, { quiet: true }),
      );
      api.notify("Receta actualizada.");
      onDone();
    } catch (requestError) {
      const fieldDetails = Object.values(requestError.fields || {}).join(" ");
      const message = fieldDetails || requestError.message || "No se pudo actualizar la receta.";
      setError(message);
      api.notify(message, "error");
    } finally {
      setSaving(false);
    }
  }
  return (
    <ModalShell as="form" onClose={onClose} hideHeader labelledBy={titleId} className="app-modal-compact edit-food-sheet edit-recipe-sheet" backdropClassName="edit-food-backdrop" wrapContent={false} dialogProps={{ onSubmit: submit }}>
        <header>
          <div>
            <span>Editar receta</span>
            <h2 id={titleId}>{recipe.name}</h2>
          </div>
          <button type="button" className="icon-button" aria-label="Cerrar" onClick={onClose}>
            <Icon name="close" />
          </button>
        </header>
         <div className="edit-food-fields" data-dialog-scroll-owner="true">
          {error && <div className="form-error recipe-error" role="alert"><Icon name="error" /><span>{error}</span></div>}
          <Input label="Nombre" value={name} onChange={(event) => setName(event.target.value)} required />
          <Input label="Descripción opcional" value={description} onChange={(event) => setDescription(event.target.value)} />
          <div className="recipe-weight-summary"><Icon name="scale" /><div><small>Peso total calculado</small><strong>{formatNumber(totalWeight, 1)} g</strong></div></div>
          <div className="ingredient-list">
            {ingredients.map((item, index) => (
              <label className="ingredient-row" key={`${item.foodId}:${index}`}>
                <span className="ingredient-name">{item.name}</span>
                <span className="ingredient-quantity">
                  <input aria-label={`Cantidad de ${item.name} en gramos`} type="text" inputMode="decimal" min="0.1" step="0.1" value={item.quantity} onFocus={(event) => event.currentTarget.select()} onPointerUp={(event) => { event.preventDefault(); event.currentTarget.select(); }} onKeyDown={(event) => { if (["e", "E", "+", "-"].includes(event.key)) event.preventDefault(); }} onInput={(event) => { event.currentTarget.value = event.currentTarget.value.replace(",", ".").replace(/[^\d.]/g, ""); }} onChange={(event) => setIngredients(ingredients.map((ingredient, i) => (i === index ? { ...ingredient, quantity: event.target.value } : ingredient)))} />
                  <small>g</small>
                </span>
                <button type="button" className="ingredient-remove" onClick={() => setIngredients(ingredients.filter((_, i) => i !== index))}>
                  <Icon name="remove" />Quitar
                </button>
              </label>
            ))}
          </div>
        </div>
        <footer className="edit-food-actions">
          <button className="primary" disabled={saving || totalWeight <= 0}>{saving ? "Guardando..." : "Guardar cambios"}</button>
        </footer>
  </ModalShell>
  );
}


export function FoodLogDialog({ item, eyebrow, title = item?.name, isRecipe = false, closing = false, onClose, onSubmit, children, footer, titleId = "food-log-title" }) {
  const generatedTitleId = `${useId().replace(/:/g, "")}-title`;
  const resolvedTitleId = titleId === "food-log-title" ? generatedTitleId : titleId;
  return (
    <ModalShell as="form" onClose={onClose} hideHeader labelledBy={resolvedTitleId} className={`app-modal-compact edit-log-modal ${isRecipe ? "recipe-log-modal" : ""} ${closing ? "closing" : ""}`} backdropClassName="modal-backdrop compact-modal" wrapContent={false} dialogProps={{ onSubmit }}>
        <header className="edit-log-header">
          <FoodThumb item={isRecipe ? { ...item, type: "RECIPE" } : item} compact />
          <div className="edit-log-identity">
            <span>{eyebrow}</span>
          <h2 id={resolvedTitleId}>{title}</h2>
          </div>
          <button type="button" className="icon-button" onClick={onClose} aria-label="Cerrar">
            <Icon name="close" />
          </button>
        </header>
         <div className="edit-log-body" data-dialog-scroll-owner="true">{children}</div>
        {footer}
  </ModalShell>
  );
}
