import React from "react";
import { createRoot } from "react-dom/client";
import { App } from "./app/App";

document.addEventListener("gesturestart", (event) => event.preventDefault(), { passive: false });
document.addEventListener("wheel", (event) => { if (event.ctrlKey) event.preventDefault(); }, { passive: false });
document.addEventListener("keydown", (event) => {
  if ((event.ctrlKey || event.metaKey) && ["+", "-", "=", "0"].includes(event.key)) event.preventDefault();
});

createRoot(document.getElementById("root")).render(<App />);
