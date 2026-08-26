import React from "react";
import { Icon } from "../../components/Icon";
import { formatDuration, moduleLabel } from "./training-utils";

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
  const content = <><TrainingModuleBadge module={session.type} /><strong>{session.title || session.planName || "Sesión libre"}</strong><span>{session.exercises.length} ejercicios · {formatDuration(session.durationMinutes)}</span></>;
  return onClick ? <button type="button" className="training-session-line" onClick={onClick}>{content}<Icon name="chevron_right" /></button> : <div className="training-session-line">{content}</div>;
}
