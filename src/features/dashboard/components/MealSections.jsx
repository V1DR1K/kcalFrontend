import React, { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Icon } from "../../../components/Icon";
import { CatalogStatus, FoodThumb, NutrientDetails, PreparationBadge, categoryLabel, preparationLabel } from "../../catalog/CatalogComponents";
import { EditFoodLog, FoodLogDialog, FoodLogForm } from "../../foods/FoodComponents";
import { formatNumber, readableDate } from "../../../utils/format";
import { foodPreparationSuffix, formatMealLogAmount, isCopyableMealLog, macroCalories, macroValue, mealLogItem, mealLogName, mealTotals, savedAiEstimate, scaleFoodNutrition } from "../dashboard.utils";
import { NutritionPills } from "./DashboardSections";

export { MealCard, MealLogDetails, RecipeIngredientDetail, SwipeableMealItem };

function MealCard({ mealType, meal, yesterdayMeal, targetDate, api, onCopied, onOptimisticAdd, onOptimisticRemove, onOptimisticRollback, clipboard, bulkActionLoading, setBulkActionLoading, onCopyMeal, deletingLogId, movingLogId, resetSignal, onAdd, onEdit, onDelete, onMove, entryDelay = 0 }) {
  const items = meal?.items || [];
  const cardRef = useRef(null);
  const menuRef = useRef(null);
  const [expandedLogId, setExpandedLogId] = useState(null);
  const [suggestionState, setSuggestionState] = useState("idle");
  const [bulkActionState, setBulkActionState] = useState("idle");
  const yesterdayItems = (yesterdayMeal?.items || []).filter(isCopyableMealLog);
  useEffect(() => setSuggestionState("idle"), [targetDate, mealType.code]);
  useEffect(() => setExpandedLogId(null), [targetDate, mealType.code, resetSignal]);
  useEffect(() => {
    if (!expandedLogId) return undefined;
    function closeFromOutside(event) {
      if (!cardRef.current?.contains(event.target)) setExpandedLogId(null);
    }
    function closeFromKeyboard(event) {
      if (event.key === "Escape") setExpandedLogId(null);
    }
    document.addEventListener("pointerdown", closeFromOutside);
    document.addEventListener("keydown", closeFromKeyboard);
    return () => {
      document.removeEventListener("pointerdown", closeFromOutside);
      document.removeEventListener("keydown", closeFromKeyboard);
    };
  }, [expandedLogId]);
  async function copyYesterday() {
    setSuggestionState("copying");
    const optimisticLogs = onOptimisticAdd(yesterdayItems, mealType.code);
    try {
      await api.runAction(
        { title: "Copiando comida", description: "Estamos guardando los alimentos de ayer..." },
        async () => {
          await createMealLogs(api, yesterdayItems, mealType.code, targetDate);
          setSuggestionState("copied");
          api.notify(`${mealType.label} copiado de ayer.`);
          await new Promise((resolve) => window.setTimeout(resolve, 650));
          await onCopied();
        },
        { quiet: true },
      );
    } catch {
      onOptimisticRollback(optimisticLogs);
      setSuggestionState("idle");
      api.notify("No se pudo copiar la comida de ayer.", "error");
    }
  }
  async function addLogs(logs) {
    if (bulkActionLoading) return;
    const copyableLogs = logs.filter(isCopyableMealLog);
    if (!copyableLogs.length) return;
    setBulkActionLoading(true);
    setBulkActionState("pasting");
    const optimisticLogs = onOptimisticAdd(copyableLogs, mealType.code);
    try {
      await api.runAction(
        { title: "Pegando comida", description: "Estamos guardando los alimentos..." },
        async () => {
          await createMealLogs(api, copyableLogs, mealType.code, targetDate);
          api.notify(`Comida pegada en ${mealType.label}.`);
          await onCopied();
          setBulkActionState("success");
          window.setTimeout(() => setBulkActionState("idle"), 700);
        },
        { quiet: true },
      );
    } catch {
      onOptimisticRollback(optimisticLogs);
      setBulkActionState("error");
      api.notify("No se pudo pegar la comida. Se revirtieron los cambios.", "error");
      window.setTimeout(() => setBulkActionState("idle"), 700);
    }
    finally { setBulkActionLoading(false); }
  }
  async function deleteAll() {
    if (!items.length || bulkActionLoading) return;
    const confirmed = await api.confirm({
      title: `¿Borrar ${mealType.label.toLowerCase()}?`,
      description: "Se eliminarán todos los alimentos de esta comida.",
      confirmLabel: "Borrar todo",
    });
    if (!confirmed) return;
    setBulkActionLoading(true);
    setBulkActionState("deleting");
    const restore = onOptimisticRemove(items);
    try {
      await api.runAction(
        { title: `Borrando ${mealType.label.toLowerCase()}`, description: "Estamos eliminando los alimentos..." },
        async () => {
          await api.request(`/api/nutrition/food-logs?mealType=${mealType.code}&date=${targetDate}`, { method: "DELETE" });
          api.notify(`${mealType.label} eliminado.`);
          await onCopied();
          setBulkActionState("success");
          window.setTimeout(() => setBulkActionState("idle"), 700);
        },
        { quiet: true },
      );
    }
    catch {
      restore();
      setBulkActionState("error");
      api.notify("No se pudo borrar toda la comida. Se revirtieron los cambios.", "error");
      window.setTimeout(() => setBulkActionState("idle"), 700);
    }
    finally { setBulkActionLoading(false); }
  }
  function copyAll() {
    const copyableItems = items.filter(isCopyableMealLog);
    if (!copyableItems.length || bulkActionLoading) return;
    menuRef.current?.removeAttribute("open");
    onCopyMeal(copyableItems);
    setBulkActionState("success");
    window.setTimeout(() => setBulkActionState("idle"), 700);
  }
  return (
    <article
      ref={cardRef}
      className="meal-card action-surface"
      data-action-state={bulkActionState}
      data-meal-type={mealType.code}
      style={{ "--meal-delay": `${entryDelay}ms` }}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setExpandedLogId(null);
      }}
    >
      <header>
        <div className="meal-heading">
          <Icon name="restaurant" />
          <div><span>{mealType.label}</span><strong>{meal?.calories || 0} kcal</strong></div>
        </div>
        <div className="meal-header-actions">
          <details className="meal-menu" ref={menuRef}><summary aria-label={`Acciones de ${mealType.label}`}><Icon name="more_vert" /></summary><div><button className="action-control" disabled={!items.length || bulkActionLoading} onClick={copyAll}>Copiar todo</button><button className="action-control" disabled={!clipboard?.length || bulkActionLoading} onClick={() => { menuRef.current?.removeAttribute("open"); addLogs(clipboard); }}>Pegar</button><button className="danger-text action-control" disabled={!items.length || bulkActionLoading} onClick={() => { menuRef.current?.removeAttribute("open"); deleteAll(); }}>Borrar todo</button></div></details>
          <button className="icon-button action-control" aria-label={`Agregar alimento a ${mealType.label}`} onClick={onAdd}><Icon name="add" /></button>
        </div>
      </header>
      <div className="meal-macros">
        <small>P {formatNumber(meal?.proteinGrams, 1)}g</small>
        <small>C {formatNumber(meal?.carbsGrams, 1)}g</small>
        <small>G {formatNumber(meal?.fatGrams, 1)}g</small>
      </div>
      {!items.length && yesterdayItems.length > 0 && suggestionState !== "dismissed" && (
        <div className={`yesterday-suggestion ${suggestionState === "copied" ? "copied" : ""}`}>
          <Icon name="content_copy" />
          <span><strong>¿Copiar de ayer?</strong><small>{yesterdayItems.length} {yesterdayItems.length === 1 ? "elemento" : "elementos"}</small></span>
          <button className="copy-accept" disabled={suggestionState === "copying" || suggestionState === "copied"} aria-label={`Copiar ${mealType.label} de ayer`} onClick={copyYesterday}><Icon name={suggestionState === "copied" ? "check_circle" : "check"} /></button>
          <button className="copy-reject" disabled={suggestionState === "copying" || suggestionState === "copied"} aria-label="Descartar sugerencia" onClick={() => setSuggestionState("dismissed")}><Icon name="close" /></button>
          {suggestionState === "copied" && (
            <span className="copy-confetti" aria-hidden="true">
              <i />
              <i />
              <i />
              <i />
              <i />
              <i />
              <i />
              <i />
            </span>
          )}
        </div>
      )}
      {items.length ? (
        items.map((log) => {
            const item = mealLogItem(log);
          return (
            <SwipeableMealItem
              className={`${movingLogId === log.id ? "moving" : ""} ${deletingLogId === log.id ? "deleting" : ""} ${log.optimistic ? "optimistic" : ""}`}
              key={log.id}
              resetSignal={resetSignal}
              expanded={expandedLogId === log.id}
              onToggle={() => setExpandedLogId((current) => (current === log.id ? null : log.id))}
              onEdit={() => onEdit(log)} onDelete={() => onDelete(log)}
              onMove={onMove}
              disabled={Boolean(deletingLogId) || Boolean(movingLogId) || bulkActionLoading}
              dragData={log.optimistic ? null : { ...log, mealType: mealType.code }}
              details={<MealLogDetails log={log} item={item} />}
            >
              <FoodThumb item={item} compact />
              <span className="meal-item-copy"><span>{item.name}</span><small>{formatMealLogAmount(log)}{log.itemType === "FOOD" ? foodPreparationSuffix(log.food) : ""}</small></span>
              <strong>{log.calories} kcal</strong>
            </SwipeableMealItem>
          );
        })
      ) : (
        <div className="history-empty dashboard-food-empty"><Icon name="no_meals" /><strong>Sin alimentos registrados</strong><small>Todavía no cargaste nada. Usá el botón + para agregar comida.</small></div>
      )}
    </article>
  );
}

