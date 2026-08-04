import React, { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { DEFAULT_MEALS } from "../../config/app";
import { Icon } from "../../components/Icon";
import { InfiniteSentinel } from "../../components/InfiniteSentinel";
import { Input, Select } from "../../components/FormControls";
import { Header, Macro, Panel } from "../../components/Layout";
import { CatalogRowWithImage, CatalogStatus, FoodThumb, PreparationBadge, groupFoodVariants, preparationLabel } from "../catalog/CatalogComponents";
import { EditFoodLog, FoodLogDialog, FoodLogForm } from "../foods/Foods";
import { usePagedCatalog } from "../catalog/usePagedCatalog";
import { readRecents, rememberItem, rememberMeal } from "../../services/recents";
import { formatNumber, readableDate, shiftDate, today } from "../../utils/format";

const SWIPE_ACTION_WIDTH = 84;
let optimisticSequence = 0;

function macroValue(log, key) {
  if (key === "PROTEIN") return Number(log.proteinGrams || 0);
  if (key === "CARBS") return Number(log.carbsGrams || 0);
  if (key === "FAT") return Number(log.fatGrams || 0);
  return 0;
}

function mealTotals(items) {
  return items.reduce((totals, item) => ({
    calories: totals.calories + Number(item.calories || 0),
    proteinGrams: totals.proteinGrams + Number(item.proteinGrams || 0),
    carbsGrams: totals.carbsGrams + Number(item.carbsGrams || 0),
    fatGrams: totals.fatGrams + Number(item.fatGrams || 0),
  }), { calories: 0, proteinGrams: 0, carbsGrams: 0, fatGrams: 0 });
}

async function createMealLogs(api, logs, mealType, logDate) {
  const created = [];
  try {
    for (const log of logs) {
      const itemType = log.itemType || log.type;
      const createdLog = await api.request("/api/nutrition/meal-logs", {
        method: "POST",
        body: JSON.stringify({
          itemType,
          itemId: itemType === "RECIPE" ? log.recipe?.id || log.id : log.food?.id || log.id,
          mealType,
          quantity: log.quantity,
          unit: log.unit || (itemType === "RECIPE" ? "PORTION" : "GRAM"),
          logDate,
        }),
      });
      created.push(createdLog);
    }
    return created;
  } catch (error) {
    // Compensate successful requests so the visual rollback matches persisted data.
    await Promise.allSettled(created.filter(Boolean).map((log) => api.request(`/api/nutrition/food-logs/${log.id}`, { method: "DELETE" })));
    throw error;
  }
}

function formatMealLogAmount(log) {
  if (log.itemType === "RECIPE") return `${formatNumber(log.quantity, 1)} porción${Number(log.quantity) === 1 ? "" : "es"}`;
  if (log.itemType === "AI_ESTIMATE") return "Estimación por foto";
  return `${formatNumber(log.quantity, 1)} g`;
}

function mealLogName(log) {
  return log.itemType === "RECIPE" ? log.recipe?.name : log.itemType === "AI_ESTIMATE" ? log.displayName || "Comida estimada" : log.food?.name;
}

function mealLogItem(log) {
  if (log.itemType === "RECIPE") return { ...log.recipe, type: "RECIPE" };
  if (log.itemType === "AI_ESTIMATE") return { name: mealLogName(log), category: "OTHER", type: "AI_ESTIMATE" };
  return { ...log.food, type: "FOOD" };
}

function aiQuotaReset(usage) {
  if (!usage?.blockedUntil) return "";
  return new Intl.DateTimeFormat("es-AR", { hour: "2-digit", minute: "2-digit", day: "2-digit", month: "short" }).format(new Date(usage.blockedUntil));
}

function foodPreparationSuffix(food) {
  return food?.preparation && food.preparation !== "UNSPECIFIED" ? ` · ${preparationLabel(food.preparation)}` : "";
}

function scaleFoodNutrition(food, quantity) {
  const baseQuantity = Number(food?.baseQuantity || 100);
  const grams = Number(quantity || 0);
  const factor = baseQuantity > 0 ? grams / baseQuantity : 0;
  const proteinGrams = Number(food?.proteinGrams || 0) * factor;
  const carbsGrams = Number(food?.carbsGrams || 0) * factor;
  const fatGrams = Number(food?.fatGrams || 0) * factor;
  return {
    calories: macroCalories(proteinGrams, carbsGrams, fatGrams),
    proteinGrams,
    carbsGrams,
    fatGrams,
  };
}

function macroCalories(proteinGrams, carbsGrams, fatGrams) {
  return Math.round(Number(proteinGrams || 0) * 4 + Number(carbsGrams || 0) * 4 + Number(fatGrams || 0) * 9);
}

function NutritionPills({ nutrition }) {
  return (
    <div className="meal-detail-pills">
      <span><small>Kcal</small><strong>{formatNumber(nutrition?.calories)}</strong></span>
      <span><small>P</small><strong>{formatNumber(nutrition?.proteinGrams, 1)}g</strong></span>
      <span><small>C</small><strong>{formatNumber(nutrition?.carbsGrams, 1)}g</strong></span>
      <span><small>G</small><strong>{formatNumber(nutrition?.fatGrams, 1)}g</strong></span>
    </div>
  );
}

export function Dashboard({ api, user, setPage }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [mealTypes, setMealTypes] = useState(DEFAULT_MEALS);
  const [pickerMeal, setPickerMeal] = useState(null);
  const [editingLog, setEditingLog] = useState(null);
  const [deletingLogId, setDeletingLogId] = useState(null);
  const [movingLogId, setMovingLogId] = useState(null);
  const [waterSaving, setWaterSaving] = useState(false);
  const [mealClipboard, setMealClipboard] = useState(null);
  const [mealBulkActionLoading, setMealBulkActionLoading] = useState(false);
  const [swipeResetSignal, setSwipeResetSignal] = useState(0);
  const dashboardTopRef = useRef(null);
  const balanceRef = useRef(null);
  const [compactBalance, setCompactBalance] = useState(false);
  const [selectedDate, setSelectedDate] = useState(today());
  const [yesterdayData, setYesterdayData] = useState(null);
  const load = (date = selectedDate) => {
    if (!data) setLoading(true);
    setError("");
    return api
      .request(`/api/nutrition/dashboard?date=${date}`)
      .then(setData)
      .catch(() => {
        setError("No pudimos cargar tu día.");
        api.notify("No se pudo cargar el dashboard.", "error");
      })
      .finally(() => setLoading(false));
  };
  useEffect(() => {
    load(selectedDate);
    api
      .request("/api/nutrition/meal-types")
      .then(setMealTypes)
      .catch(() => setMealTypes(DEFAULT_MEALS));
  }, [selectedDate]);
  useEffect(() => {
    let active = true;
    setYesterdayData(null);
    const loadYesterday = () => api.request(`/api/nutrition/dashboard?date=${shiftDate(selectedDate, -1)}`)
      .then((result) => active && setYesterdayData(result))
      .catch(() => active && setYesterdayData(null));
    const schedule = window.requestIdleCallback || ((callback) => window.setTimeout(callback, 1500));
    const cancel = window.cancelIdleCallback || window.clearTimeout;
    const handle = schedule(loadYesterday);
    return () => {
      active = false;
      cancel(handle);
    };
  }, [api, selectedDate]);
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
          return { ...meal, calories: Number(meal.calories || 0) + Number(log.calories || 0), items: [...remaining, { ...log, mealType: targetMealType }] };
        }
        return { ...meal, calories: remaining.reduce((sum, item) => sum + Number(item.calories || 0), 0), items: remaining };
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
      <section className="page" role="status" aria-live="polite">
        <Header title="Mi día" action={<DateNavigator date={selectedDate} setDate={setSelectedDate} />} />
        <span className="sr-only">Cargando tu día…</span>
        <div className="dashboard-skeleton" aria-hidden="true">
          <div className="skeleton skeleton-hero" />
          <div className="skeleton skeleton-meal" />
          <div className="skeleton skeleton-meal" />
          <div className="skeleton skeleton-meal" />
          <div className="skeleton skeleton-meal" />
          <div className="skeleton skeleton-panel" />
        </div>
      </section>
    );
  }
  if (error && !data) {
    return (
      <section className="page">
        <Header title="Mi día" action={<DateNavigator date={selectedDate} setDate={setSelectedDate} />} />
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
      <Header title="Mi día" eyebrow={data?.plan?.name || "Plan alimenticio"} compact action={<DateNavigator date={selectedDate} setDate={setSelectedDate} />} />
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
        </div>
      </div>
      <div className="meal-grid">
        {mealTypes.map((mealType) => (
          <MealCard
            key={mealType.code}
            mealType={mealType}
            meal={mealByCode.get(mealType.code)}
            yesterdayMeal={yesterdayData?.meals?.find((meal) => meal.mealType === mealType.code)}
            targetDate={selectedDate}
            api={api}
            onCopied={load}
            onOptimisticAdd={addOptimisticLogs}
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
                api.notify("Las estimaciones se corrigen antes de agregarlas. Podés moverla o eliminarla.");
                return;
              }
              resetMealSwipes();
              setEditingLog(log);
            }}
            onMove={async (log, targetMealType) => {
              if (movingLogId || log.mealType === targetMealType) return;
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
        <Panel title="Agua">
          <p className="big">
            {formatNumber(data?.waterConsumedLiters, 1)}L / {formatNumber(data?.waterGoalLiters, 1)}L
          </p>
          <div className="water-actions">
            <button
              className="secondary"
              disabled={waterSaving || !Number(data?.waterConsumedLiters)}
              onClick={async () => {
                if (waterSaving) return;
                setWaterSaving(true);
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
                } catch {
                  restore();
                  api.notify("No hay agua para descontar.", "error");
                } finally {
                  setWaterSaving(false);
                }
              }}
            >
              Deshacer
            </button>
            <button
              className="secondary"
              disabled={waterSaving}
              onClick={async () => {
                if (waterSaving) return;
                setWaterSaving(true);
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
                } catch {
                  restore();
                  api.notify("No se pudo registrar el agua.", "error");
                } finally {
                  setWaterSaving(false);
                }
              }}
            >
              {waterSaving ? "Guardando…" : "Sumar 0.5L"}
            </button>
          </div>
        </Panel>
        {Boolean(recentMeals.length) && <Panel title="Comidas recientes">
          <RecentMeals user={user} api={api} date={selectedDate} mealTypes={mealTypes} onDone={load} onOptimisticAdd={addOptimisticLogs} onOptimisticRollback={rollbackOptimisticLogs} />
        </Panel>}
      </div>
      <PastMealsPreview api={api} targetDate={selectedDate} mealTypes={mealTypes} onCopied={load} onOptimisticAdd={addOptimisticLogs} onOptimisticRollback={rollbackOptimisticLogs} />
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
    </section>
  );
}

