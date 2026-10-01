import React, { useEffect, useState } from "react";
import { ModalShell } from "../../../components/dialog/ModalShell";
import { readableDate, formatNumber } from "../../../utils/format";

function Timeline({ title, plans }) {
  return <section className="plan-timeline"><h3>{title}</h3>{plans.length ? <ul>{plans.map(plan => <li key={plan.id}><strong>{plan.name}</strong><span>{readableDate(plan.startDate)} – {plan.effectiveEndDate ? readableDate(plan.effectiveEndDate) : "Sin fin"}</span><span>{formatNumber(plan.dailyCalories)} kcal por día</span></li>)}</ul> : <p>Sin planes programados.</p>}</section>;
}

export function NutritionPlanScheduleDialog({ api, plan, cancel = false, onClose, onChanged }) {
  const [candidate, setCandidate] = useState(plan);
  const [preview, setPreview] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const action = cancel ? "cancel" : "schedule";
  async function load(refresh = false) {
    setLoading(true); setPreview(null); setError("");
    try {
      let current = candidate;
      if (refresh) {
        const all = await api.request("/api/profile/nutrition-plans");
        current = all.find(item => item.id === plan.id);
        if (!current) throw new Error("El plan ya no está disponible.");
        setCandidate(current);
      }
      setPreview(await api.request(`/api/profile/nutrition-plans/${plan.id}/${action}-preview`, { method: "POST", body: JSON.stringify({ version: current.version }) }));
    } catch (failure) { setError(failure.message || "No se pudo cargar la vista previa."); }
    finally { setLoading(false); }
  }
  useEffect(() => { load(); }, []);
  async function confirm() {
    if (!preview || saving) return;
    setSaving(true); setError("");
    try {
      const saved = await api.request(`/api/profile/nutrition-plans/${plan.id}/${action}`, { method: "POST", body: JSON.stringify({ version: candidate.version, previewToken: preview.previewToken }) });
      api.notify(cancel ? "Programación cancelada. El plan queda como alternativa." : "Plan programado.");
      window.dispatchEvent(new Event("scalegrams:plan-updated"));
      await onChanged?.(saved); onClose();
    } catch (failure) { setPreview(null); setError(failure.message || "No se pudo confirmar. Revisá nuevamente el impacto."); }
    finally { setSaving(false); }
  }
  return <ModalShell title={cancel ? "Cancelar programación" : "Revisar programación"} description={plan.name} onClose={onClose} closeDisabled={saving} className="nutrition-schedule-dialog" footer={<><button type="button" className="secondary" disabled={saving} onClick={onClose}>Volver</button><button type="button" className="primary" disabled={!preview || loading || saving} onClick={confirm}>{saving ? "Confirmando…" : cancel ? "Confirmar cancelación" : "Confirmar programación"}</button></>}>
    <p>Revisá qué meta se aplicará en cada período. Los días sin programación usan tu meta manual. Las fechas declaradas de los planes anteriores se conservan.</p>
    {loading && <p role="status">Cargando impacto…</p>}
    {preview && <div className="plan-timeline-comparison"><Timeline title="Antes" plans={preview.before} /><Timeline title="Después" plans={preview.after} /></div>}
    {error && <div><p className="form-error" role="alert">{error}</p><button type="button" className="secondary" disabled={loading} onClick={() => load(true)}>Actualizar vista previa</button></div>}
  </ModalShell>;
}
