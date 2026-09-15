import React, { useEffect, useMemo, useState } from "react";
import { CATEGORY_OPTIONS } from "../../../config/app";
import { Icon } from "../../../components/Icon";
import { InfiniteSentinel } from "../../../components/InfiniteSentinel";
import { Input } from "../../../components/FormControls";
import { NutritionSummary } from "../../../components/NutritionSummary";
import { CatalogStatus, CookedYieldHint, groupFoodVariants, PreparationBadge } from "../../catalog/CatalogComponents";
import { usePagedCatalog } from "../../catalog/usePagedCatalog";
import { buildRecipePayload, recipeYieldPercent } from "../../../utils/recipe";
import { decimalNumber } from "../../../utils/decimal";
import { formatNumber, formatQuantity } from "../../../utils/format";
import { RecipeIngredientRow } from "./RecipeIngredientRow";

function recipeIngredientDraft(item) {
  const food = item?.food || item || {};
  return {
    food,
    foodId: item?.food?.id || item?.foodId || food.id,
    name: item?.food?.name || item?.name || food.name || "Alimento",
    quantity: item?.quantity ?? 100,
    unit: item?.unit || "GRAM",
  };
}

function recipeFieldLabel(field) {
  if (field === "name") return "Nombre";
  if (field === "description") return "Descripción";
  if (field === "cookedTotalWeightGrams") return "Peso cocido final";
  if (field?.startsWith("ingredients")) return "Ingredientes";
  return field || "Datos";
}

