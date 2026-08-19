import React from "react";
import { createPortal } from "react-dom";

export function ModalRoot({ children, className = "modal-backdrop", onBackdropPointerDown, hidden = false }) {
  if (hidden) return null;
  return createPortal(
    <div className={className} data-modal-root="true" onPointerDown={onBackdropPointerDown}>
      {children}
    </div>,
    document.body,
  );
}
