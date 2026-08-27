import React, { useState } from "react";
import { DatePickerDialog } from "../../components/DatePickerDialog";
import { Icon } from "../../components/Icon";
import { Input } from "../../components/FormControls";
import { ModalShell } from "../../components/dialog/ModalShell";
import { trainingApi } from "./training-api";
import { ExerciseCombobox } from "./ExerciseCombobox";
import { createSessionDraft, dateKey, exerciseRegistration, moduleLabel, registrationTypeLabel, sessionPayload } from "./training-utils";

const key = () => crypto.randomUUID?.() || Math.random().toString(36).slice(2);
const sideOptions = [{ value: "LEFT", label: "Izquierdo" }, { value: "RIGHT", label: "Derecho" }, { value: "BOTH", label: "Ambos" }];

function targetFields(exercise, type, onChange) {
  const registration = exerciseRegistration(exercise, type);
  return <div className="training-session-targets">
    <Input label="Series objetivo" type="number" min="1" max="100" numericOnly value={exercise.targetSets} onChange={(event) => onChange({ targetSets: event.target.value })} />
    {(registration === "REPETITIONS" || registration === "REPETITIONS_AND_TIME") && <Input label="Repeticiones objetivo" type="number" min="0" numericOnly value={exercise.targetRepetitions} onChange={(event) => onChange({ targetRepetitions: event.target.value })} />}
    {(registration === "TIME" || registration === "REPETITIONS_AND_TIME") && <Input label="Segundos objetivo" type="number" min="0" numericOnly value={exercise.targetSeconds} onChange={(event) => onChange({ targetSeconds: event.target.value })} />}
    {registration === "DISTANCE" && <Input label="Distancia objetivo (m)" type="number" min="0" numericOnly value={exercise.targetDistanceMeters} onChange={(event) => onChange({ targetDistanceMeters: event.target.value })} />}
    {type === "GYM" && registration === "WEIGHT_AND_REPETITIONS" && <Input label="Peso objetivo (kg)" type="number" min="0" step="0.5" numericOnly value={exercise.targetWeightKg} onChange={(event) => onChange({ targetWeightKg: event.target.value })} />}
  </div>;
}

