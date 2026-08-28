import React from "react";
import { createPortal } from "react-dom";

export function ModalRoot({ children, className = "modal-backdrop", onBackdropPointerDown, hidden = false }) {
  if (hidden) return null;
  const resolvedClassName = className.split(/\s+/).includes("app-modal-backdrop") ? className : `app-modal-backdrop ${className}`;
  return createPortal(
    <div className={resolvedClassName} data-modal-root="true" onPointerDown={onBackdropPointerDown}>
      {children}
    </div>,
    document.body,
  );
}
