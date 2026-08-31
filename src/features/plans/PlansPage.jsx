import React, { useCallback, useEffect, useState } from "react";
import { Header } from "../../components/Layout";
import { CatalogStatus } from "../catalog/CatalogComponents";
import { SkeletonRows } from "../../components/Loading";
import { trainingApi } from "../training/training-api";
import { NutritionPlanManager } from "../profile/components/NutritionPlanManager";
import { TrainingPlanManager } from "../profile/components/TrainingPlanManager";
import "../../styles/07-profile.css";

export function PlansPage({ api }) {
  const [nutritionPlans, setNutritionPlans] = useState([]);
  const [trainingPlans, setTrainingPlans] = useState([]);
  const [trainingExercises, setTrainingExercises] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [nextNutritionPlans, nextTrainingPlans, nextTrainingExercises] = await Promise.all([
        api.request("/api/profile/nutrition-plans", { cache: "no-store" }),
        trainingApi.plans(api, { includeInactive: true, size: 50 }),
        trainingApi.exercises(api, { size: 50 }),
      ]);
      setNutritionPlans(Array.isArray(nextNutritionPlans) ? nextNutritionPlans : []);
      setTrainingPlans(nextTrainingPlans?.items || []);
      setTrainingExercises(nextTrainingExercises?.items || []);
    } catch (requestError) {
      setError(requestError?.message || "No pudimos cargar tus planes.");
    } finally {
      setLoading(false);
    }
  }, [api]);

  useEffect(() => { load(); }, [load]);

  if (loading) return <section className="page plans-page"><Header title="Planes" /><SkeletonRows count={4} label="Cargando planes" /></section>;
  if (error) return <section className="page plans-page"><Header title="Planes" /><CatalogStatus error>{error}<button className="secondary" onClick={load}>Reintentar</button></CatalogStatus></section>;

  return (
    <section className="page plans-page">
      <Header title="Planes" />
      <p className="plans-page-intro">Administrá en un solo lugar tus objetivos de alimentación y tus rutinas de entrenamiento.</p>
      <div className="plans-page-grid">
        <section className="plans-section">
          <NutritionPlanManager api={api} plans={nutritionPlans} onChanged={load} />
        </section>
        <section className="plans-section plans-training-section training-page training-profile-root">
          <TrainingPlanManager api={api} plans={trainingPlans} exercises={trainingExercises} onChanged={load} />
        </section>
      </div>
    </section>
  );
}
