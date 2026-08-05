import React from "react";
import { createRoot } from "react-dom/client";
import { App } from "./app/App";

function syncVisualViewport() {
  const viewport = window.visualViewport;
  document.documentElement.style.setProperty("--app-viewport-height", `${viewport?.height || window.innerHeight}px`);
  document.documentElement.style.setProperty("--app-viewport-top", `${viewport?.offsetTop || 0}px`);
}

// Safari can ignore restrictive viewport metadata. Prevent only zoom gestures so
// regular one-finger scrolling and the meal swipe interactions remain available.
function preventPageZoom(event) {
  if (event.touches?.length > 1) event.preventDefault();
}

function preventGestureZoom(event) {
  event.preventDefault();
}

syncVisualViewport();
window.visualViewport?.addEventListener("resize", syncVisualViewport);
window.visualViewport?.addEventListener("scroll", syncVisualViewport);
window.addEventListener("resize", syncVisualViewport);
document.addEventListener("touchmove", preventPageZoom, { passive: false });
document.addEventListener("gesturestart", preventGestureZoom, { passive: false });
document.addEventListener("gesturechange", preventGestureZoom, { passive: false });
document.addEventListener("gestureend", preventGestureZoom, { passive: false });
document.addEventListener("dblclick", preventGestureZoom, { passive: false });

createRoot(document.getElementById("root")).render(<App />);
