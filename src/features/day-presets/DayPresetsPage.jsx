import React, { useEffect, useMemo, useRef, useState } from "react";
import { DEFAULT_MEALS } from "../../config/app";
import { Icon } from "../../components/Icon";
import { ModalShell } from "../../components/dialog/ModalShell";
import { SkeletonRows } from "../../components/Loading";
import { CatalogStatus } from "../catalog/CatalogComponents";
import { FoodPicker } from "../dashboard/dialogs/FoodPickerDialog";
import { mealTotals } from "../dashboard/dashboard.utils";
import { NutritionCollectionPreview } from "../shared/NutritionCollectionPreview";
import { normalizePresetPreviewItem, scalePresetNutrition, serializablePresetItem } from "./day-preset.utils";
import { decimalNumber, normalizeDecimalInput } from "../../utils/decimal";
import { formatNumber, readableDate, today } from "../../utils/format";

function presetItemFromLog(log, mealType) {
  const itemType = log.itemType || log.type;
  const item = itemType === "RECIPE" ? log.recipe : log.food;
  return {
    itemType, itemId: item?.id || null, mealType,
    quantity: decimalNumber(log.quantity || 0),
    unit: log.unit || (itemType === "RECIPE" ? "PORTION" : "GRAM"),
    displayName: item?.name || log.displayName || (itemType === "AI_ESTIMATE" ? "Comida estimada" : "Alimento"),
    imageUrl: item?.imageUrl || null, category: item?.category || "OTHER",
    calories: Number(log.calories || 0), proteinGrams: Number(log.proteinGrams || 0), carbsGrams: Number(log.carbsGrams || 0), fatGrams: Number(log.fatGrams || 0),
    ...(itemType === "AI_ESTIMATE" ? { aiEstimateConfidence: log.aiEstimateConfidence || 0, aiEstimateDetails: log.aiEstimateDetails || "{}" } : {}),
  };
}

function itemsFromDay(data) { return (data?.meals || []).flatMap((meal) => (meal.items || []).map((item) => presetItemFromLog(item, meal.mealType))); }

function mealLabel(code) { return DEFAULT_MEALS.find((meal) => meal.code === code)?.label || code || "Comida"; }
function presetGroups(preset) { return DEFAULT_MEALS.map((meal) => ({ id: meal.code, label: meal.label, icon: "restaurant", items: (preset?.items || []).filter((item) => item.mealType === meal.code).map(normalizePresetPreviewItem) })).filter((group) => group.items.length); }
function presetHeroItems(preset) { return (preset?.items || []).map(normalizePresetPreviewItem).filter((item) => item.itemType !== "AI_ESTIMATE").slice(0, 4); }

function DayPresetApplyDialog({ preset, currentItems, selectedDate, onClose, onApply }) {
  const [applying, setApplying] = useState(false);
  async function apply(replace) {
    if (applying) return;
    setApplying(true);
    try { await onApply(replace); } finally { setApplying(false); }
  }
  return <ModalShell title="Aplicar día guardado" eyebrow="Reutilizá tu día" description={`“${preset.name}” se va a cargar en ${readableDate(selectedDate)}.`} onClose={onClose} closeDisabled={applying} className="day-preset-apply-dialog" backdropClassName="day-preset-apply-backdrop" footer={<><button type="button" className="secondary" onClick={onClose} disabled={applying}>Cancelar</button><button type="button" className="secondary" onClick={() => apply(false)} disabled={applying}>{applying ? "Aplicando…" : "Sumar"}</button><button type="button" className="primary" onClick={() => apply(true)} disabled={applying}>{applying ? "Aplicando…" : "Reemplazar"}</button></>}>
    <div className="day-preset-apply-summary" aria-live="polite"><div><Icon name="swap_vert" /><span><strong>{preset.name}</strong><small>{preset.itemCount || preset.items?.length || 0} elementos guardados</small></span></div><p>La fecha ya tiene {currentItems.length} elementos. Elegí si querés conservarlos y sumar el día guardado, o reemplazarlos por completo.</p></div>
  </ModalShell>;
}

