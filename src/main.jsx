import React from "react";
import { createRoot } from "react-dom/client";
import { App } from "./app/App";

document.addEventListener("gesturestart", (event) => event.preventDefault(), { passive: false });
document.addEventListener("wheel", (event) => { if (event.ctrlKey) event.preventDefault(); }, { passive: false });
document.addEventListener("keydown", (event) => {
  if ((event.ctrlKey || event.metaKey) && ["+", "-", "=", "0"].includes(event.key)) event.preventDefault();
});

const selectableInputTypes = new Set(["text", "number", "search", "email", "tel", "url", "password"]);
let selectOnPointerUp = null;
document.addEventListener("focusin", (event) => {
  const input = event.target;
  if (!(input instanceof HTMLInputElement) || !selectableInputTypes.has(input.type) || input.readOnly || input.disabled) return;
  selectOnPointerUp = input;
  requestAnimationFrame(() => input.select());
});
document.addEventListener("pointerup", (event) => {
  if (event.target !== selectOnPointerUp) return;
  event.preventDefault();
  selectOnPointerUp.select();
  selectOnPointerUp = null;
}, true);

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
