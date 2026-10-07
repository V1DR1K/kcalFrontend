import React from "react";
import { createRoot } from "react-dom/client";
import { App } from "./app/App";
import { Landing } from "./features/landing/Landing";
import { migrateStoredSession } from "./config/app";

let stableDialogHeight = window.visualViewport?.height || window.innerHeight;
let viewportSyncFrame = 0;
let stableViewportWidth = window.innerWidth;

function hasTextInputFocus() {
  const activeElement = document.activeElement;
  return activeElement?.matches?.("input, textarea, [contenteditable=\"true\"]") || false;
}

function syncViewport() {
  viewportSyncFrame = 0;
  const viewport = window.visualViewport;
  const topOffset = viewport?.offsetTop || 0;
  const visibleHeight = Math.max(1, viewport?.height || window.innerHeight);
  const top = `${topOffset}px`;
  const keyboardInsetValue = Math.max(0, window.innerHeight - visibleHeight - topOffset);
  const hasKeyboardGeometry = keyboardInsetValue > 80 || visibleHeight < stableDialogHeight - 80;
  const keyboardOpen = (hasTextInputFocus() || document.documentElement.dataset.keyboardOpen === "true") && hasKeyboardGeometry;
  if (stableViewportWidth !== window.innerWidth) {
    stableViewportWidth = window.innerWidth;
    if (!keyboardOpen) stableDialogHeight = window.innerHeight;
  }
  if (!keyboardOpen) stableDialogHeight = visibleHeight;
  const keepMobileDialogFrame = keyboardOpen && window.matchMedia("(max-width: 900px)").matches;
  const dialogViewportHeight = keepMobileDialogFrame ? stableDialogHeight : visibleHeight;
  const dialogHeight = `${dialogViewportHeight}px`;
  const root = document.documentElement;
  const keyboardInset = `${keyboardInsetValue}px`;
  root.style.setProperty("--app-viewport-top", top);
  root.style.setProperty("--app-viewport-height", dialogHeight);
  root.style.setProperty("--dialog-viewport-height", dialogHeight);
  root.style.setProperty("--dialog-visible-height", dialogHeight);
  root.style.setProperty("--dialog-viewport-top", top);
  root.style.setProperty("--dialog-layout-height", dialogHeight);
  root.style.setProperty("--dialog-keyboard-inset", keyboardInset);
  root.dataset.keyboardOpen = String(keyboardOpen);
  if (!keyboardOpen) {
    const shellHeight = isStandaloneApp() ? "100vh" : `${window.innerHeight}px`;
    root.style.setProperty("--app-shell-height", shellHeight);
  }
}

function scheduleViewportSync() {
  if (viewportSyncFrame) return;
  viewportSyncFrame = window.requestAnimationFrame(syncViewport);
}

function syncViewportAfterSession() {
  scheduleViewportSync();
}

function isStandaloneApp() {
  return window.matchMedia?.("(display-mode: standalone)").matches || window.navigator.standalone === true;
}

function initialPathname() {
  const pathname = window.location.pathname;
  if (pathname !== "/" || !isStandaloneApp()) return pathname;
  window.history.replaceState({ ...(window.history.state || {}) }, "", "/ingresar");
  return "/ingresar";
}

syncViewport();
migrateStoredSession();
window.visualViewport?.addEventListener("resize", scheduleViewportSync);
window.visualViewport?.addEventListener("scroll", scheduleViewportSync);
window.addEventListener("resize", () => {
  scheduleViewportSync();
});
window.addEventListener("focusin", scheduleViewportSync, true);
window.addEventListener("focusout", scheduleViewportSync, true);
window.addEventListener("scalegrams:session-updated", syncViewportAfterSession);

function Root() {
  const [pathname, setPathname] = React.useState(initialPathname);

  React.useEffect(() => {
    const syncPathname = () => setPathname(window.location.pathname);
    window.addEventListener("popstate", syncPathname);
    return () => window.removeEventListener("popstate", syncPathname);
  }, []);

  React.useEffect(() => {
    if (pathname === "/") document.title = "ScaleGrams | Tu plan, en contexto";
  }, [pathname]);

  return pathname === "/" ? <Landing /> : <App />;
}

createRoot(document.getElementById("root")).render(<Root />);