function MealLogDetails({ log, item }) {
  if (log.itemType === "RECIPE") {
    const ingredients = aggregateRecipeIngredients(item?.ingredients || []);
    return (
      <div className="meal-item-detail recipe-meal-item-detail">
        <div className="meal-detail-summary">
          <span><small>Porciones</small><strong>{formatNumber(log.quantity, 1)}</strong></span>
          <span><small>Peso interno</small><strong>{formatNumber(item?.totalWeightGrams, 1)}g</strong></span>
        </div>
        <NutritionPills nutrition={log} />
        {log.recipeAdjusted && <small className="daily-recipe-note">Versión ajustada para este día</small>}
        <div className="recipe-detail-list">
          {ingredients.length ? ingredients.map((ingredient) => (
            <RecipeIngredientDetail ingredient={ingredient} key={ingredient.key} />
          )) : (
            <p className="meal-detail-empty">Esta receta todavia no trae ingredientes.</p>
          )}
        </div>
      </div>
    );
  }
  if (log.itemType === "AI_ESTIMATE") {
    const estimate = savedAiEstimate(log);
    return (
      <div className="meal-item-detail ai-log-detail">
        <div className="meal-detail-summary">
          <span><small>Origen</small><strong>Estimado por IA</strong></span>
          <span><small>Confianza</small><strong>{estimate.confidence}%</strong></span>
        </div>
        <NutritionPills nutrition={log} />
        {estimate.items.length > 0 && <div className="ai-log-items">{estimate.items.map((entry, index) => <span key={`${entry.name}:${index}`}><strong>{entry.name}</strong><small>{formatNumber(entry.estimatedGrams, 0)} g · {formatNumber(macroCalories(entry.proteinGrams, entry.carbsGrams, entry.fatGrams))} kcal</small></span>)}</div>}
        {(estimate.assumptions || []).length > 0 && <ul className="ai-estimate-assumptions">{estimate.assumptions.map((assumption) => <li key={assumption}>{assumption}</li>)}</ul>}
      </div>
    );
  }
  return (
    <div className="meal-item-detail">
      <div className="meal-detail-summary">
        <span><small>Cantidad</small><strong>{formatMealLogAmount(log)}</strong></span>
        <span><small>{log.itemType === "AI_ESTIMATE" ? "Origen" : "Alimento"}</small><strong>{item?.name}</strong></span>
      </div>
      <NutritionPills nutrition={log} />
    </div>
  );
}

