import React, { useEffect, useState } from "react";
import { Icon } from "../../../components/Icon";
import { Input, Select } from "../../../components/FormControls";
import { ModalShell } from "../../../components/dialog/ModalShell";
import { today } from "../../../utils/format";
import { trainingApi } from "../../training/training-api";
import { moveItem, planPayload } from "../../training/training-utils";

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
    name: plan?.name || "",
    description: plan?.description || "",
    module: plan?.module || "GYM",
    frequencyMode: plan?.frequencyMode || "FIXED",
    targetSessionsPerWeek: plan?.targetSessionsPerWeek || 3,
    startDate: plan?.startDate || today(),
    endDate: plan?.endDate || "",
    active: plan?.active !== false,
    days: (plan?.days || []).map((day, dayIndex) => ({
      id: day.id || key(), name: day.name || `Día ${dayIndex + 1}`, description: day.description || "", dayOfWeek: day.dayOfWeek || "",
      exercises: (day.exercises || []).map((exercise) => ({
        id: exercise.id || key(), exerciseId: String(exercise.exerciseId || ""), targetSets: exercise.targetSets ?? 3,
        targetRepetitions: exercise.targetRepetitions ?? 10, targetWeightKg: exercise.targetWeightKg ?? "", notes: exercise.notes || "",
      })),
    })),
  };
}

function emptyDay(index, frequencyMode) {
  return { id: key(), name: `Día ${index + 1}`, description: "", dayOfWeek: frequencyMode === "FIXED" ? "MONDAY" : "", exercises: [] };
}