function CompactBalanceBar({ visible, consumed, goal, macros, onGoTop }) {
  const macroByKey = new Map(macros.map((macro) => [String(macro.key).toUpperCase(), macro]));
  const compactMacros = [["PROTEIN", "Proteína", "P"], ["CARBS", "Carbos", "C"], ["FAT", "Grasas", "G"]];
  return (
    <div className={`compact-balance-shell ${visible ? "visible" : ""}`} aria-hidden={!visible}>
      <button type="button" className="compact-balance" onClick={onGoTop} tabIndex={visible ? 0 : -1} aria-label="Volver arriba al balance completo">
        <span className="compact-calories"><Icon name="local_fire_department" /><strong>{formatNumber(consumed)}<small> / {formatNumber(goal)} kcal</small></strong></span>
        <span className="compact-macros">
          {compactMacros.map(([key, label, shortLabel]) => {
            const macro = macroByKey.get(key);
            return <span key={key}><b className="macro-full-label">{label}</b><b className="macro-short-label">{shortLabel}</b><strong>{formatNumber(macro?.consumed)}<small>/{formatNumber(macro?.goal)}g</small></strong></span>;
          })}
        </span>
        <Icon name="keyboard_arrow_up" className="compact-balance-up" />
      </button>
    </div>
  );
}

function DateNavigator({ date, setDate }) {
  return (
    <div className="date-nav">
      <button className="icon-button" aria-label="Día anterior" onClick={() => setDate(shiftDate(date, -1))}>
        <Icon name="chevron_left" />
      </button>
      <label>
        <span>{readableDate(date)}</span>
        <input type="date" value={date} onChange={(event) => setDate(event.target.value)} />
      </label>
      <button className="icon-button" aria-label="Día siguiente" onClick={() => setDate(shiftDate(date, 1))}>
        <Icon name="chevron_right" />
      </button>
      <button className="secondary today-button" aria-label="Ir a hoy" onClick={() => setDate(today())}>
        <Icon name="today" /><span className="today-label">Hoy</span>
      </button>
    </div>
  );
}

function PastMealsPreview({ api, targetDate, mealTypes, onCopied, onOptimisticAdd, onOptimisticRollback }) {
  const [sourceDate, setSourceDate] = useState(() => shiftDate(targetDate, -1));
  const [source, setSource] = useState(null);
  const [status, setStatus] = useState({});
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    setSourceDate(shiftDate(targetDate, -1));
    setSource(null);
    setStatus({});
  }, [targetDate]);
  async function preview() {
    setLoading(true);
    setStatus({});
    try {
      setSource(await api.runAction(
        { title: "Cargando comidas", description: "Estamos buscando el día seleccionado..." },
        () => api.request(`/api/nutrition/dashboard?date=${sourceDate}`),
        { quiet: true },
      ));
    } catch {
      api.notify("No se pudo cargar ese día.", "error");
    } finally {
      setLoading(false);
    }
  }
  async function copyMeal(mealType, items) {
    setStatus((current) => ({ ...current, [mealType]: "copying" }));
    const optimisticLogs = onOptimisticAdd(items, mealType);
    try {
      await api.runAction(
        { title: "Copiando comida", description: "Estamos guardando los alimentos en tu día..." },
        async () => {
          await createMealLogs(api, items, mealType, targetDate);
          setStatus((current) => ({ ...current, [mealType]: "copied" }));
          api.notify("Comida copiada respetando su horario.");
          await onCopied();
        },
        { quiet: true },
      );
    } catch {
      onOptimisticRollback(optimisticLogs);
      setStatus((current) => ({ ...current, [mealType]: "error" }));
      api.notify("No se pudo copiar la comida completa.", "error");
    }
  }
  return (
    <details className="panel past-meals-panel">
      <summary><Icon name="content_copy" /><span><strong>Copiar comidas de otro día</strong><small>Reutilizá un día anterior sin cargar todo de nuevo</small></span><Icon name="expand_more" className="chevron" /></summary>
      <div className="past-meals-content">
      <div className="past-meals-tools">
        <Input
          label="Día de origen"
          type="date"
          max={shiftDate(targetDate, -1)}
          value={sourceDate}
          onChange={(event) => {
            setSourceDate(event.target.value);
            setSource(null);
            setStatus({});
          }}
        />
        <button className="secondary" disabled={loading || !sourceDate} onClick={preview}>
          {loading ? "Buscando..." : "Vista previa"}
        </button>
      </div>
      {source && (
        <div className="past-meals-grid">
          {mealTypes.map((type) => {
            const meal = source.meals?.find((item) => item.mealType === type.code);
            const items = meal?.items || [];
            const state = status[type.code];
            if (!items.length || state === "dismissed") return null;
            return (
              <article className={`ghost-meal ${state || ""}`} key={type.code}>
                <header>
                  <div>
                    <span>
                      {type.label} · {readableDate(sourceDate)}
                    </span>
                    <strong>{meal.calories} kcal</strong>
                  </div>
                  <div className="ghost-actions">
                    <button className="copy-accept" disabled={state === "copying" || state === "copied"} aria-label={`Copiar ${type.label}`} onClick={() => copyMeal(type.code, items)}>
                      <Icon name={state === "copied" ? "check_circle" : "check"} />
                    </button>
                    <button
                      className="copy-reject"
                      disabled={state === "copying" || state === "copied"}
                      aria-label={`No copiar ${type.label}`}
                      onClick={() =>
                        setStatus((current) => ({
                          ...current,
                          [type.code]: "dismissed",
                        }))
                      }
                    >
                      <Icon name="close" />
                    </button>
                  </div>
                </header>
                {items.map((log) => (
                  <div className="ghost-item" key={log.id}>
                    <span>{mealLogName(log)}</span>
                    <small>
                      {formatMealLogAmount(log)} · {log.calories} kcal
                    </small>
                  </div>
                ))}
              </article>
            );
          })}
        </div>
      )}
      </div>
    </details>
  );
}

