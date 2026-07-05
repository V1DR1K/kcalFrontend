import React from "react";
import { APP_NAME, navItems } from "../config/app";

export function Shell({ children, user, page, setPage, logout }) {
  const items = user?.role === "ADMIN" ? navItems : navItems.filter((item) => item.id !== "create");
  const navigation = items.map((item) => <button key={item.id} className={page === item.id ? "active" : ""} aria-current={page === item.id ? "page" : undefined} onClick={() => setPage(item.id)}><span className="material-symbols-outlined">{item.icon}</span>{item.label}</button>);
  return <div className="app-shell"><aside className="sidebar"><div className="brand"><span className="material-symbols-outlined fill">vital_signs</span><div><strong>{APP_NAME}</strong><span>{user?.fullName || "Plan diario"}</span></div></div><nav>{navigation}</nav><button className="ghost" onClick={logout}><span className="material-symbols-outlined">logout</span>Salir</button></aside><main className="content">{children}</main><nav className="mobile-nav" aria-label="Navegacion principal">{navigation}</nav></div>;
}
