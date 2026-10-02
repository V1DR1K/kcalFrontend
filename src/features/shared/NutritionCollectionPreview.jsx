import React from "react";
import { Icon } from "../../components/Icon";
import { FoodThumb } from "../catalog/CatalogComponents";
import { formatMeasure, formatNutrient, formatNumber } from "../../utils/format";

export function NutritionMetrics({ totals, compact = false }) {
  const values = [
    ["kcal", formatNutrient(totals?.calories)],
    ["Proteínas", formatNutrient(totals?.proteinGrams, 1, "g")],
    ["Carbohidratos", formatNutrient(totals?.carbsGrams, 1, "g")],
    ["Grasas", formatNutrient(totals?.fatGrams, 1, "g")],
  ];
  return <><div className={`collection-metrics ${compact ? "compact" : ""}`.trim()} aria-label="Resumen nutricional">
    {values.map(([label, value]) => <span key={label}><small>{label}</small><strong>{value}</strong></span>)}
  </div>{totals?.nutritionComplete === false && <p className="collection-partial-notice">Totales parciales · {totals.knownTotals?.calories == null ? "Calorías sin dato" : `${formatNumber(totals.knownTotals.calories)} calorías informadas`} · hay información pendiente.</p>}</>;
}

function itemImage(item) {
  return { ...item, type: item.type || item.itemType || "FOOD", name: item.name || item.displayName };
}

function itemAmount(item) {
  return formatMeasure(item.quantity, item.unit || "GRAM");
}

export function NutritionCollectionPreview({
  title,
  description,
  status,
  heroItems = [],
  totals,
  groups = [],
  actions,
  onBack,
  backLabel = "Volver a la biblioteca",
  empty = false,
  showTitle = true,
}) {
  if (empty) return <div className="collection-preview-empty"><Icon name="visibility" /><strong>Elegí un elemento para ver sus detalles acá</strong><span>Vas a revisar su contenido y sus totales antes de usarlo.</span></div>;
  return <div className="collection-preview">
    {onBack && <button type="button" className="collection-preview-back" onClick={onBack}><Icon name="arrow_back" />{backLabel}</button>}
    <div className="collection-preview-hero">
      <div className={`collection-preview-image-stack count-${Math.min(heroItems.length, 4)}`}>
        {(heroItems.length ? heroItems : [{ type: "RECIPE", name: title }]).slice(0, 4).map((item, index) => <FoodThumb key={`${item.id || item.itemId || item.name}-${index}`} item={itemImage(item)} />)}
      </div>
      <div className="collection-preview-heading">{showTitle && <h2 tabIndex="-1">{title}</h2>}{status && <small>{status}</small>}</div>
    </div>
    {description && <p className="collection-preview-description">{description}</p>}
    <NutritionMetrics totals={totals} />
    <div className="collection-preview-groups">
      {groups.map((group) => <section className="collection-preview-group" key={group.id || group.label}>
        <h3><Icon name={group.icon || "restaurant"} />{group.label}<small>{group.items.length}</small></h3>
        <div className="collection-preview-items">
          {group.items.map((item, index) => <div className="collection-preview-item" key={`${item.id || item.itemId || item.name || item.displayName}-${index}`}>
            <FoodThumb item={itemImage(item)} compact />
            <span><strong>{item.name || item.displayName || "Alimento"}</strong><small>{itemAmount(item)}</small></span>
            <b>{formatNutrient(item.calories, 0, "kcal")}</b>
          </div>)}
        </div>
      </section>)}
    </div>
    {actions && <div className="collection-preview-actions">{actions}</div>}
  </div>;
}