function MealCard({ mealType, meal, yesterdayMeal, targetDate, api, onCopied, onOptimisticAdd, onOptimisticRollback, clipboard, bulkActionLoading, setBulkActionLoading, onCopyMeal, deletingLogId, movingLogId, resetSignal, onAdd, onEdit, onDelete, onMove }) {
  const items = meal?.items || [];
  const cardRef = useRef(null);
  const menuRef = useRef(null);
  const [dragOver, setDragOver] = useState(false);
  const [expandedLogId, setExpandedLogId] = useState(null);
  const [suggestionState, setSuggestionState] = useState("idle");
  const yesterdayItems = yesterdayMeal?.items || [];
  useEffect(() => setSuggestionState("idle"), [targetDate, mealType.code]);
  useEffect(() => setExpandedLogId(null), [targetDate, mealType.code, resetSignal]);
  useEffect(() => {
    if (!expandedLogId) return undefined;
    function closeFromOutside(event) {
      if (!cardRef.current?.contains(event.target)) setExpandedLogId(null);
    }
    function closeFromKeyboard(event) {
      if (event.key === "Escape") setExpandedLogId(null);
    }
    document.addEventListener("pointerdown", closeFromOutside);
    document.addEventListener("keydown", closeFromKeyboard);
    return () => {
      document.removeEventListener("pointerdown", closeFromOutside);
      document.removeEventListener("keydown", closeFromKeyboard);
    };
  }, [expandedLogId]);
  async function copyYesterday() {
    setSuggestionState("copying");
    const optimisticLogs = onOptimisticAdd(yesterdayItems, mealType.code);
    try {
      await api.runAction(
        { title: "Copiando comida", description: "Estamos guardando los alimentos de ayer..." },
        async () => {
          await createMealLogs(api, yesterdayItems, mealType.code, targetDate);
          setSuggestionState("copied");
          api.notify(`${mealType.label} copiado de ayer.`);
          await new Promise((resolve) => window.setTimeout(resolve, 650));
          await onCopied();
        },
        { quiet: true },
      );
    } catch {
      onOptimisticRollback(optimisticLogs);
      setSuggestionState("idle");
      api.notify("No se pudo copiar la comida de ayer.", "error");
    }
  }
  async function addLogs(logs) {
    if (bulkActionLoading) return;
    setBulkActionLoading(true);
    const optimisticLogs = onOptimisticAdd(logs, mealType.code);
    try {
      await api.runAction(
        { title: "Pegando comida", description: "Estamos guardando los alimentos..." },
        async () => {
          await createMealLogs(api, logs, mealType.code, targetDate);
          api.notify(`Comida pegada en ${mealType.label}.`);
          await onCopied();
        },
        { quiet: true },
      );
    } catch { onOptimisticRollback(optimisticLogs); api.notify("No se pudo pegar la comida. Se revirtieron los cambios.", "error"); }
    finally { setBulkActionLoading(false); }
  }
  async function deleteAll() {
    if (!items.length || bulkActionLoading) return;
    const confirmed = await api.confirm({
      title: `¿Borrar ${mealType.label.toLowerCase()}?`,
      description: "Se eliminarán todos los alimentos de esta comida.",
      confirmLabel: "Borrar todo",
    });
    if (!confirmed) return;
    setBulkActionLoading(true);
    const restore = removeLogsOptimistic(items);
    try {
      await api.runAction(
        { title: `Borrando ${mealType.label.toLowerCase()}`, description: "Estamos eliminando los alimentos..." },
        async () => {
          await api.request(`/api/nutrition/food-logs?mealType=${mealType.code}&date=${targetDate}`, { method: "DELETE" });
          api.notify(`${mealType.label} eliminado.`);
          await onCopied();
        },
        { quiet: true },
      );
    }
    catch { restore(); api.notify("No se pudo borrar toda la comida. Se revirtieron los cambios.", "error"); }
    finally { setBulkActionLoading(false); }
  }
  return (
    <article
      ref={cardRef}
      className={`meal-card ${dragOver ? "drag-over" : ""}`}
      data-meal-type={mealType.code}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setExpandedLogId(null);
      }}
      onDragOver={(event) => {
        event.preventDefault();
        setDragOver(true);
      }}
      onDragLeave={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setDragOver(false);
      }}
      onDrop={(event) => {
        event.preventDefault();
        setDragOver(false);
        try {
          const log = JSON.parse(event.dataTransfer.getData("application/json"));
          onMove(log, mealType.code);
        } catch {
          /* gesto cancelado */
        }
      }}
    >
      <header>
        <div>
          <span>{mealType.label}</span>
          <strong>{meal?.calories || 0} kcal</strong>
        </div>
        <div className="meal-header-actions">
          <details className="meal-menu" ref={menuRef}><summary aria-label={`Acciones de ${mealType.label}`}><Icon name="more_vert" /></summary><div><button disabled={!items.length || bulkActionLoading} onClick={() => { menuRef.current?.removeAttribute("open"); onCopyMeal(items); }}>Copiar todo</button><button disabled={!clipboard?.length || bulkActionLoading} onClick={() => { menuRef.current?.removeAttribute("open"); addLogs(clipboard); }}>Pegar</button><button className="danger-text" disabled={!items.length || bulkActionLoading} onClick={() => { menuRef.current?.removeAttribute("open"); deleteAll(); }}>Borrar todo</button></div></details>
          <button className="icon-button" aria-label={`Agregar alimento a ${mealType.label}`} onClick={onAdd}><Icon name="add" /></button>
        </div>
      </header>
      <div className="meal-macros">
        <small>P {formatNumber(meal?.proteinGrams, 1)}g</small>
        <small>C {formatNumber(meal?.carbsGrams, 1)}g</small>
        <small>G {formatNumber(meal?.fatGrams, 1)}g</small>
      </div>
      {!items.length && yesterdayItems.length > 0 && suggestionState !== "dismissed" && (
        <div className={`yesterday-suggestion ${suggestionState === "copied" ? "copied" : ""}`}>
          <Icon name="content_copy" />
          <span><strong>¿Copiar de ayer?</strong><small>{yesterdayItems.length} {yesterdayItems.length === 1 ? "elemento" : "elementos"}</small></span>
          <button className="copy-accept" disabled={suggestionState === "copying" || suggestionState === "copied"} aria-label={`Copiar ${mealType.label} de ayer`} onClick={copyYesterday}><Icon name={suggestionState === "copied" ? "check_circle" : "check"} /></button>
          <button className="copy-reject" disabled={suggestionState === "copying" || suggestionState === "copied"} aria-label="Descartar sugerencia" onClick={() => setSuggestionState("dismissed")}><Icon name="close" /></button>
          {suggestionState === "copied" && (
            <span className="copy-confetti" aria-hidden="true">
              <i />
              <i />
              <i />
              <i />
              <i />
              <i />
              <i />
              <i />
            </span>
          )}
        </div>
      )}
      {items.length ? (
        items.map((log) => {
            const item = mealLogItem(log);
          return (
            <SwipeableMealItem
              className={`${movingLogId === log.id ? "moving" : ""} ${log.optimistic ? "optimistic" : ""}`}
              key={log.id}
              resetSignal={resetSignal}
              expanded={expandedLogId === log.id}
              onToggle={() => setExpandedLogId((current) => (current === log.id ? null : log.id))}
              onEdit={() => onEdit(log)} onDelete={() => onDelete(log)}
              details={<MealLogDetails log={log} item={item} />}
            >
              <FoodThumb item={item} compact />
              <span className="meal-item-copy"><span>{item.name}</span><small>{formatMealLogAmount(log)}{log.itemType === "FOOD" ? foodPreparationSuffix(log.food) : ""}</small></span>
              <strong>{log.calories} kcal</strong>
            </SwipeableMealItem>
          );
        })
      ) : (
        <p className="empty-state">Todavía no registraste nada. Usá el botón + para agregar comida.</p>
      )}
    </article>
  );
}

