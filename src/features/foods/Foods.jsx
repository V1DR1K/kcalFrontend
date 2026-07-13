import React, { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { InfiniteSentinel } from "../../components/InfiniteSentinel";
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
              <span className="material-symbols-outlined">barcode_scanner</span>
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
        <span className="material-symbols-outlined">search</span>
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
  const [offset, setOffset] = useState(0);
  const [revealed, setRevealed] = useState("");
  const [horizontalDragging, setHorizontalDragging] = useState(false);
  const close = useCallback(() => {
    gesture.current = null;
    setHorizontalDragging(false);
    setRevealed("");
    setOffset(0);
  }, []);
  useEffect(() => close(), [close, resetSignal]);
  function finish() {
    if (gesture.current?.axis === "x" && offset > 64) {
      setRevealed("edit");
      setOffset(76);
    } else if (gesture.current?.axis === "x" && offset < -64) {
      setRevealed("delete");
      setOffset(-76);
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
        setOffset(0);
      }
    }
    if (gesture.current.axis === "x") {
      event.preventDefault();
      setHorizontalDragging(true);
      setOffset(Math.max(-92, Math.min(92, dx)));
    }
  }
  return (
    <div className={`swipe-row recipe-swipe-row ${revealed} ${horizontalDragging ? "swiping" : ""}`}>
      <button className="swipe-action swipe-edit" aria-label="Editar receta" disabled={disabled} onClick={() => { close(); window.setTimeout(onEdit, 120); }}><span className="material-symbols-outlined">edit</span></button>
      <button className="swipe-action swipe-delete" aria-label="Borrar receta" disabled={disabled} onClick={() => { close(); window.setTimeout(onDelete, 120); }}><span className="material-symbols-outlined">delete</span></button>
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
          <p>{formatNumber(recipe.totalWeightGrams, 1)}g totales</p>
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
            <span className="material-symbols-outlined">close</span>
          </button>
        </header>
        <div className="edit-food-fields">
          {error && <div className="form-error recipe-error" role="alert"><span className="material-symbols-outlined">error</span><span>{error}</span></div>}
          <Input label="Nombre" value={name} onChange={(event) => setName(event.target.value)} required />
          <Input label="Descripcion opcional" value={description} onChange={(event) => setDescription(event.target.value)} />
          <div className="recipe-weight-summary"><span className="material-symbols-outlined">scale</span><div><small>Peso total calculado</small><strong>{formatNumber(totalWeight, 1)} g</strong></div></div>
          <div className="ingredient-list">
            {ingredients.map((item, index) => (
              <label className="ingredient-row" key={`${item.foodId}:${index}`}>
                <span className="ingredient-name">{item.name}</span>
                <span className="ingredient-quantity">
                  <input aria-label={`Cantidad de ${item.name} en gramos`} type="number" min="0.1" step="0.1" value={item.quantity} onChange={(event) => setIngredients(ingredients.map((ingredient, i) => (i === index ? { ...ingredient, quantity: event.target.value } : ingredient)))} />
                  <small>g</small>
                </span>
                <button type="button" className="ingredient-remove" onClick={() => setIngredients(ingredients.filter((_, i) => i !== index))}>
                  <span className="material-symbols-outlined">remove</span>Quitar
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
  const [saving, setSaving] = useState(false);
  const [closing, setClosing] = useState(false);
  const item = log.itemType === "RECIPE" ? log.recipe : log.food;
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
  async function submit(event) {
    event.preventDefault();
    const numericQuantity = Number(quantity);
    if (!Number.isFinite(numericQuantity) || numericQuantity <= 0 || saving) return;
    setSaving(true);
    try {
      await api.request(`/api/nutrition/food-logs/${log.id}`, {
        method: "PUT",
        body: JSON.stringify({
          mealType,
          quantity: numericQuantity,
          unit: log.unit || "GRAM",
          logDate: log.logDate,
        }),
      });
      api.notify("Registro actualizado.");
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
            <span className="material-symbols-outlined">close</span>
          </button>
        </header>
        <Input autoFocus selectOnFocus label={log.itemType === "RECIPE" ? "Gramos ingeridos" : "Cantidad en gramos"} type="number" inputMode="decimal" min="0.1" step="0.1" value={quantity} onChange={(event) => setQuantity(event.target.value)} />
        <Select
          label="Comida"
          value={mealType}
          onChange={(event) => setMealType(event.target.value)}
          options={mealTypes.map((meal) => ({
            value: meal.code,
            label: meal.label,
          }))}
        />
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
