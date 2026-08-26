import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Icon } from "../../components/Icon";
import { Header } from "../../components/Layout";
import { ModalShell } from "../../components/dialog/ModalShell";
import { CalisthenicsSessionEditor } from "./CalisthenicsSessionEditor";
import { GymSessionEditor } from "./GymSessionEditor";
import { TrainingModuleBadge, TrainingStatus } from "./TrainingComponents";
import { trainingApi } from "./training-api";
import { formatDuration, monthDays, normalizeSession, sessionsForCalendar } from "./training-utils";
import { useTrainingData } from "./useTrainingData";

function fullDate(value) { return new Intl.DateTimeFormat("es-AR", { weekday: "long", day: "numeric", month: "long" }).format(new Date(`${value}T00:00:00`)); }

function TrainingSessionDetail({ api, session, date, onClose, onEdit, onStart, onDeleted }) {
  const [detail, setDetail] = useState(session?.exercises?.length ? session : null);
  const [loading, setLoading] = useState(Boolean(session?.id && !session.exercises?.length));
  const [error, setError] = useState("");
  useEffect(() => {
    if (!session?.id || session.exercises?.length) return undefined;
    let current = true;
    setLoading(true);
    trainingApi.session(api, session.id).then((value) => { if (current) setDetail(normalizeSession(value)); }).catch((requestError) => { if (current) setError(requestError?.message || "No se pudo cargar el detalle de la sesión."); }).finally(() => { if (current) setLoading(false); });
    return () => { current = false; };
  }, [api, session]);
  const visible = detail || session;

  async function remove() {
    if (!visible?.id) return;
    const confirmed = await api.confirm({ title: "¿Eliminar esta sesión?", description: "Se borrarán sus series y notas del calendario.", confirmLabel: "Eliminar sesión" });
    if (!confirmed) return;
    try {
      await api.runAction({ title: "Eliminando sesión", description: "Estamos actualizando tu calendario..." }, () => trainingApi.deleteSession(api, visible.id), { quiet: true });
      api.notify("Sesión eliminada.");
      onDeleted();
      onClose();
    } catch (deleteError) { api.notify(deleteError?.message || "No se pudo eliminar la sesión.", "error"); }
  }

  return <ModalShell title={visible ? visible.routineName : fullDate(date)} description={visible ? fullDate(visible.date) : "No registraste una sesión este día."} onClose={onClose} theme="training" className="training-session-detail" backdropClassName="training-session-backdrop" footer={visible ? <><button type="button" className="training-danger-button" onClick={remove}><Icon name="delete" />Eliminar</button><button type="button" className="training-primary" onClick={() => onEdit(visible)}><Icon name="edit" />Editar</button></> : <><button type="button" className="training-secondary" onClick={onClose}>Cerrar</button><button type="button" className="training-primary" onClick={() => onStart("GYM", date)}><Icon name="add" />Registrar</button></>}>
    <div className="training-session-detail-content" data-dialog-scroll-owner="true">
      {loading && <TrainingStatus loading />}
      {error && <TrainingStatus error={error} />}
      {!loading && !error && visible && <>
        <div className="training-detail-summary"><TrainingModuleBadge module={visible.type} /><span>{formatDuration(visible.durationMinutes)}</span><span>{visible.exercises.length} ejercicios</span></div>
        <div className="training-detail-exercises">{visible.exercises.length ? visible.exercises.map((exercise) => <article key={exercise.id || exercise.name}><div><strong>{exercise.name}</strong>{exercise.notes && <small>{exercise.notes}</small>}</div><span>{exercise.sets.map((set) => `${set.reps || 0} reps${visible.type === "GYM" ? ` · ${set.weightKg || 0} kg` : ""}`).join(" · ")}</span></article>) : <p className="training-detail-note">La sesión no tiene ejercicios detallados disponibles.</p>}</div>
        {visible.notes && <p className="training-detail-note">{visible.notes}</p>}
      </>}
      {!loading && !error && !visible && <div className="training-empty-inline"><Icon name="today" /><span>Elegí Registrar para anotar una sesión de gimnasio en esta fecha.</span></div>}
    </div>
  </ModalShell>;
}

