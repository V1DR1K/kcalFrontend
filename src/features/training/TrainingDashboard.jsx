import React, { useCallback, useMemo, useState } from "react";
import { Icon } from "../../components/Icon";
import { Header } from "../../components/Layout";
import { ModalShell } from "../../components/dialog/ModalShell";
import { CalisthenicsSessionEditor } from "./CalisthenicsSessionEditor";
import { GymSessionEditor } from "./GymSessionEditor";
import { CardioWeekSummary, TrainingModuleBadge, TrainingSessionLine, TrainingStatus } from "./TrainingComponents";
import { trainingApi } from "./training-api";
import { dateKey, formatDuration, normalizeSession, sessionStatus, sessionStatusLabel } from "./training-utils";
import { localTimeZone } from "./cardio-utils";
import { useTrainingData } from "./useTrainingData";

const modules = [
  { value: "GYM", label: "Gimnasio", icon: "fitness_center", description: "Series, repeticiones y carga." },
  { value: "CALISTHENICS", label: "Calistenia", icon: "monitoring", description: "Volumen y control corporal." },
];

function ModulePicker({ onClose, onSelect }) {
  return <ModalShell title="¿Qué vas a registrar?" description="Elegí el módulo para abrir tu sesión libre de hoy." onClose={onClose} theme="training" className="training-module-picker" backdropClassName="training-session-backdrop">
    <div className="training-module-choice-list">{modules.map((module) => <button type="button" className="training-module-choice" key={module.value} onClick={() => onSelect(module.value)}><span className="training-module-choice-icon"><Icon name={module.icon} /></span><span><strong>{module.label}</strong><small>{module.description}</small></span><Icon name="chevron_right" /></button>)}</div>
  </ModalShell>;
}

function PlanPicker({ schedules, planDetails, onClose, onSelect }) {
  return <ModalShell title="Elegí tu sesión" description="Hay más de una sesión disponible para hoy." onClose={onClose} theme="training" className="training-module-picker" backdropClassName="training-session-backdrop">
    <div className="training-module-choice-list">{schedules.map((schedule) => { const plan = planDetails.get(String(schedule.planId)); const day = plan?.days?.find((item) => String(item.id) === String(schedule.planDayId)); const status = schedule.sessionStatus ? sessionStatus(schedule.sessionStatus) : null; return <button type="button" className="training-module-choice" key={`${schedule.planId}-${schedule.planDayId}`} onClick={() => onSelect(schedule)}><span className="training-module-choice-icon"><Icon name={schedule.module === "CALISTHENICS" ? "monitoring" : "fitness_center"} /></span><span><TrainingModuleBadge module={schedule.module} /><strong>{day?.name || schedule.planDayName}</strong><small>{plan?.name || "Plan de entrenamiento"}{status ? ` · ${sessionStatusLabel(status)}` : ""}</small></span><Icon name="chevron_right" /></button>; })}</div>
  </ModalShell>;
}

function scheduleLabel(schedule, planDetails) {
  const plan = planDetails.get(String(schedule.planId));
  const day = plan?.days?.find((item) => String(item.id) === String(schedule.planDayId));
  return { plan, day, name: day?.name || schedule.planDayName || "Sesión de hoy" };
}

