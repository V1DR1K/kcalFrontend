import React from "react";
import { ModalShell } from "../../../components/dialog/ModalShell";

export function MealPhotoContextEditor({ photoUrl, context, setContext, error, analyzing, onDiscard, onChangePhoto, onAnalyze }) {
  return (
    <ModalShell
      title="Contanos sobre la foto"
      description="Agregá detalles que no se vean con claridad, si hace falta."
      ariaLabel="Preparar análisis de foto"
      closeLabel="Descartar foto"
      onClose={onDiscard}
      closeDisabled={analyzing}
      className="ai-photo-context-modal"
      backdropClassName="modal-backdrop ai-photo-context-backdrop"
      footer={
        <div className="ai-photo-context-actions">
          <button type="button" className="secondary" disabled={analyzing} onClick={onChangePhoto}>Cambiar foto</button>
          <button type="button" className="primary" disabled={analyzing} onClick={onAnalyze}>{analyzing ? "Analizando..." : "Analizar foto"}</button>
        </div>
      }
    >
      <div className="ai-photo-context-editor">
        {photoUrl && <img className="ai-photo-context-preview" src={photoUrl} alt="Foto elegida para estimar la comida" />}
        <section className="ai-photo-target-choice" aria-labelledby="ai-photo-target-heading">
          <div>
            <h3 id="ai-photo-target-heading">Tipo de registro automático</h3>
            <p>La IA contará los alimentos detectados: uno se guarda como alimento; varios, como receta.</p>
          </div>
        </section>
        <label className="ai-context-field">
          <span>Descripción opcional</span>
          <textarea aria-label="Descripción opcional" maxLength={240} placeholder="Ej.: dos empanadas de carne con queso y gaseosa" value={context} onChange={(event) => setContext(event.target.value)} />
        </label>
        {error && <p className="ai-estimate-error" role="alert">{error}</p>}
      </div>
    </ModalShell>
  );
}
