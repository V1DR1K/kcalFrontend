import React from "react";
import { createPortal } from "react-dom";
import { Icon } from "./Icon";

export function Notification({ message, tone = "success", onDismiss }) {
  if (!message) return null;
  const isError = tone === "error";
  return createPortal(
    <div className="notification-region" aria-live={isError ? "assertive" : "polite"}>
      <div className={`notification ${isError ? "error" : ""}`} role={isError ? "alert" : "status"}>
        <Icon name={isError ? "error" : "check_circle"} />
        <span>{message}</span>
        <button type="button" aria-label="Cerrar aviso" onClick={onDismiss}><Icon name="close" /></button>
      </div>
    </div>,
    document.body,
  );
}
