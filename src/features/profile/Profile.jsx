import React, { useCallback, useEffect, useState } from "react";
import { Icon } from "../../components/Icon";
import { Header, Panel, Stat } from "../../components/Layout";
import { CatalogStatus } from "../catalog/CatalogComponents";
import { formatNumber } from "../../utils/format";
import { ChangePasswordForm as ProfileChangePasswordForm, NutritionTutorial as ProfileNutritionTutorial, WeightPanel as ProfileWeightPanel } from "./components/ProfilePanels";
import { NutritionPlanManager } from "./components/NutritionPlanManager";
import "../../styles/06-history.css";
import "../../styles/07-profile.css";

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
    api.runAction(
      { title: "Cargando perfil", description: "Estamos preparando tus datos y planes..." },
      () => Promise.all([api.request("/api/profile"), api.request("/api/profile/nutrition-plans"), api.request("/api/profile/nutrition-plan-presets"), api.request("/api/nutrition/ai-estimates/usage").catch(() => null), api.request("/api/profile/weight-entries").catch(() => [])]),
    )
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
    <section className="page profile-page">
      <Header title="Mi perfil" />
      <div className="profile-overview-grid">
        <Panel title={profile?.fullName || "Perfil"}>
          <div className="grid three">
            <Stat icon="monitor_weight" label="Peso" value={`${formatNumber(profile?.weightKg, 1)} kg`} />
            <Stat icon="height" label="Altura" value={`${formatNumber(profile?.heightCm)} cm`} />
            <Stat icon="local_fire_department" label="Meta diaria" value={`${formatNumber(profile?.dailyCalorieGoal)} kcal`} />
          </div>
        </Panel>
        <ProfileWeightPanel api={api} profile={profile} setProfile={setProfile} entries={weightEntries} setEntries={setWeightEntries} setWeight={setWeight} weight={weight} savingWeight={savingWeight} setSavingWeight={setSavingWeight} />
      </div>
      <NutritionPlanManager api={api} presets={presets} plans={plans} onChanged={loadPlans} />
      <div className="profile-support-grid">
        <Panel title="Fotos con IA" className="ai-usage-panel">
          {aiUsage?.available ? <><div><Icon name="photo_camera" /><span><strong>{aiUsage.blockedUntil ? "Gemini sin cuota" : "Sin límite interno"}</strong><small>{aiUsage.blockedUntil ? `Probá nuevamente desde ${quotaReset(aiUsage.blockedUntil)}` : `${aiUsage.used} consultas realizadas hoy`}</small></span></div><p>{aiUsage.blockedUntil ? "Gemini informó que no quedan solicitudes disponibles por ahora. La hora mostrada proviene de Gemini; si no la informa, se usa su próximo reinicio diario estimado." : "ScaleGrams no limita tus fotos: solo registra el uso y mostrará cuándo Gemini vuelva a aceptar consultas."}</p></> : <p>La estimación por foto no está disponible por el momento.</p>}
        </Panel>
        <ProfileNutritionTutorial />
        <Panel title="Cuenta" className="account-panel">
          <p>Podés actualizar tu contraseña o cerrar tu sesión de forma segura en este dispositivo.</p>
          <ProfileChangePasswordForm api={api} />
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
      </div>
    </section>
  );
}
