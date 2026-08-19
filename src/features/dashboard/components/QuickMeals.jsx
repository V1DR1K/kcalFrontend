import React, { useState } from "react";
import { Icon } from "../../../components/Icon";
import { FoodThumb } from "../../catalog/CatalogComponents";
import { readRecents } from "../../../services/recents";
import { createMealLogs } from "../dashboard.utils";
import { formatNumber } from "../../../utils/format";

export function QuickItems({ title, items, onPick }) {
  if (!items.length) return null;
  return (
    <section className="quick-items">
      <span>{title}</span>
      <div>
        {items.map((item) => (
          <button key={`${item.type}:${item.id}`} onClick={() => onPick(item)}>
            <span>{item.name}</span>
            {item.type === "FOOD" && item.brand && <small>{item.brand}</small>}
          </button>
        ))}
      </div>
    </section>
  );
}

export function RecentMeals({ user, api, date, mealTypes, onDone, onOptimisticAdd, onOptimisticRollback }) {
  const recents = readRecents(user);
  const meals = (recents.meals || []).map((meal) => {
    const savedItem = (recents.items || []).find((item) => item.id === meal.itemId && item.type === meal.itemType);
    const baseQuantity = meal.itemType === "RECIPE" ? 1 : Number(savedItem?.baseQuantity || 100);
    const estimatedCalories = baseQuantity > 0 ? Math.round(Number(savedItem?.calories || 0) * Number(meal.quantity || 0) / baseQuantity) : 0;
    return { ...meal, imageUrl: meal.imageUrl || savedItem?.imageUrl, category: meal.category || savedItem?.category, calories: meal.calories ?? estimatedCalories };
  });
  const [states, setStates] = useState({});
  async function addRecent(meal) {
    if (states[meal.id] === "adding") return;
    const optimisticLogs = onOptimisticAdd([{
      itemType: meal.itemType,
      food: meal.itemType === "FOOD" ? { id: meal.itemId, name: meal.label, imageUrl: meal.imageUrl, category: meal.category } : null,
      recipe: meal.itemType === "RECIPE" ? { id: meal.itemId, name: meal.label, imageUrl: meal.imageUrl } : null,
      quantity: meal.quantity,
      unit: meal.unit,
      calories: meal.calories,
    }], meal.mealType);
    const startedAt = performance.now();
    setStates((current) => ({ ...current, [meal.id]: "adding" }));
    try {
      await api.runAction(
        { title: "Agregando comida reciente", description: `Estamos sumando ${meal.label} a tu día...` },
        async () => {
          await createMealLogs(api, [meal], meal.mealType, date);
          api.notify(`${meal.label} agregado.`);
          await onDone();
        },
        { quiet: true },
      );
      const elapsed = performance.now() - startedAt;
      if (elapsed < 520) await new Promise((resolve) => window.setTimeout(resolve, 520 - elapsed));
      setStates((current) => ({ ...current, [meal.id]: "added" }));
      window.setTimeout(() => setStates((current) => ({ ...current, [meal.id]: "idle" })), 1300);
    } catch {
      onOptimisticRollback(optimisticLogs);
      setStates((current) => ({ ...current, [meal.id]: "error" }));
      api.notify("No se pudo agregar la comida reciente.", "error");
      window.setTimeout(() => setStates((current) => ({ ...current, [meal.id]: "idle" })), 900);
    }
  }
  if (!meals.length) return <p className="empty-state">Tus comidas recientes aparecerán acá.</p>;
  return (
    <div className="recent-meals">
      {meals.map((meal) => {
        const state = states[meal.id] || "idle";
        const mealLabel = mealTypes.find((type) => type.code === meal.mealType)?.label || meal.mealType;
        const item = { name: meal.label, imageUrl: meal.imageUrl, category: meal.category, type: meal.itemType };
        return (
          <article className={`recent-meal-card ${state}`} key={meal.id}>
            <FoodThumb item={item} compact />
            <span className="recent-meal-copy">
              <strong>{meal.label}</strong>
              <small>{mealLabel} · {meal.itemType === "RECIPE" ? `${formatNumber(meal.quantity, 1)} porción${Number(meal.quantity) === 1 ? "" : "es"}` : `${formatNumber(meal.quantity, 1)} g`}</small>
            </span>
            <strong className="recent-meal-calories">{formatNumber(meal.calories || 0)}<small> kcal</small></strong>
            <button type="button" disabled={state === "adding" || state === "added"} aria-label={`Agregar ${meal.label} a ${mealLabel}`} onClick={() => addRecent(meal)}>
              <Icon name={state === "added" ? "check" : state === "error" ? "refresh" : "add"} />
            </button>
          </article>
        );
      })}
    </div>
  );
}

