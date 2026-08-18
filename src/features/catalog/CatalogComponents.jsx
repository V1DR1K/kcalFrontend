import React, { useState } from "react";
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
        loading="lazy"
        decoding="async"
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

const NUTRIENT_GROUPS = [["MACRO", "Macronutrientes"], ["FAT", "Grasas"], ["CARBOHYDRATE", "Carbohidratos"], ["MINERAL", "Minerales"], ["VITAMIN", "Vitaminas"]];

function nutrientStatusLabel(status) {
  if (status === "ESTIMATED") return "Estimado por IA";
  if (status === "VERIFIED") return "Fuente externa";
  if (status === "PARTIAL" || status === "LEGACY") return "Perfil parcial";
  return "Sin dato";
}

export function NutrientDetails({ nutrients = [], label = "Información nutricional", defaultOpen = false }) {
  return (
    <details className="nutrient-details" open={defaultOpen || undefined}>
      <summary>{label}<span>Ver detalle</span></summary>
      <div className="nutrient-groups">
        {NUTRIENT_GROUPS.map(([group, title]) => {
          const values = (nutrients || []).filter((item) => item.group === group);
          if (!values.length) return null;
          return <section key={group}><h4>{title}</h4><div className="nutrient-grid">{values.map((item) => (
            <span key={item.code} className={item.status === "MISSING" ? "missing" : ""}>
              <small>{item.name}</small>
              <strong>{item.value == null ? "Sin dato" : `${formatNumber(item.value, 1)} ${item.unit}`}</strong>
              <em>{nutrientStatusLabel(item.status)}</em>
            </span>
          ))}</div></section>;
        })}
      </div>
    </details>
  );
}

export function NutrientEditor({ api, food, onSaved }) {
  const [open, setOpen] = useState(false);
  const [definitions, setDefinitions] = useState([]);
  const [values, setValues] = useState({});
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  async function start() {
    if (open) return setOpen(false);
    setMessage("");
    try {
      const result = await api.request("/api/foods/nutrient-definitions");
      setDefinitions(result || []);
      setValues(Object.fromEntries((food?.nutrients || []).filter((item) => item.value != null).map((item) => [item.code, item.value])));
      setOpen(true);
    } catch (error) { setMessage(error.message || "No se pudieron cargar los nutrientes."); }
  }
  async function save() {
    if (saving) return;
    setSaving(true); setMessage("");
    try {
      const nutrients = Object.entries(values).filter(([, value]) => value !== "" && Number.isFinite(Number(value))).map(([code, value]) => ({ code, value: Number(value) }));
      const updated = await api.request(`/api/foods/${food.id}/nutrients`, { method: "PUT", body: JSON.stringify({ nutrients }) });
      onSaved?.(updated); setOpen(false); setMessage("Nutrientes actualizados.");
    } catch (error) { setMessage(error.message || "No se pudieron guardar los nutrientes."); }
    finally { setSaving(false); }
  }
  return <section className="nutrient-editor">
    <button type="button" className="secondary" onClick={start}>{open ? "Cerrar edición" : "Editar nutrientes"}</button>
    {open && <div className="nutrient-editor-fields">{definitions.map((item) => <label key={item.code}><span>{item.name} <small>({item.unit})</small></span><input inputMode="decimal" min="0" step="0.1" value={values[item.code] ?? ""} onChange={(event) => setValues((current) => ({ ...current, [item.code]: event.target.value.replace(",", ".").replace(/[^\d.]/g, "") }))} placeholder="Sin dato" /></label>)}<button type="button" className="primary" disabled={saving} onClick={save}>{saving ? "Guardando…" : "Guardar nutrientes"}</button></div>}
    {message && <small className="nutrient-editor-message" role="status">{message}</small>}
  </section>;
}
