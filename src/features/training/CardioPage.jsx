import React, { useCallback, useRef, useState } from "react";
import { Icon } from "../../components/Icon";
import { Header } from "../../components/Layout";
import { Input } from "../../components/FormControls";
import { ModalShell } from "../../components/dialog/ModalShell";
import { CardioWeekSummary, TrainingStatus } from "./TrainingComponents";
import { cardioDistanceFromSpeed, cardioEstimatedSteps, cardioPayload, cardioProgress, formatCardioDate, formatCardioDistance, formatCardioMinutes, formatCardioSpeed, formatCardioSteps, localDateTimeInput, localTimeZone, toOffsetDateTime } from "./cardio-utils";
import { decimalNumber } from "../../utils/decimal";
import { trainingApi } from "./training-api";
import { useTrainingData } from "./useTrainingData";

function CardioRecordEditor({ api, record, heightCm, onClose, onSaved }) {
  const [form, setForm] = useState(() => ({
    recordedAt: localDateTimeInput(record?.recordedAt),
    speedKmh: record?.speedKmh ?? "",
    durationMinutes: record?.durationMinutes ?? "",
    inclined: Boolean(record?.inclined),
  }));
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);
  const [error, setError] = useState("");

  function setField(field, value) {
    setError("");
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function submit(event) {
    event.preventDefault();
    if (savingRef.current) return;
    const speedKmh = decimalNumber(form.speedKmh);
    if (!form.recordedAt || !Number.isFinite(speedKmh) || speedKmh < 0 || !Number.isFinite(Number(form.durationMinutes)) || !Number(form.durationMinutes) || Number(form.durationMinutes) < 1) {
      setError("Completá una fecha, una velocidad válida y un tiempo mayor a cero.");
      return;
    }
    savingRef.current = true;
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
      savingRef.current = false;
      setSaving(false);
    }
  }

  const distanceKm = cardioDistanceFromSpeed(form.speedKmh, form.durationMinutes);
  const estimatedSteps = cardioEstimatedSteps(distanceKm, heightCm);
  return <ModalShell title={record ? "Editar cardio" : "Registrar cardio"} description="Anotá la velocidad y el tiempo que marcó tu caminadora." onClose={onClose} closeDisabled={saving} theme="training" className="training-cardio-editor" backdropClassName="training-session-backdrop" footer={<><button type="button" className="training-secondary" onClick={onClose} disabled={saving}>Cancelar</button><button type="submit" form="cardio-record-form" className="training-primary" disabled={saving}>{saving ? "Guardando…" : "Guardar registro"}</button></>}>
    <form id="cardio-record-form" className="training-editor-form" onSubmit={submit}>
      <div className="training-cardio-form-grid"><Input label="Fecha y hora" type="datetime-local" value={form.recordedAt} onChange={(event) => setField("recordedAt", event.target.value)} /><Input label="Velocidad media (km/h)" decimal value={form.speedKmh} onChange={(event) => setField("speedKmh", event.target.value)} placeholder="Ej.: 8,50" /><Input label="Tiempo (minutos)" type="number" min="1" step="1" numericOnly value={form.durationMinutes} onChange={(event) => setField("durationMinutes", event.target.value)} placeholder="Ej.: 35" /></div>
      <div className="training-cardio-preview" aria-live="polite"><span>Estimación de esta sesión</span><strong>{distanceKm === null ? "Completá velocidad y tiempo" : `${formatCardioDistance(distanceKm)} · ${estimatedSteps === null ? "pasos pendientes" : `~${formatCardioSteps(estimatedSteps)} pasos`}`}</strong><small>{estimatedSteps === null ? "Completá tu altura en Perfil para estimar pasos." : "Basada en tu altura y la distancia recorrida."}</small></div>
      <label className="training-toggle"><input type="checkbox" checked={form.inclined} onChange={(event) => setField("inclined", event.target.checked)} /><span><strong>Caminadora inclinada</strong><small>Marcá si usaste la única inclinación disponible.</small></span></label>
      {error && <p className="training-form-error" role="alert">{error}</p>}
    </form>
  </ModalShell>;
}

