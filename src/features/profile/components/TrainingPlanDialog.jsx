import React, { useEffect, useMemo, useState } from "react";
import { Icon } from "../../../components/Icon";
import { Input, Select } from "../../../components/FormControls";
import { ModalShell } from "../../../components/dialog/ModalShell";
import { today } from "../../../utils/format";
import { trainingApi } from "../../training/training-api";
import { exerciseRegistration, moveItem, planPayload } from "../../training/training-utils";
import { SkeletonRows } from "../../../components/Loading";
import { TrainingPlanDayEditor } from "./TrainingPlanDayEditor";

const key = () => crypto.randomUUID?.() || Math.random().toString(36).slice(2);
const weekdays = [
  { value: "MONDAY", label: "Lunes" }, { value: "TUESDAY", label: "Martes" },
  { value: "WEDNESDAY", label: "Miércoles" }, { value: "THURSDAY", label: "Jueves" },
  { value: "FRIDAY", label: "Viernes" }, { value: "SATURDAY", label: "Sábado" },
  { value: "SUNDAY", label: "Domingo" },
];
const moduleOptions = [{ value: "GYM", label: "Gimnasio" }, { value: "CALISTHENICS", label: "Calistenia" }];
const frequencyOptions = [{ value: "FIXED", label: "Días fijos" }, { value: "DYNAMIC", label: "Orden dinámico" }];

function draftFromPlan(plan) {
  return {
    version: plan?.version ?? null,
    name: plan?.name || "", module: plan?.module || "GYM", frequencyMode: plan?.frequencyMode || "FIXED",
    targetSessionsPerWeek: plan?.targetSessionsPerWeek || 3, startDate: plan?.startDate || today(), endDate: plan?.endDate || "", active: plan?.active !== false,
    days: (plan?.days || []).map((day, dayIndex) => ({
      id: day.id || key(), name: day.name || `Día ${dayIndex + 1}`, dayOfWeek: day.dayOfWeek || "",
      exercises: (day.exercises || []).map((exercise) => ({
        id: exercise.id || key(), exerciseId: String(exercise.exerciseId || ""), name: exercise.exerciseName || exercise.name || exercise.exercise?.name || "",
        module: exercise.module || exercise.exercise?.module || plan?.module, category: exercise.category || exercise.exercise?.category || "",
        registrationType: exerciseRegistration(exercise, plan?.module), unilateral: Boolean(exercise.unilateral || exercise.exercise?.unilateral),
      })),
    })),
  };
}

function emptyDay(index, frequencyMode) {
  return { id: key(), name: `Día ${index + 1}`, dayOfWeek: frequencyMode === "FIXED" ? "MONDAY" : "", exercises: [] };
}

function weekdayLabel(value) {
  return weekdays.find((weekday) => weekday.value === value)?.label || "Orden dinámico";
}

function TrainingPlanDaySummary({ day, dayIndex, totalDays, onOpen, onMove, onRemove }) {
  return (
    <article className="training-plan-day-summary">
      <header className="training-plan-day-summary-header">
        <div className="training-plan-day-summary-title">
          <span className="training-plan-day-number">{String(dayIndex + 1).padStart(2, "0")}</span>
          <div>
            <strong>{day.name || `Día ${dayIndex + 1}`}</strong>
            <span>{weekdayLabel(day.dayOfWeek)} · {day.exercises.length} {day.exercises.length === 1 ? "ejercicio" : "ejercicios"}</span>
          </div>
        </div>
        <div className="training-plan-day-summary-actions">
          <div className="training-move-controls">
            <button type="button" className="training-icon-action" aria-label={`Mover ${day.name} hacia arriba`} disabled={dayIndex === 0} onClick={() => onMove(dayIndex, dayIndex - 1)}><Icon name="keyboard_arrow_up" /></button>
            <button type="button" className="training-icon-action" aria-label={`Mover ${day.name} hacia abajo`} disabled={dayIndex === totalDays - 1} onClick={() => onMove(dayIndex, dayIndex + 1)}><Icon name="expand_more" /></button>
          </div>
          <button type="button" className="training-icon-action training-delete-control" aria-label={`Quitar ${day.name}`} onClick={onRemove}><Icon name="delete" /></button>
        </div>
      </header>
      <div className="training-plan-day-summary-body">
        {day.exercises.length ? (
          <div className="training-plan-day-summary-exercises">
            {day.exercises.map((exercise, index) => <span key={exercise.id}><b>{String(index + 1).padStart(2, "0")}</b>{exercise.name || "Ejercicio sin seleccionar"}</span>)}
          </div>
        ) : <p className="training-plan-day-summary-empty">Este día todavía no tiene ejercicios.</p>}
        <button type="button" className="training-secondary training-plan-day-open" onClick={onOpen}><Icon name={day.exercises.length ? "edit" : "add"} />{day.exercises.length ? "Editar día" : "Agregar ejercicio"}</button>
      </div>
    </article>
  );
}

