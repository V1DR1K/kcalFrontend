import React, { useCallback, useEffect, useId, useRef, useState } from "react";
import { Icon } from "../../components/Icon";
import { Header, Macro, Panel } from "../../components/Layout";
import { DatePickerDialog } from "../../components/DatePickerDialog";
import { CatalogStatus, NutrientDetails } from "../catalog/CatalogComponents";
import { EditFoodLog } from "../foods/FoodComponents";
import { readRecents } from "../../services/recents";
import { formatNumber, today } from "../../utils/format";
import { macroValue, mealLogName, mealTotals } from "./dashboard.utils";
import { EditAiEstimateDialog } from "./dialogs/EditAiEstimateDialog";
import { DayPresetsDialog } from "./dialogs/DayPresetsDialog";
import { MealPhotoContextEditor as MealPhotoContextEditorDialog } from "./dialogs/MealPhotoDialog";
import { FoodPicker, AiEstimateEditor } from "./dialogs/FoodPickerDialog";
import { CompactBalanceBar, DateNavigator, PastMealsPreview } from "./components/DashboardSections";
import { MealCard } from "./components/MealSections";
import { RecentMeals } from "./components/QuickMeals";
import { useDashboardData } from "./hooks/useDashboardData";
import "../../styles/12-dashboard-summary.css";
import "../../styles/15-day-presets.css";

const SWIPE_ACTION_WIDTH = 84;
const LONG_PRESS_DURATION = 500;
const LONG_PRESS_MOVE_TOLERANCE = 18;
let optimisticSequence = 0;

