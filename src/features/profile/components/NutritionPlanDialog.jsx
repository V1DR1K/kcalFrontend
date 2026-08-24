import React, { useState } from "react";
import { Input } from "../../../components/FormControls";
import { ModalShell } from "../../../components/dialog/ModalShell";
import { formatNumber, macroGrams, today } from "../../../utils/format";
import { MacroControl } from "./ProfilePanels";

function formFromPlan(plan) {
  return plan
    ? {
        name: plan.name,
        dailyCalories: plan.dailyCalories,
        proteinPercent: Number(plan.proteinPercent),
        carbsPercent: Number(plan.carbsPercent),
        fatPercent: Number(plan.fatPercent),
        startDate: plan.startDate,
        endDate: plan.endDate || "",
      }
    : {
        name: "Plan manual",
        dailyCalories: 2200,
        proteinPercent: 25,
        carbsPercent: 50,
        fatPercent: 25,
        startDate: today(),
        endDate: "",
      };
}

export function NutritionPlanDialog({ api, plan, onClose, onChanged }) {
  const editing = Boolean(plan);
  const [form, setForm] = useState(() => formFromPlan(plan));
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const total = Number(form.proteinPercent) + Number(form.carbsPercent) + Number(form.fatPercent);
  const grams = {
    protein: macroGrams(form.dailyCalories, form.proteinPercent, 4),
    carbs: macroGrams(form.dailyCalories, form.carbsPercent, 4),
    fat: macroGrams(form.dailyCalories, form.fatPercent, 9),
  };

  function setField(field, value) {
    setFormError("");
    setForm((current) => ({ ...current, [field]: value }));
  }

  function setMacro(field, value) {
    setFormError("");
    setForm((current) => {
      const otherFields = ["proteinPercent", "carbsPercent", "fatPercent"].filter((key) => key !== field);
      const remaining = Math.max(0, 100 - otherFields.reduce((sum, key) => sum + Number(current[key] || 0), 0));
      return { ...current, [field]: Math.min(remaining, Math.max(0, Number(value))) };
    });
  }

  async function submit(event) {
    event.preventDefault();
    if (saving) return;
    if (Math.round(total * 10) / 10 !== 100) {
      setFormError("La suma de proteínas, carbohidratos y grasas debe dar 100%.");
      return;
    }
    if (form.endDate && form.endDate < form.startDate) {
      setFormError("La fecha de fin no puede ser anterior al inicio.");
      return;
    }
    setSaving(true);
    setFormError("");
    const payload = {
      ...form,
      dailyCalories: Number(form.dailyCalories),
      proteinPercent: Number(form.proteinPercent),
      carbsPercent: Number(form.carbsPercent),
      fatPercent: Number(form.fatPercent),
      endDate: form.endDate || null,
    };
    try {
      const saved = await api.runAction(
        {
          title: editing ? "Actualizando plan" : "Guardando plan",
          description: "Estamos recalculando tu objetivo diario...",
        },
        () => api.request(editing ? `/api/profile/nutrition-plans/${plan.id}` : "/api/profile/nutrition-plans", {
          method: editing ? "PUT" : "POST",
          body: JSON.stringify(payload),
        }),
        { quiet: true },
      );
      await onChanged?.(saved);
      window.dispatchEvent(new Event("scalegrams:plan-updated"));
      api.notify(editing ? "Plan alimenticio actualizado." : "Plan alimenticio guardado.");
      onClose();
    } catch (error) {
      const message = error.message || (editing ? "No se pudo actualizar el plan." : "No se pudo guardar el plan.");
      setFormError(message);
      api.notify(message, "error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <ModalShell
      as="form"
      onClose={onClose}
      closeDisabled={saving}
      title={editing ? "Editar plan" : "Crear plan"}
      eyebrow="Plan alimenticio"
      description="Definí tus calorías diarias y cómo querés distribuirlas."
      closeLabel="Cerrar plan"
      className="nutrition-plan-dialog"
      backdropClassName="dialog-backdrop"
      wrapContent={false}
      dialogProps={{ onSubmit: submit }}
      footer={(
        <>
          <button type="button" className="secondary" disabled={saving} onClick={onClose}>Cancelar</button>
          <button type="submit" className="primary" disabled={saving || Math.round(total * 10) / 10 !== 100}>
            {saving ? "Guardando..." : editing ? "Guardar cambios" : "Crear plan"}
          </button>
        </>
      )}
    >
      <div className="nutrition-plan-dialog-body">
        <details className="plan-details" open>
          <summary>Detalles del plan</summary>
          <div className="form-grid">
            <Input label="Nombre del plan" value={form.name} onChange={(event) => setField("name", event.target.value)} minLength="2" required />
            <div className="split">
              <Input label="Comienza" type="date" value={form.startDate} onChange={(event) => setField("startDate", event.target.value)} required />
              <Input label="Finaliza (opcional)" type="date" value={form.endDate} onChange={(event) => setField("endDate", event.target.value)} />
            </div>
          </div>
        </details>

        <section className="plan-dialog-section plan-calorie-step">
          <span className="step-number" aria-hidden="true">1</span>
          <div>
            <strong>¿Cuántas calorías querés consumir?</strong>
            <small>Este es tu presupuesto diario. Los gramos se recalculan mientras distribuís los macros.</small>
          </div>
          <Input label="Calorías por día" type="number" min="800" max="10000" step="10" value={form.dailyCalories} onChange={(event) => setField("dailyCalories", event.target.value)} required />
        </section>

        <section className="plan-dialog-section">
          <div className="plan-dialog-section-heading">
            <span className="step-number" aria-hidden="true">2</span>
            <div><strong>Distribuí tus nutrientes</strong><small>La suma debe completar el 100% de tu energía diaria.</small></div>
          </div>
          <div className="macro-editor">
            <MacroControl label="Proteínas" description="Saciedad y mantenimiento muscular" value={form.proteinPercent} grams={grams.protein} onChange={(value) => setMacro("proteinPercent", value)} tone="protein" />
            <MacroControl label="Carbohidratos" description="Energía para tu día" value={form.carbsPercent} grams={grams.carbs} onChange={(value) => setMacro("carbsPercent", value)} tone="carbs" />
            <MacroControl label="Grasas" description="Hormonas y vitaminas" value={form.fatPercent} grams={grams.fat} onChange={(value) => setMacro("fatPercent", value)} tone="fat" />
          </div>
          <div className="macro-distribution" aria-label="Distribución de macronutrientes">
            <span className="protein" style={{ width: `${form.proteinPercent}%` }} />
            <span className="carbs" style={{ width: `${form.carbsPercent}%` }} />
            <span className="fat" style={{ width: `${form.fatPercent}%` }} />
          </div>
          <div className={`macro-total ${Math.round(total * 10) / 10 === 100 ? "ok" : "bad"}`}>
            <strong>Total {formatNumber(total, 1)}%</strong>
            <span>{Math.max(0, 100 - total)}% disponible · {grams.protein}g proteínas / {grams.carbs}g carbs / {grams.fat}g grasas</span>
          </div>
        </section>

        {formError && <p className="form-error nutrition-plan-dialog-error" role="alert">{formError}</p>}
      </div>
    </ModalShell>
  );
}
