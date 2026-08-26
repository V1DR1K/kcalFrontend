import React, { useCallback, useState } from "react";
import { Icon } from "../../components/Icon";
import { Header } from "../../components/Layout";
import { CalisthenicsSessionEditor } from "./CalisthenicsSessionEditor";
import { GymSessionEditor } from "./GymSessionEditor";
import { TrainingModuleBadge, TrainingSessionLine, TrainingStatus } from "./TrainingComponents";
import { trainingApi } from "./training-api";
import { dateKey, formatDuration, normalizeSession } from "./training-utils";
import { useTrainingData } from "./useTrainingData";

export function TrainingDashboard({ api, setPage }) {
  const [editor, setEditor] = useState(null);
  const load = useCallback(() => trainingApi.dashboard(api, dateKey()), [api]);
  const resource = useTrainingData(load, [load]);
  const dashboard = resource.data || {};
  const routines = dashboard.routines || dashboard.savedRoutines || [];
  const exercises = dashboard.exercises || [];
  const recent = dashboard.recentSession ? normalizeSession(dashboard.recentSession) : null;
  const week = dashboard.weeklySummary || dashboard.week || {};
  const sessionCount = Number(week.sessions ?? week.sessionCount ?? 0);
  const totalMinutes = Number(week.minutes ?? week.totalMinutes ?? 0);
  const totalSets = Number(week.sets ?? week.totalSets ?? 0);

  return <section className="page training-page training-dashboard-page">
    <Header title="Entrenamiento" action={<button type="button" className="training-secondary training-calendar-link" onClick={() => setPage("training-calendar")}><Icon name="calendar_month" />Calendario</button>} />
    <p className="training-page-intro">Registrá lo que entrenaste y encontrá tu próximo paso sin salir de ScaleGrams.</p>
    <div className="training-start-grid">
      <article className="training-start-card training-gym-start-card"><div><TrainingModuleBadge module="GYM" /><h2>Gimnasio</h2><p>Series, repeticiones, carga y notas en una bitácora compacta.</p></div><button type="button" className="training-primary" onClick={() => setEditor({ type: "GYM" })}><Icon name="add" />Iniciar gimnasio</button></article>
      <article className="training-start-card training-calisthenics-start-card"><div><TrainingModuleBadge module="CALISTHENICS" /><h2>Calistenia</h2><p>Registrá volumen y control corporal, sin campos de peso externo.</p></div><button type="button" className="training-secondary" onClick={() => setEditor({ type: "CALISTHENICS" })}><Icon name="add" />Iniciar calistenia</button></article>
    </div>
    <TrainingStatus loading={resource.loading} error={resource.error} onRetry={resource.reload} />
    {!resource.loading && !resource.error && <>
      <div className="training-dashboard-grid">
        <section className="training-surface training-week-summary"><div className="training-section-heading"><h2>Esta semana</h2><span>{week.label || "Resumen semanal"}</span></div><div className="training-week-values"><div><strong>{sessionCount}</strong><span>sesiones</span></div><div><strong>{formatDuration(totalMinutes)}</strong><span>entrenado</span></div><div><strong>{totalSets}</strong><span>series</span></div></div></section>
        <section className="training-surface training-recent-surface"><div className="training-section-heading"><h2>Última sesión</h2>{recent && <button type="button" className="training-text-button" onClick={() => setPage("training-calendar")}>Ver calendario</button>}</div>{recent ? <TrainingSessionLine session={recent} onClick={() => setPage("training-calendar")} /> : <div className="training-empty-inline"><Icon name="today" /><span>Aún no registraste sesiones. Empezá con una opción arriba.</span></div>}</section>
      </div>
      <section className="training-surface training-routines-surface"><div className="training-section-heading"><div><h2>Rutinas guardadas</h2><span>Elegí una base para tu próxima sesión</span></div><button type="button" className="training-text-button" onClick={() => setPage("training-profile")}>Gestionar</button></div>{routines.length ? <div className="training-routine-list">{routines.slice(0, 4).map((routine) => <article key={routine.id || routine.name} className="training-routine-preview"><div><TrainingModuleBadge module={routine.module || routine.type || "GYM"} /><strong>{routine.name}</strong><span>{routine.days?.length || routine.dayCount || 0} días · {routine.exercises?.length || routine.exerciseCount || 0} ejercicios</span></div><button type="button" className="training-secondary" onClick={() => setEditor({ type: routine.module || routine.type || "GYM", routineId: routine.id, routineName: routine.name })}><Icon name="add" />Usar</button></article>)}</div> : <TrainingStatus empty={{ title: "Todavía no hay rutinas", description: "Podés crear una en tu perfil de entrenamiento o registrar una sesión libre." }} action={<button type="button" className="training-secondary" onClick={() => setPage("training-profile")}>Crear rutina</button>} />}</section>
    </>}
    {editor?.type === "GYM" && <GymSessionEditor api={api} session={editor} routines={routines} exercises={exercises} onClose={() => setEditor(null)} onSaved={resource.reload} />}
    {editor?.type === "CALISTHENICS" && <CalisthenicsSessionEditor api={api} session={editor} routines={routines} exercises={exercises} onClose={() => setEditor(null)} onSaved={resource.reload} />}
  </section>;
}
