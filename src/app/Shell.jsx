import React from "react";
import { APP_NAME, navItems } from "../config/app";
import { Icon } from "../components/Icon";

export function Shell({ children, user, page, setPage, logout }) {
  const desktopItems = navItems;
  const mobileItems = navItems.filter((item) => item.id !== "foods");
  const navigation = (mobile = false) => (mobile ? mobileItems : desktopItems).map((item) => {
    const active = page === item.id || (item.id === "foods" && page === "configure");
    return <button key={item.id} className={active ? "active" : ""} aria-current={active ? "page" : undefined} onClick={() => setPage(item.id)}><Icon name={item.icon} />{mobile ? item.mobileLabel || item.label : item.label}</button>;
  });
  return <div className="app-shell"><aside className="sidebar"><div className="brand"><Icon name="vital_signs" className="fill" /><div><strong>{APP_NAME}</strong><span>Bitácora diaria</span></div></div><nav aria-label="Navegación principal">{navigation()}</nav><button type="button" className="sidebar-profile" onClick={() => setPage("profile")}><Icon name="account_circle" /><span><strong>{user?.fullName || "Tu perfil"}</strong><small>Ver perfil</small></span><Icon name="chevron_right" /></button><button className="ghost" onClick={logout}><Icon name="logout" />Salir</button></aside><main className="content" key={page}>{children}</main><nav className="mobile-nav" aria-label="Navegación principal">{navigation(true)}</nav></div>;
}
