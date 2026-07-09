import React from "react";
import { APP_NAME } from "../config/app";
import { formatNumber } from "../utils/format";

export function Header({ title, eyebrow, action, compact = false }) {
  const commitTime = typeof __COMMIT_TIME__ !== "undefined" ? new Date(__COMMIT_TIME__) : null;
  const versionLabel =
    commitTime && !Number.isNaN(commitTime.getTime())
      ? new Intl.DateTimeFormat("es-AR", {
          hour: "2-digit",
          minute: "2-digit",
          day: "2-digit",
          month: "2-digit",
          year: "numeric",
          hour12: false,
        })
          .format(commitTime)
          .replace(",", " ·")
      : "Desarrollo";
  return (
    <header className={`page-header ${compact ? "dashboard-page-header" : ""}`}>
      <div>
        <span>{eyebrow || APP_NAME}</span>
        <h1>{title}</h1>
        <small className="header-build" title="Fecha y hora del commit instalado">
          <span className="material-symbols-outlined">verified</span>
          {versionLabel}
        </small>
      </div>
      {action}
    </header>
  );
}
export function Panel({ title, children, className = "" }) {
  return (
    <section className={`panel ${className}`}>
      {title && <h2>{title}</h2>}
      {children}
    </section>
  );
}
export function Macro({ macro }) {
  const percent = macro.goal ? Math.min(100, Math.round((macro.consumed / macro.goal) * 100)) : 0;
  return (
    <section className="macro-card">
      <h3>{macro.label}</h3>
      <p className="big"><strong>{formatNumber(macro.consumed)}</strong><span> / {formatNumber(macro.goal)}g</span></p>
      <div className="bar">
        <span style={{ width: `${percent}%` }} />
      </div>
    </section>
  );
}
export function Stat({ icon, label, value }) {
  return (
    <div className="stat">
      <span className="material-symbols-outlined">{icon}</span>
      <small>{label}</small>
      <strong>{value}</strong>
    </div>
  );
}
export function Toast({ message, tone }) {
  return (
    <div className={`toast ${tone}`} role={tone === "error" ? "alert" : "status"}>
      {message}
    </div>
  );
}