function MealLogDetails({ log, item }) {
  if (log.itemType === "RECIPE") {
    const ingredients = aggregateRecipeIngredients(item?.ingredients || []);
    return (
      <div className="meal-item-detail recipe-meal-item-detail">
        <div className="meal-detail-summary">
          <span><small>Porciones</small><strong>{formatNumber(log.quantity, 1)}</strong></span>
          <span><small>Peso interno</small><strong>{formatNumber(item?.totalWeightGrams, 1)}g</strong></span>
        </div>
        <NutritionPills nutrition={log} />
        {log.recipeAdjusted && <small className="daily-recipe-note">Versión ajustada para este día</small>}
        <div className="recipe-detail-list">
          {ingredients.length ? ingredients.map((ingredient) => (
            <RecipeIngredientDetail ingredient={ingredient} key={ingredient.key} />
          )) : (
            <p className="meal-detail-empty">Esta receta todavia no trae ingredientes.</p>
          )}
        </div>
      </div>
    );
  }
  return (
    <div className="meal-item-detail">
      <div className="meal-detail-summary">
        <span><small>Cantidad</small><strong>{formatMealLogAmount(log)}</strong></span>
        <span><small>{log.itemType === "AI_ESTIMATE" ? "Origen" : "Alimento"}</small><strong>{item?.name}</strong></span>
      </div>
      <NutritionPills nutrition={log} />
    </div>
  );
}

function aggregateRecipeIngredients(ingredients) {
  const grouped = new Map();
  for (const ingredient of ingredients) {
    const food = ingredient.food || {};
    const key = food.id ? `food:${food.id}` : `name:${food.name || "Alimento"}`;
    const quantity = Number(ingredient.quantity || 0);
    const nutrition = scaleFoodNutrition(food, quantity);
    const current = grouped.get(key);
    if (current) {
      current.quantity += quantity;
      current.nutrition.proteinGrams += nutrition.proteinGrams;
      current.nutrition.carbsGrams += nutrition.carbsGrams;
      current.nutrition.fatGrams += nutrition.fatGrams;
    } else {
      grouped.set(key, { ...ingredient, key, quantity, food, nutrition });
    }
  }
  return [...grouped.values()].map((ingredient) => ({
    ...ingredient,
    nutrition: {
      ...ingredient.nutrition,
      calories: macroCalories(ingredient.nutrition.proteinGrams, ingredient.nutrition.carbsGrams, ingredient.nutrition.fatGrams),
    },
  }));
}

function RecipeIngredientDetail({ ingredient }) {
  const food = ingredient.food || {};
  const nutrition = ingredient.nutrition || scaleFoodNutrition(food, ingredient.quantity);
  return (
    <div className="recipe-ingredient-detail">
      <span className="recipe-ingredient-main">
        <FoodThumb item={{ ...food, type: "FOOD" }} compact />
        <span><strong>{food.name || "Alimento"}</strong><small>{formatNumber(ingredient.quantity, 1)} g{foodPreparationSuffix(food)}</small></span>
        <strong className="recipe-ingredient-kcal">{formatNumber(nutrition.calories)} kcal</strong>
      </span>
    </div>
  );
}

