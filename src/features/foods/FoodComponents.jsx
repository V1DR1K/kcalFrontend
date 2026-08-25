import React, { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Icon } from "../../components/Icon";
import { Input, Select } from "../../components/FormControls";
import { CatalogStatus, FoodThumb, NutrientDetails, preparationLabel } from "../catalog/CatalogComponents";
import { formatNumber } from "../../utils/format";
import { NutritionSummary } from "../../components/NutritionSummary";
import { EditRecipeModal, FoodLogDialog } from "./dialogs/FoodDialogs";

export { EditRecipeModal, FoodLogDialog } from "./dialogs/FoodDialogs";

const SWIPE_ACTION_WIDTH = 84;
const RECIPE_MENU_WIDTH = 178;

export function SwipeableRecipeCard({ recipe, resetSignal, disabled, onEdit, onDelete }) {
  const gesture = useRef(null);
  const offsetRef = useRef(0);
  const [offset, setOffset] = useState(0);
  const [revealed, setRevealed] = useState("");
  const [horizontalDragging, setHorizontalDragging] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuTriggerRef = useRef(null);
  const [menuPosition, setMenuPosition] = useState(null);
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
  useEffect(() => {
    close();
    setMenuOpen(false);
  }, [close, resetSignal]);
  function finish() {
    const finalOffset = offsetRef.current;
    if (gesture.current?.axis === "x" && finalOffset > SWIPE_ACTION_WIDTH * 0.65) {
      setRevealed("edit");
      setSwipeOffset(SWIPE_ACTION_WIDTH);
    } else if (gesture.current?.axis === "x" && finalOffset < -SWIPE_ACTION_WIDTH * 0.65) {
      setRevealed("delete");
      setSwipeOffset(-SWIPE_ACTION_WIDTH);
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
      setSwipeOffset(Math.max(-SWIPE_ACTION_WIDTH, Math.min(SWIPE_ACTION_WIDTH, dx)));
    }
  }
  useEffect(() => {
    if (!menuOpen) return undefined;
    function updateMenuPosition() {
      const trigger = menuTriggerRef.current;
      if (!trigger) return;
      const rect = trigger.getBoundingClientRect();
      setMenuPosition({
        top: rect.bottom + 6,
        left: Math.max(8, Math.min(window.innerWidth - RECIPE_MENU_WIDTH - 8, rect.right - RECIPE_MENU_WIDTH)),
      });
    }
    function closeOnOutside(event) {
      if (!event.target.closest(`[data-recipe-menu="${recipe.id}"]`)) setMenuOpen(false);
    }
    function closeOnEscape(event) {
      if (event.key === "Escape") setMenuOpen(false);
    }
    updateMenuPosition();
    window.addEventListener("resize", updateMenuPosition);
    window.addEventListener("scroll", updateMenuPosition, true);
    document.addEventListener("pointerdown", closeOnOutside);
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      window.removeEventListener("resize", updateMenuPosition);
      window.removeEventListener("scroll", updateMenuPosition, true);
      document.removeEventListener("pointerdown", closeOnOutside);
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [menuOpen, recipe.id]);
  return (
    <div className={`swipe-row recipe-swipe-row ${revealed} ${horizontalDragging ? "swiping" : ""}`}>
      <button className="swipe-action swipe-edit" aria-label="Editar receta" tabIndex={revealed === "edit" ? 0 : -1} aria-hidden={revealed !== "edit"} disabled={disabled} onClick={() => { close(); window.setTimeout(onEdit, 120); }}><Icon name="edit" /></button>
      <button className="swipe-action swipe-delete" aria-label="Borrar receta" tabIndex={revealed === "delete" ? 0 : -1} aria-hidden={revealed !== "delete"} disabled={disabled} onClick={() => { close(); window.setTimeout(onDelete, 120); }}><Icon name="delete" /></button>
      <article
        className={`food-card recipe-swipe-card ${horizontalDragging ? "swiping" : ""} ${disabled ? "moving" : ""}`}
        style={{ transform: `translate3d(${offset}px, 0, 0)` }}
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
        <NutritionSummary nutrition={recipe} />
        <div className="recipe-card-menu" data-recipe-menu={recipe.id}>
          <button type="button" ref={menuTriggerRef} className="icon-button recipe-card-menu-trigger" aria-label={`Acciones para ${recipe.name}`} aria-expanded={menuOpen} disabled={disabled} onClick={() => { close(); setMenuOpen((value) => !value); }}>
            <Icon name="more_vert" />
          </button>
        </div>
      </article>
      {menuOpen && menuPosition && createPortal(
        <div className="recipe-card-menu-popover recipe-card-menu-popover-floating" data-recipe-menu={recipe.id} role="menu" style={{ top: menuPosition.top, left: menuPosition.left }}>
          <button type="button" role="menuitem" onClick={() => { setMenuOpen(false); onEdit(); }}><Icon name="edit" />Editar receta</button>
          <button type="button" role="menuitem" className="danger" onClick={() => { setMenuOpen(false); onDelete(); }}><Icon name="delete" />Borrar receta</button>
        </div>,
        document.body,
      )}
    </div>
  );
}

export function FoodLogForm({
  mode,
  isRecipe,
  quantity,
  onQuantityChange,
  unit,
  unitOptions,
  onUnitChange,
  mealType,
  mealTypeOptions,
  onMealTypeChange,
  preparations,
  preparationValue,
  onPreparationChange,
  recipeIngredients,
  onRecipeIngredientChange,
  showIngredients,
  onToggleIngredients,
  onResetRecipe,
  saving,
  logId,
  preview,
}) {
  return (
    <>
      {!isRecipe && preparations.length > 1 && (
        <Select
          label="Peso del alimento"
          value={String(preparationValue)}
          onChange={(event) => onPreparationChange(Number(event.target.value))}
          options={preparations.map((item) => ({
            value: String(item.id),
            label: preparationLabel(item.preparation),
          }))}
        />
      )}
      <div className="edit-log-fields">
        <div className={`edit-log-quantity ${isRecipe ? "portions" : ""}`}>
          <Input selectOnFocus numericOnly label="Cantidad" type="number" inputMode="decimal" min="0.1" step="0.1" value={quantity} onChange={(event) => onQuantityChange(event.target.value)} />
          <small>{isRecipe ? "porciones" : unit === "GRAM" ? "g" : "porciones"}</small>
        </div>
        {mode === "add" ? (
          isRecipe ? (
            <div className="recipe-fixed-unit" aria-label="Unidad fija">
              <span>Unidad</span>
              <strong>Porciones</strong>
            </div>
          ) : (
            <Select label="Unidad" value={unit} onChange={(event) => onUnitChange(event.target.value)} options={unitOptions} />
          )
        ) : (
          <Select label="Comida" value={mealType} onChange={(event) => onMealTypeChange(event.target.value)} options={mealTypeOptions} />
        )}
      </div>
      {isRecipe && recipeIngredients && (
        <section className="daily-recipe-editor" aria-label="Ingredientes de la receta">
          <button
            type="button"
            className="daily-recipe-toggle"
            aria-expanded={mode === "add" || showIngredients}
            aria-controls={mode === "edit" ? `daily-recipe-${logId}` : undefined}
            onClick={mode === "edit" ? onToggleIngredients : undefined}
          >
            <span>
              <strong>Ingredientes</strong>
              <small>{mode === "add" ? "Ajusta las cantidades antes de agregar." : "Los cambios no modifican la receta base."}</small>
            </span>
            <Icon name={mode === "add" || showIngredients ? "expand_less" : "expand_more"} />
          </button>
          <div className="daily-recipe-fields" id={mode === "edit" ? `daily-recipe-${logId}` : undefined} hidden={mode === "edit" && !showIngredients}>
            {recipeIngredients.map((ingredient, index) => (
              <Input key={ingredient.foodId} numericOnly label={`${ingredient.name} (g)`} type="number" inputMode="decimal" min="0.1" step="0.1" value={ingredient.quantity} onChange={(event) => onRecipeIngredientChange(index, event.target.value)} />
            ))}
            {mode === "edit" && showIngredients && onResetRecipe && (
              <button type="button" className="secondary daily-recipe-reset" disabled={saving} onClick={onResetRecipe}>Restablecer receta base</button>
            )}
          </div>
        </section>
      )}
      <div className="nutrition-preview edit-log-preview" aria-label="Resumen nutricional">
        <span className="edit-log-calories">
          <small>Kcal</small>
          <strong>{formatNumber(preview?.calories)}</strong>
        </span>
        <span className="edit-log-macro protein" aria-label={`Proteínas: ${formatNumber(preview?.proteinGrams, 1)} gramos`}>
          <small>P</small>
          <strong>{formatNumber(preview?.proteinGrams, 1)}g</strong>
        </span>
        <span className="edit-log-macro carbs" aria-label={`Carbohidratos: ${formatNumber(preview?.carbsGrams, 1)} gramos`}>
          <small>C</small>
          <strong>{formatNumber(preview?.carbsGrams, 1)}g</strong>
        </span>
        <span className="edit-log-macro fat" aria-label={`Grasas: ${formatNumber(preview?.fatGrams, 1)} gramos`}>
          <small>G</small>
          <strong>{formatNumber(preview?.fatGrams, 1)}g</strong>
        </span>
      </div>
      {preview?.nutrients?.length > 0 && <NutrientDetails nutrients={preview.nutrients} label="Más nutrientes" />}
    </>
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
  const [showIngredients, setShowIngredients] = useState(Boolean(log.recipeAdjusted));
  const [saving, setSaving] = useState(false);
  const [closing, setClosing] = useState(false);
  const [preparations, setPreparations] = useState([]);
  const [selectedFoodId, setSelectedFoodId] = useState(() => log.itemType === "FOOD" ? (log.food?.id || null) : null);
  const item = log.itemType === "RECIPE" ? log.recipe : log.food;
  const isRecipe = log.itemType === "RECIPE";
  const closeWithAnimation = useCallback(() => {
    if (closing || saving) return;
    setClosing(true);
    window.setTimeout(onClose, 180);
  }, [closing, onClose, saving]);
  useEffect(() => {
    if (!item || isRecipe) return;
    api.runAction(
      { title: "Cargando opciones", description: "Estamos buscando las presentaciones disponibles..." },
      () => api.request(`/api/foods/${item.id}/preparations`),
    )
    .then((result) => setPreparations(result || []))
    .catch(() => setPreparations([item]));
  }, [api, isRecipe, item]);
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
    const previewFoodId = selectedFoodId || item.id;
    let active = true;
    api
      .request("/api/foods/preview", {
        method: "POST",
        body: JSON.stringify({
          foodId: previewFoodId,
          quantity: numericQuantity,
          unit: "GRAM",
        }),
      })
      .then((nextPreview) => active && setPreview(nextPreview))
      .catch(() => active && setPreview(null));
    return () => {
      active = false;
    };
  }, [api, ingredients, isRecipe, item, log.itemType, quantity, selectedFoodId]);
  function updateIngredient(index, value) {
    setIngredients((current) => current.map((ingredient, currentIndex) => currentIndex === index ? { ...ingredient, quantity: value } : ingredient));
  }
  async function resetRecipe() {
    if (saving || !isRecipe) return;
    setSaving(true);
    try {
      await api.runAction(
        { title: "Restableciendo receta", description: "Estamos recuperando los ingredientes originales..." },
        () => api.request(`/api/nutrition/food-logs/${log.id}/recipe-ingredients`, { method: "DELETE" }),
      );
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
      await api.runAction(
        { title: "Guardando cambios", description: "Estamos actualizando tu registro..." },
        async () => {
          const body = {
            mealType,
            quantity: numericQuantity,
            unit: log.unit || "GRAM",
            logDate: log.logDate,
          };
          if (!isRecipe && selectedFoodId && selectedFoodId !== log.food?.id) {
            body.itemId = selectedFoodId;
          }
          await api.request(isRecipe ? `/api/nutrition/food-logs/${log.id}/recipe` : `/api/nutrition/food-logs/${log.id}`, {
            method: "PUT",
            body: JSON.stringify(isRecipe
              ? { mealType, quantity: numericQuantity, logDate: log.logDate, recipeIngredients: ingredients.map(({ foodId, quantity: ingredientQuantity, unit }) => ({ foodId, quantity: Number(ingredientQuantity), unit })) }
              : body),
          });
        },
      );
      api.notify(isRecipe ? "Receta diaria actualizada." : "Registro actualizado.");
      setClosing(true);
      window.setTimeout(onDone, 180);
    } catch {
      api.notify("No se pudo actualizar el registro.", "error");
      setSaving(false);
    }
  }
  return (
    <FoodLogDialog
      item={item}
      eyebrow="Editar registro"
      isRecipe={isRecipe}
      closing={closing}
      onClose={closeWithAnimation}
      onSubmit={submit}
      titleId="edit-log-title"
      footer={
        <footer className="modal-actions">
          <button type="button" className="secondary" onClick={closeWithAnimation}>
            Cancelar
          </button>
          <button className="primary" disabled={saving || Number(quantity) <= 0}>
            {saving ? "Guardando…" : "Guardar cambios"}
          </button>
        </footer>
      }
    >
          <FoodLogForm
            mode="edit"
            isRecipe={isRecipe}
            quantity={quantity}
            onQuantityChange={(value) => setQuantity(value)}
            unit={log.unit || "GRAM"}
            mealType={mealType}
            mealTypeOptions={mealTypes.map((meal) => ({ value: meal.code, label: meal.label }))}
            onMealTypeChange={(value) => setMealType(value)}
            preparations={preparations}
            preparationValue={selectedFoodId}
            onPreparationChange={(id) => setSelectedFoodId(id)}
            recipeIngredients={isRecipe ? ingredients : null}
            onRecipeIngredientChange={updateIngredient}
            showIngredients={showIngredients}
            onToggleIngredients={() => setShowIngredients((current) => !current)}
            onResetRecipe={log.recipeAdjusted ? resetRecipe : null}
            saving={saving}
            logId={log.id}
            preview={preview}
          />
    </FoodLogDialog>
  );
}
