import React, { useEffect, useState } from "react";
import { DEFAULT_MEALS } from "../../../config/app";
import { Icon } from "../../../components/Icon";
import { Input, Select } from "../../../components/FormControls";
import { ModalShell } from "../../../components/dialog/ModalShell";
import { formatNumber, formatQuantity, readableDate, today } from "../../../utils/format";

function shareUrl(token) {
  return `${window.location.origin}/ingresar?compartir=${encodeURIComponent(token)}`;
}

function ShareSummary({ preview }) {
  return (
    <section className="meal-share-summary" aria-label="Contenido de la comida">
      <header>
        <div><span>{preview.sourceMealLabel}</span><strong>{readableDate(preview.sourceDate)}</strong></div>
        <strong>{formatNumber(preview.calories)} kcal</strong>
      </header>
      <div className="meal-share-macros"><span>P <strong>{formatNumber(preview.proteinGrams, 1)} g</strong></span><span>C <strong>{formatNumber(preview.carbsGrams, 1)} g</strong></span><span>G <strong>{formatNumber(preview.fatGrams, 1)} g</strong></span></div>
      <ul>
        {(preview.items || []).map((item, index) => (
          <li key={`${item.itemType}:${item.name}:${index}`}>
            <span><strong>{item.name || "Alimento"}</strong>{item.estimated && <small>Estimación por foto</small>}</span>
            <small>{formatQuantity(item.quantity)} {item.unit === "PORTION" ? "porción" : item.unit === "GRAM" ? "g" : item.unit === "MILLILITER" ? "ml" : "unidad"}</small>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function MealShareDialog({ api, bracket, onClose }) {
  const [share, setShare] = useState(null);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let active = true;
    api.request("/api/nutrition/meal-shares", {
      method: "POST",
      body: JSON.stringify({ sourceDate: bracket.sourceDate, mealType: bracket.mealType }),
    }).then((result) => {
      if (!result?.token || !result.preview) throw new Error("El servidor devolvió un enlace incompleto.");
      if (active) setShare({ ...result, url: shareUrl(result.token) });
    }).catch((requestError) => {
      if (active) setError(requestError.message || "No se pudo preparar la comida para compartir.");
    }).finally(() => active && setLoading(false));
    return () => { active = false; };
  }, [api, bracket.mealType, bracket.sourceDate]);

  async function shareLink() {
    if (!share?.url) return;
    try {
      if (navigator.share) {
        await navigator.share({ title: `Comida de ${share.preview.sourceMealLabel}`, text: "Te comparto esta comida para agregarla a tu día en ScaleGrams.", url: share.url });
        setStatus("Enlace compartido.");
        return;
      }
      if (navigator.clipboard?.writeText) await navigator.clipboard.writeText(share.url);
      else {
        const input = document.createElement("textarea");
        input.value = share.url;
        input.style.position = "fixed";
        input.style.opacity = "0";
        document.body.appendChild(input);
        input.select();
        document.execCommand("copy");
        input.remove();
      }
      setStatus("Enlace copiado. Ya podés enviarlo por WhatsApp.");
    } catch (requestError) {
      if (requestError?.name !== "AbortError") setStatus("No se pudo compartir automáticamente. Copiá el enlace manualmente.");
    }
  }

  return (
    <ModalShell
      title="Compartir comida"
      eyebrow="Brackets"
      description="La otra persona recibirá una copia independiente y podrá elegir dónde registrarla."
      onClose={onClose}
      closeDisabled={loading}
      className="meal-share-dialog"
      footer={<div className="modal-actions"><button type="button" className="secondary" onClick={onClose}>Cerrar</button><button type="button" className="primary" disabled={!share || loading} onClick={shareLink}><Icon name="share" />Compartir enlace</button></div>}
    >
      {loading && <div className="catalog-status">Preparando enlace…</div>}
      {error && <div className="form-error" role="alert">{error}</div>}
      {share && <><ShareSummary preview={share.preview} /><label className="meal-share-link"><span>Enlace de invitación</span><input readOnly value={share.url} onFocus={(event) => event.currentTarget.select()} /></label>{status && <p className="meal-share-status" role="status">{status}</p>}</>}
    </ModalShell>
  );
}

export function MealShareAcceptDialog({ api, token, onClose, onDone }) {
  const [preview, setPreview] = useState(null);
  const [targetDate, setTargetDate] = useState(today());
  const [targetMealType, setTargetMealType] = useState("BREAKFAST");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    api.request(`/api/nutrition/meal-shares/${encodeURIComponent(token)}`).then((result) => {
      if (!active) return;
      setPreview(result);
      setTargetMealType(result.sourceMealType || "BREAKFAST");
    }).catch((requestError) => active && setError(requestError.message || "El enlace no existe o venció.")).finally(() => active && setLoading(false));
    return () => { active = false; };
  }, [api, token]);

  async function accept() {
    if (!preview || saving || preview.alreadyAccepted) return;
    setSaving(true);
    setError("");
    try {
      await api.request(`/api/nutrition/meal-shares/${encodeURIComponent(token)}/accept`, {
        method: "POST",
        body: JSON.stringify({ targetDate, mealType: targetMealType }),
      });
      api.notify("Comida compartida agregada a tu día.");
      onDone?.();
    } catch (requestError) {
      setError(requestError.message || "No se pudo agregar la comida compartida.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <ModalShell
      title="Agregar comida compartida"
      eyebrow="Brackets"
      description="Se agregará una copia a tu cuenta. El registro original no se modifica."
      onClose={onClose}
      closeDisabled={saving}
      className="meal-share-accept-dialog"
      footer={<div className="modal-actions"><button type="button" className="secondary" onClick={onClose}>Cancelar</button><button type="button" className="primary" disabled={!preview || saving || preview.alreadyAccepted} onClick={accept}>{saving ? "Agregando…" : preview?.alreadyAccepted ? "Ya agregada" : "Agregar a mi día"}</button></div>}
    >
      {loading && <div className="catalog-status">Cargando comida…</div>}
      {error && <div className="form-error" role="alert">{error}</div>}
      {preview && <><ShareSummary preview={preview} />{preview.alreadyAccepted ? <p className="meal-share-notice" role="status">Ya agregaste esta comida a tu cuenta.</p> : <div className="meal-share-destination"><Input label="Fecha de destino" type="date" value={targetDate} onChange={(event) => setTargetDate(event.target.value)} /><Select label="Comida de destino" value={targetMealType} options={DEFAULT_MEALS} onChange={(event) => setTargetMealType(event.target.value)} /></div>}</>}
    </ModalShell>
  );
}
