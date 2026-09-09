import React, { useEffect, useMemo, useRef, useState } from "react";
import { DEFAULT_MEALS } from "../../config/app";
import { Icon } from "../../components/Icon";
import { ModalShell } from "../../components/dialog/ModalShell";
import { SkeletonRows } from "../../components/Loading";
import { CatalogStatus } from "../catalog/CatalogComponents";
import { FoodPicker } from "../dashboard/dialogs/FoodPickerDialog";
import { mealTotals } from "../dashboard/dashboard.utils";
import { decimalNumber, normalizeDecimalInput } from "../../utils/decimal";
import { formatNumber, readableDate, today } from "../../utils/format";

function presetItemFromLog(log, mealType) {
  const itemType = log.itemType || log.type;
  const item = itemType === "RECIPE" ? log.recipe : log.food;
  return {
    itemType,
    itemId: item?.id || null,
    mealType,
    quantity: decimalNumber(log.quantity || 0),
    unit: log.unit || (itemType === "RECIPE" ? "PORTION" : "GRAM"),
    displayName: item?.name || log.displayName || (itemType === "AI_ESTIMATE" ? "Comida estimada" : "Alimento"),
    calories: Number(log.calories || 0),
    proteinGrams: Number(log.proteinGrams || 0),
    carbsGrams: Number(log.carbsGrams || 0),
    fatGrams: Number(log.fatGrams || 0),
    ...(itemType === "AI_ESTIMATE" ? { aiEstimateConfidence: log.aiEstimateConfidence || 0, aiEstimateDetails: log.aiEstimateDetails || "{}" } : {}),
  };
}

function itemsFromDay(data) {
  return (data?.meals || []).flatMap((meal) => (meal.items || []).map((item) => presetItemFromLog(item, meal.mealType)));
}

function mealLabel(code) {
  return DEFAULT_MEALS.find((meal) => meal.code === code)?.label || code || "Comida";
}

function NutritionStats({ totals, compact = false }) {
  return <div className={`abm-nutrition-stats ${compact ? "compact" : ""}`.trim()} aria-label="Resumen nutricional">
    <span><small>Kcal</small><strong>{formatNumber(totals.calories)}</strong></span>
    <span><small>Proteínas</small><strong>{formatNumber(totals.proteinGrams, 1)} g</strong></span>
    <span><small>Carbohidratos</small><strong>{formatNumber(totals.carbsGrams, 1)} g</strong></span>
    <span><small>Grasas</small><strong>{formatNumber(totals.fatGrams, 1)} g</strong></span>
  </div>;
}

function PresetPreview({ preset }) {
  if (!preset) return <div className="abm-preview-empty"><Icon name="visibility" /><strong>Elegí un día para previsualizarlo</strong><span>Vas a ver sus comidas y totales antes de aplicarlo.</span></div>;
  const groups = DEFAULT_MEALS.map((meal) => ({ ...meal, items: (preset.items || []).filter((item) => item.mealType === meal.code) })).filter((meal) => meal.items.length);
  return <div className="day-preview-content">
    <div className="day-preview-heading"><div><span>Vista previa</span><h2>{preset.name}</h2></div><span className="abm-status-chip">{preset.itemCount || preset.items?.length || 0} elementos</span></div>
    <NutritionStats totals={mealTotals(preset.items || [])} />
    <div className="day-preview-meals">
      {groups.map((meal) => <section key={meal.code}><h3><Icon name="restaurant" />{meal.label}</h3>{meal.items.map((item, index) => <div className="day-preview-item" key={`${item.itemId || item.displayName}-${index}`}><span><strong>{item.displayName || "Alimento"}</strong><small>{item.quantity} {item.unit === "PORTION" ? "porción/es" : item.unit === "GRAM" ? "g" : item.unit.toLowerCase()}</small></span><b>{formatNumber(item.calories)} kcal</b></div>)}</section>)}
    </div>
  </div>;
}

