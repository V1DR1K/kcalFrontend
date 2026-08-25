import React, { useEffect, useRef, useState } from "react";
import { ModalShell } from "../../components/dialog/ModalShell";
import { CreateFoodForm } from "./components/CatalogForms";
export { MyFoods } from "./components/MyFoodsPanel";

export function CreateCatalog({ api, prefillBarcode, clearPrefillBarcode, onClose }) {
  const [dirtyState, setDirtyState] = useState({ food: false });
  const [busyState, setBusyState] = useState({ food: false });
  const dirty = Object.values(dirtyState).some(Boolean);
  const busy = Object.values(busyState).some(Boolean);
  const modalHistoryStateRef = useRef(null);
  const dirtyRef = useRef(false);
  const busyRef = useRef(false);
  dirtyRef.current = dirty;
  busyRef.current = busy;
  useEffect(() => {
    modalHistoryStateRef.current = { ...(window.history.state || {}), scalegramsModal: "catalog" };
    window.history.pushState(modalHistoryStateRef.current, "");
    function onPopState(event) {
      if (event.state?.scalegramsModal === "catalog") return;
      if (!dirtyRef.current) {
        onClose?.({ fromHistory: true });
        return;
      }
      event.stopImmediatePropagation();
      window.history.pushState(modalHistoryStateRef.current, "");
      requestClose();
    }
    window.addEventListener("popstate", onPopState, true);
    return () => {
      window.removeEventListener("popstate", onPopState, true);
    };
  }, []);

  async function requestClose() {
    if (busyRef.current || !onClose) return;
    if (dirtyRef.current) {
      const confirmed = await api.confirm({
        title: "¿Descartar cambios?",
        description: "Lo que completaste en este registro se va a perder.",
        confirmLabel: "Descartar cambios",
      });
      if (!confirmed) return;
    }
    dirtyRef.current = false;
    onClose();
  }

  return (
    <ModalShell
      title="Crear alimento"
      eyebrow="Catálogo"
      onClose={requestClose}
      closeLabel="Cerrar registro"
      closeDisabled={busy}
      className="catalog-dialog"
      backdropClassName="catalog-dialog-backdrop"
      wrapContent={false}
      footer={(
        <div className="catalog-dialog-actions">
          <button type="button" className="secondary" onClick={requestClose} disabled={busy}>Cancelar</button>
          <button type="submit" form="create-food-form" className="primary" disabled={busy}>{busy ? "Creando…" : "Crear alimento"}</button>
        </div>
      )}
    >
        <div className="catalog-dialog-content">
          <div id="catalog-panel-food" data-dialog-scroll-owner="true">
            <CreateFoodForm id="create-food-form" hideSubmit title={null} api={api} prefillBarcode={prefillBarcode} clearPrefillBarcode={clearPrefillBarcode} onDirtyChange={(value) => setDirtyState((current) => ({ ...current, food: value }))} onBusyChange={(value) => setBusyState((current) => ({ ...current, food: value }))} />
          </div>
        </div>
    </ModalShell>
  );
}
