import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Icon } from "../../components/Icon";
import { Header } from "../../components/Layout";
import { ModalShell } from "../../components/dialog/ModalShell";
import { CalisthenicsSessionEditor } from "./CalisthenicsSessionEditor";
import { GymSessionEditor } from "./GymSessionEditor";
import { TrainingModuleBadge, TrainingStatus } from "./TrainingComponents";
import { trainingApi } from "./training-api";
import { dateKey, exerciseRegistration, formatDuration, monthDays, normalizeSession, registrationTypeLabel, sessionStatus, sessionStatusLabel, sessionsForCalendar } from "./training-utils";
import { useTrainingData } from "./useTrainingData";

function fullDate(value) { return new Intl.DateTimeFormat("es-AR", { weekday: "long", day: "numeric", month: "long" }).format(new Date(`${value}T00:00:00`)); }

function formatSet(set, exercise, module) {
  const type = exerciseRegistration(exercise, module);
  const values = [];
  if (type === "REPETITIONS" || type === "REPETITIONS_AND_TIME" || type === "WEIGHT_AND_REPETITIONS") values.push(`${set.reps || 0} reps`);
  if (type === "TIME" || type === "REPETITIONS_AND_TIME") values.push(`${set.seconds || 0} s`);
  if (type === "DISTANCE") values.push(`${set.distanceMeters || 0} m`);
  if (module === "GYM" && type === "WEIGHT_AND_REPETITIONS") values.push(`${set.weightKg || 0} kg`);
  if (exercise.unilateral) values.push(set.side === "LEFT" ? "izquierdo" : set.side === "RIGHT" ? "derecho" : "ambos");
  return values.join(" · ");
}

function TrainingDayDetail({ api, selected, planDetails, onClose, onEdit, onStart, onDeleted }) {
  const session = selected.sessions.find((item) => item.status === "IN_PROGRESS") || selected.sessions[0];
  const [detail, setDetail] = useState(session?.exercises?.length ? session : null);
  const [loading, setLoading] = useState(Boolean(session?.id && !session.exercises?.length));
  const [error, setError] = useState("");
  useEffect(() => {
    if (!session?.id || session.exercises?.length) return undefined;
    let current = true;
    trainingApi.session(api, session.id).then((value) => { if (current) setDetail(normalizeSession(value)); }).catch((requestError) => { if (current) setError(requestError?.message || "No se pudo cargar el detalle de la sesión."); }).finally(() => { if (current) setLoading(false); });
    return () => { current = false; };
  }, [api, session]);
  const visible = detail || session;
  const editable = visible && sessionStatus(visible.status) === "IN_PROGRESS";
  async function remove() {
    if (!visible?.id) return;
    const confirmed = await api.confirm({ title: "¿Eliminar esta sesión?", description: "Se borrarán sus series y notas del calendario.", confirmLabel: "Eliminar sesión" });
    if (!confirmed) return;
    try { await api.runAction({ title: "Eliminando sesión", description: "Estamos actualizando tu calendario..." }, () => trainingApi.deleteSession(api, visible.id), { quiet: true }); api.notify("Sesión eliminada."); onDeleted(); onClose(); } catch (deleteError) { api.notify(deleteError?.message || "No se pudo eliminar la sesión.", "error"); }
  }
  const firstPlan = selected.plannedPlans[0];
  const footer = visible ? <><button type="button" className="training-danger-button" onClick={remove}><Icon name="delete" />Eliminar</button>{editable && <button type="button" className="training-primary" onClick={() => onEdit(visible)}><Icon name="edit" />Continuar</button>}</> : <><button type="button" className="training-secondary" onClick={onClose}>Cerrar</button>{firstPlan && <button type="button" className="training-primary" onClick={() => onStart(firstPlan, selected.date)}><Icon name="add" />Iniciar día</button>}</>;
  return <ModalShell title={visible?.title || visible?.planName || fullDate(selected.date)} description={visible ? `${fullDate(visible.date)} · ${sessionStatusLabel(visible.status)}` : "No registraste una sesión este día."} onClose={onClose} theme="training" className="training-session-detail" backdropClassName="training-session-backdrop" footer={footer}>
    <div className="training-session-detail-content">
      {selected.plannedPlans.length > 0 && <section className="training-day-planned"><h3>Planificado</h3>{selected.plannedPlans.map((schedule) => { const plan = planDetails.get(String(schedule.planId)); const day = plan?.days?.find((item) => String(item.id) === String(schedule.planDayId)); const currentStatus = schedule.sessionStatus ? sessionStatus(schedule.sessionStatus) : null; return <div className="training-day-plan-row" key={`${schedule.planId}-${schedule.planDayId}`}><div><TrainingModuleBadge module={schedule.module} /><strong>{day?.name || schedule.planDayName}</strong><small>{plan?.name || "Plan"} · {currentStatus ? sessionStatusLabel(currentStatus) : plan?.frequencyMode === "DYNAMIC" ? "siguiente dinámico" : "día fijo"}</small></div>{currentStatus !== "COMPLETED" && <button type="button" className="training-secondary" disabled={!day} onClick={() => onStart(schedule, selected.date)}><Icon name="play_arrow" />{currentStatus === "IN_PROGRESS" ? "Continuar" : "Iniciar día"}</button>}</div>; })}</section>}
      {selected.sessions.length > 1 && <section className="training-day-performed"><h3>Sesiones registradas</h3>{selected.sessions.map((item) => <div key={item.id} className="training-day-session-row"><TrainingModuleBadge module={item.type} /><strong>{item.title || "Sesión sin título"}</strong><span>{sessionStatusLabel(item.status)} · {formatDuration(item.durationMinutes)}</span></div>)}</section>}
      {loading && <TrainingStatus loading />}{error && <TrainingStatus error={error} />}
      {!loading && !error && visible && <><div className="training-detail-summary"><TrainingModuleBadge module={visible.type} /><span>{sessionStatusLabel(visible.status)}</span><span>{formatDuration(visible.durationMinutes)}</span><span>{visible.exercises.length} ejercicios</span></div><div className="training-detail-exercises">{visible.exercises.length ? visible.exercises.map((exercise) => <article key={exercise.id || exercise.name}><div><strong>{exercise.name}</strong><small>{registrationTypeLabel(exercise.registrationType, visible.type)}{exercise.notes ? ` · ${exercise.notes}` : ""}</small></div><span>{exercise.sets.map((set) => formatSet(set, exercise, visible.type)).join(" · ") || "Sin series registradas"}</span></article>) : <p className="training-detail-note">Esta sesión todavía no tiene ejercicios ejecutados.</p>}</div></>}
      {!visible && !selected.plannedPlans.length && <p className="training-detail-note">No hay planificación ni sesiones para este día.</p>}
    </div>
  </ModalShell>;
}