function SwipeableMealItem({ children, className = "", resetSignal, expanded = false, onToggle, details, onEdit, onDelete }) {
  const gesture = useRef(null);
  const offsetRef = useRef(0);
  const suppressClick = useRef(false);
  const [offset, setOffset] = useState(0);
  const [revealed, setRevealed] = useState("");
  const [horizontalDragging, setHorizontalDragging] = useState(false);
  const setSwipeOffset = useCallback((nextOffset) => {
    offsetRef.current = nextOffset;
    setOffset(nextOffset);
  }, []);
  const close = useCallback(() => {
    gesture.current = null;
    setHorizontalDragging(false);
    setRevealed("");
    setSwipeOffset(0);
  }, [setSwipeOffset]);
  useEffect(() => close(), [close, resetSignal]);
  useEffect(() => {
    if (expanded && revealed) close();
  }, [expanded, close, revealed]);
  function finish() {
    const finalOffset = offsetRef.current;
    if (gesture.current?.axis === "x" && finalOffset > SWIPE_ACTION_WIDTH * 0.65) {
      suppressClick.current = true;
      setRevealed("edit");
      setSwipeOffset(SWIPE_ACTION_WIDTH);
    } else if (gesture.current?.axis === "x" && finalOffset < -SWIPE_ACTION_WIDTH * 0.65) {
      suppressClick.current = true;
      setRevealed("delete");
      setSwipeOffset(-SWIPE_ACTION_WIDTH);
    } else {
      if (gesture.current?.axis === "x") suppressClick.current = true;
      close();
    }
    gesture.current = null;
    setHorizontalDragging(false);
    if (suppressClick.current) window.setTimeout(() => { suppressClick.current = false; }, 220);
  }
  function move(event) {
    if (!gesture.current) return;
    const dx = event.touches[0].clientX - gesture.current.x;
    const dy = event.touches[0].clientY - gesture.current.y;
    if (!gesture.current.axis && Math.max(Math.abs(dx), Math.abs(dy)) > 10) {
      gesture.current.axis = Math.abs(dx) > Math.abs(dy) * 1.8 ? "x" : "y";
      if (gesture.current.axis === "y") {
        setHorizontalDragging(false);
        setSwipeOffset(0);
      }
    }
    if (gesture.current.axis === "x") {
      if (event.cancelable) event.preventDefault();
      setHorizontalDragging(true);
      setSwipeOffset(Math.max(-SWIPE_ACTION_WIDTH, Math.min(SWIPE_ACTION_WIDTH, dx)));
    }
  }
  return (
    <div className={`swipe-row ${revealed} ${horizontalDragging ? "swiping" : ""} ${expanded ? "expanded" : ""}`}>
      <button className="swipe-action swipe-edit" aria-label="Editar registro" tabIndex={revealed === "edit" ? 0 : -1} aria-hidden={revealed !== "edit"} onClick={() => { close(); onEdit(); }}><Icon name="edit" /></button>
      <button className="swipe-action swipe-delete" aria-label="Eliminar registro" tabIndex={revealed === "delete" ? 0 : -1} aria-hidden={revealed !== "delete"} onClick={() => { close(); window.setTimeout(onDelete, 120); }}><Icon name="delete" /></button>
      <div
        className={`meal-item-shell ${horizontalDragging ? "swiping" : ""} ${className}`}
        style={{ transform: `translate3d(${offset}px, 0, 0)` }}
        onTouchStart={(event) => {
          gesture.current = { x: event.touches[0].clientX, y: event.touches[0].clientY, axis: null };
        }}
        onTouchMove={move}
        onTouchEnd={finish}
        onTouchCancel={finish}
      >
        <button type="button" className="meal-item" aria-expanded={expanded} onClick={() => !horizontalDragging && !suppressClick.current && onToggle?.()}>
          {children}
          <Icon name="expand_more" className="meal-item-chevron" />
        </button>
        {expanded && (
          <>
            {details}
            <div className="meal-item-detail-actions">
              <button type="button" className="secondary" onClick={() => { close(); onEdit(); }}><Icon name="edit" />Editar</button>
              <button type="button" className="secondary danger-text" onClick={() => { close(); onDelete(); }}><Icon name="delete" />Eliminar</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function FoodPicker({ api, user, mealType, selectedDate, onClose, onDone, onOptimisticAdd, onOptimisticRollback }) {
  const modalRef = useRef(null);
  const [tab, setTab] = useState("FOOD");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState(null);
  const [selectedPreparations, setSelectedPreparations] = useState([]);
  const [quantity, setQuantity] = useState("150");
  const [unit, setUnit] = useState("GRAM");
  const [preview, setPreview] = useState(null);
  const [adding, setAdding] = useState(false);
  const [recipeDetail, setRecipeDetail] = useState(null);
  const [recipeIngredients, setRecipeIngredients] = useState(null);
  const [aiUsage, setAiUsage] = useState(null);
  const [aiAnalyzing, setAiAnalyzing] = useState(false);
  const [aiEstimate, setAiEstimate] = useState(null);
  const [aiError, setAiError] = useState("");
  const [aiContext, setAiContext] = useState("");
  const [aiEstimatePhoto, setAiEstimatePhoto] = useState(null);
  const [aiCorrection, setAiCorrection] = useState("");
  const [aiRefining, setAiRefining] = useState(false);
  const [aiRefinementError, setAiRefinementError] = useState("");
  const [pendingMealPhoto, setPendingMealPhoto] = useState(null);
  const [pendingMealPhotoUrl, setPendingMealPhotoUrl] = useState("");
  const [audioRecording, setAudioRecording] = useState(false);
  const [audioTranscribing, setAudioTranscribing] = useState(false);
  const galleryInputRef = useRef(null);
  const audioRecorderRef = useRef(null);
  const audioStreamRef = useRef(null);
  const aiQuotaBlocked = Boolean(aiUsage?.blockedUntil && new Date(aiUsage.blockedUntil) > new Date());
  const catalog = usePagedCatalog({
    api,
    endpoint: tab === "FOOD" ? "/api/foods" : "/api/recipes",
    query,
  });
  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    const closeOnEscape = (event) => {
      if (event.key === "Escape") onClose();
    };
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [onClose]);
  useEffect(() => {
    let frame = 0;
    const syncViewport = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        modalRef.current?.style.setProperty("--picker-height", `${Math.round(window.innerHeight)}px`);
      });
    };
    syncViewport();
    window.addEventListener("orientationchange", syncViewport);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("orientationchange", syncViewport);
    };
  }, []);
  useEffect(() => {
    api.request("/api/nutrition/ai-estimates/usage").then(setAiUsage).catch(() => setAiUsage(null));
  }, [api]);
  useEffect(() => () => {
    audioRecorderRef.current?.stop?.();
    audioStreamRef.current?.getTracks().forEach((track) => track.stop());
  }, []);
  useEffect(() => {
    if (!pendingMealPhoto) {
      setPendingMealPhotoUrl("");
      return undefined;
    }
    const source = URL.createObjectURL(pendingMealPhoto);
    setPendingMealPhotoUrl(source);
    return () => URL.revokeObjectURL(source);
  }, [pendingMealPhoto]);
  function selectMealPhoto(file) {
    if (!file || aiAnalyzing) return;
    setAiError("");
    setAiContext("");
    setAiEstimatePhoto(null);
    setAiCorrection("");
    setAiRefinementError("");
    setPendingMealPhoto(file);
  }
  function discardMealPhoto() {
    if (audioRecording) audioRecorderRef.current?.stop();
    setAiError("");
    setAiContext("");
    setAiEstimatePhoto(null);
    setAiCorrection("");
    setAiRefinementError("");
    setPendingMealPhoto(null);
  }
  async function toggleMealNoteRecording() {
    if (audioRecording) return audioRecorderRef.current?.stop();
    if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) {
      setAiError("Tu navegador no permite dictar una descripción. Escribila manualmente.");
      return;
    }
    setAiError("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const preferredType = ["audio/mp4", "audio/webm;codecs=opus", "audio/webm"].find((type) => MediaRecorder.isTypeSupported?.(type));
      const recorder = new MediaRecorder(stream, preferredType ? { mimeType: preferredType } : undefined);
      const chunks = [];
      audioStreamRef.current = stream;
      audioRecorderRef.current = recorder;
      recorder.ondataavailable = (event) => event.data.size && chunks.push(event.data);
      recorder.onstop = async () => {
        stream.getTracks().forEach((track) => track.stop());
        audioStreamRef.current = null;
        audioRecorderRef.current = null;
        setAudioRecording(false);
        if (!chunks.length) return;
        setAudioTranscribing(true);
        try {
          const type = recorder.mimeType || "audio/mp4";
          const extension = type.includes("mp4") ? "m4a" : "webm";
          const form = new FormData();
          form.append("audio", new File([new Blob(chunks, { type })], `descripcion.${extension}`, { type }));
          const result = await api.runAction(
            { title: "Transcribiendo tu descripción", description: "Estamos preparando el contexto para analizar la comida..." },
            () => api.request("/api/nutrition/ai-estimates/transcriptions", { method: "POST", body: form }),
          );
          if (!result?.transcript) throw new Error("No pudimos transcribir la nota. Intentá nuevamente.");
          setAiContext(result.transcript);
        } catch (error) {
          const message = error.message || "No pudimos transcribir la nota. Intentá nuevamente.";
          setAiError(message);
          api.notify(message, "error");
        } finally {
          setAudioTranscribing(false);
        }
      };
      recorder.start();
      setAudioRecording(true);
    } catch {
      setAiError("No pudimos acceder al micrófono. Podés escribir una descripción manualmente.");
    }
  }
  async function analyzeMealPhoto(file) {
    if (!file || aiAnalyzing) return;
    setAiError("");
    setAiAnalyzing(true);
    try {
      const image = await compressMealPhoto(file);
      const form = new FormData();
      form.append("image", image);
      if (aiContext.trim()) form.append("context", aiContext.trim());
      const result = await api.runAction(
        { title: "Analizando tu comida", description: "Estamos estimando los alimentos y las porciones visibles..." },
        () => api.request("/api/nutrition/ai-estimates", { method: "POST", body: form }),
      );
      if (!result?.items?.length) throw new Error("La IA no pudo identificar alimentos en esta foto. Probá con mejor luz.");
      setAiEstimate(result);
      setAiUsage(result.usage);
      setAiEstimatePhoto(image);
      setAiCorrection("");
      setAiRefinementError("");
      setPendingMealPhoto(null);
    } catch (error) {
      const message = error.message || "No se pudo analizar la foto.";
      setAiError(message);
      api.notify(message, "error");
    } finally {
      setAiAnalyzing(false);
    }
  }
  async function refineAiEstimate() {
    if (!aiEstimatePhoto || !aiEstimate || !aiCorrection.trim() || aiRefining) return;
    setAiRefinementError("");
    setAiRefining(true);
    try {
      const form = new FormData();
      form.append("image", aiEstimatePhoto);
      if (aiContext.trim()) form.append("context", aiContext.trim());
      form.append("request", new Blob([JSON.stringify({
        currentEstimate: {
          name: aiEstimate.name,
          description: aiEstimate.description || null,
          confidence: aiEstimate.confidence,
          assumptions: aiEstimate.assumptions || [],
          items: aiEstimate.items,
        },
        correction: aiCorrection.trim(),
      })], { type: "application/json" }));
      const result = await api.runAction(
        { title: "Corrigiendo estimación", description: "Estamos revisando la foto, tu observación y los cambios actuales..." },
        () => api.request("/api/nutrition/ai-estimates/refinements", { method: "POST", body: form }),
      );
      if (!result?.items?.length) throw new Error("La IA no pudo corregir esta estimación. Probá con una indicación más precisa.");
      setAiEstimate(result);
      setAiUsage(result.usage);
      setAiCorrection("");
    } catch (error) {
      const message = error.message || "No se pudo corregir la estimación.";
      setAiRefinementError(message);
      api.notify(message, "error");
    } finally {
      setAiRefining(false);
    }
  }
  function discardAiEstimate() {
    setAiEstimate(null);
    setAiEstimatePhoto(null);
    setAiContext("");
    setAiCorrection("");
    setAiRefinementError("");
  }
  async function confirmAiEstimate(estimate) {
    if (adding) return;
    setAdding(true);
    try {
      await api.runAction(
        { title: "Agregando estimación", description: "Estamos sumando los macros revisados a tu comida..." },
        () => api.request("/api/nutrition/ai-estimates/confirm", {
          method: "POST",
          body: JSON.stringify({ name: estimate.name, description: estimate.description || null, context: aiContext.trim() || null, confidence: estimate.confidence, items: estimate.items, mealType: mealType.code, logDate: selectedDate }),
        }),
      );
      api.notify("Estimación agregada. Revisá siempre las porciones y salsas.");
      discardAiEstimate();
      onDone();
    } catch (error) {
      api.notify(error.message || "No se pudo guardar la estimación.", "error");
    } finally {
      setAdding(false);
    }
  }
  useEffect(() => {
    if (!selected || selected.type !== "FOOD") return setSelectedPreparations([]);
    api
      .runAction(
        { title: "Cargando opciones", description: "Estamos buscando las presentaciones disponibles..." },
        () => api.request(`/api/foods/${selected.id}/preparations`),
        { quiet: true },
      )
      .then(setSelectedPreparations)
      .catch(() => setSelectedPreparations([]));
  }, [api, selected?.id, selected?.type]);
  useEffect(() => {
    if (!selected) return;
    if (selected.type === "FOOD" && selected.servingWeightGrams) {
      setQuantity("1");
      setUnit("SERVING");
    } else if (selected.type === "RECIPE") {
      setQuantity("1");
      setUnit("PORTION");
    } else {
      setQuantity(selected.category === "FAT" ? "10" : "100");
      setUnit("GRAM");
    }
  }, [selected?.category, selected?.id, selected?.servingWeightGrams, selected?.type]);
  useEffect(() => {
    if (!selected || selected.type !== "RECIPE") {
      setRecipeDetail(null);
      setRecipeIngredients(null);
      return;
    }
    api
      .request(`/api/recipes/${selected.id}`)
      .then((fullRecipe) => {
        setRecipeDetail(fullRecipe);
        setRecipeIngredients((fullRecipe.ingredients || []).map((ing) => ({
          foodId: ing.food?.id,
          name: ing.food?.name || "Alimento",
          quantity: String(ing.quantity ?? ""),
          unit: ing.unit || "GRAM",
        })));
      })
      .catch(() => {
        setRecipeDetail(null);
        setRecipeIngredients(null);
      });
  }, [api, selected?.id, selected?.type]);
  useEffect(() => {
    if (selected?.type === "RECIPE" && unit !== "PORTION") setUnit("PORTION");
    if (selected?.type !== "RECIPE" && !selected?.servingWeightGrams && unit === "SERVING") setUnit("GRAM");
  }, [selected, unit]);
  useEffect(() => {
    const numericQuantity = Number(quantity);
    if (!selected || !Number.isFinite(numericQuantity) || numericQuantity <= 0) return setPreview(null);
    if (selected.type === "FOOD") {
      const quantityInGrams = unit === "SERVING" ? numericQuantity * Number(selected.servingWeightGrams || 0) : numericQuantity;
      if (quantityInGrams <= 0) return setPreview(null);
      api
        .request("/api/foods/preview", {
          method: "POST",
          body: JSON.stringify({
            foodId: selected.id,
            quantity: quantityInGrams,
            unit: "GRAM",
          }),
        })
        .then(setPreview)
        .catch(() => setPreview(null));
    } else if (selected.type === "RECIPE" && recipeIngredients) {
      const nutrition = recipeIngredients.reduce((total, ing) => {
        const food = recipeDetail?.ingredients?.find((entry) => entry.food?.id === ing.foodId)?.food;
        const factor = Number(ing.quantity) / Number(food?.baseQuantity || 100);
        return {
          proteinGrams: total.proteinGrams + Number(food?.proteinGrams || 0) * factor,
          carbsGrams: total.carbsGrams + Number(food?.carbsGrams || 0) * factor,
          fatGrams: total.fatGrams + Number(food?.fatGrams || 0) * factor,
        };
      }, { proteinGrams: 0, carbsGrams: 0, fatGrams: 0 });
      setPreview({
        calories: Math.round((nutrition.proteinGrams * 4 + nutrition.carbsGrams * 4 + nutrition.fatGrams * 9) * numericQuantity),
        proteinGrams: nutrition.proteinGrams * numericQuantity,
        carbsGrams: nutrition.carbsGrams * numericQuantity,
        fatGrams: nutrition.fatGrams * numericQuantity,
      });
    } else {
      setPreview({
        calories: Math.round(selected.calories * numericQuantity),
        proteinGrams: selected.proteinGrams * numericQuantity,
        carbsGrams: selected.carbsGrams * numericQuantity,
        fatGrams: selected.fatGrams * numericQuantity,
      });
    }
  }, [api, recipeDetail, recipeIngredients, selected, quantity, unit]);
  async function add() {
    const numericQuantity = Number(quantity);
    if (!Number.isFinite(numericQuantity) || numericQuantity <= 0 || adding) return;
    const logQuantity = selected.type === "FOOD" && unit === "SERVING" ? numericQuantity * Number(selected.servingWeightGrams || 0) : numericQuantity;
    if (logQuantity <= 0) return;
    setAdding(true);
    const optimisticLogs = onOptimisticAdd([{
      itemType: selected.type,
      food: selected.type === "FOOD" ? selected : null,
      recipe: selected.type === "RECIPE" ? { ...selected, ...recipeDetail } : null,
      quantity: logQuantity,
      unit: selected.type === "RECIPE" ? "PORTION" : "GRAM",
      ...preview,
    }], mealType.code);
    try {
      const log = await api.runAction(
        { title: "Agregando alimento", description: `Estamos sumando ${selected.name} a ${mealType.label.toLowerCase()}...` },
        async () => {
          const newLog = await api.request("/api/nutrition/meal-logs", {
            method: "POST",
            body: JSON.stringify({
              itemType: selected.type,
              itemId: selected.id,
              mealType: mealType.code,
              quantity: logQuantity,
              unit: selected.type === "RECIPE" ? "PORTION" : "GRAM",
              logDate: selectedDate,
            }),
          });
          if (selected.type === "RECIPE" && recipeIngredients && recipeDetail) {
            const baseIngredients = (recipeDetail.ingredients || []).map((ing) => ({
              foodId: ing.food?.id,
              quantity: Number(ing.quantity ?? 0),
              unit: ing.unit || "GRAM",
            }));
            const changed = recipeIngredients.some((ing, i) => {
              const base = baseIngredients[i];
              return !base || Number(ing.quantity) !== Number(base.quantity);
            });
            if (changed) {
              await api.request(`/api/nutrition/food-logs/${newLog.id}/recipe-ingredients`, {
                method: "PUT",
                body: JSON.stringify({
                  ingredients: recipeIngredients.map(({ foodId, quantity: ingQty, unit }) => ({
                    foodId,
                    quantity: Number(ingQty),
                    unit,
                  })),
                }),
              });
            }
          }
          return newLog;
        },
        { quiet: true },
      );
      rememberItem(user, selected);
      rememberMeal(user, mealType.code, log);
      api.notify(`${selected.name} agregado a ${mealType.label}.`);
      onDone();
    } catch {
      onOptimisticRollback(optimisticLogs);
      api.notify("No se pudo agregar el alimento. Se revirtieron los cambios.", "error");
      setAdding(false);
    }
  }
  const selectedUnitOptions =
    selected?.type === "RECIPE"
      ? [{ value: "PORTION", label: "Porciones" }]
      : selected?.type === "FOOD" && selected?.servingWeightGrams
      ? [
          { value: "GRAM", label: "Gramos" },
          {
            value: "SERVING",
            label: `${selected.servingName || "Porción"} (${formatNumber(selected.servingWeightGrams, 1)} g)`,
          },
        ]
      : [{ value: "GRAM", label: "Gramos" }];
  function changeSelectedUnit(nextUnit) {
    if (nextUnit === unit) return;
    const numericQuantity = Number(quantity);
    const servingGrams = Number(selected?.servingWeightGrams);
    if (Number.isFinite(numericQuantity) && numericQuantity > 0 && Number.isFinite(servingGrams) && servingGrams > 0) {
      const converted = nextUnit === "GRAM" ? numericQuantity * servingGrams : numericQuantity / servingGrams;
      setQuantity(String(Number(converted.toFixed(2))));
    }
    setUnit(nextUnit);
  }
  return createPortal(
    <div className="modal-backdrop">
      <section ref={modalRef} className="picker-modal" role="dialog" aria-modal="true" aria-labelledby="food-picker-title">
        <header>
          <div>
            <span>{mealType.label}</span>
            <h2 id="food-picker-title">Agregar comida</h2>
          </div>
          <button className="icon-button" aria-label="Cerrar" onClick={onClose}>
            <Icon name="close" />
          </button>
        </header>
        <div className="tabs">
          <button
            className={tab === "FOOD" ? "selected" : ""}
            onClick={() => {
              setTab("FOOD");
              setSelected(null);
            }}
          >
            Alimentos
          </button>
          <button
            className={tab === "RECIPE" ? "selected" : ""}
            onClick={() => {
              setTab("RECIPE");
              setSelected(null);
            }}
          >
            Recetas
          </button>
        </div>
        <div className="picker-tools">
          <div className="search-wrap">
            <Icon name="search" />
            <input className="search" placeholder={`Buscar ${tab === "FOOD" ? "alimentos" : "recetas"}...`} value={query} onFocus={(event) => event.currentTarget.select()} onChange={(event) => setQuery(event.target.value)} />
          </div>
        </div>
        <div className="picker-scroll">
          <div className="picker-results">
            {groupFoodVariants(catalog.items).map((item) => (
              <CatalogRowWithImage key={`${tab}:${item.preparationGroup || item.id}`} item={{ ...item, type: tab }} onPick={setSelected} />
            ))}
          </div>
          {catalog.initialLoading && <CatalogStatus>Buscando alimentos…</CatalogStatus>}
          {!catalog.initialLoading && catalog.error && (
            <CatalogStatus error>
              {catalog.error}
              <button className="secondary" onClick={catalog.retry}>
                Reintentar
              </button>
            </CatalogStatus>
          )}
          {!catalog.initialLoading && !catalog.error && !catalog.items.length && <CatalogStatus>No encontramos resultados.</CatalogStatus>}
          {catalog.loadingMore && <CatalogStatus>Cargando más…</CatalogStatus>}
          {!catalog.initialLoading && !catalog.error && catalog.items.length > 0 && !catalog.hasNext && <CatalogStatus>Fin de los resultados.</CatalogStatus>}
          <InfiniteSentinel enabled={catalog.hasNext && !catalog.initialLoading && !catalog.loadingMore && !catalog.error} onLoad={catalog.loadNext} />
        </div>
        {selected && (
          <FoodLogDialog
            item={selected}
            eyebrow={`Agregar a ${mealType.label}`}
            isRecipe={selected.type === "RECIPE"}
            onClose={() => {
              setSelected(null);
              setPreview(null);
              setRecipeDetail(null);
              setRecipeIngredients(null);
            }}
            onSubmit={(event) => {
              event.preventDefault();
              add();
            }}
            titleId="add-food-log-title"
            footer={
              <footer className="modal-actions">
                <button type="button" className="secondary" disabled={adding} onClick={() => {
                  setSelected(null);
                  setPreview(null);
                  setRecipeDetail(null);
                  setRecipeIngredients(null);
                }}>
                  Cancelar
                </button>
                <button className="primary" disabled={adding || Number(quantity) <= 0}>
                  {adding ? "Agregando…" : `Agregar a ${mealType.label}`}
                </button>
              </footer>
            }
          >
              <FoodLogForm
                mode="add"
                isRecipe={selected.type === "RECIPE"}
                quantity={quantity}
                onQuantityChange={(value) => setQuantity(value)}
                unit={unit}
                unitOptions={selectedUnitOptions}
                onUnitChange={changeSelectedUnit}
                preparations={selectedPreparations}
                preparationValue={selected.id}
                onPreparationChange={(id) => {
                  const option = selectedPreparations.find((item) => item.id === id);
                  if (option) {
                    setSelected({ ...option, type: "FOOD" });
                    setUnit("GRAM");
                  }
                }}
                recipeIngredients={selected.type === "RECIPE" ? recipeIngredients : null}
                onRecipeIngredientChange={(index, value) => setRecipeIngredients(recipeIngredients.map((ing, i) => i === index ? { ...ing, quantity: value } : ing))}
                preview={preview}
              />
          </FoodLogDialog>
        )}
        {pendingMealPhoto && <MealPhotoContextEditor photoUrl={pendingMealPhotoUrl} context={aiContext} setContext={setAiContext} error={aiError} recording={audioRecording} transcribing={audioTranscribing} analyzing={aiAnalyzing} onToggleRecording={toggleMealNoteRecording} onDiscard={discardMealPhoto} onChangePhoto={() => galleryInputRef.current?.click()} onAnalyze={() => analyzeMealPhoto(pendingMealPhoto)} />}
        {aiEstimate && <AiEstimateEditor estimate={aiEstimate} setEstimate={setAiEstimate} correction={aiCorrection} setCorrection={setAiCorrection} refining={aiRefining} refinementError={aiRefinementError} onRefine={refineAiEstimate} saving={adding} onDiscard={discardAiEstimate} onConfirm={confirmAiEstimate} />}
        <footer className="picker-photo-actions">
          <label className={`secondary ai-photo-trigger ai-gallery-trigger ${aiAnalyzing || !aiUsage?.available || aiQuotaBlocked ? "disabled" : ""}`}>
            <Icon name="photo_library" />
            Elegir foto
            <input
              ref={galleryInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              disabled={aiAnalyzing || !aiUsage?.available || aiQuotaBlocked}
              onChange={(event) => {
                const file = event.currentTarget.files?.[0];
                event.currentTarget.value = "";
                selectMealPhoto(file);
              }}
              hidden
            />
          </label>
          <label className={`primary ai-photo-trigger ai-camera-trigger ${aiAnalyzing || !aiUsage?.available || aiQuotaBlocked ? "disabled" : ""}`}>
            <Icon name="photo_camera" />
            {aiAnalyzing ? "Analizando comida..." : aiQuotaBlocked ? `Vuelve ${aiQuotaReset(aiUsage)}` : "Tomar foto"}
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              capture="environment"
              disabled={aiAnalyzing || !aiUsage?.available || aiQuotaBlocked}
              onChange={(event) => {
                const file = event.currentTarget.files?.[0];
                event.currentTarget.value = "";
                selectMealPhoto(file);
              }}
              hidden
            />
          </label>
        </footer>
      </section>
    </div>,
    document.body,
  );
}

