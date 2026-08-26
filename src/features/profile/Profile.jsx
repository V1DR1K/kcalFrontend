import React, { useCallback, useEffect, useState } from "react";
import { Icon } from "../../components/Icon";
import { Header, Panel, Stat } from "../../components/Layout";
import { CatalogStatus } from "../catalog/CatalogComponents";
import { formatNumber } from "../../utils/format";
import { ChangePasswordForm as ProfileChangePasswordForm, NutritionTutorial as ProfileNutritionTutorial, WeightPanel as ProfileWeightPanel } from "./components/ProfilePanels";
import { NutritionPlanManager } from "./components/NutritionPlanManager";
import { TrainingPlanManager } from "./components/TrainingPlanManager";
import { trainingApi } from "../training/training-api";
import "../../styles/06-history.css";
import "../../styles/07-profile.css";

function quotaReset(value) {
  return new Intl.DateTimeFormat("es-AR", { hour: "2-digit", minute: "2-digit", day: "2-digit", month: "short" }).format(new Date(value));
}

export function Profile({ api, logout, mode = "nutrition" }) {
  const training = mode === "training";
  const [profile, setProfile] = useState(null);
  const [plans, setPlans] = useState([]);
  const [trainingExercises, setTrainingExercises] = useState([]);
  const [aiUsage, setAiUsage] = useState(null);
  const [weightEntries, setWeightEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [weight, setWeight] = useState("");
  const [savingWeight, setSavingWeight] = useState(false);
  const refreshPlanState = useCallback(
    async (savedPlan) => {
      if (savedPlan?.id) {
        setPlans((current) => [savedPlan, ...current.filter((plan) => plan.id !== savedPlan.id)]);
      }
      try {
        if (training) {
          const [nextProfile, nextPlansResponse, nextExercisesResponse] = await Promise.all([api.request("/api/profile", { cache: "no-store" }), trainingApi.plans(api, { includeInactive: true }), trainingApi.exercises(api)]);
          setProfile(nextProfile); setPlans(nextPlansResponse.items || []); setTrainingExercises(nextExercisesResponse.items || []);
        } else {
          const [nextProfile, nextPlans] = await Promise.all([api.request("/api/profile", { cache: "no-store" }), api.request("/api/profile/nutrition-plans", { cache: "no-store" })]);
          setProfile(nextProfile); setPlans(nextPlans);
        }
      } catch {
        api.notify("El plan se guardó, pero no pudimos refrescar la lista. Volvé a cargar el perfil.", "error");
      }
    },
    [api, training],
  );
  const load = useCallback(() => {
    setLoading(true);
    setError("");
    api.runAction(
      { title: "Cargando perfil", description: "Estamos preparando tus datos y planes..." },
      () => training
        ? Promise.all([api.request("/api/profile"), trainingApi.plans(api, { includeInactive: true }), trainingApi.exercises(api)])
        : Promise.all([api.request("/api/profile"), api.request("/api/profile/nutrition-plans"), api.request("/api/nutrition/ai-estimates/usage").catch(() => null), api.request("/api/profile/weight-entries").catch(() => [])]),
    )
      .then((response) => {
        if (training) {
          const [nextProfile, nextPlansResponse, nextExercisesResponse] = response;
          setProfile(nextProfile); setWeight(nextProfile.weightKg || ""); setPlans(nextPlansResponse.items || []); setTrainingExercises(nextExercisesResponse.items || []); setAiUsage(null); setWeightEntries([]);
        } else {
          const [nextProfile, nextPlans, nextAiUsage, nextWeightEntries] = response;
          setProfile(nextProfile); setWeight(nextProfile.weightKg || ""); setPlans(nextPlans); setTrainingExercises([]); setAiUsage(nextAiUsage); setWeightEntries(nextWeightEntries);
        }
      })
      .catch(() => setError("No pudimos cargar tu perfil."))
      .finally(() => setLoading(false));
  }, [api, training]);
  useEffect(() => {
    load();
  }, [load]);
  if (loading)
    return (
      <section className={`page ${training ? "training-page training-profile-page" : ""}`.trim()}>
        <Header title="Perfil" />
        <div className="page-loading-stack" aria-busy="true" aria-label="Cargando perfil"><div className="skeleton" /><div className="skeleton" /><div className="skeleton" /></div>
      </section>
    );
  if (error)
    return (
      <section className={`page ${training ? "training-page training-profile-page" : ""}`.trim()}>
        <Header title="Perfil" />
        <CatalogStatus error>
          {error}
          <button className="secondary" onClick={load}>
            Reintentar
          </button>
        </CatalogStatus>
      </section>
    );
  return (
    <section className={`page profile-page ${training ? "training-page training-profile-page training-profile-root" : ""}`.trim()}>
      <Header title="Perfil" />
      {training ? <>
        <p className="training-page-intro">Organizá tus planes de gimnasio y calistenia. El catálogo de ejercicios vive en Ejercicios.</p>
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
        <TrainingPlanManager api={api} plans={plans} exercises={trainingExercises} onChanged={load} />
        <div className="profile-support-grid training-profile-account-grid"><Panel title="Cuenta" className="account-panel"><p>Podés actualizar tu contraseña o cerrar tu sesión de forma segura en este dispositivo.</p><ProfileChangePasswordForm api={api} /><button className="danger-button" onClick={async () => { const confirmed = await api.confirm({ title: "¿Cerrar sesión?", description: "Tendrás que volver a ingresar para usar tu cuenta en este dispositivo.", confirmLabel: "Cerrar sesión", tone: "neutral" }); if (confirmed) logout(); }}><Icon name="logout" />Cerrar sesión</button></Panel></div>
      </> : <>
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
      </>}
      {!training && <><NutritionPlanManager api={api} plans={plans} onChanged={refreshPlanState} />
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
      </>}
    </section>
  );
}
