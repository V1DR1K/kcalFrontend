import React, { useCallback, useEffect, useState } from "react";
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

export function Profile({ api, logout }) {
  const [profile, setProfile] = useState(null);
  const [plans, setPlans] = useState([]);
  const [presets, setPresets] = useState([]);
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
    Promise.all([api.request("/api/profile"), api.request("/api/profile/nutrition-plans"), api.request("/api/profile/nutrition-plan-presets")])
      .then(([nextProfile, nextPlans, nextPresets]) => {
        setProfile(nextProfile);
        setWeight(nextProfile.weightKg || "");
        setPlans(nextPlans);
        setPresets(nextPresets);
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
      <Panel title="Registrar peso" className="weight-panel">
        <form onSubmit={async (event) => { event.preventDefault(); if (savingWeight) return; setSavingWeight(true); try { const updated = await api.runAction({ title: "Actualizando peso", description: "Estamos guardando tu nuevo registro..." }, () => api.request("/api/profile", { method: "PATCH", body: JSON.stringify({ weightKg: Number(weight) }) })); setProfile(updated); setWeight(updated.weightKg || ""); api.notify("Peso actualizado."); } catch { api.notify("No se pudo registrar el peso.", "error"); } finally { setSavingWeight(false); } }}>
          <Input label="Peso actual (kg)" type="number" min="20" max="400" step="0.1" inputMode="decimal" value={weight} onChange={(event) => setWeight(event.target.value)} required />
          <button className="secondary" disabled={savingWeight}>{savingWeight ? "Guardando…" : "Anotar peso"}</button>
        </form>
      </Panel>
      <NutritionPlanManager api={api} presets={presets} plans={plans} onChanged={loadPlans} />
      <NutritionTutorial />
      <Panel title="Cuenta" className="account-panel">
        <p>Podés cerrar tu sesión de forma segura en este dispositivo.</p>
        <button
          className="danger-button"
          onClick={async () => {
            const confirmed = await api.confirm({
              title: "Cerrar sesion?",
              description: "Tendras que volver a ingresar para usar tu cuenta en este dispositivo.",
              confirmLabel: "Cerrar sesion",
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

function NutritionPlanManager({ api, presets, plans, onChanged }) {
  const [creating, setCreating] = useState(false);
  const [editingPlan, setEditingPlan] = useState(null);
  const [selectedPreset, setSelectedPreset] = useState(null);
  const [saving, setSaving] = useState(false);
  const [activatingId, setActivatingId] = useState(null);
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
      );
    } catch {
      api.notify(editingPlan ? "No se pudo actualizar el plan. Revisa que no se superponga con otro." : "No se pudo guardar el plan. Revisa que no se superponga con otro.", "error");
    } finally {
      setSaving(false);
    }
  }
  async function activatePlan(plan) {
    if (activatingId || plan.id === currentPlan?.id) return;
    setActivatingId(plan.id);
    try {
      const payload = { name: plan.name, dailyCalories: plan.dailyCalories, proteinPercent: Number(plan.proteinPercent), carbsPercent: Number(plan.carbsPercent), fatPercent: Number(plan.fatPercent), startDate: today(), endDate: null };
      const replaceCurrentPlan = currentPlan?.id && currentPlan.startDate === today();
      await api.runAction(
        { title: "Cambiando plan", description: "Estamos activando tu plan alimenticio..." },
        async () => {
          await api.request(replaceCurrentPlan ? `/api/profile/nutrition-plans/${currentPlan.id}` : "/api/profile/nutrition-plans", { method: replaceCurrentPlan ? "PUT" : "POST", body: JSON.stringify(payload) });
          api.notify(`${plan.name} es ahora tu plan actual.`);
          await onChanged();
        },
      );
    } catch { api.notify("No se pudo cambiar el plan.", "error"); }
    finally { setActivatingId(null); }
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
      {editingPlan && <div className="editing-plan-banner"><Icon name="edit" /><div><strong>Editando {editingPlan.name}</strong><small>Los cambios se guardan sobre este plan del historial.</small></div><button type="button" className="ghost-icon" onClick={resetForm} aria-label="Cancelar edicion"><Icon name="close" /></button></div>}
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
            <div className="split">
              <Input label="Fecha inicio" type="date" value={form.startDate} onChange={(event) => setField("startDate", event.target.value)} required />
              <Input label="Fecha fin opcional" type="date" min={form.startDate} value={form.endDate} onChange={(event) => setField("endDate", event.target.value)} />
            </div>
          </div>
        </details>
        <button className="primary" disabled={saving || Math.round(total * 10) / 10 !== 100}>
          {saving ? "Guardando..." : formMode === "edit" ? "Guardar cambios" : "Guardar nuevo plan"}
        </button>
      </form>
      </>}
      <div className="plan-history">
        <h3>Historial de planes</h3>
        {plans.map((plan) => (
          <article className={plan.id === currentPlan?.id ? "active" : ""} key={plan.id || `${plan.name}-${plan.startDate}`}>
            <div className="plan-history-heading"><strong>{plan.name}</strong><div className="plan-history-actions">{plan.id === currentPlan?.id && <span className="active-plan-badge">Actual</span>}<button type="button" className="secondary use-plan-button" onClick={() => startEdit(plan)}><Icon name="edit" />Editar</button>{plan.id !== currentPlan?.id && <button className="secondary use-plan-button" disabled={Boolean(activatingId)} onClick={() => activatePlan(plan)}>{activatingId === plan.id ? "Cambiando..." : "Usar este plan"}</button>}</div></div>
            <span>
              {plan.startDate} - {plan.endDate || "actual"}
            </span>
            <small>
              {plan.dailyCalories} kcal / {plan.proteinPercent}% P / {plan.carbsPercent}% C / {plan.fatPercent}% G
            </small>
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
    ["Calorias", "Son tu presupuesto diario de energia. Si el objetivo no se sostiene en la vida real, conviene ajustar antes que abandonar."],
    ["Proteinas", "Ayudan con saciedad y mantenimiento muscular. Pensalas como una base diaria, no como algo solo para deportistas."],
    ["Carbohidratos", "Son una fuente practica de energia. Su cantidad puede subir si entrenas mas o bajar si preferis comidas mas grasas."],
    ["Grasas", "Son importantes para hormonas, absorcion de vitaminas y adherencia. Priorizá fuentes de calidad."],
    ["Como elegir", "Empeza balanceado, medí adherencia y progreso dos semanas, y ajustá de a poco. Si tenes patologias, consultá a un profesional."],
  ];
  return (
    <Panel title="Mini guia para pensar tu alimentacion">
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
