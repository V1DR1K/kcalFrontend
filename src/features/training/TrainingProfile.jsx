import React, { useCallback, useMemo, useState } from "react";
import { Icon } from "../../components/Icon";
import { Header } from "../../components/Layout";
import { Input, Select } from "../../components/FormControls";
import { ModalShell } from "../../components/dialog/ModalShell";
import { TrainingModuleBadge, TrainingStatus } from "./TrainingComponents";
import { trainingApi } from "./training-api";
import { exercisePayload, moveItem, routinePayload, TRAINING_MODULES } from "./training-utils";
import { useTrainingData } from "./useTrainingData";

const key = () => crypto.randomUUID?.() || Math.random().toString(36).slice(2);
const moduleOptions = TRAINING_MODULES.filter((item) => item.value !== "ALL");

function routineDraft(routine = {}) {
  return {
    ...routine,
    name: routine.name || "",
    module: routine.module || "GYM",
    active: Boolean(routine.active),
    days: (routine.days || []).map((day, dayIndex) => ({ id: day.id || `day-${dayIndex}`, name: day.name || day.label || `Día ${dayIndex + 1}`, exercises: (day.exercises || []).map((exercise, index) => ({ id: exercise.id || `exercise-${index}`, exerciseId: exercise.exerciseId || exercise.exercise?.id || "", name: exercise.name || exercise.exerciseName || exercise.exercise?.name || "", sets: exercise.sets || "", reps: exercise.reps || "" })) })),
  };
}

