import React from "react";
import { APP_NAME, isNavItemActive, navItems, trainingNavItems } from "../config/app";
import { Icon } from "../components/Icon";

function NavigationGroup({ mode, items, activeMode, page, mobile, setPage, setMode }) {
  const active = activeMode === mode;
  return (
    <div className={`training-nav-group training-${mode}-nav-group`.trim()} aria-hidden={!active} inert={active ? undefined : ""}>
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
  return <div className={`app-shell ${training ? "training-shell" : ""}`.trim()} data-app-mode={mode} data-nav-mode={mode}><aside className="sidebar"><div className="brand"><Icon name={training ? "fitness_center" : "vital_signs"} className="fill" /><div><strong>{APP_NAME}</strong><span>{training ? "Entrenamiento" : "Bitácora diaria"}</span></div></div><nav aria-label={training ? "Navegación de entrenamiento" : "Navegación principal"}><ModeNavigation activeMode={mode} page={page} setPage={setPage} setMode={setMode} /></nav><button className="ghost" onClick={logout}><Icon name="logout" />Salir</button></aside><main className="content" data-app-scroll-root="true" key={`${mode}-${page}`}>{children}</main><nav className={`mobile-nav ${training ? "training-mobile-nav" : ""}`.trim()} aria-label={training ? "Navegación de entrenamiento" : "Navegación principal"}><ModeNavigation activeMode={mode} page={page} mobile setPage={setPage} setMode={setMode} /></nav></div>;
}
