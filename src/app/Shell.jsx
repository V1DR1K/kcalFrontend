import React, { useState } from "react";
import { APP_NAME, isNavItemActive, navItems, trainingNavItems } from "../config/app";
import { Icon } from "../components/Icon";
import { ModalShell } from "../components/dialog/ModalShell";

function MobileNavigation({ mode, page, setPage, setMode }) {
  const [expanded, setExpanded] = useState(false);
  const items = mode === "training" ? trainingNavItems : navItems;
  const mainIds = mode === "training"
    ? ["training-dashboard", "training-calendar", "training-cardio", "nutrition"]
    : ["dashboard", "plans", "day-presets", "scanner"];
  const primary = mainIds.map(id => items.find(item => item.id === id));
  const secondary = items.filter(item => !mainIds.includes(item.id));
  const select = (item) => { setExpanded(false); item.mode ? setMode(item.mode) : setPage(item.id); };
  const active = (item) => !item.mode && isNavItemActive(item, page);
  return <>
    <div className="mobile-primary-items">
      {primary.map(item => <button type="button" key={item.id} className={active(item) ? "active" : ""} aria-current={active(item) ? "page" : undefined} onClick={() => select(item)}><Icon name={item.icon} />{item.mobileLabel || item.label}</button>)}
      <button type="button" className={secondary.some(active) ? "active" : ""} aria-label="Más opciones" aria-haspopup="dialog" aria-expanded={expanded} onClick={() => setExpanded(true)}><Icon name="more_vert" />Más</button>
    </div>
    {expanded && <ModalShell title={mode === "training" ? "Tu entrenamiento" : "Tu nutrición"} theme={mode} className="mobile-navigation-dialog app-modal-compact" onClose={() => setExpanded(false)}>
      <div className="mobile-secondary-items">{secondary.map(item => <button type="button" key={item.id} aria-current={active(item) ? "page" : undefined} onClick={() => select(item)}><Icon name={item.icon} /><span>{item.label}</span><Icon name="chevron_right" /></button>)}</div>
    </ModalShell>}
  </>;
}

function NavigationGroup({ mode, items, activeMode, page, mobile, setPage, setMode }) {
  const active = activeMode === mode;
  return (
    <div className={`training-nav-group training-${mode}-nav-group`.trim()} aria-hidden={!active} inert={active ? undefined : true}>
      <div className="training-nav-group-content">
        <div className="training-nav-items">
          {items.map((item) => {
            const itemActive = !item.mode && isNavItemActive(item, page);
            const label = mobile ? item.mobileLabel || item.label : item.label;
            return <button type="button" key={item.id} className={itemActive ? "active" : ""} aria-current={itemActive ? "page" : undefined} onClick={() => item.mode ? setMode(item.mode) : setPage(item.id)}><Icon name={item.icon} />{label}</button>;
          })}
        </div>
      </div>
    </div>
  );
}

function ModeNavigation({ activeMode, page, mobile = false, setPage, setMode }) {
  return <><NavigationGroup mode="nutrition" items={navItems} activeMode={activeMode} page={page} mobile={mobile} setPage={setPage} setMode={setMode} /><NavigationGroup mode="training" items={trainingNavItems} activeMode={activeMode} page={page} mobile={mobile} setPage={setPage} setMode={setMode} /></>;
}

export function Shell({ children, page, mode, setPage, setMode, logout }) {
  const training = mode === "training";
  return <div className={`app-shell ${training ? "training-shell" : ""}`.trim()} data-app-mode={mode} data-nav-mode={mode}><aside className="sidebar"><div className="brand"><Icon name={training ? "training_section" : "nutrition_section"} className="fill" /><div><strong>{APP_NAME}</strong><span>{training ? "Entrenamiento" : "Bitácora diaria"}</span></div></div><nav aria-label={training ? "Navegación de entrenamiento" : "Navegación principal"}><ModeNavigation activeMode={mode} page={page} setPage={setPage} setMode={setMode} /></nav><button className="ghost" onClick={logout}><Icon name="logout" />Salir</button></aside><main className="content" data-app-scroll-root="true" key={`${mode}-${page}`}>{children}</main><nav className={`mobile-nav ${training ? "training-mobile-nav" : ""}`.trim()} aria-label={training ? "Navegación de entrenamiento" : "Navegación principal"}><MobileNavigation key={mode} mode={mode} page={page} setPage={setPage} setMode={setMode} /></nav></div>;
}