function RoutineEditor({ api, routine, exercises, onClose, onSaved }) {
  const [draft, setDraft] = useState(() => routineDraft(routine));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const choices = exercises.filter((exercise) => !exercise.module || exercise.module === draft.module).map((exercise) => ({ value: String(exercise.id || exercise.name), label: exercise.name }));
  function updateDay(dayIndex, patch) { setDraft((current) => ({ ...current, days: current.days.map((day, index) => index === dayIndex ? { ...day, ...patch } : day) })); }
  function updateExercise(dayIndex, exerciseIndex, patch) { updateDay(dayIndex, { exercises: draft.days[dayIndex].exercises.map((exercise, index) => index === exerciseIndex ? { ...exercise, ...patch } : exercise) }); }
  function selectExercise(dayIndex, exerciseIndex, value) { const exercise = exercises.find((item) => String(item.id || item.name) === value); updateExercise(dayIndex, exerciseIndex, { exerciseId: exercise?.id || "", name: exercise?.name || value }); }
  async function save(event) {
    event.preventDefault();
    if (!draft.name.trim()) return setError("Dale un nombre a la rutina.");
    setSaving(true);
    setError("");
    try {
      const saved = await api.runAction({ title: "Guardando rutina", description: "Estamos organizando tus días y ejercicios..." }, () => trainingApi.saveRoutine(api, routine || {}, routinePayload(draft)), { quiet: true });
      api.notify(routine?.id ? "Rutina actualizada." : "Rutina creada.");
      onSaved(saved || draft);
      onClose();
    } catch (saveError) { setError(saveError?.message || "No se pudo guardar la rutina."); }
    finally { setSaving(false); }
  }
  return <ModalShell title={routine?.id ? "Editar rutina" : "Nueva rutina"} description="Definí días, ejercicios y orden. Podés mover cada elemento con el teclado o toque." onClose={onClose} closeDisabled={saving} theme="training" className="training-routine-editor" backdropClassName="training-session-backdrop" footer={<><button type="button" className="training-secondary" onClick={onClose} disabled={saving}>Cancelar</button><button type="submit" form="training-routine-form" className="training-primary" disabled={saving}>{saving ? "Guardando…" : "Guardar rutina"}</button></>}>
    <form id="training-routine-form" className="training-editor-form" onSubmit={save} data-dialog-scroll-owner="true">
      <Input label="Nombre de rutina" value={draft.name} maxLength="120" onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))} placeholder="Ej.: Fuerza base" />
      <div className="training-routine-meta"><Select label="Módulo" value={draft.module} options={moduleOptions} onChange={(event) => setDraft((current) => ({ ...current, module: event.target.value }))} /><label className="training-toggle"><input type="checkbox" checked={draft.active} onChange={(event) => setDraft((current) => ({ ...current, active: event.target.checked }))} /><span><strong>Rutina activa</strong><small>Se destacará para iniciar sesiones</small></span></label></div>
      <div className="training-section-heading"><h3>Días de la rutina</h3><button type="button" className="training-secondary training-add-control" onClick={() => setDraft((current) => ({ ...current, days: [...current.days, { id: key(), name: `Día ${current.days.length + 1}`, exercises: [] }] }))}><Icon name="add" />Agregar día</button></div>
      <div className="training-day-list">{draft.days.map((day, dayIndex) => <article className="training-routine-day" key={day.id}><header><div><strong>Día {dayIndex + 1}</strong><div className="training-move-controls"><button type="button" className="training-icon-action" aria-label={`Mover ${day.name} hacia arriba`} disabled={dayIndex === 0} onClick={() => setDraft((current) => ({ ...current, days: moveItem(current.days, dayIndex, dayIndex - 1) }))}><Icon name="keyboard_arrow_up" /></button><button type="button" className="training-icon-action" aria-label={`Mover ${day.name} hacia abajo`} disabled={dayIndex === draft.days.length - 1} onClick={() => setDraft((current) => ({ ...current, days: moveItem(current.days, dayIndex, dayIndex + 1) }))}><Icon name="expand_more" /></button></div></div><button type="button" className="training-icon-action training-delete-control" aria-label={`Quitar ${day.name}`} onClick={() => setDraft((current) => ({ ...current, days: current.days.filter((_, index) => index !== dayIndex) }))}><Icon name="delete" /></button></header><Input label="Nombre del día" value={day.name} maxLength="80" onChange={(event) => updateDay(dayIndex, { name: event.target.value })} />
        <div className="training-routine-exercises">{day.exercises.map((exercise, exerciseIndex) => <div className="training-routine-exercise" key={exercise.id}><div className="training-routine-exercise-heading"><strong>Ejercicio {exerciseIndex + 1}</strong><div className="training-move-controls"><button type="button" className="training-icon-action" aria-label={`Mover ${exercise.name || "ejercicio"} hacia arriba`} disabled={exerciseIndex === 0} onClick={() => updateDay(dayIndex, { exercises: moveItem(day.exercises, exerciseIndex, exerciseIndex - 1) })}><Icon name="keyboard_arrow_up" /></button><button type="button" className="training-icon-action" aria-label={`Mover ${exercise.name || "ejercicio"} hacia abajo`} disabled={exerciseIndex === day.exercises.length - 1} onClick={() => updateDay(dayIndex, { exercises: moveItem(day.exercises, exerciseIndex, exerciseIndex + 1) })}><Icon name="expand_more" /></button><button type="button" className="training-icon-action training-delete-control" aria-label={`Quitar ${exercise.name || "ejercicio"}`} onClick={() => updateDay(dayIndex, { exercises: day.exercises.filter((_, index) => index !== exerciseIndex) })}><Icon name="delete" /></button></div></div>{choices.length ? <Select label="Ejercicio" value={exercise.exerciseId || exercise.name} options={[{ value: "", label: "Elegir ejercicio" }, ...choices]} onChange={(event) => selectExercise(dayIndex, exerciseIndex, event.target.value)} /> : <Input label="Ejercicio" value={exercise.name} onChange={(event) => updateExercise(dayIndex, exerciseIndex, { name: event.target.value })} />}<div className="training-routine-volume"><Input label="Series" type="number" min="1" numericOnly value={exercise.sets} onChange={(event) => updateExercise(dayIndex, exerciseIndex, { sets: event.target.value })} /><Input label="Repeticiones" type="number" min="1" numericOnly value={exercise.reps} onChange={(event) => updateExercise(dayIndex, exerciseIndex, { reps: event.target.value })} /></div></div>)}</div><button type="button" className="training-text-button" onClick={() => updateDay(dayIndex, { exercises: [...day.exercises, { id: key(), exerciseId: "", name: "", sets: "", reps: "" }] })}><Icon name="add" />Agregar ejercicio</button></article>)}</div>
      {error && <p className="training-form-error" role="alert">{error}</p>}
    </form>
  </ModalShell>;
}