function MealPhotoContextEditor({ photoUrl, context, setContext, error, recording, transcribing, analyzing, onToggleRecording, onDiscard, onChangePhoto, onAnalyze }) {
  return (
    <div className="selected-subpanel ai-photo-context-subpanel">
      <section className="selected-editor ai-photo-context-editor" role="dialog" aria-modal="true" aria-label="Preparar análisis de foto">
        <span className="sheet-handle" aria-hidden="true" />
        <header>
          <div><span>Estimación IA</span><h3>Contanos sobre la foto</h3><small>Agregá detalles que no se vean con claridad, si hace falta.</small></div>
          <button className="icon-button" aria-label="Descartar foto" onClick={onDiscard}><Icon name="close" /></button>
        </header>
        {photoUrl && <img className="ai-photo-context-preview" src={photoUrl} alt="Foto elegida para estimar la comida" />}
        <div className="ai-context-tools">
          <label className="ai-context-field"><span>Descripción opcional</span><textarea maxLength="240" placeholder="Ej.: dos empanadas de carne con queso y gaseosa" value={context} onChange={(event) => setContext(event.target.value)} /></label>
          <button type="button" className={`secondary ai-note-record ${recording ? "recording" : ""}`} disabled={transcribing || analyzing} onClick={onToggleRecording}><Icon name={recording ? "stop_circle" : "mic"} />{transcribing ? "Transcribiendo..." : recording ? "Detener dictado" : "Dictar descripción"}</button>
        </div>
        {error && <p className="ai-estimate-error" role="alert">{error}</p>}
        <div className="ai-photo-context-actions">
          <button type="button" className="secondary" disabled={analyzing} onClick={onChangePhoto}>Cambiar foto</button>
          <button type="button" className="primary" disabled={analyzing || recording || transcribing} onClick={onAnalyze}>{analyzing ? "Analizando comida..." : "Analizar foto"}</button>
        </div>
      </section>
    </div>
  );
}