function CardioServiceEditor({ api, service, onClose, onSaved }) {
  const [form, setForm] = useState(() => ({ servicedAt: localDateTimeInput(service?.servicedAt), notes: service?.notes || "" }));
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);
  const [error, setError] = useState("");

  async function submit(event) {
    event.preventDefault();
    if (savingRef.current) return;
    if (!form.servicedAt || !Number.isFinite(new Date(form.servicedAt).getTime()) || new Date(form.servicedAt).getTime() > Date.now()) return setError("Elegí una fecha y hora de mantenimiento que no sea futura.");
    savingRef.current = true;
    setSaving(true);
    setError("");
    try {
    if (service && !(await api.confirm({ title:"Revisar corrección de mantenimiento",description:`Fecha guardada: ${formatCardioDate(service.servicedAt)}. Nueva fecha: ${formatCardioDate(form.servicedAt)}. Se conservará el registro y se recalculará el contador desde el último mantenimiento válido.`,confirmLabel:"Guardar corrección",tone:"neutral" }))) return;
      const saved = await api.runAction({ title: "Registrando mantenimiento", description: "Estamos reiniciando el contador de la caminadora..." }, () => (service ? trainingApi.updateCardioService(api,service,{equipment:"TREADMILL",servicedAt:toOffsetDateTime(form.servicedAt),notes:form.notes.trim() || null}) : trainingApi.createCardioService(api, { equipment: "TREADMILL", servicedAt: toOffsetDateTime(form.servicedAt), notes: form.notes.trim() || null })), { quiet: true });
      api.notify(service ? "Mantenimiento corregido. Contador actualizado." : "Mantenimiento registrado. Contador actualizado.");
      onSaved(saved);
      onClose();
    } catch (saveError) {
      setError(saveError?.message || "No se pudo registrar el mantenimiento.");
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  }

  return <ModalShell title={service ? "Corregir mantenimiento" : "Registrar mantenimiento"} description="El contador toma las sesiones posteriores al último mantenimiento válido. Los anteriores se conservan en el historial." onClose={onClose} closeDisabled={saving} theme="training" className="training-cardio-service-editor" backdropClassName="training-session-backdrop" footer={<><button type="button" className="training-secondary" onClick={onClose} disabled={saving}>Cancelar</button><button type="submit" form="cardio-service-form" className="training-primary" disabled={saving}>{saving ? "Guardando…" : service ? "Revisar corrección" : "Registrar mantenimiento"}</button></>}>
    <form id="cardio-service-form" className="training-editor-form" onSubmit={submit}><Input label="Fecha y hora" type="datetime-local" value={form.servicedAt} onChange={(event) => { setError(""); setForm((current) => ({ ...current, servicedAt: event.target.value })); }} /><label className="field training-notes-field"><span>Notas (opcional)</span><textarea maxLength="2000" value={form.notes} onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))} placeholder="Ej.: silicona líquida aplicada" /></label>{error && <p className="training-form-error" role="alert">{error}</p>}</form>
  </ModalShell>;
}

function CardioRecordLine({ record, onEdit, onDelete }) {
  return <article className="training-cardio-record"><div className="training-cardio-record-icon"><Icon name="directions_run" /></div><div className="training-cardio-record-copy"><strong>{record.estimatedSteps !== null && record.estimatedSteps !== undefined ? `~${formatCardioSteps(record.estimatedSteps)} pasos estimados` : "Pasos no disponibles"}</strong><span>{formatCardioDate(record.recordedAt)}</span><span>{formatCardioSpeed(record.speedKmh)} · {formatCardioMinutes(record.durationMinutes)} · {formatCardioDistance(record.distanceKm)}</span>{record.estimatedSteps === null || record.estimatedSteps === undefined ? <small>Completá tu altura en Perfil para estimar pasos</small> : <small>Estimación basada en tu altura y la distancia recorrida</small>}{record.inclined && <small><Icon name="trending_up" /> Inclinada</small>}</div><div className="training-cardio-record-actions"><button type="button" className="training-icon-action" aria-label="Editar registro de cardio" onClick={() => onEdit(record)}><Icon name="edit" /></button><button type="button" className="training-icon-action training-delete-control" aria-label="Eliminar registro de cardio" onClick={() => onDelete(record)}><Icon name="delete" /></button></div></article>;
}