function PresetEditorDialog({ api, user, editor, mealTypes, onClose, onSaved }) {
  const [draft, setDraft] = useState(() => ({ description: "", ...editor, items: (editor.items || []).map((item) => ({ ...item })) }));
  const [pickerMeal, setPickerMeal] = useState(null); const [saving, setSaving] = useState(false); const [error, setError] = useState(""); const isNew = !draft.id;
  function updateItem(index, field, value) {
    setDraft((current) => ({ ...current, items: current.items.map((item, itemIndex) => itemIndex === index ? field === "quantity" ? scalePresetNutrition(item, value) : { ...item, [field]: value } : item) })); setError("");
  }
  async function save(event) {
    event.preventDefault(); if (saving) return; const name = draft.name.trim();
    if (!name) return setError("Escribí un nombre para el día."); if (!draft.items.length) return setError("El día debe tener al menos un elemento.");
    if (draft.items.some((item) => !Number.isFinite(decimalNumber(item.quantity)) || decimalNumber(item.quantity) <= 0)) return setError("Revisá las cantidades antes de guardar.");
    setSaving(true);
    try {
      const payload = { name, description: draft.description.trim() || null, items: draft.items.map(serializablePresetItem) };
      const result = await api.request(isNew ? "/api/nutrition/day-presets" : `/api/nutrition/day-presets/${draft.id}`, { method: isNew ? "POST" : "PUT", body: JSON.stringify(payload) });
      api.notify(isNew ? "Día guardado para reutilizar." : "Día actualizado."); onSaved(result);
    } catch (requestError) { setError(requestError.message || "No se pudo guardar el día."); } finally { setSaving(false); }
  }
  function addItem(item) { setDraft((current) => ({ ...current, items: [...current.items, { ...item, imageUrl: item.imageUrl || null }] })); setPickerMeal(null); setError(""); }
  const groupedItems = mealTypes.map((meal) => ({ ...meal, items: draft.items.map((item, index) => ({ ...item, draftIndex: index })).filter((item) => item.mealType === meal.code) }));
  return <ModalShell as="form" onClose={onClose} closeDisabled={saving} title={isNew ? "Guardar día" : "Editar día"} description="Definí el nombre, la descripción y las comidas que querés repetir." className="abm-editor-modal day-preset-editor-modal" backdropClassName="abm-editor-backdrop" wrapContent={false} dialogProps={{ onSubmit: save }} footer={<><button type="button" className="secondary" disabled={saving} onClick={onClose}>Cancelar</button><button type="submit" className="primary" disabled={saving}>{saving ? "Guardando…" : isNew ? "Guardar día" : "Guardar cambios"}</button></>}>
    <div className="abm-editor-body" data-dialog-scroll-owner="true">
      <label className="abm-field"><span>Nombre del día</span><input value={draft.name} maxLength={120} placeholder="Ej.: Día de entrenamiento" onChange={(event) => { setDraft((current) => ({ ...current, name: event.target.value })); setError(""); }} autoFocus /></label>
      <label className="abm-field"><span>Descripción <small>(opcional)</small></span><textarea value={draft.description || ""} maxLength={240} rows={3} placeholder="Contá cuándo o por qué querés repetirlo" onChange={(event) => setDraft((current) => ({ ...current, description: event.target.value }))} /></label>
      <div className="day-editor-brackets" aria-label="Comidas del día">
        {groupedItems.map((meal) => <section className="day-editor-bracket" key={meal.code} aria-labelledby={`day-editor-${meal.code}`}>
          <header className="day-editor-bracket-heading"><div><span className="day-editor-bracket-knot" aria-hidden="true" /><div><h3 id={`day-editor-${meal.code}`}>{meal.label}</h3><small>{meal.items.length ? `${meal.items.length} elemento${meal.items.length === 1 ? "" : "s"}` : "Todavía sin elementos"}</small></div></div><strong>{formatNumber(mealTotals(meal.items).calories)} kcal</strong></header>
          <div className="day-editor-bracket-items">
            {meal.items.map((item) => <article className="day-editor-item" key={`${item.itemId || item.displayName}-${item.draftIndex}`}>
              <div className="day-editor-item-main"><div className="day-editor-thumb"><img src={item.imageUrl || "/category-assets/other.webp"} alt="" onError={(event) => { event.currentTarget.onerror = null; event.currentTarget.src = "/category-assets/other.webp"; }} /></div><div><strong>{item.displayName || "Alimento"}</strong><small>{formatNumber(item.quantity)} {item.unit === "GRAM" ? "g" : item.unit === "MILLILITER" ? "ml" : item.unit === "PORTION" ? "porción/es" : "unidad/es"} · {formatNumber(item.calories)} kcal</small></div></div>
              <div className="day-editor-controls"><label><span>Cantidad</span><input inputMode="decimal" value={item.quantity} onChange={(event) => updateItem(item.draftIndex, "quantity", normalizeDecimalInput(event.target.value))} /></label><label><span>Unidad</span><select value={item.unit} onChange={(event) => updateItem(item.draftIndex, "unit", event.target.value)}><option value="GRAM">Gramos</option><option value="MILLILITER">Mililitros</option><option value="UNIT">Unidades</option><option value="PORTION">Porciones</option></select></label><label className="day-editor-move"><span>Mover a…</span><select value={item.mealType} aria-label={`Mover ${item.displayName || "elemento"} a otra comida`} onChange={(event) => updateItem(item.draftIndex, "mealType", event.target.value)}>{mealTypes.map((option) => <option key={option.code} value={option.code}>{option.label}</option>)}</select></label><button type="button" className="icon-button danger-text" aria-label={`Quitar ${item.displayName || "elemento"}`} onClick={() => setDraft((current) => ({ ...current, items: current.items.filter((_, itemIndex) => itemIndex !== item.draftIndex) }))}><Icon name="delete" /></button></div>
            </article>)}
          </div>
          <button type="button" className="day-editor-add" onClick={() => setPickerMeal(meal)}><Icon name="add" />Agregar alimento o receta</button>
        </section>)}
      </div>
      {error && <p className="form-error" role="alert">{error}</p>}
    </div>
    {pickerMeal && <FoodPicker api={api} user={user} mealType={pickerMeal} selectedDate={today()} draftOnly onDraftAdd={addItem} onOptimisticAdd={() => []} onOptimisticRollback={() => {}} onClose={() => setPickerMeal(null)} onDone={() => {}} />}
  </ModalShell>;
}