export function TrainingCalendar({ api }) {
  const [month, setMonth] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  const [selected, setSelected] = useState(null);
  const [editor, setEditor] = useState(null);
  const load = useCallback(() => trainingApi.calendar(api, month), [api, month]);
  const resource = useTrainingData(load, [load]);
  const sessions = useMemo(() => sessionsForCalendar(resource.data), [resource.data]);
  const byDate = useMemo(() => sessions.reduce((map, session) => { const current = map.get(session.date) || []; map.set(session.date, [...current, session]); return map; }, new Map()), [sessions]);
  const label = new Intl.DateTimeFormat("es-AR", { month: "long", year: "numeric" }).format(month);
  const routines = resource.data?.routines || [];
  const exercises = resource.data?.exercises || [];

  function openDay(date) { setSelected({ date, sessions: byDate.get(date) || [] }); }
  function editSession(session) { setSelected(null); setEditor(session); }
  function startSession(type, date) { setSelected(null); setEditor({ type, date, exercises: [] }); }
  function saved() { setEditor(null); resource.reload(); }

  return <section className="page training-page training-calendar-page">
    <Header title="Calendario" />
    <p className="training-page-intro">Revisá el volumen mensual y abrí cada día para editar o eliminar una sesión.</p>
    <section className="training-surface training-calendar-surface"><div className="training-calendar-heading"><button type="button" className="training-icon-action" aria-label="Mes anterior" onClick={() => setMonth((current) => new Date(current.getFullYear(), current.getMonth() - 1, 1))}><Icon name="chevron_left" /></button><div><h2>{label.charAt(0).toUpperCase() + label.slice(1)}</h2><span>{sessions.length} sesiones registradas</span></div><button type="button" className="training-icon-action" aria-label="Mes siguiente" onClick={() => setMonth((current) => new Date(current.getFullYear(), current.getMonth() + 1, 1))}><Icon name="chevron_right" /></button></div><TrainingStatus loading={resource.loading} error={resource.error} onRetry={resource.reload} />{!resource.loading && !resource.error && <><div className="training-calendar-weekdays" aria-hidden="true">{["L", "M", "X", "J", "V", "S", "D"].map((day) => <span key={day}>{day}</span>)}</div><div className="training-calendar-grid">{monthDays(month).map((date, index) => date ? <button type="button" key={date} className={`training-calendar-day ${byDate.has(date) ? "training-calendar-day-active" : ""}`.trim()} aria-label={`${fullDate(date)}${byDate.has(date) ? `, ${byDate.get(date).length} sesiones. Ver detalle` : ", sin sesiones. Registrar entrenamiento"}`} onClick={() => openDay(date)}><b>{new Date(`${date}T00:00:00`).getDate()}</b>{byDate.has(date) && <span><i>{byDate.get(date).length}</i><small>{byDate.get(date)[0].type === "GYM" ? "Gym" : "Cali"}</small></span>}</button> : <span key={`empty-${index}`} />)}</div></>}</section>
    {selected && <TrainingSessionDetail api={api} session={selected.sessions[0]} date={selected.date} onClose={() => setSelected(null)} onEdit={editSession} onStart={startSession} onDeleted={resource.reload} />}
    {editor?.type === "GYM" && <GymSessionEditor api={api} session={editor} routines={routines} exercises={exercises} onClose={() => setEditor(null)} onSaved={saved} />}
    {editor?.type === "CALISTHENICS" && <CalisthenicsSessionEditor api={api} session={editor} routines={routines} exercises={exercises} onClose={() => setEditor(null)} onSaved={saved} />}
  </section>;
}
