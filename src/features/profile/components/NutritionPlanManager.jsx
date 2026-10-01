import React, { useState } from "react";
import { Icon } from "../../../components/Icon";
import { Panel } from "../../../components/Layout";
import { formatNumber, readableDate, today } from "../../../utils/format";
import { NutritionPlanScheduleDialog } from "./NutritionPlanScheduleDialog";
import { NutritionPlanDialog } from "./NutritionPlanDialog";

function planColor(value) {
  const palette = ["#4edea3", "#89ceff", "#ffd166", "#c7a6ff", "#ff8fa3"];
  const hash = String(value || "plan").split("").reduce((sum, char) => sum + char.charCodeAt(0), 0);
  return palette[hash % palette.length];
}

function formatPlanDate(value) {
  if (!value) return "Sin fecha";
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("es-AR", { day: "numeric", month: "short", year: "numeric" }).format(date);
}

export function NutritionPlanManager({ api, plans, onChanged }) {
  const [dialog, setDialog] = useState(null);
  const [review, setReview] = useState(null);
  const [deletingId, setDeletingId] = useState(null);
  const currentPlan = plans.find(plan => plan.current && (!plan.status || plan.status === "SCHEDULED"));
  function startEdit(plan) {
    if (plan.status === "ALTERNATIVE") setDialog({ plan });
    else {
      let name = `${plan.name} · alternativa`; let suffix = 2;
      while (plans.some(item => item.status !== "ARCHIVED" && item.name.toLowerCase() === name.toLowerCase())) name = `${plan.name} · alternativa ${suffix++}`;
      setDialog({ plan: { ...plan, id: null, version: undefined, name, startDate: today(), endDate: "", status: "ALTERNATIVE" } });
    }
  }
  async function archive(plan) {
    if (deletingId) return;
    const confirmed = await api.confirm({ title: "¿Archivar alternativa?", description: `${plan.name} se conservará en el historial.`, confirmLabel: "Archivar" });
    if (!confirmed) return;
    setDeletingId(plan.id);
    try { await api.request(`/api/profile/nutrition-plans/${plan.id}`, { method: "DELETE" }); await onChanged(); api.notify("Alternativa archivada."); }
    catch (error) { api.notify(error.message || "No se pudo archivar.", "error"); }
    finally { setDeletingId(null); }
  }
  function actions(plan) {
    const alternative = plan.status === "ALTERNATIVE";
    const scheduled = !plan.status || plan.status === "SCHEDULED";
    return <div className="plan-history-actions"><button type="button" className="secondary" onClick={() => startEdit(plan)}>{alternative ? "Editar alternativa" : "Crear alternativa"}</button>{alternative && <button type="button" className="secondary" onClick={() => setReview({ plan })}>Programar</button>}{scheduled && <button type="button" className="secondary" onClick={() => setReview({ plan, cancel: true })}>Cancelar programación</button>}{alternative && <button type="button" className="secondary danger-text" disabled={Boolean(deletingId)} onClick={() => archive(plan)}>{deletingId === plan.id ? "Archivando…" : "Archivar"}</button>}</div>;
  }
  return <Panel title="Plan alimenticio">
    <div className="current-plan-panel"><span className="current-plan-dot" style={{ background: planColor(currentPlan?.id) }} /><div><small>META DE HOY</small><strong>{currentPlan?.name || "Meta manual"}</strong>{currentPlan && <span>Desde {readableDate(currentPlan.startDate)} · {formatNumber(currentPlan.dailyCalories)} kcal</span>}<em className="active-plan-badge">{currentPlan ? "Plan programado" : "Sin programación para hoy"}</em></div>{currentPlan && <div className="current-plan-actions">{actions(currentPlan)}</div>}</div>
    <div className="plan-history"><div className="plan-history-header"><div><h3>Alternativas e historial</h3><p>Una alternativa no cambia tu meta. Revisá el impacto antes de programarla.</p></div><button type="button" className="primary" onClick={() => setDialog({ plan: null })}><Icon name="add" />Agregar plan</button></div>
    {plans.filter(plan => plan.id !== currentPlan?.id).map(plan => <article className="plan-history-card" key={plan.id}><div className="plan-history-heading"><strong>{plan.name}</strong><span>{plan.status === "ARCHIVED" ? "Archivado" : plan.status === "ALTERNATIVE" ? "Alternativa" : "Programado"}</span></div><span>{formatPlanDate(plan.startDate)} – {plan.endDate ? formatPlanDate(plan.endDate) : "Sin fin declarado"}</span>{plan.status === "SCHEDULED" && plan.effectiveEndDate !== plan.endDate && <span>Vigencia efectiva hasta {formatPlanDate(plan.effectiveEndDate)}</span>}<small>{formatNumber(plan.dailyCalories)} kcal · {plan.proteinPercent}% proteína · {plan.carbsPercent}% carbohidratos · {plan.fatPercent}% grasas</small>{actions(plan)}</article>)}
    </div>
    {dialog && <NutritionPlanDialog key={dialog.plan?.id || "new"} api={api} plan={dialog.plan} plans={plans} onClose={() => setDialog(null)} onChanged={onChanged} />}
    {review && <NutritionPlanScheduleDialog api={api} {...review} onClose={() => setReview(null)} onChanged={onChanged} />}
  </Panel>;
}
