import React, { useRef, useState } from "react";
import { ModalShell } from "../../../components/dialog/ModalShell";
import { RecipeEditorForm } from "../components/RecipeEditorForm";

export function RecipeEditorDialog({ api, recipe = null, onClose, onDone }) {
  const editing = Boolean(recipe?.id);
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
      closeLabel={editing ? "Cerrar edición de receta" : "Cerrar creación de receta"}
      closeDisabled={busy}
      initialFocusRef={closeRef}
      title={editing ? "Editar receta" : "Crear receta"}
      eyebrow="Recetas"
      className={editing ? "recipe-editor-dialog recipe-editor-modal" : "recipe-create-dialog"}
      backdropClassName="recipe-create-backdrop"
      wrapContent={false}
      footer={(
        <div className="recipe-dialog-actions">
          <button type="button" className="secondary" onClick={requestClose} disabled={busy}>Cancelar</button>
          <button type="submit" form="recipe-editor-form" className="primary" disabled={busy}>{busy ? (editing ? "Guardando…" : "Creando…") : (editing ? "Guardar cambios" : "Crear receta")}</button>
        </div>
      )}
    >
      <div className="recipe-create-content" data-dialog-scroll-owner="true">
        <RecipeEditorForm
          id="recipe-editor-form"
          hideSubmit
          title={null}
          api={api}
          recipe={recipe}
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

export function RecipeCreateDialog(props) {
  return <RecipeEditorDialog {...props} />;
}