function aggregateRecipeIngredients(ingredients) {
  const grouped = new Map();
  for (const ingredient of ingredients) {
    const food = ingredient.food || {};
    const key = food.id ? `food:${food.id}` : `name:${food.name || "Alimento"}`;
    const quantity = Number(ingredient.quantity || 0);
    const nutrition = scaleFoodNutrition(food, quantity);
    const current = grouped.get(key);
    if (current) {
      current.quantity += quantity;
      current.nutrition.proteinGrams += nutrition.proteinGrams;
      current.nutrition.carbsGrams += nutrition.carbsGrams;
      current.nutrition.fatGrams += nutrition.fatGrams;
    } else {
      grouped.set(key, { ...ingredient, key, quantity, food, nutrition });
    }
  }
  return [...grouped.values()].map((ingredient) => ({
    ...ingredient,
    nutrition: {
      ...ingredient.nutrition,
      calories: macroCalories(ingredient.nutrition.proteinGrams, ingredient.nutrition.carbsGrams, ingredient.nutrition.fatGrams),
    },
  }));
}

function RecipeIngredientDetail({ ingredient }) {
  const food = ingredient.food || {};
  const nutrition = ingredient.nutrition || scaleFoodNutrition(food, ingredient.quantity);
  return (
    <div className="recipe-ingredient-detail">
      <span className="recipe-ingredient-main">
        <FoodThumb item={{ ...food, type: "FOOD" }} compact />
        <span><strong>{food.name || "Alimento"}</strong><small>{formatNumber(ingredient.quantity, 1)} g{foodPreparationSuffix(food)}</small></span>
        <strong className="recipe-ingredient-kcal">{formatNumber(nutrition.calories)} kcal</strong>
      </span>
    </div>
  );
}

