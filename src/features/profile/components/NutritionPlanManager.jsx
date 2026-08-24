import React, { useState } from "react";
import { Icon } from "../../../components/Icon";
import { Panel } from "../../../components/Layout";
import { formatNumber, readableDate, today } from "../../../utils/format";
import { NutritionPlanDialog } from "./NutritionPlanDialog";

function planColor(value) {
  const palette = ["#4edea3", "#89ceff", "#ffd166", "#c7a6ff", "#ff8fa3"];
  const hash = String(value || "plan").split("").reduce((sum, char) => sum + char.charCodeAt(0), 0);
  return palette[hash % palette.length];
}

export function NutritionPlanManager({ api, plans, onChanged }) {
  const [dialog, setDialog] = useState(null);
  const [activatingId, setActivatingId] = useState(null);
  const [deletingId, setDeletingId] = useState(null);
  const currentPlan = plans.find((plan) => plan.current) || plans.find((plan) => plan.startDate <= today() && (!plan.endDate || plan.endDate >= today()));
  function startCreate() {
    setDialog({ plan: null });
  }
  function startEdit(plan) {
    setDialog({ plan });
  }
  async function activatePlan(plan) {
    if (activatingId || plan.id === currentPlan?.id) return;
    setActivatingId(plan.id);
    try {
      const payload = { name: plan.name, dailyCalories: plan.dailyCalories, proteinPercent: Number(plan.proteinPercent), carbsPercent: Number(plan.carbsPercent), fatPercent: Number(plan.fatPercent), startDate: today(), endDate: null };
      await api.runAction(
        { title: "Cambiando plan", description: "Estamos activando tu plan alimenticio..." },
        async () => {
          await api.request("/api/profile/nutrition-plans", { method: "POST", body: JSON.stringify(payload) });
          api.notify(`${plan.name} es ahora tu plan actual.`);
          await onChanged();
        },
        { quiet: true },
      );
    } catch { api.notify("No se pudo cambiar el plan.", "error"); }
    finally { setActivatingId(null); }
  }
  async function deletePlan(plan) {
    if (deletingId || activatingId) return;
    const confirmed = await api.confirm({
      title: "¿Borrar plan?",
      description: `${plan.name} dejará de estar disponible en tu historial, pero sus datos se conservarán.`,
      confirmLabel: "Borrar plan",
    });
    if (!confirmed) return;
    setDeletingId(plan.id);
    try {
      await api.runAction(
        { title: "Borrando plan", description: "Estamos desactivando el plan de tu historial..." },
        async () => {
          await api.request(`/api/profile/nutrition-plans/${plan.id}`, { method: "DELETE" });
          api.notify("Plan borrado.");
          await onChanged();
        },
        { quiet: true },
      );
    } catch (error) {
      api.notify(error.message || "No se pudo borrar el plan.", "error");
    } finally {
      setDeletingId(null);
    }
  }
  return (
    <Panel title="Plan alimenticio">
      <div className="current-plan-panel">
        <span className="current-plan-dot" style={{ background: planColor(currentPlan?.id || currentPlan?.name) }} />
        <div><small>PLAN ACTUAL</small><strong>{currentPlan?.name || "Sin plan activo"}</strong>{currentPlan && <span>Desde {readableDate(currentPlan.startDate)} · {currentPlan.dailyCalories} kcal</span>}</div>
        {currentPlan && <div className="current-plan-actions"><div className="current-plan-macros"><span>{currentPlan.proteinPercent}% P</span><span>{currentPlan.carbsPercent}% C</span><span>{currentPlan.fatPercent}% G</span></div><button type="button" className="secondary use-plan-button" onClick={() => startEdit(currentPlan)}><Icon name="edit" />Editar</button></div>}
      </div>
      <button type="button" className="primary add-plan-button" onClick={startCreate}><Icon name="add" />Agregar plan</button>
      <div className="plan-history">
        <h3>Historial de planes</h3>
        {plans.filter((plan) => !plan.current && plan.id !== currentPlan?.id).map((plan) => (
          <article key={plan.id || `${plan.name}-${plan.startDate}`}>
            <div className="plan-history-heading"><strong>{plan.name}</strong></div>
            <span>
              {plan.startDate} - {plan.endDate || "actual"}
            </span>
            <small>
              {plan.dailyCalories} kcal / {plan.proteinPercent}% P / {plan.carbsPercent}% C / {plan.fatPercent}% G
            </small>
            <div className="plan-history-actions">
              <button type="button" className="secondary use-plan-button" onClick={() => startEdit(plan)}><Icon name="edit" />Editar</button>
              <button type="button" className="secondary use-plan-button" disabled={Boolean(activatingId) || Boolean(deletingId)} onClick={() => activatePlan(plan)}>{activatingId === plan.id ? "Cambiando..." : "Usar este plan"}</button>
              <button type="button" className="secondary use-plan-button danger-text" disabled={Boolean(activatingId) || Boolean(deletingId)} onClick={() => deletePlan(plan)}><Icon name="delete" />{deletingId === plan.id ? "Borrando..." : "Borrar"}</button>
            </div>
          </article>
        ))}
      </div>
      {dialog && <NutritionPlanDialog key={dialog.plan?.id || "new"} api={api} plan={dialog.plan} onClose={() => setDialog(null)} onChanged={onChanged} />}
    </Panel>
  );
}
