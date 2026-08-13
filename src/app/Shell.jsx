import React from "react";
import { APP_NAME, navItems } from "../config/app";
import { Icon } from "../components/Icon";

export function Shell({ children, user, page, setPage, logout }) {
  const items = navItems.filter((item) => item.id !== "foods");
  const navigation = (mobile = false) => items.map((item) => <button key={item.id} className={page === item.id ? "active" : ""} aria-current={page === item.id ? "page" : undefined} onClick={() => setPage(item.id)}><Icon name={item.icon} />{mobile ? item.mobileLabel || item.label : item.label}</button>);
  return <div className="app-shell"><aside className="sidebar"><div className="brand"><Icon name="vital_signs" className="fill" /><div><strong>{APP_NAME}</strong><span>{user?.fullName || "Plan diario"}</span></div></div><nav>{navigation()}</nav><button className="ghost" onClick={logout}><Icon name="logout" />Salir</button></aside><main className="content" key={page}>{children}</main><nav className="mobile-nav" aria-label="Navegación principal">{navigation(true)}</nav></div>;
}
