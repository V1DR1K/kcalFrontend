import React, { useEffect, useId, useRef, useState } from "react";
import { CATEGORY_OPTIONS, PREPARATION_OPTIONS } from "../../../config/app";
import { Icon } from "../../../components/Icon";
import { Input, Select } from "../../../components/FormControls";
import { ModalShell } from "../../../components/dialog/ModalShell";
import { categoryLabel, preparationLabel } from "../../catalog/CatalogComponents";
import { formatNumber } from "../../../utils/format";
import { aiProposalFood, macroCalories } from "../dashboard.utils";
import { scaleFoodNutrition } from "../../recipes/recipe.utils";
import { decimalNumber, normalizeDecimalInput } from "../../../utils/decimal";
import { resizeAiEstimateItem } from "../aiEstimateAmounts";

function formatMacro(value) {
  return value == null || !Number.isFinite(Number(value)) ? "Sin dato" : `${formatNumber(value, 1)} g`;
}

function isValidMacro(value, max) {
  // Resizing grams can calculate numeric macros with more precision than manual text input allows.
  const amount = typeof value === "number" ? value : decimalNumber(value);
  return Number.isFinite(amount) && amount >= 0 && amount <= max;
}

export function AiEstimateEditor({ estimate, setEstimate, correction = "", setCorrection, refining = false, refinementError = "", saveError = "", onRefine, saving, checkingMatches = false, matchPreview = null, matchChoices = {}, setMatchChoices, onEstimateEdited, onDiscard, onConfirm, mode = "create", mealType, setMealType, logDate, setLogDate, mealTypes, onCatalogItem, targetType = "RECIPE", addToDiary = false, setAddToDiary, registrationMealType, setRegistrationMealType, registrationDate, setRegistrationDate }) {
  const matchReviewRef = useRef(null);
  const foodReviewSectionRef = useRef(null);
  const gramsInputPrefix = useId().replace(/:/g, "");
  const [catalogItemIndex, setCatalogItemIndex] = useState(null);
  const [catalogCategory, setCatalogCategory] = useState("OTHER");
  const [catalogPreparation, setCatalogPreparation] = useState("UNSPECIFIED");
  const [catalogSaving, setCatalogSaving] = useState(false);
  const [catalogMessage, setCatalogMessage] = useState("");
  const [refinementOpen, setRefinementOpen] = useState(false);
  const [focusedGramsIndex, setFocusedGramsIndex] = useState(null);
  const previewByIndex = new Map((matchPreview?.items || []).map((item) => [item.itemIndex, item.match]));
  const matchPreviewItems = matchPreview?.items || [];
  const pendingMatchChoices = matchPreviewItems.filter(({ itemIndex, match }) =>
    match?.macrosDiffer && !matchChoices[itemIndex]?.choice).length;
  const matchedItemCount = matchPreviewItems.filter(({ match }) => Boolean(match)).length;
  const reviewTargetItemIndex = matchPreviewItems.find(({ itemIndex, match }) =>
    match?.macrosDiffer && !matchChoices[itemIndex]?.choice)?.itemIndex
    ?? matchPreviewItems.find(({ match }) => Boolean(match))?.itemIndex
    ?? matchPreviewItems[0]?.itemIndex;

  useEffect(() => {
    if (!matchPreview) return undefined;
    const frame = window.requestAnimationFrame(() => {
      const target = matchReviewRef.current || foodReviewSectionRef.current;
      if (!target) return;
      const prefersReducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
      target.scrollIntoView?.({ behavior: prefersReducedMotion ? "auto" : "smooth", block: "center" });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [matchPreview]);
  const itemNutrition = (estimate.items || []).map((item, index) => {
    if (mode === "saved") return { proteinGrams: Number(item.proteinGrams || 0), carbsGrams: Number(item.carbsGrams || 0), fatGrams: Number(item.fatGrams || 0) };
    const match = previewByIndex.get(index);
    if (match && matchChoices[index]?.choice === "USE_CATALOG") return {
      proteinGrams: Number(match.proteinGrams || 0), carbsGrams: Number(match.carbsGrams || 0), fatGrams: Number(match.fatGrams || 0),
    };
    return scaleFoodNutrition(aiProposalFood(item), decimalNumber(item.estimatedGrams));
  });
  const totals = itemNutrition.reduce((sum, nutrition) => ({
    proteinGrams: sum.proteinGrams + nutrition.proteinGrams,
    carbsGrams: sum.carbsGrams + nutrition.carbsGrams,
    fatGrams: sum.fatGrams + nutrition.fatGrams,
  }), { proteinGrams: 0, carbsGrams: 0, fatGrams: 0 });
  const calories = macroCalories(totals.proteinGrams, totals.carbsGrams, totals.fatGrams);

  function updateItem(index, value) {
    onEstimateEdited?.();
    setEstimate((current) => ({ ...current, items: current.items.map((item, itemIndex) => itemIndex === index ? resizeAiEstimateItem(item, value) : item) }));
  }

  function updateItemName(index, value) {
    onEstimateEdited?.();
    setEstimate((current) => ({ ...current, items: current.items.map((item, itemIndex) => itemIndex === index ? { ...item, name: value, catalogFoodId: null, catalogMatchType: null, catalogMatchConfidence: null } : item) }));
  }

  function updateItemMacro(index, field, value) {
    onEstimateEdited?.();
    setEstimate((current) => ({ ...current, items: current.items.map((item, itemIndex) => itemIndex === index ? { ...item, [field]: normalizeDecimalInput(value), catalogFoodId: null, catalogMatchType: null, catalogMatchConfidence: null } : item) }));
  }

  function removeItem(index) {
    onEstimateEdited?.();
    setEstimate((current) => ({ ...current, items: current.items.filter((_, itemIndex) => itemIndex !== index) }));
  }

  function chooseCatalogResolution(index, match, choice) {
    setMatchChoices?.((current) => ({ ...current, [index]: { choice, foodId: choice === "USE_CATALOG" ? match.foodId : null } }));
  }

  function confirmEstimate() {
    if (!matchPreview) return onConfirm(estimate);
    const resolutions = (estimate.items || []).map((item, itemIndex) => {
      const match = previewByIndex.get(itemIndex);
      const selected = match && match.macrosDiffer
        ? matchChoices[itemIndex]
        : match ? { choice: "USE_CATALOG", foodId: match.foodId } : { choice: "KEEP_ESTIMATE" };
      return { itemIndex, choice: selected?.choice || "KEEP_ESTIMATE", ...(selected?.choice === "USE_CATALOG" ? { foodId: selected.foodId || match?.foodId } : {}) };
    });
    onConfirm(estimate, resolutions);
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

  const decisionsComplete = !matchPreview || (estimate.items || []).every((item, index) => {
    const match = previewByIndex.get(index);
    return !match || !match.macrosDiffer || Boolean(matchChoices[index]?.choice);
  });
  const canConfirm = estimate.name.trim() && estimate.items.length && estimate.items.every((item) => item.name?.trim()
    && decimalNumber(item.estimatedGrams) > 0 && decimalNumber(item.estimatedGrams) <= 3000
    && isValidMacro(item.proteinGrams, 500)
    && isValidMacro(item.carbsGrams, 1000)
    && isValidMacro(item.fatGrams, 500))
    && (mode === "saved" ? Boolean(mealType && logDate) : targetType === "FOOD" && !addToDiary || Boolean(registrationMealType && registrationDate));
  const title = mode === "saved" ? "Revisar estimación guardada" : estimate.name || "Revisar estimación";
  const ariaLabel = mode === "saved" ? "Revisar estimación guardada" : "Revisar estimación por foto";

  return (
    <ModalShell
      title={title}
      description={`Confianza estimada: ${estimate.confidence}%`}
      ariaLabel={ariaLabel}
      closeLabel="Cerrar estimación"
      onClose={onDiscard}
      closeDisabled={saving || refining}
      className="ai-estimate-modal"
      backdropClassName="modal-backdrop ai-estimate-backdrop"
      footer={
        <div className="ai-estimate-actions">
          <button type="button" className="secondary" disabled={refining || saving} onClick={onDiscard}>{mode === "saved" ? "Cancelar" : "Descartar"}</button>
          <button type="button" className="primary" disabled={saving || refining || !canConfirm || !decisionsComplete} onClick={confirmEstimate}>{checkingMatches ? "Buscando coincidencias..." : saving ? "Guardando..." : mode === "saved" ? "Guardar cambios" : matchPreview ? "Confirmar y guardar" : "Revisar coincidencias y guardar"}</button>
        </div>
      }
    >
      <div className="ai-estimate-editor">
        {mode === "saved" && <>
          <Input label="Nombre de la comida" value={estimate.name} onChange={(event) => setEstimate((current) => ({ ...current, name: event.target.value }))} />
          <label className="ai-context-field"><span>Descripción</span><textarea aria-label="Descripción" maxLength={240} value={estimate.description || ""} onChange={(event) => setEstimate((current) => ({ ...current, description: event.target.value }))} /></label>
          <div className="edit-log-fields">
            <Select label="Comida" value={mealType} options={mealTypes.map((item) => ({ value: item.code, label: item.label }))} onChange={(event) => setMealType(event.target.value)} />
            <Input label="Fecha" type="date" value={logDate} onChange={(event) => setLogDate(event.target.value)} />
          </div>
        </>}

        <section className="ai-estimate-summary" aria-label="Resumen nutricional de la estimación">
          <span className="ai-summary-calories"><small aria-label={mode === "create" ? "Kilocalorías totales" : "Kilocalorías aproximadas"}>kcal</small><strong>{formatNumber(calories)}</strong></span>
          <span className="ai-summary-protein"><small>Proteínas</small><strong>{formatNumber(totals.proteinGrams, 1)}<b> g</b></strong></span>
          <span className="ai-summary-carbs"><small aria-label="Carbohidratos"><span className="ai-estimate-label-full">Carbohidratos</span><span className="ai-estimate-label-short" aria-hidden="true">Carbohidratos</span></small><strong>{formatNumber(totals.carbsGrams, 1)}<b> g</b></strong></span>
          <span className="ai-summary-fat"><small>Grasas</small><strong>{formatNumber(totals.fatGrams, 1)}<b> g</b></strong></span>
        </section>

        {mode === "create" && <section className="ai-registration-diary-options">
          <p role="status" aria-live="polite">{estimate.items.length} {estimate.items.length === 1 ? "alimento detectado: se guardará como alimento en tu catálogo personal." : `alimentos detectados: se creará una receta y se registrará una porción en la fecha y comida elegidas.`}</p>
          {targetType === "FOOD" && <label className="ai-registration-diary-toggle"><input type="checkbox" checked={addToDiary} onChange={(event) => setAddToDiary?.(event.target.checked)} /><span>Agregar también a mi día</span></label>}
          {(addToDiary || targetType === "RECIPE") && <div className="edit-log-fields">
            <Select label="Comida" value={registrationMealType} options={(mealTypes || []).map((item) => ({ value: item.code, label: item.label }))} onChange={(event) => setRegistrationMealType?.(event.target.value)} />
            <Input label="Fecha" type="date" value={registrationDate || ""} onChange={(event) => setRegistrationDate?.(event.target.value)} />
          </div>}
        </section>}

        <section ref={foodReviewSectionRef} className="ai-estimate-food-section" aria-labelledby="ai-estimate-food-heading">
          <div className="ai-estimate-items-heading">
            <h3 id="ai-estimate-food-heading">Alimentos detectados</h3>
            <span>{estimate.items.length} {estimate.items.length === 1 ? "elemento" : "elementos"}</span>
          </div>
          {mode === "create" && matchPreview && <div className="ai-estimate-match-guidance" role="status" aria-live="polite">
            <strong>Revisión de coincidencias</strong>
            <span>{pendingMatchChoices > 0
              ? `${pendingMatchChoices} ${pendingMatchChoices === 1 ? "alimento necesita" : "alimentos necesitan"} tu decisión sobre los macros. Te llevamos a la primera coincidencia.`
              : matchedItemCount > 0
                ? "Las coincidencias están listas. Las fichas con macros iguales se reutilizan automáticamente."
                : "No encontramos fichas cercanas; se conservarán las estimaciones y podrás guardar alimentos nuevos."}</span>
          </div>}
          {estimate.items.length > 0 ? <div className="ai-estimate-items">
            {estimate.items.map((item, index) => (
              <article className="ai-estimate-item" key={index}>
                <div className="ai-estimate-item-heading">
                  <span>Alimento {index + 1}</span>
                  <strong>{formatNumber(itemNutrition[index]?.calories ?? macroCalories(item.proteinGrams, item.carbsGrams, item.fatGrams))} kcal</strong>
                  {mode === "saved" && <button type="button" className="secondary ai-estimate-catalog" disabled={refining || saving} onClick={() => { setCatalogItemIndex(index); setCatalogCategory(item.category || "OTHER"); setCatalogPreparation(item.preparation || "UNSPECIFIED"); setCatalogMessage(""); }}>Guardar en catálogo</button>}
                  <button type="button" className="icon-button ai-estimate-remove" aria-label={`Eliminar ${item.name || `alimento ${index + 1}`}`} disabled={refining || saving} onClick={() => removeItem(index)}><Icon name="delete" /></button>
                </div>
                <div className="ai-estimate-item-fields">
                  <Input label="Alimento" value={item.name} disabled={refining || saving} onChange={(event) => updateItemName(index, event.target.value)} />
                  <div className={`ai-estimate-grams-field ${focusedGramsIndex === index ? "is-editing" : ""}`}>
                    <span className="ai-estimate-grams-label">
                      <label htmlFor={`${gramsInputPrefix}-grams-${index}`}>Gramos</label>
                      {focusedGramsIndex === index && <button type="button" className="ai-estimate-grams-done" aria-label="Listo, ocultar teclado" onPointerDown={(event) => event.preventDefault()} onClick={() => document.activeElement?.blur()}>Listo</button>}
                    </span>
                    <span className="ai-estimate-grams-input"><input id={`${gramsInputPrefix}-grams-${index}`} aria-label="Gramos" type="text" disabled={refining || saving} inputMode="decimal" value={item.estimatedGrams ?? ""} onFocus={() => setFocusedGramsIndex(index)} onBlur={() => setFocusedGramsIndex((current) => current === index ? null : current)} onChange={(event) => updateItem(index, event.target.value)} /><span>g</span></span>
                  </div>
                </div>
                {mode === "create" && matchPreview && (() => {
                  const match = previewByIndex.get(index);
                  if (!match) return <section ref={index === reviewTargetItemIndex ? matchReviewRef : undefined} className="ai-catalog-match ai-catalog-no-match" aria-label="Sin coincidencia de catálogo"><div><strong>Sin coincidencia cercana</strong><p>Se conservarán los macros de la estimación y podrás guardar un alimento nuevo.</p></div></section>;
                  const selectedChoice = match.macrosDiffer ? matchChoices[index]?.choice : "USE_CATALOG";
                  return <section ref={index === reviewTargetItemIndex ? matchReviewRef : undefined} className={`ai-catalog-match ${match.macrosDiffer ? "needs-choice" : "macros-equal"}`} aria-label={`Coincidencia de catálogo para ${item.name}`}>
                    <div className="ai-catalog-match-heading"><div><strong>{match.name}</strong>{match.brand && <span>{match.brand}</span>}</div><small>{formatNumber(Number(match.similarity || 0) * 100, 0)}% de similitud</small></div>
                    <p className="ai-catalog-match-message">{match.macrosDiffer ? "Los macros de la ficha difieren para esta cantidad. Elegí qué valores querés guardar." : "Los macros coinciden para esta cantidad; se reutilizará esta ficha."}</p>
                    <div className="ai-catalog-macros" aria-label="Comparación de macros para la cantidad estimada">
                      <span><small>Macronutriente</small><strong>Estimación</strong><strong>Catálogo</strong></span>
                      {[["Proteínas", "proteinGrams"], ["Carbohidratos", "carbsGrams"], ["Grasas", "fatGrams"]].map(([label, field]) => <span key={field}><small>{label}</small><strong>{formatMacro(scaleFoodNutrition(aiProposalFood(item), decimalNumber(item.estimatedGrams))[field])}</strong><strong>{formatMacro(match[field])}</strong></span>)}
                    </div>
                    {match.macrosDiffer ? <div className="ai-catalog-match-actions" role="group" aria-label={`Elegir macros para ${item.name}`}>
                      <button type="button" className={selectedChoice === "USE_CATALOG" ? "selected" : "secondary"} aria-pressed={selectedChoice === "USE_CATALOG"} disabled={saving || refining} onClick={() => chooseCatalogResolution(index, match, "USE_CATALOG")}>Usar ficha existente</button>
                      <button type="button" className={selectedChoice === "KEEP_ESTIMATE" ? "selected" : "secondary"} aria-pressed={selectedChoice === "KEEP_ESTIMATE"} disabled={saving || refining} onClick={() => chooseCatalogResolution(index, match, "KEEP_ESTIMATE")}>Conservar estimación</button>
                    </div> : <small className="ai-catalog-auto-choice">La ficha del catálogo se usará automáticamente.</small>}
                  </section>;
                })()}
                <details className="ai-estimate-item-details">
                  <summary>Ver detalle nutricional</summary>
                  <div className="ai-estimate-item-detail-content">
                    {mode === "create" && <p className="ai-estimate-detail-hint">Macros para los {formatNumber(item.estimatedGrams)} g estimados. Podés corregirlos antes de guardar.</p>}
                    <div className="ai-estimate-meta-values">
                      <span className="ai-estimate-detail-category"><small>Categoría</small><strong>{categoryLabel(item.category || "OTHER")}</strong></span>
                      <span className="ai-estimate-detail-preparation"><small>Preparación</small><strong>{preparationLabel(item.preparation || "UNSPECIFIED")}</strong></span>
                    </div>
                    {item.catalogFoodId && <small className="ai-estimate-catalog-match">Se usará el alimento del catálogo ({item.catalogMatchConfidence || 0}% de coincidencia).</small>}
                    <div className={`ai-estimate-item-nutrition ${mode === "create" ? "editable" : ""}`} aria-label={`Aporte nutricional de ${item.name || `alimento ${index + 1}`}`}>
                      <span className="ai-estimate-nutrient-calories"><small>kcal</small><strong>{formatNumber(itemNutrition[index]?.calories ?? macroCalories(item.proteinGrams, item.carbsGrams, item.fatGrams))}</strong></span>
                      {[
                        ["Proteínas (g)", "proteinGrams", "protein"],
                        ["Carbohidratos (g)", "carbsGrams", "carbs"],
                        ["Grasas (g)", "fatGrams", "fat"],
                      ].map(([label, field, nutrient]) => {
                        return <label className={`ai-estimate-macro-edit ai-estimate-nutrient-${nutrient}`} key={field}><small>{label}</small>{mode === "create" ? <input type="text" inputMode="decimal" value={item[field] ?? "0"} disabled={refining || saving} onChange={(event) => updateItemMacro(index, field, event.target.value)} /> : <strong>{formatNumber(itemNutrition[index]?.[field] ?? item[field], 1)} g</strong>}</label>;
                      })}
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
          <label className="ai-context-field"><span>Tu corrección</span><textarea aria-label="Tu corrección" maxLength={240} disabled={refining} placeholder="Ej.: agregá una banana de 120 g y quitá el queso" value={correction} onChange={(event) => setCorrection(event.target.value)} /></label>
          {refinementError && <p className="ai-estimate-error" role="alert">{refinementError}</p>}
          <button type="button" className="secondary" disabled={refining || !correction.trim()} onClick={applyRefinement}>{refining ? "Corrigiendo..." : "Aplicar corrección"}</button>
        </details>}
      </div>
    </ModalShell>
  );
}