function PresetEditorDialog({ api, user, editor, mealTypes, onClose, onSaved }) {
  const [draft, setDraft] = useState(() => ({ ...editor, items: (editor.items || []).map((item) => ({ ...item })) }));
  const [pickerMeal, setPickerMeal] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const isNew = !draft.id;

  function updateItem(index, field, value) {
    setDraft((current) => ({ ...current, items: current.items.map((item, itemIndex) => itemIndex === index ? { ...item, [field]: value } : item) }));
    setError("");
  }
  async function save(event) {
    event.preventDefault();
    if (saving) return;
    if (!draft.name.trim()) return setError("Escribí un nombre para el día.");
    if (!draft.items.length) return setError("El día debe tener al menos un elemento.");
    setSaving(true);
    try {
      const result = await api.request(isNew ? "/api/nutrition/day-presets" : `/api/nutrition/day-presets/${draft.id}`, {
        method: isNew ? "POST" : "PUT",
        body: JSON.stringify({ name: draft.name.trim(), items: draft.items.map((item) => ({ ...item, quantity: decimalNumber(item.quantity) })) }),
      });
      api.notify(isNew ? "Día guardado para reutilizar." : "Día actualizado.");
      onSaved(result);
    } catch (requestError) {
      setError(requestError.message || "No se pudo guardar el día.");
    } finally {
      setSaving(false);
    }
  }
  function addItem(item) {
    setDraft((current) => ({ ...current, items: [...current.items, item] }));
    setPickerMeal(null);
  }
  return <ModalShell as="form" onClose={onClose} closeDisabled={saving} title={isNew ? "Guardar día" : "Editar día"} eyebrow="Reutilizá tu día" description="Dejá esta combinación lista para aplicarla en cualquier fecha." className="abm-editor-modal day-preset-editor-modal" backdropClassName="abm-editor-backdrop" wrapContent={false} dialogProps={{ onSubmit: save }} footer={<><button type="button" className="secondary" disabled={saving} onClick={onClose}>Cancelar</button><button type="submit" className="primary" disabled={saving}>{saving ? "Guardando…" : isNew ? "Guardar día" : "Guardar cambios"}</button></>}>
    <div className="abm-editor-body" data-dialog-scroll-owner="true">
      <label className="abm-field"><span>Nombre del día</span><input value={draft.name} maxLength={120} placeholder="Ej.: Día de entrenamiento" onChange={(event) => { setDraft((current) => ({ ...current, name: event.target.value })); setError(""); }} autoFocus /></label>
      <div className="day-editor-items">{draft.items.map((item, index) => <article className="day-editor-item" key={`${item.itemId || item.displayName}-${index}`}><div><strong>{item.displayName || "Alimento"}</strong><small>{mealLabel(item.mealType)} · {formatNumber(item.calories)} kcal</small></div><div className="day-editor-controls"><label><span>Comida</span><select value={item.mealType} onChange={(event) => updateItem(index, "mealType", event.target.value)}>{mealTypes.map((meal) => <option key={meal.code} value={meal.code}>{meal.label}</option>)}</select></label><label><span>Cantidad</span><input inputMode="decimal" value={item.quantity} onChange={(event) => updateItem(index, "quantity", normalizeDecimalInput(event.target.value))} /></label><button type="button" className="icon-button danger-text" aria-label={`Quitar ${item.displayName || "elemento"}`} onClick={() => setDraft((current) => ({ ...current, items: current.items.filter((_, itemIndex) => itemIndex !== index) }))}><Icon name="delete" /></button></div></article>)}</div>
      <button type="button" className="secondary abm-add-row" onClick={() => setPickerMeal(mealTypes[0])}><Icon name="add" />Agregar alimento o receta</button>
      {error && <p className="form-error" role="alert">{error}</p>}
    </div>
    {pickerMeal && <FoodPicker api={api} user={user} mealType={pickerMeal} selectedDate={today()} draftOnly onDraftAdd={addItem} onOptimisticAdd={() => []} onOptimisticRollback={() => {}} onClose={() => setPickerMeal(null)} onDone={() => {}} />}
  </ModalShell>;
}

