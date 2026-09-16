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
  const isRecipe = item?.type === "RECIPE" || item?.recipeId != null || item?.recipe != null;
  const food = item?.food || (!isRecipe ? item : {});
  const recipe = item?.recipe || (isRecipe ? item : null);
  return {
    food: isRecipe ? null : food,
    recipe: isRecipe ? recipe : null,
    type: isRecipe ? "RECIPE" : "FOOD",
    foodId: isRecipe ? null : item?.food?.id || item?.foodId || food.id,
    recipeId: isRecipe ? item?.recipe?.id || item?.recipeId || recipe.id : null,
    name: item?.food?.name || item?.recipe?.name || item?.name || (isRecipe ? recipe.name : food.name) || (isRecipe ? "Receta" : "Alimento"),
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
  const searchEnabled = query.trim().length >= 2;
  const foodCatalog = usePagedCatalog({ api, endpoint: "/api/foods", query, pageSize: 10, enabled: searchEnabled });
  const recipeCatalog = usePagedCatalog({ api, endpoint: "/api/recipes", query, pageSize: 10, enabled: searchEnabled });
  const foodItems = groupFoodVariants(foodCatalog.items);
  const recipeItems = recipeCatalog.items.map((item) => ({ ...item, type: "RECIPE" }));
  const catalogItems = [...foodItems, ...recipeItems];
  const catalogLoading = foodCatalog.initialLoading || recipeCatalog.initialLoading;
  const catalogError = foodCatalog.error || recipeCatalog.error;
  const catalogHasNext = foodCatalog.hasNext || recipeCatalog.hasNext;
  const catalogLoadingMore = foodCatalog.loadingMore || recipeCatalog.loadingMore;
  function loadNextCatalogPage() {
    if (foodCatalog.hasNext && !foodCatalog.loadingMore) foodCatalog.loadNext();
    if (recipeCatalog.hasNext && !recipeCatalog.loadingMore) recipeCatalog.loadNext();
  }
  function retryCatalog() {
    foodCatalog.retry();
    recipeCatalog.retry();
  }

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
      {catalogLoading && <CatalogStatus>Buscando alimentos y recetas…</CatalogStatus>}
      {!catalogLoading && query.trim().length < 2 && <CatalogStatus>Buscá un alimento o una receta para comenzar.</CatalogStatus>}
      {searchEnabled && <div className="picker-results">{catalogItems.map((item) => <button type="button" className={`catalog-row ingredient-pick ${item.type === "RECIPE" ? "ingredient-pick-recipe" : ""}`} key={`${item.type}:${item.id}`} onClick={() => addIngredient(item)}><span className="ingredient-pick-copy"><strong>{item.name}</strong><span className="ingredient-pick-meta"><small className="ingredient-pick-kind">{item.type === "RECIPE" ? "Receta" : "Alimento"}</small><PreparationBadge food={item} showUnknown /><CookedYieldHint food={item} /></span><NutritionSummary nutrition={item} /></span><em><Icon name="add" />Agregar</em></button>)}</div>}
      {!catalogLoading && catalogError && <CatalogStatus error>{catalogError}<button type="button" className="secondary" onClick={retryCatalog}>Reintentar</button></CatalogStatus>}
      {searchEnabled && !catalogLoading && !catalogError && !catalogItems.length && <CatalogStatus>No encontramos alimentos ni recetas.</CatalogStatus>}
      <InfiniteSentinel enabled={searchEnabled && !catalogLoading && !catalogError && catalogHasNext} onLoad={loadNextCatalogPage} />
      <div className="ingredient-list">{ingredients.map((item, index) => <RecipeIngredientRow key={`${item.foodId}:${index}`} ingredient={item} index={index} onChange={(ingredientIndex, value) => updateIngredients(ingredients.map((ingredient, i) => i === ingredientIndex ? { ...ingredient, quantity: value } : ingredient))} onRemove={(ingredientIndex) => updateIngredients(ingredients.filter((_, i) => i !== ingredientIndex))} />)}</div>
      <NutritionSummary nutrition={preview || {}} size="detail" />
      {!hideSubmit && <button className="primary recipe-submit" disabled={!ingredients.length || saving}>{saving ? (editing ? "Guardando…" : "Creando…") : (editing ? "Guardar cambios" : "Crear receta")}</button>}
    </form>
  );

  return title == null ? form : <div className="recipe-panel"><h2>{title}</h2>{form}</div>;
}
