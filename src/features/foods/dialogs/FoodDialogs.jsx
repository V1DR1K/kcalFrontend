import React, { useEffect, useId, useState } from "react";
import { Icon } from "../../../components/Icon";
import { Input } from "../../../components/FormControls";
import { ModalShell } from "../../../components/dialog/ModalShell";
import { CatalogRowWithImage, FoodThumb } from "../../catalog/CatalogComponents";
import { usePagedCatalog } from "../../catalog/usePagedCatalog";
import { NutritionSummary } from "../../../components/NutritionSummary";
import { formatNumber, formatQuantity } from "../../../utils/format";
import { buildRecipePayload, recipeYieldPercent } from "../../../utils/recipe";
import { decimalNumber, normalizeDecimalInput } from "../../../utils/decimal";

export function EditRecipeModal({ api, recipe, onClose, onDone }) {
  const titleId = `${useId().replace(/:/g, "")}-title`;
  const [name, setName] = useState(recipe.name || "");
  const [description, setDescription] = useState(recipe.description || "");
  const [ingredientQuery, setIngredientQuery] = useState("");
  const [nutritionPreview, setNutritionPreview] = useState(null);
  const [ingredients, setIngredients] = useState(() => (recipe.ingredients || []).map((item) => ({
    foodId: item.food?.id,
    name: item.food?.name,
    quantity: item.quantity,
    unit: item.unit || "GRAM",
  })).filter((item) => item.foodId));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [trackCookedWeight, setTrackCookedWeight] = useState(() => Number(recipe.cookedTotalWeightGrams) > 0);
  const [cookedWeight, setCookedWeight] = useState(() => recipe.cookedTotalWeightGrams == null ? "" : String(recipe.cookedTotalWeightGrams));
  const [cookedWeightCleared, setCookedWeightCleared] = useState(false);
  const foodCatalog = usePagedCatalog({ api, endpoint: "/api/foods", query: ingredientQuery, pageSize: 10, enabled: ingredientQuery.trim().length >= 2 });
  const totalWeight = ingredients.reduce((total, item) => total + (decimalNumber(item.quantity) || 0), 0);
  const yieldPercent = recipeYieldPercent({ rawTotalWeightGrams: totalWeight, cookedTotalWeightGrams: cookedWeight });
  useEffect(() => {
    if (!ingredients.length || totalWeight <= 0) return setNutritionPreview(null);
    const controller = new AbortController();
    const timeout = window.setTimeout(() => {
      api.request("/api/recipes/preview", { method: "POST", body: JSON.stringify({ name: "preview", ingredients: ingredients.map((item) => ({ foodId: item.foodId, quantity: decimalNumber(item.quantity), unit: item.unit })) }), signal: controller.signal })
        .then(setNutritionPreview)
        .catch((previewError) => { if (previewError?.name !== "AbortError") setNutritionPreview(null); });
    }, 180);
    return () => { window.clearTimeout(timeout); controller.abort(); };
  }, [api, ingredients, totalWeight]);
  function updateIngredients(nextIngredients) {
    if (cookedWeight) {
      setCookedWeight("");
      setTrackCookedWeight(false);
      setCookedWeightCleared(true);
    }
    setIngredients(nextIngredients);
  }
  function addIngredient(food) {
    updateIngredients([...ingredients, { foodId: food.id, name: food.name, quantity: 100, unit: "GRAM" }]);
    setIngredientQuery("");
  }
  async function submit(event) {
    event.preventDefault();
    setError("");
    if (!name.trim()) return setError("Pone un nombre para la receta.");
    if (!ingredients.length) return setError("La receta necesita al menos un ingrediente.");
    if (ingredients.some((item) => !Number.isFinite(decimalNumber(item.quantity)) || decimalNumber(item.quantity) <= 0)) return setError("Cada ingrediente debe tener una cantidad mayor a cero.");
    if (trackCookedWeight && (!Number.isFinite(decimalNumber(cookedWeight)) || decimalNumber(cookedWeight) <= 0)) return setError("Ingresá un peso cocido final mayor a cero o desactivá esta medición.");
    setSaving(true);
    try {
      await api.runAction(
        { title: "Guardando receta", description: "Estamos actualizando los ingredientes..." },
        () => api.request(`/api/recipes/${recipe.id}`, {
          method: "PUT",
          body: JSON.stringify(buildRecipePayload({
            name,
            description,
            ingredients,
            cookedTotalWeightGrams: trackCookedWeight ? cookedWeight : null,
            clearCookedTotalWeight: cookedWeightCleared,
          })),
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
         <div className="recipe-weight-summary"><Icon name="scale" /><div><small>Peso de ingredientes antes de cocinar</small><strong>{formatQuantity(totalWeight)} g</strong></div></div>
          <section className="recipe-cooked-weight" aria-describedby="edit-recipe-cooked-weight-help">
            <label className="recipe-cooked-toggle">
              <input type="checkbox" checked={trackCookedWeight} onChange={(event) => {
                setTrackCookedWeight(event.target.checked);
                if (!event.target.checked && cookedWeight) setCookedWeightCleared(true);
              }} />
              <span>Registrar peso cocido final</span>
            </label>
            <p id="edit-recipe-cooked-weight-help">Es una medición después de cocinar; usala para registrar la receta en gramos cocidos.</p>
            {trackCookedWeight && <Input decimal selectOnFocus numericOnly label="Peso cocido final (g)" inputMode="decimal" min="0.1" step="0.01" value={cookedWeight} onChange={(event) => { setCookedWeight(event.target.value); setCookedWeightCleared(false); }} required />}
            {yieldPercent != null && <small className="recipe-yield">Rendimiento cocido: {formatNumber(yieldPercent, 1)}%</small>}
            {cookedWeightCleared && <p className="recipe-cooked-reset" role="status">Cambiaste los ingredientes: medí el peso cocido final nuevamente.</p>}
          </section>
          <section className="recipe-edit-ingredient-picker" aria-labelledby="edit-recipe-add-ingredient-title">
            <div className="recipe-edit-section-heading"><div><h3 id="edit-recipe-add-ingredient-title">Agregar ingrediente</h3><small>Buscá un alimento sin salir del editor.</small></div><Icon name="search" /></div>
            <input type="search" value={ingredientQuery} placeholder="Ej.: avena, pollo, banana" aria-label="Buscar alimento para agregar" onChange={(event) => setIngredientQuery(event.target.value)} />
            {ingredientQuery.trim().length >= 2 && <div className="recipe-edit-food-results" aria-live="polite">{foodCatalog.initialLoading && <small>Buscando alimentos…</small>}{!foodCatalog.initialLoading && foodCatalog.items.length === 0 && <small>No encontramos alimentos con ese nombre.</small>}{foodCatalog.items.map((food) => <CatalogRowWithImage key={food.id} item={food} onPick={addIngredient} />)}{foodCatalog.hasNext && !foodCatalog.initialLoading && <button type="button" className="text-button" onClick={foodCatalog.loadNext} disabled={foodCatalog.loadingMore}>{foodCatalog.loadingMore ? "Cargando…" : "Ver más resultados"}</button>}</div>}
          </section>
          <div className="ingredient-list">
            {ingredients.map((item, index) => (
              <label className="ingredient-row" key={`${item.foodId}:${index}`}>
                <span className="ingredient-name">{item.name}</span>
                <span className="ingredient-quantity">
                  <input aria-label={`Cantidad de ${item.name} en gramos`} type="text" inputMode="decimal" min="0.1" step="0.01" value={item.quantity} onFocus={(event) => event.currentTarget.select()} onPointerUp={(event) => { event.preventDefault(); event.currentTarget.select(); }} onKeyDown={(event) => { if (["e", "E", "+", "-"].includes(event.key)) event.preventDefault(); }} onChange={(event) => updateIngredients(ingredients.map((ingredient, i) => (i === index ? { ...ingredient, quantity: normalizeDecimalInput(event.target.value) } : ingredient)))} />
                  <small>g</small>
                </span>
                <button type="button" className="ingredient-remove" onClick={() => updateIngredients(ingredients.filter((_, i) => i !== index))}>
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
          <div className="edit-log-header-main">
            <FoodThumb item={isRecipe ? { ...item, type: "RECIPE" } : item} compact />
            <div className="edit-log-identity">
              <span>{eyebrow}</span>
              <h2 id={resolvedTitleId}>{title}</h2>
              <small>{isRecipe ? "Receta" : "Alimento"}</small>
            </div>
          </div>
          {nutritionPreview && <div className="recipe-edit-preview" aria-live="polite"><div><strong>Vista previa nutricional</strong><small>Se recalcula al cambiar cantidades o ingredientes.</small></div><NutritionSummary nutrition={nutritionPreview} /></div>}
          <button type="button" className="icon-button" onClick={onClose} aria-label="Cerrar">
            <Icon name="close" />
          </button>
        </header>
         <div className="edit-log-body" data-dialog-scroll-owner="true">{children}</div>
        {footer}
  </ModalShell>
  );
}