export function TrainingDashboard({ api, setPage }) {
  const [editor, setEditor] = useState(null);
  const [starting, setStarting] = useState("");
  const [modulePickerOpen, setModulePickerOpen] = useState(false);
  const [planPickerOpen, setPlanPickerOpen] = useState(false);
  const load = useCallback(async () => {
    const dashboard = await trainingApi.dashboard(api, dateKey(), localTimeZone());
    const ids = [...new Set((dashboard.plannedPlans || []).map((item) => item.planId).filter(Boolean))];
    const details = await Promise.all(ids.map(async (id) => { try { return await trainingApi.plan(api, id); } catch { return null; } }));
    return { dashboard, planDetails: details.filter(Boolean) };
  }, [api]);
  const resource = useTrainingData(load, [load]);
  const dashboard = resource.data?.dashboard || {};
  const planDetails = useMemo(() => new Map((resource.data?.planDetails || []).map((plan) => [String(plan.id), plan])), [resource.data]);
  const exercises = dashboard.exercises || [];
  const plannedPlans = dashboard.plannedPlans || [];
  const availablePlans = dashboard.plans || [];
  const hasActivePlan = availablePlans.some((plan) => plan.active !== false);
  const recent = dashboard.recentSession ? normalizeSession(dashboard.recentSession) : null;
  const week = dashboard.weeklySummary || {};
  const actionablePlans = useMemo(() => plannedPlans.filter((schedule) => !["COMPLETED", "SKIPPED"].includes(sessionStatus(schedule.sessionStatus))), [plannedPlans]);
  const completedToday = plannedPlans.length > 0 && actionablePlans.length === 0;
  const date = dashboard.date || dateKey();
  const dateLabel = new Intl.DateTimeFormat("es-AR", { weekday: "long", day: "numeric", month: "long" }).format(new Date(`${date}T00:00:00`));
  const dateTitle = dateLabel.charAt(0).toUpperCase() + dateLabel.slice(1);
  const primarySchedule = actionablePlans.length === 1 ? actionablePlans[0] : null;
  const primaryScheduleInfo = primarySchedule ? scheduleLabel(primarySchedule, planDetails) : null;

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
      const sessionExercises = created?.exercises?.length ? created.exercises : (day.exercises || []).map((exercise, index) => ({
        id: exercise.id || `plan-exercise-${index}`,
        exerciseId: exercise.exerciseId,
        name: exercise.exerciseName || exercise.name,
        targetSets: exercise.targetSets,
        targetRepetitions: exercise.targetRepetitions,
        targetSeconds: exercise.targetSeconds,
        targetDistanceMeters: exercise.targetDistanceMeters,
        targetWeightKg: exercise.targetWeightKg,
        registrationType: exercise.registrationType,
        sourcePlanExerciseId: exercise.id,
        origin: "PLAN",
        sets: [],
      }));
      setEditor(normalizeSession({ ...created, exercises: sessionExercises, module: schedule.module, date: created?.date || date, planId: created?.planId || schedule.planId, planDayId: created?.planDayId || schedule.planDayId, planName: created?.planName || plan.name, planDayName: created?.planDayName || day.name }));
    } catch (error) { api.notify(error?.message || "No se pudo iniciar la sesión.", "error"); }
    finally { setStarting(""); }
  }

  function openFreeSession() {
    setModulePickerOpen(true);
  }

  function openPlans() {
    setPage?.("plans");
  }

  function startPrimary() {
    if (actionablePlans.length === 1) return startPlan(actionablePlans[0]);
    if (actionablePlans.length > 1) return setPlanPickerOpen(true);
    if (!hasActivePlan) return openPlans();
    return openFreeSession();
  }

  async function skip(schedule) {
    const { plan, day } = scheduleLabel(schedule, planDetails);
    if (!plan || plan.frequencyMode !== "DYNAMIC") return;
    const confirmed = await api.confirm({ title: `¿Omitir ${day?.name || "esta sesión"}?`, description: "Se registrará como omitida y el plan dinámico avanzará al siguiente día.", confirmLabel: "Omitir sesión", tone: "neutral" });
    if (!confirmed) return;
    try { await api.runAction({ title: "Omitiendo sesión", description: "Estamos avanzando tu plan dinámico..." }, () => trainingApi.skipPlan(api, schedule.planId, { date, planDayId: schedule.planDayId, notes: null }), { quiet: true }); api.notify("Sesión omitida."); resource.reload(); } catch (error) { api.notify(error?.message || "No se pudo omitir la sesión.", "error"); }
  }

  const focusTitle = primaryScheduleInfo ? (primarySchedule.sessionStatus === "IN_PROGRESS" ? "Continuá tu sesión" : "Tu sesión de hoy") : completedToday ? "Sesión de hoy completada" : hasActivePlan ? "Hoy no hay sesión planificada" : "Prepará tu próxima sesión";
  const focusDescription = primaryScheduleInfo
    ? `${primaryScheduleInfo.name} · ${primaryScheduleInfo.plan?.name || "Plan de entrenamiento"}`
    : completedToday
      ? "Tu registro quedó guardado. Podés consultar el detalle en Calendario."
      : hasActivePlan
        ? "Tu plan no tiene una sesión para hoy. Si entrenás igual, podés registrarlo como sesión libre."
        : "Todavía no tenés un plan activo. Creá una estructura simple para que cada día te muestre qué sigue.";
  const focusActionLabel = primarySchedule?.sessionStatus === "IN_PROGRESS" ? "Continuar sesión" : primarySchedule ? "Comenzar sesión" : actionablePlans.length > 1 ? "Elegir sesión" : !hasActivePlan ? "Crear plan" : "Registrar sesión libre";
  const focusActionIcon = primarySchedule ? "play_arrow" : !hasActivePlan ? "event_note" : "add";

  return <section className="page training-page training-dashboard-page"><Header title="Día" /><p className="training-page-intro">Registrá lo que hiciste hoy y mantené visible tu ritmo de entrenamiento.</p><TrainingStatus loading={resource.loading} error={resource.error} onRetry={resource.reload} />{!resource.loading && !resource.error && <>
    <section className={`training-day-focus ${completedToday ? "is-completed" : ""}`.trim()} aria-labelledby="training-day-focus-title">
      <div className="training-day-focus-copy">
        <span className="training-day-focus-date">{dateTitle}</span>
        <h2 id="training-day-focus-title">{focusTitle}</h2>
        <p className="training-day-focus-description">{focusDescription}</p>
        {primaryScheduleInfo && <div className="training-day-focus-plan"><TrainingModuleBadge module={primarySchedule.module} /><strong>{primaryScheduleInfo.name}</strong><span>{primaryScheduleInfo.day?.exercises?.length || 0} ejercicios para seguir</span></div>}
        {!primaryScheduleInfo && plannedPlans.length > 1 && <div className="training-day-focus-plan"><span>{actionablePlans.length} sesiones disponibles para hoy</span></div>}
        {completedToday && <span className="training-status-inline training-status-inline-completed"><Icon name="check" />Completada</span>}
      </div>
      <div className="training-day-focus-actions">
        {!completedToday && <button type="button" className="training-primary training-day-focus-action" disabled={Boolean(starting)} onClick={startPrimary}><Icon name={focusActionIcon} />{focusActionLabel}</button>}
        {!completedToday && !primaryScheduleInfo && !hasActivePlan && <button type="button" className="training-secondary training-day-focus-secondary" onClick={openFreeSession} disabled={Boolean(starting)}><Icon name="add" />Sesión libre</button>}
        {completedToday && <button type="button" className="training-secondary training-day-focus-secondary" onClick={openFreeSession} disabled={Boolean(starting)}><Icon name="add" />Registrar otra sesión</button>}
      </div>
    </section>
    <div className="training-day-overview"><section className="training-surface training-week-summary"><div className="training-section-heading"><div><h2>Últimos 7 días</h2><span>Tu ritmo reciente, sin comparaciones</span></div><Icon name="trending_up" /></div><div className="training-week-values"><div><strong>{Number(week.sessionCount || 0)}</strong><span>sesiones</span></div><div><strong>{Number(week.totalMinutes || 0) > 0 ? formatDuration(week.totalMinutes) : "0 min"}</strong><span>entrenado</span></div><div><strong>{Number(week.totalSets || 0)}</strong><span>series</span></div></div>{week.cardio && <CardioWeekSummary summary={week.cardio} embedded today={date} />}</section><section className="training-surface training-recent-surface"><div className="training-section-heading"><div><h2>Última sesión</h2><span>Tu registro completado más reciente</span></div><Icon name="history" /></div>{recent ? <TrainingSessionLine session={recent} /> : <div className="training-empty-inline"><Icon name="today" /><span>Aún no registraste sesiones.</span></div>}</section></div>
    {plannedPlans.length > 1 && <section className="training-surface training-planned-surface training-planned-secondary"><div className="training-section-heading"><div><h2>Otras sesiones de hoy</h2><span>Elegí otra opción solo si la necesitás</span></div><Icon name="event_available" /></div><div className="training-planned-list">{plannedPlans.filter((schedule) => schedule !== primarySchedule).map((schedule) => { const info = scheduleLabel(schedule, planDetails); const currentStatus = schedule.sessionStatus ? sessionStatus(schedule.sessionStatus) : null; const finished = ["COMPLETED", "SKIPPED"].includes(currentStatus); return <article className="training-planned-card" key={`${schedule.planId}-${schedule.planDayId}`}><div><TrainingModuleBadge module={schedule.module} /><strong>{info.name}</strong><span>{info.plan?.name || "Plan de entrenamiento"}{currentStatus ? ` · ${sessionStatusLabel(currentStatus)}` : ""}</span></div><div className="training-planned-actions">{finished ? <span className={`training-status-inline training-status-inline-${String(currentStatus).toLowerCase()}`}>{sessionStatusLabel(currentStatus)}</span> : <button type="button" className="training-secondary" disabled={!info.day || Boolean(starting)} onClick={() => startPlan(schedule)}><Icon name="play_arrow" />{currentStatus === "IN_PROGRESS" ? "Continuar" : "Comenzar"}</button>}{info.plan?.frequencyMode === "DYNAMIC" && schedule.recommended && !finished && <button type="button" className="training-text-button" onClick={() => skip(schedule)}>Omitir</button>}</div></article>; })}</div></section>}
  </>}{editor?.type === "GYM" && <GymSessionEditor api={api} session={editor} plans={[]} exercises={exercises} onClose={() => setEditor(null)} onSaved={resource.reload} />}{editor?.type === "CALISTHENICS" && <CalisthenicsSessionEditor api={api} session={editor} plans={[]} exercises={exercises} onClose={() => setEditor(null)} onSaved={resource.reload} />}{modulePickerOpen && <ModulePicker onClose={() => setModulePickerOpen(false)} onSelect={startFree} />}{planPickerOpen && <PlanPicker schedules={actionablePlans} planDetails={planDetails} onClose={() => setPlanPickerOpen(false)} onSelect={startPlan} />}</section>;
}
