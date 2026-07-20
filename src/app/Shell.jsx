import React, { useEffect, useState } from "react";
import { APP_NAME, navItems } from "../config/app";
import { Icon } from "../components/Icon";
import { request } from "../services/http";

function VersionBadge({ backendHash, loading }) {
  const frontendHash = typeof __GIT_HASH__ !== "undefined" ? __GIT_HASH__ : null;
  const buildTime = typeof __BUILD_TIME__ !== "undefined" ? __BUILD_TIME__ : null;
  const isLatest = !loading && frontendHash && backendHash && frontendHash === backendHash;
  return <small className={`version-badge ${isLatest ? "latest" : ""}`}>{buildTime ? new Date(buildTime).toLocaleString("es-AR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "—"} {frontendHash && <>· {frontendHash}</>}{!loading && (isLatest ? <span className="version-ok"> ✓ Última versión</span> : frontendHash ? <span className="version-old"> · desactualizado</span> : null)}</small>;
}

export function Shell({ children, user, page, setPage, logout }) {
  const [backendHash, setBackendHash] = useState(null);
  const [versionLoading, setVersionLoading] = useState(true);
  const items = user?.role === "ADMIN" ? navItems : navItems.filter((item) => item.id !== "create");
  useEffect(() => {
    let active = true;
    const load = () => request("/api/version")
      .then((data) => active && setBackendHash(data?.gitHash || null))
      .catch(() => active && setBackendHash(null))
      .finally(() => active && setVersionLoading(false));
    const schedule = window.requestIdleCallback || ((callback) => window.setTimeout(callback, 1500));
    const cancel = window.cancelIdleCallback || window.clearTimeout;
    const handle = schedule(load);
    return () => {
      active = false;
      cancel(handle);
    };
  }, []);
  const navigation = (mobile = false) => items.map((item) => <button key={item.id} className={page === item.id ? "active" : ""} aria-current={page === item.id ? "page" : undefined} onClick={() => setPage(item.id)}><Icon name={item.icon} />{mobile ? item.mobileLabel || item.label : item.label}</button>);
  return <div className="app-shell"><aside className="sidebar"><div className="brand"><Icon name="vital_signs" className="fill" /><div><strong>{APP_NAME}</strong><span>{user?.fullName || "Plan diario"}</span></div></div><nav>{navigation()}</nav><button className="ghost" onClick={logout}><Icon name="logout" />Salir</button><VersionBadge backendHash={backendHash} loading={versionLoading} /></aside><main className="content" key={page}>{children}</main><div className="mobile-version"><VersionBadge backendHash={backendHash} loading={versionLoading} /></div><nav className="mobile-nav" aria-label="Navegacion principal">{navigation(true)}</nav></div>;
}
