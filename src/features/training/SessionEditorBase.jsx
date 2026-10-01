import { reconcileSessionIdentity, sessionDraftKey } from "./session-draft";
import React, { useEffect, useRef, useState } from "react";
import { DatePickerDialog } from "../../components/DatePickerDialog";
import { Icon } from "../../components/Icon";
import { Input } from "../../components/FormControls";
import { ModalShell } from "../../components/dialog/ModalShell";
import { trainingApi } from "./training-api";
import { ExerciseCombobox } from "./ExerciseCombobox";
import { createSessionDraft, dateKey, exerciseRegistration, moveItem, moduleLabel, registrationTypeLabel, sessionPayload, sessionStatus, sessionStatusLabel } from "./training-utils";

const key = () => crypto.randomUUID?.() || Math.random().toString(36).slice(2);
const sideOptions = [{ value: "LEFT", label: "Izquierdo" }, { value: "RIGHT", label: "Derecho" }, { value: "BOTH", label: "Ambos" }];

function blankExercise(type) {
  return { id: key(), exerciseId: "", name: "", category: "", registrationType: type === "GYM" ? "WEIGHT_AND_REPETITIONS" : "REPETITIONS", unilateral: false, notes: "", sets: [] };
}

function blankSet() {
  return { id: key(), reps: "", seconds: "", distanceMeters: "", weightKg: "", side: "BOTH", completed: false, notes: "" };
}

