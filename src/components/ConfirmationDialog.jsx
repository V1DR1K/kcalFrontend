import React, { useId, useRef } from "react";
import { Icon } from "./Icon";
import { ModalRoot } from "./dialog/ModalRoot";
import { useDialogLifecycle } from "./dialog/useDialogLifecycle";

export function ConfirmationDialog({ title, description, confirmLabel = "Confirmar", tone = "danger", onCancel, onConfirm }) {
  const cancelRef = useRef(null);
  const id = useId().replace(/:/g, "");
  const { dialogRef, onBackdropPointerDown } = useDialogLifecycle({ onClose: onCancel, initialFocusRef: cancelRef });

  return (
    <ModalRoot className="confirmation-backdrop" onBackdropPointerDown={onBackdropPointerDown}>
      <section ref={dialogRef} className={`confirmation-dialog ${tone}`} role="alertdialog" aria-modal="true" aria-labelledby={`${id}-title`} aria-describedby={`${id}-description`} onPointerDown={(event) => event.stopPropagation()}>
        <div className="confirmation-icon" aria-hidden="true"><Icon name="error" /></div>
        <div>
          <h2 id={`${id}-title`}>{title}</h2>
          <p id={`${id}-description`}>{description}</p>
        </div>
        <footer>
          <button ref={cancelRef} type="button" className="secondary" onClick={onCancel}>Cancelar</button>
          <button type="button" className="confirmation-confirm" onClick={onConfirm}>{confirmLabel}</button>
        </footer>
      </section>
    </ModalRoot>
  );
}
