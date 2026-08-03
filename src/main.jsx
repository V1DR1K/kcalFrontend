import React from "react";
import { createRoot } from "react-dom/client";
import { App } from "./app/App";

function syncVisualViewport() {
  const viewport = window.visualViewport;
  document.documentElement.style.setProperty("--app-viewport-height", `${viewport?.height || window.innerHeight}px`);
  document.documentElement.style.setProperty("--app-viewport-top", `${viewport?.offsetTop || 0}px`);
}
syncVisualViewport();
window.visualViewport?.addEventListener("resize", syncVisualViewport);
window.visualViewport?.addEventListener("scroll", syncVisualViewport);
window.addEventListener("resize", syncVisualViewport);

createRoot(document.getElementById("root")).render(<App />);
