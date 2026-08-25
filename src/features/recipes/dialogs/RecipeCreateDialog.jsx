import React, { useRef, useState } from "react";
import { CreateRecipeForm } from "../../catalog/components/CatalogForms";
import { ModalShell } from "../../../components/dialog/ModalShell";

export function RecipeCreateDialog({ api, onClose, onDone }) {
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const closeRef = useRef(null);

  async function requestClose() {
    if (busy) return;
    if (dirty) {
      const confirmed = await api.confirm({
        title: "¿Descartar cambios?",
        description: "Lo que completaste en esta receta se va a perder.",
        confirmLabel: "Descartar cambios",
      });
      if (!confirmed) return;
    }
    onClose();
  }

  return (
    <ModalShell
      onClose={requestClose}
      closeLabel="Cerrar creación de receta"
      closeDisabled={busy}
      initialFocusRef={closeRef}
      title="Crear receta"
      eyebrow="Recetas"
      className="recipe-create-dialog"
      backdropClassName="recipe-create-backdrop"
      wrapContent={false}
      footer={(
        <div className="recipe-dialog-actions">
          <button type="button" className="secondary" onClick={requestClose} disabled={busy}>Cancelar</button>
          <button type="submit" form="create-recipe-form" className="primary" disabled={busy}>{busy ? "Creando…" : "Crear receta"}</button>
        </div>
      )}
    >
      <div className="recipe-create-content" data-dialog-scroll-owner="true">
        <CreateRecipeForm
          id="create-recipe-form"
          hideSubmit
          title={null}
          api={api}
          onDirtyChange={setDirty}
          onBusyChange={setBusy}
          onDone={() => {
            onClose();
            onDone?.();
          }}
        />
      </div>
    </ModalShell>
  );
}
