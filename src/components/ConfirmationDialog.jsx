import React, { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { Icon } from "./Icon";

export function ConfirmationDialog({ title, description, confirmLabel = "Confirmar", tone = "danger", onCancel, onConfirm }) {
  const cancelRef = useRef(null);

  useEffect(() => {
    const previousFocus = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    const closeOnEscape = (event) => {
      if (event.key === "Escape") onCancel();
    };
    document.body.style.overflow = "hidden";
    cancelRef.current?.focus();
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", closeOnEscape);
      previousFocus?.focus?.();
    };
  }, [onCancel]);

  return createPortal(
    <div className="confirmation-backdrop" onPointerDown={(event) => { if (event.target === event.currentTarget) onCancel(); }}>
      <section className={`confirmation-dialog ${tone}`} role="alertdialog" aria-modal="true" aria-labelledby="confirmation-title" aria-describedby="confirmation-description">
        <div className="confirmation-icon" aria-hidden="true"><Icon name="error" /></div>
        <div>
          <h2 id="confirmation-title">{title}</h2>
          <p id="confirmation-description">{description}</p>
        </div>
        <footer>
          <button ref={cancelRef} type="button" className="secondary" onClick={onCancel}>Cancelar</button>
          <button type="button" className="confirmation-confirm" onClick={onConfirm}>{confirmLabel}</button>
        </footer>
      </section>
    </div>,
    document.body,
  );
}
