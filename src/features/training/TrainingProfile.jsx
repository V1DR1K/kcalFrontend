import React, { useCallback, useMemo, useState } from "react";
import { Icon } from "../../components/Icon";
import { Header } from "../../components/Layout";
import { Input, Select } from "../../components/FormControls";
import { ModalShell } from "../../components/dialog/ModalShell";
import { TrainingModuleBadge, TrainingStatus } from "./TrainingComponents";
import { trainingApi } from "./training-api";
import { exercisePayload, TRAINING_MODULES } from "./training-utils";
import { useTrainingData } from "./useTrainingData";

const moduleOptions = TRAINING_MODULES.filter((item) => item.value !== "ALL");

function ExerciseEditor({ api, exercise, onClose, onSaved }) {
  const [form, setForm] = useState(() => ({ name: exercise?.name || "", description: exercise?.description || "", category: exercise?.category || "", module: exercise?.module || "GYM", active: exercise?.active !== false }));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  async function submit(event) {
    event.preventDefault();
    if (!form.name.trim()) return setError("Escribí el nombre del ejercicio.");
    setSaving(true); setError("");
    try { const saved = await api.runAction({ title: exercise ? "Actualizando ejercicio" : "Guardando ejercicio", description: "Estamos actualizando tu catálogo personal..." }, () => trainingApi.saveExercise(api, exercise || {}, exercisePayload(form)), { quiet: true }); api.notify(exercise ? "Ejercicio actualizado." : "Ejercicio personal creado."); onSaved(saved); onClose(); } catch (saveError) { setError(saveError?.message || "No se pudo guardar el ejercicio."); } finally { setSaving(false); }
  }
  return <ModalShell title={exercise ? "Editar ejercicio personal" : "Nuevo ejercicio personal"} description="Los ejercicios base son de solo lectura. Tus variantes quedan disponibles en planes y sesiones." onClose={onClose} closeDisabled={saving} theme="training" className="training-exercise-editor" backdropClassName="training-session-backdrop" footer={<><button type="button" className="training-secondary" onClick={onClose} disabled={saving}>Cancelar</button><button type="submit" form="training-exercise-form" className="training-primary" disabled={saving}>{saving ? "Guardando…" : "Guardar ejercicio"}</button></>}><form id="training-exercise-form" className="training-editor-form" onSubmit={submit} data-dialog-scroll-owner="true"><Input label="Nombre" value={form.name} maxLength="120" required onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} placeholder="Ej.: Dominada pronada" /><div className="training-plan-field-row"><Select label="Módulo" value={form.module} options={moduleOptions} onChange={(event) => setForm((current) => ({ ...current, module: event.target.value }))} /><Input label="Categoría" value={form.category} maxLength="80" onChange={(event) => setForm((current) => ({ ...current, category: event.target.value }))} placeholder="Ej.: Tirón" /></div><label className="field training-notes-field"><span>Descripción</span><textarea value={form.description} maxLength="1000" onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))} placeholder="Técnica, variante o referencia" /></label>{error && <p className="training-form-error" role="alert">{error}</p>}</form></ModalShell>;
}

export function TrainingProfile({ api }) {
  const [moduleFilter, setModuleFilter] = useState("ALL");
  const [search, setSearch] = useState("");
  const [editor, setEditor] = useState(null);
  const load = useCallback(() => trainingApi.exercises(api, { module: moduleFilter, q: search.trim(), size: 50 }), [api, moduleFilter, search]);
  const resource = useTrainingData(load, [load]);
  const exercises = resource.data?.items || [];
  const filtered = useMemo(() => exercises.filter((exercise) => [exercise.name, exercise.category, exercise.description].some((value) => value?.toLocaleLowerCase("es").includes(search.trim().toLocaleLowerCase("es")))), [exercises, search]);
  const personal = filtered.filter((exercise) => exercise.editable);
  const global = filtered.filter((exercise) => exercise.global);
  function saved() { setEditor(null); resource.reload(); }
  async function remove(exercise) {
    const confirmed = await api.confirm({ title: `¿Eliminar ${exercise.name}?`, description: "El ejercicio personal dejará de estar disponible para nuevos planes. Sus sesiones históricas se conservan.", confirmLabel: "Eliminar ejercicio" });
    if (!confirmed) return;
    try { await api.runAction({ title: "Eliminando ejercicio", description: "Estamos actualizando tu catálogo..." }, () => trainingApi.deleteExercise(api, exercise.id), { quiet: true }); api.notify("Ejercicio eliminado."); resource.reload(); } catch (error) { api.notify(error?.message || "No se pudo eliminar el ejercicio.", "error"); }
  }
  function list(items, readOnly) { return items.length ? <div className="training-exercise-list">{items.map((exercise) => <article className="training-exercise-card" key={exercise.id}><div><TrainingModuleBadge module={exercise.module} /><strong>{exercise.name}</strong>{exercise.category && <small>{exercise.category}</small>}{exercise.description && <p>{exercise.description}</p>}</div>{readOnly ? <span className="training-preset-badge">Base · solo lectura</span> : <div className="training-exercise-actions"><button type="button" className="training-icon-action" aria-label={`Editar ${exercise.name}`} onClick={() => setEditor(exercise)}><Icon name="edit" /></button><button type="button" className="training-icon-action training-delete-control" aria-label={`Eliminar ${exercise.name}`} onClick={() => remove(exercise)}><Icon name="delete" /></button></div>}</article>)}</div> : <div className="training-empty-inline"><Icon name={readOnly ? "fitness_center" : "add_circle"} /><span>{readOnly ? "No hay ejercicios base para este filtro." : "Todavía no agregaste ejercicios personales."}</span></div>; }
  return <section className="page training-page training-profile-page"><Header title="Ejercicios" action={<button type="button" className="training-primary" onClick={() => setEditor({})}><Icon name="add" />Nuevo ejercicio</button>} /><p className="training-page-intro">Consultá los ejercicios base y mantené tus variantes personales listas para armar planes.</p><div className="training-filter-row"><Select label="Módulo" value={moduleFilter} options={TRAINING_MODULES} onChange={(event) => setModuleFilter(event.target.value)} /><Input label="Buscar ejercicio" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Nombre, categoría o variante" /></div><TrainingStatus loading={resource.loading} error={resource.error} onRetry={resource.reload} />{!resource.loading && !resource.error && <div className="training-catalog-sections"><section><div className="training-catalog-heading"><div><h2>Ejercicios base</h2><span>Referencias globales del catálogo</span></div><strong>{global.length}</strong></div>{list(global, true)}</section><section><div className="training-catalog-heading"><div><h2>Personales</h2><span>Variantes editables sólo para vos</span></div><strong>{personal.length}</strong></div>{list(personal, false)}</section></div>}{editor && <ExerciseEditor api={api} exercise={editor.id ? editor : null} onClose={() => setEditor(null)} onSaved={saved} />}</section>;
}
