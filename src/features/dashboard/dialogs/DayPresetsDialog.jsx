import React, { useState } from "react";
import { Icon } from "../../../components/Icon";
import { ModalRoot } from "../../../components/dialog/ModalRoot";
import { useDialogLifecycle } from "../../../components/dialog/useDialogLifecycle";
import { mealLogName, mealTotals } from "../dashboard.utils";
import { formatNumber, readableDate } from "../../../utils/format";

function presetItemFromLog(log, mealType) {
  const itemType = log.itemType || log.type;
  if (itemType === "AI_ESTIMATE") return { itemType, itemId: null, mealType, quantity: Number(log.quantity || 1), unit: log.unit || "PORTION", displayName: mealLogName(log) || "Comida estimada", calories: Number(log.calories || 0), proteinGrams: Number(log.proteinGrams || 0), carbsGrams: Number(log.carbsGrams || 0), fatGrams: Number(log.fatGrams || 0), aiEstimateConfidence: log.aiEstimateConfidence || 0, aiEstimateDetails: log.aiEstimateDetails || "{}" };
  const item = itemType === "RECIPE" ? log.recipe : log.food;
  return { itemType, itemId: item?.id, mealType, quantity: Number(log.quantity || 0), unit: log.unit || (itemType === "RECIPE" ? "PORTION" : "GRAM"), displayName: item?.name || mealLogName(log), calories: Number(log.calories || 0), proteinGrams: Number(log.proteinGrams || 0), carbsGrams: Number(log.carbsGrams || 0), fatGrams: Number(log.fatGrams || 0) };
}

