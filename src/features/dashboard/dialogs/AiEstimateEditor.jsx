import React, { useState } from "react";
import { CATEGORY_OPTIONS, PREPARATION_OPTIONS } from "../../../config/app";
import { Icon } from "../../../components/Icon";
import { Input, Select } from "../../../components/FormControls";
import { categoryLabel, preparationLabel } from "../../catalog/CatalogComponents";
import { formatNumber } from "../../../utils/format";
import { aiProposalFood, macroCalories, scaleFoodNutrition } from "../dashboard.utils";

export function AiEstimateEditor({ dialogRef, estimate, setEstimate, correction = "", setCorrection, refining = false, refinementError = "", saveError = "", onRefine, saving, onDiscard, onConfirm, mode = "create", standalone = false, mealType, setMealType, logDate, setLogDate, mealTypes, onCatalogItem }) {
  const [catalogItemIndex, setCatalogItemIndex] = useState(null);
  const [catalogCategory, setCatalogCategory] = useState("OTHER");
  const [catalogPreparation, setCatalogPreparation] = useState("UNSPECIFIED");
  const [catalogSaving, setCatalogSaving] = useState(false);
  const [catalogMessage, setCatalogMessage] = useState("");
  const itemNutrition = (estimate.items || []).map((item) => mode === "saved"
    ? { proteinGrams: Number(item.proteinGrams || 0), carbsGrams: Number(item.carbsGrams || 0), fatGrams: Number(item.fatGrams || 0) }
    : scaleFoodNutrition(aiProposalFood(item), item.estimatedGrams));
  const totals = itemNutrition.reduce((sum, nutrition) => ({
    proteinGrams: sum.proteinGrams + nutrition.proteinGrams,
    carbsGrams: sum.carbsGrams + nutrition.carbsGrams,
    fatGrams: sum.fatGrams + nutrition.fatGrams,
  }), { proteinGrams: 0, carbsGrams: 0, fatGrams: 0 });
  const calories = macroCalories(totals.proteinGrams, totals.carbsGrams, totals.fatGrams);
  function updateItem(index, field, value) {
    const normalized = value.replace(",", ".").replace(/[^\d.]/g, "");
    setEstimate((current) => ({ ...current, items: current.items.map((item, itemIndex) => itemIndex === index ? { ...item, [field]: normalized } : item) }));
  }
  function addItem() {
    if (estimate.items.length >= 12) return;
    setEstimate((current) => ({ ...current, items: [...current.items, { name: "", estimatedGrams: "100", proteinGrams: "0", carbsGrams: "0", fatGrams: "0", category: "OTHER", preparation: "UNSPECIFIED" }] }));
  }
  function removeItem(index) {
    setEstimate((current) => ({ ...current, items: current.items.filter((_, itemIndex) => itemIndex !== index) }));
  }
  async function saveCatalogItem() {
    if (catalogItemIndex == null || catalogSaving) return;
    setCatalogSaving(true);
    setCatalogMessage("");
    try {
      await onCatalogItem?.(catalogItemIndex, { category: catalogCategory, preparation: catalogPreparation, tags: [] });
      setCatalogMessage("Alimento guardado como pendiente global.");
      setCatalogItemIndex(null);
    } catch (error) {
      setCatalogMessage(error.message || "No se pudo guardar el alimento.");
    } finally {
      setCatalogSaving(false);
    }
  }
  const canConfirm = estimate.name.trim() && estimate.items.length && estimate.items.every((item) => item.name?.trim()
    && Number(item.estimatedGrams) > 0 && Number(item.estimatedGrams) <= 3000);
  const editor = (
      <section ref={dialogRef} className="selected-editor ai-estimate-editor" role="dialog" aria-modal="true" aria-label={mode === "saved" ? "Revisar estimación guardada" : "Revisar estimación por foto"}>
        <span className="sheet-handle" aria-hidden="true" />
        <header><div><span>{mode === "saved" ? "Estimación guardada" : "Estimación IA"}</span><h3>{estimate.name}</h3><small>Confianza estimada: {estimate.confidence}%</small></div><button className="icon-button" aria-label="Cerrar estimación" onClick={onDiscard}><Icon name="close" /></button></header>
        {mode === "saved" && <>
          <Input label="Nombre de la comida" value={estimate.name} onChange={(event) => setEstimate((current) => ({ ...current, name: event.target.value }))} />
          <label className="ai-context-field"><span>Descripción</span><textarea maxLength="240" value={estimate.description || ""} onChange={(event) => setEstimate((current) => ({ ...current, description: event.target.value }))} /></label>
          <div className="edit-log-fields"><Select label="Comida" value={mealType} options={mealTypes.map((item) => ({ value: item.code, label: item.label }))} onChange={(event) => setMealType(event.target.value)} /><Input label="Fecha" type="date" value={logDate} onChange={(event) => setLogDate(event.target.value)} /></div>
        </>}
        {mode === "create" && estimate.description && <p className="ai-estimate-description"><strong>Lo que detectó la IA</strong>{estimate.description}</p>}
        {(estimate.assumptions || []).length > 0 && <details className="ai-estimate-assumptions"><summary>Supuestos de la estimación</summary><ul>{estimate.assumptions.map((assumption) => <li key={assumption}>{assumption}</li>)}</ul></details>}
        <section className="ai-estimate-summary" aria-label="Resumen nutricional de la estimación">
          <span className="ai-summary-protein"><small>Proteínas</small><strong>{formatNumber(totals.proteinGrams, 1)}<b>g</b></strong></span>
          <span className="ai-summary-carbs"><small>Carbos</small><strong>{formatNumber(totals.carbsGrams, 1)}<b>g</b></strong></span>
          <span className="ai-summary-fat"><small>Grasas</small><strong>{formatNumber(totals.fatGrams, 1)}<b>g</b></strong></span>
          <span className="ai-summary-calories"><small>{mode === "create" ? "Kcal totales" : "Kcal aprox."}</small><strong>{formatNumber(calories)}</strong></span>
        </section>
        <div className="ai-estimate-items-heading"><div><h4>Alimentos detectados</h4><span>{estimate.items.length} {estimate.items.length === 1 ? "elemento" : "elementos"} · editá cantidades si hace falta</span></div></div>
        <div className="ai-estimate-items">
          {estimate.items.map((item, index) => (
            <article key={`${item.name}:${index}`}>
              <div className="ai-estimate-item-heading"><div><span>Alimento {index + 1}</span><strong>{item.name || "Sin nombre"}</strong></div><span className="ai-estimate-item-heading-actions"><strong>{formatNumber(itemNutrition[index]?.calories ?? macroCalories(item.proteinGrams, item.carbsGrams, item.fatGrams))} kcal</strong>{mode === "saved" && <button type="button" className="secondary ai-estimate-catalog" disabled={refining || saving} onClick={() => { setCatalogItemIndex(index); setCatalogMessage(""); }}>Guardar</button>}<button type="button" className="icon-button ai-estimate-remove" aria-label={`Eliminar ${item.name || `alimento ${index + 1}`}`} disabled={refining || saving} onClick={() => removeItem(index)}><Icon name="delete" /></button></span></div>
              <Input label="Alimento" value={item.name} disabled={refining} onChange={(event) => setEstimate((current) => ({ ...current, items: current.items.map((entry, itemIndex) => itemIndex === index ? { ...entry, name: event.target.value, foodId: null, catalogFood: null } : entry) }))} />
              {mode === "create" ? <>
                <div className="ai-estimate-item-section ai-estimate-readonly-meta"><span className="ai-estimate-section-label">Clasificación IA</span><div className="ai-estimate-meta-values"><span><small>Categoría</small><strong>{categoryLabel(item.category || "OTHER")}</strong></span><span><small>Preparación</small><strong>{preparationLabel(item.preparation || "UNSPECIFIED")}</strong></span></div></div>
                <label className="ai-estimate-grams-field"><span>Gramos detectados (g)</span><input disabled={refining || saving} inputMode="decimal" value={item.estimatedGrams ?? ""} onFocus={(event) => event.currentTarget.select()} onChange={(event) => updateItem(index, "estimatedGrams", event.target.value)} /></label>
                <div className="ai-estimate-item-section ai-estimate-readonly-nutrition"><span className="ai-estimate-section-label">Resumen nutricional</span><div className="ai-estimate-item-nutrition"><span><small>Kcal</small><strong>{formatNumber(itemNutrition[index]?.calories)}</strong></span><span><small>Proteínas</small><strong>{formatNumber(itemNutrition[index]?.proteinGrams, 1)}g</strong></span><span><small>Carbos</small><strong>{formatNumber(itemNutrition[index]?.carbsGrams, 1)}g</strong></span><span><small>Grasas</small><strong>{formatNumber(itemNutrition[index]?.fatGrams, 1)}g</strong></span></div></div>
              </> : <>
                <div className="ai-estimate-item-section ai-estimate-readonly-meta"><span className="ai-estimate-section-label">Clasificación IA</span><div className="ai-estimate-meta-values"><span><small>Categoría</small><strong>{categoryLabel(item.category || "OTHER")}</strong></span><span><small>Preparación</small><strong>{preparationLabel(item.preparation || "UNSPECIFIED")}</strong></span></div></div>
                <label className="ai-estimate-grams-field"><span>Gramos detectados (g)</span><input disabled={refining} inputMode="decimal" value={item.estimatedGrams ?? ""} onFocus={(event) => event.currentTarget.select()} onChange={(event) => updateItem(index, "estimatedGrams", event.target.value)} /></label>
                <div className="ai-estimate-item-section ai-estimate-readonly-nutrition"><span className="ai-estimate-section-label">Resumen nutricional</span><div className="ai-estimate-item-nutrition"><span><small>Kcal</small><strong>{formatNumber(itemNutrition[index]?.calories ?? macroCalories(item.proteinGrams, item.carbsGrams, item.fatGrams))}</strong></span><span><small>Proteínas</small><strong>{formatNumber(itemNutrition[index]?.proteinGrams ?? item.proteinGrams, 1)}g</strong></span><span><small>Carbos</small><strong>{formatNumber(itemNutrition[index]?.carbsGrams ?? item.carbsGrams, 1)}g</strong></span><span><small>Grasas</small><strong>{formatNumber(itemNutrition[index]?.fatGrams ?? item.fatGrams, 1)}g</strong></span></div></div>
              </>}
            </article>
          ))}
          <button type="button" className="secondary ai-estimate-add-item" disabled={refining || estimate.items.length >= 12} onClick={addItem}><Icon name="add" />Agregar alimento</button>
        </div>
        {mode === "saved" && catalogItemIndex != null && <section className="ai-estimate-catalog-form"><strong>Guardar {estimate.items[catalogItemIndex]?.name || "alimento"}</strong><p>Se publicará como alimento global pendiente, normalizado a 100 g. No modifica esta comida.</p><div><Select label="Categoría" value={catalogCategory} options={CATEGORY_OPTIONS} onChange={(event) => setCatalogCategory(event.target.value)} /><Select label="Preparación" value={catalogPreparation} options={PREPARATION_OPTIONS} onChange={(event) => setCatalogPreparation(event.target.value)} /></div><footer><button type="button" className="secondary" disabled={catalogSaving} onClick={() => setCatalogItemIndex(null)}>Cancelar</button><button type="button" className="primary" disabled={catalogSaving} onClick={saveCatalogItem}>{catalogSaving ? "Guardando..." : "Guardar pendiente"}</button></footer></section>}
        {catalogMessage && <p className="ai-estimate-catalog-message" role="status">{catalogMessage}</p>}
        {saveError && <p className="ai-estimate-error" role="alert">{saveError}</p>}
        {mode === "create" && <section className="ai-estimate-refinement">
          <label className="ai-context-field"><span>Corregir estimación con IA</span><textarea maxLength="240" disabled={refining} placeholder="Ej.: no había queso, el pollo eran 250 g y faltó una cucharada de aceite" value={correction} onChange={(event) => setCorrection(event.target.value)} /><small>Usa la foto, tu observación original y la revisión actual como referencia.</small></label>
          {refinementError && <p className="ai-estimate-error" role="alert">{refinementError}</p>}
          <button type="button" className="secondary" disabled={refining || !correction.trim()} onClick={onRefine}>{refining ? "Corrigiendo..." : "Aplicar corrección IA"}</button>
        </section>}
        <div className="ai-estimate-actions"><button className="secondary" disabled={refining || saving} onClick={onDiscard}>{mode === "saved" ? "Cancelar" : "Descartar"}</button><button className="primary" disabled={saving || refining || !canConfirm} onClick={() => onConfirm(estimate)}>{saving ? "Guardando..." : mode === "saved" ? "Guardar cambios" : "Agregar alimentos"}</button></div>
      </section>
  );
  return standalone ? editor : <div className="selected-subpanel ai-estimate-subpanel">{editor}</div>;
}



