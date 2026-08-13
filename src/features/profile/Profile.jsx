import React, { useCallback, useEffect, useState } from "react";
import { REFRESH_KEY, TOKEN_KEY } from "../../config/app";
import { Input } from "../../components/FormControls";
import { Icon } from "../../components/Icon";
import { Header, Panel, Stat } from "../../components/Layout";
import { CatalogStatus } from "../catalog/CatalogComponents";
import { formatNumber, macroGrams, readableDate, today } from "../../utils/format";
import "../../styles/06-history.css";
import "../../styles/07-profile.css";

function planColor(value) {
  const palette = ["#4edea3", "#89ceff", "#ffd166", "#c7a6ff", "#ff8fa3"];
  const hash = String(value || "plan").split("").reduce((sum, char) => sum + char.charCodeAt(0), 0);
  return palette[hash % palette.length];
}

function quotaReset(value) {
  return new Intl.DateTimeFormat("es-AR", { hour: "2-digit", minute: "2-digit", day: "2-digit", month: "short" }).format(new Date(value));
}

export function Profile({ api, logout }) {
  const [profile, setProfile] = useState(null);
  const [plans, setPlans] = useState([]);
  const [presets, setPresets] = useState([]);
  const [aiUsage, setAiUsage] = useState(null);
  const [weightEntries, setWeightEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [weight, setWeight] = useState("");
  const [savingWeight, setSavingWeight] = useState(false);
  const loadPlans = useCallback(
    () =>
      api
        .request("/api/profile/nutrition-plans")
        .then(setPlans)
        .catch(() => api.notify("No se pudieron actualizar los planes.", "error")),
    [api],
  );
  const load = useCallback(() => {
    setLoading(true);
    setError("");
    Promise.all([api.request("/api/profile"), api.request("/api/profile/nutrition-plans"), api.request("/api/profile/nutrition-plan-presets"), api.request("/api/nutrition/ai-estimates/usage").catch(() => null), api.request("/api/profile/weight-entries").catch(() => [])])
      .then(([nextProfile, nextPlans, nextPresets, nextAiUsage, nextWeightEntries]) => {
        setProfile(nextProfile);
        setWeight(nextProfile.weightKg || "");
        setPlans(nextPlans);
        setPresets(nextPresets);
        setAiUsage(nextAiUsage);
        setWeightEntries(nextWeightEntries);
      })
      .catch(() => setError("No pudimos cargar tu perfil."))
      .finally(() => setLoading(false));
  }, [api]);
  useEffect(() => {
    load();
  }, [load]);
  if (loading)
    return (
      <section className="page">
        <Header title="Mi perfil" />
        <CatalogStatus>Cargando perfil…</CatalogStatus>
      </section>
    );
  if (error)
    return (
      <section className="page">
        <Header title="Mi perfil" />
        <CatalogStatus error>
          {error}
          <button className="secondary" onClick={load}>
            Reintentar
          </button>
        </CatalogStatus>
      </section>
    );
  return (
    <section className="page">
      <Header title="Mi perfil" />
      <Panel title={profile?.fullName || "Perfil"}>
        <div className="grid three">
          <Stat icon="monitor_weight" label="Peso" value={`${formatNumber(profile?.weightKg, 1)} kg`} />
          <Stat icon="height" label="Altura" value={`${formatNumber(profile?.heightCm)} cm`} />
          <Stat icon="local_fire_department" label="Meta diaria" value={`${formatNumber(profile?.dailyCalorieGoal)} kcal`} />
        </div>
      </Panel>
      <WeightPanel api={api} profile={profile} setProfile={setProfile} entries={weightEntries} setEntries={setWeightEntries} setWeight={setWeight} weight={weight} savingWeight={savingWeight} setSavingWeight={setSavingWeight} />
      <NutritionPlanManager api={api} presets={presets} plans={plans} onChanged={loadPlans} />
      <Panel title="Fotos con IA" className="ai-usage-panel">
        {aiUsage?.available ? <><div><Icon name="photo_camera" /><span><strong>{aiUsage.blockedUntil ? "Gemini sin cuota" : "Sin límite interno"}</strong><small>{aiUsage.blockedUntil ? `Probá nuevamente desde ${quotaReset(aiUsage.blockedUntil)}` : `${aiUsage.used} consultas realizadas hoy`}</small></span></div><p>{aiUsage.blockedUntil ? "Gemini informó que no quedan solicitudes disponibles por ahora. La hora mostrada proviene de Gemini; si no la informa, se usa su próximo reinicio diario estimado." : "ScaleGrams no limita tus fotos: solo registra el uso y mostrará cuándo Gemini vuelva a aceptar consultas."}</p></> : <p>La estimación por foto no está disponible por el momento.</p>}
      </Panel>
      <NutritionTutorial />
      <Panel title="Cuenta" className="account-panel">
        <p>Podés actualizar tu contraseña o cerrar tu sesión de forma segura en este dispositivo.</p>
        <ChangePasswordForm api={api} />
        <button
          className="danger-button"
          onClick={async () => {
            const confirmed = await api.confirm({
              title: "¿Cerrar sesión?",
              description: "Tendrás que volver a ingresar para usar tu cuenta en este dispositivo.",
              confirmLabel: "Cerrar sesión",
              tone: "neutral",
            });
            if (confirmed) logout();
          }}
        >
          <Icon name="logout" />Cerrar sesión
        </button>
      </Panel>
    </section>
  );
}

function WeightPanel({ api, profile, setProfile, entries, setEntries, weight, setWeight, savingWeight, setSavingWeight }) {
  async function record(event) {
    event.preventDefault();
    if (savingWeight) return;
    setSavingWeight(true);
    try {
      const payload = await api.runAction(
        { title: "Anotando peso", description: "Estamos guardando tu registro..." },
        () => api.request("/api/profile/weight-entries", { method: "POST", body: JSON.stringify({ weightKg: Number(weight), entryDate: today() }) }),
        { quiet: true },
      );
      setEntries((current) => {
        const rest = current.filter((entry) => entry.entryDate !== payload.entryDate);
        return [...rest, payload].sort((a, b) => a.entryDate.localeCompare(b.entryDate));
      });
      setProfile({ ...profile, weightKg: Number(payload.weightKg) });
      setWeight(payload.weightKg);
      api.notify("Peso registrado.");
    } catch {
      api.notify("No se pudo registrar el peso.", "error");
    } finally {
      setSavingWeight(false);
    }
  }
  async function remove(entry) {
    const confirmed = await api.confirm({
      title: "¿Quitar este registro?",
      description: `Se borrará el peso del ${entry.entryDate} (${formatNumber(entry.weightKg, 1)} kg).`,
      confirmLabel: "Quitar",
      tone: "neutral",
    });
    if (!confirmed) return;
    try {
      await api.request(`/api/profile/weight-entries/${entry.id}`, { method: "DELETE" });
      setEntries((current) => current.filter((item) => item.id !== entry.id));
      api.notify("Registro eliminado.");
    } catch {
      api.notify("No se pudo eliminar el registro.", "error");
    }
  }
  const filtered = entries.filter((entry) => entry.entryDate <= today());
  return (
    <Panel title="Peso" className="weight-panel">
      <div className="grid three weight-summary">
        <Stat icon="monitor_weight" label="Actual" value={`${formatNumber(profile?.weightKg, 1)} kg`} />
        {entries.length === 0 ? <Stat icon="trending_up" label="Tendencia" value="Sin datos" /> : <Stat icon={latestDelta(entries) >= 0 ? "trending_up" : "trending_down"} label={latestDelta(entries) === 0 ? "Último cambio" : "Cambio últ. registro"} value={`${latestDelta(entries) > 0 ? "+" : ""}${formatNumber(latestDelta(entries), 1)} kg`} />}
        <Stat icon="flag" label="Meta" value={profile?.targetWeightKg ? `${formatNumber(profile.targetWeightKg, 1)} kg` : "—"} />
      </div>
      <WeightChart entries={filtered} />
      <form onSubmit={record} className="weight-record-form">
        <Input label="Peso actual (kg)" type="number" min="20" max="400" step="0.1" inputMode="decimal" value={weight} onChange={(event) => setWeight(event.target.value)} required />
        <button className="secondary" disabled={savingWeight}>{savingWeight ? "Guardando…" : "Anotar peso"}</button>
      </form>
      {entries.length > 0 && <div className="weight-history">
        {entries.slice().reverse().map((entry) => (
          <div className="weight-history-row" key={entry.id}>
            <span className="weight-history-date">{readableDate(entry.entryDate)}</span>
            <strong>{formatNumber(entry.weightKg, 1)} kg</strong>
            <button type="button" className="ghost-icon" onClick={() => remove(entry)} aria-label={`Quitar peso del ${entry.entryDate}`}><Icon name="delete" /></button>
          </div>
        ))}
      </div>}
    </Panel>
  );
}

function latestDelta(entries) {
  const last = entries[entries.length - 1];
  const previous = entries[entries.length - 2];
  if (!last || !previous) return 0;
  return Number(last.weightKg) - Number(previous.weightKg);
}

function WeightChart({ entries }) {
  if (entries.length < 2) {
    return <p className="weight-chart-empty">Anotá tu peso dos o más veces para ver la curva.</p>;
  }
  const width = 640;
  const height = 170;
  const padX = 34;
  const padTop = 18;
  const padBottom = 34;
  const values = entries.map((entry) => Number(entry.weightKg));
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const plotHeight = height - padTop - padBottom;
  const xFor = (index) => padX + (index / (entries.length - 1)) * (width - padX * 2);
  const yFor = (value) => padTop + ((max - value) / span) * plotHeight;
  const points = entries.map((entry, index) => `${xFor(index)},${yFor(Number(entry.weightKg))}`).join(" ");
  const areaPoints = `${padX},${padTop + plotHeight} ${points} ${xFor(entries.length - 1)},${padTop + plotHeight}`;
  const midY = yFor((min + max) / 2);
  return (
    <div className="weight-chart">
      <svg viewBox={`0 0 ${width} ${height}`} className="weight-curve" role="img" aria-label="Curva de peso">
        <defs>
          <linearGradient id="weightArea" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--primary)" stopOpacity="0.28" />
            <stop offset="100%" stopColor="var(--primary)" stopOpacity="0" />
          </linearGradient>
        </defs>
        <line x1={padX} y1={yFor(min)} x2={width - padX} y2={yFor(min)} stroke="var(--outline)" strokeDasharray="3 4" />
        <line x1={padX} y1={midY} x2={width - padX} y2={midY} stroke="var(--outline)" strokeDasharray="3 4" />
        <line x1={padX} y1={yFor(max)} x2={width - padX} y2={yFor(max)} stroke="var(--outline)" strokeDasharray="3 4" />
        <polygon points={areaPoints} fill="url(#weightArea)" />
        <polyline points={points} fill="none" stroke="var(--primary)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
        {entries.map((entry, index) => (
          <circle key={entry.id} cx={xFor(index)} cy={yFor(Number(entry.weightKg))} r="4.5" fill="var(--background)" stroke="var(--primary)" strokeWidth="2.5" />
        ))}
        <text x={8} y={yFor(max) + 4} fontSize="11" fill="var(--muted)">{formatNumber(max, 1)}</text>
        <text x={8} y={yFor(min) + 4} fontSize="11" fill="var(--muted)">{formatNumber(min, 1)}</text>
        <text x={xFor(0)} y={height - 8} fontSize="11" fill="var(--muted)">{dateLabel(entries[0].entryDate)}</text>
        <text x={xFor(entries.length - 1)} y={height - 8} fontSize="11" fill="var(--muted)" textAnchor="end">{dateLabel(entries[entries.length - 1].entryDate)}</text>
        <text x={(padX + width - padX) / 2} y={12} fontSize="11" fill="var(--muted)" textAnchor="middle">{`${formatNumber(min, 1)} – ${formatNumber(max, 1)} kg`}</text>
      </svg>
    </div>
  );
}