export function TrainingPlanDialog({ api, plan, exercises = [], onClose, onChanged }) {
  const editing = Boolean(plan?.id);
  const [form, setForm] = useState(() => draftFromPlan(plan));
  const [loading, setLoading] = useState(editing && !plan.days);
  const [saving, setSaving] = useState(false); const [error, setError] = useState(""); const [moduleNotice, setModuleNotice] = useState("");
  const [activeDayId, setActiveDayId] = useState(null);

  useEffect(() => {
    if (!editing || plan.days) return undefined;
    let current = true;
    trainingApi.plan(api, plan.id).then((detail) => { if (current) { setForm(draftFromPlan(detail)); setLoading(false); } }).catch((requestError) => { if (current) { setError(requestError?.message || "No se pudo cargar el plan."); setLoading(false); } });
    return () => { current = false; };
  }, [api, editing, plan]);

  const initialItems = useMemo(() => [...exercises, ...form.days.flatMap((day) => day.exercises).filter((exercise) => exercise.exerciseId).map((exercise) => ({ id: exercise.exerciseId, name: exercise.name, module: exercise.module, category: exercise.category, registrationType: exercise.registrationType, unilateral: exercise.unilateral, active: true }))], [exercises, form.days]);
  const activeDayIndex = form.days.findIndex((day) => day.id === activeDayId);
  const activeDay = activeDayIndex >= 0 ? form.days[activeDayIndex] : null;

  function setField(field, value) { setError(""); setForm((current) => ({ ...current, [field]: value })); }
  function updateDay(index, patch) { setError(""); setForm((current) => ({ ...current, days: current.days.map((day, dayIndex) => dayIndex === index ? { ...day, ...patch } : day) })); }
  function changeModule(value) {
    const known = new Map([...exercises, ...initialItems].map((exercise) => [String(exercise.id), exercise])); let removed = 0;
    setForm((current) => ({ ...current, module: value, days: current.days.map((day) => ({ ...day, exercises: day.exercises.map((exercise) => { const knownExercise = known.get(String(exercise.exerciseId)); if (knownExercise?.module && knownExercise.module !== value) { removed += 1; return { ...exercise, exerciseId: "", name: "", category: "" }; } return { ...exercise, module: value }; }) })) }));
    setModuleNotice(removed ? `Se quitaron ${removed} ejercicio${removed === 1 ? "" : "s"} incompatible${removed === 1 ? "" : "s"}.` : "El módulo cambió. Las selecciones compatibles se conservaron.");
  }
  function addExercise(dayIndex, selected) {
    const exercise = selected || {};
    const nextExercise = { id: key(), exerciseId: String(exercise.id || ""), name: exercise.name || "", module: exercise.module || form.module, category: exercise.category || "", registrationType: exerciseRegistration(exercise, form.module), unilateral: Boolean(exercise.unilateral) };
    setError("");
    setForm((current) => ({ ...current, days: current.days.map((day, index) => index === dayIndex ? { ...day, exercises: [...day.exercises, nextExercise] } : day) }));
  }

  async function submit(event) {
    event.preventDefault();
    if (saving || loading) return;
    if (!form.name.trim()) return setError("Dale un nombre al plan.");
    if (Number(form.targetSessionsPerWeek) < 1) return setError("Indicá al menos una sesión semanal.");
    if (!form.days.length) return setError("Agregá al menos un día al plan.");
    if (form.endDate && form.endDate < form.startDate) return setError("La fecha final no puede ser anterior al inicio.");
    const seenWeekdays = new Set();
    for (const day of form.days) {
      if (!day.name.trim()) return setError("Cada día necesita un nombre.");
      if (!day.exercises.length || day.exercises.some((exercise) => !exercise.exerciseId)) return setError("Cada día necesita al menos un ejercicio válido.");
      if (form.frequencyMode === "FIXED" && (!day.dayOfWeek || seenWeekdays.has(day.dayOfWeek))) return setError("Los días fijos deben tener días de semana únicos.");
      if (form.frequencyMode === "FIXED") seenWeekdays.add(day.dayOfWeek);
    }
    setSaving(true); setError("");
    try { const saved = await api.runAction({ title: editing ? "Actualizando plan" : "Guardando plan", description: "Estamos organizando tus días y ejercicios..." }, () => trainingApi.savePlan(api, plan || {}, planPayload(form)), { quiet: true }); api.notify(editing ? "Plan de entrenamiento actualizado." : "Plan de entrenamiento creado."); await onChanged?.(saved); onClose(); }
    catch (saveError) { setError(saveError?.message || "No se pudo guardar el plan."); } finally { setSaving(false); }
  }

  const title = activeDay ? activeDay.name || `Día ${activeDayIndex + 1}` : editing ? "Editar plan" : "Nuevo plan";
  const description = activeDay ? "Completá la secuencia y revisá qué información verá tu próxima sesión." : "Definí la estructura que vas a repetir. Las métricas se registran al iniciar una sesión.";
  const footer = activeDay ? <><button type="button" className="training-secondary" onClick={() => setActiveDayId(null)} disabled={saving}>Volver al plan</button><button type="submit" form="training-plan-form" className="training-primary" disabled={saving || loading}>{saving ? "Guardando…" : "Guardar plan"}</button></> : <><button type="button" className="training-secondary" onClick={onClose} disabled={saving}>Cancelar</button><button type="submit" form="training-plan-form" className="training-primary" disabled={saving || loading}>{saving ? "Guardando…" : editing ? "Guardar cambios" : "Crear plan"}</button></>;

  return <ModalShell title={title} description={description} eyebrow={activeDay ? "Editar plan · Día" : undefined} onClose={activeDay ? () => setActiveDayId(null) : onClose} closeDisabled={saving} theme="training" className={`training-plan-dialog ${activeDay ? "training-plan-day-dialog" : ""}`.trim()} backdropClassName="training-session-backdrop" footer={footer}>
    {loading ? <SkeletonRows count={5} className="training-loading" label="Cargando plan" /> : <form id="training-plan-form" className="training-editor-form" onSubmit={submit}>
      {activeDay ? <TrainingPlanDayEditor api={api} day={activeDay} dayIndex={activeDayIndex} module={form.module} frequencyMode={form.frequencyMode} initialItems={initialItems} onDayChange={(patch) => updateDay(activeDayIndex, patch)} onExerciseMove={(from, to) => updateDay(activeDayIndex, { exercises: moveItem(activeDay.exercises, from, to) })} onExerciseRemove={(exerciseIndex) => updateDay(activeDayIndex, { exercises: activeDay.exercises.filter((_, index) => index !== exerciseIndex) })} onExerciseAdd={(exercise) => addExercise(activeDayIndex, exercise)} /> : <>
        <div className="training-plan-form-intro"><strong>Solo estructura</strong><span>Configurá los datos del plan y abrí cada día para ordenar sus ejercicios sin mezclar niveles de información.</span></div>
        <div className="training-plan-fields"><Input label="Nombre del plan" value={form.name} maxLength="120" required onChange={(event) => setField("name", event.target.value)} placeholder="Ej.: Fuerza de base" /><div className="training-plan-field-row"><Select label="Módulo" value={form.module} options={moduleOptions} onChange={(event) => changeModule(event.target.value)} /><Select label="Frecuencia" value={form.frequencyMode} options={frequencyOptions} onChange={(event) => { const frequencyMode = event.target.value === "DYNAMIC" ? "DYNAMIC" : "FIXED"; setForm((current) => ({ ...current, frequencyMode, days: current.days.map((day) => ({ ...day, dayOfWeek: frequencyMode === "DYNAMIC" ? "" : day.dayOfWeek })) })); }} /><Input label="Sesiones por semana" type="number" min="1" max="14" numericOnly value={form.targetSessionsPerWeek} onChange={(event) => setField("targetSessionsPerWeek", event.target.value)} /></div><div className="training-plan-field-row"><Input label="Comienza" type="date" value={form.startDate} onChange={(event) => setField("startDate", event.target.value)} /><Input label="Finaliza (opcional)" type="date" value={form.endDate} onChange={(event) => setField("endDate", event.target.value)} /><label className="training-toggle"><input type="checkbox" checked={form.active} onChange={(event) => setField("active", event.target.checked)} /><span><strong>Plan activo</strong><small>Disponible para sugerencias y registro</small></span></label></div></div>
        {moduleNotice && <p className="training-form-notice" role="status">{moduleNotice}</p>}
        <div className="training-section-heading"><div><h3>Días del plan</h3><span>{form.frequencyMode === "FIXED" ? "Cada día tiene una ubicación y una secuencia propia." : "El orden define la próxima sesión."}</span></div><button type="button" className="training-secondary training-add-control" onClick={() => setForm((current) => ({ ...current, days: [...current.days, emptyDay(current.days.length, current.frequencyMode)] }))}><Icon name="add" />Agregar día</button></div>
        <div className="training-plan-day-list">{form.days.map((day, dayIndex) => <TrainingPlanDaySummary key={day.id} day={day} dayIndex={dayIndex} totalDays={form.days.length} onOpen={() => setActiveDayId(day.id)} onMove={(from, to) => setForm((current) => ({ ...current, days: moveItem(current.days, from, to) }))} onRemove={() => setForm((current) => ({ ...current, days: current.days.filter((_, index) => index !== dayIndex) }))} />)}</div>
      </>}
      {error && <p className="training-form-error" role="alert">{error}</p>}
    </form>}
  </ModalShell>;
}
