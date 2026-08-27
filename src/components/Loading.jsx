import React from "react";

export function SkeletonBlock({ className = "" }) {
  return <span className={`skeleton ${className}`.trim()} aria-hidden="true" />;
}

export function SkeletonRows({ count = 3, className = "", label = "Cargando contenido" }) {
  return <div className={`skeleton-loading ${className}`.trim()} role="status" aria-busy="true" aria-label={label}>{Array.from({ length: count }, (_, index) => <SkeletonBlock key={index} className="skeleton-row" />)}</div>;
}

export function DashboardSkeleton() {
  return <div className="dashboard-skeleton" role="status" aria-busy="true" aria-label="Cargando tu día"><div className="dashboard-skeleton-hero"><SkeletonBlock className="skeleton-ring" /><SkeletonBlock className="skeleton-copy" /><div className="skeleton-strip"><SkeletonBlock className="skeleton-macro" /><SkeletonBlock className="skeleton-macro" /><SkeletonBlock className="skeleton-macro" /></div></div><SkeletonBlock className="skeleton-meal-card" /><SkeletonBlock className="skeleton-meal-card" /><SkeletonBlock className="skeleton-meal-card" /><SkeletonBlock className="skeleton-meal-card" /><SkeletonBlock className="skeleton-panel" /></div>;
}