export function TrainingPlanDialog({ api, plan, exercises, onClose, onChanged }) {
  const editing = Boolean(plan?.id);
  const [form, setForm] = useState(() => draftFromPlan(plan));
  const [loading, setLoading] = useState(editing && !plan.days);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!editing || plan.days) return undefined;
    let current = true;
    trainingApi.plan(api, plan.id).then((detail) => { if (current) { setForm(draftFromPlan(detail)); setLoading(false); } }).catch((requestError) => { if (current) { setError(requestError?.message || "No se pudo cargar el plan."); setLoading(false); } });
    return () => { current = false; };
  }, [api, editing, plan]);

  const choices = exercises.filter((exercise) => exercise.active !== false && exercise.module === form.module);
  function setField(field, value) { setError(""); setForm((current) => ({ ...current, [field]: value })); }
  function updateDay(index, patch) { setForm((current) => ({ ...current, days: current.days.map((day, dayIndex) => dayIndex === index ? { ...day, ...patch } : day) })); }
  function updateExercise(dayIndex, exerciseIndex, patch) { setForm((current) => ({ ...current, days: current.days.map((day, index) => index === dayIndex ? { ...day, exercises: day.exercises.map((exercise, itemIndex) => itemIndex === exerciseIndex ? { ...exercise, ...patch } : exercise) } : day) })); }
  function changeModule(value) { const compatibleIds = new Set(exercises.filter((exercise) => exercise.active !== false && exercise.module === value).map((exercise) => String(exercise.id))); setForm((current) => ({ ...current, module: value, days: current.days.map((day) => ({ ...day, exercises: day.exercises.map((exercise) => ({ ...exercise, exerciseId: compatibleIds.has(String(exercise.exerciseId)) ? exercise.exerciseId : "", targetWeightKg: value === "GYM" ? exercise.targetWeightKg : "" })) })) })); }
  function selectExercise(dayIndex, exerciseIndex, value) { const exercise = choices.find((item) => String(item.id) === value); updateExercise(dayIndex, exerciseIndex, { exerciseId: value, name: exercise?.name || "" }); }

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
    try {
      const saved = await api.runAction({ title: editing ? "Actualizando plan" : "Guardando plan", description: "Estamos organizando tus días y ejercicios..." }, () => trainingApi.savePlan(api, plan || {}, planPayload(form)), { quiet: true });
      api.notify(editing ? "Plan de entrenamiento actualizado." : "Plan de entrenamiento creado.");
      await onChanged?.(saved);
      onClose();
    } catch (saveError) { setError(saveError?.message || "No se pudo guardar el plan."); }
    finally { setSaving(false); }
  }

  return <ModalShell title={editing ? "Editar plan" : "Nuevo plan"} description="Definí la estructura que vas a repetir y registrar." onClose={onClose} closeDisabled={saving} theme="training" className="training-plan-dialog" backdropClassName="training-session-backdrop" footer={<><button type="button" className="training-secondary" onClick={onClose} disabled={saving}>Cancelar</button><button type="submit" form="training-plan-form" className="training-primary" disabled={saving || loading}>{saving ? "Guardando…" : editing ? "Guardar cambios" : "Crear plan"}</button></>}>
    {loading ? <div className="training-loading" aria-busy="true" aria-label="Cargando plan"><span /><span /><span /></div> : <form id="training-plan-form" className="training-editor-form" onSubmit={submit} data-dialog-scroll-owner="true">
      <div className="training-plan-form-intro"><strong>La estructura, sin pasos extra</strong><span>Usá días fijos si cada sesión ocurre en un día concreto. El modo dinámico avanza por orden.</span></div>
      <div className="training-plan-fields"><Input label="Nombre del plan" value={form.name} maxLength="120" required onChange={(event) => setField("name", event.target.value)} placeholder="Ej.: Fuerza de base" /><label className="field training-plan-description"><span>Descripción</span><textarea value={form.description} maxLength="1000" onChange={(event) => setField("description", event.target.value)} placeholder="Qué querés trabajar con este plan" /></label><div className="training-plan-field-row"><Select label="Módulo" value={form.module} options={moduleOptions} onChange={(event) => changeModule(event.target.value)} /><Select label="Frecuencia" value={form.frequencyMode} options={frequencyOptions} onChange={(event) => { const frequencyMode = event.target.value === "DYNAMIC" ? "DYNAMIC" : "FIXED"; setForm((current) => ({ ...current, frequencyMode, days: current.days.map((day) => ({ ...day, dayOfWeek: frequencyMode === "DYNAMIC" ? "" : day.dayOfWeek })) })); }} /><Input label="Sesiones por semana" type="number" min="1" max="14" numericOnly value={form.targetSessionsPerWeek} onChange={(event) => setField("targetSessionsPerWeek", event.target.value)} /></div><div className="training-plan-field-row"><Input label="Comienza" type="date" value={form.startDate} onChange={(event) => setField("startDate", event.target.value)} /><Input label="Finaliza (opcional)" type="date" value={form.endDate} onChange={(event) => setField("endDate", event.target.value)} /><label className="training-toggle"><input type="checkbox" checked={form.active} onChange={(event) => setField("active", event.target.checked)} /><span><strong>Plan activo</strong><small>Disponible para sugerencias y registro</small></span></label></div></div>
      <div className="training-section-heading"><div><h3>Días y ejercicios</h3><span>{form.frequencyMode === "FIXED" ? "Elegí un día de semana para cada bloque." : "El orden define la próxima sesión."}</span></div><button type="button" className="training-secondary training-add-control" onClick={() => setForm((current) => ({ ...current, days: [...current.days, emptyDay(current.days.length, current.frequencyMode)] }))}><Icon name="add" />Agregar día</button></div>
      <div className="training-plan-day-list">{form.days.map((day, dayIndex) => <article className="training-plan-day" key={day.id}><header><div><strong>Día {dayIndex + 1}</strong><div className="training-move-controls"><button type="button" className="training-icon-action" aria-label={`Mover ${day.name} hacia arriba`} disabled={dayIndex === 0} onClick={() => setForm((current) => ({ ...current, days: moveItem(current.days, dayIndex, dayIndex - 1) }))}><Icon name="keyboard_arrow_up" /></button><button type="button" className="training-icon-action" aria-label={`Mover ${day.name} hacia abajo`} disabled={dayIndex === form.days.length - 1} onClick={() => setForm((current) => ({ ...current, days: moveItem(current.days, dayIndex, dayIndex + 1) }))}><Icon name="expand_more" /></button></div></div><button type="button" className="training-icon-action training-delete-control" aria-label={`Quitar ${day.name}`} onClick={() => setForm((current) => ({ ...current, days: current.days.filter((_, index) => index !== dayIndex) }))}><Icon name="delete" /></button></header><div className="training-plan-day-fields"><Input label="Nombre del día" value={day.name} maxLength="120" onChange={(event) => updateDay(dayIndex, { name: event.target.value })} />{form.frequencyMode === "FIXED" && <Select label="Día de semana" value={day.dayOfWeek} options={[{ value: "", label: "Elegir día" }, ...weekdays]} onChange={(event) => updateDay(dayIndex, { dayOfWeek: event.target.value })} />}<label className="field training-plan-description"><span>Descripción del día</span><input value={day.description} maxLength="1000" onChange={(event) => updateDay(dayIndex, { description: event.target.value })} placeholder="Opcional" /></label></div><div className="training-plan-exercise-list">{day.exercises.map((exercise, exerciseIndex) => <div className="training-plan-exercise" key={exercise.id}><div className="training-plan-exercise-heading"><strong>Ejercicio {exerciseIndex + 1}</strong><div className="training-move-controls"><button type="button" className="training-icon-action" aria-label="Mover ejercicio hacia arriba" disabled={exerciseIndex === 0} onClick={() => updateDay(dayIndex, { exercises: moveItem(day.exercises, exerciseIndex, exerciseIndex - 1) })}><Icon name="keyboard_arrow_up" /></button><button type="button" className="training-icon-action" aria-label="Mover ejercicio hacia abajo" disabled={exerciseIndex === day.exercises.length - 1} onClick={() => updateDay(dayIndex, { exercises: moveItem(day.exercises, exerciseIndex, exerciseIndex + 1) })}><Icon name="expand_more" /></button><button type="button" className="training-icon-action training-delete-control" aria-label="Quitar ejercicio" onClick={() => updateDay(dayIndex, { exercises: day.exercises.filter((_, index) => index !== exerciseIndex) })}><Icon name="delete" /></button></div></div><Select label="Ejercicio" value={exercise.exerciseId} options={[{ value: "", label: choices.length ? "Elegir ejercicio" : "No hay ejercicios para este módulo" }, ...choices.map((item) => ({ value: String(item.id), label: `${item.name}${item.global ? " · base" : " · personal"}` }))]} onChange={(event) => selectExercise(dayIndex, exerciseIndex, event.target.value)} /><div className={`training-plan-volume ${form.module === "GYM" ? "" : "training-plan-volume-no-weight"}`}><Input label="Series" type="number" min="0" numericOnly value={exercise.targetSets} onChange={(event) => updateExercise(dayIndex, exerciseIndex, { targetSets: event.target.value })} /><Input label="Repeticiones" type="number" min="0" numericOnly value={exercise.targetRepetitions} onChange={(event) => updateExercise(dayIndex, exerciseIndex, { targetRepetitions: event.target.value })} />{form.module === "GYM" && <Input label="Peso objetivo (kg)" type="number" min="0" step="0.5" numericOnly value={exercise.targetWeightKg} onChange={(event) => updateExercise(dayIndex, exerciseIndex, { targetWeightKg: event.target.value })} />}</div><label className="field training-notes-field"><span>Notas</span><textarea value={exercise.notes} maxLength="1000" onChange={(event) => updateExercise(dayIndex, exerciseIndex, { notes: event.target.value })} placeholder="Técnica o referencia" /></label></div>)}</div><button type="button" className="training-text-button training-add-exercise" onClick={() => updateDay(dayIndex, { exercises: [...day.exercises, { id: key(), exerciseId: "", targetSets: 3, targetRepetitions: 10, targetWeightKg: "", notes: "" }] })}><Icon name="add" />Agregar ejercicio</button></article>)}</div>
      {error && <p className="training-form-error" role="alert">{error}</p>}
    </form>}
  </ModalShell>;
}
