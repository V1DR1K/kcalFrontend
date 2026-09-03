import React, { useCallback, useMemo, useState } from "react";
import { Icon } from "../../components/Icon";
import { Header } from "../../components/Layout";
import { ModalShell } from "../../components/dialog/ModalShell";
import { CalisthenicsSessionEditor } from "./CalisthenicsSessionEditor";
import { GymSessionEditor } from "./GymSessionEditor";
import { TrainingModuleBadge, TrainingSessionLine, TrainingStatus } from "./TrainingComponents";
import { trainingApi } from "./training-api";
import { dateKey, formatDuration, normalizeSession, sessionStatus, sessionStatusLabel } from "./training-utils";
import { useTrainingData } from "./useTrainingData";

const modules = [
  { value: "GYM", label: "Gimnasio", icon: "fitness_center", description: "Series, repeticiones y carga." },
  { value: "CALISTHENICS", label: "Calistenia", icon: "monitoring", description: "Volumen y control corporal." },
];

function ModulePicker({ onClose, onSelect }) {
  return <ModalShell title="¿Qué vas a registrar?" description="Elegí el tipo de entrenamiento para abrir el registro de hoy." onClose={onClose} theme="training" className="training-module-picker" backdropClassName="training-session-backdrop">
    <div className="training-module-choice-list">{modules.map((module) => <button type="button" className="training-module-choice" key={module.value} onClick={() => onSelect(module.value)}><span className="training-module-choice-icon"><Icon name={module.icon} /></span><span><strong>{module.label}</strong><small>{module.description}</small></span><Icon name="chevron_right" /></button>)}</div>
  </ModalShell>;
}

function PlanPicker({ schedules, planDetails, onClose, onSelect }) {
  return <ModalShell title="Elegí el día" description="Hay más de un plan disponible para hoy." onClose={onClose} theme="training" className="training-module-picker" backdropClassName="training-session-backdrop">
    <div className="training-module-choice-list">{schedules.map((schedule) => { const plan = planDetails.get(String(schedule.planId)); const day = plan?.days?.find((item) => String(item.id) === String(schedule.planDayId)); const status = schedule.sessionStatus ? sessionStatus(schedule.sessionStatus) : null; return <button type="button" className="training-module-choice" key={`${schedule.planId}-${schedule.planDayId}`} onClick={() => onSelect(schedule)}><span className="training-module-choice-icon"><Icon name={schedule.module === "CALISTHENICS" ? "monitoring" : "fitness_center"} /></span><span><TrainingModuleBadge module={schedule.module} /><strong>{day?.name || schedule.planDayName}</strong><small>{plan?.name || "Plan de entrenamiento"}{status ? ` · ${sessionStatusLabel(status)}` : ""}</small></span><Icon name="chevron_right" /></button>; })}</div>
  </ModalShell>;
}

