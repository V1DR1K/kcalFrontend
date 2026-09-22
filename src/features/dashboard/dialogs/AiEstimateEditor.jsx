import React, { useState } from "react";
import { CATEGORY_OPTIONS, PREPARATION_OPTIONS } from "../../../config/app";
import { Icon } from "../../../components/Icon";
import { Input, Select } from "../../../components/FormControls";
import { ModalShell } from "../../../components/dialog/ModalShell";
import { categoryLabel, preparationLabel } from "../../catalog/CatalogComponents";
import { formatNumber } from "../../../utils/format";
import { aiProposalFood, macroCalories } from "../dashboard.utils";
import { scaleFoodNutrition } from "../../recipes/recipe.utils";
import { decimalNumber } from "../../../utils/decimal";
import { resizeAiEstimateItem } from "../aiEstimateAmounts";

export function AiEstimateEditor({ estimate, setEstimate, correction = "", setCorrection, refining = false, refinementError = "", saveError = "", onRefine, saving, onDiscard, onConfirm, mode = "create", mealType, setMealType, logDate, setLogDate, mealTypes, onCatalogItem }) {
  const [catalogItemIndex, setCatalogItemIndex] = useState(null);
  const [catalogCategory, setCatalogCategory] = useState("OTHER");
  const [catalogPreparation, setCatalogPreparation] = useState("UNSPECIFIED");
  const [catalogSaving, setCatalogSaving] = useState(false);
  const [catalogMessage, setCatalogMessage] = useState("");
  const [refinementOpen, setRefinementOpen] = useState(false);
  const itemNutrition = (estimate.items || []).map((item) => mode === "saved"
    ? { proteinGrams: Number(item.proteinGrams || 0), carbsGrams: Number(item.carbsGrams || 0), fatGrams: Number(item.fatGrams || 0) }
    : scaleFoodNutrition(aiProposalFood(item), decimalNumber(item.estimatedGrams)));
  const totals = itemNutrition.reduce((sum, nutrition) => ({
    proteinGrams: sum.proteinGrams + nutrition.proteinGrams,
    carbsGrams: sum.carbsGrams + nutrition.carbsGrams,
    fatGrams: sum.fatGrams + nutrition.fatGrams,
  }), { proteinGrams: 0, carbsGrams: 0, fatGrams: 0 });
  const calories = macroCalories(totals.proteinGrams, totals.carbsGrams, totals.fatGrams);

  function updateItem(index, value) {
    setEstimate((current) => ({ ...current, items: current.items.map((item, itemIndex) => itemIndex === index ? resizeAiEstimateItem(item, value) : item) }));
  }

  function updateItemName(index, value) {
    setEstimate((current) => ({ ...current, items: current.items.map((item, itemIndex) => itemIndex === index ? { ...item, name: value, catalogFoodId: null, catalogMatchType: null, catalogMatchConfidence: null } : item) }));
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
      setCatalogMessage("Alimento disponible en el catálogo. Si ya existía, reutilizamos su ficha.");
      setCatalogItemIndex(null);
    } catch (error) {
      setCatalogMessage(error.message || "No se pudo guardar el alimento.");
    } finally {
      setCatalogSaving(false);
    }
  }

  function applyRefinement() {
    setRefinementOpen(true);
    onRefine?.();
  }

  const canConfirm = estimate.name.trim() && estimate.items.length && estimate.items.every((item) => item.name?.trim()
    && decimalNumber(item.estimatedGrams) > 0 && decimalNumber(item.estimatedGrams) <= 3000);
  const title = mode === "saved" ? "Revisar estimación guardada" : estimate.name || "Revisar estimación";
  const ariaLabel = mode === "saved" ? "Revisar estimación guardada" : "Revisar estimación por foto";

  return (
    <ModalShell
      title={title}
      description={`Confianza estimada: ${estimate.confidence}%`}
      ariaLabel={ariaLabel}
      closeLabel="Cerrar estimación"
      onClose={onDiscard}
      className="ai-estimate-modal"
      backdropClassName="modal-backdrop ai-estimate-backdrop"
      footer={
        <div className="ai-estimate-actions">
          <button type="button" className="secondary" disabled={refining || saving} onClick={onDiscard}>{mode === "saved" ? "Cancelar" : "Descartar"}</button>
          <button type="button" className="primary" disabled={saving || refining || !canConfirm} onClick={() => onConfirm(estimate)}>{saving ? "Guardando..." : mode === "saved" ? "Guardar cambios" : "Agregar alimentos"}</button>
        </div>
      }
    >
      <div className="ai-estimate-editor">
        {mode === "saved" && <>
          <Input label="Nombre de la comida" value={estimate.name} onChange={(event) => setEstimate((current) => ({ ...current, name: event.target.value }))} />
          <label className="ai-context-field"><span>Descripción</span><textarea maxLength={240} value={estimate.description || ""} onChange={(event) => setEstimate((current) => ({ ...current, description: event.target.value }))} /></label>
          <div className="edit-log-fields">
            <Select label="Comida" value={mealType} options={mealTypes.map((item) => ({ value: item.code, label: item.label }))} onChange={(event) => setMealType(event.target.value)} />
            <Input label="Fecha" type="date" value={logDate} onChange={(event) => setLogDate(event.target.value)} />
          </div>
        </>}

        <section className="ai-estimate-summary" aria-label="Resumen nutricional de la estimación">
          <span className="ai-summary-calories"><small aria-label={mode === "create" ? "Kilocalorías totales" : "Kilocalorías aproximadas"}>Kcal</small><strong>{formatNumber(calories)}</strong></span>
          <span className="ai-summary-protein"><small>Proteínas</small><strong>{formatNumber(totals.proteinGrams, 1)}<b>g</b></strong></span>
          <span className="ai-summary-carbs"><small aria-label="Carbohidratos"><span className="ai-estimate-label-full">Carbohidratos</span><span className="ai-estimate-label-short" aria-hidden="true">Carbos</span></small><strong>{formatNumber(totals.carbsGrams, 1)}<b>g</b></strong></span>
          <span className="ai-summary-fat"><small>Grasas</small><strong>{formatNumber(totals.fatGrams, 1)}<b>g</b></strong></span>
        </section>

        <section className="ai-estimate-food-section" aria-labelledby="ai-estimate-food-heading">
          <div className="ai-estimate-items-heading">
            <h3 id="ai-estimate-food-heading">Alimentos detectados</h3>
            <span>{estimate.items.length} {estimate.items.length === 1 ? "elemento" : "elementos"}</span>
          </div>
          {estimate.items.length > 0 ? <div className="ai-estimate-items">
            {estimate.items.map((item, index) => (
              <article className="ai-estimate-item" key={`${item.name}:${index}`}>
                <div className="ai-estimate-item-heading">
                  <span>Alimento {index + 1}</span>
                  <strong>{formatNumber(itemNutrition[index]?.calories ?? macroCalories(item.proteinGrams, item.carbsGrams, item.fatGrams))} kcal</strong>
                  {mode === "saved" && <button type="button" className="secondary ai-estimate-catalog" disabled={refining || saving} onClick={() => { setCatalogItemIndex(index); setCatalogCategory(item.category || "OTHER"); setCatalogPreparation(item.preparation || "UNSPECIFIED"); setCatalogMessage(""); }}>Guardar en catálogo</button>}
                  <button type="button" className="icon-button ai-estimate-remove" aria-label={`Eliminar ${item.name || `alimento ${index + 1}`}`} disabled={refining || saving} onClick={() => removeItem(index)}><Icon name="delete" /></button>
                </div>
                <div className="ai-estimate-item-fields">
                  <Input label="Alimento" value={item.name} disabled={refining || saving} onChange={(event) => updateItemName(index, event.target.value)} />
                  <label className="ai-estimate-grams-field"><span>Gramos</span><span className="ai-estimate-grams-input"><input type="text" disabled={refining || saving} inputMode="decimal" value={item.estimatedGrams ?? ""} onFocus={(event) => event.currentTarget.select()} onChange={(event) => updateItem(index, event.target.value)} /><span>g</span></span></label>
                </div>
                <details className="ai-estimate-item-details">
                  <summary>Ver detalle nutricional</summary>
                  <div className="ai-estimate-item-detail-content">
                    <div className="ai-estimate-meta-values">
                      <span><small>Categoría</small><strong>{categoryLabel(item.category || "OTHER")}</strong></span>
                      <span><small>Preparación</small><strong>{preparationLabel(item.preparation || "UNSPECIFIED")}</strong></span>
                    </div>
                    {item.catalogFoodId && <small className="ai-estimate-catalog-match">Se usará el alimento del catálogo ({item.catalogMatchConfidence || 0}% de coincidencia).</small>}
                    <div className="ai-estimate-item-nutrition" aria-label={`Aporte nutricional de ${item.name || `alimento ${index + 1}`}`}>
                      <span><small>Kcal</small><strong>{formatNumber(itemNutrition[index]?.calories ?? macroCalories(item.proteinGrams, item.carbsGrams, item.fatGrams))}</strong></span>
                      <span><small>Proteínas</small><strong>{formatNumber(itemNutrition[index]?.proteinGrams ?? item.proteinGrams, 1)}g</strong></span>
                      <span><small>Carbohidratos</small><strong>{formatNumber(itemNutrition[index]?.carbsGrams ?? item.carbsGrams, 1)}g</strong></span>
                      <span><small>Grasas</small><strong>{formatNumber(itemNutrition[index]?.fatGrams ?? item.fatGrams, 1)}g</strong></span>
                    </div>
                  </div>
                </details>
              </article>
            ))}
          </div> : <p className="ai-estimate-empty">No quedan alimentos para agregar. Corregí la estimación o descartala.</p>}
        </section>

        {mode === "create" && estimate.description && <details className="ai-estimate-assumptions">
          <summary>Descripción detectada</summary>
          <p>{estimate.description}</p>
        </details>}

        {mode === "create" && (estimate.assumptions || []).length > 0 && <details className="ai-estimate-assumptions">
          <summary>Supuestos de la estimación</summary>
          <ul>{estimate.assumptions.map((assumption) => <li key={assumption}>{assumption}</li>)}</ul>
        </details>}

        {mode === "saved" && catalogItemIndex != null && <section className="ai-estimate-catalog-form">
          <strong>Guardar {estimate.items[catalogItemIndex]?.name || "alimento"}</strong>
          <p>Se guardará en el catálogo a 100 g. Si ya existe una ficha compatible, se reutiliza. Esta comida conserva sus valores.</p>
          <div><Select label="Categoría" value={catalogCategory} options={CATEGORY_OPTIONS} onChange={(event) => setCatalogCategory(event.target.value)} /><Select label="Preparación" value={catalogPreparation} options={PREPARATION_OPTIONS} onChange={(event) => setCatalogPreparation(event.target.value)} /></div>
          <footer><button type="button" className="secondary" disabled={catalogSaving} onClick={() => setCatalogItemIndex(null)}>Cancelar</button><button type="button" className="primary" disabled={catalogSaving} onClick={saveCatalogItem}>{catalogSaving ? "Guardando..." : "Guardar en catálogo"}</button></footer>
        </section>}
        {catalogMessage && <p className="ai-estimate-catalog-message" role="status">{catalogMessage}</p>}
        {saveError && <p className="ai-estimate-error" role="alert">{saveError}</p>}

        {mode === "create" && <details className="ai-estimate-refinement" open={refinementOpen} onToggle={(event) => setRefinementOpen(event.currentTarget.open)}>
          <summary>Corregir o agregar alimentos con IA</summary>
          <p>Describí qué falta o qué hay que ajustar. La foto y los cambios actuales se usarán como referencia.</p>
          <label className="ai-context-field"><span>Tu corrección</span><textarea maxLength={240} disabled={refining} placeholder="Ej.: agregá una banana de 120 g y quitá el queso" value={correction} onChange={(event) => setCorrection(event.target.value)} /></label>
          {refinementError && <p className="ai-estimate-error" role="alert">{refinementError}</p>}
          <button type="button" className="secondary" disabled={refining || !correction.trim()} onClick={applyRefinement}>{refining ? "Corrigiendo..." : "Aplicar corrección"}</button>
        </details>}
      </div>
    </ModalShell>
  );
}
