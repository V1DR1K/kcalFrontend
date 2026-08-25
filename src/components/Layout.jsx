import React from "react";
import { Icon } from "./Icon";
import { formatNumber } from "../utils/format";

export function Header({ title, action, compact = false, className = "" }) {
  return (
    <header className={`page-header ${compact ? "dashboard-page-header" : ""} ${className}`.trim()}>
      {title && <div><h1>{title}</h1></div>}
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
  const tone = String(macro.key || macro.label || "").toLowerCase();
  return (
    <section className={`macro-card macro-${tone}`}>
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
      <Icon name={icon} />
      <small>{label}</small>
      <strong>{value}</strong>
    </div>
  );
}