export function RecipeEditorForm({ api, recipe = null, onDirtyChange, onBusyChange, onDone, id, hideSubmit = false, title = "Nueva receta" }) {
  const editing = Boolean(recipe?.id);
  const [name, setName] = useState(recipe?.name || "");
  const [description, setDescription] = useState(recipe?.description || "");
  const [query, setQuery] = useState("");
  const [ingredients, setIngredients] = useState(() => (recipe?.ingredients || []).map(recipeIngredientDraft).filter((item) => item.foodId));
  const [preview, setPreview] = useState(null);
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);
  const [trackCookedWeight, setTrackCookedWeight] = useState(() => Number(recipe?.cookedTotalWeightGrams) > 0);
  const [cookedWeight, setCookedWeight] = useState(() => recipe?.cookedTotalWeightGrams == null ? "" : String(recipe.cookedTotalWeightGrams));
  const [cookedWeightCleared, setCookedWeightCleared] = useState(false);
  const totalWeight = useMemo(() => ingredients.reduce((total, item) => total + (decimalNumber(item.quantity) || 0), 0), [ingredients]);
  const yieldPercent = recipeYieldPercent({ rawTotalWeightGrams: totalWeight, cookedTotalWeightGrams: cookedWeight });
  const catalog = usePagedCatalog({ api, endpoint: "/api/foods", query, pageSize: 10, enabled: query.trim().length >= 2 });

  useEffect(() => {
    if (!ingredients.length || totalWeight <= 0) {
      setPreview(null);
      return undefined;
    }
    const controller = new AbortController();
    const timeout = window.setTimeout(() => {
      api.request("/api/recipes/preview", {
        method: "POST",
        body: JSON.stringify({ name: "preview", ingredients: ingredients.map((item) => ({ foodId: item.foodId, quantity: decimalNumber(item.quantity), unit: item.unit })) }),
        signal: controller.signal,
      }).then(setPreview).catch((error) => {
        if (error?.name !== "AbortError") setPreview(null);
      });
    }, 180);
    return () => {
      window.clearTimeout(timeout);
      controller.abort();
    };
  }, [api, ingredients, totalWeight]);

  function updateIngredients(nextIngredients) {
    if (cookedWeight) {
      setCookedWeight("");
      setTrackCookedWeight(false);
      setCookedWeightCleared(true);
    }
    setIngredients(nextIngredients);
    onDirtyChange?.(true);
  }

  function addIngredient(food) {
    updateIngredients([...ingredients, recipeIngredientDraft({ food, quantity: 100, unit: "GRAM" })]);
    setQuery("");
  }

  async function submit(event) {
    event.preventDefault();
    if (saving) return;
    setFormError("");
    if (!name.trim()) return setFormError("Poné un nombre para la receta.");
    if (!ingredients.length) return setFormError("Agregá al menos un ingrediente.");
    if (ingredients.some((item) => !Number.isFinite(decimalNumber(item.quantity)) || decimalNumber(item.quantity) <= 0)) return setFormError("Cada ingrediente debe tener una cantidad mayor a cero.");
    if (trackCookedWeight && (!Number.isFinite(decimalNumber(cookedWeight)) || decimalNumber(cookedWeight) <= 0)) return setFormError("Ingresá un peso cocido final mayor a cero o desactivá esta medición.");
    setSaving(true);
    onBusyChange?.(true);
    try {
      await api.runAction(
        { title: editing ? "Guardando receta" : "Creando receta", description: "Estamos guardando los ingredientes..." },
        () => api.request(editing ? `/api/recipes/${recipe.id}` : "/api/recipes", {
          method: editing ? "PUT" : "POST",
          body: JSON.stringify(buildRecipePayload({
            name,
            description,
            ingredients,
            cookedTotalWeightGrams: trackCookedWeight ? cookedWeight : null,
            clearCookedTotalWeight: cookedWeightCleared,
          })),
        }, { quiet: true }),
      );
      api.notify(editing ? "Receta actualizada." : "Receta creada.");
      onDirtyChange?.(false);
      onDone?.();
    } catch (error) {
      const fieldDetails = Object.entries(error.fields || {}).map(([field, message]) => `${recipeFieldLabel(field)}: ${message}`).join(" ");
      const message = fieldDetails || error.message || `No se pudo ${editing ? "actualizar" : "crear"} la receta. Revisá los datos.`;
      setFormError(message);
      api.notify(message, "error");
    } finally {
      setSaving(false);
      onBusyChange?.(false);
    }
  }

  const form = (
    <form id={id} className="form-grid recipe-form" onInput={() => onDirtyChange?.(true)} onSubmit={submit}>
      {formError && <div className="form-error recipe-error" role="alert"><Icon name="error" /><span>{formError}</span></div>}
      <Input name="name" label="Nombre" value={name} onChange={(event) => setName(event.target.value)} required />
      <Input name="description" label="Descripción opcional" value={description} onChange={(event) => setDescription(event.target.value)} />
      <div className="recipe-weight-summary" aria-live="polite"><Icon name="scale" /><div><small>Peso de ingredientes antes de cocinar</small><strong>{formatQuantity(totalWeight)} g</strong></div></div>
      <section className="recipe-cooked-weight" aria-describedby={`recipe-cooked-weight-help-${id || "editor"}`}>
        <label className="recipe-cooked-toggle"><input type="checkbox" checked={trackCookedWeight} onChange={(event) => { setTrackCookedWeight(event.target.checked); if (!event.target.checked && cookedWeight) setCookedWeightCleared(true); onDirtyChange?.(true); }} /><span>Registrar peso cocido final</span></label>
        <p id={`recipe-cooked-weight-help-${id || "editor"}`}>Es una medición después de cocinar; usala para registrar la receta en gramos cocidos.</p>
        {trackCookedWeight && <Input decimal selectOnFocus numericOnly name="cookedTotalWeightGrams" label="Peso cocido final (g)" inputMode="decimal" min="0.1" step="0.01" value={cookedWeight} onChange={(event) => { setCookedWeight(event.target.value); setCookedWeightCleared(false); onDirtyChange?.(true); }} required />}
        {yieldPercent != null && <small className="recipe-yield">Rendimiento cocido: {formatNumber(yieldPercent, 1)}%</small>}
        {cookedWeightCleared && <p className="recipe-cooked-reset" role="status">Cambiaste los ingredientes: medí el peso cocido final nuevamente.</p>}
      </section>
      <div className="search-wrap"><Icon name="search" /><input className="search" placeholder="Buscar ingredientes..." value={query} onChange={(event) => setQuery(event.target.value)} /></div>
      {catalog.initialLoading && <CatalogStatus>Buscando ingredientes…</CatalogStatus>}
      {!catalog.initialLoading && query.trim().length < 2 && <CatalogStatus>Buscá un ingrediente para comenzar.</CatalogStatus>}
      {query.trim().length >= 2 && <div className="picker-results">{groupFoodVariants(catalog.items).map((food) => <button type="button" className="catalog-row ingredient-pick" key={food.id} onClick={() => addIngredient(food)}><span className="ingredient-pick-copy"><strong>{food.name}</strong><span className="ingredient-pick-meta"><PreparationBadge food={food} showUnknown /><CookedYieldHint food={food} /></span><NutritionSummary nutrition={food} /></span><em><Icon name="add" />Agregar</em></button>)}</div>}
      {!catalog.initialLoading && catalog.error && <CatalogStatus error>{catalog.error}<button type="button" className="secondary" onClick={catalog.retry}>Reintentar</button></CatalogStatus>}
      {query.trim().length >= 2 && !catalog.initialLoading && !catalog.error && !catalog.items.length && <CatalogStatus>No encontramos ingredientes.</CatalogStatus>}
      <InfiniteSentinel enabled={query.trim().length >= 2 && !catalog.initialLoading && !catalog.error && catalog.hasNext} onLoad={catalog.loadNext} />
      <div className="ingredient-list">{ingredients.map((item, index) => <RecipeIngredientRow key={`${item.foodId}:${index}`} ingredient={item} index={index} onChange={(ingredientIndex, value) => updateIngredients(ingredients.map((ingredient, i) => i === ingredientIndex ? { ...ingredient, quantity: value } : ingredient))} onRemove={(ingredientIndex) => updateIngredients(ingredients.filter((_, i) => i !== ingredientIndex))} />)}</div>
      <NutritionSummary nutrition={preview || {}} size="detail" />
      {!hideSubmit && <button className="primary recipe-submit" disabled={!ingredients.length || saving}>{saving ? (editing ? "Guardando…" : "Creando…") : (editing ? "Guardar cambios" : "Crear receta")}</button>}
    </form>
  );

  return title == null ? form : <div className="recipe-panel"><h2>{title}</h2>{form}</div>;
}
