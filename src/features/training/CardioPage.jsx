import React, { useCallback, useState } from "react";
import { Icon } from "../../components/Icon";
import { Header } from "../../components/Layout";
import { Input } from "../../components/FormControls";
import { ModalShell } from "../../components/dialog/ModalShell";
import { TrainingStatus } from "./TrainingComponents";
import { cardioPayload, cardioProgress, formatCardioDate, formatCardioMinutes, localDateTimeInput, toOffsetDateTime } from "./cardio-utils";
import { trainingApi } from "./training-api";
import { useTrainingData } from "./useTrainingData";

function CardioRecordEditor({ api, record, onClose, onSaved }) {
  const [form, setForm] = useState(() => ({
    recordedAt: localDateTimeInput(record?.recordedAt),
    distanceKm: record?.distanceKm ?? "",
    durationMinutes: record?.durationMinutes ?? "",
    inclined: Boolean(record?.inclined),
  }));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  function setField(field, value) {
    setError("");
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function submit(event) {
    event.preventDefault();
    if (!form.recordedAt || form.distanceKm === "" || !Number.isFinite(Number(form.distanceKm)) || Number(form.distanceKm) < 0 || !Number.isFinite(Number(form.durationMinutes)) || !Number(form.durationMinutes) || Number(form.durationMinutes) < 1) {
      setError("Completá una fecha, un kilometraje válido y un tiempo mayor a cero.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const saved = await api.runAction({ title: record ? "Actualizando cardio" : "Guardando cardio", description: "Estamos actualizando tu registro..." }, () => trainingApi.saveCardio(api, record || {}, cardioPayload(form)), { quiet: true });
      api.notify(record ? "Registro de cardio actualizado." : "Registro de cardio guardado.");
      onSaved(saved);
      onClose();
    } catch (saveError) {
      setError(saveError?.message || "No se pudo guardar el registro de cardio.");
    } finally {
      setSaving(false);
    }
  }

  return <ModalShell title={record ? "Editar cardio" : "Registrar cardio"} description="Anotá lo que marcó tu caminadora." onClose={onClose} closeDisabled={saving} theme="training" className="training-cardio-editor" backdropClassName="training-session-backdrop" footer={<><button type="button" className="training-secondary" onClick={onClose} disabled={saving}>Cancelar</button><button type="submit" form="cardio-record-form" className="training-primary" disabled={saving}>{saving ? "Guardando…" : "Guardar registro"}</button></>}>
    <form id="cardio-record-form" className="training-editor-form" onSubmit={submit}>
      <div className="training-cardio-form-grid"><Input label="Fecha y hora" type="datetime-local" value={form.recordedAt} onChange={(event) => setField("recordedAt", event.target.value)} /><Input label="Kilometraje (km)" type="number" min="0" step="0.01" numericOnly value={form.distanceKm} onChange={(event) => setField("distanceKm", event.target.value)} placeholder="Ej.: 4,50" /><Input label="Tiempo (minutos)" type="number" min="1" step="1" numericOnly value={form.durationMinutes} onChange={(event) => setField("durationMinutes", event.target.value)} placeholder="Ej.: 35" /></div>
      <label className="training-toggle"><input type="checkbox" checked={form.inclined} onChange={(event) => setField("inclined", event.target.checked)} /><span><strong>Caminadora inclinada</strong><small>Marcá si usaste la única inclinación disponible.</small></span></label>
      {error && <p className="training-form-error" role="alert">{error}</p>}
    </form>
  </ModalShell>;
}

function CardioServiceEditor({ api, onClose, onSaved }) {
  const [form, setForm] = useState(() => ({ servicedAt: localDateTimeInput(), notes: "" }));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function submit(event) {
    event.preventDefault();
    if (!form.servicedAt) return setError("Elegí la fecha y hora del service.");
    setSaving(true);
    setError("");
    try {
      const saved = await api.runAction({ title: "Registrando service", description: "Estamos reiniciando el contador de la caminadora..." }, () => trainingApi.createCardioService(api, { equipment: "TREADMILL", servicedAt: toOffsetDateTime(form.servicedAt), notes: form.notes.trim() || null }), { quiet: true });
      api.notify("Service registrado. El contador comenzó de nuevo.");
      onSaved(saved);
      onClose();
    } catch (saveError) {
      setError(saveError?.message || "No se pudo registrar el service.");
    } finally {
      setSaving(false);
    }
  }

  return <ModalShell title="Registrar service" description="Anotá cuándo aplicaste silicona líquida para reiniciar el ciclo de 20 horas." onClose={onClose} closeDisabled={saving} theme="training" className="training-cardio-service-editor" backdropClassName="training-session-backdrop" footer={<><button type="button" className="training-secondary" onClick={onClose} disabled={saving}>Cancelar</button><button type="submit" form="cardio-service-form" className="training-primary" disabled={saving}>{saving ? "Guardando…" : "Registrar service"}</button></>}>
    <form id="cardio-service-form" className="training-editor-form" onSubmit={submit}><Input label="Fecha y hora" type="datetime-local" value={form.servicedAt} onChange={(event) => { setError(""); setForm((current) => ({ ...current, servicedAt: event.target.value })); }} /><label className="field training-notes-field"><span>Notas (opcional)</span><textarea maxLength="2000" value={form.notes} onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))} placeholder="Ej.: silicona líquida aplicada" /></label>{error && <p className="training-form-error" role="alert">{error}</p>}</form>
  </ModalShell>;
}