function AiEstimateEditor({ estimate, setEstimate, correction, setCorrection, refining, refinementError, onRefine, saving, onDiscard, onConfirm }) {
  const totals = (estimate.items || []).reduce((sum, item) => ({
    proteinGrams: sum.proteinGrams + Number(item.proteinGrams || 0),
    carbsGrams: sum.carbsGrams + Number(item.carbsGrams || 0),
    fatGrams: sum.fatGrams + Number(item.fatGrams || 0),
  }), { proteinGrams: 0, carbsGrams: 0, fatGrams: 0 });
  const calories = macroCalories(totals.proteinGrams, totals.carbsGrams, totals.fatGrams);
  function updateItem(index, field, value) {
    const normalized = value.replace(",", ".").replace(/[^\d.]/g, "");
    setEstimate((current) => ({ ...current, items: current.items.map((item, itemIndex) => itemIndex === index ? { ...item, [field]: normalized } : item) }));
  }
  function addItem() {
    if (estimate.items.length >= 12) return;
    setEstimate((current) => ({ ...current, items: [...current.items, { name: "", estimatedGrams: "100", proteinGrams: "0", carbsGrams: "0", fatGrams: "0" }] }));
  }
  function removeItem(index) {
    setEstimate((current) => ({ ...current, items: current.items.filter((_, itemIndex) => itemIndex !== index) }));
  }
  return (
    <div className="selected-subpanel ai-estimate-subpanel">
      <section className="selected-editor ai-estimate-editor" role="dialog" aria-modal="true" aria-label="Revisar estimación por foto">
        <span className="sheet-handle" aria-hidden="true" />
        <header><div><span>Estimación IA</span><h3>{estimate.name}</h3><small>Confianza estimada: {estimate.confidence}%</small></div><button className="icon-button" aria-label="Cerrar estimación" onClick={onDiscard}><Icon name="close" /></button></header>
        {estimate.description && <p className="ai-estimate-description"><strong>Lo que detectó la IA</strong>{estimate.description}</p>}
        <p className="ai-estimate-warning">Es una aproximación. Revisá especialmente aceites, salsas, queso y el tamaño de las porciones.</p>
        {(estimate.assumptions || []).length > 0 && <ul className="ai-estimate-assumptions">{estimate.assumptions.map((assumption) => <li key={assumption}>{assumption}</li>)}</ul>}
        <div className="ai-estimate-items">
          {estimate.items.map((item, index) => (
            <article key={`${item.name}:${index}`}>
              <div className="ai-estimate-item-heading"><strong>Alimento {index + 1}</strong><button type="button" className="icon-button ai-estimate-remove" aria-label={`Eliminar ${item.name || `alimento ${index + 1}`}`} disabled={refining} onClick={() => removeItem(index)}><Icon name="delete" /></button></div>
              <Input label="Alimento" value={item.name} disabled={refining} onChange={(event) => setEstimate((current) => ({ ...current, items: current.items.map((entry, itemIndex) => itemIndex === index ? { ...entry, name: event.target.value } : entry) }))} />
              <div className="ai-estimate-values">
                <label><span>g</span><input disabled={refining} inputMode="decimal" value={item.estimatedGrams ?? ""} onFocus={(event) => event.currentTarget.select()} onChange={(event) => updateItem(index, "estimatedGrams", event.target.value)} /></label>
                <label><span>P</span><input disabled={refining} inputMode="decimal" value={item.proteinGrams ?? ""} onFocus={(event) => event.currentTarget.select()} onChange={(event) => updateItem(index, "proteinGrams", event.target.value)} /></label>
                <label><span>C</span><input disabled={refining} inputMode="decimal" value={item.carbsGrams ?? ""} onFocus={(event) => event.currentTarget.select()} onChange={(event) => updateItem(index, "carbsGrams", event.target.value)} /></label>
                <label><span>G</span><input disabled={refining} inputMode="decimal" value={item.fatGrams ?? ""} onFocus={(event) => event.currentTarget.select()} onChange={(event) => updateItem(index, "fatGrams", event.target.value)} /></label>
              </div>
              <small className="ai-estimate-item-calories">{formatNumber(macroCalories(item.proteinGrams, item.carbsGrams, item.fatGrams))} kcal estimadas</small>
            </article>
          ))}
          <button type="button" className="secondary ai-estimate-add-item" disabled={refining || estimate.items.length >= 12} onClick={addItem}><Icon name="add" />Agregar alimento</button>
        </div>
        <section className="ai-estimate-refinement">
          <label className="ai-context-field"><span>Corregir estimación con IA</span><textarea maxLength="240" disabled={refining} placeholder="Ej.: no había queso, el pollo eran 250 g y faltó una cucharada de aceite" value={correction} onChange={(event) => setCorrection(event.target.value)} /><small>Usa la foto, tu observación original y la revisión actual como referencia.</small></label>
          {refinementError && <p className="ai-estimate-error" role="alert">{refinementError}</p>}
          <button type="button" className="secondary" disabled={refining || !correction.trim()} onClick={onRefine}>{refining ? "Corrigiendo..." : "Aplicar corrección IA"}</button>
        </section>
        <div className="ai-estimate-total"><span><small>Kcal aproximadas</small><strong>{formatNumber(calories)}</strong></span><span><small>Macros totales</small><strong>P {formatNumber(totals.proteinGrams, 1)} · C {formatNumber(totals.carbsGrams, 1)} · G {formatNumber(totals.fatGrams, 1)}</strong></span></div>
        <div className="ai-estimate-actions"><button className="secondary" disabled={refining} onClick={onDiscard}>Descartar</button><button className="primary" disabled={saving || refining || !estimate.items.length || estimate.items.some((item) => !item.name || Number(item.estimatedGrams) <= 0)} onClick={() => onConfirm(estimate)}>{saving ? "Agregando..." : "Agregar estimación"}</button></div>
      </section>
    </div>
  );
}

