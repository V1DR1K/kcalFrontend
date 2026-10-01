import React, { useState } from "react";
import { Icon } from "../../../components/Icon";
import { Panel } from "../../../components/Layout";
import { readableDate, today } from "../../../utils/format";
import { trainingApi } from "../../training/training-api";
import { TrainingModuleBadge } from "../../training/TrainingComponents";
import { Input } from "../../../components/FormControls";
import { ModalShell } from "../../../components/dialog/ModalShell";
import { TrainingPlanDialog } from "./TrainingPlanDialog";

function currentPlans(plans) {
  return plans.filter((plan) => plan.active && (!plan.startDate || plan.startDate <= today()) && (!plan.endDate || plan.endDate >= today()));
}

export function TrainingPlanManager({ api, plans, exercises, onChanged }) {
  const [dialog, setDialog] = useState(null);
  const [busyId, setBusyId] = useState(null);
  const [copy, setCopy] = useState(null);
  const [copyError, setCopyError] = useState("");
  const activePlans = currentPlans(plans);

  async function toggle(plan) {
    if (!plan.active) {
      const replaced = plans.filter((item) => item.active && item.module === plan.module && item.id !== plan.id);
      if (replaced.length && !await api.confirm({ title: `¿Activar ${plan.name}?`, description: `Reemplazará a ${replaced.map((item) => item.name).join(", ")}. El historial se conserva.`, confirmLabel: "Activar plan" })) return;
    }
    setBusyId(plan.id);
    try {
      const detail = await trainingApi.plan(api, plan.id);
      await api.runAction({ title: "Actualizando plan", description: "Estamos cambiando su disponibilidad..." }, () => trainingApi.changePlanAvailability(api, plan.id, !plan.active, detail.version), { quiet: true });
      api.notify(plan.active ? "Plan desactivado." : "Plan activado.");
      await onChanged?.();
    } catch (error) {
      api.notify(error?.message || "No se pudo actualizar el plan.", "error");
    } finally {
      setBusyId(null);
    }
  }

  async function duplicate(event) {
    event.preventDefault();
    if (busyId || !copy?.name.trim()) return;
    setBusyId(copy.plan.id); setCopyError("");
    try {
      await trainingApi.duplicatePlan(api, copy.plan.id, copy.name.trim());
      api.notify("Copia creada como inactiva. Podés editarla antes de activarla.");
      setCopy(null); await onChanged?.();
    } catch (error) { setCopyError(error?.message || "No se pudo duplicar el plan."); }
    finally { setBusyId(null); }
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
              <button type="button" className="training-icon-action" aria-label={`Duplicar ${plan.name}`} onClick={() => { setCopyError(""); setCopy({ plan, name: `${plan.name} · copia` }); }}><Icon name="content_copy" /></button>
              <button type="button" className="training-icon-action training-delete-control" disabled={Boolean(busyId)} aria-label={`Eliminar ${plan.name}`} onClick={() => remove(plan)}><Icon name="delete" /></button>
            </div>
          </article>
        )) : <div className="training-empty-inline"><Icon name="fitness_center" /><span>Todavía no hay planes. El primero puede ser simple: un día y una meta clara.</span></div>}
      </div>
      {dialog && <TrainingPlanDialog key={dialog.plan?.id || "new"} api={api} plan={dialog.plan} plans={plans} exercises={exercises} onClose={() => setDialog(null)} onChanged={onChanged} />}
      {copy && <ModalShell title="Duplicar plan" description="La copia quedará inactiva. Tu plan actual seguirá vigente." onClose={() => setCopy(null)} closeDisabled={Boolean(busyId)} theme="training" footer={<><button type="button" className="training-secondary" disabled={Boolean(busyId)} onClick={() => setCopy(null)}>Cancelar</button><button type="submit" form="training-copy-plan" className="training-primary" disabled={Boolean(busyId) || !copy.name.trim()}>Crear copia</button></>}>
        <form id="training-copy-plan" className="training-editor-form" onSubmit={duplicate}><Input label="Nombre de la copia" value={copy.name} maxLength="120" required onChange={(event) => setCopy((current) => ({ ...current, name: event.target.value }))} />{copyError && <p role="alert">{copyError}</p>}</form>
      </ModalShell>}
    </Panel>
  );
}
