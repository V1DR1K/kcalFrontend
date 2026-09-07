import React from "react";
import { Icon } from "../../components/Icon";
import { formatCardioDistance, formatCardioSteps } from "./cardio-utils";
import { formatDuration, formatTrainingDate, moduleLabel, sessionStatusLabel } from "./training-utils";

export function TrainingStatus({ loading, error, onRetry, empty, action }) {
  if (loading) return <div className="training-loading" aria-busy="true" aria-label="Cargando entrenamiento"><span /><span /><span /></div>;
  if (error) return <section className="training-status" role="alert"><Icon name="error" /><div><strong>No se pudo cargar entrenamiento</strong><p>{error}</p></div>{onRetry && <button type="button" className="training-secondary" onClick={onRetry}>Reintentar</button>}</section>;
  if (empty) return <section className="training-status"><Icon name="fitness_center" /><div><strong>{empty.title}</strong><p>{empty.description}</p></div>{action}</section>;
  return null;
}

export function TrainingModuleBadge({ module }) {
  return <span className="training-module-badge"><Icon name={module === "CALISTHENICS" ? "monitoring" : "fitness_center"} />{moduleLabel(module)}</span>;
}

export function TrainingSessionLine({ session, onClick }) {
  const content = <><TrainingModuleBadge module={session.module || session.type} /><strong>{session.title || session.planName || "Sesión libre"}</strong><span>{formatTrainingDate(session.date)} · {sessionStatusLabel(session.status)} · {formatDuration(session.durationMinutes)}</span></>;
  return onClick ? <button type="button" className="training-session-line" onClick={onClick}>{content}<Icon name="chevron_right" /></button> : <div className="training-session-line">{content}</div>;
}

function cardioDayLabel(value) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("es-AR", { weekday: "short" }).format(new Date(`${value}T00:00:00`)).replace(".", "");
}

export function CardioWeekSummary({ summary, embedded = false, today }) {
  const days = summary?.days || [];
  if (!days.length) return null;
  const available = summary.stepsAvailable !== false;
  const values = days.map((day) => Number(day.estimatedSteps || 0));
  const max = Math.max(...values, 1);
  return <section className={`training-cardio-week-summary ${embedded ? "is-embedded" : ""}`.trim()}>
    <div className="training-section-heading"><div><h2>Pasos de caminadora</h2><span>Estimados · lunes a domingo</span></div><Icon name="directions_run" /></div>
    <div className="training-cardio-week-total"><strong>{available && summary.totalEstimatedSteps !== null && summary.totalEstimatedSteps !== undefined ? formatCardioSteps(summary.totalEstimatedSteps) : "—"}</strong><span>pasos esta semana</span><small>{formatCardioDistance(summary.totalDistanceKm)}</small></div>
    <div className="training-cardio-week-chart" role="list" aria-label="Pasos estimados por día">
      {days.map((day) => {
        const steps = Number(day.estimatedSteps || 0);
        const active = today && day.date === today;
        return <div className={`training-cardio-week-day ${active ? "is-today" : ""}`.trim()} role="listitem" key={day.date} aria-label={`${cardioDayLabel(day.date)}: ${available && day.estimatedSteps !== null && day.estimatedSteps !== undefined ? `${formatCardioSteps(day.estimatedSteps)} pasos estimados` : "pasos no disponibles"}`}><div className="training-cardio-week-bar"><span style={{ height: `${steps ? Math.max(12, Math.round((steps / max) * 100)) : 4}%` }} /></div><b>{cardioDayLabel(day.date)}</b><small>{available && day.estimatedSteps !== null && day.estimatedSteps !== undefined ? formatCardioSteps(day.estimatedSteps) : "—"}</small></div>;
      })}
    </div>
    {!available && <p className="training-cardio-week-note">Completá tu altura en Perfil para estimar pasos.</p>}
  </section>;
}
