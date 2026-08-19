import React, { useEffect, useRef, useState } from "react";
import { Icon } from "../../components/Icon";
import { ModalRoot } from "../../components/dialog/ModalRoot";
import { useDialogLifecycle } from "../../components/dialog/useDialogLifecycle";
import { MyFoods as MyFoodsPanel } from "./components/MyFoodsPanel";
import { CreateFoodForm } from "./components/CatalogForms";
export { MyFoods } from "./components/MyFoodsPanel";

export function CreateCatalog({ api, prefillBarcode, clearPrefillBarcode, onClose }) {
  const [tab, setTab] = useState("FOOD");
  const [dirtyState, setDirtyState] = useState({ food: false });
  const [busyState, setBusyState] = useState({ food: false });
  const dirty = Object.values(dirtyState).some(Boolean);
  const busy = Object.values(busyState).some(Boolean);
  const closeRef = useRef(null);
  const dialogRef = useRef(null);
  const previousFocusRef = useRef(null);
  const modalHistoryStateRef = useRef(null);
  const dirtyRef = useRef(false);
  const busyRef = useRef(false);
  dirtyRef.current = dirty;
  busyRef.current = busy;
  const { dialogRef: lifecycleDialogRef, onBackdropPointerDown } = useDialogLifecycle({ onClose: requestClose, initialFocusRef: closeRef, lockScroll: false });

  useEffect(() => {
    previousFocusRef.current = document.activeElement;
    const previousBodyOverflow = document.body.style.overflow;
    const content = document.querySelector(".content");
    const previousContentOverflow = content?.style.overflow;
    document.body.style.overflow = "hidden";
    if (content) content.style.overflow = "hidden";
    closeRef.current?.focus();
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
      document.body.style.overflow = previousBodyOverflow;
      if (content) content.style.overflow = previousContentOverflow || "";
      window.removeEventListener("popstate", onPopState, true);
      previousFocusRef.current?.focus?.();
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
    <ModalRoot className="catalog-dialog-backdrop" onBackdropPointerDown={(event) => { if (!busy) onBackdropPointerDown(event); }}>
      <section ref={(node) => { dialogRef.current = node; lifecycleDialogRef.current = node; }} className="catalog-dialog" role="dialog" aria-modal="true" aria-labelledby="catalog-dialog-title" onPointerDown={(event) => event.stopPropagation()}>
        <header className="catalog-dialog-header">
          <div>
            <span>Catálogo</span>
            <h2 id="catalog-dialog-title">Crear alimentos</h2>
          </div>
          <button ref={closeRef} type="button" className="icon-button" aria-label="Cerrar registro" disabled={busy} onClick={requestClose}>
            <Icon name="close" />
          </button>
        </header>
        <div className="catalog-dialog-tabs tabs" role="tablist" aria-label="Opciones del catálogo">
          <button type="button" role="tab" aria-selected={tab === "FOOD"} aria-controls="catalog-panel-food" id="catalog-tab-food" className={tab === "FOOD" ? "selected" : ""} onClick={() => setTab("FOOD")}>Alimento</button>
          <button type="button" role="tab" aria-selected={tab === "MINE"} aria-controls="catalog-panel-mine" id="catalog-tab-mine" className={tab === "MINE" ? "selected" : ""} onClick={() => setTab("MINE")}>Mis alimentos</button>
        </div>
        <div className="catalog-dialog-content">
          <div id="catalog-panel-food" role="tabpanel" aria-labelledby="catalog-tab-food" hidden={tab !== "FOOD"}>
            <CreateFoodForm api={api} prefillBarcode={prefillBarcode} clearPrefillBarcode={clearPrefillBarcode} onDirtyChange={(value) => setDirtyState((current) => ({ ...current, food: value }))} onBusyChange={(value) => setBusyState((current) => ({ ...current, food: value }))} />
          </div>
          <div id="catalog-panel-mine" role="tabpanel" aria-labelledby="catalog-tab-mine" hidden={tab !== "MINE"}>
            <MyFoodsPanel api={api} onDirtyChange={(value) => setDirtyState((current) => ({ ...current, food: value }))} />
          </div>
        </div>
      </section>
    </ModalRoot>
  );
}