function setFields(exercise, set, exerciseIndex, setIndex, type, updateSet, moveSet) {
  const registration = exerciseRegistration(exercise, type);
  return <div className={`training-set-row ${type === "CALISTHENICS" ? "training-calisthenics-set" : ""}`.trim()} key={set.id}>
    <span>Serie {setIndex + 1}</span>
    {(registration === "REPETITIONS" || registration === "REPETITIONS_AND_TIME" || registration === "WEIGHT_AND_REPETITIONS") && <Input label="Repeticiones" type="number" min="0" numericOnly value={set.reps} onChange={(event) => updateSet(exerciseIndex, setIndex, { reps: event.target.value })} />}
    {(registration === "TIME" || registration === "REPETITIONS_AND_TIME") && <Input label="Segundos" type="number" min="0" numericOnly value={set.seconds} onChange={(event) => updateSet(exerciseIndex, setIndex, { seconds: event.target.value })} />}
    {registration === "DISTANCE" && <Input label="Distancia (m)" type="number" min="0" numericOnly value={set.distanceMeters} onChange={(event) => updateSet(exerciseIndex, setIndex, { distanceMeters: event.target.value })} />}
    {type === "GYM" && registration === "WEIGHT_AND_REPETITIONS" && <Input label="Peso (kg)" type="number" min="0" step="0.5" numericOnly value={set.weightKg} onChange={(event) => updateSet(exerciseIndex, setIndex, { weightKg: event.target.value })} />}
    {exercise.unilateral && <label className="field"><span>Lado</span><select value={set.side || "BOTH"} onChange={(event) => updateSet(exerciseIndex, setIndex, { side: event.target.value })}>{sideOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>}
    <label className="training-completed-set"><input type="checkbox" checked={Boolean(set.completed)} onChange={(event) => updateSet(exerciseIndex, setIndex, { completed: event.target.checked })} />Hecha</label>
    <div className="training-set-actions"><button type="button" className="training-icon-action" aria-label={`Mover serie ${setIndex + 1} hacia arriba`} disabled={setIndex === 0} onClick={() => moveSet(exerciseIndex, setIndex, setIndex - 1)}><Icon name="keyboard_arrow_up" /></button><button type="button" className="training-icon-action" aria-label={`Mover serie ${setIndex + 1} hacia abajo`} disabled={setIndex === exercise.sets.length - 1} onClick={() => moveSet(exerciseIndex, setIndex, setIndex + 1)}><Icon name="expand_more" /></button><button type="button" className="training-icon-action training-delete-control" aria-label={`Quitar serie ${setIndex + 1} de ${exercise.name || `ejercicio ${exerciseIndex + 1}`}`} onClick={() => updateSet(exerciseIndex, setIndex, { remove: true })}><Icon name="remove" /></button></div>
  </div>;
}

function structureOf(exercises) {
  return exercises.filter((exercise) => exercise.exerciseId).map((exercise) => String(exercise.sourcePlanExerciseId || exercise.exerciseId || exercise.id));
}

export function SessionEditorBase({ api, type, session, plans = [], exercises = [], onClose, onSaved, className }) {
  const storageKey = sessionDraftKey(api.getUserId?.(), session?.id, type);
  const [cachedDraft] = useState(() => {
    if (sessionStatus(session?.status) !== "IN_PROGRESS" || !storageKey) return null;
    try { return JSON.parse(sessionStorage.getItem(storageKey)); } catch { return null; }
  });
  const [draft, setDraft] = useState(() => cachedDraft || createSessionDraft(type, session));
  const draftRef = useRef(draft);
  draftRef.current = draft;
  const identitiesRef = useRef(null);
  const [conflict, setConflict] = useState(cachedDraft ? { server: session, message: "Hay un borrador local. Comparalo con la sesiÃ³n guardada antes de continuar." } : null);
  const conflictRef = useRef(Boolean(cachedDraft));
  const sessionRef = useRef(session || cachedDraft || {});
  const contentKey = (value) => {
    const payload = sessionPayload({ ...value, exercises: value.exercises.filter((item) => item.exerciseId) }, type);
    delete payload.version;
    payload.exercises = payload.exercises.map(({ id, ...fields }) => fields);
    return JSON.stringify(payload);
  };
  const lastSavedContentRef = useRef(contentKey(createSessionDraft(type, session)));
  const initialStructure = useRef(null);
  const pendingRef = useRef(null);
  const flushRef = useRef(null);
  const versionRef = useRef(session?.version ?? null);
  const lastSavedRef = useRef(session || null);
  const initializedRef = useRef(false);
  const timerRef = useRef(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [saveState, setSaveState] = useState("idle");
  const [saving, setSaving] = useState(false);
  const [completing, setCompleting] = useState(false);
  const [error, setError] = useState("");
  const [planChangePrompt, setPlanChangePrompt] = useState(false);
  const isGym = type === "GYM";
  const status = sessionStatus(draft.status);
  const readOnly = status !== "IN_PROGRESS";

  if (!initialStructure.current) initialStructure.current = structureOf(draft.exercises);

  const initialItems = [...exercises, ...draft.exercises.filter((exercise) => exercise.exerciseId).map((exercise) => ({ id: exercise.exerciseId, name: exercise.name, module: type, category: exercise.category, registrationType: exercise.registrationType, unilateral: exercise.unilateral, active: true }))];

  function updateExercise(index, patch) {
    setError(""); setSaveState("idle");
    setDraft((current) => ({ ...current, exercises: current.exercises.map((item, itemIndex) => itemIndex === index ? { ...item, ...patch } : item) }));
  }
  function updateSet(exerciseIndex, setIndex, patch) {
    setError(""); setSaveState("idle");
    setDraft((current) => ({ ...current, exercises: current.exercises.map((exercise, itemIndex) => itemIndex !== exerciseIndex ? exercise : { ...exercise, sets: patch.remove ? exercise.sets.filter((_, index) => index !== setIndex) : exercise.sets.map((set, index) => index === setIndex ? { ...set, ...patch } : set) }) }));
  }
  function moveSet(exerciseIndex, from, to) {
    if (readOnly) return;
    setDraft((current) => ({ ...current, exercises: current.exercises.map((exercise, index) => index === exerciseIndex ? { ...exercise, sets: moveItem(exercise.sets, from, to) } : exercise) }));
  }
  function addExercise() { if (!readOnly) setDraft((current) => ({ ...current, exercises: [...current.exercises, blankExercise(type)] })); }
  function selectExercise(index, value, selected) {
    const current = draft.exercises[index];
    const replacingPlanExercise = current?.origin === "PLAN" && String(current.exerciseId) !== String(value);
    updateExercise(index, { id: replacingPlanExercise ? key() : current.id, sourcePlanExerciseId: replacingPlanExercise ? null : current.sourcePlanExerciseId, origin: replacingPlanExercise ? "ADDED" : current.origin, exerciseId: value, name: selected?.name || "", category: selected?.category || "", registrationType: exerciseRegistration(selected, type), unilateral: Boolean(selected?.unilateral) });
  }

  async function persistDraft(snapshot, quiet = false) {
    if (readOnly) return lastSavedRef.current;
    setSaveState("saving");
    const version = versionRef.current ?? snapshot.version;
    snapshot = identitiesRef.current ? reconcileSessionIdentity(snapshot, identitiesRef.current.submitted, identitiesRef.current.saved) : snapshot;
    const payload = sessionPayload({ ...snapshot, exercises: snapshot.exercises.filter((exercise) => exercise.exerciseId), ...(version != null ? { version } : {}) }, type);
    const saved = await trainingApi.saveSession(api, sessionRef.current, payload);
    if (saved?.id) sessionRef.current = saved;
    if (saved?.version != null) versionRef.current = saved.version;
    lastSavedRef.current = saved || sessionRef.current;
    lastSavedContentRef.current = contentKey(snapshot);
    identitiesRef.current = { submitted: snapshot, saved };
    setDraft((current) => reconcileSessionIdentity(current, snapshot, saved));
    setSaveState("saved");
    if (!quiet) api.notify("SesiÃƒÂ³n guardada.");
    return saved || sessionRef.current;
  }

  async function flushPending() {
    while (pendingRef.current) {
      const job = pendingRef.current;
      pendingRef.current = null;
      await persistDraft(job.snapshot, job.quiet);
    }
    return lastSavedRef.current;
  }

  function enqueueSave(snapshot, quiet = true) {
    pendingRef.current = { snapshot, quiet };
    if (!flushRef.current) flushRef.current = flushPending().catch((saveError) => { setSaveState("error"); setError(saveError?.message || "No se pudo guardar la sesiÃƒÂ³n."); throw saveError; }).finally(() => { flushRef.current = null; });
    return flushRef.current;
  }

  useEffect(() => {
    if (!initializedRef.current) { initializedRef.current = true; return undefined; }
    if (readOnly || conflict || saving || completing || contentKey(draft) === lastSavedContentRef.current) return undefined;
    window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(() => { enqueueSave(draft).catch(() => {}); }, 850);
    return () => window.clearTimeout(timerRef.current);
  }, [draft, readOnly, conflict, saving, completing]);

  useEffect(() => () => { window.clearTimeout(timerRef.current); }, []);

  useEffect(() => {
    if (!storageKey || readOnly) return;
    try { sessionStorage.setItem(storageKey, JSON.stringify(draft)); } catch { /* Storage restrictions cannot block editing. */ }
  }, [draft, readOnly, storageKey]);

  function clearStoredDraft() {
    if (storageKey) sessionStorage.removeItem(storageKey);
    const savedKey = sessionDraftKey(api.getUserId?.(), sessionRef.current?.id, type);
    if (savedKey) sessionStorage.removeItem(savedKey);
  }

  async function resolveConflict(useLocal) {
    try {
      const server = await trainingApi.session(api, sessionRef.current.id);
      if (!useLocal && !await api.confirm({ title: "Â¿Descartar el borrador local?", description: "Se reemplazarÃ¡ por la versiÃ³n guardada.", confirmLabel: "Usar versiÃ³n guardada" })) return;
      sessionRef.current = server; versionRef.current = server.version; lastSavedRef.current = server;
      identitiesRef.current = null;
      const remote = createSessionDraft(type, server);
      lastSavedContentRef.current = contentKey(remote);
      const next = useLocal && sessionStatus(server.status) === "IN_PROGRESS"
        ? { ...draftRef.current, version: server.version, exercises: draftRef.current.exercises.map((item) => {
            const match = remote.exercises.find((candidate) => String(candidate.exerciseId) === String(item.exerciseId));
            return { ...item, id: match?.id || key(), persistedId: match?.id, origin: match?.origin || "ADDED", sourcePlanExerciseId: match?.sourcePlanExerciseId || null };
          }) }
        : remote;
      conflictRef.current = false; setConflict(null); setError(""); setDraft(next);
      if (sessionStatus(server.status) !== "IN_PROGRESS") clearStoredDraft();
    } catch (failure) { setError(failure.message || "No pudimos recuperar la sesiÃ³n guardada."); }
  }

  async function closeEditor() {
    if (saving || completing) return;
    if (readOnly || (!sessionRef.current?.id && !draft.exercises.some((item) => item.exerciseId) && !flushRef.current)) return onClose();
    setSaving(true); setError("");
    try {
      window.clearTimeout(timerRef.current);
      await enqueueSave(draft, true);
      onSaved?.(lastSavedRef.current);
      clearStoredDraft(); onClose();
    } catch (closeError) {
      setError(closeError?.message || "No se pudo guardar la sesiÃƒÂ³n antes de cerrarla.");
    } finally { setSaving(false); }
  }

  async function saveAndExit(event) {
    event?.preventDefault();
    if (saving || completing) return;
    if (readOnly) return onClose();
    setSaving(true); setError("");
    try { window.clearTimeout(timerRef.current); await enqueueSave(draft, false); onSaved?.(lastSavedRef.current); clearStoredDraft(); onClose(); }
    catch { /* The error is visible in the editor so the user can retry. */ }
    finally { setSaving(false); }
  }

  async function finish(persistPlanChanges) {
    if (completing || readOnly || conflict) return;
    setPlanChangePrompt(false); setCompleting(true); setError("");
    try {
      window.clearTimeout(timerRef.current);
      await enqueueSave(draft, true);
      const completed = await trainingApi.completeSession(api, sessionRef.current.id, { version: versionRef.current, persistPlanChanges });
      api.notify("DÃƒÂ­a finalizado."); onSaved?.(completed || { ...draft, status: "COMPLETED" }); clearStoredDraft(); onClose();
    } catch (completeError) { setError(completeError?.message || "No se pudo finalizar el dÃƒÂ­a."); }
    finally { setCompleting(false); }
  }

  function complete() {
    if (readOnly || saving || completing) return;
    const changed = JSON.stringify(structureOf(draft.exercises)) !== JSON.stringify(initialStructure.current);
    if (changed && draft.planId) setPlanChangePrompt(true);
    else finish(false);
  }

  async function cancelSession() {
    if (!sessionRef.current?.id || readOnly || saving || completing || conflict) return;
    const confirmed = await api.confirm({ title: "Ã‚Â¿Cancelar esta sesiÃƒÂ³n?", description: "QuedarÃƒÂ¡ cancelada y ya no se podrÃƒÂ¡ editar.", confirmLabel: "Cancelar sesiÃƒÂ³n" });
    if (!confirmed) return;
    setSaving(true);
    try { window.clearTimeout(timerRef.current); await enqueueSave(draft, true); const cancelled = await trainingApi.cancelSession(api, sessionRef.current.id, { version: versionRef.current }); api.notify("SesiÃƒÂ³n cancelada."); onSaved?.(cancelled); clearStoredDraft(); onClose(); }
    catch (cancelError) { setError(cancelError?.message || "No se pudo cancelar la sesiÃƒÂ³n."); }
    finally { setSaving(false); }
  }

  const initialFocusStatus = readOnly ? <span className={`training-session-status training-session-status-${status.toLowerCase()}`}>{sessionStatusLabel(status)}</span> : <span className="training-save-indicator" role="status" aria-live="polite">{saveState === "saving" ? "GuardandoÃ¢â‚¬Â¦" : saveState === "error" ? "Error al guardar" : saveState === "saved" ? "Guardado" : "Autoguardado activo"}</span>;
  const footer = <>{!readOnly && <button type="button" className="training-danger-button training-cancel-session" onClick={cancelSession} disabled={saving || completing}>Descartar sesiÃƒÂ³n</button>}<button type="button" className="training-secondary" onClick={closeEditor} disabled={saving || completing}>Cerrar</button>{!readOnly && <><button type="submit" form={`training-session-${type.toLowerCase()}`} className="training-secondary" disabled={saving || completing}>{saving ? "GuardandoÃ¢â‚¬Â¦" : "Guardar y salir"}</button><button type="button" className="training-primary" onClick={complete} disabled={saving || completing}>{completing ? "FinalizandoÃ¢â‚¬Â¦" : "Finalizar sesiÃƒÂ³n"}</button></>}</>;

  return <>
    <ModalShell title={session?.id ? `${readOnly ? "Detalle de" : "Editar"} ${moduleLabel(type).toLowerCase()}` : `Nueva sesiÃƒÂ³n de ${moduleLabel(type).toLowerCase()}`} description={isGym ? "RegistrÃƒÂ¡ ejercicios y series. Se guarda automÃƒÂ¡ticamente." : "RegistrÃƒÂ¡ ejercicios y repeticiones. Se guarda automÃƒÂ¡ticamente."} onClose={closeEditor} closeDisabled={saving || completing} theme="training" className={`training-session-editor ${className}`.trim()} backdropClassName="training-session-backdrop" footer={footer}>
      <form id={`training-session-${type.toLowerCase()}`} className="training-editor-form" onSubmit={saveAndExit} inert={saving || completing ? true : undefined}>
        <div className="training-editor-meta"><button type="button" className="training-date-button" onClick={() => !readOnly && setPickerOpen(true)}><Icon name="today" /><span>Fecha<strong>{new Intl.DateTimeFormat("es-AR", { dateStyle: "medium" }).format(new Date(`${draft.date}T00:00:00`))}</strong></span><Icon name="chevron_right" /></button><div className="training-session-header-status">{initialFocusStatus}</div></div>
        {draft.planId && <div className="training-session-source"><span>Plan asociado</span><strong>{draft.planDayName || draft.planName || plans.find((plan) => String(plan.id) === String(draft.planId))?.name || "Plan de entrenamiento"}</strong><small>La estructura del plan es una referencia. Los datos de esta sesiÃƒÂ³n son independientes.</small></div>}
        <div className="training-exercise-log"><div className="training-section-heading"><div><h3>Ejercicios</h3><span>AgregÃƒÂ¡ y ordenÃƒÂ¡ lo que realmente hiciste.</span></div><button type="button" className="training-secondary training-add-control" onClick={addExercise} disabled={readOnly}><Icon name="add" />Agregar</button></div>
          {draft.exercises.length ? draft.exercises.map((exercise, exerciseIndex) => <article className="training-log-exercise" key={exercise.id}><div className="training-log-exercise-heading"><strong>Ejercicio {exerciseIndex + 1}</strong><div className="training-move-controls"><button type="button" className="training-icon-action" aria-label={`Mover ejercicio ${exerciseIndex + 1} hacia arriba`} disabled={readOnly || exerciseIndex === 0} onClick={() => setDraft((current) => ({ ...current, exercises: moveItem(current.exercises, exerciseIndex, exerciseIndex - 1) }))}><Icon name="keyboard_arrow_up" /></button><button type="button" className="training-icon-action" aria-label={`Mover ejercicio ${exerciseIndex + 1} hacia abajo`} disabled={readOnly || exerciseIndex === draft.exercises.length - 1} onClick={() => setDraft((current) => ({ ...current, exercises: moveItem(current.exercises, exerciseIndex, exerciseIndex + 1) }))}><Icon name="expand_more" /></button><button type="button" className="training-icon-action training-delete-control" aria-label={`Quitar ejercicio ${exerciseIndex + 1}`} onClick={() => setDraft((current) => ({ ...current, exercises: current.exercises.filter((_, index) => index !== exerciseIndex) }))} disabled={readOnly}><Icon name="delete" /></button></div></div>
            <ExerciseCombobox api={api} module={type} value={exercise.exerciseId} initialItems={initialItems} label="Ejercicio persistido" disabled={readOnly} onChange={(value) => selectExercise(exerciseIndex, value, initialItems.find((item) => String(item.id) === String(value)))} onExerciseChange={(selected) => selectExercise(exerciseIndex, String(selected.id), selected)} />
            {exercise.exerciseId && <small className="training-plan-registration">{registrationTypeLabel(exercise.registrationType, type)}{exercise.unilateral ? " Ã‚Â· unilateral" : ""}</small>}
            <div className="training-set-list">{exercise.sets.map((set, setIndex) => setFields(exercise, set, exerciseIndex, setIndex, type, updateSet, moveSet))}</div>
            <button type="button" className="training-text-button" onClick={() => updateExercise(exerciseIndex, { sets: [...exercise.sets, blankSet()] })} disabled={readOnly || !exercise.exerciseId}><Icon name="add" />Agregar serie</button>
            <label className="field training-notes-field"><span>Notas del ejercicio</span><textarea value={exercise.notes} maxLength="500" disabled={readOnly} onChange={(event) => updateExercise(exerciseIndex, { notes: event.target.value })} placeholder="TÃƒÂ©cnica, dificultad o ajuste para la prÃƒÂ³xima vez" /></label>
          </article>) : <div className="training-empty-inline"><Icon name="add_circle" /><span>AgregÃƒÂ¡ un ejercicio para comenzar la sesiÃƒÂ³n.</span></div>}
        </div>
        <details className="training-session-details">
          <summary><span>Detalles opcionales</span><small>TÃƒÂ­tulo y notas para volver despuÃƒÂ©s</small></summary>
          <div className="training-session-details-content">
            <Input label="TÃƒÂ­tulo" value={draft.title} maxLength="160" disabled={readOnly} onChange={(event) => setDraft((current) => ({ ...current, title: event.target.value }))} placeholder={draft.planDayName || "Ej.: SesiÃƒÂ³n de fuerza"} />
            <label className="field training-notes-field"><span>Notas de la sesiÃƒÂ³n</span><textarea value={draft.notes} maxLength="1000" disabled={readOnly} onChange={(event) => setDraft((current) => ({ ...current, notes: event.target.value }))} placeholder="CÃƒÂ³mo te sentiste, descansos o prÃƒÂ³ximos pasos" /></label>
          </div>
        </details>
        {error && <p className="training-form-error" role="alert">{error}</p>}
        {conflict && <section aria-label="Comparar sesiÃ³n y borrador" className="training-conflict-review">
          <p>{conflict.message}</p>
          <p>Tu borrador: {draft.title} Â· {draft.exercises.length} ejercicios.</p>
          {conflict.server && <details><summary>VersiÃ³n guardada: {conflict.server.title || "SesiÃ³n"}</summary><ul>{(conflict.server.exercises || []).map((item) => <li key={item.id}>{item.exerciseName} Â· {(item.sets || []).map((set) => `${set.repetitions ?? "â€”"} repeticiones / ${set.weightKg ?? "â€”"} kg`).join("; ")}</li>)}</ul></details>}
          <button type="button" className="training-secondary" onClick={() => resolveConflict(false)}>Usar versiÃ³n guardada</button>
          <button type="button" className="training-primary" onClick={() => resolveConflict(true)}>Reaplicar mi borrador</button>
        </section>}
      </form>
    </ModalShell>
    {pickerOpen && <DatePickerDialog value={draft.date || dateKey()} onSelect={(date) => setDraft((current) => ({ ...current, date }))} onClose={() => setPickerOpen(false)} theme="training" className="training-date-picker" backdropClassName="training-date-picker-backdrop" />}
    {planChangePrompt && <ModalShell title="Ã‚Â¿QuÃƒÂ© hacemos con los cambios?" description="Cambiaste los ejercicios de esta sesiÃƒÂ³n respecto del plan original." onClose={() => setPlanChangePrompt(false)} closeOnBackdrop={false} theme="training" className="training-plan-change-dialog" backdropClassName="training-session-backdrop" footer={<><button type="button" className="training-secondary" onClick={() => setPlanChangePrompt(false)}>Volver</button><button type="button" className="training-secondary" onClick={() => finish(false)}>Solo esta sesiÃƒÂ³n</button><button type="button" className="training-primary" onClick={() => finish(true)}>Aplicar cambios al plan</button></>}><div className="training-plan-change-options"><p>PodÃƒÂ©s mantener el plan intacto o usar el nuevo orden y selecciÃƒÂ³n para los prÃƒÂ³ximos dÃƒÂ­as.</p></div></ModalShell>}
  </>;
}
