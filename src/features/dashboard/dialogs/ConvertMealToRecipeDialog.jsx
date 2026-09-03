import React, { useState } from "react";
import { Input } from "../../../components/FormControls";
import { ModalShell } from "../../../components/dialog/ModalShell";
import { decimalNumber } from "../../../utils/decimal";
import { formatMealLogAmount, isCopyableMealLog, mealLogName } from "../dashboard.utils";

export function ConvertMealToRecipeDialog({ api, mealType, meal, date, onClose, onDone }) {
  const [name, setName] = useState(mealType.label);
  const [description, setDescription] = useState("");
  const [cookedWeight, setCookedWeight] = useState("");
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);
  const items = meal?.items || [];
  const convertibleItems = items.filter(isCopyableMealLog);
  const skippedItems = items.filter((item) => !isCopyableMealLog(item));

  async function submit(event) {
    event.preventDefault();
    if (saving) return;
    const trimmedName = name.trim();
    const parsedCookedWeight = cookedWeight.trim() ? decimalNumber(cookedWeight) : null;
    if (trimmedName.length < 2) return setFormError("Poné un nombre de al menos 2 caracteres.");
    if (cookedWeight.trim() && (!Number.isFinite(parsedCookedWeight) || parsedCookedWeight <= 0)) {
      return setFormError("Ingresá un peso cocido final mayor a cero o dejalo vacío.");
    }
    setFormError("");
    setSaving(true);
    try {
      const result = await api.runAction(
        { title: "Creando receta", description: "Estamos guardando los alimentos y sus proporciones..." },
        () => api.request("/api/recipes/from-meal", {
          method: "POST",
          body: JSON.stringify({
            name: trimmedName,
            description: description.trim(),
            mealType: mealType.code,
            logDate: date,
            cookedTotalWeightGrams: parsedCookedWeight,
          }),
        }),
        { quiet: true },
      );
      const omitted = result?.skippedItems || [];
      api.notify(omitted.length ? `Receta creada. Se omitieron: ${omitted.join(", ")}.` : "Receta creada.");
      onDone?.(result?.recipe || result);
      onClose();
    } catch (error) {
      const message = error.message || "No se pudo crear la receta.";
      setFormError(message);
      api.notify(message, "error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <ModalShell
      title={`Convertir ${mealType.label.toLowerCase()} en receta`}
      description="Se guardará una receta nueva y tu registro actual no cambiará."
      eyebrow="Recetas"
      onClose={onClose}
      closeDisabled={saving}
      className="convert-meal-modal"
      backdropClassName="convert-meal-backdrop"
      footer={(
        <div className="modal-actions">
          <button type="button" className="secondary" onClick={onClose} disabled={saving}>Cancelar</button>
          <button type="submit" form="convert-meal-form" className="primary" disabled={saving || !convertibleItems.length}>{saving ? "Guardando..." : "Guardar receta"}</button>
        </div>
      )}
    >
      <form id="convert-meal-form" className="convert-meal-form" onSubmit={submit}>
        {formError && <p className="form-error" role="alert">{formError}</p>}
        <Input label="Nombre de la receta" value={name} onChange={(event) => { setName(event.target.value); setFormError(""); }} required maxLength="120" />
        <Input label="Descripción opcional" value={description} onChange={(event) => setDescription(event.target.value)} maxLength="500" />
        <Input decimal numericOnly label="Peso cocido final (g), opcional" inputMode="decimal" min="0.1" step="0.01" value={cookedWeight} onChange={(event) => { setCookedWeight(event.target.value); setFormError(""); }} />
        <section className="convert-meal-summary" aria-label="Alimentos incluidos">
          <div>
            <strong>{convertibleItems.length} {convertibleItems.length === 1 ? "elemento" : "elementos"} guardados</strong>
            <small>Las recetas existentes se desglosarán en sus alimentos y proporciones.</small>
          </div>
          <ul>
            {convertibleItems.map((item) => <li key={item.id}><span>{mealLogName(item)}</span><small>{formatMealLogAmount(item)}</small></li>)}
          </ul>
          {skippedItems.length > 0 && <p className="convert-meal-warning">Las estimaciones por foto sin alimento de catálogo se omitirán: {skippedItems.map(mealLogName).join(", ")}.</p>}
        </section>
      </form>
    </ModalShell>
  );
}
