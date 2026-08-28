import React, { useCallback, useMemo, useState } from "react";
import { Icon } from "../../components/Icon";
import { Header } from "../../components/Layout";
import { CalisthenicsSessionEditor } from "./CalisthenicsSessionEditor";
import { GymSessionEditor } from "./GymSessionEditor";
import { TrainingModuleBadge, TrainingSessionLine, TrainingStatus } from "./TrainingComponents";
import { trainingApi } from "./training-api";
import { dateKey, formatDuration, normalizeSession, sessionStatus, sessionStatusLabel } from "./training-utils";
import { useTrainingData } from "./useTrainingData";

export function TrainingDashboard({ api, setPage }) {
  const [editor, setEditor] = useState(null);
  const [starting, setStarting] = useState("");
  const load = useCallback(async () => {
    const dashboard = await trainingApi.dashboard(api, dateKey());
    const ids = [...new Set((dashboard.plannedPlans || []).map((item) => item.planId).filter(Boolean))];
    const details = await Promise.all(ids.map(async (id) => { try { return await trainingApi.plan(api, id); } catch { return null; } }));
    return { dashboard, planDetails: details.filter(Boolean) };
  }, [api]);
  const resource = useTrainingData(load, [load]);
  const dashboard = resource.data?.dashboard || {};
  const planDetails = useMemo(() => new Map((resource.data?.planDetails || []).map((plan) => [String(plan.id), plan])), [resource.data]);
  const plans = dashboard.plans || [];
  const exercises = dashboard.exercises || [];
  const plannedPlans = dashboard.plannedPlans || [];
  const recent = dashboard.recentSession ? normalizeSession(dashboard.recentSession) : null;
  const week = dashboard.weeklySummary || {};

  async function startFree(type) {
    if (starting) return;
    setStarting(`free-${type}`);
    try {
      const created = await trainingApi.createSession(api, { date: dashboard.date || dateKey(), module: type });
      setEditor(normalizeSession({ ...created, module: type, date: created?.date || dashboard.date || dateKey() }));
    } catch (error) { api.notify(error?.message || "No se pudo iniciar la sesión.", "error"); }
    finally { setStarting(""); }
  }
  async function startPlan(schedule) {
    const plan = planDetails.get(String(schedule.planId));
    const day = plan?.days?.find((item) => String(item.id) === String(schedule.planDayId));
    if (!plan || !day) return;
    if (["COMPLETED", "SKIPPED"].includes(sessionStatus(schedule.sessionStatus))) return;
    if (starting) return;
    setStarting(`${schedule.planId}-${schedule.planDayId}`);
    try {
      const existing = schedule.sessionStatus === "IN_PROGRESS" && schedule.sessionId ? await trainingApi.session(api, schedule.sessionId) : null;
      const created = existing || await trainingApi.createSession(api, { date: dashboard.date || dateKey(), module: schedule.module, planId: Number(schedule.planId), planDayId: Number(schedule.planDayId) });
      setEditor(normalizeSession({ ...created, module: schedule.module, date: created?.date || dashboard.date || dateKey(), planId: created?.planId || schedule.planId, planDayId: created?.planDayId || schedule.planDayId, planName: created?.planName || plan.name, planDayName: created?.planDayName || day.name }));
    } catch (error) { api.notify(error?.message || "No se pudo iniciar el día.", "error"); }
    finally { setStarting(""); }
  }
  async function skip(schedule) {
    const plan = planDetails.get(String(schedule.planId));
    const day = plan?.days?.find((item) => String(item.id) === String(schedule.planDayId));
    if (!plan || plan.frequencyMode !== "DYNAMIC") return;
    const confirmed = await api.confirm({ title: `¿Omitir ${day?.name || "esta sesión"}?`, description: "Se registrará como omitida y el plan dinámico avanzará al siguiente día.", confirmLabel: "Omitir sesión", tone: "neutral" });
    if (!confirmed) return;
    try { await api.runAction({ title: "Omitiendo sesión", description: "Estamos avanzando tu plan dinámico..." }, () => trainingApi.skipPlan(api, schedule.planId, { date: dashboard.date, planDayId: schedule.planDayId, notes: null }), { quiet: true }); api.notify("Sesión omitida."); resource.reload(); } catch (error) { api.notify(error?.message || "No se pudo omitir la sesión.", "error"); }
  }
  return <section className="page training-page training-dashboard-page"><Header title="Día" /><p className="training-page-intro">Tu plan indica el siguiente paso. También podés registrar una sesión libre cuando lo necesites.</p><TrainingStatus loading={resource.loading} error={resource.error} onRetry={resource.reload} />{!resource.loading && !resource.error && <>
     {plannedPlans.length > 0 && <section className="training-surface training-planned-surface"><div className="training-section-heading"><div><h2>Para hoy</h2><span>El día recomendado por tus planes activos</span></div><Icon name="event_available" /></div><div className="training-planned-list">{plannedPlans.map((schedule) => { const plan = planDetails.get(String(schedule.planId)); const day = plan?.days?.find((item) => String(item.id) === String(schedule.planDayId)); const dynamic = plan?.frequencyMode === "DYNAMIC"; const currentStatus = schedule.sessionStatus ? sessionStatus(schedule.sessionStatus) : null; const finished = currentStatus === "COMPLETED"; return <article className="training-planned-card" key={`${schedule.planId}-${schedule.planDayId}`}><div><TrainingModuleBadge module={schedule.module} /><strong>{day?.name || schedule.planDayName}</strong><span>{plan?.name || "Plan de entrenamiento"} · {dynamic ? "siguiente día dinámico" : "día fijo"}</span>{currentStatus && <small className={`training-status-inline training-status-inline-${currentStatus.toLowerCase()}`}>{sessionStatusLabel(currentStatus)}</small>}{day?.exercises?.length > 0 && <small>{day.exercises.map((exercise) => exercise.exerciseName || exercise.name).join(" · ")}</small>}</div><div className="training-planned-actions">{finished ? <span className="training-status-inline training-status-inline-completed">Finalizado</span> : <button type="button" className="training-primary" disabled={!day || Boolean(starting)} onClick={() => startPlan(schedule)}><Icon name="play_arrow" />{currentStatus === "IN_PROGRESS" ? "Continuar" : "Iniciar día"}</button>}{dynamic && schedule.recommended && !finished && <button type="button" className="training-text-button" onClick={() => skip(schedule)}>Omitir</button>}</div></article>; })}</div></section>}
     <div className="training-start-grid"><article className="training-start-card training-gym-start-card"><div><TrainingModuleBadge module="GYM" /><h2>Gimnasio</h2><p>Series, repeticiones, carga y notas en una bitácora compacta.</p></div><button type="button" className="training-primary" disabled={Boolean(starting)} onClick={() => startFree("GYM")}><Icon name="add" />Iniciar gimnasio</button></article><article className="training-start-card training-calisthenics-start-card"><div><TrainingModuleBadge module="CALISTHENICS" /><h2>Calistenia</h2><p>Registrá volumen y control corporal, sin campos de peso externo.</p></div><button type="button" className="training-secondary" disabled={Boolean(starting)} onClick={() => startFree("CALISTHENICS")}><Icon name="add" />Iniciar calistenia</button></article></div>
    <div className="training-dashboard-grid"><section className="training-surface training-week-summary"><div className="training-section-heading"><h2>Esta semana</h2><span>Resumen real</span></div><div className="training-week-values"><div><strong>{Number(week.sessionCount || 0)}</strong><span>sesiones</span></div><div><strong>{formatDuration(week.totalMinutes)}</strong><span>entrenado</span></div><div><strong>{Number(week.totalSets || 0)}</strong><span>series</span></div></div></section><section className="training-surface training-recent-surface"><div className="training-section-heading"><h2>Última sesión</h2></div>{recent ? <TrainingSessionLine session={recent} /> : <div className="training-empty-inline"><Icon name="today" /><span>Aún no registraste sesiones.</span></div>}</section></div>
    <section className="training-surface training-routines-surface"><div className="training-section-heading"><div><h2>Planes guardados</h2><span>Una estructura lista para volver a usar</span></div><button type="button" className="training-text-button" onClick={() => setPage("profile")}>Gestionar planes</button></div>{plans.length ? <div className="training-routine-list">{plans.map((plan) => <article key={plan.id} className="training-routine-preview"><div><TrainingModuleBadge module={plan.module} /><strong>{plan.name}</strong><span>{plan.targetSessionsPerWeek} sesiones/semana · {plan.frequencyMode === "FIXED" ? "días fijos" : "dinámico"}</span></div><button type="button" className="training-secondary" onClick={() => setPage("profile")}><Icon name="edit" />Ver plan</button></article>)}</div> : <TrainingStatus empty={{ title: "Todavía no hay planes", description: "Creá uno en tu Perfil de entrenamiento o registrá una sesión libre." }} action={<button type="button" className="training-secondary" onClick={() => setPage("profile")}>Crear plan</button>} />}</section>
  </>}{editor?.type === "GYM" && <GymSessionEditor api={api} session={editor} plans={plans} exercises={exercises} onClose={() => setEditor(null)} onSaved={resource.reload} />}{editor?.type === "CALISTHENICS" && <CalisthenicsSessionEditor api={api} session={editor} plans={plans} exercises={exercises} onClose={() => setEditor(null)} onSaved={resource.reload} />}</section>;
}