export function CardioPage({ api }) {
  const [page, setPage] = useState(0);
  const [editor, setEditor] = useState(null);
  const [serviceEditor, setServiceEditor] = useState(null);
  const [servicePage, setServicePage] = useState(0);
  const [annullingId, setAnnullingId] = useState(null);
  const annullingRef = useRef(false);
  const load = useCallback(async () => {
    const date = new Date();
    const dateKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
    const [records, summary, week, services] = await Promise.all([trainingApi.cardio(api, { page }), trainingApi.cardioSummary(api), trainingApi.cardioWeekly(api, { date: dateKey, timeZone: localTimeZone() }),trainingApi.cardioServices(api,{page:servicePage})]);
    return { records: records.items || [], page: records, summary, week, services, today: dateKey };
  }, [api, page, servicePage]);
  const resource = useTrainingData(load, [load]);
  const records = resource.data?.records || [];
  const summary = resource.data?.summary || {};
  const progress = cardioProgress(summary);
  const due = Boolean(summary.due);

  async function remove(record) {
    const confirmed = await api.confirm({ title: "¿Eliminar este registro?", description: "Se quitará del historial y del cálculo de mantenimiento.", confirmLabel: "Eliminar registro" });
    if (!confirmed) return;
    try {
      await api.runAction({ title: "Eliminando registro", description: "Estamos actualizando el contador..." }, () => trainingApi.deleteCardio(api, record.id), { quiet: true });
      api.notify("Registro eliminado.");
      if (records.length === 1 && page > 0) setPage(page - 1); else resource.reload();
    } catch (error) {
      api.notify(error?.message || "No se pudo eliminar el registro.", "error");
    }
  }

  async function annul(service) {
    if (annullingRef.current) return;
    annullingRef.current = true; setAnnullingId(service.id);
    try {
      if (!(await api.confirm({title:"¿Anular mantenimiento?",description:`${formatCardioDate(service.servicedAt)}. El registro quedará en el historial como anulado. Si era el último válido, el contador se recalculará desde el anterior o desde todas tus sesiones.`,confirmLabel:"Anular mantenimiento"}))) return;
      await trainingApi.annulCardioService(api,service); api.notify("Mantenimiento anulado. Contador actualizado."); resource.reload();
    } catch(error) { api.notify(error.message || "No se pudo anular el mantenimiento. Recargá el historial.","error"); }
    finally { annullingRef.current=false; setAnnullingId(null); }
  }

  return <section className="page training-page training-cardio-page"><Header title="Cardio" action={<button type="button" className="training-primary" onClick={() => setEditor({})}><Icon name="add" />Registrar sesión</button>} /><p className="training-page-intro">Registrá tu caminadora y consultá tus pasos estimados.</p><TrainingStatus loading={resource.loading} error={resource.error} onRetry={resource.reload} />{!resource.loading && !resource.error && <>
    <CardioWeekSummary summary={resource.data?.week} today={resource.data?.today} />
    <section className="training-surface training-cardio-history"><div className="training-section-heading"><div><h2>Historial de cardio</h2><span>Pasos estimados, velocidad y tiempo de cada sesión</span></div><Icon name="history" /></div>{records.length ? <div className="training-cardio-record-list">{records.map((record) => <CardioRecordLine key={record.id} record={record} onEdit={setEditor} onDelete={remove} />)}</div> : <div className="training-empty-inline"><Icon name="directions_run" /><span>Todavía no registraste sesiones en la caminadora.</span></div>}{resource.data?.page?.totalPages > 1 && <nav className="cardio-pagination" aria-label="Páginas del historial de cardio"><button type="button" className="training-secondary" disabled={page === 0 || resource.loading} onClick={() => setPage(current => current - 1)}>Anterior</button><span role="status">Página {page + 1} de {resource.data.page.totalPages}</span><button type="button" className="training-secondary" disabled={!resource.data.page.hasNext || resource.loading} onClick={() => setPage(current => current + 1)}>Siguiente</button></nav>}</section>
    <section className={`training-surface training-cardio-service-card training-cardio-maintenance ${due ? "is-due" : ""}`.trim()}><div className="training-cardio-service-heading"><div><h2>Mantenimiento de la caminadora</h2><p>{summary.latestService ? `Último mantenimiento: ${formatCardioDate(summary.latestService.servicedAt)}` : "Todavía no registraste un mantenimiento."}</p></div><div className="training-cardio-service-icon"><Icon name={due ? "warning" : "build"} /></div></div><div className="training-cardio-kpi-grid"><div className="training-cardio-kpi-primary"><span>Uso desde el último mantenimiento</span><strong>{formatCardioMinutes(summary.totalDurationMinutes)}</strong><small>de {formatCardioMinutes(summary.thresholdMinutes)} hasta el próximo mantenimiento</small></div><div className="training-cardio-kpi-secondary"><span>{due ? "Mantenimiento recomendado" : "Tiempo restante"}</span><strong>{due ? "Ahora" : formatCardioMinutes(summary.remainingMinutes)}</strong><small>{due ? "Ya alcanzaste el límite de 20 horas" : "La cuenta se actualiza con cada sesión"}</small></div></div><div className="training-cardio-progress" role="progressbar" aria-label="Horas de uso desde el último mantenimiento" aria-valuenow={Math.min(Number(summary.totalDurationMinutes || 0), Number(summary.thresholdMinutes || 1200))} aria-valuetext={`${formatCardioMinutes(summary.totalDurationMinutes)} de ${formatCardioMinutes(summary.thresholdMinutes)}`} aria-valuemin="0" aria-valuemax={Number(summary.thresholdMinutes || 1200)}><span style={{ width: `${progress}%` }} /></div><div className="training-cardio-service-footer"><span>{summary.latestService ? "El contador toma las sesiones posteriores a este mantenimiento." : "El contador suma tus sesiones hasta que cargues el primer mantenimiento."}</span><button type="button" className={due ? "training-primary" : "training-secondary"} onClick={() => setServiceEditor({})}><Icon name="build" />Registrar mantenimiento</button></div></section>
    <section className="training-surface maintenance-history"><h2>Historial de mantenimientos</h2><p>Corregir o anular recalcula el contador. Los registros anulados permanecen visibles.</p>{resource.data?.services?.items?.length ? <div className="maintenance-list">{resource.data.services.items.map(service => <article key={service.id} className="maintenance-row"><div><strong>{formatCardioDate(service.servicedAt)}</strong><span>{service.annulledAt ? "Anulado" : "Válido"}</span><p>{service.notes || "Sin notas"}</p>{service.annulledAt && <small>Anulado el {formatCardioDate(service.annulledAt)}</small>}</div>{!service.annulledAt && <div className="training-exercise-actions"><button className="training-secondary" disabled={annullingId != null} onClick={() => setServiceEditor(service)}>Corregir</button><button className="training-secondary danger-text" disabled={annullingId != null} onClick={() => annul(service)}>{annullingId === service.id ? "Anulando…" : "Anular"}</button></div>}</article>)}</div> : <p>Todavía no registraste mantenimientos.</p>}{resource.data?.services?.totalPages > 1 && <nav aria-label="Páginas de mantenimientos"><button className="training-secondary" disabled={!servicePage} onClick={() => setServicePage(value => value-1)}>Anterior</button><span>Página {servicePage+1}</span><button className="training-secondary" disabled={!resource.data.services.hasNext} onClick={() => setServicePage(value => value+1)}>Siguiente</button></nav>}</section>
  </>}{editor && <CardioRecordEditor api={api} record={editor.id ? editor : null} heightCm={summary.profileHeightCm} onClose={() => setEditor(null)} onSaved={resource.reload} />}{serviceEditor && <CardioServiceEditor api={api} service={serviceEditor.id ? serviceEditor : null} onClose={() => setServiceEditor(null)} onSaved={resource.reload} />}</section>;
}