function ExerciseEditor({ api, exercise, onClose, onSaved }) {
  const [draft, setDraft] = useState(() => ({ name: exercise?.name || "", module: exercise?.module || "GYM", notes: exercise?.notes || "" }));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  async function save(event) {
    event.preventDefault();
    if (!draft.name.trim()) return setError("Escribí el nombre del ejercicio.");
    setSaving(true);
    try {
      const saved = await api.runAction({ title: "Guardando ejercicio", description: "Estamos actualizando tu catálogo personal..." }, () => trainingApi.saveExercise(api, exercise || {}, exercisePayload(draft)), { quiet: true });
      api.notify(exercise?.id ? "Ejercicio actualizado." : "Ejercicio personal creado.");
      onSaved(saved || { ...exercise, ...draft });
      onClose();
    } catch (saveError) { setError(saveError?.message || "No se pudo guardar el ejercicio."); }
    finally { setSaving(false); }
  }
  return <ModalShell title={exercise?.id ? "Editar ejercicio" : "Nuevo ejercicio personal"} description="Tus ejercicios personales quedan disponibles al crear rutinas y sesiones." onClose={onClose} closeDisabled={saving} theme="training" className="training-exercise-editor" backdropClassName="training-session-backdrop" footer={<><button type="button" className="training-secondary" onClick={onClose} disabled={saving}>Cancelar</button><button type="submit" form="training-exercise-form" className="training-primary" disabled={saving}>{saving ? "Guardando…" : "Guardar ejercicio"}</button></>}><form id="training-exercise-form" className="training-editor-form" onSubmit={save} data-dialog-scroll-owner="true"><Input label="Nombre" value={draft.name} maxLength="120" onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))} placeholder="Ej.: Dominada pronada" /><Select label="Módulo" value={draft.module} options={moduleOptions} onChange={(event) => setDraft((current) => ({ ...current, module: event.target.value }))} /><label className="field training-notes-field"><span>Notas o variante</span><textarea value={draft.notes} maxLength="500" onChange={(event) => setDraft((current) => ({ ...current, notes: event.target.value }))} placeholder="Opcional" /></label>{error && <p className="training-form-error" role="alert">{error}</p>}</form></ModalShell>;
}

