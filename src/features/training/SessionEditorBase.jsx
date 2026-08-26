import React, { useState } from "react";
import { DatePickerDialog } from "../../components/DatePickerDialog";
import { Icon } from "../../components/Icon";
import { Input, Select } from "../../components/FormControls";
import { ModalShell } from "../../components/dialog/ModalShell";
import { trainingApi } from "./training-api";
import { createSessionDraft, dateKey, moduleLabel, sessionPayload } from "./training-utils";

const key = () => crypto.randomUUID?.() || Math.random().toString(36).slice(2);

export function SessionEditorBase({ api, type, session, plans = [], exercises = [], onClose, onSaved, className }) {
  const [draft, setDraft] = useState(() => createSessionDraft(type, session));
  const [pickerOpen, setPickerOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const isGym = type === "GYM";
  const choices = exercises.filter((item) => item.active !== false && item.module === type).map((item) => ({ value: String(item.id), label: item.name }));

  function updateExercise(index, patch) { setDraft((current) => ({ ...current, exercises: current.exercises.map((item, itemIndex) => itemIndex === index ? { ...item, ...patch } : item) })); }
  function updateSet(exerciseIndex, setIndex, patch) { setDraft((current) => ({ ...current, exercises: current.exercises.map((exercise, itemIndex) => itemIndex !== exerciseIndex ? exercise : { ...exercise, sets: exercise.sets.map((set, index) => index === setIndex ? { ...set, ...patch } : set) }) })); }
  function addExercise() { setDraft((current) => ({ ...current, exercises: [...current.exercises, { id: key(), exerciseId: "", name: "", notes: "", sets: [{ id: key(), reps: "", weightKg: "" }] }] })); }
  function selectExercise(index, value) { const exercise = exercises.find((item) => String(item.id || item.name) === value); updateExercise(index, { exerciseId: exercise?.id || "", name: exercise?.name || value }); }

  async function save(event) {
    event.preventDefault();
    if (saving) return;
    const validExercises = draft.exercises.filter((exercise) => exercise.exerciseId && exercise.sets.length);
    if (!validExercises.length) return setError("Agregá al menos un ejercicio con una serie.");
    setSaving(true);
    setError("");
    const next = { ...draft, exercises: validExercises };
    try {
      const payload = sessionPayload(next, type);
      let saved = await api.runAction({ title: "Guardando sesión", description: "Estamos registrando tu entrenamiento..." }, () => trainingApi.saveSession(api, session || {}, next.planId && !session?.id ? { ...payload, exercises: [] } : payload), { quiet: true });
      if (!session?.id && next.planId && saved?.id) saved = await trainingApi.saveSession(api, saved, payload);
      api.notify(session?.id ? "Sesión actualizada." : "Sesión guardada.");
      onSaved?.(saved || next);
      onClose();
    } catch (saveError) {
      setError(saveError?.message || "No se pudo guardar la sesión.");
    } finally {
      setSaving(false);
    }
  }

  return <ModalShell title={session?.id ? `Editar ${moduleLabel(type).toLowerCase()}` : `Nueva sesión de ${moduleLabel(type).toLowerCase()}`} description={isGym ? "Registrá carga, repeticiones y notas al terminar cada ejercicio." : "Registrá repeticiones y notas sin carga externa."} onClose={onClose} closeDisabled={saving} theme="training" className={`training-session-editor ${className}`} backdropClassName="training-session-backdrop" footer={<><button type="button" className="training-secondary" onClick={onClose} disabled={saving}>Cancelar</button><button type="submit" form={`training-session-${type.toLowerCase()}`} className="training-primary" disabled={saving}>{saving ? "Guardando…" : "Guardar sesión"}</button></>}>
    <form id={`training-session-${type.toLowerCase()}`} className="training-editor-form" onSubmit={save} data-dialog-scroll-owner="true">
      <div className="training-editor-meta">
        <button type="button" className="training-date-button" onClick={() => setPickerOpen(true)}><Icon name="today" /><span>Fecha<strong>{new Intl.DateTimeFormat("es-AR", { dateStyle: "medium" }).format(new Date(`${draft.date}T00:00:00`))}</strong></span><Icon name="chevron_right" /></button>
        <Input label="Duración (min)" type="number" min="1" max="600" numericOnly value={draft.durationMinutes || ""} onChange={(event) => setDraft((current) => ({ ...current, durationMinutes: event.target.value }))} />
      </div>
      {draft.planId && <div className="training-session-source"><span>Plan asociado</span><strong>{draft.planDayName || draft.planName || plans.find((plan) => String(plan.id) === String(draft.planId))?.name || "Plan de entrenamiento"}</strong><small>Los objetivos del día se guardan junto con esta sesión.</small></div>}
      <Input label="Título (opcional)" value={draft.title} maxLength="160" onChange={(event) => setDraft((current) => ({ ...current, title: event.target.value }))} placeholder={draft.planDayName || "Ej.: Sesión de fuerza"} />
      <div className="training-exercise-log">
        <div className="training-section-heading"><h3>Ejercicios</h3><button type="button" className="training-secondary training-add-control" onClick={addExercise}><Icon name="add" />Agregar</button></div>
          {draft.exercises.map((exercise, exerciseIndex) => <article className="training-log-exercise" key={exercise.id}>
          <div className="training-log-exercise-heading"><strong>Ejercicio {exerciseIndex + 1}</strong><button type="button" className="training-icon-action training-delete-control" aria-label={`Quitar ejercicio ${exerciseIndex + 1}`} onClick={() => setDraft((current) => ({ ...current, exercises: current.exercises.filter((_, index) => index !== exerciseIndex) }))}><Icon name="delete" /></button></div>
          <Select label="Ejercicio" value={String(exercise.exerciseId || "")} options={[{ value: "", label: choices.length ? "Elegir ejercicio" : "No hay ejercicios disponibles" }, ...choices]} onChange={(event) => selectExercise(exerciseIndex, event.target.value)} />
          <div className="training-set-list">
            {exercise.sets.map((set, setIndex) => <div className={`training-set-row ${isGym ? "training-gym-set" : "training-calisthenics-set"}`} key={set.id}><span>Serie {setIndex + 1}</span><Input label="Repeticiones" type="number" min="0" numericOnly value={set.reps} onChange={(event) => updateSet(exerciseIndex, setIndex, { reps: event.target.value })} />{isGym && <Input label="Peso (kg)" type="number" min="0" step="0.5" numericOnly value={set.weightKg} onChange={(event) => updateSet(exerciseIndex, setIndex, { weightKg: event.target.value })} />}<label className="training-completed-set"><input type="checkbox" checked={Boolean(set.completed)} onChange={(event) => updateSet(exerciseIndex, setIndex, { completed: event.target.checked })} />Hecha</label><button type="button" className="training-icon-action training-delete-control" aria-label={`Quitar serie ${setIndex + 1} de ${exercise.name || `ejercicio ${exerciseIndex + 1}`}`} onClick={() => updateExercise(exerciseIndex, { sets: exercise.sets.filter((_, index) => index !== setIndex) })}><Icon name="remove" /></button></div>)}
            <button type="button" className="training-text-button" onClick={() => updateExercise(exerciseIndex, { sets: [...exercise.sets, { id: key(), reps: "", weightKg: "" }] })}><Icon name="add" />Agregar serie</button>
          </div>
          <label className="field training-notes-field"><span>Notas del ejercicio</span><textarea value={exercise.notes} maxLength="500" onChange={(event) => updateExercise(exerciseIndex, { notes: event.target.value })} placeholder="Técnica, dificultad o ajuste para la próxima vez" /></label>
        </article>)}
      </div>
      <label className="field training-notes-field"><span>Notas de la sesión</span><textarea value={draft.notes} maxLength="1000" onChange={(event) => setDraft((current) => ({ ...current, notes: event.target.value }))} placeholder="Cómo te sentiste, descansos o próximos pasos" /></label>
      {error && <p className="training-form-error" role="alert">{error}</p>}
    </form>
    {pickerOpen && <DatePickerDialog value={draft.date || dateKey()} onSelect={(date) => setDraft((current) => ({ ...current, date }))} onClose={() => setPickerOpen(false)} theme="training" className="training-date-picker" backdropClassName="training-date-picker-backdrop" />}
  </ModalShell>;
}