function dateLabel(value) {
  const parts = String(value || "").split("-");
  return parts.length === 3 ? `${parts[2]}/${parts[1]}` : value;
}

function ChangePasswordForm({ api }) {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [fieldErrors, setFieldErrors] = useState({});
  async function submit(event) {
    event.preventDefault();
    setFieldErrors({});
    if (newPassword.length < 8) {
      setFieldErrors({ newPassword: "La contraseña debe tener al menos 8 caracteres." });
      return;
    }
    if (newPassword !== confirmPassword) {
      setFieldErrors({ confirmPassword: "Las contraseñas no coinciden." });
      return;
    }
    if (saving) return;
    setSaving(true);
    try {
      const session = await api.runAction(
        { title: "Actualizando contraseña", description: "Creamos una nueva sesión segura..." },
        () =>
          api.request("/api/auth/change-password", {
            method: "PUT",
            body: JSON.stringify({ currentPassword, newPassword }),
          }),
        { quiet: true },
      );
      if (session?.token) localStorage.setItem(TOKEN_KEY, session.token);
      if (session?.refreshToken) localStorage.setItem(REFRESH_KEY, session.refreshToken);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      api.notify("Contraseña actualizada. Tu sesión sigue activa.");
    } catch (error) {
      const message = error?.message || "No se pudo actualizar la contraseña.";
      api.notify(message, "error");
    } finally {
      setSaving(false);
    }
  }
  return (
    <form className="change-password-form" onSubmit={submit}>
      <strong>Cambiar contraseña</strong>
      <Input label="Contraseña actual" type="password" autoComplete="current-password" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} required error={fieldErrors.currentPassword} />
      <div className="split">
        <Input label="Nueva contraseña" type="password" autoComplete="new-password" minLength="8" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} required error={fieldErrors.newPassword} />
        <Input label="Repetir nueva" type="password" autoComplete="new-password" minLength="8" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} required error={fieldErrors.confirmPassword} />
      </div>
      <button className="secondary" disabled={saving}>{saving ? "Guardando..." : "Cambiar contraseña"}</button>
    </form>
  );
}

