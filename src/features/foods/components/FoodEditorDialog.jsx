import React, { useRef, useState } from "react";
import { ModalShell } from "../../../components/dialog/ModalShell";
import { FoodEditorForm } from "./FoodEditorForm";

export function FoodEditorDialog({ api, food = null, prefillBarcode, clearPrefillBarcode, onClose, onDone }) {
  const editing = Boolean(food?.id);
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const closeRef = useRef(null);

  async function requestClose() {
    if (busy) return;
    if (dirty && !(await api.confirm({ title: "¿Descartar cambios?", description: "Lo que completaste en este alimento se va a perder.", confirmLabel: "Descartar cambios" }))) return;
    onClose?.();
  }

  return (
    <ModalShell
      onClose={requestClose}
      closeLabel={editing ? "Cerrar edición de alimento" : "Cerrar creación de alimento"}
      closeDisabled={busy}
      initialFocusRef={closeRef}
      title={editing ? "Editar alimento" : "Crear alimento"}
      eyebrow="Catálogo"
      className="catalog-dialog food-editor-dialog"
      backdropClassName="catalog-dialog-backdrop"
      wrapContent={false}
      footer={<div className="catalog-dialog-actions"><button type="button" className="secondary" onClick={requestClose} disabled={busy}>Cancelar</button><button type="submit" form="food-editor-form" className="primary" disabled={busy}>{busy ? (editing ? "Guardando…" : "Creando…") : (editing ? "Guardar cambios" : "Crear alimento")}</button></div>}
    >
      <div className="catalog-dialog-content" data-dialog-scroll-owner="true"><FoodEditorForm id="food-editor-form" hideSubmit title={null} api={api} food={food} prefillBarcode={prefillBarcode} clearPrefillBarcode={clearPrefillBarcode} onDirtyChange={setDirty} onBusyChange={setBusy} onDone={() => { onClose?.(); onDone?.(); }} /></div>
    </ModalShell>
  );
}
