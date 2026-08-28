import React, { useEffect, useId, useRef } from "react";
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
  theme = "nutrition",
}) {
  const id = useId().replace(/:/g, "");
  const titleId = `${id}-title`;
  const descriptionId = description ? `${id}-description` : undefined;
  const footerRef = useRef(null);
  const { dialogRef, onBackdropPointerDown } = useDialogLifecycle({
    onClose: closeDisabled ? undefined : onClose,
    initialFocusRef,
  });

  useEffect(() => {
    const surface = dialogRef.current;
    const footerElement = footerRef.current || surface?.querySelector(":scope > footer");
    if (!surface || !footerElement) return undefined;
    const updateFooterSpace = () => surface.style.setProperty("--dialog-footer-space", `${footerElement.getBoundingClientRect().height}px`);
    updateFooterSpace();
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(updateFooterSpace);
    observer?.observe(footerElement);
    return () => observer?.disconnect();
  }, [dialogRef, footer]);

  function handleBackdropPointerDown(event) {
    if (closeOnBackdrop && !closeDisabled) onBackdropPointerDown(event);
  }

  const themeClass = `modal-theme-${theme}`;
  const resolvedBackdropClass = `app-modal-backdrop ${backdropClassName || `modal-backdrop ${variant}-backdrop`} ${themeClass}`.trim();
  const resolvedSurfaceClass = `app-modal-surface modal-shell modal-shell-${variant} ${themeClass} ${className}`.trim();

  return (
    <ModalRoot className={resolvedBackdropClass} onBackdropPointerDown={handleBackdropPointerDown}>
      <Element ref={dialogRef} className={resolvedSurfaceClass} data-dialog-surface="true" data-modal-theme={theme} role={role} aria-modal="true" aria-labelledby={labelledBy || titleId} aria-describedby={describedBy || descriptionId} onPointerDown={(event) => event.stopPropagation()} {...dialogProps}>
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
        {wrapContent ? <div className="modal-shell-content" data-dialog-scroll-owner="true">{children}</div> : children}
        {footer && <footer ref={footerRef} className="modal-shell-footer">{footer}</footer>}
      </Element>
    </ModalRoot>
  );
}
