import React, { useId } from "react";
import { Icon } from "../Icon";
import { ModalRoot } from "./ModalRoot";
import { useDialogLifecycle } from "./useDialogLifecycle";

export function ModalShell({
  children,
  title,
  description,
  eyebrow,
  onClose,
  closeLabel = "Cerrar",
  closeOnBackdrop = true,
  closeDisabled = false,
  role = "dialog",
  variant = "dialog",
  className = "",
  backdropClassName,
  footer,
  initialFocusRef,
  as: Element = "section",
  hideHeader = false,
  labelledBy,
  describedBy,
  wrapContent = true,
  dialogProps = {},
}) {
  const id = useId().replace(/:/g, "");
  const titleId = `${id}-title`;
  const descriptionId = description ? `${id}-description` : undefined;
  const { dialogRef, onBackdropPointerDown } = useDialogLifecycle({
    onClose: closeDisabled ? undefined : onClose,
    initialFocusRef,
  });

  function handleBackdropPointerDown(event) {
    if (closeOnBackdrop && !closeDisabled) onBackdropPointerDown(event);
  }

  return (
    <ModalRoot className={backdropClassName || `modal-backdrop ${variant}-backdrop`.trim()} onBackdropPointerDown={handleBackdropPointerDown}>
      <Element ref={dialogRef} className={`modal-shell modal-shell-${variant} ${className}`.trim()} role={role} aria-modal="true" aria-labelledby={labelledBy || titleId} aria-describedby={describedBy || descriptionId} onPointerDown={(event) => event.stopPropagation()} {...dialogProps}>
        {!hideHeader && (title || onClose) && (
          <header className="modal-shell-header">
            <div>
              {eyebrow && <span className="modal-shell-eyebrow">{eyebrow}</span>}
              {title && <h2 id={titleId}>{title}</h2>}
              {description && <p id={descriptionId}>{description}</p>}
            </div>
            {onClose && <button type="button" className="icon-button" aria-label={closeLabel} disabled={closeDisabled} onClick={onClose}><Icon name="close" /></button>}
          </header>
        )}
        {wrapContent ? <div className="modal-shell-content">{children}</div> : children}
        {footer && <footer className="modal-shell-footer">{footer}</footer>}
      </Element>
    </ModalRoot>
  );
}
