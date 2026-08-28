import React from "react";
import { createRoot } from "react-dom/client";
import { App } from "./app/App";
import { Landing } from "./features/landing/Landing";
import { migrateStoredSession } from "./config/app";

let stableDialogHeight = window.visualViewport?.height || window.innerHeight;

function hasTextInputFocus() {
  const activeElement = document.activeElement;
  return activeElement?.matches?.("input, textarea, [contenteditable=\"true\"]") || false;
}

function syncVisualViewport() {
  const viewport = window.visualViewport;
  const visibleHeight = viewport?.height || window.innerHeight;
  const top = `${viewport?.offsetTop || 0}px`;
  const keyboardInsetValue = Math.max(0, window.innerHeight - visibleHeight - (viewport?.offsetTop || 0));
  const keyboardOpen = keyboardInsetValue > 120 || (hasTextInputFocus() && visibleHeight < stableDialogHeight - 120);
  if (!keyboardOpen) stableDialogHeight = visibleHeight;
  const appHeight = `${visibleHeight}px`;
  const dialogHeight = `${keyboardOpen ? stableDialogHeight : visibleHeight}px`;
  const keyboardInset = `${keyboardInsetValue}px`;
  document.documentElement.style.setProperty("--app-viewport-height", appHeight);
  document.documentElement.style.setProperty("--app-viewport-top", top);
  document.documentElement.style.setProperty("--dialog-viewport-height", dialogHeight);
  document.documentElement.style.setProperty("--dialog-visible-height", `${visibleHeight}px`);
  document.documentElement.style.setProperty("--dialog-viewport-top", top);
  document.documentElement.style.setProperty("--dialog-layout-height", dialogHeight);
  document.documentElement.style.setProperty("--dialog-keyboard-inset", keyboardInset);
}

syncVisualViewport();
migrateStoredSession();
window.visualViewport?.addEventListener("resize", syncVisualViewport);
window.visualViewport?.addEventListener("scroll", syncVisualViewport);
window.addEventListener("resize", syncVisualViewport);
window.addEventListener("focusin", syncVisualViewport, true);
window.addEventListener("focusout", syncVisualViewport, true);

function Root() {
  const [pathname, setPathname] = React.useState(() => window.location.pathname);

  React.useEffect(() => {
    const syncPathname = () => setPathname(window.location.pathname);
    window.addEventListener("popstate", syncPathname);
    return () => window.removeEventListener("popstate", syncPathname);
  }, []);

  React.useEffect(() => {
    document.title = pathname === "/" ? "ScaleGrams | Tu plan, en contexto" : "Ingresar | ScaleGrams";
  }, [pathname]);

  return pathname === "/" ? <Landing /> : <App />;
}

createRoot(document.getElementById("root")).render(<Root />);
