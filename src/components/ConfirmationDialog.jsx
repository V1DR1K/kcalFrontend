import React, { useId, useRef } from "react";
import { Icon } from "./Icon";
import { ModalShell } from "./dialog/ModalShell";

export function ConfirmationDialog({ title, description, confirmLabel = "Confirmar", tone = "danger", onCancel, onConfirm }) {
  const cancelRef = useRef(null);
  const id = useId().replace(/:/g, "");

  return (
    <ModalShell
      role="alertdialog"
      onClose={onCancel}
      initialFocusRef={cancelRef}
      className={`app-modal-compact confirmation-dialog ${tone}`}
      backdropClassName="confirmation-backdrop"
      hideHeader
      wrapContent={false}
      labelledBy={`${id}-title`}
      describedBy={`${id}-description`}
    >
        <div className="confirmation-icon" aria-hidden="true"><Icon name="error" /></div>
        <div>
          <h2 id={`${id}-title`}>{title}</h2>
          <p id={`${id}-description`}>{description}</p>
        </div>
        <footer>
          <button ref={cancelRef} type="button" className="secondary" onClick={onCancel}>Cancelar</button>
          <button type="button" className="confirmation-confirm" onClick={onConfirm}>{confirmLabel}</button>
        </footer>
    </ModalShell>
  );
}
