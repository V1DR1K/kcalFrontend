import React, { useCallback, useEffect, useState } from "react";
import { Icon } from "../../components/Icon";
import { Header, Panel, Stat } from "../../components/Layout";
import { CatalogStatus } from "../catalog/CatalogComponents";
import { formatNumber } from "../../utils/format";
import { NutritionTutorial as ProfileNutritionTutorial, WeightPanel as ProfileWeightPanel } from "./components/ProfilePanels";
import "../../styles/06-history.css";
import "../../styles/07-profile.css";

function quotaReset(value) {
  return new Intl.DateTimeFormat("es-AR", { hour: "2-digit", minute: "2-digit", day: "2-digit", month: "short" }).format(new Date(value));
}

export function Profile({ api, logout, mode = "nutrition" }) {
  const training = mode === "training";
  const [profile, setProfile] = useState(null);
  const [aiUsage, setAiUsage] = useState(null);
  const [weightEntries, setWeightEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [weight, setWeight] = useState("");
  const [savingWeight, setSavingWeight] = useState(false);
  const load = useCallback(() => {
    setLoading(true);
    setError("");
    api.runAction(
      { title: "Cargando perfil", description: "Estamos preparando tus datos..." },
      () => training
        ? Promise.all([api.request("/api/profile")])
        : Promise.all([api.request("/api/profile"), api.request("/api/nutrition/ai-estimates/usage").catch(() => null), api.request("/api/profile/weight-entries").catch(() => [])]),
    )
      .then((response) => {
        if (training) {
          const [nextProfile] = response;
          setProfile(nextProfile); setWeight(nextProfile.weightKg || ""); setAiUsage(null); setWeightEntries([]);
        } else {
          const [nextProfile, nextAiUsage, nextWeightEntries] = response;
          setProfile(nextProfile); setWeight(nextProfile.weightKg || ""); setAiUsage(nextAiUsage); setWeightEntries(nextWeightEntries);
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
        <p className="training-page-intro">Consultá tus datos personales y tu progreso de entrenamiento. El catálogo de ejercicios vive en Ejercicios.</p>
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
        <div className="profile-support-grid training-profile-account-grid"><Panel title="Cuenta" className="account-panel"><p>Podés cerrar tu sesión de forma segura en este dispositivo.</p><button className="danger-button" onClick={async () => { const confirmed = await api.confirm({ title: "¿Cerrar sesión?", description: "Tendrás que volver a ingresar para usar tu cuenta en este dispositivo.", confirmLabel: "Cerrar sesión", tone: "neutral" }); if (confirmed) logout(); }}><Icon name="logout" />Cerrar sesión</button></Panel></div>
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
      {!training && <><div className="profile-support-grid">
        <Panel title="Fotos con IA" className="ai-usage-panel">
          {aiUsage?.available ? <><div><Icon name="photo_camera" /><span><strong>{aiUsage.blockedUntil ? "Gemini sin cuota" : "Sin límite interno"}</strong><small>{aiUsage.blockedUntil ? `Probá nuevamente desde ${quotaReset(aiUsage.blockedUntil)}` : `${aiUsage.used} consultas realizadas hoy`}</small></span></div><p>{aiUsage.blockedUntil ? "Gemini informó que no quedan solicitudes disponibles por ahora. La hora mostrada proviene de Gemini; si no la informa, se usa su próximo reinicio diario estimado." : "ScaleGrams no limita tus fotos: solo registra el uso y mostrará cuándo Gemini vuelva a aceptar consultas."}</p></> : <p>La estimación por foto no está disponible por el momento.</p>}
        </Panel>
        <ProfileNutritionTutorial />
        <Panel title="Cuenta" className="account-panel">
          <p>Podés cerrar tu sesión de forma segura en este dispositivo.</p>
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