export function DayPresetsDialog({ api, user, date, data, mealTypes, presets, onReload, onApplied, open, onOpen, onClose, FoodPickerComponent }) {
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const [showSaveForm, setShowSaveForm] = useState(false);
  const [editor, setEditor] = useState(null);
  const [pickerMeal, setPickerMeal] = useState(null);
  const [applyTarget, setApplyTarget] = useState(null);
  const [error, setError] = useState("");
  const hasItems = (data?.meals || []).some((meal) => (meal.items || []).length);
  const currentItems = (data?.meals || []).flatMap((meal) => (meal.items || []).map((log) => presetItemFromLog(log, meal.mealType)));
  const { dialogRef, onBackdropPointerDown } = useDialogLifecycle({ open, onClose: () => closeModal(), trapFocus: !pickerMeal });

  function closeModal() { if (saving) return; onClose(); setName(""); setShowSaveForm(false); setEditor(null); setPickerMeal(null); setApplyTarget(null); setError(""); }
  async function saveDay() {
    if (saving) return;
    const trimmed = name.trim();
    if (!trimmed) return setError("Escribí un nombre para el preset.");
    if (!currentItems.length) return setError("El día no tiene alimentos para guardar.");
    setSaving(true); setError("");
    try { await api.request("/api/nutrition/day-presets", { method: "POST", body: JSON.stringify({ name: trimmed, items: currentItems }) }); setName(""); setShowSaveForm(false); await onReload(); api.notify("Día guardado como preset."); }
    catch (e) { setError(e.message || "No se pudo guardar el día."); } finally { setSaving(false); }
  }
  async function applyPreset(preset, replace) {
    setSaving(true); setError("");
    try { await api.request(`/api/nutrition/day-presets/${preset.id}/apply`, { method: "POST", body: JSON.stringify({ logDate: date, replace }) }); await onApplied(); api.notify(`${preset.name} aplicado al día.`); closeModal(); }
    catch (e) { setError(e.message || "No se pudo aplicar el preset."); } finally { setSaving(false); }
  }
  async function deletePreset(preset) {
    if (!(await api.confirm({ title: "¿Borrar preset?", description: `${preset.name} se quitará de tu lista.`, confirmLabel: "Borrar" }))) return;
    try { await api.request(`/api/nutrition/day-presets/${preset.id}`, { method: "DELETE" }); await onReload(); api.notify("Preset borrado."); }
    catch (e) { setError(e.message || "No se pudo borrar el preset."); }
  }
  async function saveEditor() {
    if (!editor || saving) return;
    if (!editor.name.trim()) return setError("Escribí un nombre para el preset.");
    if (!editor.items.length) return setError("El preset debe tener al menos un elemento.");
    setSaving(true); setError("");
    try { const updated = await api.request(`/api/nutrition/day-presets/${editor.id}`, { method: "PUT", body: JSON.stringify({ name: editor.name.trim(), items: editor.items }) }); await onReload(); setEditor(updated); api.notify("Preset actualizado."); }
    catch (e) { setError(e.message || "No se pudo actualizar el preset."); } finally { setSaving(false); }
  }
  function addPresetItem(item) { setEditor((current) => ({ ...current, items: [...current.items, item] })); }

  return <>
    <section className="day-presets-actions" aria-label="Presets de alimentación">
      <button type="button" className="day-presets-trigger" onClick={onOpen} aria-label="Abrir Reutilizá tu día">
        <span><strong>Reutilizá tu día</strong><small>Guardá esta combinación de comidas o aplicá una rutina anterior.</small></span>
        <Icon name="chevron_right" />
      </button>
    </section>
    {open && <ModalRoot className="app-modal-backdrop day-presets-backdrop" onBackdropPointerDown={onBackdropPointerDown}>
      <section ref={dialogRef} className="app-modal-surface day-presets-modal" role="dialog" aria-modal="true" aria-labelledby="day-presets-title" onPointerDown={(event) => event.stopPropagation()}>
        <header><div><span>Presets de alimentación</span><h2 id="day-presets-title">Reutilizá tu día</h2><small>Guardá o elegí una rutina completa para {readableDate(date)}.</small></div><button type="button" className="icon-button" aria-label="Cerrar" onClick={closeModal}><Icon name="close" /></button></header>
        {editor ? <div className="day-preset-editor-body">
          <div className="day-presets-editor-head"><button type="button" className="text-button" onClick={() => { setEditor(null); setError(""); }}><Icon name="arrow_back" />Volver a presets</button><button type="button" className="primary" disabled={saving} onClick={saveEditor}>{saving ? "Guardando…" : "Guardar cambios"}</button></div>
          <label className="day-preset-edit-name"><span>Nombre</span><input value={editor.name} maxLength={120} onChange={(event) => setEditor((current) => ({ ...current, name: event.target.value }))} /></label>
          <div className="day-preset-items">{editor.items.map((item, index) => <article className="day-preset-item" key={`${item.itemType}:${item.itemId || item.displayName}:${index}`}>
            <div className="day-preset-item-title"><strong>{item.displayName || (item.itemType === "RECIPE" ? "Receta" : item.itemType === "AI_ESTIMATE" ? "Estimación" : "Alimento")}</strong><button type="button" className="icon-button danger-text" aria-label="Quitar elemento" onClick={() => setEditor((current) => ({ ...current, items: current.items.filter((_, itemIndex) => itemIndex !== index) }))}><Icon name="delete" /></button></div>
            <div className="day-preset-item-fields"><label><span>Comida</span><select value={item.mealType} onChange={(event) => setEditor((current) => ({ ...current, items: current.items.map((entry, itemIndex) => itemIndex === index ? { ...entry, mealType: event.target.value } : entry) }))}>{mealTypes.map((meal) => <option key={meal.code} value={meal.code}>{meal.label}</option>)}</select></label><label><span>Cantidad</span><input inputMode="decimal" value={item.quantity} onChange={(event) => setEditor((current) => ({ ...current, items: current.items.map((entry, itemIndex) => itemIndex === index ? { ...entry, quantity: event.target.value } : entry) }))} /></label><label><span>Unidad</span><select value={item.unit} onChange={(event) => setEditor((current) => ({ ...current, items: current.items.map((entry, itemIndex) => itemIndex === index ? { ...entry, unit: event.target.value } : entry) }))}><option value="GRAM">Gramos</option><option value="PORTION">Porciones</option><option value="UNIT">Unidades</option><option value="MILLILITER">Mililitros</option></select></label></div>
          </article>)}</div>
          <button type="button" className="secondary day-preset-add" onClick={() => setPickerMeal(mealTypes[0])}><Icon name="add" />Agregar alimento o receta</button>
        </div> : <div className="day-presets-content">
          <div className="day-preset-save">
            <button type="button" className="day-preset-save-toggle" aria-expanded={showSaveForm} onClick={() => { setShowSaveForm((current) => !current); setError(""); }}>
              <span><strong>Guardar este día</strong><small>Creá un preset con las comidas de {readableDate(date)}.</small></span>
              <Icon name={showSaveForm ? "expand_less" : "expand_more"} />
            </button>
            {showSaveForm && <div className="day-presets-save-fields"><label className="day-preset-name"><span>Nombre del preset</span><input value={name} maxLength={120} placeholder="Ej.: Día de entrenamiento" disabled={saving} onChange={(event) => { setName(event.target.value); setError(""); }} /></label><button type="button" className="primary" disabled={saving || !currentItems.length} onClick={saveDay}><Icon name="bookmark_add" />{saving ? "Guardando…" : "Guardar día"}</button></div>}
          </div>
          <div className="day-presets-list-area">
            {applyTarget && <div className="day-preset-choice"><strong>Este día ya tiene alimentos</strong><span>¿Querés sumar {applyTarget.name} o reemplazar lo que ya cargaste?</span><div><button type="button" className="secondary" disabled={saving} onClick={() => applyPreset(applyTarget, false)}>Sumar al día</button><button type="button" className="primary" disabled={saving} onClick={() => applyPreset(applyTarget, true)}>Reemplazar día</button><button type="button" className="text-button" onClick={() => setApplyTarget(null)}>Cancelar</button></div></div>}
            {!presets.length && <div className="day-presets-empty"><Icon name="bookmark_border" /><strong>Todavía no hay presets</strong><span>Guardá tu día para tenerlo a mano en el futuro.</span></div>}
            <div className="day-presets-list">{presets.map((preset) => { const totals = mealTotals(preset.items || []); return <article className="day-preset-card" key={preset.id}><div className="day-preset-card-main"><div><h3>{preset.name}</h3><p>{preset.itemCount} {preset.itemCount === 1 ? "elemento" : "elementos"} · {(preset.mealCounts?.BREAKFAST || 0) + (preset.mealCounts?.LUNCH || 0) + (preset.mealCounts?.AFTERNOON_SNACK || 0) + (preset.mealCounts?.DINNER || 0)} comidas</p></div><div className="day-preset-nutrition" aria-label={`Totales de ${preset.name}`}><span><small>Kcal</small><strong>{formatNumber(totals.calories)}</strong></span><span><small>Proteínas</small><strong>{formatNumber(totals.proteinGrams, 1)} g</strong></span><span><small>Carbohidratos</small><strong>{formatNumber(totals.carbsGrams, 1)} g</strong></span><span><small>Grasas</small><strong>{formatNumber(totals.fatGrams, 1)} g</strong></span></div></div><div className="day-preset-card-actions"><button type="button" className="primary" disabled={saving} onClick={() => hasItems ? setApplyTarget(preset) : applyPreset(preset, false)}>Aplicar</button><button type="button" className="icon-button" aria-label={`Editar ${preset.name}`} onClick={() => { setEditor({ ...preset, items: preset.items.map((item) => ({ ...item })) }); setApplyTarget(null); setError(""); }}><Icon name="edit" /></button><button type="button" className="icon-button danger-text" aria-label={`Borrar ${preset.name}`} onClick={() => deletePreset(preset)}><Icon name="delete" /></button></div></article>; })}</div>
          </div>
        </div>}
        {error && <p className="day-preset-error" role="alert">{error}</p>}
        <footer><button type="button" className="secondary" onClick={closeModal}>Cerrar</button></footer>
        {pickerMeal && <FoodPickerComponent api={api} user={user} mealType={pickerMeal} selectedDate={date} draftOnly onDraftAdd={addPresetItem} onClose={() => setPickerMeal(null)} onDone={() => {}} onOptimisticAdd={() => []} onOptimisticRollback={() => {}} />}
      </section>
    </ModalRoot>}
  </>;
}