export function TrainingProfile({ api }) {
  const [tab, setTab] = useState("routines");
  const [moduleFilter, setModuleFilter] = useState("ALL");
  const [search, setSearch] = useState("");
  const [routineEditor, setRoutineEditor] = useState(null);
  const [exerciseEditor, setExerciseEditor] = useState(null);
  const load = useCallback(() => Promise.all([trainingApi.routines(api), trainingApi.exercises(api)]).then(([routines, exercises]) => ({ routines, exercises })), [api]);
  const resource = useTrainingData(load, [load]);
  const routines = resource.data?.routines || [];
  const exercises = resource.data?.exercises || [];
  const filteredRoutines = useMemo(() => routines.filter((routine) => moduleFilter === "ALL" || routine.module === moduleFilter), [routines, moduleFilter]);
  const filteredExercises = useMemo(() => exercises.filter((exercise) => (moduleFilter === "ALL" || exercise.module === moduleFilter) && exercise.name?.toLocaleLowerCase("es").includes(search.trim().toLocaleLowerCase("es"))), [exercises, moduleFilter, search]);
  async function removeRoutine(routine) {
    const confirmed = await api.confirm({ title: `¿Eliminar ${routine.name}?`, description: "La rutina y sus días dejarán de estar disponibles para nuevas sesiones.", confirmLabel: "Eliminar rutina" });
    if (!confirmed) return;
    try { await api.runAction({ title: "Eliminando rutina", description: "Estamos actualizando tus rutinas..." }, () => trainingApi.deleteRoutine(api, routine.id), { quiet: true }); api.notify("Rutina eliminada."); resource.reload(); } catch (error) { api.notify(error?.message || "No se pudo eliminar la rutina.", "error"); }
  }
  async function duplicateRoutine(routine) {
    try { await api.runAction({ title: "Duplicando rutina", description: "Estamos creando una copia editable..." }, () => trainingApi.duplicateRoutine(api, routine.id), { quiet: true }); api.notify("Rutina duplicada."); resource.reload(); } catch (error) { api.notify(error?.message || "No se pudo duplicar la rutina.", "error"); }
  }
  async function toggleActive(routine) {
    try { await api.runAction({ title: "Actualizando rutina", description: "Estamos guardando su estado activo..." }, () => trainingApi.saveRoutine(api, routine, routinePayload({ ...routineDraft(routine), active: !routine.active })), { quiet: true }); api.notify(routine.active ? "Rutina desactivada." : "Rutina activa."); resource.reload(); } catch (error) { api.notify(error?.message || "No se pudo actualizar la rutina.", "error"); }
  }
  async function removeExercise(exercise) {
    const confirmed = await api.confirm({ title: `¿Eliminar ${exercise.name}?`, description: "No se eliminará de sesiones ya registradas.", confirmLabel: "Eliminar ejercicio" });
    if (!confirmed) return;
    try { await api.runAction({ title: "Eliminando ejercicio", description: "Estamos actualizando tu catálogo..." }, () => trainingApi.deleteExercise(api, exercise.id), { quiet: true }); api.notify("Ejercicio eliminado."); resource.reload(); } catch (error) { api.notify(error?.message || "No se pudo eliminar el ejercicio.", "error"); }
  }
  const saveRoutine = () => { setRoutineEditor(null); resource.reload(); };
  const saveExercise = () => { setExerciseEditor(null); resource.reload(); };
  return <section className="page training-page training-profile-page"><Header title="Ejercicios" action={<button type="button" className="training-primary" onClick={() => tab === "routines" ? setRoutineEditor({}) : setExerciseEditor({})}><Icon name="add" />{tab === "routines" ? "Nueva rutina" : "Nuevo ejercicio"}</button>} /><p className="training-page-intro">Mantené tus presets y catálogo listos para registrar sesiones con menos pasos.</p><div className="training-tabs" role="tablist" aria-label="Ejercicios"><button type="button" role="tab" aria-selected={tab === "routines"} className={tab === "routines" ? "training-tab-active" : ""} onClick={() => setTab("routines")}>Rutinas</button><button type="button" role="tab" aria-selected={tab === "exercises"} className={tab === "exercises" ? "training-tab-active" : ""} onClick={() => setTab("exercises")}>Ejercicios</button></div><div className="training-filter-row"><Select label="Módulo" value={moduleFilter} options={TRAINING_MODULES} onChange={(event) => setModuleFilter(event.target.value)} />{tab === "exercises" && <Input label="Buscar ejercicio" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Nombre o variante" />}</div><TrainingStatus loading={resource.loading} error={resource.error} onRetry={resource.reload} />
    {!resource.loading && !resource.error && tab === "routines" && <section className="training-routine-catalog" role="tabpanel">{filteredRoutines.length ? filteredRoutines.map((routine) => <article className={`training-routine-card ${routine.active ? "training-routine-active" : ""}`.trim()} key={routine.id || routine.name}><div className="training-routine-card-main"><div><TrainingModuleBadge module={routine.module || "GYM"} />{routine.active && <span className="training-active-badge"><Icon name="check" />Activa</span>}</div><h2>{routine.name}</h2><p>{routine.days?.length || routine.dayCount || 0} días · {routine.exerciseCount || routine.days?.reduce((total, day) => total + (day.exercises?.length || 0), 0) || 0} ejercicios</p></div><div className="training-routine-card-actions"><button type="button" className="training-secondary" onClick={() => toggleActive(routine)}>{routine.active ? "Quitar activa" : "Usar como activa"}</button><button type="button" className="training-icon-action" aria-label={`Editar ${routine.name}`} onClick={() => setRoutineEditor(routine)}><Icon name="edit" /></button><button type="button" className="training-icon-action" aria-label={`Duplicar ${routine.name}`} onClick={() => duplicateRoutine(routine)}><Icon name="content_copy" /></button><button type="button" className="training-icon-action training-delete-control" aria-label={`Eliminar ${routine.name}`} onClick={() => removeRoutine(routine)}><Icon name="delete" /></button></div></article>) : <TrainingStatus empty={{ title: "No hay rutinas para este módulo", description: "Creá un preset con sus días y ejercicios para acelerar el registro." }} action={<button type="button" className="training-primary" onClick={() => setRoutineEditor({})}><Icon name="add" />Nueva rutina</button>} />}</section>}
    {!resource.loading && !resource.error && tab === "exercises" && <section className="training-exercise-catalog" role="tabpanel"><div className="training-catalog-heading"><div><h2>Ejercicios preset</h2><span>Incluidos para usar como referencia</span></div><div><h2>Personales</h2><span>Creá variantes que solo uses vos</span></div></div>{filteredExercises.length ? <div className="training-exercise-list">{filteredExercises.map((exercise) => { const preset = Boolean(exercise.preset || exercise.isPreset || exercise.source === "PRESET"); return <article className="training-exercise-card" key={exercise.id || exercise.name}><div><TrainingModuleBadge module={exercise.module || "GYM"} /><strong>{exercise.name}</strong>{exercise.notes && <small>{exercise.notes}</small>}</div>{preset ? <span className="training-preset-badge">Preset</span> : <div className="training-exercise-actions"><button type="button" className="training-icon-action" aria-label={`Editar ${exercise.name}`} onClick={() => setExerciseEditor(exercise)}><Icon name="edit" /></button><button type="button" className="training-icon-action training-delete-control" aria-label={`Eliminar ${exercise.name}`} onClick={() => removeExercise(exercise)}><Icon name="delete" /></button></div>}</article>; })}</div> : <TrainingStatus empty={{ title: "No encontramos ejercicios", description: "Probá otro módulo o agregá una variante personal." }} action={<button type="button" className="training-primary" onClick={() => setExerciseEditor({})}><Icon name="add" />Nuevo ejercicio</button>} />}</section>}
    {routineEditor && <RoutineEditor api={api} routine={routineEditor.id ? routineEditor : null} exercises={exercises} onClose={() => setRoutineEditor(null)} onSaved={saveRoutine} />}
    {exerciseEditor && <ExerciseEditor api={api} exercise={exerciseEditor.id ? exerciseEditor : null} onClose={() => setExerciseEditor(null)} onSaved={saveExercise} />}
  </section>;
}