export function DayPresetsPage({ api, user, seed, onSeedConsumed }) {
  const seedRef = useRef(seed);
  const [selectedDate, setSelectedDate] = useState(seed?.date || today());
  const [dayData, setDayData] = useState(seed?.data || null);
  const [presets, setPresets] = useState([]);
  const [selectedPreset, setSelectedPreset] = useState(null);
  const [applyTarget, setApplyTarget] = useState(null);
  const [editor, setEditor] = useState(seed?.autoOpenCreate ? { name: "", items: itemsFromDay(seed.data) } : null);
  const [loading, setLoading] = useState(true);
  const [dayLoading, setDayLoading] = useState(!seed?.data);
  const [error, setError] = useState("");
  const mealTypes = DEFAULT_MEALS;
  const currentItems = useMemo(() => itemsFromDay(dayData), [dayData]);
  const currentTotals = useMemo(() => mealTotals(currentItems), [currentItems]);

  async function loadPresets() {
    setLoading(true);
    try {
      const result = await api.request("/api/nutrition/day-presets", { cache: "no-store" });
      setPresets(Array.isArray(result) ? result : []);
      setSelectedPreset((current) => current ? (result || []).find((item) => item.id === current.id) || null : (result || [])[0] || null);
      setError("");
    } catch (requestError) {
      setError(requestError.message || "No se pudieron cargar tus días guardados.");
    } finally {
      setLoading(false);
    }
  }
  async function loadDay(date) {
    setDayLoading(true);
    try { setDayData(await api.request(`/api/nutrition/dashboard?date=${date}`)); }
    catch (requestError) { api.notify(requestError.message || "No se pudo cargar la vista del día.", "error"); }
    finally { setDayLoading(false); }
  }
  useEffect(() => {
    loadPresets();
    if (seedRef.current && onSeedConsumed) onSeedConsumed();
  }, []);
  useEffect(() => {
    if (seedRef.current?.data && selectedDate === seedRef.current.date) return;
    loadDay(selectedDate);
  }, [selectedDate]);

  function openCreate() { setEditor({ name: "", items: currentItems }); }
  function openEdit(preset) { setEditor({ ...preset, items: (preset.items || []).map((item) => ({ ...item })) }); }
  async function deletePreset(preset) {
    if (!(await api.confirm({ title: "¿Borrar día guardado?", description: `${preset.name} se quitará de tu lista.`, confirmLabel: "Borrar día" }))) return;
    try { await api.request(`/api/nutrition/day-presets/${preset.id}`, { method: "DELETE" }); await loadPresets(); api.notify("Día guardado borrado."); }
    catch (requestError) { api.notify(requestError.message || "No se pudo borrar el día.", "error"); }
  }
  async function applyPreset(preset, replace) {
    try {
      await api.request(`/api/nutrition/day-presets/${preset.id}/apply`, { method: "POST", body: JSON.stringify({ logDate: selectedDate, replace }) });
      await loadDay(selectedDate);
      setApplyTarget(null);
      api.notify(`${preset.name} aplicado al ${readableDate(selectedDate)}.`);
    } catch (requestError) { api.notify(requestError.message || "No se pudo aplicar el día.", "error"); }
  }
  function requestApply(preset) {
    if (hasCurrentItems) setApplyTarget(preset);
    else applyPreset(preset, false);
  }
  const hasCurrentItems = currentItems.length > 0;
  return <section className="page abm-page day-presets-page">
    <header className="abm-page-header"><div><h1>Reutilizá tu día</h1><p>Guardá combinaciones completas de comidas y aplicalas cuando tu rutina se repita.</p></div><button type="button" className="primary" onClick={openCreate} disabled={!hasCurrentItems}><Icon name="bookmark_add" />Guardar día actual</button></header>
    <div className="day-presets-datebar"><div><span>Fecha de trabajo</span><strong>{readableDate(selectedDate)}</strong></div><label><span className="sr-only">Elegir fecha</span><input type="date" value={selectedDate} onChange={(event) => setSelectedDate(event.target.value)} /></label><div className="day-presets-date-summary"><strong>{dayLoading ? "Cargando…" : `${currentItems.length} elementos`}</strong><small>{formatNumber(currentTotals.calories)} kcal cargadas</small></div></div>
    {seed?.autoOpenCreate && <div className="abm-callout"><Icon name="check_circle" /><div><strong>Tu día actual está listo para guardar</strong><span>Completá un nombre y vas a poder aplicarlo en segundos la próxima vez.</span></div><button type="button" className="text-button" onClick={openCreate}>Abrir formulario</button></div>}
    {applyTarget && <div className="abm-callout abm-apply-choice"><Icon name="swap_vert" /><div><strong>¿Cómo querés aplicar “{applyTarget.name}”?</strong><span>El día seleccionado ya tiene {currentItems.length} elementos cargados.</span></div><div className="abm-apply-actions"><button type="button" className="secondary" onClick={() => applyPreset(applyTarget, false)}>Sumar</button><button type="button" className="primary" onClick={() => applyPreset(applyTarget, true)}>Reemplazar</button><button type="button" className="text-button" onClick={() => setApplyTarget(null)}>Cancelar</button></div></div>}
    {error && <CatalogStatus error>{error}<button className="secondary" onClick={loadPresets}>Reintentar</button></CatalogStatus>}
    <div className="day-presets-workspace">
      <section className="abm-list-panel" aria-labelledby="saved-days-title"><div className="abm-section-heading"><div><h2 id="saved-days-title">Tus días guardados</h2><p>{presets.length ? "Elegí uno para ver su contenido antes de aplicarlo." : "Todavía no guardaste una combinación."}</p></div><span className="abm-count">{presets.length}</span></div>{loading ? <SkeletonRows count={3} /> : !presets.length ? <div className="abm-empty-state"><Icon name="bookmark_border" /><strong>Tu biblioteca empieza acá</strong><span>Guardá el día actual cuando encuentres una combinación que quieras repetir.</span><button type="button" className="secondary" onClick={openCreate} disabled={!hasCurrentItems}>Guardar día actual</button></div> : <div className="day-presets-card-list">{presets.map((preset) => { const active = selectedPreset?.id === preset.id; return <article key={preset.id} className={`day-preset-library-card ${active ? "selected" : ""}`}><button type="button" className="day-preset-card-select" onClick={() => setSelectedPreset(preset)} aria-pressed={active}><span className="day-preset-card-icon"><Icon name={active ? "visibility" : "bookmark"} /></span><span><strong>{preset.name}</strong><small>{preset.itemCount || preset.items?.length || 0} elementos · {(preset.mealCounts?.BREAKFAST || 0) + (preset.mealCounts?.LUNCH || 0) + (preset.mealCounts?.AFTERNOON_SNACK || 0) + (preset.mealCounts?.DINNER || 0)} comidas</small></span><Icon name="chevron_right" /></button><NutritionStats totals={mealTotals(preset.items || [])} compact /><div className="day-preset-card-actions"><button type="button" className="primary" onClick={() => requestApply(preset)}><Icon name="play_arrow" />Aplicar</button><button type="button" className="icon-button" aria-label={`Editar ${preset.name}`} onClick={() => openEdit(preset)}><Icon name="edit" /></button><button type="button" className="icon-button danger-text" aria-label={`Borrar ${preset.name}`} onClick={() => deletePreset(preset)}><Icon name="delete" /></button></div></article>; })}</div>}</section>
      <aside className="abm-preview-panel" aria-live="polite"><PresetPreview preset={selectedPreset} /></aside>
    </div>
    {editor && <PresetEditorDialog api={api} user={user} editor={editor} mealTypes={mealTypes} onClose={() => setEditor(null)} onSaved={async (saved) => { setEditor(null); await loadPresets(); setSelectedPreset(saved); }} />}
  </section>;
}