function NutritionPlanManager({ api, presets, plans, onChanged }) {
  const [creating, setCreating] = useState(false);
  const [editingPlan, setEditingPlan] = useState(null);
  const [selectedPreset, setSelectedPreset] = useState(null);
  const [saving, setSaving] = useState(false);
  const [activatingId, setActivatingId] = useState(null);
  const [deletingId, setDeletingId] = useState(null);
  const initialForm = {
    name: "Plan manual",
    dailyCalories: 2200,
    proteinPercent: 25,
    carbsPercent: 50,
    fatPercent: 25,
    startDate: today(),
    endDate: "",
  };
  const [form, setForm] = useState(initialForm);
  const total = Number(form.proteinPercent) + Number(form.carbsPercent) + Number(form.fatPercent);
  const grams = {
    protein: macroGrams(form.dailyCalories, form.proteinPercent, 4),
    carbs: macroGrams(form.dailyCalories, form.carbsPercent, 4),
    fat: macroGrams(form.dailyCalories, form.fatPercent, 9),
  };
  const currentPlan = plans.find((plan) => plan.startDate <= today() && (!plan.endDate || plan.endDate >= today()));
  const formVisible = creating || Boolean(editingPlan);
  const formMode = editingPlan ? "edit" : "create";
  function resetForm() {
    setForm(initialForm);
    setSelectedPreset(null);
    setEditingPlan(null);
    setCreating(false);
  }
  function startCreate() {
    if (creating) {
      resetForm();
      return;
    }
    setEditingPlan(null);
    setSelectedPreset(null);
    setForm(initialForm);
    setCreating(true);
  }
  function startEdit(plan) {
    setCreating(false);
    setSelectedPreset(null);
    setEditingPlan(plan);
    setForm({
      name: plan.name,
      dailyCalories: plan.dailyCalories,
      proteinPercent: Number(plan.proteinPercent),
      carbsPercent: Number(plan.carbsPercent),
      fatPercent: Number(plan.fatPercent),
      startDate: plan.startDate,
      endDate: plan.endDate || "",
    });
  }
  function setField(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }
  function setMacro(field, value) {
    setSelectedPreset(null);
    setForm((current) => {
      const otherFields = ["proteinPercent", "carbsPercent", "fatPercent"].filter((key) => key !== field);
      const remaining = Math.max(0, 100 - otherFields.reduce((sum, key) => sum + Number(current[key] || 0), 0));
      return {
        ...current,
        [field]: Math.min(remaining, Math.max(0, Number(value))),
      };
    });
  }
  function applyPreset(preset) {
    setSelectedPreset(preset.key);
    setForm((current) => ({
      ...current,
      name: preset.name,
      proteinPercent: preset.proteinPercent,
      carbsPercent: preset.carbsPercent,
      fatPercent: preset.fatPercent,
    }));
  }
  async function submit(event) {
    event.preventDefault();
    if (saving) return;
    if (Math.round(total * 10) / 10 !== 100) {
      api.notify("La suma de macros debe dar 100%.", "error");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        ...form,
        dailyCalories: Number(form.dailyCalories),
        proteinPercent: Number(form.proteinPercent),
        carbsPercent: Number(form.carbsPercent),
        fatPercent: Number(form.fatPercent),
        endDate: form.endDate || null,
      };
      await api.runAction(
        {
          title: editingPlan ? "Actualizando plan" : "Guardando plan",
          description: "Estamos recalculando tu plan alimenticio...",
        },
        async () => {
          await api.request(editingPlan ? `/api/profile/nutrition-plans/${editingPlan.id}` : "/api/profile/nutrition-plans", {
            method: editingPlan ? "PUT" : "POST",
            body: JSON.stringify({
              ...payload,
            }),
          });
          api.notify(editingPlan ? "Plan alimenticio actualizado." : "Plan alimenticio guardado.");
          resetForm();
          await onChanged();
        },
        { quiet: true },
      );
    } catch {
      api.notify(editingPlan ? "No se pudo actualizar el plan. Revisá que no se superponga con otro." : "No se pudo guardar el plan. Revisá que no se superponga con otro.", "error");
    } finally {
      setSaving(false);
    }
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
        {currentPlan && <div className="current-plan-macros"><span>{currentPlan.proteinPercent}% P</span><span>{currentPlan.carbsPercent}% C</span><span>{currentPlan.fatPercent}% G</span></div>}
      </div>
      <button type="button" className="primary add-plan-button" onClick={startCreate}><Icon name={creating ? "close" : "add"} />{creating ? "Cancelar" : "Agregar plan"}</button>
      {formVisible && <>
      {editingPlan && <div className="editing-plan-banner"><Icon name="edit" /><div><strong>Editando {editingPlan.name}</strong><small>Los cambios se guardan sobre este plan del historial.</small></div><button type="button" className="ghost-icon" onClick={resetForm} aria-label="Cancelar edición"><Icon name="close" /></button></div>}
      <div className="plan-calorie-step">
        <span className="step-number">1</span><div><strong>Definí tus calorías diarias</strong><small>Esta base se usa para calcular los gramos de cada macronutriente.</small></div>
        <Input label="Calorías por día" type="number" min="800" max="10000" step="10" value={form.dailyCalories} onChange={(event) => setField("dailyCalories", event.target.value)} required />
      </div>
      <div className="plan-step-heading"><span className="step-number">2</span><div><strong>Distribuí tus macronutrientes</strong><small>Elegí una propuesta o ajustá los porcentajes.</small></div></div>
      <div className="preset-grid">
        {presets.map((preset) => (
          <button type="button" className={`preset-card ${selectedPreset === preset.key ? "selected" : ""}`} key={preset.key} onClick={() => applyPreset(preset)}>
            <strong>{preset.name}</strong>
            <span>{preset.description}</span>
            <small>
              {preset.proteinPercent}% P / {preset.carbsPercent}% C / {preset.fatPercent}% G
            </small>
          </button>
        ))}
      </div>
      <form className="form-grid nutrition-plan-form" onSubmit={submit}>
        <div className="plan-intro">
          <strong>Ajustá tu distribución</strong>
          <span>Elegí un objetivo y afiná los porcentajes sin superar el 100%.</span>
        </div>
        <div className="macro-editor">
          <MacroControl label="Proteínas" value={form.proteinPercent} grams={grams.protein} onChange={(value) => setMacro("proteinPercent", value)} tone="protein" />
          <MacroControl label="Carbohidratos" value={form.carbsPercent} grams={grams.carbs} onChange={(value) => setMacro("carbsPercent", value)} tone="carbs" />
          <MacroControl label="Grasas" value={form.fatPercent} grams={grams.fat} onChange={(value) => setMacro("fatPercent", value)} tone="fat" />
        </div>
        <div className="macro-distribution" aria-label="Distribución de macronutrientes">
          <span className="protein" style={{ width: `${form.proteinPercent}%` }} />
          <span className="carbs" style={{ width: `${form.carbsPercent}%` }} />
          <span className="fat" style={{ width: `${form.fatPercent}%` }} />
        </div>
        <div className={`macro-total ${Math.round(total * 10) / 10 === 100 ? "ok" : "bad"}`}>
          <strong>Total {formatNumber(total, 1)}%</strong>
          <span>
            {Math.max(0, 100 - total)}% disponible · {grams.protein}g proteínas / {grams.carbs}g carbs / {grams.fat}g grasas
          </span>
        </div>
        <details className="plan-details">
          <summary>Detalles del plan</summary>
          <div className="form-grid">
            <Input label="Nombre del plan" value={form.name} onChange={(event) => setField("name", event.target.value)} minLength="2" required />
          </div>
        </details>
        <button className="primary" disabled={saving || Math.round(total * 10) / 10 !== 100}>
          {saving ? "Guardando..." : formMode === "edit" ? "Guardar cambios" : "Guardar nuevo plan"}
        </button>
      </form>
      </>}
      <div className="plan-history">
        <h3>Historial de planes</h3>
        {plans.filter((plan) => plan.id !== currentPlan?.id).map((plan) => (
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
    </Panel>
  );
}

function MacroControl({ label, value, grams, onChange, tone }) {
  return (
    <label className={`macro-control ${tone}`}>
      <span>
        <strong>{label}</strong>
        <small>{grams}g</small>
      </span>
      <output>{formatNumber(value, 1)}%</output>
      <input type="range" min="0" max="100" step="0.5" value={value} onChange={(event) => onChange(event.target.value)} />
    </label>
  );
}

function NutritionTutorial() {
  const items = [
    ["Calorías", "Son tu presupuesto diario de energía. Si el objetivo no se sostiene en la vida real, conviene ajustar antes que abandonar."],
    ["Proteínas", "Ayudan con saciedad y mantenimiento muscular. Pensalas como una base diaria, no como algo solo para deportistas."],
    ["Carbohidratos", "Son una fuente práctica de energía. Su cantidad puede subir si entrenás más o bajar si preferís comidas más grasas."],
    ["Grasas", "Son importantes para hormonas, absorción de vitaminas y adherencia. Priorizá fuentes de calidad."],
    ["Cómo elegir", "Empezá balanceado, medí adherencia y progreso dos semanas, y ajustá de a poco. Si tenés patologías, consultá a un profesional."],
  ];
  return (
    <Panel title="Mini guía para pensar tu alimentación">
      <div className="tutorial-list">
        {items.map(([title, body]) => (
          <details key={title}>
            <summary>{title}</summary>
            <p>{body}</p>
          </details>
        ))}
      </div>
    </Panel>
  );
}