async function compressMealPhoto(file) {
  const source = URL.createObjectURL(file);
  try {
    const image = new Image();
    await new Promise((resolve, reject) => { image.onload = resolve; image.onerror = reject; image.src = source; });
    const scale = Math.min(1, 1280 / Math.max(image.naturalWidth, image.naturalHeight));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
    canvas.getContext("2d").drawImage(image, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.75));
    if (!blob) throw new Error("No pudimos preparar la foto.");
    return new File([blob], "comida.jpg", { type: "image/jpeg" });
  } finally {
    URL.revokeObjectURL(source);
  }
}

export function QuickItems({ title, items, onPick }) {
  if (!items.length) return null;
  return (
    <section className="quick-items">
      <span>{title}</span>
      <div>
        {items.map((item) => (
          <button key={`${item.type}:${item.id}`} onClick={() => onPick(item)}>
            <span>{item.name}</span>
            {item.type === "FOOD" && item.brand && <small>{item.brand}</small>}
          </button>
        ))}
      </div>
    </section>
  );
}

function RecentMeals({ user, api, date, mealTypes, onDone, onOptimisticAdd, onOptimisticRollback }) {
  const recents = readRecents(user);
  const meals = (recents.meals || []).map((meal) => {
    const savedItem = (recents.items || []).find((item) => item.id === meal.itemId && item.type === meal.itemType);
    const baseQuantity = meal.itemType === "RECIPE" ? 1 : Number(savedItem?.baseQuantity || 100);
    const estimatedCalories = baseQuantity > 0 ? Math.round(Number(savedItem?.calories || 0) * Number(meal.quantity || 0) / baseQuantity) : 0;
    return { ...meal, imageUrl: meal.imageUrl || savedItem?.imageUrl, category: meal.category || savedItem?.category, calories: meal.calories ?? estimatedCalories };
  });
  const [states, setStates] = useState({});
  async function addRecent(meal) {
    if (states[meal.id] === "adding") return;
    const optimisticLogs = onOptimisticAdd([{
      itemType: meal.itemType,
      food: meal.itemType === "FOOD" ? { id: meal.itemId, name: meal.label, imageUrl: meal.imageUrl, category: meal.category } : null,
      recipe: meal.itemType === "RECIPE" ? { id: meal.itemId, name: meal.label, imageUrl: meal.imageUrl } : null,
      quantity: meal.quantity,
      unit: meal.unit,
      calories: meal.calories,
    }], meal.mealType);
    const startedAt = performance.now();
    setStates((current) => ({ ...current, [meal.id]: "adding" }));
    try {
      await api.runAction(
        { title: "Agregando comida reciente", description: `Estamos sumando ${meal.label} a tu día...` },
        async () => {
          await createMealLogs(api, [meal], meal.mealType, date);
          api.notify(`${meal.label} agregado.`);
          await onDone();
        },
        { quiet: true },
      );
      const elapsed = performance.now() - startedAt;
      if (elapsed < 520) await new Promise((resolve) => window.setTimeout(resolve, 520 - elapsed));
      setStates((current) => ({ ...current, [meal.id]: "added" }));
      window.setTimeout(() => setStates((current) => ({ ...current, [meal.id]: "idle" })), 1300);
    } catch {
      onOptimisticRollback(optimisticLogs);
      setStates((current) => ({ ...current, [meal.id]: "error" }));
      api.notify("No se pudo agregar la comida reciente.", "error");
      window.setTimeout(() => setStates((current) => ({ ...current, [meal.id]: "idle" })), 900);
    }
  }
  if (!meals.length) return <p className="empty-state">Tus comidas recientes aparecerán acá.</p>;
  return (
    <div className="recent-meals">
      {meals.map((meal) => {
        const state = states[meal.id] || "idle";
        const mealLabel = mealTypes.find((type) => type.code === meal.mealType)?.label || meal.mealType;
        const item = { name: meal.label, imageUrl: meal.imageUrl, category: meal.category, type: meal.itemType };
        return (
          <article className={`recent-meal-card ${state}`} key={meal.id}>
            <FoodThumb item={item} compact />
            <span className="recent-meal-copy">
              <strong>{meal.label}</strong>
              <small>{mealLabel} · {meal.itemType === "RECIPE" ? `${formatNumber(meal.quantity, 1)} porción${Number(meal.quantity) === 1 ? "" : "es"}` : `${formatNumber(meal.quantity, 1)} g`}</small>
            </span>
            <strong className="recent-meal-calories">{formatNumber(meal.calories || 0)}<small> kcal</small></strong>
            <button type="button" disabled={state === "adding" || state === "added"} aria-label={`Agregar ${meal.label} a ${mealLabel}`} onClick={() => addRecent(meal)}>
              <Icon name={state === "added" ? "check" : state === "error" ? "refresh" : "add"} />
            </button>
          </article>
        );
      })}
    </div>
  );
}