function setFields(exercise, set, exerciseIndex, setIndex, type, updateSet) {
  const registration = exerciseRegistration(exercise, type);
  return <div className="training-set-row" key={set.id}><span>Serie {setIndex + 1}</span>
    {(registration === "REPETITIONS" || registration === "REPETITIONS_AND_TIME") && <Input label="Repeticiones" type="number" min="0" numericOnly value={set.reps} onChange={(event) => updateSet(exerciseIndex, setIndex, { reps: event.target.value })} />}
    {(registration === "TIME" || registration === "REPETITIONS_AND_TIME") && <Input label="Segundos" type="number" min="0" numericOnly value={set.seconds} onChange={(event) => updateSet(exerciseIndex, setIndex, { seconds: event.target.value })} />}
    {registration === "DISTANCE" && <Input label="Distancia (m)" type="number" min="0" numericOnly value={set.distanceMeters} onChange={(event) => updateSet(exerciseIndex, setIndex, { distanceMeters: event.target.value })} />}
    {type === "GYM" && registration === "WEIGHT_AND_REPETITIONS" && <Input label="Peso (kg)" type="number" min="0" step="0.5" numericOnly value={set.weightKg} onChange={(event) => updateSet(exerciseIndex, setIndex, { weightKg: event.target.value })} />}
    {exercise.unilateral && <label className="field"><span>Lado</span><select value={set.side || "BOTH"} onChange={(event) => updateSet(exerciseIndex, setIndex, { side: event.target.value })}>{sideOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>}
    <label className="training-completed-set"><input type="checkbox" checked={Boolean(set.completed)} onChange={(event) => updateSet(exerciseIndex, setIndex, { completed: event.target.checked })} />Hecha</label>
    <button type="button" className="training-icon-action training-delete-control" aria-label={`Quitar serie ${setIndex + 1} de ${exercise.name || `ejercicio ${exerciseIndex + 1}`}`} onClick={() => updateSet(exerciseIndex, setIndex, { remove: true })}><Icon name="remove" /></button>
  </div>;
}

export function SessionEditorBase({ api, type, session, plans = [], exercises = [], onClose, onSaved, className }) {
  const [draft, setDraft] = useState(() => createSessionDraft(type, session));
  const [pickerOpen, setPickerOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const isGym = type === "GYM";
  const initialItems = [...exercises, ...draft.exercises.filter((exercise) => exercise.exerciseId).map((exercise) => ({ id: exercise.exerciseId, name: exercise.name, module: type, category: exercise.category, registrationType: exercise.registrationType, unilateral: exercise.unilateral, active: true }))];

  function updateExercise(index, patch) { setError(""); setDraft((current) => ({ ...current, exercises: current.exercises.map((item, itemIndex) => itemIndex === index ? { ...item, ...patch } : item) })); }
  function updateSet(exerciseIndex, setIndex, patch) { setError(""); setDraft((current) => ({ ...current, exercises: current.exercises.map((exercise, itemIndex) => itemIndex !== exerciseIndex ? exercise : { ...exercise, sets: patch.remove ? exercise.sets.filter((_, index) => index !== setIndex) : exercise.sets.map((set, index) => index === setIndex ? { ...set, ...patch } : set) }) })); }
  function addExercise() { setDraft((current) => ({ ...current, exercises: [...current.exercises, { id: key(), exerciseId: "", name: "", category: "", registrationType: type === "GYM" ? "WEIGHT_AND_REPETITIONS" : "REPETITIONS", unilateral: false, targetSets: "", targetRepetitions: "", targetSeconds: "", targetDistanceMeters: "", targetWeightKg: "", notes: "", sets: [{ id: key(), reps: "", seconds: "", distanceMeters: "", weightKg: "", side: "BOTH" }] }] })); }
  function selectExercise(index, value, selected) {
    updateExercise(index, { exerciseId: value, name: selected?.name || "", category: selected?.category || "", registrationType: exerciseRegistration(selected, type), unilateral: Boolean(selected?.unilateral), targetWeightKg: type === "GYM" ? "" : "" });
  }

  async function save(event) {
    event.preventDefault();
    if (saving) return;
    const validExercises = draft.exercises.filter((exercise) => exercise.exerciseId && exercise.sets.length);
    if (!validExercises.length) return setError("Agregá al menos un ejercicio con una serie.");
    setSaving(true); setError("");
    const next = { ...draft, exercises: validExercises };
    try {
      const payload = sessionPayload(next, type);
      let saved = await api.runAction({ title: "Guardando sesión", description: "Estamos registrando tu entrenamiento..." }, () => trainingApi.saveSession(api, session || {}, next.planId && !session?.id ? { ...payload, exercises: [] } : payload), { quiet: true });
      if (!session?.id && next.planId && saved?.id) saved = await trainingApi.saveSession(api, saved, payload);
      api.notify(session?.id ? "Sesión actualizada." : "Sesión guardada."); onSaved?.(saved || next); onClose();
    } catch (saveError) { setError(saveError?.message || "No se pudo guardar la sesión."); }
    finally { setSaving(false); }
  }

  return <ModalShell title={session?.id ? `Editar ${moduleLabel(type).toLowerCase()}` : `Nueva sesión de ${moduleLabel(type).toLowerCase()}`} description={isGym ? "Registrá carga, repeticiones y notas al terminar cada ejercicio." : "Registrá repeticiones y notas sin carga externa."} onClose={onClose} closeDisabled={saving} theme="training" className={`training-session-editor ${className}`} backdropClassName="training-session-backdrop" footer={<><button type="button" className="training-secondary" onClick={onClose} disabled={saving}>Cancelar</button><button type="submit" form={`training-session-${type.toLowerCase()}`} className="training-primary" disabled={saving}>{saving ? "Guardando…" : "Guardar sesión"}</button></>}>
    <form id={`training-session-${type.toLowerCase()}`} className="training-editor-form" onSubmit={save}>
      <div className="training-editor-meta"><button type="button" className="training-date-button" onClick={() => setPickerOpen(true)}><Icon name="today" /><span>Fecha<strong>{new Intl.DateTimeFormat("es-AR", { dateStyle: "medium" }).format(new Date(`${draft.date}T00:00:00`))}</strong></span><Icon name="chevron_right" /></button><Input label="Duración (min)" type="number" min="1" max="600" numericOnly value={draft.durationMinutes || ""} onChange={(event) => setDraft((current) => ({ ...current, durationMinutes: event.target.value }))} /></div>
      {draft.planId && <div className="training-session-source"><span>Plan asociado</span><strong>{draft.planDayName || draft.planName || plans.find((plan) => String(plan.id) === String(draft.planId))?.name || "Plan de entrenamiento"}</strong><small>Los objetivos del día se guardan junto con esta sesión.</small></div>}
      <Input label="Título (opcional)" value={draft.title} maxLength="160" onChange={(event) => setDraft((current) => ({ ...current, title: event.target.value }))} placeholder={draft.planDayName || "Ej.: Sesión de fuerza"} />
      <div className="training-exercise-log"><div className="training-section-heading"><h3>Ejercicios</h3><button type="button" className="training-secondary training-add-control" onClick={addExercise}><Icon name="add" />Agregar</button></div>
        {draft.exercises.map((exercise, exerciseIndex) => <article className="training-log-exercise" key={exercise.id}><div className="training-log-exercise-heading"><strong>Ejercicio {exerciseIndex + 1}</strong><button type="button" className="training-icon-action training-delete-control" aria-label={`Quitar ejercicio ${exerciseIndex + 1}`} onClick={() => setDraft((current) => ({ ...current, exercises: current.exercises.filter((_, index) => index !== exerciseIndex) }))}><Icon name="delete" /></button></div>
          <ExerciseCombobox api={api} module={type} value={exercise.exerciseId} initialItems={initialItems} label="Ejercicio persistido" onChange={(value) => selectExercise(exerciseIndex, value, initialItems.find((item) => String(item.id) === String(value)))} onExerciseChange={(selected) => selectExercise(exerciseIndex, String(selected.id), selected)} />
          <small className="training-plan-registration">Registro: {registrationTypeLabel(exercise.registrationType, type)}{exercise.unilateral ? " · unilateral" : ""}</small>
          {targetFields(exercise, type, (patch) => updateExercise(exerciseIndex, patch))}
          <div className="training-set-list">{exercise.sets.map((set, setIndex) => setFields(exercise, set, exerciseIndex, setIndex, type, updateSet))}</div>
          <button type="button" className="training-text-button" onClick={() => updateExercise(exerciseIndex, { sets: [...exercise.sets, { id: key(), reps: "", seconds: "", distanceMeters: "", weightKg: "", side: "BOTH" }] })}><Icon name="add" />Agregar serie</button>
          <label className="field training-notes-field"><span>Notas del ejercicio</span><textarea value={exercise.notes} maxLength="500" onChange={(event) => updateExercise(exerciseIndex, { notes: event.target.value })} placeholder="Técnica, dificultad o ajuste para la próxima vez" /></label>
        </article>)}
      </div>
      <label className="field training-notes-field"><span>Notas de la sesión</span><textarea value={draft.notes} maxLength="1000" onChange={(event) => setDraft((current) => ({ ...current, notes: event.target.value }))} placeholder="Cómo te sentiste, descansos o próximos pasos" /></label>
      {error && <p className="training-form-error" role="alert">{error}</p>}
    </form>
    {pickerOpen && <DatePickerDialog value={draft.date || dateKey()} onSelect={(date) => setDraft((current) => ({ ...current, date }))} onClose={() => setPickerOpen(false)} theme="training" className="training-date-picker" backdropClassName="training-date-picker-backdrop" />}
  </ModalShell>;
}
