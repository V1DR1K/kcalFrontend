import React from "react";
import { Icon } from "../../../components/Icon";
import { ModalShell } from "../../../components/dialog/ModalShell";

export function MealPhotoContextEditor({ photoUrl, context, setContext, error, recording, transcribing, analyzing, targetType, onTargetTypeChange, showTargetTypeOptions = true, onToggleRecording, onDiscard, onChangePhoto, onAnalyze }) {
  return (
    <ModalShell
      title="Contanos sobre la foto"
      description="Agregá detalles que no se vean con claridad, si hace falta."
      ariaLabel="Preparar análisis de foto"
      closeLabel="Descartar foto"
      onClose={onDiscard}
      className="ai-photo-context-modal"
      backdropClassName="modal-backdrop ai-photo-context-backdrop"
      footer={
        <div className="ai-photo-context-actions">
          <button type="button" className="secondary" disabled={analyzing} onClick={onChangePhoto}>Cambiar foto</button>
          <button type="button" className="primary" disabled={analyzing || recording || transcribing || (showTargetTypeOptions && !targetType)} onClick={onAnalyze}>{analyzing ? "Analizando..." : "Analizar foto"}</button>
        </div>
      }
    >
      <div className="ai-photo-context-editor">
        {photoUrl && <img className="ai-photo-context-preview" src={photoUrl} alt="Foto elegida para estimar la comida" />}
        {showTargetTypeOptions && <section className="ai-photo-target-choice" aria-labelledby="ai-photo-target-heading">
          <div>
            <h3 id="ai-photo-target-heading">¿Qué querés analizar?</h3>
            <p>Elegí el tipo de registro antes de iniciar el análisis.</p>
          </div>
          <div className="ai-photo-target-options">
            <button type="button" className={`ai-photo-target-option ${targetType === "FOOD" ? "selected" : ""}`} aria-pressed={targetType === "FOOD"} aria-label="Analizar como Alimento" disabled={analyzing} onClick={() => onTargetTypeChange?.("FOOD")}>
              <Icon name="nutrition" />
              <span><strong>Alimento</strong><small>Un producto o alimento individual para guardar en tu catálogo.</small></span>
              {targetType === "FOOD" && <Icon name="check_circle" className="ai-photo-target-check" />}
            </button>
            <button type="button" className={`ai-photo-target-option ${targetType === "RECIPE" ? "selected" : ""}`} aria-pressed={targetType === "RECIPE"} aria-label="Analizar como Receta" disabled={analyzing} onClick={() => onTargetTypeChange?.("RECIPE")}>
              <Icon name="restaurant" />
              <span><strong>Receta</strong><small>Un plato con varios ingredientes; se crea una receta y una porción.</small></span>
              {targetType === "RECIPE" && <Icon name="check_circle" className="ai-photo-target-check" />}
            </button>
          </div>
          {!targetType && <p className="ai-photo-target-hint" role="status">Elegí Alimento o Receta para habilitar el análisis.</p>}
        </section>}
        <div className="ai-context-tools">
          <label className="ai-context-field">
            <span>Descripción opcional</span>
            <textarea maxLength={240} placeholder="Ej.: dos empanadas de carne con queso y gaseosa" value={context} onChange={(event) => setContext(event.target.value)} />
          </label>
          <button type="button" className={`secondary ai-note-record ${recording ? "recording" : ""}`} disabled={transcribing || analyzing} onClick={onToggleRecording}>
            <Icon name={recording ? "stop_circle" : "mic"} />
            {transcribing ? "Transcribiendo..." : recording ? "Detener dictado" : "Dictar descripción"}
          </button>
        </div>
        {error && <p className="ai-estimate-error" role="alert">{error}</p>}
      </div>
    </ModalShell>
  );
}