function SwipeableMealItem({ children, className = "", resetSignal, expanded = false, onToggle, details, onEdit, onDelete, disabled = false, dragData, onMove }) {
  const gesture = useRef(null);
  const holdTimer = useRef(null);
  const shellRef = useRef(null);
  const offsetRef = useRef(0);
  const suppressClick = useRef(false);
  const [offset, setOffset] = useState(0);
  const [revealed, setRevealed] = useState("");
  const [horizontalDragging, setHorizontalDragging] = useState(false);
  const [interactionMode, setInteractionMode] = useState("idle");
  const [dragPosition, setDragPosition] = useState(null);
  const setSwipeOffset = useCallback((nextOffset) => {
    offsetRef.current = nextOffset;
    setOffset(nextOffset);
  }, []);
  const close = useCallback(() => {
    const activeGesture = gesture.current;
    if (activeGesture?.kind === "pointer"
      && shellRef.current?.hasPointerCapture?.(activeGesture.pointerId)) {
      shellRef.current.releasePointerCapture(activeGesture.pointerId);
    }
    if (holdTimer.current) window.clearTimeout(holdTimer.current);
    holdTimer.current = null;
    gesture.current = null;
    setHorizontalDragging(false);
    setInteractionMode("idle");
    setDragPosition(null);
    setRevealed("");
    setSwipeOffset(0);
    document.querySelectorAll(".meal-card.drag-over").forEach((card) => card.classList.remove("drag-over"));
  }, [setSwipeOffset]);
  useEffect(() => close(), [close, resetSignal]);
  useEffect(() => {
    if (expanded && revealed) close();
  }, [expanded, close, revealed]);
  function finishSwipe() {
    const finalOffset = offsetRef.current;
    if (gesture.current?.axis === "x" && finalOffset > SWIPE_ACTION_WIDTH * 0.65) {
      suppressClick.current = true;
      setRevealed("edit");
      setSwipeOffset(SWIPE_ACTION_WIDTH);
    } else if (gesture.current?.axis === "x" && finalOffset < -SWIPE_ACTION_WIDTH * 0.65) {
      suppressClick.current = true;
      setRevealed("delete");
      setSwipeOffset(-SWIPE_ACTION_WIDTH);
    } else {
      if (gesture.current?.axis === "x") suppressClick.current = true;
      close();
    }
    gesture.current = null;
    setHorizontalDragging(false);
    if (suppressClick.current) window.setTimeout(() => { suppressClick.current = false; }, 220);
    setInteractionMode("idle");
  }
  function clearDropTarget() {
    document.querySelectorAll(".meal-card.drag-over").forEach((card) => card.classList.remove("drag-over"));
  }
  function updateDropTarget(clientX, clientY) {
    clearDropTarget();
    const target = document.elementFromPoint(clientX, clientY)?.closest(".meal-card[data-meal-type]");
    target?.classList.add("drag-over");
    return target?.dataset.mealType || null;
  }
  function startLongPress() {
    if (!gesture.current || gesture.current.mode !== "holding") return;
    gesture.current.mode = "dragging";
    suppressClick.current = true;
    setInteractionMode("dragging");
    setDragPosition({ x: gesture.current.x, y: gesture.current.y });
  }
  function handlePointerDown(event) {
    if (event.pointerType === "touch") return;
    if (disabled || !dragData || event.target.closest(".meal-item-detail-actions, .swipe-action") || event.pointerType === "mouse" && event.button !== 0) return;
    shellRef.current?.setPointerCapture?.(event.pointerId);
    gesture.current = { kind: "pointer", pointerId: event.pointerId, x: event.clientX, y: event.clientY, axis: null, mode: "holding" };
    setInteractionMode("holding");
    holdTimer.current = window.setTimeout(startLongPress, LONG_PRESS_DURATION);
  }
  function handleTouchStart(event) {
    if (disabled || !dragData || event.target.closest(".meal-item-detail-actions, .swipe-action") || event.touches.length !== 1) return;
    const touch = event.changedTouches[0];
    gesture.current = { kind: "touch", touchId: touch.identifier, x: touch.clientX, y: touch.clientY, axis: null, mode: "holding" };
    setInteractionMode("holding");
    holdTimer.current = window.setTimeout(startLongPress, LONG_PRESS_DURATION);
  }
  function handlePointerMove(event) {
    const current = gesture.current;
    if (!current || current.kind !== "pointer" || current.pointerId !== event.pointerId) return;
    if (current.mode === "dragging") {
      if (event.cancelable) event.preventDefault();
      setDragPosition({ x: event.clientX, y: event.clientY });
      updateDropTarget(event.clientX, event.clientY);
      return;
    }
    const dx = event.clientX - current.x;
    const dy = event.clientY - current.y;
    if (!current.axis && Math.max(Math.abs(dx), Math.abs(dy)) > LONG_PRESS_MOVE_TOLERANCE) {
      if (holdTimer.current) window.clearTimeout(holdTimer.current);
      holdTimer.current = null;
      current.axis = Math.abs(dx) > Math.abs(dy) * 1.8 ? "x" : "y";
      setInteractionMode(current.axis === "x" ? "swiping" : "scrolling");
      if (current.axis === "y") {
        setHorizontalDragging(false);
        setSwipeOffset(0);
      }
    }
    if (current.axis === "x") {
      if (event.cancelable) event.preventDefault();
      setHorizontalDragging(true);
      setSwipeOffset(Math.max(-SWIPE_ACTION_WIDTH, Math.min(SWIPE_ACTION_WIDTH, dx)));
    }
  }
  function handlePointerUp(event) {
    const current = gesture.current;
    if (!current || current.kind !== "pointer" || current.pointerId !== event.pointerId) return;
    if (current.mode === "dragging") {
      if (event.cancelable) event.preventDefault();
      const targetMealType = updateDropTarget(event.clientX, event.clientY);
      clearDropTarget();
      onMove?.(dragData, targetMealType);
      close();
      window.setTimeout(() => { suppressClick.current = false; }, 220);
      return;
    }
    if (current.axis === "x") {
      finishSwipe();
      return;
    }
    close();
  }
  function handlePointerCancel(event) {
    if (!gesture.current || gesture.current.kind !== "pointer" || gesture.current.pointerId !== event.pointerId) return;
    close();
    if (suppressClick.current) window.setTimeout(() => { suppressClick.current = false; }, 220);
  }
  function touchForGesture(event) {
    const current = gesture.current;
    return current?.kind === "touch"
      ? [...event.touches, ...event.changedTouches].find((touch) => touch.identifier === current.touchId)
      : null;
  }
  function handleTouchMove(event) {
    const current = gesture.current;
    const touch = touchForGesture(event);
    if (!current || !touch) return;
    if (current.mode === "dragging") {
      event.preventDefault();
      setDragPosition({ x: touch.clientX, y: touch.clientY });
      updateDropTarget(touch.clientX, touch.clientY);
      return;
    }
    const dx = touch.clientX - current.x;
    const dy = touch.clientY - current.y;
    if (!current.axis && Math.max(Math.abs(dx), Math.abs(dy)) > LONG_PRESS_MOVE_TOLERANCE) {
      if (holdTimer.current) window.clearTimeout(holdTimer.current);
      holdTimer.current = null;
      current.axis = Math.abs(dx) > Math.abs(dy) * 1.8 ? "x" : "y";
      current.mode = current.axis === "x" ? "swiping" : "scrolling";
      setInteractionMode(current.mode);
      if (current.axis === "y") {
        suppressClick.current = true;
        setHorizontalDragging(false);
        setSwipeOffset(0);
      }
    }
    if (current.axis === "x") {
      event.preventDefault();
      setHorizontalDragging(true);
      setSwipeOffset(Math.max(-SWIPE_ACTION_WIDTH, Math.min(SWIPE_ACTION_WIDTH, dx)));
    }
  }
  function handleTouchEnd(event) {
    const current = gesture.current;
    const touch = [...event.changedTouches].find((entry) => entry.identifier === current?.touchId);
    if (!current || current.kind !== "touch" || !touch) return;
    if (current.mode === "dragging") {
      event.preventDefault();
      const targetMealType = updateDropTarget(touch.clientX, touch.clientY);
      clearDropTarget();
      onMove?.(dragData, targetMealType);
      close();
      window.setTimeout(() => { suppressClick.current = false; }, 220);
      return;
    }
    if (current.axis === "x") {
      finishSwipe();
      return;
    }
    close();
    if (suppressClick.current) window.setTimeout(() => { suppressClick.current = false; }, 220);
  }
  function handleTouchCancel() {
    if (gesture.current?.kind !== "touch") return;
    close();
    if (suppressClick.current) window.setTimeout(() => { suppressClick.current = false; }, 220);
  }
  useEffect(() => {
    if (interactionMode === "idle") return undefined;
    const pointerOptions = { passive: false };
    const touchOptions = { passive: false };
    document.addEventListener("pointermove", handlePointerMove, pointerOptions);
    document.addEventListener("pointerup", handlePointerUp, pointerOptions);
    document.addEventListener("pointercancel", handlePointerCancel, pointerOptions);
    document.addEventListener("touchmove", handleTouchMove, touchOptions);
    document.addEventListener("touchend", handleTouchEnd, touchOptions);
    document.addEventListener("touchcancel", handleTouchCancel, touchOptions);
    return () => {
      document.removeEventListener("pointermove", handlePointerMove, pointerOptions);
      document.removeEventListener("pointerup", handlePointerUp, pointerOptions);
      document.removeEventListener("pointercancel", handlePointerCancel, pointerOptions);
      document.removeEventListener("touchmove", handleTouchMove, touchOptions);
      document.removeEventListener("touchend", handleTouchEnd, touchOptions);
      document.removeEventListener("touchcancel", handleTouchCancel, touchOptions);
    };
  }, [interactionMode]);
  return (
    <div className={`swipe-row ${revealed} ${horizontalDragging ? "swiping" : ""} ${expanded ? "expanded" : ""}`}>
      <button className="swipe-action swipe-edit" aria-label="Editar registro" disabled={disabled} tabIndex={revealed === "edit" ? 0 : -1} aria-hidden={revealed !== "edit"} onClick={() => { close(); onEdit(); }}><Icon name="edit" /></button>
      <button className="swipe-action swipe-delete" aria-label="Eliminar registro" disabled={disabled} tabIndex={revealed === "delete" ? 0 : -1} aria-hidden={revealed !== "delete"} onClick={() => { close(); window.setTimeout(onDelete, 120); }}><Icon name="delete" /></button>
      <div
        ref={shellRef}
        className={`meal-item-shell ${horizontalDragging ? "swiping" : ""} ${interactionMode === "holding" ? "holding" : ""} ${interactionMode === "dragging" ? "dragging" : ""} ${className}`}
        style={{ transform: `translate3d(${offset}px, 0, 0)` }}
        onPointerDown={handlePointerDown}
        onTouchStart={handleTouchStart}
        onContextMenu={(event) => {
          if (dragData) event.preventDefault();
        }}
      >
        <button
          type="button"
          className="meal-item"
          draggable={false}
          aria-expanded={expanded}
          aria-grabbed={interactionMode === "dragging"}
          title="Mantené apretado medio segundo para mover este registro a otra comida"
          onClick={() => !horizontalDragging && !suppressClick.current && onToggle?.()}
        >
          {children}
          <Icon name="expand_more" className="meal-item-chevron" />
        </button>
        {expanded && (
          <>
            {details}
            <div className="meal-item-detail-actions">
              <button type="button" className="secondary" onClick={() => { close(); onEdit(); }}><Icon name="edit" />Editar</button>
              <button type="button" className="secondary danger-text" onClick={() => { close(); onDelete(); }}><Icon name="delete" />Eliminar</button>
            </div>
          </>
        )}
      </div>
      {interactionMode === "dragging" && dragPosition && createPortal(
        <div className="meal-drag-preview" style={{ left: dragPosition.x, top: dragPosition.y }} aria-hidden="true">
          {children}
        </div>,
        document.body,
      )}
    </div>
  );
}

async function compressMealPhoto(file) {
  const source = URL.createObjectURL(file);
  try {
    const image = new Image();
    await new Promise((resolve, reject) => { image.onload = resolve; image.onerror = reject; image.src = source; });
    const scale = Math.min(1, 1280 / Math.max(image.naturalWidth, image.naturalHeight));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
    canvas.getContext("2d").drawImage(image, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.75));
    if (!blob) throw new Error("No pudimos preparar la foto.");
    return new File([blob], "comida.jpg", { type: "image/jpeg" });
  } finally {
    URL.revokeObjectURL(source);
  }
}
