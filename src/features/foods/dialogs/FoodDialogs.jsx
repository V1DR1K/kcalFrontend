import React, { useId } from "react";
import { Icon } from "../../../components/Icon";
import { ModalShell } from "../../../components/dialog/ModalShell";
import { FoodThumb } from "../../catalog/CatalogComponents";

export function FoodLogDialog({ item, eyebrow, title = item?.name, description, isRecipe = false, closing = false, onClose, onSubmit, children, footer, titleId = "food-log-title" }) {
  const generatedTitleId = `${useId().replace(/:/g, "")}-title`;
  const resolvedTitleId = titleId === "food-log-title" ? generatedTitleId : titleId;
  return (
    <ModalShell as="form" onClose={onClose} hideHeader labelledBy={resolvedTitleId} className={`app-modal-compact edit-log-modal ${isRecipe ? "recipe-log-modal" : ""} ${closing ? "closing" : ""}`} backdropClassName="modal-backdrop compact-modal" wrapContent={false} dialogProps={{ onSubmit }}>
        <header className="edit-log-header">
          <div className="edit-log-header-main">
            <FoodThumb item={isRecipe ? { ...item, type: "RECIPE" } : item} compact />
            <div className="edit-log-identity">
              <span>{eyebrow}</span>
              <h2 id={resolvedTitleId}>{title}</h2>
              <small>{isRecipe ? "Receta" : "Alimento"}</small>
            </div>
          </div>
          <button type="button" className="icon-button" onClick={onClose} aria-label="Cerrar">
            <Icon name="close" />
          </button>
        </header>
         <div className="edit-log-body" data-dialog-scroll-owner="true">
          {isRecipe && description && <p className="recipe-log-description">{description}</p>}
          {children}
        </div>
        {footer}
  </ModalShell>
  );
}