export function TrainingDashboard({ api }) {
  const [editor, setEditor] = useState(null);
  const [starting, setStarting] = useState("");
  const [modulePickerOpen, setModulePickerOpen] = useState(false);
  const [planPickerOpen, setPlanPickerOpen] = useState(false);
  const load = useCallback(async () => {
    const dashboard = await trainingApi.dashboard(api, dateKey());
    const ids = [...new Set((dashboard.plannedPlans || []).map((item) => item.planId).filter(Boolean))];
    const details = await Promise.all(ids.map(async (id) => { try { return await trainingApi.plan(api, id); } catch { return null; } }));
    return { dashboard, planDetails: details.filter(Boolean) };
  }, [api]);
  const resource = useTrainingData(load, [load]);
  const dashboard = resource.data?.dashboard || {};
  const planDetails = useMemo(() => new Map((resource.data?.planDetails || []).map((plan) => [String(plan.id), plan])), [resource.data]);
  const exercises = dashboard.exercises || [];
  const plannedPlans = dashboard.plannedPlans || [];
  const recent = dashboard.recentSession ? normalizeSession(dashboard.recentSession) : null;
  const week = dashboard.weeklySummary || {};
  const actionablePlans = useMemo(() => plannedPlans.filter((schedule) => !["COMPLETED", "SKIPPED"].includes(sessionStatus(schedule.sessionStatus))), [plannedPlans]);
  const date = dashboard.date || dateKey();
  const dateLabel = new Intl.DateTimeFormat("es-AR", { weekday: "long", day: "numeric", month: "long" }).format(new Date(`${date}T00:00:00`));
  const actionLabel = actionablePlans.length === 1 && actionablePlans[0].sessionStatus === "IN_PROGRESS" ? "Continuar día" : "Registrar día";

  async function startFree(type) {
    if (starting) return;
    setModulePickerOpen(false);
    setStarting(`free-${type}`);
    try {
      const created = await trainingApi.createSession(api, { date, module: type });
      setEditor(normalizeSession({ ...created, module: type, date: created?.date || date }));
    } catch (error) { api.notify(error?.message || "No se pudo iniciar la sesión.", "error"); }
    finally { setStarting(""); }
  }

  async function startPlan(schedule) {
    const plan = planDetails.get(String(schedule.planId));
    const day = plan?.days?.find((item) => String(item.id) === String(schedule.planDayId));
    if (!plan || !day || starting) return;
    setPlanPickerOpen(false);
    setStarting(`${schedule.planId}-${schedule.planDayId}`);
    try {
      const existing = schedule.sessionStatus === "IN_PROGRESS" && schedule.sessionId ? await trainingApi.session(api, schedule.sessionId) : null;
      const created = existing || await trainingApi.createSession(api, { date, module: schedule.module, planId: Number(schedule.planId), planDayId: Number(schedule.planDayId) });
      setEditor(normalizeSession({ ...created, module: schedule.module, date: created?.date || date, planId: created?.planId || schedule.planId, planDayId: created?.planDayId || schedule.planDayId, planName: created?.planName || plan.name, planDayName: created?.planDayName || day.name }));
    } catch (error) { api.notify(error?.message || "No se pudo iniciar el día.", "error"); }
    finally { setStarting(""); }
  }

  function registerDay() {
    if (!actionablePlans.length) return setModulePickerOpen(true);
    if (actionablePlans.length === 1) return startPlan(actionablePlans[0]);
    setPlanPickerOpen(true);
  }

  async function skip(schedule) {
    const plan = planDetails.get(String(schedule.planId));
    const day = plan?.days?.find((item) => String(item.id) === String(schedule.planDayId));
    if (!plan || plan.frequencyMode !== "DYNAMIC") return;
    const confirmed = await api.confirm({ title: `¿Omitir ${day?.name || "esta sesión"}?`, description: "Se registrará como omitida y el plan dinámico avanzará al siguiente día.", confirmLabel: "Omitir sesión", tone: "neutral" });
    if (!confirmed) return;
    try { await api.runAction({ title: "Omitiendo sesión", description: "Estamos avanzando tu plan dinámico..." }, () => trainingApi.skipPlan(api, schedule.planId, { date, planDayId: schedule.planDayId, notes: null }), { quiet: true }); api.notify("Sesión omitida."); resource.reload(); } catch (error) { api.notify(error?.message || "No se pudo omitir la sesión.", "error"); }
  }

  return <section className="page training-page training-dashboard-page"><Header title="Día" /><p className="training-page-intro">Registrá lo que hiciste hoy y mantené visible tu ritmo de entrenamiento.</p><TrainingStatus loading={resource.loading} error={resource.error} onRetry={resource.reload} />{!resource.loading && !resource.error && <>
    <section className="training-day-focus"><div className="training-day-focus-copy"><h2>Tu entrenamiento de hoy</h2><span className="training-day-focus-date">{dateLabel.charAt(0).toUpperCase() + dateLabel.slice(1)}</span>{plannedPlans.length ? <div className="training-day-plan-list">{plannedPlans.map((schedule) => { const plan = planDetails.get(String(schedule.planId)); const day = plan?.days?.find((item) => String(item.id) === String(schedule.planDayId)); const status = schedule.sessionStatus ? sessionStatus(schedule.sessionStatus) : null; return <div className="training-day-plan" key={`${schedule.planId}-${schedule.planDayId}`}><TrainingModuleBadge module={schedule.module} /><div><strong>{day?.name || schedule.planDayName}</strong><span>{plan?.name || "Plan de entrenamiento"}{status ? ` · ${sessionStatusLabel(status)}` : ""}</span></div></div>; })}</div> : <p className="training-day-focus-empty">No hay una sesión planificada. Elegí un módulo para registrar tu día.</p>}</div><button type="button" className="training-primary training-day-focus-action" disabled={Boolean(starting) || (plannedPlans.length > 0 && !actionablePlans.length)} onClick={registerDay}><Icon name={actionablePlans.length === 1 && actionLabel === "Continuar día" ? "play_arrow" : "add"} />{plannedPlans.length > 0 && !actionablePlans.length ? "Día registrado" : actionLabel}</button></section>
    <div className="training-day-overview"><section className="training-surface training-week-summary"><div className="training-section-heading"><div><h2>Esta semana</h2><span>Sesiones completadas de lunes a domingo</span></div><Icon name="trending_up" /></div><div className="training-week-values"><div><strong>{Number(week.sessionCount || 0)}</strong><span>sesiones</span></div><div><strong>{formatDuration(week.totalMinutes)}</strong><span>entrenado</span></div><div><strong>{Number(week.totalSets || 0)}</strong><span>series</span></div></div></section><section className="training-surface training-recent-surface"><div className="training-section-heading"><div><h2>Última sesión</h2><span>Tu registro completado más reciente</span></div><Icon name="history" /></div>{recent ? <TrainingSessionLine session={recent} /> : <div className="training-empty-inline"><Icon name="today" /><span>Aún no registraste sesiones.</span></div>}</section></div>
    {plannedPlans.length > 0 && <section className="training-surface training-planned-surface"><div className="training-section-heading"><div><h2>Detalle de hoy</h2><span>La estructura que podés seguir o ajustar durante la sesión</span></div><Icon name="event_available" /></div><div className="training-planned-list">{plannedPlans.map((schedule) => { const plan = planDetails.get(String(schedule.planId)); const day = plan?.days?.find((item) => String(item.id) === String(schedule.planDayId)); const dynamic = plan?.frequencyMode === "DYNAMIC"; const currentStatus = schedule.sessionStatus ? sessionStatus(schedule.sessionStatus) : null; const finished = ["COMPLETED", "SKIPPED"].includes(currentStatus); return <article className="training-planned-card" key={`${schedule.planId}-${schedule.planDayId}`}><div><strong>{day?.name || schedule.planDayName}</strong><span>{day?.exercises?.length || 0} ejercicios · {dynamic ? "plan dinámico" : "día fijo"}</span>{day?.exercises?.length > 0 && <small>{day.exercises.map((exercise) => exercise.exerciseName || exercise.name).join(" · ")}</small>}</div><div className="training-planned-actions">{finished ? <span className={`training-status-inline training-status-inline-${String(currentStatus).toLowerCase()}`}>{sessionStatusLabel(currentStatus)}</span> : <button type="button" className="training-secondary" disabled={!day || Boolean(starting)} onClick={() => startPlan(schedule)}><Icon name="play_arrow" />{currentStatus === "IN_PROGRESS" ? "Continuar" : "Abrir día"}</button>}{dynamic && schedule.recommended && !finished && <button type="button" className="training-text-button" onClick={() => skip(schedule)}>Omitir</button>}</div></article>; })}</div></section>}
  </>}{editor?.type === "GYM" && <GymSessionEditor api={api} session={editor} plans={[]} exercises={exercises} onClose={() => setEditor(null)} onSaved={resource.reload} />}{editor?.type === "CALISTHENICS" && <CalisthenicsSessionEditor api={api} session={editor} plans={[]} exercises={exercises} onClose={() => setEditor(null)} onSaved={resource.reload} />}{modulePickerOpen && <ModulePicker onClose={() => setModulePickerOpen(false)} onSelect={startFree} />}{planPickerOpen && <PlanPicker schedules={actionablePlans} planDetails={planDetails} onClose={() => setPlanPickerOpen(false)} onSelect={startPlan} />}</section>;
}