export function Dashboard({ api, user, setPage }) {
  const {
    data,
    setData,
    loading,
    error,
    mealTypes,
    dayPresets,
    setDayPresets,
    selectedDate,
    dateChanging,
    yesterdayData,
    load,
    loadDayPresets,
    changeDate,
  } = useDashboardData(api);
  const [pickerMeal, setPickerMeal] = useState(null);
  const [editingLog, setEditingLog] = useState(null);
  const [editingAiEstimate, setEditingAiEstimate] = useState(null);
  const [deletingLogId, setDeletingLogId] = useState(null);
  const [movingLogId, setMovingLogId] = useState(null);
  const [waterSaving, setWaterSaving] = useState(false);
  const [waterActionState, setWaterActionState] = useState("idle");
  const [mealClipboard, setMealClipboard] = useState(null);
  const [mealBulkActionLoading, setMealBulkActionLoading] = useState(false);
  const [dayPresetModal, setDayPresetModal] = useState(false);
  const [swipeResetSignal, setSwipeResetSignal] = useState(0);
  const dashboardTopRef = useRef(null);
  const balanceRef = useRef(null);
  const [compactBalance, setCompactBalance] = useState(false);
  useEffect(() => {
    const balance = balanceRef.current;
    if (!balance) return undefined;
    const content = balance.closest(".content");
    const scrollTarget = content && getComputedStyle(content).overflowY !== "visible" ? content : window;
    let frame = 0;
    const updateCompactBalance = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => setCompactBalance(balance.getBoundingClientRect().bottom <= 0));
    };
    updateCompactBalance();
    scrollTarget.addEventListener("scroll", updateCompactBalance, { passive: true });
    window.addEventListener("resize", updateCompactBalance, { passive: true });
    return () => {
      cancelAnimationFrame(frame);
      scrollTarget.removeEventListener("scroll", updateCompactBalance);
      window.removeEventListener("resize", updateCompactBalance);
    };
  }, [loading, selectedDate]);
  const macros = data?.macros || [];
  const mealByCode = new Map((data?.meals || []).map((meal) => [meal.mealType, meal]));
  const recentMeals = readRecents(user).meals || [];
  const resetMealSwipes = useCallback(() => setSwipeResetSignal((signal) => signal + 1), []);
  const closeEditingLog = useCallback(() => {
    resetMealSwipes();
    setEditingLog(null);
  }, [resetMealSwipes]);
  const finishEditingLog = useCallback(() => {
    resetMealSwipes();
    setEditingLog(null);
    load();
  }, [resetMealSwipes, load]);
  const closeEditingAiEstimate = useCallback(() => {
    resetMealSwipes();
    setEditingAiEstimate(null);
  }, [resetMealSwipes]);
  const finishEditingAiEstimate = useCallback(() => {
    resetMealSwipes();
    setEditingAiEstimate(null);
    load();
  }, [resetMealSwipes, load]);
  useEffect(() => {
    resetMealSwipes();
  }, [data, resetMealSwipes, selectedDate]);
  function addOptimisticLogs(logs, mealType) {
    const optimisticItems = logs.map((log, index) => {
      const itemType = log.itemType || log.type;
      const optimisticId = `optimistic:${Date.now()}:${optimisticSequence + index}`;
      return {
        ...log,
        id: optimisticId,
        itemType,
        mealType,
        unit: log.unit || (itemType === "RECIPE" ? "PORTION" : "GRAM"),
        food: log.food || (itemType === "FOOD" ? log : null),
        recipe: log.recipe || (itemType === "RECIPE" ? log : null),
        optimistic: true,
      };
    });
    optimisticSequence += optimisticItems.length;
    setData((current) => ({
      ...current,
      caloriesConsumed: Number(current?.caloriesConsumed || 0) + mealTotals(optimisticItems).calories,
      macros: (current?.macros || []).map((macro) => ({
        ...macro,
        consumed: Number(macro.consumed || 0) + optimisticItems.reduce((sum, log) => sum + macroValue(log, String(macro.key).toUpperCase()), 0),
      })),
      meals: mealTypes.map((type) => {
        const existing = current?.meals?.find((entry) => entry.mealType === type.code) || { mealType: type.code, items: [], calories: 0 };
        if (type.code !== mealType) return existing;
        const items = [...(existing.items || []), ...optimisticItems];
        return { ...existing, ...mealTotals(items), items };
      }),
    }));
    return optimisticItems;
  }
  function rollbackOptimisticLogs(logs) {
    const ids = new Set(logs.map((log) => log.id));
    const totals = mealTotals(logs);
    setData((current) => ({
      ...current,
      caloriesConsumed: Math.max(0, Number(current?.caloriesConsumed || 0) - totals.calories),
      macros: (current?.macros || []).map((macro) => ({
        ...macro,
        consumed: Math.max(0, Number(macro.consumed || 0) - logs.reduce((sum, log) => sum + macroValue(log, String(macro.key).toUpperCase()), 0)),
      })),
      meals: (current?.meals || []).map((meal) => {
        const items = (meal.items || []).filter((item) => !ids.has(item.id));
        return items.length === (meal.items || []).length ? meal : { ...meal, ...mealTotals(items), items };
      }),
    }));
  }
  function removeLogsOptimistic(logs) {
    const ids = new Set(logs.map((log) => log.id));
    const totals = mealTotals(logs);
    setData((current) => ({
      ...current,
      caloriesConsumed: Math.max(0, Number(current?.caloriesConsumed || 0) - totals.calories),
      macros: (current?.macros || []).map((macro) => ({
        ...macro,
        consumed: Math.max(0, Number(macro.consumed || 0) - logs.reduce((sum, log) => sum + macroValue(log, String(macro.key).toUpperCase()), 0)),
      })),
      meals: (current?.meals || []).map((meal) => {
        const items = (meal.items || []).filter((item) => !ids.has(item.id));
        return items.length === (meal.items || []).length ? meal : { ...meal, ...mealTotals(items), items };
      }),
    }));
    return () => load();
  }
  function moveLogOptimistic(log, targetMealType) {
    setData((current) => ({
      ...current,
      meals: (current?.meals || []).map((meal) => {
        if (meal.mealType !== log.mealType && meal.mealType !== targetMealType) return meal;
        const remaining = (meal.items || []).filter((item) => item.id !== log.id);
        if (meal.mealType === targetMealType) {
          return { ...meal, ...mealTotals([...remaining, { ...log, mealType: targetMealType }]), items: [...remaining, { ...log, mealType: targetMealType }] };
        }
        return { ...meal, ...mealTotals(remaining), items: remaining };
      }),
    }));
    return () => load();
  }
  function adjustWaterOptimistic(deltaLiters) {
    setData((current) => ({ ...current, waterConsumedLiters: Math.max(0, Math.round((Number(current?.waterConsumedLiters || 0) + deltaLiters) * 100) / 100) }));
    return () => load();
  }
  if (loading && !data) {
    return (
      <section className="page" role="status" aria-live="polite" aria-label="Preparando tu día">
        <h1 className="sr-only">Día</h1>
        <Header compact action={<DateNavigator date={selectedDate} setDate={changeDate} changing={dateChanging} />} />
        <div className="dashboard-skeleton" aria-hidden="true">
          <div className="dashboard-skeleton-hero">
            <div className="skeleton skeleton-ring" />
            <div className="skeleton skeleton-copy" />
            <div className="skeleton-strip">
              <div className="skeleton skeleton-macro" />
              <div className="skeleton skeleton-macro" />
              <div className="skeleton skeleton-macro" />
            </div>
          </div>
          <div className="skeleton skeleton-meal-card" />
          <div className="skeleton skeleton-meal-card" />
          <div className="skeleton skeleton-meal-card" />
          <div className="skeleton skeleton-meal-card" />
          <div className="skeleton skeleton-panel" />
        </div>
      </section>
    );
  }
  if (error && !data) {
    return (
      <section className="page">
        <Header compact action={<DateNavigator date={selectedDate} setDate={changeDate} changing={dateChanging} />} />
        <CatalogStatus error>
          {error}
          <button className="secondary" onClick={() => load(selectedDate)}>
            Reintentar
          </button>
        </CatalogStatus>
      </section>
    );
  }
  return (
    <section className="page dashboard-page" ref={dashboardTopRef}>
      <Header title="Día" compact action={<DateNavigator date={selectedDate} setDate={changeDate} changing={dateChanging} />} />
      <CompactBalanceBar
        visible={compactBalance}
        consumed={data?.caloriesConsumed}
        goal={data?.calorieGoal}
        macros={macros}
        onGoTop={() => {
          const content = dashboardTopRef.current?.closest(".content");
          const scrollTarget = content && getComputedStyle(content).overflowY !== "visible" ? content : window;
          scrollTarget.scrollTo({ top: 0, behavior: "smooth" });
        }}
      />
      <div className="dashboard-hero dashboard-hero-full" ref={balanceRef}>
        <div className="calorie-ring">
          <svg viewBox="0 0 160 160" aria-hidden="true">
            <circle cx="80" cy="80" r="68" />
            <circle
              className="progress"
              cx="80"
              cy="80"
              r="68"
              style={{
                strokeDashoffset: 427 - 427 * Math.min(1, (data?.caloriesConsumed || 0) / (data?.calorieGoal || 1)),
              }}
            />
          </svg>
          <div className="calorie-values">
            <span>Consumidas / totales</span>
            <strong><b>{formatNumber(data?.caloriesConsumed)}</b><i>/</i><b>{formatNumber(data?.calorieGoal)}</b></strong>
            <small>kcal</small>
          </div>
        </div>
        <div className="balance-copy">
          <h2>Tu balance de hoy</h2>
          <p>
            {formatNumber(data?.caloriesConsumed)} de {formatNumber(data?.calorieGoal)} kcal consumidas
          </p>
          {data?.plan && (
            <small>
              {data.plan.proteinPercent}% proteínas / {data.plan.carbsPercent}% carbs / {data.plan.fatPercent}% grasas
            </small>
          )}
        </div>
        <div className="macro-strip">
          {macros.map((macro) => (
            <Macro key={macro.key} macro={macro} />
          ))}
          {data?.nutrients?.length > 0 && (
            <NutrientDetails
              nutrients={data.nutrients}
              label="Resumen nutricional del día"
            />
          )}
        </div>
      </div>
      <div className="meal-grid">
        {mealTypes.map((mealType, mealIndex) => (
          <MealCard
            key={mealType.code}
            entryDelay={mealIndex * 45}
            mealType={mealType}
            meal={mealByCode.get(mealType.code)}
            yesterdayMeal={yesterdayData?.meals?.find((meal) => meal.mealType === mealType.code)}
            targetDate={selectedDate}
            api={api}
            onCopied={load}
            onOptimisticAdd={addOptimisticLogs}
            onOptimisticRemove={removeLogsOptimistic}
            onOptimisticRollback={rollbackOptimisticLogs}
            clipboard={mealClipboard}
            bulkActionLoading={mealBulkActionLoading}
            setBulkActionLoading={setMealBulkActionLoading}
            onCopyMeal={(items) => { setMealClipboard(items); api.notify("Comida copiada."); }}
            deletingLogId={deletingLogId}
            movingLogId={movingLogId}
            resetSignal={swipeResetSignal}
            onAdd={() => setPickerMeal(mealType)}
            onEdit={(log) => {
              if (log.itemType === "AI_ESTIMATE") {
                resetMealSwipes();
                setEditingAiEstimate(log);
                return;
              }
              resetMealSwipes();
              setEditingLog(log);
            }}
            onMove={async (log, targetMealType) => {
              if (!targetMealType || movingLogId || log.mealType === targetMealType) return;
              resetMealSwipes();
              setMovingLogId(log.id);
              const restore = moveLogOptimistic(log, targetMealType);
              try {
                await api.runAction(
                  { title: "Moviendo alimento", description: "Estamos actualizando tu comida..." },
                  async () => {
                    await api.request(`/api/nutrition/food-logs/${log.id}`, {
                      method: "PUT",
                      body: JSON.stringify({
                        mealType: targetMealType,
                        quantity: log.quantity,
                        unit: log.unit || "GRAM",
                        logDate: log.logDate,
                      }),
                    });
                    api.notify("Alimento movido.");
                    await load();
                  },
                  { quiet: true },
                );
              } catch (error) {
                restore();
                api.notify(error.message || "No se pudo mover el alimento.", "error");
              } finally {
                setMovingLogId(null);
              }
            }}
            onDelete={async (log) => {
              if (deletingLogId) return;
              const itemName = mealLogName(log);
              const confirmed = await api.confirm({
                title: "¿Eliminar alimento?",
                description: `${itemName || "Este alimento"} se quitará de tu registro de hoy.`,
                confirmLabel: "Eliminar",
              });
              if (!confirmed) {
                resetMealSwipes();
                return;
              }
              resetMealSwipes();
              setDeletingLogId(log.id);
              const restore = removeLogsOptimistic([log]);
              try {
                await api.runAction(
                  { title: "Eliminando alimento", description: "Estamos actualizando tu registro..." },
                  async () => {
                    await api.request(`/api/nutrition/food-logs/${log.id}`, { method: "DELETE" });
                    api.notify("Registro eliminado.");
                    await load();
                  },
                  { quiet: true },
                );
              } catch (error) {
                restore();
                api.notify(error.message || "No se pudo eliminar el registro.", "error");
              } finally {
                setDeletingLogId(null);
              }
            }}
          />
        ))}
      </div>
       <div className={`grid ${recentMeals.length ? "two" : ""}`}>
         <div className="dashboard-water action-surface" data-action-state={waterActionState}>
           <Icon name="water_drop" />
           <p><strong>Hidratación</strong><small>{formatNumber(data?.waterConsumedLiters, 1)} L de {formatNumber(data?.waterGoalLiters, 1)} L</small></p>
           <div className="water-actions">
             <button
               className="secondary action-control"
               disabled={waterSaving || !Number(data?.waterConsumedLiters)}
               onClick={async () => {
                 if (waterSaving) return;
                 setWaterSaving(true);
                 setWaterActionState("undoing");
                 const restore = adjustWaterOptimistic(-0.5);
                 try {
                   await api.runAction(
                     { title: "Deshaciendo hidratación", description: "Estamos actualizando tu registro de agua..." },
                     async () => {
                       await api.request(`/api/nutrition/water-logs/latest?date=${selectedDate}`, { method: "DELETE" });
                       api.notify("Último registro de agua eliminado.");
                       await load();
                     },
                     { quiet: true },
                   );
                   setWaterActionState("success");
                   window.setTimeout(() => setWaterActionState("idle"), 700);
                 } catch {
                   restore();
                   setWaterActionState("error");
                   api.notify("No hay agua para descontar.", "error");
                   window.setTimeout(() => setWaterActionState("idle"), 700);
                 } finally {
                   setWaterSaving(false);
                 }
               }}
             >
               {waterActionState === "undoing" ? "Deshaciendo..." : "Deshacer"}
             </button>
             <button
               className="secondary action-control"
               disabled={waterSaving}
               onClick={async () => {
                 if (waterSaving) return;
                 setWaterSaving(true);
                 setWaterActionState("adding");
                 const restore = adjustWaterOptimistic(0.5);
                 try {
                   await api.runAction(
                     { title: "Registrando hidratación", description: "Estamos guardando el agua consumida..." },
                     async () => {
                       await api.request("/api/nutrition/water-logs", {
                         method: "POST",
                         body: JSON.stringify({
                           liters: 0.5,
                           logDate: selectedDate,
                         }),
                       });
                       api.notify("Hidratación registrada.");
                       await load();
                     },
                     { quiet: true },
                   );
                   setWaterActionState("success");
                   window.setTimeout(() => setWaterActionState("idle"), 700);
                 } catch {
                   restore();
                   setWaterActionState("error");
                   api.notify("No se pudo registrar el agua.", "error");
                   window.setTimeout(() => setWaterActionState("idle"), 700);
                 } finally {
                   setWaterSaving(false);
                 }
               }}
             >
               {waterActionState === "adding" ? "Guardando..." : "Sumar 0.5L"}
             </button>
           </div>
         </div>
        {Boolean(recentMeals.length) && <Panel title="Comidas recientes">
          <RecentMeals user={user} api={api} date={selectedDate} mealTypes={mealTypes} onDone={load} onOptimisticAdd={addOptimisticLogs} onOptimisticRollback={rollbackOptimisticLogs} />
        </Panel>}
      </div>
       <PastMealsPreview api={api} targetDate={selectedDate} mealTypes={mealTypes} onCopied={load} onOptimisticAdd={addOptimisticLogs} onOptimisticRollback={rollbackOptimisticLogs} />
       <DayPresetsDialog
         api={api}
         user={user}
         date={selectedDate}
         data={data}
         mealTypes={mealTypes}
         presets={dayPresets}
         onReload={loadDayPresets}
         onApplied={load}
         open={dayPresetModal}
         onOpen={() => setDayPresetModal(true)}
         onClose={() => setDayPresetModal(false)}
         FoodPickerComponent={FoodPicker}
       />
      {pickerMeal && (
        <FoodPicker
          api={api}
          user={user}
          mealType={pickerMeal}
            selectedDate={selectedDate}
            onClose={() => setPickerMeal(null)}
            onOptimisticAdd={addOptimisticLogs}
            onOptimisticRollback={rollbackOptimisticLogs}
          onDone={async () => {
            setPickerMeal(null);
            await load();
          }}
        />
      )}
      {editingLog && (
        <EditFoodLog
          api={api}
          log={editingLog}
          mealTypes={mealTypes}
          onClose={closeEditingLog}
          onDone={finishEditingLog}
        />
      )}
      {editingAiEstimate && <EditAiEstimateDialog api={api} log={editingAiEstimate} mealTypes={mealTypes} onClose={closeEditingAiEstimate} onDone={finishEditingAiEstimate} EditorComponent={AiEstimateEditor} />}
    </section>
  );
}
