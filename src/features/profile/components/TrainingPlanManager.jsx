import React, { useState } from "react";
import { Icon } from "../../../components/Icon";
import { Panel } from "../../../components/Layout";
import { readableDate, today } from "../../../utils/format";
import { trainingApi } from "../../training/training-api";
import { TrainingModuleBadge } from "../../training/TrainingComponents";
import { planPayload } from "../../training/training-utils";
import { TrainingPlanDialog } from "./TrainingPlanDialog";

function currentPlans(plans) {
  return plans.filter((plan) => plan.active && (!plan.startDate || plan.startDate <= today()) && (!plan.endDate || plan.endDate >= today()));
}

export function TrainingPlanManager({ api, plans, exercises, onChanged }) {
  const [dialog, setDialog] = useState(null);
  const [busyId, setBusyId] = useState(null);
  const activePlans = currentPlans(plans);

  async function toggle(plan) {
    setBusyId(plan.id);
    try {
      const detail = await trainingApi.plan(api, plan.id);
      await api.runAction({ title: "Actualizando plan", description: "Estamos cambiando su disponibilidad..." }, () => trainingApi.savePlan(api, detail, planPayload({ ...detail, active: !plan.active })), { quiet: true });
      api.notify(plan.active ? "Plan desactivado." : "Plan activado.");
      await onChanged?.();
    } catch (error) {
      api.notify(error?.message || "No se pudo actualizar el plan.", "error");
    } finally {
      setBusyId(null);
    }
  }

  async function duplicate(plan) {
    const name = window.prompt("Nombre de la copia", `${plan.name} · copia`);
    if (!name?.trim()) return;
    try {
      await api.runAction({ title: "Duplicando plan", description: "Estamos creando una copia editable..." }, () => trainingApi.duplicatePlan(api, plan.id, name.trim()), { quiet: true });
      api.notify("Plan duplicado.");
      await onChanged?.();
    } catch (error) {
      api.notify(error?.message || "No se pudo duplicar el plan.", "error");
    }
  }

  async function remove(plan) {
    const confirmed = await api.confirm({ title: `¿Eliminar ${plan.name}?`, description: "El plan dejará de estar disponible para nuevas sesiones. Sus registros históricos se conservan.", confirmLabel: "Eliminar plan" });
    if (!confirmed) return;
    setBusyId(plan.id);
    try {
      await api.runAction({ title: "Eliminando plan", description: "Estamos actualizando tu historial..." }, () => trainingApi.deletePlan(api, plan.id), { quiet: true });
      api.notify("Plan eliminado.");
      await onChanged?.();
    } catch (error) {
      api.notify(error?.message || "No se pudo eliminar el plan.", "error");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <Panel title="Planes de entrenamiento" className="training-plan-manager">
      <div className="training-plan-current">
        {activePlans.length ? activePlans.map((plan) => (
          <div className="training-plan-current-item" key={plan.id}>
            <div>
              <TrainingModuleBadge module={plan.module} />
              <small>PLAN ACTIVO</small>
              <strong>{plan.name}</strong>
              <span>{plan.targetSessionsPerWeek} sesiones por semana · {plan.frequencyMode === "FIXED" ? "días fijos" : "orden dinámico"}</span>
            </div>
            <button type="button" className="training-secondary" onClick={() => setDialog({ plan })}><Icon name="edit" />Editar</button>
          </div>
        )) : (
          <div className="training-plan-current-item">
            <div>
              <TrainingModuleBadge module="GYM" />
              <small>PLAN ACTIVO</small>
              <strong>Sin plan activo</strong>
              <span>Creá una estructura para que el día muestre tu próxima sesión.</span>
            </div>
          </div>
        )}
      </div>
      <button type="button" className="training-primary training-plan-add" onClick={() => setDialog({ plan: null })}><Icon name="add" />Agregar plan</button>
      <div className="training-plan-history">
        <div className="training-section-heading"><div><h3>Historial de planes</h3><span>Activos y archivados, separados de tus ejercicios.</span></div><span>{plans.length} planes</span></div>
        {plans.length ? plans.map((plan) => (
          <article key={plan.id} className={plan.active ? "training-plan-history-item is-active" : "training-plan-history-item"}>
            <div><TrainingModuleBadge module={plan.module} /><strong>{plan.name}</strong><span>{plan.startDate ? readableDate(plan.startDate) : "Sin fecha de inicio"} {plan.endDate ? `· hasta ${readableDate(plan.endDate)}` : "· vigente"}</span><small>{plan.targetSessionsPerWeek} sesiones/semana · {plan.frequencyMode === "FIXED" ? "fijo" : "dinámico"}</small></div>
            <div className="training-plan-history-actions">
              <button type="button" className="training-secondary" onClick={() => setDialog({ plan })}>Editar</button>
              <button type="button" className="training-icon-action" disabled={busyId === plan.id} aria-label={plan.active ? `Desactivar ${plan.name}` : `Activar ${plan.name}`} onClick={() => toggle(plan)}><Icon name={plan.active ? "pause" : "play_arrow"} /></button>
              <button type="button" className="training-icon-action" aria-label={`Duplicar ${plan.name}`} onClick={() => duplicate(plan)}><Icon name="content_copy" /></button>
              <button type="button" className="training-icon-action training-delete-control" disabled={Boolean(busyId)} aria-label={`Eliminar ${plan.name}`} onClick={() => remove(plan)}><Icon name="delete" /></button>
            </div>
          </article>
        )) : <div className="training-empty-inline"><Icon name="fitness_center" /><span>Todavía no hay planes. El primero puede ser simple: un día y una meta clara.</span></div>}
      </div>
      {dialog && <TrainingPlanDialog key={dialog.plan?.id || "new"} api={api} plan={dialog.plan} exercises={exercises} onClose={() => setDialog(null)} onChanged={onChanged} />}
    </Panel>
  );
}
