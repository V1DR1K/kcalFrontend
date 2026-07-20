import React from "react";
import { CATEGORY_OPTIONS, PREPARATION_OPTIONS, CATEGORY_ART, RECIPE_ART } from "../../config/app";
import { Icon } from "../../components/Icon";
import { formatNumber } from "../../utils/format";

export function CatalogStatus({ children, error = false }) {
  return (
    <div className={`catalog-status ${error ? "error" : ""}`} role={error ? "alert" : "status"}>
      {children}
    </div>
  );
}

function foodMeta(item) {
  if (!item || item.type === "RECIPE") return "";
  const parts = [];
  if (item.brand) parts.push(item.brand);
  const category = categoryLabel(item.category);
  if (category && category !== item.brand) parts.push(category);
  return parts.join(" · ");
}

export function CategoryChips({ category, setCategory }) {
  return (
    <div className="chips" aria-label="Filtrar por categoría">
      {[{ value: "", label: "Todos" }, ...CATEGORY_OPTIONS].map(({ value, label }) => (
        <button key={label} className={category === value ? "selected" : ""} aria-pressed={category === value} onClick={() => setCategory(value)}>
          {label}
        </button>
      ))}
    </div>
  );
}

export function CatalogRow({ item, onPick }) {
  return (
    <button className="catalog-row" onClick={() => onPick(item)}>
      <span>{item.name}</span>
      {foodMeta(item) && <em className="food-brand-line">{foodMeta(item)}</em>}
      <PreparationBadge food={item} />
      <small>
        {item.calories} kcal · P {formatNumber(item.proteinGrams, 1)}g · C {formatNumber(item.carbsGrams, 1)}g · G {formatNumber(item.fatGrams, 1)}g
      </small>
    </button>
  );
}

export function groupFoodVariants(items) {
  const grouped = new Map();
  for (const item of items || []) {
    const key = item.preparationGroup ? `preparation:${item.preparationGroup}` : `item:${item.type || "FOOD"}:${item.id}`;
    const current = grouped.get(key);
    if (!current || (item.preparation === "COOKED" && current.preparation !== "COOKED")) grouped.set(key, item);
  }
  return [...grouped.values()];
}

export function CatalogCard({ item, onAdd }) {
  return (
    <article className="food-card">
      <FoodThumb item={item} />
      <div>
        <h3>{item.name}</h3>
        <p>{item.type === "RECIPE" ? `Receta completa · ${formatNumber(item.totalWeightGrams)}g internos` : foodMeta(item) || categoryLabel(item.category)}</p>
        {item.type === "FOOD" && <PreparationBadge food={item} />}
      </div>
      <strong>{item.calories} kcal</strong>
      {item.type === "FOOD" && (
        <button className="icon-button add-food" onClick={onAdd} aria-label={`Agregar ${item.name}`}>
          <Icon name="add" />
        </button>
      )}
    </article>
  );
}
export function CatalogRowWithImage({ item, onPick }) {
  return (
    <button className="catalog-row catalog-row-image" onClick={() => onPick(item)}>
      <FoodThumb item={item} compact />
      <span className="catalog-copy">
        <strong>{item.name}</strong>
        {foodMeta(item) && <em className="food-brand-line">{foodMeta(item)}</em>}
        <PreparationBadge food={item} />
        <small>
          {item.calories} kcal · P {formatNumber(item.proteinGrams, 1)}g · C {formatNumber(item.carbsGrams, 1)}g · G {formatNumber(item.fatGrams, 1)}g
        </small>
      </span>
       <Icon name="chevron_right" className="row-action" />
    </button>
  );
}

export function FoodThumb({ item, compact = false, hero = false }) {
  const fallback = item?.type === "RECIPE" ? RECIPE_ART : CATEGORY_ART[item?.category] || CATEGORY_ART.OTHER;
  return (
    <div className={`food-thumb ${compact ? "compact" : ""} ${hero ? "hero" : ""}`}>
      <img
        src={item?.imageUrl || fallback}
        onError={(event) => {
          event.currentTarget.onerror = null;
          event.currentTarget.src = fallback;
        }}
        alt=""
      />
    </div>
  );
}

export function PreparationBadge({ food, showUnknown = false }) {
  if (!food || food.type === "RECIPE") return null;
  const option = PREPARATION_OPTIONS.find(({ value }) => value === food.preparation);
  if (!option || (!showUnknown && food.preparation === "UNSPECIFIED")) return null;
  return (
    <small className={`preparation-badge preparation-${food.preparation.toLowerCase()}`} title={food.preparationSource || undefined}>
      {option.label}
    </small>
  );
}

export function preparationLabel(preparation) {
  return PREPARATION_OPTIONS.find(({ value }) => value === preparation)?.label || "Sin especificar";
}
export function categoryLabel(category) {
  return CATEGORY_OPTIONS.find((option) => option.value === category)?.label || "Otros";
}
