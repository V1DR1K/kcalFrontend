import React, { useEffect, useMemo, useState } from "react";
import { Icon } from "../../../components/Icon";
import { Input, Select } from "../../../components/FormControls";
import { ModalShell } from "../../../components/dialog/ModalShell";
import { today } from "../../../utils/format";
import { trainingApi } from "../../training/training-api";
import { ExerciseCombobox } from "../../training/ExerciseCombobox";
import { exerciseRegistration, moveItem, planPayload, registrationTypeLabel } from "../../training/training-utils";
import { SkeletonRows } from "../../../components/Loading";

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

function emptyDay(index, frequencyMode) { return { id: key(), name: `Día ${index + 1}`, dayOfWeek: frequencyMode === "FIXED" ? "MONDAY" : "", exercises: [] }; }

export function TrainingPlanDialog({ api, plan, exercises = [], onClose, onChanged }) {
  const editing = Boolean(plan?.id);
  const [form, setForm] = useState(() => draftFromPlan(plan));
  const [loading, setLoading] = useState(editing && !plan.days);
  const [saving, setSaving] = useState(false); const [error, setError] = useState(""); const [moduleNotice, setModuleNotice] = useState("");

  useEffect(() => {
    if (!editing || plan.days) return undefined;
    let current = true;
    trainingApi.plan(api, plan.id).then((detail) => { if (current) { setForm(draftFromPlan(detail)); setLoading(false); } }).catch((requestError) => { if (current) { setError(requestError?.message || "No se pudo cargar el plan."); setLoading(false); } });
    return () => { current = false; };
  }, [api, editing, plan]);

  const initialItems = useMemo(() => [...exercises, ...form.days.flatMap((day) => day.exercises).filter((exercise) => exercise.exerciseId).map((exercise) => ({ id: exercise.exerciseId, name: exercise.name, module: exercise.module, category: exercise.category, registrationType: exercise.registrationType, unilateral: exercise.unilateral, active: true }))], [exercises, form.days]);
  function setField(field, value) { setError(""); setForm((current) => ({ ...current, [field]: value })); }
  function updateDay(index, patch) { setError(""); setForm((current) => ({ ...current, days: current.days.map((day, dayIndex) => dayIndex === index ? { ...day, ...patch } : day) })); }
  function updateExercise(dayIndex, exerciseIndex, patch) { setError(""); setForm((current) => ({ ...current, days: current.days.map((day, index) => index === dayIndex ? { ...day, exercises: day.exercises.map((exercise, itemIndex) => itemIndex === exerciseIndex ? { ...exercise, ...patch } : exercise) } : day) })); }
  function changeModule(value) {
    const known = new Map([...exercises, ...initialItems].map((exercise) => [String(exercise.id), exercise])); let removed = 0;
    setForm((current) => ({ ...current, module: value, days: current.days.map((day) => ({ ...day, exercises: day.exercises.map((exercise) => { const knownExercise = known.get(String(exercise.exerciseId)); if (knownExercise?.module && knownExercise.module !== value) { removed += 1; return { ...exercise, exerciseId: "", name: "", category: "" }; } return { ...exercise, module: value }; }) })) }));
    setModuleNotice(removed ? `Se quitaron ${removed} ejercicio${removed === 1 ? "" : "s"} incompatible${removed === 1 ? "" : "s"}.` : "El módulo cambió. Las selecciones compatibles se conservaron.");
  }
  function selectExercise(dayIndex, exerciseIndex, value, selected) { updateExercise(dayIndex, exerciseIndex, { exerciseId: value, name: selected?.name || "", category: selected?.category || "", module: selected?.module || form.module, registrationType: exerciseRegistration(selected, form.module), unilateral: Boolean(selected?.unilateral) }); }
  function addExercise(dayIndex) { updateDay(dayIndex, { exercises: [...form.days[dayIndex].exercises, { id: key(), exerciseId: "", name: "", module: form.module, category: "", registrationType: form.module === "GYM" ? "WEIGHT_AND_REPETITIONS" : "REPETITIONS", unilateral: false }] }); }

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

  return <ModalShell title={editing ? "Editar plan" : "Nuevo plan"} description="Definí la estructura que vas a repetir. Las métricas se registran en cada sesión." onClose={onClose} closeDisabled={saving} theme="training" className="training-plan-dialog" backdropClassName="training-session-backdrop" footer={<><button type="button" className="training-secondary" onClick={onClose} disabled={saving}>Cancelar</button><button type="submit" form="training-plan-form" className="training-primary" disabled={saving || loading}>{saving ? "Guardando…" : editing ? "Guardar cambios" : "Crear plan"}</button></>}>
    {loading ? <SkeletonRows count={5} className="training-loading" label="Cargando plan" /> : <form id="training-plan-form" className="training-editor-form" onSubmit={submit}>
      <div className="training-plan-form-intro"><strong>Solo estructura</strong><span>Elegí ejercicios y ordená los bloques. La ejecución se completa al iniciar una sesión.</span></div>
      <div className="training-plan-fields"><Input label="Nombre del plan" value={form.name} maxLength="120" required onChange={(event) => setField("name", event.target.value)} placeholder="Ej.: Fuerza de base" /><div className="training-plan-field-row"><Select label="Módulo" value={form.module} options={moduleOptions} onChange={(event) => changeModule(event.target.value)} /><Select label="Frecuencia" value={form.frequencyMode} options={frequencyOptions} onChange={(event) => { const frequencyMode = event.target.value === "DYNAMIC" ? "DYNAMIC" : "FIXED"; setForm((current) => ({ ...current, frequencyMode, days: current.days.map((day) => ({ ...day, dayOfWeek: frequencyMode === "DYNAMIC" ? "" : day.dayOfWeek })) })); }} /><Input label="Sesiones por semana" type="number" min="1" max="14" numericOnly value={form.targetSessionsPerWeek} onChange={(event) => setField("targetSessionsPerWeek", event.target.value)} /></div><div className="training-plan-field-row"><Input label="Comienza" type="date" value={form.startDate} onChange={(event) => setField("startDate", event.target.value)} /><Input label="Finaliza (opcional)" type="date" value={form.endDate} onChange={(event) => setField("endDate", event.target.value)} /><label className="training-toggle"><input type="checkbox" checked={form.active} onChange={(event) => setField("active", event.target.checked)} /><span><strong>Plan activo</strong><small>Disponible para sugerencias y registro</small></span></label></div></div>
      {moduleNotice && <p className="training-form-notice" role="status">{moduleNotice}</p>}
      <div className="training-section-heading"><div><h3>Días y ejercicios</h3><span>{form.frequencyMode === "FIXED" ? "Elegí un día de semana para cada bloque." : "El orden define la próxima sesión."}</span></div><button type="button" className="training-secondary training-add-control" onClick={() => setForm((current) => ({ ...current, days: [...current.days, emptyDay(current.days.length, current.frequencyMode)] }))}><Icon name="add" />Agregar día</button></div>
      <div className="training-plan-day-list">{form.days.map((day, dayIndex) => <article className="training-plan-day" key={day.id}><header><div><strong>Día {dayIndex + 1}</strong><div className="training-move-controls"><button type="button" className="training-icon-action" aria-label={`Mover ${day.name} hacia arriba`} disabled={dayIndex === 0} onClick={() => setForm((current) => ({ ...current, days: moveItem(current.days, dayIndex, dayIndex - 1) }))}><Icon name="keyboard_arrow_up" /></button><button type="button" className="training-icon-action" aria-label={`Mover ${day.name} hacia abajo`} disabled={dayIndex === form.days.length - 1} onClick={() => setForm((current) => ({ ...current, days: moveItem(current.days, dayIndex, dayIndex + 1) }))}><Icon name="expand_more" /></button></div></div><button type="button" className="training-icon-action training-delete-control" aria-label={`Quitar ${day.name}`} onClick={() => setForm((current) => ({ ...current, days: current.days.filter((_, index) => index !== dayIndex) }))}><Icon name="delete" /></button></header><div className="training-plan-day-fields"><Input label="Nombre del día" value={day.name} maxLength="120" onChange={(event) => updateDay(dayIndex, { name: event.target.value })} />{form.frequencyMode === "FIXED" && <Select label="Día de semana" value={day.dayOfWeek} options={[{ value: "", label: "Elegir día" }, ...weekdays]} onChange={(event) => updateDay(dayIndex, { dayOfWeek: event.target.value })} />}</div><div className="training-plan-exercise-list">{day.exercises.map((exercise, exerciseIndex) => <div className="training-plan-exercise" key={exercise.id}><div className="training-plan-exercise-heading"><strong>Ejercicio {exerciseIndex + 1}</strong><div className="training-move-controls"><button type="button" className="training-icon-action" aria-label={`Mover ejercicio ${exerciseIndex + 1} hacia arriba`} disabled={exerciseIndex === 0} onClick={() => updateDay(dayIndex, { exercises: moveItem(day.exercises, exerciseIndex, exerciseIndex - 1) })}><Icon name="keyboard_arrow_up" /></button><button type="button" className="training-icon-action" aria-label={`Mover ejercicio ${exerciseIndex + 1} hacia abajo`} disabled={exerciseIndex === day.exercises.length - 1} onClick={() => updateDay(dayIndex, { exercises: moveItem(day.exercises, exerciseIndex, exerciseIndex + 1) })}><Icon name="expand_more" /></button><button type="button" className="training-icon-action training-delete-control" aria-label={`Quitar ejercicio ${exerciseIndex + 1}`} onClick={() => updateDay(dayIndex, { exercises: day.exercises.filter((_, index) => index !== exerciseIndex) })}><Icon name="delete" /></button></div></div><ExerciseCombobox api={api} module={form.module} value={exercise.exerciseId} initialItems={initialItems} label="Ejercicio persistido" onChange={(value) => selectExercise(dayIndex, exerciseIndex, value, initialItems.find((item) => String(item.id) === String(value)))} onExerciseChange={(selected) => selectExercise(dayIndex, exerciseIndex, String(selected.id), selected)} /><small className="training-plan-registration">{exercise.exerciseId ? registrationTypeLabel(exercise.registrationType, form.module) : "Elegí un ejercicio"}</small></div>)}</div><button type="button" className="training-text-button training-add-exercise" onClick={() => addExercise(dayIndex)}><Icon name="add" />Agregar ejercicio</button></article>)}</div>
      {error && <p className="training-form-error" role="alert">{error}</p>}
    </form>}
  </ModalShell>;
}
