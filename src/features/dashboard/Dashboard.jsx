import React, { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { DEFAULT_MEALS } from "../../config/app";
import { InfiniteSentinel } from "../../components/InfiniteSentinel";
import { Input, Select } from "../../components/FormControls";
import { Header, Macro, Panel } from "../../components/Layout";
import { CatalogRowWithImage, CatalogStatus, CategoryChips, FoodThumb, PreparationBadge, groupFoodVariants, preparationLabel } from "../catalog/CatalogComponents";
import { EditFoodLog } from "../foods/Foods";
import { usePagedCatalog } from "../catalog/usePagedCatalog";
import { readRecents, rememberItem, rememberMeal } from "../../services/recents";
import { formatNumber, readableDate, shiftDate, today } from "../../utils/format";

function formatMealLogAmount(log) {
  if (log.itemType === "RECIPE") return `${formatNumber(log.quantity, 1)} porcion${Number(log.quantity) === 1 ? "" : "es"}`;
  return `${formatNumber(log.quantity, 1)} g`;
}

function foodPreparationSuffix(food) {
  return food?.preparation && food.preparation !== "UNSPECIFIED" ? ` · ${preparationLabel(food.preparation)}` : "";
}

function scaleFoodNutrition(food, quantity) {
  const baseQuantity = Number(food?.baseQuantity || 100);
  const grams = Number(quantity || 0);
  const factor = baseQuantity > 0 ? grams / baseQuantity : 0;
  return {
    calories: Math.round(Number(food?.calories || 0) * factor),
    proteinGrams: Number(food?.proteinGrams || 0) * factor,
    carbsGrams: Number(food?.carbsGrams || 0) * factor,
    fatGrams: Number(food?.fatGrams || 0) * factor,
  };
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
  const [mealPasteLoading, setMealPasteLoading] = useState(false);
  const [swipeResetSignal, setSwipeResetSignal] = useState(0);
  const optimisticLogs = useRef(new Map());
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
    api.request(`/api/nutrition/dashboard?date=${shiftDate(selectedDate, -1)}`)
      .then((result) => active && setYesterdayData(result))
      .catch(() => active && setYesterdayData(null));
    return () => { active = false; };
  }, [selectedDate]);
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
  function showOptimisticRecent(meal) {
    const optimisticId = `recent:${meal.id}`;
    optimisticLogs.current.set(optimisticId, meal.mealType);
    const item = meal.itemType === "RECIPE"
      ? { recipe: { id: meal.itemId, name: meal.label, imageUrl: meal.imageUrl }, food: null }
      : { food: { id: meal.itemId, name: meal.label, imageUrl: meal.imageUrl, category: meal.category }, recipe: null };
    const optimisticLog = { ...item, id: optimisticId, itemType: meal.itemType, mealType: meal.mealType, quantity: meal.quantity, unit: meal.unit, calories: meal.calories || 0, optimistic: true };
    setData((current) => ({
      ...current,
      meals: mealTypes.map((type) => {
        const existing = current?.meals?.find((entry) => entry.mealType === type.code) || { mealType: type.code, items: [], calories: 0 };
        if (type.code !== meal.mealType || existing.items?.some((entry) => entry.id === optimisticId)) return existing;
        return { ...existing, calories: Number(existing.calories || 0) + Number(meal.calories || 0), items: [...(existing.items || []), optimisticLog] };
      }),
    }));
    return optimisticId;
  }
  function rollbackOptimisticRecent(optimisticId) {
    const mealType = optimisticLogs.current.get(optimisticId);
    optimisticLogs.current.delete(optimisticId);
    setData((current) => ({ ...current, meals: current.meals.map((meal) => meal.mealType !== mealType ? meal : { ...meal, calories: Math.max(0, Number(meal.calories || 0) - Number(meal.items.find((item) => item.id === optimisticId)?.calories || 0)), items: meal.items.filter((item) => item.id !== optimisticId) }) }));
  }
  if (loading && !data) {
    return (
      <section className="page">
        <Header title="Mi día" action={<DateNavigator date={selectedDate} setDate={setSelectedDate} />} />
        <CatalogStatus>Cargando tu día…</CatalogStatus>
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
              {data.plan.proteinPercent}% proteinas / {data.plan.carbsPercent}% carbs / {data.plan.fatPercent}% grasas
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
            clipboard={mealClipboard}
            pasteLoading={mealPasteLoading}
            setPasteLoading={setMealPasteLoading}
            onCopyMeal={(items) => { setMealClipboard(items); api.notify("Comida copiada."); }}
            deletingLogId={deletingLogId}
            movingLogId={movingLogId}
            resetSignal={swipeResetSignal}
            onAdd={() => setPickerMeal(mealType)}
            onEdit={(log) => {
              resetMealSwipes();
              setEditingLog(log);
            }}
            onMove={async (log, targetMealType) => {
              if (movingLogId || log.mealType === targetMealType) return;
              resetMealSwipes();
              setMovingLogId(log.id);
              try {
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
              } catch (error) {
                api.notify(error.message || "No se pudo mover el alimento.", "error");
              } finally {
                setMovingLogId(null);
              }
            }}
            onDelete={async (log) => {
              if (deletingLogId) return;
              if (!window.confirm(`Eliminar ${log.itemType === "RECIPE" ? log.recipe?.name : log.food?.name} del registro?`)) {
                resetMealSwipes();
                return;
              }
              resetMealSwipes();
              setDeletingLogId(log.id);
              try {
                await api.request(`/api/nutrition/food-logs/${log.id}`, {
                  method: "DELETE",
                });
                api.notify("Registro eliminado.");
                await load();
              } catch (error) {
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
                try {
                  await api.request(`/api/nutrition/water-logs/latest?date=${selectedDate}`, { method: "DELETE" });
                  api.notify("Ultimo registro de agua eliminado.");
                  await load();
                } catch {
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
                try {
                  await api.request("/api/nutrition/water-logs", {
                    method: "POST",
                    body: JSON.stringify({
                      liters: 0.5,
                      logDate: selectedDate,
                    }),
                  });
                  api.notify("Hidratacion registrada.");
                  await load();
                } catch {
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
          <RecentMeals user={user} api={api} date={selectedDate} mealTypes={mealTypes} onDone={load} onOptimisticAdd={showOptimisticRecent} onOptimisticRollback={rollbackOptimisticRecent} />
        </Panel>}
      </div>
      <PastMealsPreview api={api} targetDate={selectedDate} mealTypes={mealTypes} onCopied={load} />
      {pickerMeal && (
        <FoodPicker
          api={api}
          user={user}
          mealType={pickerMeal}
          selectedDate={selectedDate}
          onClose={() => setPickerMeal(null)}
          onDone={() => {
            setPickerMeal(null);
            load();
          }}
          onNavigate={(target) => {
            setPickerMeal(null);
            requestAnimationFrame(() => setPage(target));
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
      {mealPasteLoading && <MealPasteLoader />}
    </section>
  );
}

function MealPasteLoader() {
  return createPortal(
    <div className="meal-paste-loader" role="alert" aria-live="assertive" aria-busy="true">
      <div className="meal-paste-loader-card">
        <span className="meal-paste-spinner" aria-hidden="true" />
        <strong>Pegando comida</strong>
        <small>Estamos guardando los alimentos...</small>
      </div>
    </div>,
    document.body
  );
}

function CompactBalanceBar({ visible, consumed, goal, macros, onGoTop }) {
  const macroByKey = new Map(macros.map((macro) => [String(macro.key).toUpperCase(), macro]));
  const compactMacros = [["PROTEIN", "Proteína", "P"], ["CARBS", "Carbos", "C"], ["FAT", "Grasas", "G"]];
  return (
    <div className={`compact-balance-shell ${visible ? "visible" : ""}`} aria-hidden={!visible}>
      <button type="button" className="compact-balance" onClick={onGoTop} tabIndex={visible ? 0 : -1} aria-label="Volver arriba al balance completo">
        <span className="compact-calories"><span className="material-symbols-outlined">local_fire_department</span><strong>{formatNumber(consumed)}<small> / {formatNumber(goal)} kcal</small></strong></span>
        <span className="compact-macros">
          {compactMacros.map(([key, label, shortLabel]) => {
            const macro = macroByKey.get(key);
            return <span key={key}><b className="macro-full-label">{label}</b><b className="macro-short-label">{shortLabel}</b><strong>{formatNumber(macro?.consumed)}<small>/{formatNumber(macro?.goal)}g</small></strong></span>;
          })}
        </span>
        <span className="compact-balance-up material-symbols-outlined" aria-hidden="true">keyboard_arrow_up</span>
      </button>
    </div>
  );
}

function DateNavigator({ date, setDate }) {
  return (
    <div className="date-nav">
      <button className="icon-button" aria-label="Día anterior" onClick={() => setDate(shiftDate(date, -1))}>
        <span className="material-symbols-outlined">chevron_left</span>
      </button>
      <label>
        <span>{readableDate(date)}</span>
        <input type="date" value={date} onChange={(event) => setDate(event.target.value)} />
      </label>
      <button className="icon-button" aria-label="Día siguiente" onClick={() => setDate(shiftDate(date, 1))}>
        <span className="material-symbols-outlined">chevron_right</span>
      </button>
      <button className="secondary today-button" aria-label="Ir a hoy" onClick={() => setDate(today())}>
        <span className="material-symbols-outlined">today</span><span className="today-label">Hoy</span>
      </button>
    </div>
  );
}

function PastMealsPreview({ api, targetDate, mealTypes, onCopied }) {
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
      setSource(await api.request(`/api/nutrition/dashboard?date=${sourceDate}`));
    } catch {
      api.notify("No se pudo cargar ese dia.", "error");
    } finally {
      setLoading(false);
    }
  }
  async function copyMeal(mealType, items) {
    setStatus((current) => ({ ...current, [mealType]: "copying" }));
    try {
      for (const log of items)
        await api.request("/api/nutrition/meal-logs", {
          method: "POST",
          body: JSON.stringify({
            itemType: log.itemType,
            itemId: log.itemType === "RECIPE" ? log.recipe?.id : log.food?.id,
            mealType,
            quantity: log.quantity,
            unit: log.unit || "GRAM",
            logDate: targetDate,
          }),
        });
      setStatus((current) => ({ ...current, [mealType]: "copied" }));
      api.notify("Comida copiada respetando su horario.");
      await onCopied();
    } catch {
      setStatus((current) => ({ ...current, [mealType]: "error" }));
      api.notify("No se pudo copiar la comida completa.", "error");
    }
  }
  return (
    <details className="panel past-meals-panel">
      <summary><span className="material-symbols-outlined">content_copy</span><span><strong>Copiar comidas de otro día</strong><small>Reutilizá un día anterior sin cargar todo de nuevo</small></span><span className="material-symbols-outlined chevron">expand_more</span></summary>
      <div className="past-meals-content">
      <div className="past-meals-tools">
        <Input
          label="Dia de origen"
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
                      <span className="material-symbols-outlined">{state === "copied" ? "check_circle" : "check"}</span>
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
                      <span className="material-symbols-outlined">close</span>
                    </button>
                  </div>
                </header>
                {items.map((log) => (
                  <div className="ghost-item" key={log.id}>
                    <span>{log.itemType === "RECIPE" ? log.recipe?.name : log.food?.name}</span>
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

function MealCard({ mealType, meal, yesterdayMeal, targetDate, api, onCopied, clipboard, pasteLoading, setPasteLoading, onCopyMeal, deletingLogId, movingLogId, resetSignal, onAdd, onEdit, onDelete, onMove }) {
  const items = meal?.items || [];
  const cardRef = useRef(null);
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
    try {
      for (const log of yesterdayItems) {
        await api.request("/api/nutrition/meal-logs", {
          method: "POST",
          body: JSON.stringify({ itemType: log.itemType, itemId: log.itemType === "RECIPE" ? log.recipe?.id : log.food?.id, mealType: mealType.code, quantity: log.quantity, unit: log.unit || "GRAM", logDate: targetDate }),
        });
      }
      setSuggestionState("copied");
      api.notify(`${mealType.label} copiado de ayer.`);
      await new Promise((resolve) => window.setTimeout(resolve, 650));
      await onCopied();
    } catch {
      setSuggestionState("idle");
      api.notify("No se pudo copiar la comida de ayer.", "error");
    }
  }
  async function addLogs(logs) {
    if (pasteLoading) return;
    setPasteLoading(true);
    try {
      for (const log of logs) await api.request("/api/nutrition/meal-logs", { method: "POST", body: JSON.stringify({ itemType: log.itemType, itemId: log.itemType === "RECIPE" ? log.recipe?.id : log.food?.id, mealType: mealType.code, quantity: log.quantity, unit: log.unit || "GRAM", logDate: targetDate }) });
      api.notify(`Comida pegada en ${mealType.label}.`); await onCopied();
    } catch { api.notify("No se pudo pegar la comida.", "error"); }
    finally { setPasteLoading(false); }
  }
  async function deleteAll() {
    if (!items.length || !window.confirm(`¿Borrar todo ${mealType.label.toLowerCase()}?`)) return;
    try { for (const log of items) await api.request(`/api/nutrition/food-logs/${log.id}`, { method: "DELETE" }); api.notify(`${mealType.label} eliminado.`); await onCopied(); }
    catch { api.notify("No se pudo borrar toda la comida.", "error"); }
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
          <details className="meal-menu"><summary aria-label={`Acciones de ${mealType.label}`}><span className="material-symbols-outlined">more_vert</span></summary><div><button disabled={!items.length || pasteLoading} onClick={() => onCopyMeal(items)}>Copiar todo</button><button disabled={!clipboard?.length || pasteLoading} onClick={() => addLogs(clipboard)}>Pegar</button><button className="danger-text" disabled={!items.length || pasteLoading} onClick={deleteAll}>Borrar todo</button></div></details>
          <button className="icon-button" aria-label={`Agregar alimento a ${mealType.label}`} onClick={onAdd}><span className="material-symbols-outlined">add</span></button>
        </div>
      </header>
      <div className="meal-macros">
        <small>P {formatNumber(meal?.proteinGrams, 1)}g</small>
        <small>C {formatNumber(meal?.carbsGrams, 1)}g</small>
        <small>G {formatNumber(meal?.fatGrams, 1)}g</small>
      </div>
      {!items.length && yesterdayItems.length > 0 && suggestionState !== "dismissed" && (
        <div className={`yesterday-suggestion ${suggestionState === "copied" ? "copied" : ""}`}>
          <span className="material-symbols-outlined" aria-hidden="true">content_copy</span>
          <span><strong>¿Copiar de ayer?</strong><small>{yesterdayItems.length} {yesterdayItems.length === 1 ? "elemento" : "elementos"}</small></span>
          <button className="copy-accept" disabled={suggestionState === "copying" || suggestionState === "copied"} aria-label={`Copiar ${mealType.label} de ayer`} onClick={copyYesterday}><span className="material-symbols-outlined">{suggestionState === "copied" ? "check_circle" : "check"}</span></button>
          <button className="copy-reject" disabled={suggestionState === "copying" || suggestionState === "copied"} aria-label="Descartar sugerencia" onClick={() => setSuggestionState("dismissed")}><span className="material-symbols-outlined">close</span></button>
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
          const item = log.itemType === "RECIPE" ? { ...log.recipe, type: "RECIPE" } : { ...log.food, type: "FOOD" };
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
        <p className="empty-state">Todavia no registraste nada.</p>
      )}
    </article>
  );
}

function MealLogDetails({ log, item }) {
  if (log.itemType === "RECIPE") {
    const ingredients = item?.ingredients || [];
    return (
      <div className="meal-item-detail">
        <div className="meal-detail-summary">
          <span><small>Porciones</small><strong>{formatNumber(log.quantity, 1)}</strong></span>
          <span><small>Peso interno</small><strong>{formatNumber(item?.totalWeightGrams, 1)}g</strong></span>
        </div>
        <NutritionPills nutrition={log} />
        <div className="recipe-detail-list">
          {ingredients.length ? ingredients.map((ingredient, index) => (
            <RecipeIngredientDetail ingredient={ingredient} key={`${ingredient.food?.id || "food"}-${index}`} />
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
        <span><small>Alimento</small><strong>{item?.name}</strong></span>
      </div>
      <NutritionPills nutrition={log} />
    </div>
  );
}

function RecipeIngredientDetail({ ingredient }) {
  const [open, setOpen] = useState(false);
  const food = ingredient.food || {};
  const nutrition = scaleFoodNutrition(food, ingredient.quantity);
  return (
    <button type="button" className={`recipe-ingredient-detail ${open ? "open" : ""}`} onClick={() => setOpen((current) => !current)} aria-expanded={open}>
      <span className="recipe-ingredient-main">
        <FoodThumb item={{ ...food, type: "FOOD" }} compact />
        <span><strong>{food.name || "Alimento"}</strong><small>{formatNumber(ingredient.quantity, 1)} g{foodPreparationSuffix(food)}</small></span>
        <span className="material-symbols-outlined" aria-hidden="true">expand_more</span>
      </span>
      {open && (
        <span className="recipe-ingredient-panel">
          <NutritionPills nutrition={nutrition} />
        </span>
      )}
    </button>
  );
}

function SwipeableMealItem({ children, className = "", resetSignal, expanded = false, onToggle, details, onEdit, onDelete }) {
  const gesture = useRef(null);
  const suppressClick = useRef(false);
  const [offset, setOffset] = useState(0);
  const [revealed, setRevealed] = useState("");
  const [dragging, setDragging] = useState(false);
  const [horizontalDragging, setHorizontalDragging] = useState(false);
  const close = useCallback(() => {
    gesture.current = null;
    setDragging(false);
    setHorizontalDragging(false);
    setRevealed("");
    setOffset(0);
  }, []);
  useEffect(() => close(), [close, resetSignal]);
  useEffect(() => {
    if (expanded && revealed) close();
  }, [expanded, close, revealed]);
  function finish() {
    if (gesture.current?.axis === "x" && offset > 64) {
      suppressClick.current = true;
      setRevealed("edit");
      setOffset(76);
    } else if (gesture.current?.axis === "x" && offset < -64) {
      suppressClick.current = true;
      setRevealed("delete");
      setOffset(-76);
    } else {
      if (gesture.current?.axis === "x") suppressClick.current = true;
      close();
    }
    gesture.current = null;
    setDragging(false);
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
        setDragging(false);
        setHorizontalDragging(false);
        setOffset(0);
      }
    }
    if (gesture.current.axis === "x") {
      event.preventDefault();
      setHorizontalDragging(true);
      setOffset(Math.max(-92, Math.min(92, dx)));
    }
  }
  return (
    <div className={`swipe-row ${revealed} ${horizontalDragging ? "swiping" : ""} ${expanded ? "expanded" : ""}`}>
      <button className="swipe-action swipe-edit" aria-label="Editar registro" onClick={() => { close(); window.setTimeout(onEdit, 120); }}><span className="material-symbols-outlined">edit</span></button>
      <button className="swipe-action swipe-delete" aria-label="Eliminar registro" onClick={() => { close(); window.setTimeout(onDelete, 120); }}><span className="material-symbols-outlined">delete</span></button>
      <div
        className={`meal-item-shell ${horizontalDragging ? "swiping" : ""} ${className}`}
        style={{ transform: `translateX(${offset}px)` }}
        onTouchStart={(event) => {
          gesture.current = { x: event.touches[0].clientX, y: event.touches[0].clientY, axis: null };
          setDragging(true);
        }}
        onTouchMove={move}
        onTouchEnd={finish}
        onTouchCancel={finish}
      >
        <button type="button" className="meal-item" aria-expanded={expanded} onClick={() => !horizontalDragging && !suppressClick.current && onToggle?.()}>
          {children}
          <span className="meal-item-chevron material-symbols-outlined" aria-hidden="true">expand_more</span>
        </button>
        {expanded && details}
      </div>
    </div>
  );
}

function FoodPicker({ api, user, mealType, selectedDate, onClose, onDone, onNavigate }) {
  const modalRef = useRef(null);
  const [tab, setTab] = useState("FOOD");
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("");
  const [selected, setSelected] = useState(null);
  const [selectedPreparations, setSelectedPreparations] = useState([]);
  const [quantity, setQuantity] = useState("150");
  const [unit, setUnit] = useState("GRAM");
  const [preview, setPreview] = useState(null);
  const [adding, setAdding] = useState(false);
  const recents = readRecents(user);
  const catalog = usePagedCatalog({
    api,
    endpoint: tab === "FOOD" ? "/api/foods" : "/api/recipes",
    query,
    category: tab === "FOOD" ? category : "",
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
    if (!selected || selected.type !== "FOOD") return setSelectedPreparations([]);
    api
      .request(`/api/foods/${selected.id}/preparations`)
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
    } else {
      setPreview({
        calories: Math.round(selected.calories * numericQuantity),
        proteinGrams: selected.proteinGrams * numericQuantity,
        carbsGrams: selected.carbsGrams * numericQuantity,
        fatGrams: selected.fatGrams * numericQuantity,
      });
    }
  }, [api, selected, quantity, unit]);
  async function add() {
    const numericQuantity = Number(quantity);
    if (!Number.isFinite(numericQuantity) || numericQuantity <= 0 || adding) return;
    const logQuantity = selected.type === "FOOD" && unit === "SERVING" ? numericQuantity * Number(selected.servingWeightGrams || 0) : numericQuantity;
    if (logQuantity <= 0) return;
    setAdding(true);
    try {
      const log = await api.request("/api/nutrition/meal-logs", {
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
      rememberItem(user, selected);
      rememberMeal(user, mealType.code, log);
      api.notify(`${selected.name} agregado a ${mealType.label}.`);
      onDone();
    } catch {
      api.notify("No se pudo agregar el alimento.", "error");
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
  return (
    <div className="modal-backdrop">
      <section ref={modalRef} className="picker-modal" role="dialog" aria-modal="true" aria-labelledby="food-picker-title">
        <header>
          <div>
            <span>{mealType.label}</span>
            <h2 id="food-picker-title">Agregar comida</h2>
          </div>
          <button className="icon-button" aria-label="Cerrar" onClick={onClose}>
            <span className="material-symbols-outlined">close</span>
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
            <span className="material-symbols-outlined">search</span>
            <input className="search" placeholder={`Buscar ${tab === "FOOD" ? "alimentos" : "recetas"}...`} value={query} onChange={(event) => setQuery(event.target.value)} />
          </div>
          {tab === "FOOD" && <CategoryChips category={category} setCategory={setCategory} />}
        </div>
        <div className="picker-scroll">
          <QuickItems title="Usados recientemente" items={groupFoodVariants(recents.items.filter((item) => item.type === tab))} onPick={setSelected} />
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
          <div
            className="selected-subpanel"
            role="presentation"
            onMouseDown={(event) => {
              if (event.target === event.currentTarget) {
                setSelected(null);
                setPreview(null);
              }
            }}
          >
            <section className="selected-editor" role="dialog" aria-modal="true" aria-label={`Configurar ${selected.name}`}>
              <span className="sheet-handle" aria-hidden="true" />
              <div className="selected-heading">
                <FoodThumb item={selected} compact />
                <div>
                  <strong>{selected.name}</strong>
                  <PreparationBadge food={selected} />
                </div>
                <button
                  className="icon-button selected-close"
                  aria-label="Cerrar alimento seleccionado"
                  onClick={() => {
                    setSelected(null);
                    setPreview(null);
                  }}
                >
                  <span className="material-symbols-outlined">close</span>
                </button>
              </div>
              {selectedPreparations.length > 1 && (
                <Select
                  label="Peso del alimento"
                  value={String(selected.id)}
                  onChange={(event) => {
                    const option = selectedPreparations.find((item) => item.id === Number(event.target.value));
                    if (option) {
                      setSelected({ ...option, type: "FOOD" });
                      setUnit("GRAM");
                    }
                  }}
                  options={selectedPreparations.map((item) => ({
                    value: String(item.id),
                    label: preparationLabel(item.preparation),
                  }))}
                />
              )}
              <div className="selected-controls">
                <Input selectOnFocus numericOnly label={selected.type === "RECIPE" ? "Porciones" : unit === "GRAM" ? "Gramos" : "Cantidad de porciones"} type="number" inputMode="decimal" min="0.1" step="0.1" value={quantity} onChange={(event) => setQuantity(event.target.value)} />
                {selected.type === "RECIPE" ? (
                  <div className="recipe-fixed-unit" aria-label="Unidad fija">
                    <span>Unidad</span>
                    <strong>Porciones</strong>
                  </div>
                ) : (
                  <Select label="Unidad" value={unit} onChange={(event) => changeSelectedUnit(event.target.value)} options={selectedUnitOptions} />
                )}
              </div>
              <div className="nutrition-preview" aria-label="Resumen nutricional">
                <span>
                  <small>Kcal</small>
                  <strong>{formatNumber(preview?.calories)}</strong>
                </span>
                <span>
                  <small>Proteínas</small>
                  <strong>{formatNumber(preview?.proteinGrams, 1)}g</strong>
                </span>
                <span>
                  <small>Carbos</small>
                  <strong>{formatNumber(preview?.carbsGrams, 1)}g</strong>
                </span>
                <span>
                  <small>Grasas</small>
                  <strong>{formatNumber(preview?.fatGrams, 1)}g</strong>
                </span>
              </div>
              <button className="primary" disabled={adding || Number(quantity) <= 0} onClick={add}>
                {adding ? "Agregando…" : `Agregar a ${mealType.label}`}
              </button>
            </section>
          </div>
        )}
        <footer>
          <button className="secondary" onClick={() => onNavigate("scanner")}>
            Escanear
          </button>
          <button className="secondary" onClick={() => onNavigate("create")}>
            Crear nuevo
          </button>
        </footer>
      </section>
    </div>
  );
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
    const optimisticId = onOptimisticAdd(meal);
    const startedAt = performance.now();
    setStates((current) => ({ ...current, [meal.id]: "adding" }));
    try {
      await api.request("/api/nutrition/meal-logs", {
        method: "POST",
        body: JSON.stringify({
          itemType: meal.itemType,
          itemId: meal.itemId,
          mealType: meal.mealType,
          quantity: meal.quantity,
          unit: meal.itemType === "RECIPE" ? "PORTION" : meal.unit,
          logDate: date,
        }),
      });
      api.notify(`${meal.label} agregado.`);
      await onDone();
      const elapsed = performance.now() - startedAt;
      if (elapsed < 520) await new Promise((resolve) => window.setTimeout(resolve, 520 - elapsed));
      setStates((current) => ({ ...current, [meal.id]: "added" }));
      window.setTimeout(() => setStates((current) => ({ ...current, [meal.id]: "idle" })), 1300);
    } catch {
      onOptimisticRollback(optimisticId);
      setStates((current) => ({ ...current, [meal.id]: "error" }));
      api.notify("No se pudo agregar la comida reciente.", "error");
      window.setTimeout(() => setStates((current) => ({ ...current, [meal.id]: "idle" })), 900);
    }
  }
  if (!meals.length) return <p className="empty-state">Tus comidas recientes apareceran aca.</p>;
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
              <small>{mealLabel} · {meal.itemType === "RECIPE" ? `${formatNumber(meal.quantity, 1)} porcion${Number(meal.quantity) === 1 ? "" : "es"}` : `${formatNumber(meal.quantity, 1)} g`}</small>
            </span>
            <strong className="recent-meal-calories">{formatNumber(meal.calories || 0)}<small> kcal</small></strong>
            <button type="button" disabled={state === "adding" || state === "added"} aria-label={`Agregar ${meal.label} a ${mealLabel}`} onClick={() => addRecent(meal)}>
              <span className="material-symbols-outlined" aria-hidden="true">{state === "added" ? "check" : state === "error" ? "refresh" : "add"}</span>
            </button>
          </article>
        );
      })}
    </div>
  );
}
