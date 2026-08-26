import React from "react";
import { createPortal } from "react-dom";

export function ActionLoader({ title, description, mode = "nutrition" }) {
  return createPortal(
    <div className="action-loader" data-app-mode={mode} role="alert" aria-live="assertive" aria-busy="true">
      <div className="action-loader-card">
        <span className="action-loader-spinner" aria-hidden="true" />
        <strong>{title}</strong>
        <small>{description}</small>
      </div>
    </div>,
    document.body,
  );
}
