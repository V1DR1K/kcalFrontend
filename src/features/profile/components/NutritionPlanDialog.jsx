import React, { useState } from "react";
import { Input } from "../../../components/FormControls";
import { ModalShell } from "../../../components/dialog/ModalShell";
import { formatNumber, macroGrams, today } from "../../../utils/format";
import { NutritionPlanScheduleDialog } from "./NutritionPlanScheduleDialog";
import { MacroControl } from "./ProfilePanels";
import { DUPLICATE_PLAN_NAME_ERROR, hasDuplicatePlanName, isDuplicatePlanNameError } from "./plan-name.utils";

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

export function NutritionPlanDialog({ api, plan, plans = [], onClose, onChanged }) {
  const editing = Boolean(plan?.id);
  const [intent, setIntent] = useState("alternative");
  const [savedAlternative, setSavedAlternative] = useState(null);
  const [form, setForm] = useState(() => formFromPlan(plan));
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const [nameError, setNameError] = useState("");
  const total = Number(String(form.proteinPercent).replace(",", ".")) + Number(String(form.carbsPercent).replace(",", ".")) + Number(String(form.fatPercent).replace(",", "."));
  const grams = {
    protein: macroGrams(form.dailyCalories, Number(String(form.proteinPercent).replace(",", ".")), 4),
    carbs: macroGrams(form.dailyCalories, Number(String(form.carbsPercent).replace(",", ".")), 4),
    fat: macroGrams(form.dailyCalories, Number(String(form.fatPercent).replace(",", ".")), 9),
  };

  function setField(field, value) {
    setFormError("");
    if (field === "name") setNameError("");
    setForm((current) => ({ ...current, [field]: value }));
  }

  function setMacro(field, value) {
    setFormError("");
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function submit(event) {
    event.preventDefault();
    if (saving) return;
    if ([form.proteinPercent, form.carbsPercent, form.fatPercent].some(value => value === "" || !Number.isFinite(Number(String(value).replace(",", "."))) || Number(String(value).replace(",", ".")) < 0 || Number(String(value).replace(",", ".")) > 100) || Math.round(total * 10) / 10 !== 100) {
      setFormError("La suma de proteínas, carbohidratos y grasas debe dar 100%.");
      return;
    }
    if (form.endDate && form.endDate < form.startDate) {
      setFormError("La fecha de fin no puede ser anterior al inicio.");
      return;
    }
    if (hasDuplicatePlanName(plans, form.name, plan?.id)) {
      setNameError(DUPLICATE_PLAN_NAME_ERROR);
      return;
    }
    setSaving(true);
    setFormError("");
    const payload = {
      ...form,
      dailyCalories: Number(form.dailyCalories),
      proteinPercent: Number(String(form.proteinPercent).replace(",", ".")),
      carbsPercent: Number(String(form.carbsPercent).replace(",", ".")),
      fatPercent: Number(String(form.fatPercent).replace(",", ".")),
      endDate: form.endDate || null,
      status: "ALTERNATIVE",
      version: plan?.version,
    };
    try {
      const saved = await api.runAction(
        {
          title: editing ? "Actualizando plan" : "Guardando plan",
          description: "Guardando una alternativa sin cambiar tu meta vigente…",
        },
        () => api.request(editing ? `/api/profile/nutrition-plans/${plan.id}` : "/api/profile/nutrition-plans", {
          method: editing ? "PUT" : "POST",
          body: JSON.stringify(payload),
        }),
        { quiet: true },
      );
      if (intent === "schedule") { setSavedAlternative(saved); return; }
      await onChanged?.(saved);
      window.dispatchEvent(new Event("scalegrams:plan-updated"));
      api.notify(editing ? "Alternativa actualizada." : "Alternativa guardada. Tu meta vigente se conserva.");
      onClose();
    } catch (error) {
      const message = error.message || (editing ? "No se pudo actualizar el plan." : "No se pudo guardar el plan.");
      if (isDuplicatePlanNameError(error)) setNameError(error.fields?.name || DUPLICATE_PLAN_NAME_ERROR);
      else setFormError(message);
      api.notify(message, "error");
    } finally {
      setSaving(false);
    }
  }

  if (savedAlternative) return <NutritionPlanScheduleDialog api={api} plan={savedAlternative} onChanged={onChanged} onClose={async () => { await onChanged?.(); onClose(); }} />;

  return (
    <ModalShell
      as="form"
      onClose={onClose}
      closeDisabled={saving}
      title={editing ? "Editar alternativa" : "Crear alternativa"}
      description="Guardar una alternativa conserva tu meta vigente. Para aplicarla, revisá y confirmá su programación."
      closeLabel="Cerrar plan"
      className="nutrition-plan-dialog"
      backdropClassName="dialog-backdrop"
      wrapContent={false}
      dialogProps={{ onSubmit: submit }}
      footer={(
        <>
          <button type="button" className="secondary" disabled={saving} onClick={onClose}>Cancelar</button>
          <button type="submit" className="primary" disabled={saving || Math.round(total * 10) / 10 !== 100}>
            {saving ? "Guardando..." : intent === "schedule" ? "Guardar y revisar programación" : "Guardar alternativa"}
          </button>
        </>
      )}
    >
      <div className="nutrition-plan-dialog-body" data-dialog-scroll-owner="true">
        <details className="plan-details" open>
          <summary>Detalles del plan</summary>
          <div className="form-grid">
            <label className="field" htmlFor="nutrition-plan-name"><span>Nombre del plan</span><input id="nutrition-plan-name" value={form.name} onChange={(event) => setField("name", event.target.value)} minLength="2" aria-invalid={Boolean(nameError)} aria-describedby={nameError ? "nutrition-plan-name-error" : undefined} required />{nameError && <span id="nutrition-plan-name-error" className="form-error" role="alert">{nameError}</span>}</label>
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
          <Input label="Calorías por día" type="number" min="1" max="10000" step="1" value={form.dailyCalories} onChange={(event) => setField("dailyCalories", event.target.value)} required />
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
          <div className="macro-distribution" style={{ overflow: "hidden" }} aria-label="Distribución de macronutrientes">
            <span className="protein" style={{ width: `${form.proteinPercent}%` }} />
            <span className="carbs" style={{ width: `${form.carbsPercent}%` }} />
            <span className="fat" style={{ width: `${form.fatPercent}%` }} />
          </div>
          <div className={`macro-total ${Math.round(total * 10) / 10 === 100 ? "ok" : "bad"}`}>
            <strong>Total {formatNumber(total, 1)}%</strong>
            <span>{total > 100 ? `${formatNumber(total - 100, 1)} % de más` : `${formatNumber(100 - total, 1)} % por distribuir`} · {grams.protein} g proteínas / {grams.carbs} g carbohidratos / {grams.fat} g grasas</span>
          </div>
        </section>

        <fieldset className="plan-save-intent"><legend>Al guardar</legend><label><input type="radio" name="plan-intent" value="alternative" checked={intent === "alternative"} onChange={() => setIntent("alternative")} /> Guardar alternativa</label><label><input type="radio" name="plan-intent" value="schedule" checked={intent === "schedule"} onChange={() => setIntent("schedule")} /> Guardar y revisar programación</label><p>La programación requiere una confirmación adicional. Si volvés sin confirmar, la alternativa queda guardada.</p></fieldset>
        {formError && <p className="form-error nutrition-plan-dialog-error" role="alert">{formError}</p>}
      </div>
    </ModalShell>
  );
}