export function DayPresetsPage({ api, user, seed, onSeedConsumed }) {
  const seedRef = useRef(seed); const [selectedDate, setSelectedDate] = useState(seed?.date || today()); const [dayData, setDayData] = useState(seed?.data || null); const [presets, setPresets] = useState([]); const [selectedPreset, setSelectedPreset] = useState(null); const [applyTarget, setApplyTarget] = useState(null); const [editor, setEditor] = useState(seed?.autoOpenCreate ? { name: "", description: "", items: itemsFromDay(seed.data) } : null); const [loading, setLoading] = useState(true); const [dayLoading, setDayLoading] = useState(!seed?.data); const [error, setError] = useState("");
  const currentItems = useMemo(() => itemsFromDay(dayData), [dayData]); const currentTotals = useMemo(() => mealTotals(currentItems), [currentItems]);
  async function loadPresets() { setLoading(true); try { const result = await api.request("/api/nutrition/day-presets", { cache: "no-store" }); const next = Array.isArray(result) ? result : []; setPresets(next); setSelectedPreset((current) => current ? next.find((item) => item.id === current.id) || null : next[0] || null); setError(""); } catch (requestError) { setError(requestError.message || "No se pudieron cargar tus días guardados."); } finally { setLoading(false); } }
  async function loadDay(date) { setDayLoading(true); try { setDayData(await api.request(`/api/nutrition/dashboard?date=${date}`)); } catch (requestError) { api.notify(requestError.message || "No se pudo cargar la vista del día.", "error"); } finally { setDayLoading(false); } }
  useEffect(() => { loadPresets(); if (seedRef.current && onSeedConsumed) onSeedConsumed(); }, []);
  useEffect(() => { if (seedRef.current?.data && selectedDate === seedRef.current.date) return; loadDay(selectedDate); }, [selectedDate]);
  function openCreate() { setEditor({ name: "", description: "", items: currentItems.map((item) => ({ ...item })) }); }
  function openEdit(preset) { setEditor({ ...preset, items: (preset.items || []).map((item) => ({ ...item })) }); }
  async function deletePreset(preset) { if (!(await api.confirm({ title: "¿Borrar día guardado?", description: `${preset.name} se quitará de tu lista.`, confirmLabel: "Borrar día" }))) return; try { await api.request(`/api/nutrition/day-presets/${preset.id}`, { method: "DELETE" }); if (selectedPreset?.id === preset.id) setSelectedPreset(null); await loadPresets(); api.notify("Día guardado borrado."); } catch (requestError) { api.notify(requestError.message || "No se pudo borrar el día.", "error"); } }
  async function applyPreset(preset, replace) { try { await api.request(`/api/nutrition/day-presets/${preset.id}/apply`, { method: "POST", body: JSON.stringify({ logDate: selectedDate, replace }) }); await loadDay(selectedDate); setApplyTarget(null); api.notify(`${preset.name} aplicado al ${readableDate(selectedDate)}.`); } catch (requestError) { api.notify(requestError.message || "No se pudo aplicar el día.", "error"); } }
  function requestApply(preset) { if (currentItems.length) setApplyTarget(preset); else applyPreset(preset, false); }
  const hasCurrentItems = currentItems.length > 0;
  return <section className="page abm-page day-presets-page">
    <header className="abm-page-header"><div><h1>Reutilizá tu día</h1><p>Guardá combinaciones completas y aplicalas cuando tu rutina se repita.</p></div><button type="button" className="primary" onClick={openCreate} disabled={!hasCurrentItems}><Icon name="bookmark_add" />Guardar día actual</button></header>
    <div className="day-presets-datebar"><div><span>Fecha de trabajo</span><strong>{readableDate(selectedDate)}</strong></div><label><span className="sr-only">Elegir fecha</span><input type="date" value={selectedDate} onChange={(event) => setSelectedDate(event.target.value)} /></label><div className="day-presets-date-summary"><strong>{dayLoading ? "Cargando…" : `${currentItems.length} elementos`}</strong><small>{formatNumber(currentTotals.calories)} kcal cargadas</small></div></div>
    {seed?.autoOpenCreate && <div className="abm-callout"><Icon name="check_circle" /><div><strong>Tu día actual está listo para guardar</strong><span>Completá un nombre y una descripción para volver a encontrarlo rápido.</span></div><button type="button" className="text-button" onClick={openCreate}>Abrir formulario</button></div>}
    {error && <CatalogStatus error>{error}<button className="secondary" onClick={loadPresets}>Reintentar</button></CatalogStatus>}
    <div className="day-presets-workspace"><section className="abm-list-panel" aria-labelledby="saved-days-title"><div className="abm-section-heading"><div><h2 id="saved-days-title">Tus días guardados</h2><p>{presets.length ? "Elegí una card para revisar su contenido." : "Todavía no guardaste una combinación."}</p></div><span className="abm-count">{presets.length}</span></div>{loading ? <SkeletonRows count={3} /> : !presets.length ? <div className="abm-empty-state"><Icon name="bookmark_border" /><strong>Tu biblioteca empieza acá</strong><span>Guardá el día actual cuando encuentres una combinación que quieras repetir.</span><button type="button" className="secondary" onClick={openCreate} disabled={!hasCurrentItems}>Guardar día actual</button></div> : <div className="day-presets-card-list">{presets.map((preset) => { const active = selectedPreset?.id === preset.id; const totals = mealTotals(preset.items || []); return <article key={preset.id} className={`day-preset-library-card ${active ? "selected" : ""}`}><button type="button" className="day-preset-card-select" onClick={() => { setSelectedPreset(preset); setApplyTarget(null); }} aria-pressed={active}><span className="day-preset-card-image"><img src={presetHeroItems(preset)[0]?.imageUrl || "/category-assets/other.webp"} alt="" onError={(event) => { event.currentTarget.onerror = null; event.currentTarget.src = "/category-assets/other.webp"; }} /></span><span className="day-preset-card-copy"><strong>{preset.name}</strong><small>{preset.description || "Sin descripción"}</small><em>{preset.itemCount || preset.items?.length || 0} elementos · {Object.values(preset.mealCounts || {}).reduce((sum, count) => sum + count, 0)} comidas</em></span><Icon name="chevron_right" /></button><div className="day-preset-card-meta"><span>{formatNumber(totals.calories)} kcal</span><span>{formatNumber(totals.proteinGrams, 1)} g proteína</span><small>Actualizado {preset.updatedAt ? new Date(preset.updatedAt).toLocaleDateString("es-AR") : "recientemente"}</small></div><div className="day-preset-card-actions"><button type="button" className="primary" onClick={() => requestApply(preset)}><Icon name="play_arrow" />Aplicar</button><button type="button" className="secondary" onClick={() => openEdit(preset)}><Icon name="edit" />Editar</button><button type="button" className="icon-button danger-text" aria-label={`Borrar ${preset.name}`} onClick={() => deletePreset(preset)}><Icon name="delete" /></button></div></article>; })}</div>}</section><aside className="abm-preview-panel" aria-live="polite"><NutritionCollectionPreview title={selectedPreset?.name} description={selectedPreset?.description} status={selectedPreset ? `${selectedPreset.itemCount || selectedPreset.items?.length || 0} elementos · actualizado ${selectedPreset.updatedAt ? new Date(selectedPreset.updatedAt).toLocaleDateString("es-AR") : "recientemente"}` : null} heroItems={presetHeroItems(selectedPreset)} totals={selectedPreset ? mealTotals(selectedPreset.items || []) : null} groups={presetGroups(selectedPreset)} empty={!selectedPreset} onBack={selectedPreset ? () => setSelectedPreset(null) : undefined} backLabel="Volver a días guardados" /></aside></div>
    {applyTarget && <DayPresetApplyDialog preset={applyTarget} currentItems={currentItems} selectedDate={selectedDate} onClose={() => setApplyTarget(null)} onApply={(replace) => applyPreset(applyTarget, replace)} />}
    {editor && <PresetEditorDialog api={api} user={user} editor={editor} mealTypes={DEFAULT_MEALS} onClose={() => setEditor(null)} onSaved={async (saved) => { setEditor(null); setSelectedPreset(saved); await loadPresets(); }} />}
  </section>;
}