function CardioRecordLine({ record, onEdit, onDelete }) {
  return <article className="training-cardio-record"><div className="training-cardio-record-icon"><Icon name="directions_run" /></div><div className="training-cardio-record-copy"><strong>{formatCardioDate(record.recordedAt)}</strong><span>{record.distanceKm} km · {formatCardioMinutes(record.durationMinutes)}</span>{record.inclined && <small><Icon name="trending_up" /> Inclinada</small>}</div><div className="training-cardio-record-actions"><button type="button" className="training-icon-action" aria-label="Editar registro de cardio" onClick={() => onEdit(record)}><Icon name="edit" /></button><button type="button" className="training-icon-action training-delete-control" aria-label="Eliminar registro de cardio" onClick={() => onDelete(record)}><Icon name="delete" /></button></div></article>;
}

export function CardioPage({ api }) {
  const [editor, setEditor] = useState(null);
  const [serviceEditorOpen, setServiceEditorOpen] = useState(false);
  const load = useCallback(async () => {
    const [records, summary] = await Promise.all([trainingApi.cardio(api), trainingApi.cardioSummary(api)]);
    return { records: records.items || [], page: records, summary };
  }, [api]);
  const resource = useTrainingData(load, [load]);
  const records = resource.data?.records || [];
  const summary = resource.data?.summary || {};
  const progress = cardioProgress(summary);
  const due = Boolean(summary.due);

  async function remove(record) {
    const confirmed = await api.confirm({ title: "¿Eliminar este registro?", description: "Se quitará del historial y del cálculo de service.", confirmLabel: "Eliminar registro" });
    if (!confirmed) return;
    try {
      await api.runAction({ title: "Eliminando registro", description: "Estamos actualizando el contador..." }, () => trainingApi.deleteCardio(api, record.id), { quiet: true });
      api.notify("Registro eliminado.");
      resource.reload();
    } catch (error) {
      api.notify(error?.message || "No se pudo eliminar el registro.", "error");
    }
  }

  return <section className="page training-page training-cardio-page"><Header title="Cardio" action={<button type="button" className="training-primary" onClick={() => setEditor({})}><Icon name="add" />Registrar cardio</button>} /><p className="training-page-intro">Llevá el registro de tu caminadora y sabé cuándo volver a lubricarla.</p><TrainingStatus loading={resource.loading} error={resource.error} onRetry={resource.reload} />{!resource.loading && !resource.error && <>
    <section className={`training-surface training-cardio-service-card ${due ? "is-due" : ""}`.trim()}><div className="training-cardio-service-heading"><div><span className="training-section-kicker">Mantenimiento de la caminadora</span><h2>Próximo service</h2><p>{summary.latestService ? `Último service: ${formatCardioDate(summary.latestService.servicedAt)}` : "Todavía no registraste un service."}</p></div><div className="training-cardio-service-icon"><Icon name={due ? "warning" : "build"} /></div></div><div className="training-cardio-kpi-grid"><div className="training-cardio-kpi-primary"><span>Tiempo acumulado</span><strong>{formatCardioMinutes(summary.totalDurationMinutes)}</strong><small>de {formatCardioMinutes(summary.thresholdMinutes)} hasta el próximo service</small></div><div className="training-cardio-kpi-secondary"><span>{due ? "Service recomendado" : "Tiempo restante"}</span><strong>{due ? "Ahora" : formatCardioMinutes(summary.remainingMinutes)}</strong><small>{due ? "Ya alcanzaste el límite de 20 horas" : "La cuenta se actualiza con cada registro"}</small></div></div><div className="training-cardio-progress" role="progressbar" aria-label="Horas de uso desde el último service" aria-valuenow={Number(summary.totalDurationMinutes || 0)} aria-valuemin="0" aria-valuemax={Number(summary.thresholdMinutes || 1200)}><span style={{ width: `${progress}%` }} /></div><div className="training-cardio-service-footer"><span>{summary.latestService ? "El contador toma los entrenamientos posteriores a este service." : "El contador suma tus registros hasta que cargues el primer service."}</span><button type="button" className={due ? "training-primary" : "training-secondary"} onClick={() => setServiceEditorOpen(true)}><Icon name="build" />Registrar service</button></div></section>
    <section className="training-surface training-cardio-history"><div className="training-section-heading"><div><h2>Historial de cardio</h2><span>Distancia y tiempo de cada entrenamiento</span></div><Icon name="history" /></div>{records.length ? <div className="training-cardio-record-list">{records.map((record) => <CardioRecordLine key={record.id} record={record} onEdit={setEditor} onDelete={remove} />)}</div> : <div className="training-empty-inline"><Icon name="directions_run" /><span>Todavía no registraste entrenamientos en la caminadora.</span></div>}</section>
  </>}{editor && <CardioRecordEditor api={api} record={editor.id ? editor : null} onClose={() => setEditor(null)} onSaved={resource.reload} />}{serviceEditorOpen && <CardioServiceEditor api={api} onClose={() => setServiceEditorOpen(false)} onSaved={resource.reload} />}</section>;
}
