import React from "react";
import { createRoot } from "react-dom/client";
import { App } from "./app/App";
import { Landing } from "./features/landing/Landing";
import { migrateStoredSession } from "./config/app";

function syncVisualViewport() {
  const viewport = window.visualViewport;
  const height = `${viewport?.height || window.innerHeight}px`;
  const top = `${viewport?.offsetTop || 0}px`;
  const keyboardInset = `${Math.max(0, window.innerHeight - (viewport?.height || window.innerHeight) - (viewport?.offsetTop || 0))}px`;
  document.documentElement.style.setProperty("--app-viewport-height", height);
  document.documentElement.style.setProperty("--app-viewport-top", top);
  document.documentElement.style.setProperty("--dialog-viewport-height", height);
  document.documentElement.style.setProperty("--dialog-viewport-top", top);
  document.documentElement.style.setProperty("--dialog-keyboard-inset", keyboardInset);
}

syncVisualViewport();
migrateStoredSession();
window.visualViewport?.addEventListener("resize", syncVisualViewport);
window.visualViewport?.addEventListener("scroll", syncVisualViewport);
window.addEventListener("resize", syncVisualViewport);

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