export function TrainingCalendar({ api }) {
  const [month, setMonth] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  const [selected, setSelected] = useState(null); const [editor, setEditor] = useState(null); const [starting, setStarting] = useState(false);
  const from = dateKey(new Date(month.getFullYear(), month.getMonth(), 1)); const to = dateKey(new Date(month.getFullYear(), month.getMonth() + 1, 0));
  const load = useCallback(async () => { const [calendar, exercises] = await Promise.all([trainingApi.calendar(api, from, to), trainingApi.exercises(api)]); const days = Array.isArray(calendar) ? calendar : calendar?.days || calendar?.items || []; const ids = [...new Set(days.flatMap((day) => (day.plannedPlans || []).map((item) => item.planId)).filter(Boolean))]; const details = await Promise.all(ids.map(async (id) => { try { return await trainingApi.plan(api, id); } catch { return null; } })); return { days, planDetails: details.filter(Boolean), exercises: exercises.items || [] }; }, [api, from, to]);
  const resource = useTrainingData(load, [load]); const days = Array.isArray(resource.data?.days) ? resource.data.days : []; const sessions = useMemo(() => sessionsForCalendar(days), [days]); const planDetails = useMemo(() => new Map((resource.data?.planDetails || []).map((plan) => [String(plan.id), plan])), [resource.data]);
  const byDate = useMemo(() => days.reduce((map, day) => { const actual = sessions.filter((session) => session.date === day.date); const known = new Set(actual.map((session) => String(session.id))); const planned = day.plannedPlans || []; const placeholders = planned.filter((item) => item.sessionId && !known.has(String(item.sessionId))).map((item) => normalizeSession({ id: item.sessionId, date: day.date, module: item.module, planId: item.planId, planDayId: item.planDayId, planName: item.planName, planDayName: item.planDayName, status: item.sessionStatus, exercises: [] })); map.set(day.date, { sessions: [...actual, ...placeholders], plannedPlans: planned }); return map; }, new Map()), [days, sessions]);
  const label = new Intl.DateTimeFormat("es-AR", { month: "long", year: "numeric" }).format(month);
  async function startSession(schedule, date) {
    const plan = planDetails.get(String(schedule.planId)); const day = plan?.days?.find((item) => String(item.id) === String(schedule.planDayId));
    if (!day || starting || sessionStatus(schedule.sessionStatus) === "COMPLETED") return;
    setStarting(true); setSelected(null);
    try { const existing = schedule.sessionStatus === "IN_PROGRESS" && schedule.sessionId ? await trainingApi.session(api, schedule.sessionId) : null; const created = existing || await trainingApi.createSession(api, { date, module: schedule.module, planId: Number(schedule.planId), planDayId: Number(schedule.planDayId) }); setEditor(normalizeSession({ ...created, module: schedule.module, date: created?.date || date, planId: created?.planId || schedule.planId, planDayId: created?.planDayId || schedule.planDayId, planName: created?.planName || plan.name, planDayName: created?.planDayName || day.name })); }
    catch (error) { api.notify(error?.message || "No se pudo iniciar el día.", "error"); }
    finally { setStarting(false); }
  }
  async function startFree(type, date) {
    if (starting) return; setStarting(true); setSelected(null);
    try { const created = await trainingApi.createSession(api, { date, module: type }); setEditor(normalizeSession({ ...created, module: type, date: created?.date || date })); } catch (error) { api.notify(error?.message || "No se pudo iniciar la sesión.", "error"); } finally { setStarting(false); }
  }
  function saved() { setEditor(null); resource.reload(); }
  return <section className="page training-page training-calendar-page"><Header title="Calendario" /><p className="training-page-intro">Revisá lo planificado y lo que realmente registraste. Los estados muestran si un día sigue en proceso o ya fue finalizado.</p><section className="training-surface training-calendar-surface"><div className="training-calendar-heading"><button type="button" className="training-icon-action" aria-label="Mes anterior" onClick={() => setMonth((current) => new Date(current.getFullYear(), current.getMonth() - 1, 1))}><Icon name="chevron_left" /></button><div><h2>{label.charAt(0).toUpperCase() + label.slice(1)}</h2><span>{sessions.length} sesiones registradas</span></div><button type="button" className="training-icon-action" aria-label="Mes siguiente" onClick={() => setMonth((current) => new Date(current.getFullYear(), current.getMonth() + 1, 1))}><Icon name="chevron_right" /></button></div><TrainingStatus loading={resource.loading} error={resource.error} onRetry={resource.reload} />{!resource.loading && !resource.error && <><div className="training-calendar-weekdays" aria-hidden="true">{["L", "M", "X", "J", "V", "S", "D"].map((day) => <span key={day}>{day}</span>)}</div><div className="training-calendar-grid">{monthDays(month).map((date, index) => { const data = date ? byDate.get(date) : null; const active = Boolean(data?.sessions.length || data?.plannedPlans.length); const inProgress = data?.sessions.some((item) => item.status === "IN_PROGRESS") || data?.plannedPlans.some((item) => item.sessionStatus === "IN_PROGRESS"); return date ? <button type="button" key={date} className={`training-calendar-day ${active ? "training-calendar-day-active" : ""}`.trim()} aria-label={`${fullDate(date)}${active ? ", ver planificación y sesiones" : ", sin actividad registrada"}`} onClick={() => setSelected({ date, ...(data || { sessions: [], plannedPlans: [] }) })}><b>{new Date(`${date}T00:00:00`).getDate()}</b>{active && <span>{data.sessions.length > 0 && <i>{data.sessions.length}</i>}<small>{inProgress ? "En proceso" : data.plannedPlans.length ? "Finalizado" : "Registrado"}</small></span>}</button> : <span key={`empty-${index}`} aria-hidden="true" />; })}</div></>}</section>{selected && <TrainingDayDetail key={`${selected.date}-${selected.sessions.map((item) => item.id).join("-")}`} api={api} selected={selected} planDetails={planDetails} onClose={() => setSelected(null)} onEdit={(value) => { setSelected(null); setEditor(value); }} onStart={startSession} onDeleted={resource.reload} />}{editor?.type === "GYM" && <GymSessionEditor api={api} session={editor} plans={[]} exercises={resource.data?.exercises || []} onClose={() => setEditor(null)} onSaved={saved} />}{editor?.type === "CALISTHENICS" && <CalisthenicsSessionEditor api={api} session={editor} plans={[]} exercises={resource.data?.exercises || []} onClose={() => setEditor(null)} onSaved={saved} />}</section>;
}
