import React, { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { InfiniteSentinel } from "../../components/InfiniteSentinel";
import { Icon } from "../../components/Icon";
import { Input, Select } from "../../components/FormControls";
import { Header } from "../../components/Layout";
import { CatalogCard, CatalogStatus, CategoryChips, FoodThumb, groupFoodVariants } from "../catalog/CatalogComponents";
import { QuickItems } from "../dashboard/Dashboard";
import { usePagedCatalog } from "../catalog/usePagedCatalog";
import { readRecents } from "../../services/recents";
import { formatNumber } from "../../utils/format";

export function Foods({ api, user, setPage, setSelectedFoodId }) {
  const [tab, setTab] = useState("FOOD");
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("");
  const [editingRecipe, setEditingRecipe] = useState(null);
  const [deletingRecipeId, setDeletingRecipeId] = useState(null);
  const [loadingRecipeId, setLoadingRecipeId] = useState(null);
  const [swipeResetSignal, setSwipeResetSignal] = useState(0);
  const catalog = usePagedCatalog({
    api,
    endpoint: tab === "FOOD" ? "/api/foods" : "/api/recipes",
    query,
    category: tab === "FOOD" ? category : "",
  });
  return (
    <section className="page">
      <Header
        title="Alimentos"
        action={
          <div className="header-actions">
            <button className="secondary" onClick={() => setPage("create")}>
              Crear
            </button>
            <button className="primary pill" onClick={() => setPage("scanner")}>
              <Icon name="barcode_scanner" />
              Escanear
            </button>
          </div>
        }
      />
      <div className="tabs">
        <button className={tab === "FOOD" ? "selected" : ""} onClick={() => setTab("FOOD")}>
          Alimentos
        </button>
        <button className={tab === "RECIPE" ? "selected" : ""} onClick={() => setTab("RECIPE")}>
          Recetas
        </button>
      </div>
      <div className="search-wrap">
        <Icon name="search" />
        <input className="search" placeholder="Buscar..." value={query} onChange={(event) => setQuery(event.target.value)} />
      </div>
      {tab === "FOOD" && <CategoryChips category={category} setCategory={setCategory} />}
      <QuickItems
        title="Accesos rapidos"
        items={groupFoodVariants(readRecents(user).items.filter((item) => item.type === tab))}
        onPick={(item) => {
          if (item.type === "FOOD") {
            setSelectedFoodId(item.id);
            setPage("configure");
          }
        }}
      />
      <div className="food-grid">
        {groupFoodVariants(catalog.items).map((item) => {
          const typedItem = { ...item, type: tab };
          if (tab === "RECIPE") {
            return (
              <SwipeableRecipeCard
                key={`RECIPE:${item.id}`}
                recipe={typedItem}
                resetSignal={swipeResetSignal}
                disabled={deletingRecipeId === item.id || loadingRecipeId === item.id}
                onEdit={async () => {
                  setSwipeResetSignal((value) => value + 1);
                  setLoadingRecipeId(item.id);
                  try {
                    const fullRecipe = await api.request(`/api/recipes/${item.id}`);
                    setEditingRecipe({ ...fullRecipe, type: "RECIPE" });
                  } catch (error) {
                    api.notify(error.message || "No se pudo cargar la receta.", "error");
                  } finally {
                    setLoadingRecipeId(null);
                  }
                }}
                onDelete={async () => {
                  if (deletingRecipeId) return;
                  if (!window.confirm(`Borrar la receta ${item.name}?`)) {
                    setSwipeResetSignal((value) => value + 1);
                    return;
                  }
                  setDeletingRecipeId(item.id);
                  try {
                    await api.request(`/api/recipes/${item.id}`, { method: "DELETE" });
                    catalog.removeItem(item.id);
                    api.notify("Receta borrada.");
                  } catch (error) {
                    api.notify(error.message || "No se pudo borrar la receta.", "error");
                  } finally {
                    setDeletingRecipeId(null);
                    setSwipeResetSignal((value) => value + 1);
                  }
                }}
              />
            );
          }
          return (
            <CatalogCard
              key={`${tab}:${item.preparationGroup || item.id}`}
              item={typedItem}
              onAdd={() => {
                setSelectedFoodId(item.id);
                setPage("configure");
              }}
            />
          );
        })}
      </div>
      {catalog.initialLoading && <CatalogStatus>Buscando alimentos…</CatalogStatus>}
      {!catalog.initialLoading && catalog.error && (
        <CatalogStatus error>
          {catalog.error}
          <button className="secondary" onClick={catalog.retry}>
            Reintentar
          </button>
        </CatalogStatus>
      )}
      {!catalog.initialLoading && !catalog.error && !catalog.items.length && <CatalogStatus>No encontramos resultados.</CatalogStatus>}
      {catalog.loadingMore && <CatalogStatus>Cargando más…</CatalogStatus>}
      {!catalog.initialLoading && !catalog.error && catalog.items.length > 0 && !catalog.hasNext && <CatalogStatus>Viste todos los resultados.</CatalogStatus>}
      <InfiniteSentinel enabled={catalog.hasNext && !catalog.initialLoading && !catalog.loadingMore && !catalog.error} onLoad={catalog.loadNext} />
      {editingRecipe && (
        <EditRecipeModal
          api={api}
          recipe={editingRecipe}
          onClose={() => setEditingRecipe(null)}
          onDone={() => {
            setEditingRecipe(null);
            catalog.refresh();
          }}
        />
      )}
    </section>
  );
}

function SwipeableRecipeCard({ recipe, resetSignal, disabled, onEdit, onDelete }) {
  const gesture = useRef(null);
  const offsetRef = useRef(0);
  const [offset, setOffset] = useState(0);
  const [revealed, setRevealed] = useState("");
  const [horizontalDragging, setHorizontalDragging] = useState(false);
  const setSwipeOffset = useCallback((nextOffset) => {
    offsetRef.current = nextOffset;
    setOffset(nextOffset);
  }, []);
  const close = useCallback(() => {
    gesture.current = null;
    setHorizontalDragging(false);
    setRevealed("");
    setSwipeOffset(0);
  }, [setSwipeOffset]);
  useEffect(() => close(), [close, resetSignal]);
  function finish() {
    const finalOffset = offsetRef.current;
    if (gesture.current?.axis === "x" && finalOffset > 64) {
      setRevealed("edit");
      setSwipeOffset(76);
    } else if (gesture.current?.axis === "x" && finalOffset < -64) {
      setRevealed("delete");
      setSwipeOffset(-76);
    } else {
      close();
    }
    gesture.current = null;
    setHorizontalDragging(false);
  }
  function move(event) {
    if (!gesture.current) return;
    const dx = event.touches[0].clientX - gesture.current.x;
    const dy = event.touches[0].clientY - gesture.current.y;
    if (!gesture.current.axis && Math.max(Math.abs(dx), Math.abs(dy)) > 10) {
      gesture.current.axis = Math.abs(dx) > Math.abs(dy) * 1.8 ? "x" : "y";
      if (gesture.current.axis === "y") {
        setHorizontalDragging(false);
        setSwipeOffset(0);
      }
    }
    if (gesture.current.axis === "x") {
      if (event.cancelable) event.preventDefault();
      setHorizontalDragging(true);
      setSwipeOffset(Math.max(-92, Math.min(92, dx)));
    }
  }
  return (
    <div className={`swipe-row recipe-swipe-row ${revealed} ${horizontalDragging ? "swiping" : ""}`}>
      <button className="swipe-action swipe-edit" aria-label="Editar receta" disabled={disabled} onClick={() => { close(); window.setTimeout(onEdit, 120); }}><Icon name="edit" /></button>
      <button className="swipe-action swipe-delete" aria-label="Borrar receta" disabled={disabled} onClick={() => { close(); window.setTimeout(onDelete, 120); }}><Icon name="delete" /></button>
      <article
        className={`food-card recipe-swipe-card ${horizontalDragging ? "swiping" : ""} ${disabled ? "moving" : ""}`}
        style={{ transform: `translateX(${offset}px)` }}
        onTouchStart={(event) => { gesture.current = { x: event.touches[0].clientX, y: event.touches[0].clientY, axis: null }; }}
        onTouchMove={move}
        onTouchEnd={finish}
        onTouchCancel={finish}
      >
        <FoodThumb item={recipe} />
        <div>
          <h3>{recipe.name}</h3>
          <p>Receta completa · {formatNumber(recipe.totalWeightGrams, 1)}g internos</p>
        </div>
        <strong>{recipe.calories} kcal</strong>
      </article>
    </div>
  );
}

function EditRecipeModal({ api, recipe, onClose, onDone }) {
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
      await api.request(`/api/recipes/${recipe.id}`, {
        method: "PUT",
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim(),
          totalWeightGrams: totalWeight,
          ingredients: ingredients.map((item) => ({ foodId: item.foodId, quantity: Number(item.quantity), unit: item.unit })),
        }),
      });
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
  return createPortal(
    <div className="edit-food-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <form className="edit-food-sheet edit-recipe-sheet" onSubmit={submit}>
        <header>
          <div>
            <span>Editar receta</span>
            <h2>{recipe.name}</h2>
          </div>
          <button type="button" className="icon-button" aria-label="Cerrar" onClick={onClose}>
            <Icon name="close" />
          </button>
        </header>
        <div className="edit-food-fields">
          {error && <div className="form-error recipe-error" role="alert"><Icon name="error" /><span>{error}</span></div>}
          <Input label="Nombre" value={name} onChange={(event) => setName(event.target.value)} required />
          <Input label="Descripcion opcional" value={description} onChange={(event) => setDescription(event.target.value)} />
          <div className="recipe-weight-summary"><Icon name="scale" /><div><small>Peso total calculado</small><strong>{formatNumber(totalWeight, 1)} g</strong></div></div>
          <div className="ingredient-list">
            {ingredients.map((item, index) => (
              <label className="ingredient-row" key={`${item.foodId}:${index}`}>
                <span className="ingredient-name">{item.name}</span>
                <span className="ingredient-quantity">
                  <input aria-label={`Cantidad de ${item.name} en gramos`} type="number" inputMode="decimal" min="0.1" step="0.1" value={item.quantity} onFocus={(event) => event.currentTarget.select()} onPointerUp={(event) => { event.preventDefault(); event.currentTarget.select(); }} onKeyDown={(event) => { if (["e", "E", "+", "-"].includes(event.key)) event.preventDefault(); }} onInput={(event) => { event.currentTarget.value = event.currentTarget.value.replace(",", ".").replace(/[^\d.]/g, ""); }} onChange={(event) => setIngredients(ingredients.map((ingredient, i) => (i === index ? { ...ingredient, quantity: event.target.value } : ingredient)))} />
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
      </form>
    </div>,
    document.body,
  );
}

export function EditFoodLog({ api, log, mealTypes, onClose, onDone }) {
  const [quantity, setQuantity] = useState(String(log.quantity));
  const [mealType, setMealType] = useState(log.mealType);
  const [ingredients, setIngredients] = useState(() => (log.recipe?.ingredients || []).map((ingredient) => ({
    foodId: ingredient.food?.id,
    name: ingredient.food?.name || "Alimento",
    quantity: String(ingredient.quantity ?? ""),
    unit: ingredient.unit || "GRAM",
  })));
  const [preview, setPreview] = useState({
    calories: log.calories,
    proteinGrams: log.proteinGrams,
    carbsGrams: log.carbsGrams,
    fatGrams: log.fatGrams,
  });
  const [saving, setSaving] = useState(false);
  const [closing, setClosing] = useState(false);
  const item = log.itemType === "RECIPE" ? log.recipe : log.food;
  const isRecipe = log.itemType === "RECIPE";
  const closeWithAnimation = useCallback(() => {
    if (closing || saving) return;
    setClosing(true);
    window.setTimeout(onClose, 180);
  }, [closing, onClose, saving]);
  useEffect(() => {
    const closeOnEscape = (event) => {
      if (event.key === "Escape") closeWithAnimation();
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [closeWithAnimation]);
  useEffect(() => {
    const numericQuantity = Number(quantity);
    if (!Number.isFinite(numericQuantity) || numericQuantity <= 0 || !item) {
      setPreview(null);
      return undefined;
    }
    if (isRecipe) {
      const nutrition = ingredients.reduce((total, ingredient) => {
        const food = item?.ingredients?.find((entry) => entry.food?.id === ingredient.foodId)?.food;
        const factor = Number(ingredient.quantity) / Number(food?.baseQuantity || 100);
        return {
          proteinGrams: total.proteinGrams + Number(food?.proteinGrams || 0) * factor,
          carbsGrams: total.carbsGrams + Number(food?.carbsGrams || 0) * factor,
          fatGrams: total.fatGrams + Number(food?.fatGrams || 0) * factor,
        };
      }, { proteinGrams: 0, carbsGrams: 0, fatGrams: 0 });
      setPreview({
        calories: Math.round((nutrition.proteinGrams * 4 + nutrition.carbsGrams * 4 + nutrition.fatGrams * 9) * numericQuantity),
        proteinGrams: nutrition.proteinGrams * numericQuantity,
        carbsGrams: nutrition.carbsGrams * numericQuantity,
        fatGrams: nutrition.fatGrams * numericQuantity,
      });
      return undefined;
    }
    let active = true;
    api
      .request("/api/foods/preview", {
        method: "POST",
        body: JSON.stringify({
          foodId: item.id,
          quantity: numericQuantity,
          unit: "GRAM",
        }),
      })
      .then((nextPreview) => active && setPreview(nextPreview))
      .catch(() => active && setPreview(null));
    return () => {
      active = false;
    };
  }, [api, ingredients, isRecipe, item, log.itemType, quantity]);
  function updateIngredient(index, value) {
    setIngredients((current) => current.map((ingredient, currentIndex) => currentIndex === index ? { ...ingredient, quantity: value } : ingredient));
  }
  async function resetRecipe() {
    if (saving || !isRecipe) return;
    setSaving(true);
    try {
      await api.request(`/api/nutrition/food-logs/${log.id}/recipe-ingredients`, { method: "DELETE" });
      api.notify("Receta diaria restablecida.");
      setClosing(true);
      window.setTimeout(onDone, 180);
    } catch (error) {
      api.notify(error.message || "No se pudo restablecer la receta.", "error");
      setSaving(false);
    }
  }
  async function submit(event) {
    event.preventDefault();
    const numericQuantity = Number(quantity);
    const validIngredients = ingredients.every((ingredient) => Number.isFinite(Number(ingredient.quantity)) && Number(ingredient.quantity) > 0);
    if (!Number.isFinite(numericQuantity) || numericQuantity <= 0 || (isRecipe && !validIngredients) || saving) return;
    setSaving(true);
    try {
      if (isRecipe) {
        await api.request(`/api/nutrition/food-logs/${log.id}/recipe-ingredients`, {
          method: "PUT",
          body: JSON.stringify({ ingredients: ingredients.map(({ foodId, quantity: ingredientQuantity, unit }) => ({ foodId, quantity: Number(ingredientQuantity), unit })) }),
        });
      }
      await api.request(`/api/nutrition/food-logs/${log.id}`, {
        method: "PUT",
        body: JSON.stringify({
          mealType,
          quantity: numericQuantity,
          unit: isRecipe ? "PORTION" : log.unit || "GRAM",
          logDate: log.logDate,
        }),
      });
      api.notify(isRecipe ? "Receta diaria actualizada." : "Registro actualizado.");
      setClosing(true);
      window.setTimeout(onDone, 180);
    } catch {
      api.notify("No se pudo actualizar el registro.", "error");
      setSaving(false);
    }
  }
  return (
    <div className={`modal-backdrop compact-modal ${closing ? "closing" : ""}`} onPointerDown={(event) => { if (event.target === event.currentTarget) closeWithAnimation(); }}>
      <form className="edit-log-modal" role="dialog" aria-modal="true" aria-labelledby="edit-log-title" onPointerDown={(event) => event.stopPropagation()} onSubmit={submit}>
        <header>
          <div>
            <span>Editar registro</span>
            <h2 id="edit-log-title">{item?.name}</h2>
          </div>
          <button type="button" className="icon-button" onClick={closeWithAnimation} aria-label="Cerrar">
            <Icon name="close" />
          </button>
        </header>
        <Input autoFocus selectOnFocus numericOnly label={isRecipe ? "Porciones" : "Cantidad en gramos"} type="number" inputMode="decimal" min="0.1" step="0.1" value={quantity} onChange={(event) => setQuantity(event.target.value)} />
        {isRecipe && (
          <section className="daily-recipe-editor" aria-label="Ingredientes para este día">
            <div><strong>Receta para este día</strong><small>Estos cambios no modifican la receta base.</small></div>
            {ingredients.map((ingredient, index) => (
              <Input key={ingredient.foodId} numericOnly label={`${ingredient.name} (g)`} type="number" inputMode="decimal" min="0.1" step="0.1" value={ingredient.quantity} onChange={(event) => updateIngredient(index, event.target.value)} />
            ))}
            {log.recipeAdjusted && <button type="button" className="secondary daily-recipe-reset" disabled={saving} onClick={resetRecipe}>Restablecer receta base</button>}
          </section>
        )}
        <Select
          label="Comida"
          value={mealType}
          onChange={(event) => setMealType(event.target.value)}
          options={mealTypes.map((meal) => ({
            value: meal.code,
            label: meal.label,
          }))}
        />
        <div className="nutrition-preview edit-log-preview" aria-label="Resumen nutricional">
          <span>
            <small>Kcal</small>
            <strong>{formatNumber(preview?.calories)}</strong>
          </span>
          <span>
            <small>Proteinas</small>
            <strong>{formatNumber(preview?.proteinGrams, 1)}g</strong>
          </span>
          <span>
            <small>Carbos</small>
            <strong>{formatNumber(preview?.carbsGrams, 1)}g</strong>
          </span>
          <span>
            <small>Grasas</small>
            <strong>{formatNumber(preview?.fatGrams, 1)}g</strong>
          </span>
        </div>
        <div className="modal-actions">
          <button type="button" className="secondary" onClick={closeWithAnimation}>
            Cancelar
          </button>
          <button className="primary" disabled={saving || Number(quantity) <= 0}>
            {saving ? "Guardando…" : "Guardar cambios"}
          </button>
        </div>
      </form>
    </div>
  );
}
