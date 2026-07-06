import React, { useEffect, useState } from "react";
import { APP_NAME, navItems } from "../config/app";
import { request } from "../services/http";

function VersionBadge() {
  const [backendHash, setBackendHash] = useState(null);
  const [loading, setLoading] = useState(true);
  const frontendHash = typeof __GIT_HASH__ !== "undefined" ? __GIT_HASH__ : null;
  const buildTime = typeof __BUILD_TIME__ !== "undefined" ? __BUILD_TIME__ : null;
  useEffect(() => {
    request("/api/version").then((data) => setBackendHash(data?.gitHash || null)).catch(() => setBackendHash(null)).finally(() => setLoading(false));
  }, []);
  const isLatest = !loading && frontendHash && backendHash && frontendHash === backendHash;
  return <small className={`version-badge ${isLatest ? "latest" : ""}`}>{buildTime ? new Date(buildTime).toLocaleString("es-AR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "—"} {frontendHash && <>· {frontendHash}</>}{!loading && (isLatest ? <span className="version-ok"> ✓ Última versión</span> : frontendHash ? <span className="version-old"> · desactualizado</span> : null)}</small>;
}

export function Shell({ children, user, page, setPage, logout }) {
  const items = user?.role === "ADMIN" ? navItems : navItems.filter((item) => item.id !== "create");
  const navigation = (mobile = false) => items.map((item) => <button key={item.id} className={page === item.id ? "active" : ""} aria-current={page === item.id ? "page" : undefined} onClick={() => setPage(item.id)}><span className="material-symbols-outlined">{item.icon}</span>{mobile ? item.mobileLabel || item.label : item.label}</button>);
  return <div className="app-shell"><aside className="sidebar"><div className="brand"><span className="material-symbols-outlined fill">vital_signs</span><div><strong>{APP_NAME}</strong><span>{user?.fullName || "Plan diario"}</span></div></div><nav>{navigation()}</nav><button className="ghost" onClick={logout}><span className="material-symbols-outlined">logout</span>Salir</button><VersionBadge /></aside><main className="content" key={page}>{children}</main><nav className="mobile-nav" aria-label="Navegacion principal">{navigation(true)}</nav></div>;
}
