import React, { useState } from "react";
import { ModalRoot } from "../../../components/dialog/ModalRoot";
import { useDialogLifecycle } from "../../../components/dialog/useDialogLifecycle";
import { savedAiEstimate } from "../dashboard.utils";

export function EditAiEstimateDialog({ api, log, mealTypes, onClose, onDone, EditorComponent }) {
  const [estimate, setEstimate] = useState(() => savedAiEstimate(log));
  const [mealType, setMealType] = useState(log.mealType);
  const [logDate, setLogDate] = useState(log.logDate);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const { dialogRef, onBackdropPointerDown } = useDialogLifecycle({ onClose });

  async function save(updated) {
    if (saving) return;
    setSaving(true);
    setSaveError("");
    try {
      await api.request(`/api/nutrition/food-logs/${log.id}/ai-estimate`, { method: "PUT", body: JSON.stringify({ ...updated, mealType, logDate }) });
      onDone();
    } catch (error) {
      setSaveError(error.message || "No se pudieron guardar los cambios.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <ModalRoot className="app-modal-backdrop modal-backdrop" onBackdropPointerDown={onBackdropPointerDown}>
      <EditorComponent
        dialogRef={dialogRef}
        estimate={estimate}
        setEstimate={setEstimate}
        saving={saving}
        saveError={saveError}
        onDiscard={onClose}
        onConfirm={save}
        mode="saved"
        standalone
        mealType={mealType}
        setMealType={setMealType}
        logDate={logDate}
        setLogDate={setLogDate}
        mealTypes={mealTypes}
        onCatalogItem={(index, payload) => api.request(`/api/nutrition/food-logs/${log.id}/ai-estimate/items/${index}/catalog`, { method: "POST", body: JSON.stringify(payload) })}
      />
    </ModalRoot>
  );
}
