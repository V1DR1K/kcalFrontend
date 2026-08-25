import React from "react";
import { Icon } from "../../../components/Icon";
import { useDialogLifecycle } from "../../../components/dialog/useDialogLifecycle";

export function MealPhotoContextEditor({ photoUrl, context, setContext, error, recording, transcribing, analyzing, onToggleRecording, onDiscard, onChangePhoto, onAnalyze }) {
  const { dialogRef } = useDialogLifecycle({ onClose: onDiscard });

  return (
    <div className="selected-subpanel ai-photo-context-subpanel">
      <section ref={dialogRef} className="selected-editor ai-photo-context-editor" role="dialog" aria-modal="true" aria-label="Preparar análisis de foto">
        <span className="sheet-handle" aria-hidden="true" />
        <header><div><span>Estimación IA</span><h3>Contanos sobre la foto</h3><small>Agregá detalles que no se vean con claridad, si hace falta.</small></div><button className="icon-button" aria-label="Descartar foto" onClick={onDiscard}><Icon name="close" /></button></header>
        {photoUrl && <img className="ai-photo-context-preview" src={photoUrl} alt="Foto elegida para estimar la comida" />}
        <div className="ai-context-tools"><label className="ai-context-field"><span>Descripción opcional</span><textarea maxLength={240} placeholder="Ej.: dos empanadas de carne con queso y gaseosa" value={context} onChange={(event) => setContext(event.target.value)} /></label><button type="button" className={`secondary ai-note-record ${recording ? "recording" : ""}`} disabled={transcribing || analyzing} onClick={onToggleRecording}><Icon name={recording ? "stop_circle" : "mic"} />{transcribing ? "Transcribiendo..." : recording ? "Detener dictado" : "Dictar descripción"}</button></div>
        {error && <p className="ai-estimate-error" role="alert">{error}</p>}
        <div className="ai-photo-context-actions"><button type="button" className="secondary" disabled={analyzing} onClick={onChangePhoto}>Cambiar foto</button><button type="button" className="primary" disabled={analyzing || recording || transcribing} onClick={onAnalyze}>{analyzing ? "Analizando comida..." : "Analizar foto"}</button></div>
      </section>
    </div>
  );
}
