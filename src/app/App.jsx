import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import "../styles.css";
import { request as apiRequest } from "../services/http";
import { usePagedCatalog } from "../features/catalog/usePagedCatalog";
import { InfiniteSentinel } from "../components/InfiniteSentinel";
import { APP_NAME, TOKEN_KEY, USER_KEY, REGISTRATION_ENABLED, DEFAULT_MEALS, navItems, CATEGORY_OPTIONS, PREPARATION_OPTIONS, CATEGORY_ART, RECIPE_ART, UNIT_OPTIONS } from "../config/app";
import { recognizeNutrition } from "../services/nutritionOcr";
import { today, shiftDate, readableDate, formatNumber, macroGrams, macroValue } from "../utils/format";
import { getSavedUser, readRecents, rememberItem, rememberMeal } from "../services/recents";
import { Shell } from "./Shell";
import { AuthScreen } from "../features/auth/AuthScreen";
import { Input, Select } from "../components/FormControls";

export function App() {
  const [page, setPage] = useState(() => (localStorage.getItem(TOKEN_KEY) ? "dashboard" : "login"));
  const [toast, setToast] = useState(null);
  const [user, setUser] = useState(() => getSavedUser(USER_KEY));
  const [selectedFoodId, setSelectedFoodId] = useState(null);
  const [prefillBarcode, setPrefillBarcode] = useState("");

  const api = useMemo(
    () => ({
      request: apiRequest,
      notify(message, tone = "success") {
        setToast({ message, tone });
        window.setTimeout(() => setToast(null), 3500);
      },
    }),
    [],
  );

  useLayoutEffect(() => {
    window.scrollTo(0, 0);
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
  }, [page]);

  function saveSession(payload) {
    localStorage.setItem(TOKEN_KEY, payload.token);
    localStorage.setItem(USER_KEY, JSON.stringify(payload.user));
    setUser(payload.user);
    setPage("dashboard");
  }

  function logout() {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    setUser(null);
    setPage("login");
  }

  useEffect(() => {
    const expireSession = () => {
      logout();
      api.notify("Tu sesion vencio. Volve a ingresar.", "error");
    };
    window.addEventListener("kazaFitness:session-expired", expireSession);
    return () => window.removeEventListener("kazaFitness:session-expired", expireSession);
  }, [api]);

  const authenticated = Boolean(localStorage.getItem(TOKEN_KEY));
  return (
    <>
      {authenticated ? (
        <Shell user={user} page={page} setPage={setPage} logout={logout}>
          {page === "dashboard" && <Dashboard api={api} user={user} setPage={setPage} />}
          {page === "foods" && <Foods api={api} user={user} setPage={setPage} setSelectedFoodId={setSelectedFoodId} />}
          {page === "create" && <CreateCatalog api={api} setPage={setPage} prefillBarcode={prefillBarcode} clearPrefillBarcode={() => setPrefillBarcode("")} />}
          {page === "configure" && <ConfigureFood api={api} setPage={setPage} foodId={selectedFoodId} user={user} />}
          {page === "scanner" && <Scanner api={api} setPage={setPage} setSelectedFoodId={setSelectedFoodId} setPrefillBarcode={setPrefillBarcode} />}
          {page === "history" && <History api={api} />}
          {page === "profile" && <Profile api={api} logout={logout} />}
        </Shell>
      ) : (
        <AuthScreen page={page} setPage={setPage} saveSession={saveSession} notify={api.notify} />
      )}
      {toast && <Toast {...toast} />}
    </>
  );
}

function Dashboard({ api, user, setPage }) {
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
    </section>
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
                      {formatNumber(log.quantity, 1)}g · {log.calories} kcal
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

function MealCard({ mealType, meal, yesterdayMeal, targetDate, api, onCopied, clipboard, onCopyMeal, deletingLogId, movingLogId, resetSignal, onAdd, onEdit, onDelete, onMove }) {
  const items = meal?.items || [];
  const [dragOver, setDragOver] = useState(false);
  const [suggestionState, setSuggestionState] = useState("idle");
  const yesterdayItems = yesterdayMeal?.items || [];
  useEffect(() => setSuggestionState("idle"), [targetDate, mealType.code]);
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
    try {
      for (const log of logs) await api.request("/api/nutrition/meal-logs", { method: "POST", body: JSON.stringify({ itemType: log.itemType, itemId: log.itemType === "RECIPE" ? log.recipe?.id : log.food?.id, mealType: mealType.code, quantity: log.quantity, unit: log.unit || "GRAM", logDate: targetDate }) });
      api.notify(`Comida pegada en ${mealType.label}.`); await onCopied();
    } catch { api.notify("No se pudo pegar la comida.", "error"); }
  }
  async function deleteAll() {
    if (!items.length || !window.confirm(`¿Borrar todo ${mealType.label.toLowerCase()}?`)) return;
    try { for (const log of items) await api.request(`/api/nutrition/food-logs/${log.id}`, { method: "DELETE" }); api.notify(`${mealType.label} eliminado.`); await onCopied(); }
    catch { api.notify("No se pudo borrar toda la comida.", "error"); }
  }
  return (
    <article
      className={`meal-card ${dragOver ? "drag-over" : ""}`}
      data-meal-type={mealType.code}
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
          <details className="meal-menu"><summary aria-label={`Acciones de ${mealType.label}`}><span className="material-symbols-outlined">more_vert</span></summary><div><button disabled={!items.length} onClick={() => onCopyMeal(items)}>Copiar todo</button><button disabled={!clipboard?.length} onClick={() => addLogs(clipboard)}>Pegar</button><button className="danger-text" disabled={!items.length} onClick={deleteAll}>Borrar todo</button></div></details>
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
              onEdit={() => onEdit(log)} onDelete={() => onDelete(log)}
            >
              <FoodThumb item={item} compact />
              <span className="meal-item-copy"><span>{item.name}</span><small>{formatNumber(log.quantity, 1)} g{log.itemType === "FOOD" && log.food?.preparation && log.food.preparation !== "UNSPECIFIED" ? ` · ${preparationLabel(log.food.preparation)}` : ""}</small></span>
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

function SwipeableMealItem({ children, className = "", resetSignal, onEdit, onDelete }) {
  const gesture = useRef(null);
  const [offset, setOffset] = useState(0);
  const [revealed, setRevealed] = useState("");
  const [dragging, setDragging] = useState(false);
  const close = useCallback(() => {
    gesture.current = null;
    setDragging(false);
    setRevealed("");
    setOffset(0);
  }, []);
  useEffect(() => close(), [close, resetSignal]);
  function finish() {
    if (gesture.current?.axis === "x" && offset > 64) {
      setRevealed("edit");
      setOffset(76);
    } else if (gesture.current?.axis === "x" && offset < -64) {
      setRevealed("delete");
      setOffset(-76);
    } else {
      close();
    }
    gesture.current = null;
    setDragging(false);
  }
  function move(event) {
    if (!gesture.current) return;
    const dx = event.touches[0].clientX - gesture.current.x;
    const dy = event.touches[0].clientY - gesture.current.y;
    if (!gesture.current.axis && Math.max(Math.abs(dx), Math.abs(dy)) > 10) gesture.current.axis = Math.abs(dx) > Math.abs(dy) * 1.35 ? "x" : "y";
    if (gesture.current.axis === "x") {
      event.preventDefault();
      setOffset(Math.max(-92, Math.min(92, dx)));
    }
  }
  return (
    <div className={`swipe-row ${revealed}`}>
      <button className="swipe-action swipe-edit" aria-label="Editar registro" onClick={() => { close(); window.setTimeout(onEdit, 120); }}><span className="material-symbols-outlined">edit</span></button>
      <button className="swipe-action swipe-delete" aria-label="Eliminar registro" onClick={() => { close(); window.setTimeout(onDelete, 120); }}><span className="material-symbols-outlined">delete</span></button>
      <div
        className={`meal-item ${dragging ? "swiping" : ""} ${className}`}
        style={{ transform: `translateX(${offset}px)` }}
        onTouchStart={(event) => {
          gesture.current = { x: event.touches[0].clientX, y: event.touches[0].clientY, axis: null };
          setDragging(true);
        }}
        onTouchMove={move}
        onTouchEnd={finish}
        onTouchCancel={finish}
      >
        {children}
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
    const viewport = window.visualViewport;
    if (!viewport) return undefined;
    let frame = 0;
    const syncViewport = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        modalRef.current?.style.setProperty("--picker-height", `${Math.round(viewport.height)}px`);
      });
    };
    syncViewport();
    viewport.addEventListener("resize", syncViewport);
    return () => {
      cancelAnimationFrame(frame);
      viewport.removeEventListener("resize", syncViewport);
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
    } else {
      setQuantity(selected.category === "FAT" ? "10" : "100");
      setUnit("GRAM");
    }
  }, [selected?.category, selected?.id, selected?.servingWeightGrams, selected?.type]);
  useEffect(() => {
    if (!selected?.servingWeightGrams && unit === "SERVING") setUnit("GRAM");
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
      const ratio = numericQuantity / Number(selected.totalWeightGrams || 1);
      setPreview({
        calories: Math.round(selected.calories * ratio),
        proteinGrams: selected.proteinGrams * ratio,
        carbsGrams: selected.carbsGrams * ratio,
        fatGrams: selected.fatGrams * ratio,
      });
    }
  }, [api, selected, quantity, unit]);
  async function add() {
    const numericQuantity = Number(quantity);
    if (!Number.isFinite(numericQuantity) || numericQuantity <= 0 || adding) return;
    const quantityInGrams = selected.type === "FOOD" && unit === "SERVING" ? numericQuantity * Number(selected.servingWeightGrams || 0) : numericQuantity;
    if (quantityInGrams <= 0) return;
    setAdding(true);
    try {
      const log = await api.request("/api/nutrition/meal-logs", {
        method: "POST",
        body: JSON.stringify({
          itemType: selected.type,
          itemId: selected.id,
          mealType: mealType.code,
          quantity: quantityInGrams,
          unit: "GRAM",
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
    selected?.type === "FOOD" && selected?.servingWeightGrams
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
                <Input selectOnFocus label={selected.type === "RECIPE" || unit === "GRAM" ? "Gramos" : "Cantidad de porciones"} type="number" inputMode="decimal" min="0.1" step="0.1" value={quantity} onChange={(event) => setQuantity(event.target.value)} />
                <Select label="Unidad" value={unit} onChange={(event) => changeSelectedUnit(event.target.value)} options={selectedUnitOptions} />
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

function QuickItems({ title, items, onPick }) {
  if (!items.length) return null;
  return (
    <section className="quick-items">
      <span>{title}</span>
      <div>
        {items.map((item) => (
          <button key={`${item.type}:${item.id}`} onClick={() => onPick(item)}>
            {item.name}
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
    const baseQuantity = Number(savedItem?.baseQuantity || savedItem?.totalWeightGrams || 100);
    const estimatedCalories = baseQuantity > 0 ? Math.round(Number(savedItem?.calories || 0) * Number(meal.quantity || 0) / baseQuantity) : 0;
    return { ...meal, imageUrl: meal.imageUrl || savedItem?.imageUrl, category: meal.category || savedItem?.category, calories: meal.calories ?? estimatedCalories };
  });
  const [states, setStates] = useState({});
  async function addRecent(meal) {
    if (states[meal.id] === "adding") return;
    const optimisticId = onOptimisticAdd(meal);
    setStates((current) => ({ ...current, [meal.id]: "adding" }));
    try {
      await api.request("/api/nutrition/meal-logs", {
        method: "POST",
        body: JSON.stringify({
          itemType: meal.itemType,
          itemId: meal.itemId,
          mealType: meal.mealType,
          quantity: meal.quantity,
          unit: meal.unit,
          logDate: date,
        }),
      });
      setStates((current) => ({ ...current, [meal.id]: "added" }));
      api.notify(`${meal.label} agregado.`);
      await onDone();
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
              <small>{mealLabel} · {formatNumber(meal.quantity, 1)} g</small>
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

function Foods({ api, user, setPage, setSelectedFoodId }) {
  const [tab, setTab] = useState("FOOD");
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("");
  const catalog = usePagedCatalog({
    api,
    endpoint: tab === "FOOD" ? "/api/foods" : "/api/recipes",
    query,
    category: tab === "FOOD" ? category : "",
  });
  return (
    <section className="page">
      <Header
        title="Alimentos"
        action={
          <div className="header-actions">
            <button className="secondary" onClick={() => setPage("create")}>
              Crear
            </button>
            <button className="primary pill" onClick={() => setPage("scanner")}>
              <span className="material-symbols-outlined">barcode_scanner</span>
              Escanear
            </button>
          </div>
        }
      />
      <div className="tabs">
        <button className={tab === "FOOD" ? "selected" : ""} onClick={() => setTab("FOOD")}>
          Alimentos
        </button>
        <button className={tab === "RECIPE" ? "selected" : ""} onClick={() => setTab("RECIPE")}>
          Recetas
        </button>
      </div>
      <div className="search-wrap">
        <span className="material-symbols-outlined">search</span>
        <input className="search" placeholder="Buscar..." value={query} onChange={(event) => setQuery(event.target.value)} />
      </div>
      {tab === "FOOD" && <CategoryChips category={category} setCategory={setCategory} />}
      <QuickItems
        title="Accesos rapidos"
        items={groupFoodVariants(readRecents(user).items.filter((item) => item.type === tab))}
        onPick={(item) => {
          if (item.type === "FOOD") {
            setSelectedFoodId(item.id);
            setPage("configure");
          }
        }}
      />
      <div className="food-grid">
        {groupFoodVariants(catalog.items).map((item) => (
          <CatalogCard
            key={`${tab}:${item.preparationGroup || item.id}`}
            item={{ ...item, type: tab }}
            onAdd={() => {
              if (tab === "FOOD") {
                setSelectedFoodId(item.id);
                setPage("configure");
              }
            }}
          />
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
      {!catalog.initialLoading && !catalog.error && catalog.items.length > 0 && !catalog.hasNext && <CatalogStatus>Viste todos los resultados.</CatalogStatus>}
      <InfiniteSentinel enabled={catalog.hasNext && !catalog.initialLoading && !catalog.loadingMore && !catalog.error} onLoad={catalog.loadNext} />
    </section>
  );
}

function EditFoodLog({ api, log, mealTypes, onClose, onDone }) {
  const [quantity, setQuantity] = useState(String(log.quantity));
  const [mealType, setMealType] = useState(log.mealType);
  const [saving, setSaving] = useState(false);
  const [closing, setClosing] = useState(false);
  const item = log.itemType === "RECIPE" ? log.recipe : log.food;
  const closeWithAnimation = useCallback(() => {
    if (closing || saving) return;
    setClosing(true);
    window.setTimeout(onClose, 180);
  }, [closing, onClose, saving]);
  useEffect(() => {
    const closeOnEscape = (event) => {
      if (event.key === "Escape") closeWithAnimation();
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [closeWithAnimation]);
  async function submit(event) {
    event.preventDefault();
    const numericQuantity = Number(quantity);
    if (!Number.isFinite(numericQuantity) || numericQuantity <= 0 || saving) return;
    setSaving(true);
    try {
      await api.request(`/api/nutrition/food-logs/${log.id}`, {
        method: "PUT",
        body: JSON.stringify({
          mealType,
          quantity: numericQuantity,
          unit: log.unit || "GRAM",
          logDate: log.logDate,
        }),
      });
      api.notify("Registro actualizado.");
      setClosing(true);
      window.setTimeout(onDone, 180);
    } catch {
      api.notify("No se pudo actualizar el registro.", "error");
      setSaving(false);
    }
  }
  return (
    <div className={`modal-backdrop compact-modal ${closing ? "closing" : ""}`} onPointerDown={(event) => { if (event.target === event.currentTarget) closeWithAnimation(); }}>
      <form className="edit-log-modal" role="dialog" aria-modal="true" aria-labelledby="edit-log-title" onPointerDown={(event) => event.stopPropagation()} onSubmit={submit}>
        <header>
          <div>
            <span>Editar registro</span>
            <h2 id="edit-log-title">{item?.name}</h2>
          </div>
          <button type="button" className="icon-button" onClick={closeWithAnimation} aria-label="Cerrar">
            <span className="material-symbols-outlined">close</span>
          </button>
        </header>
        <Input autoFocus selectOnFocus label={log.itemType === "RECIPE" ? "Gramos ingeridos" : "Cantidad en gramos"} type="number" inputMode="decimal" min="0.1" step="0.1" value={quantity} onChange={(event) => setQuantity(event.target.value)} />
        <Select
          label="Comida"
          value={mealType}
          onChange={(event) => setMealType(event.target.value)}
          options={mealTypes.map((meal) => ({
            value: meal.code,
            label: meal.label,
          }))}
        />
        <div className="modal-actions">
          <button type="button" className="secondary" onClick={closeWithAnimation}>
            Cancelar
          </button>
          <button className="primary" disabled={saving || Number(quantity) <= 0}>
            {saving ? "Guardando…" : "Guardar cambios"}
          </button>
        </div>
      </form>
    </div>
  );
}

function CatalogStatus({ children, error = false }) {
  return (
    <div className={`catalog-status ${error ? "error" : ""}`} role={error ? "alert" : "status"}>
      {children}
    </div>
  );
}

function CategoryChips({ category, setCategory }) {
  return (
    <div className="chips" aria-label="Filtrar por categoría">
      {[{ value: "", label: "Todos" }, ...CATEGORY_OPTIONS].map(({ value, label }) => (
        <button key={label} className={category === value ? "selected" : ""} aria-pressed={category === value} onClick={() => setCategory(value)}>
          {label}
        </button>
      ))}
    </div>
  );
}

function CatalogRow({ item, onPick }) {
  return (
    <button className="catalog-row" onClick={() => onPick(item)}>
      <span>{item.name}</span>
      <PreparationBadge food={item} />
      <small>
        {item.calories} kcal · P {formatNumber(item.proteinGrams, 1)}g · C {formatNumber(item.carbsGrams, 1)}g · G {formatNumber(item.fatGrams, 1)}g
      </small>
    </button>
  );
}

function groupFoodVariants(items) {
  const grouped = new Map();
  for (const item of items || []) {
    const key = item.preparationGroup ? `preparation:${item.preparationGroup}` : `item:${item.type || "FOOD"}:${item.id}`;
    const current = grouped.get(key);
    if (!current || (item.preparation === "COOKED" && current.preparation !== "COOKED")) grouped.set(key, item);
  }
  return [...grouped.values()];
}

function CatalogCard({ item, onAdd }) {
  return (
    <article className="food-card">
      <FoodThumb item={item} />
      <div>
        <h3>{item.name}</h3>
        <p>{item.type === "RECIPE" ? `${formatNumber(item.totalWeightGrams)}g totales` : item.brand || categoryLabel(item.category)}</p>
        {item.type === "FOOD" && <PreparationBadge food={item} />}
      </div>
      <strong>{item.calories} kcal</strong>
      {item.type === "FOOD" && (
        <button className="icon-button add-food" onClick={onAdd} aria-label={`Agregar ${item.name}`}>
          <span className="material-symbols-outlined">add</span>
        </button>
      )}
    </article>
  );
}

function CreateCatalog({ api, setPage, prefillBarcode, clearPrefillBarcode }) {
  const [tab, setTab] = useState("FOOD");
  return (
    <section className="page narrow">
      <button className="back-button" onClick={() => setPage("foods")}>
        <span className="material-symbols-outlined">arrow_back</span>Alimentos
      </button>
      <Header title="Crear" eyebrow="Catalogo global" />
      <div className="tabs create-tabs">
        <button className={tab === "FOOD" ? "selected" : ""} onClick={() => setTab("FOOD")}>
          Alimento
        </button>
        <button className={tab === "RECIPE" ? "selected" : ""} onClick={() => setTab("RECIPE")}>
          Receta
        </button>
        <button className={tab === "MINE" ? "selected" : ""} onClick={() => setTab("MINE")}>
          Mis alimentos
        </button>
      </div>
      {tab === "FOOD" && <CreateFoodForm api={api} prefillBarcode={prefillBarcode} clearPrefillBarcode={clearPrefillBarcode} />}
      {tab === "RECIPE" && <CreateRecipeForm api={api} />}
      {tab === "MINE" && <MyFoods api={api} />}
    </section>
  );
}

function CreateFoodForm({ api, prefillBarcode, clearPrefillBarcode }) {
  const [saving, setSaving] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [ocrStatus, setOcrStatus] = useState("");
  const [ocrData, setOcrData] = useState(null);
  const formRef = useRef(null);
  async function submit(event) {
    event.preventDefault();
    if (saving) return;
    const form = event.currentTarget;
    const formData = new FormData(form);
    const data = Object.fromEntries(formData);
    setSaving(true);
    try {
      await api.request("/api/foods", {
        method: "POST",
        body: JSON.stringify({
          name: data.name,
          brand: data.brand,
          barcode: data.barcode,
          category: data.category,
          baseUnit: "GRAM",
          baseQuantity: Number(data.baseQuantity || 100),
          calories: Number(data.calories),
          proteinGrams: Number(data.proteinGrams),
          carbsGrams: Number(data.carbsGrams),
          fatGrams: Number(data.fatGrams),
          preparation: "UNSPECIFIED",
          servingName: null,
          servingWeightGrams: null,
          tags: data.tags
            ? data.tags
                .split(",")
                .map((tag) => tag.trim())
                .filter(Boolean)
            : [],
        }),
      });
      api.notify("Alimento creado.");
      form.reset();
      setOcrData(null);
      clearPrefillBarcode?.();
    } catch (error) {
      const details = Object.values(error.fields || {}).join(" · ");
      api.notify(details || error.message || "No se pudo crear el alimento. Revisá los datos.", "error");
    } finally {
      setSaving(false);
    }
  }
  function setField(name, value) {
    const input = formRef.current?.querySelector(`[name="${name}"]`);
    if (input && value != null) {
      input.value = value;
      input.dispatchEvent(new Event("input", { bubbles: true }));
    }
  }
  function acceptOcrData() {
    if (!ocrData) return;
    ["calories", "proteinGrams", "carbsGrams", "fatGrams"].forEach((field) => setField(field, ocrData[field] ?? 0));
    setOcrData(null);
    setOcrStatus("Valores aplicados al alimento. Podés seguir completando el formulario.");
    api.notify("Valores nutricionales aplicados.");
  }
  async function handleOcrImage(file) {
    if (!file) return;
    setScanning(true);
    setOcrStatus("Procesando imagen con OCR...");
    try {
      const data = await recognizeNutrition(file);
      if (data.calories != null || data.proteinGrams != null || data.carbsGrams != null || data.fatGrams != null) {
        setOcrData(data);
        setOcrStatus("Revisá los valores detectados antes de aplicarlos.");
      } else {
        setOcrStatus("No se pudieron reconocer los valores. Ingresalos manualmente.");
        api.notify("No se reconoció la tabla nutricional.", "error");
      }
    } catch {
      setOcrStatus("Error al procesar la imagen. Ingresalos manualmente.");
      api.notify("Error al escanear la tabla.", "error");
    } finally {
      setScanning(false);
    }
  }
  return (
    <Panel title="Nuevo alimento">
      <form className="form-grid" ref={formRef} onSubmit={submit}>
        {ocrStatus && (
          <div className={`ocr-status ${ocrData || ocrStatus.startsWith("Valores aplicados") ? "ok" : "bad"}`}>
            {scanning ? <span className="ocr-loading" /> : null}
            <span>{ocrStatus}</span>
          </div>
        )}
        {ocrData && (
          <OcrNutritionPreview
            data={ocrData}
            setData={setOcrData}
            onAccept={acceptOcrData}
            onDiscard={() => {
              setOcrData(null);
              setOcrStatus("");
            }}
          />
        )}
        <div className="ocr-actions">
          <label className="secondary ocr-label">
            <span className="material-symbols-outlined">document_scanner</span>
            Escanear tabla nutricional
            <input
              type="file"
              accept="image/*"
              capture="environment"
              onChange={(event) => {
                setOcrStatus("");
                setOcrData(null);
                handleOcrImage(event.currentTarget.files?.[0]);
              }}
              hidden
              disabled={scanning}
            />
          </label>
        </div>
        <Input name="name" label="Nombre" required />
        <Input name="brand" label="Marca" />
        <Input name="barcode" label="Codigo de barras opcional" defaultValue={prefillBarcode || ""} />
        <Select name="category" label="Categoria" options={CATEGORY_OPTIONS} />
        <Input name="baseQuantity" label="Estos valores corresponden a (gramos)" type="number" defaultValue="100" step="0.1" min="0.1" required />
        <div className="split">
          <Input numericOnly name="calories" label="Kcal" type="number" step="1" min="0" required />
          <Input numericOnly name="proteinGrams" label="Proteinas g" type="number" step="0.1" min="0" required />
        </div>
        <div className="split">
          <Input numericOnly name="carbsGrams" label="Carbohidratos g" type="number" step="0.1" min="0" required />
          <Input numericOnly name="fatGrams" label="Grasas g" type="number" step="0.1" min="0" required />
        </div>
        <Input name="tags" label="Tags separados por coma" />
        <button className="primary" disabled={saving || scanning}>
          {saving ? "Creando…" : "Crear alimento"}
        </button>
      </form>
    </Panel>
  );
}

function OcrNutritionPreview({ data, setData, onAccept, onDiscard }) {
  const fields = [
    { key: "calories", label: "Kcal", unit: "" },
    { key: "proteinGrams", label: "Proteínas", unit: "g" },
    { key: "carbsGrams", label: "Carbohidratos", unit: "g" },
    { key: "fatGrams", label: "Grasas", unit: "g" },
  ];
  return (
    <section className="ocr-preview" aria-label="Vista previa nutricional">
      <header>
        <div>
          <span>Vista previa</span>
          <strong>Información detectada</strong>
        </div>
        <span className="material-symbols-outlined">document_scanner</span>
      </header>
      <div className="ocr-preview-grid">
        {fields.map(({ key, label, unit }) => (
          <label key={key}>
            <span>{label}</span>
            <div>
              <input
                type="number"
                min="0"
                step="0.1"
                value={data[key] ?? ""}
                onChange={(event) =>
                  setData((current) => ({
                    ...current,
                    [key]: event.target.value,
                  }))
                }
              />
              <small>{unit}</small>
            </div>
          </label>
        ))}
      </div>
      <div className="ocr-preview-actions">
        <button type="button" className="secondary" onClick={onDiscard}>
          Descartar
        </button>
        <button type="button" className="primary" onClick={onAccept}>
          <span className="material-symbols-outlined">check</span>Aceptar valores
        </button>
      </div>
    </section>
  );
}

function MyFoods({ api }) {
  const [items, setItems] = useState([]);
  const [editing, setEditing] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const load = useCallback(() => {
    setLoading(true);
    return api
      .request("/api/foods/mine")
      .then(setItems)
      .catch(() => api.notify("No se pudieron cargar tus alimentos.", "error"))
      .finally(() => setLoading(false));
  }, [api]);
  useEffect(() => {
    load();
  }, [load]);
  async function save(event) {
    event.preventDefault();
    if (saving) return;
    setSaving(true);
    const data = Object.fromEntries(new FormData(event.currentTarget));
    try {
      await api.request(`/api/foods/${editing.id}`, { method: "PUT", body: JSON.stringify({ name: data.name, brand: data.brand, barcode: data.barcode, category: data.category, baseUnit: "GRAM", baseQuantity: Number(data.baseQuantity), calories: Number(data.calories), proteinGrams: Number(data.proteinGrams), carbsGrams: Number(data.carbsGrams), fatGrams: Number(data.fatGrams), preparation: "UNSPECIFIED", servingName: null, servingWeightGrams: null, tags: [] }) });
      api.notify("Alimento actualizado.");
      setEditing(null);
      await load();
    } catch (error) {
      api.notify(error.message || "No se pudo actualizar.", "error");
    } finally {
      setSaving(false);
    }
  }
  if (loading)
    return (
      <Panel title="Mis alimentos">
        <CatalogStatus>Cargando tus alimentos…</CatalogStatus>
      </Panel>
    );
  return (
    <Panel title="Mis alimentos" className="my-foods-panel">
      {!items.length ? (
        <p className="empty-state">Todavía no creaste alimentos.</p>
      ) : (
        <div className="my-foods-list">
          {items.map((item) => (
            <button type="button" key={item.id} onClick={() => setEditing(item)}>
              <span>
                <strong>{item.name}</strong>
                <small>{item.brand || categoryLabel(item.category)}</small>
              </span>
              <span>{item.calories} kcal</span>
              <span className="material-symbols-outlined">edit</span>
            </button>
          ))}
        </div>
      )}
      {editing && createPortal(
        <div
          className="edit-food-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setEditing(null);
          }}
        >
          <form className="edit-food-sheet" onSubmit={save}>
            <header>
              <div>
                <span>Editar alimento</span>
                <h2>{editing.name}</h2>
              </div>
              <button type="button" className="icon-button" aria-label="Cerrar" onClick={() => setEditing(null)}>
                <span className="material-symbols-outlined">close</span>
              </button>
            </header>
            <div className="edit-food-fields">
              <Input name="name" label="Nombre" defaultValue={editing.name} required />
              <Input name="brand" label="Marca" defaultValue={editing.brand || ""} />
              <Input name="barcode" label="Código de barras" defaultValue={editing.barcode || ""} />
              <Select name="category" label="Categoría" defaultValue={editing.category} options={CATEGORY_OPTIONS} />
              <Input name="baseQuantity" label="Estos valores corresponden a (gramos)" type="number" min="0.1" step="0.1" defaultValue={editing.baseQuantity || 100} required />
              <div className="split">
                <Input name="calories" label="Kcal" type="number" min="0" defaultValue={editing.calories} required />
                <Input name="proteinGrams" label="Proteínas g" type="number" min="0" step="0.1" defaultValue={editing.proteinGrams} required />
              </div>
              <div className="split">
                <Input name="carbsGrams" label="Carbohidratos g" type="number" min="0" step="0.1" defaultValue={editing.carbsGrams} required />
                <Input name="fatGrams" label="Grasas g" type="number" min="0" step="0.1" defaultValue={editing.fatGrams} required />
              </div>
            </div>
            <footer className="edit-food-actions">
              <button className="primary" disabled={saving}>
                {saving ? "Guardando…" : "Guardar cambios"}
              </button>
            </footer>
          </form>
        </div>,
        document.body,
      )}
    </Panel>
  );
}

function CatalogRowWithImage({ item, onPick }) {
  return (
    <button className="catalog-row catalog-row-image" onClick={() => onPick(item)}>
      <FoodThumb item={item} compact />
      <span className="catalog-copy">
        <strong>{item.name}</strong>
        <PreparationBadge food={item} />
        <small>
          {item.calories} kcal · P {formatNumber(item.proteinGrams, 1)}g · C {formatNumber(item.carbsGrams, 1)}g · G {formatNumber(item.fatGrams, 1)}g
        </small>
      </span>
      <span className="material-symbols-outlined row-action">chevron_right</span>
    </button>
  );
}

function FoodThumb({ item, compact = false, hero = false }) {
  const fallback = item?.type === "RECIPE" ? RECIPE_ART : CATEGORY_ART[item?.category] || CATEGORY_ART.OTHER;
  return (
    <div className={`food-thumb ${compact ? "compact" : ""} ${hero ? "hero" : ""}`}>
      <img
        src={item?.imageUrl || fallback}
        onError={(event) => {
          event.currentTarget.onerror = null;
          event.currentTarget.src = fallback;
        }}
        alt=""
      />
    </div>
  );
}

function PreparationBadge({ food, showUnknown = false }) {
  if (!food || food.type === "RECIPE") return null;
  const option = PREPARATION_OPTIONS.find(({ value }) => value === food.preparation);
  if (!option || (!showUnknown && food.preparation === "UNSPECIFIED")) return null;
  return (
    <small className={`preparation-badge preparation-${food.preparation.toLowerCase()}`} title={food.preparationSource || undefined}>
      {option.label}
    </small>
  );
}

function preparationLabel(preparation) {
  return PREPARATION_OPTIONS.find(({ value }) => value === preparation)?.label || "Sin especificar";
}

function CreateRecipeForm({ api }) {
  const [query, setQuery] = useState("");
  const [ingredients, setIngredients] = useState([]);
  const [totalWeight, setTotalWeight] = useState("");
  const [preview, setPreview] = useState(null);
  const [saving, setSaving] = useState(false);
  const catalog = usePagedCatalog({
    api,
    endpoint: "/api/foods",
    query,
    pageSize: 10,
  });
  useEffect(() => {
    const numericWeight = Number(totalWeight);
    if (!ingredients.length || !Number.isFinite(numericWeight) || numericWeight <= 0) return setPreview(null);
    const normalizedIngredients = ingredients.map((item) => ({
      ...item,
      quantity: Number(item.quantity),
    }));
    api
      .request("/api/recipes/preview", {
        method: "POST",
        body: JSON.stringify({
          name: "preview",
          totalWeightGrams: numericWeight,
          ingredients: normalizedIngredients,
        }),
      })
      .then(setPreview)
      .catch(() => setPreview(null));
  }, [api, ingredients, totalWeight]);
  async function submit(event) {
    event.preventDefault();
    if (saving) return;
    const data = Object.fromEntries(new FormData(event.currentTarget));
    if (ingredients.some((item) => !Number.isFinite(Number(item.quantity)) || Number(item.quantity) <= 0)) {
      api.notify("Cada ingrediente debe tener una cantidad mayor a cero.", "error");
      return;
    }
    setSaving(true);
    try {
      const normalizedIngredients = ingredients.map((item) => ({
        ...item,
        quantity: Number(item.quantity),
      }));
      await api.request("/api/recipes", {
        method: "POST",
        body: JSON.stringify({
          name: data.name,
          description: data.description,
          totalWeightGrams: Number(data.totalWeightGrams),
          ingredients: normalizedIngredients,
        }),
      });
      api.notify("Receta creada.");
      event.currentTarget.reset();
      setIngredients([]);
      setTotalWeight("");
      setPreview(null);
    } catch {
      api.notify("No se pudo crear la receta. Revisá los datos.", "error");
    } finally {
      setSaving(false);
    }
  }
  return (
    <Panel title="Nueva receta" className="recipe-panel">
      <form className="form-grid recipe-form" onSubmit={submit}>
        <Input name="name" label="Nombre" required />
        <Input name="description" label="Descripcion opcional" />
        <Input name="totalWeightGrams" label="Peso total en gramos" type="number" min="0.1" step="0.1" value={totalWeight} required onChange={(event) => setTotalWeight(event.target.value)} />
        <div className="search-wrap">
          <span className="material-symbols-outlined">search</span>
          <input className="search" placeholder="Buscar ingredientes..." value={query} onChange={(event) => setQuery(event.target.value)} />
        </div>
        <div className="picker-results">
          {groupFoodVariants(catalog.items).map((food) => (
            <button
              type="button"
              className="catalog-row"
              key={food.id}
              onClick={() =>
                setIngredients([
                  ...ingredients,
                  {
                    foodId: food.id,
                    quantity: 100,
                    unit: "GRAM",
                    name: food.name,
                  },
                ])
              }
            >
              <span>{food.name}</span>
              <small>{food.calories} kcal / 100g</small>
            </button>
          ))}
        </div>
        {catalog.initialLoading && <CatalogStatus>Buscando ingredientes…</CatalogStatus>}
        {!catalog.initialLoading && catalog.error && (
          <CatalogStatus error>
            {catalog.error}
            <button type="button" className="secondary" onClick={catalog.retry}>
              Reintentar
            </button>
          </CatalogStatus>
        )}
        {!catalog.initialLoading && !catalog.error && !catalog.items.length && <CatalogStatus>No encontramos ingredientes.</CatalogStatus>}
        <InfiniteSentinel enabled={!catalog.initialLoading && !catalog.error && catalog.hasNext} onLoad={catalog.loadNext} />
        {catalog.loadingMore && <CatalogStatus>Cargando más…</CatalogStatus>}
        <div className="ingredient-list">
          {ingredients.map((item, index) => (
            <label className="ingredient-row" key={`${item.foodId}:${index}`}>
              <span>{item.name}</span>
              <input aria-label={`Cantidad de ${item.name} en gramos`} type="number" min="0.1" step="0.1" value={item.quantity} onChange={(event) => setIngredients(ingredients.map((ingredient, i) => (i === index ? { ...ingredient, quantity: event.target.value } : ingredient)))} />
              <button type="button" onClick={() => setIngredients(ingredients.filter((_, i) => i !== index))}>
                Quitar
              </button>
            </label>
          ))}
        </div>
        <div className="preview mini">
          {formatNumber(preview?.calories)} kcal · P {formatNumber(preview?.proteinGrams, 1)}g · C {formatNumber(preview?.carbsGrams, 1)}g · G {formatNumber(preview?.fatGrams, 1)}g
        </div>
        <button className="primary recipe-submit" disabled={!ingredients.length || saving}>
          {saving ? "Creando…" : "Crear receta"}
        </button>
      </form>
    </Panel>
  );
}

function ConfigureFood({ api, setPage, foodId, user }) {
  const [activeFoodId, setActiveFoodId] = useState(foodId);
  const [quantity, setQuantity] = useState("150");
  const [unit, setUnit] = useState("GRAM");
  const [mealType, setMealType] = useState("LUNCH");
  const [mealTypes, setMealTypes] = useState(DEFAULT_MEALS);
  const [food, setFood] = useState(null);
  const [preparationOptions, setPreparationOptions] = useState([]);
  const [preview, setPreview] = useState(null);
  const [adding, setAdding] = useState(false);
  const [foodError, setFoodError] = useState("");
  const loadFood = useCallback(
    (id) => {
      if (!id) return;
      setFood(null);
      setFoodError("");
      api
        .request(`/api/foods/${id}`)
        .then((nextFood) => {
          setFood(nextFood);
          if (nextFood.servingWeightGrams) {
            setQuantity("1");
            setUnit("SERVING");
          } else {
            setQuantity(nextFood.category === "FAT" ? "10" : "100");
            setUnit("GRAM");
          }
        })
        .catch(() => setFoodError("No pudimos cargar este alimento."));
    },
    [api],
  );
  useEffect(() => {
    api
      .request("/api/nutrition/meal-types")
      .then(setMealTypes)
      .catch(() => setMealTypes(DEFAULT_MEALS));
  }, [api]);
  useEffect(() => {
    setActiveFoodId(foodId);
  }, [foodId]);
  useEffect(() => {
    loadFood(activeFoodId);
  }, [activeFoodId, loadFood]);
  useEffect(() => {
    if (foodId)
      api
        .request(`/api/foods/${foodId}/preparations`)
        .then(setPreparationOptions)
        .catch(() => setPreparationOptions([]));
  }, [api, foodId]);
  useEffect(() => {
    const numericQuantity = Number(quantity);
    if (!activeFoodId || !Number.isFinite(numericQuantity) || numericQuantity <= 0) {
      setPreview(null);
      return;
    }
    const quantityInGrams = unit === "SERVING" ? numericQuantity * Number(food?.servingWeightGrams || 0) : numericQuantity;
    if (quantityInGrams <= 0) return setPreview(null);
    api
      .request("/api/foods/preview", {
        method: "POST",
        body: JSON.stringify({
          foodId: activeFoodId,
          quantity: quantityInGrams,
          unit: "GRAM",
        }),
      })
      .then(setPreview)
      .catch(() => setPreview(null));
  }, [activeFoodId, api, food, quantity, unit]);
  async function add() {
    const numericQuantity = Number(quantity);
    if (!Number.isFinite(numericQuantity) || numericQuantity <= 0 || adding) return;
    const quantityInGrams = unit === "SERVING" ? numericQuantity * Number(food?.servingWeightGrams || 0) : numericQuantity;
    if (quantityInGrams <= 0) return;
    setAdding(true);
    try {
      const log = await api.request("/api/nutrition/meal-logs", {
        method: "POST",
        body: JSON.stringify({
          itemType: "FOOD",
          itemId: activeFoodId,
          mealType,
          quantity: quantityInGrams,
          unit: "GRAM",
          logDate: today(),
        }),
      });
      if (food) rememberItem(user, { ...food, type: "FOOD" });
      rememberMeal(user, mealType, log);
      api.notify("Alimento agregado.");
      setPage("dashboard");
    } catch {
      api.notify("No se pudo agregar el alimento.", "error");
      setAdding(false);
    }
  }
  const configureUnitOptions = food?.servingWeightGrams
    ? [
        { value: "GRAM", label: "Gramos" },
        {
          value: "SERVING",
          label: `${food.servingName || "Porción"} (${formatNumber(food.servingWeightGrams, 1)} g)`,
        },
      ]
    : [{ value: "GRAM", label: "Gramos" }];
  const preparationSelectOptions = preparationOptions.map((option) => ({
    value: String(option.id),
    label: preparationLabel(option.preparation),
  }));
  if (foodError)
    return (
      <section className="page narrow configure-page">
        <button className="back-button configure-back" onClick={() => setPage("foods")}>
          <span className="material-symbols-outlined">arrow_back</span>Alimentos
        </button>
        <Header title="Configurar alimento" />
        <CatalogStatus error>
          {foodError}
          <button className="secondary" onClick={() => loadFood(activeFoodId)}>
            Reintentar
          </button>
        </CatalogStatus>
      </section>
    );
  return (
    <section className="page narrow configure-page">
      <button className="back-button configure-back" onClick={() => setPage("foods")}>
        <span className="material-symbols-outlined">arrow_back</span>Alimentos
      </button>
      <Header title="Configurar alimento" />
      <Panel className="configure-panel">
        <div className="configure-food-heading">
          <FoodThumb item={{ ...food, type: "FOOD" }} hero />
          <div>
            <span>Porción</span>
            <h2>{food?.name || "Cargando..."}</h2>
            <small>{food?.brand || categoryLabel(food?.category)}</small>
            <PreparationBadge food={food} showUnknown />
          </div>
        </div>
        {preparationSelectOptions.length > 1 && (
          <Select
            label="Peso del alimento"
            value={String(activeFoodId)}
            onChange={(event) => {
              setActiveFoodId(Number(event.target.value));
              setUnit("GRAM");
            }}
            options={preparationSelectOptions}
          />
        )}
        <div className="split configure-fields">
          <Input selectOnFocus label="Cantidad" value={quantity} onChange={(event) => setQuantity(event.target.value)} type="number" inputMode="decimal" min="0.1" step="0.1" />
          <Select label="Unidad" value={unit} onChange={(event) => setUnit(event.target.value)} options={configureUnitOptions} />
        </div>
        <label className="field">
          <span>Comida</span>
          <select value={mealType} onChange={(event) => setMealType(event.target.value)}>
            {mealTypes.map((meal) => (
              <option key={meal.code} value={meal.code}>
                {meal.label}
              </option>
            ))}
          </select>
        </label>
        <div className="preview configure-preview">
          <strong>{formatNumber(preview?.calories)} kcal</strong>
          <small>
            P {formatNumber(preview?.proteinGrams, 1)}g · C {formatNumber(preview?.carbsGrams, 1)}g · G {formatNumber(preview?.fatGrams, 1)}g
          </small>
        </div>
        <button className="primary configure-submit" disabled={adding || !food || !activeFoodId || Number(quantity) <= 0} onClick={add}>
          {adding ? "Agregando…" : "Agregar producto"}
        </button>
      </Panel>
    </section>
  );
}

function Scanner({ api, setPage, setSelectedFoodId, setPrefillBarcode }) {
  const [barcode, setBarcode] = useState("");
  const [food, setFood] = useState(null);
  const [cameraOn, setCameraOn] = useState(false);
  const [manualOpen, setManualOpen] = useState(false);
  const [status, setStatus] = useState("Alinea el codigo dentro del marco");
  const videoRef = useRef(null);
  const scannerControlsRef = useRef(null);
  useEffect(() => {
    if (!cameraOn) return undefined;
    let cancelled = false;
    async function startCamera() {
      try {
        if (!navigator.mediaDevices?.getUserMedia) return setStatus("Tu navegador no permite usar camara aca. Usa ingreso manual.");
        setStatus("Escaneando codigo de barras...");
        const { BrowserMultiFormatReader } = await import("@zxing/browser");
        if (cancelled) return;
        const reader = new BrowserMultiFormatReader();
        scannerControlsRef.current = await reader.decodeFromConstraints(
          {
            video: {
              facingMode: { ideal: "environment" },
              width: { ideal: 1280 },
              height: { ideal: 720 },
            },
            audio: false,
          },
          videoRef.current,
          async (result, _error, controls) => {
            if (!result || cancelled) return;
            cancelled = true;
            controls.stop();
            const detectedBarcode = result.getText();
            setBarcode(detectedBarcode);
            setStatus("Codigo reconocido. Buscando producto...");
            api.notify("Codigo reconocido. Ya podes dejar de apuntar la camara.");
            navigator.vibrate?.([80, 40, 80]);
            await search(detectedBarcode, true);
          },
        );
      } catch {
        if (!cancelled) setStatus("No se pudo acceder a la camara. Revisa permisos o usa ingreso manual.");
      }
    }
    startCamera();
    return () => {
      cancelled = true;
      scannerControlsRef.current?.stop();
      scannerControlsRef.current = null;
    };
  }, [cameraOn]);
  async function search(code = barcode, scanned = false) {
    const cleanCode = String(code || "").trim();
    if (!cleanCode) {
      setStatus("Ingresa un codigo de barras.");
      return;
    }
    try {
      const found = await api.request(`/api/foods/barcode/${encodeURIComponent(cleanCode)}`);
      setFood(found);
      setStatus("Producto encontrado. Ajusta la porcion antes de agregarlo.");
      setCameraOn(false);
      setSelectedFoodId(found.id);
      api.notify(`${found.name} reconocido. Revisa la porcion antes de agregarlo.`);
      window.setTimeout(() => setPage("configure"), scanned ? 500 : 0);
    } catch (error) {
      setFood(null);
      setCameraOn(false);
      setStatus("No encontramos ese codigo en el catalogo.");
      api.notify("No encontramos ese codigo.", "error");
    }
  }
  return (
    <section className="scanner-page">
      <button className="back-button" onClick={() => setPage("foods")}>
        <span className="material-symbols-outlined">arrow_back</span>Alimentos
      </button>
      <div className="scanner-stage">
        <video ref={videoRef} muted playsInline />
        {!cameraOn && <div className="scanner-fallback" />}
        <div className={`scan-frame ${status.startsWith("Codigo reconocido") ? "recognized" : ""}`}>
          <i />
          <i />
          <i />
          <i />
          <div className="scan-line" />
          <span className="material-symbols-outlined">{status.startsWith("Codigo reconocido") ? "check_circle" : "barcode_scanner"}</span>
        </div>
        <p aria-live="polite">{status}</p>
      </div>
      <section className={`scanner-result ${food ? "show" : ""}`}>
        {food ? (
          <>
            <div>
              <strong>{food.name}</strong>
              <span>{food.calories} kcal / 100g</span>
            </div>
            <button
              className="primary"
              onClick={() => {
                setSelectedFoodId(food.id);
                setPage("configure");
              }}
            >
              Configurar porcion
            </button>
          </>
        ) : (
          <>
            <button className="manual-toggle" onClick={() => setManualOpen((value) => !value)}>
              <span>Codigo manual</span>
              <span className="material-symbols-outlined">{manualOpen ? "expand_more" : "chevron_right"}</span>
            </button>
            {manualOpen && (
              <div className="manual-panel">
                <input inputMode="numeric" value={barcode} onChange={(event) => setBarcode(event.target.value.replace(/\D/g, ""))} placeholder="Ingresar codigo" />
                <button className="secondary" onClick={() => search()}>
                  Buscar
                </button>
              </div>
            )}
            <button
              className="secondary"
              onClick={() => {
                setPrefillBarcode?.(barcode);
                setPage("create");
              }}
            >
              Registrar producto
            </button>
            <button className="primary" onClick={() => setCameraOn((value) => !value)}>
              {cameraOn ? "Pausar camara" : "Usar camara"}
            </button>
          </>
        )}
      </section>
    </section>
  );
}

function History({ api }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedDay, setSelectedDay] = useState(null);
  const load = useCallback(() => {
    const date = new Date();
    setLoading(true);
    setError("");
    api
      .request(`/api/nutrition/history?year=${date.getFullYear()}&month=${date.getMonth() + 1}`)
      .then(setData)
      .catch(() => setError("No pudimos cargar tu historial."))
      .finally(() => setLoading(false));
  }, [api]);
  useEffect(load, [load]);
  if (loading)
    return (
      <section className="page">
        <Header title="Historial" />
        <CatalogStatus>Cargando historial…</CatalogStatus>
      </section>
    );
  if (error)
    return (
      <section className="page">
        <Header title="Historial" />
        <CatalogStatus error>
          {error}
          <button className="secondary" onClick={load}>
            Reintentar
          </button>
        </CatalogStatus>
      </section>
    );
  const currentDate = new Date();
  const rawMonthLabel = new Intl.DateTimeFormat("es-AR", { month: "long", year: "numeric" }).format(currentDate);
  const monthLabel = rawMonthLabel.charAt(0).toUpperCase() + rawMonthLabel.slice(1);
  const leadingDays = (new Date(currentDate.getFullYear(), currentDate.getMonth(), 1).getDay() + 6) % 7;
  return (
    <section className="page">
      <Header title="Historial" />
      <div className="grid two history-summary">
        <Panel title="Promedio">
          <p className="big">{formatNumber(data?.averageCalories)} kcal</p>
        </Panel>
        <Panel title="Objetivos cumplidos">
          <p className="big">{data?.completedGoalDays || 0} dias</p>
        </Panel>
      </div>
      <div className="calendar-heading"><h2>{monthLabel}</h2><span>Tu constancia, día por día</span></div>
      <div className="calendar-weekdays" aria-hidden="true">{["L", "M", "X", "J", "V", "S", "D"].map((day) => <span key={day}>{day}</span>)}</div>
      <div className="calendar-grid">
        {Array.from({ length: leadingDays }, (_, index) => <span className="calendar-spacer" key={`spacer-${index}`} />)}
        {(data?.days || []).map((day) => (
          <button type="button" key={day.date} className={day.goalReached ? "done" : ""} style={{ "--plan-color": planColor(day.planId || day.planName) }} title={`Ver detalle del ${readableDate(day.date)}`} onClick={() => setSelectedDay(day)}>
            <b>{new Date(`${day.date}T00:00:00`).getDate()}</b><small>{day.planName}</small>
          </button>
        ))}
      </div>
      <div className="plan-legend">{[...new Map((data?.days || []).map((day) => [day.planId || day.planName, day])).values()].map((day) => <span key={day.planId || day.planName}><i style={{ background: planColor(day.planId || day.planName) }} />{day.planName}</span>)}</div>
      {selectedDay && <HistoryDayPreview api={api} day={selectedDay} onClose={() => setSelectedDay(null)} />}
    </section>
  );
}

function HistoryDayPreview({ api, day, onClose }) {
  const [detail, setDetail] = useState(null);
  const [error, setError] = useState("");
  const closeRef = useRef(null);

  useEffect(() => {
    let active = true;
    api.request(`/api/nutrition/dashboard?date=${day.date}`)
      .then((result) => active && setDetail(result))
      .catch(() => active && setError("No pudimos cargar el detalle de este día."));
    return () => { active = false; };
  }, [api, day.date]);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();
    const handleKeyDown = (event) => { if (event.key === "Escape") onClose(); };
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose]);

  const consumed = detail?.caloriesConsumed ?? day.caloriesConsumed ?? 0;
  const goal = detail?.calorieGoal ?? day.calorieGoal ?? 0;
  const progress = Math.min(100, Math.round((consumed / (goal || 1)) * 100));

  return createPortal(
    <div className="history-preview-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section className="history-preview" role="dialog" aria-modal="true" aria-labelledby="history-preview-title">
        <header className="history-preview-header">
          <div>
            <span className="eyebrow">Resumen del día</span>
            <h2 id="history-preview-title">{readableDate(day.date)}</h2>
            <small>{day.planName || detail?.plan?.name}</small>
          </div>
          <button ref={closeRef} type="button" className="history-preview-close" onClick={onClose} aria-label="Cerrar detalle"><span className="material-symbols-outlined">close</span></button>
        </header>

        <div className="history-preview-scroll">
          <div className="history-calorie-summary">
            <div className="history-calorie-ring" style={{ "--day-progress": `${progress * 3.6}deg` }}><strong>{formatNumber(consumed)}</strong><small>de {formatNumber(goal)} kcal</small></div>
            <div><span>{day.goalReached ? "Objetivo cumplido" : "Balance del día"}</span><strong>{progress}%</strong><small>{formatNumber(Math.max(0, goal - consumed))} kcal restantes</small></div>
          </div>

          {detail ? (
            <>
              <div className="history-macros">
                {(detail.macros || []).map((macro) => (
                  <article key={macro.key}><span>{macro.label}</span><strong>{formatNumber(macro.consumed)}g</strong><small>de {formatNumber(macro.goal)}g</small><i><b style={{ width: `${Math.min(100, Number(macro.consumed || 0) / (Number(macro.goal) || 1) * 100)}%` }} /></i></article>
                ))}
              </div>
              <div className="history-meals">
                {(detail.meals || []).filter((meal) => meal.items?.length).map((meal, mealIndex) => (
                  <article className="history-meal" key={meal.mealType} style={{ "--meal-delay": `${mealIndex * 45}ms` }}>
                    <header><div><span className="material-symbols-outlined">restaurant</span><strong>{meal.label}</strong></div><small>{formatNumber(meal.calories)} kcal</small></header>
                    <div>
                      {meal.items.map((item) => (
                        <div className="history-food" key={item.id}>
                          <FoodThumb compact item={item.itemType === "RECIPE" ? { ...item.recipe, type: "RECIPE" } : item.food} />
                          <p><strong>{item.itemType === "RECIPE" ? item.recipe?.name : item.food?.name}</strong><small>{formatNumber(item.quantity)} {item.unit === "GRAM" ? "g" : item.unit}</small></p>
                          <span>{formatNumber(item.calories)} kcal</span>
                        </div>
                      ))}
                    </div>
                  </article>
                ))}
                {!detail.meals?.some((meal) => meal.items?.length) && <div className="history-empty"><span className="material-symbols-outlined">no_meals</span><strong>Sin alimentos registrados</strong><small>Este día todavía no tiene comidas cargadas.</small></div>}
              </div>
              <div className="history-water"><span className="material-symbols-outlined">water_drop</span><p><strong>Hidratación</strong><small>{formatNumber(detail.waterConsumedLiters, 1)} L de {formatNumber(detail.waterGoalLiters, 1)} L</small></p></div>
            </>
          ) : error ? <CatalogStatus error>{error}</CatalogStatus> : <div className="history-preview-loading"><span className="spinner" /><span>Cargando detalle…</span></div>}
        </div>
      </section>
    </div>,
    document.body,
  );
}

function planColor(value) { const palette = ["#4edea3", "#89ceff", "#ffd166", "#c7a6ff", "#ff8fa3"]; const hash = String(value || "plan").split("").reduce((sum, char) => sum + char.charCodeAt(0), 0); return palette[hash % palette.length]; }

function Profile({ api, logout }) {
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
        <form onSubmit={async (event) => { event.preventDefault(); if (savingWeight) return; setSavingWeight(true); try { const updated = await api.request("/api/profile", { method: "PATCH", body: JSON.stringify({ weightKg: Number(weight) }) }); setProfile(updated); setWeight(updated.weightKg || ""); api.notify("Peso actualizado."); } catch { api.notify("No se pudo registrar el peso.", "error"); } finally { setSavingWeight(false); } }}>
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
          onClick={() => {
            if (window.confirm("¿Querés cerrar sesión?")) logout();
          }}
        >
          <span className="material-symbols-outlined">logout</span>Cerrar sesión
        </button>
      </Panel>
    </section>
  );
}

function NutritionPlanManager({ api, presets, plans, onChanged }) {
  const [creating, setCreating] = useState(false);
  const [selectedPreset, setSelectedPreset] = useState(null);
  const [saving, setSaving] = useState(false);
  const [activatingId, setActivatingId] = useState(null);
  const [form, setForm] = useState({
    name: "Plan manual",
    dailyCalories: 2200,
    proteinPercent: 25,
    carbsPercent: 50,
    fatPercent: 25,
    startDate: today(),
    endDate: "",
  });
  const total = Number(form.proteinPercent) + Number(form.carbsPercent) + Number(form.fatPercent);
  const grams = {
    protein: macroGrams(form.dailyCalories, form.proteinPercent, 4),
    carbs: macroGrams(form.dailyCalories, form.carbsPercent, 4),
    fat: macroGrams(form.dailyCalories, form.fatPercent, 9),
  };
  const currentPlan = plans.find((plan) => plan.startDate <= today() && (!plan.endDate || plan.endDate >= today()));
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
      await api.request("/api/profile/nutrition-plans", {
        method: "POST",
        body: JSON.stringify({
          ...form,
          dailyCalories: Number(form.dailyCalories),
          proteinPercent: Number(form.proteinPercent),
          carbsPercent: Number(form.carbsPercent),
          fatPercent: Number(form.fatPercent),
          endDate: form.endDate || null,
        }),
      });
      api.notify("Plan alimenticio guardado.");
      setCreating(false);
      await onChanged();
    } catch {
      api.notify("No se pudo guardar el plan.", "error");
    } finally {
      setSaving(false);
    }
  }
  async function activatePlan(plan) {
    if (activatingId || plan.id === currentPlan?.id) return;
    setActivatingId(plan.id);
    try {
      await api.request("/api/profile/nutrition-plans", { method: "POST", body: JSON.stringify({ name: plan.name, dailyCalories: plan.dailyCalories, proteinPercent: Number(plan.proteinPercent), carbsPercent: Number(plan.carbsPercent), fatPercent: Number(plan.fatPercent), startDate: today(), endDate: null }) });
      api.notify(`${plan.name} es ahora tu plan actual.`); await onChanged();
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
      <button type="button" className="primary add-plan-button" onClick={() => setCreating((value) => !value)}><span className="material-symbols-outlined">add</span>{creating ? "Cancelar" : "Agregar plan"}</button>
      {creating && <>
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
          {saving ? "Guardando…" : "Guardar nuevo plan"}
        </button>
      </form>
      </>}
      <div className="plan-history">
        <h3>Historial de planes</h3>
        {plans.map((plan) => (
          <article className={plan.id === currentPlan?.id ? "active" : ""} key={plan.id || `${plan.name}-${plan.startDate}`}>
            <div className="plan-history-heading"><strong>{plan.name}</strong>{plan.id === currentPlan?.id ? <span className="active-plan-badge">Actual</span> : <button className="secondary use-plan-button" disabled={Boolean(activatingId)} onClick={() => activatePlan(plan)}>{activatingId === plan.id ? "Cambiando…" : "Usar este plan"}</button>}</div>
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

function Header({ title, eyebrow, action, compact = false }) {
  const commitTime = typeof __COMMIT_TIME__ !== "undefined" ? new Date(__COMMIT_TIME__) : null;
  const versionLabel =
    commitTime && !Number.isNaN(commitTime.getTime())
      ? new Intl.DateTimeFormat("es-AR", {
          hour: "2-digit",
          minute: "2-digit",
          day: "2-digit",
          month: "2-digit",
          year: "numeric",
          hour12: false,
        })
          .format(commitTime)
          .replace(",", " ·")
      : "Desarrollo";
  return (
    <header className={`page-header ${compact ? "dashboard-page-header" : ""}`}>
      <div>
        <span>{eyebrow || APP_NAME}</span>
        <h1>{title}</h1>
        <small className="header-build" title="Fecha y hora del commit instalado">
          <span className="material-symbols-outlined">verified</span>
          {versionLabel}
        </small>
      </div>
      {action}
    </header>
  );
}
function Panel({ title, children, className = "" }) {
  return (
    <section className={`panel ${className}`}>
      {title && <h2>{title}</h2>}
      {children}
    </section>
  );
}
function Macro({ macro }) {
  const percent = macro.goal ? Math.min(100, Math.round((macro.consumed / macro.goal) * 100)) : 0;
  return (
    <section className="macro-card">
      <h3>{macro.label}</h3>
      <p className="big"><strong>{formatNumber(macro.consumed)}</strong><span> / {formatNumber(macro.goal)}g</span></p>
      <div className="bar">
        <span style={{ width: `${percent}%` }} />
      </div>
    </section>
  );
}
function Stat({ icon, label, value }) {
  return (
    <div className="stat">
      <span className="material-symbols-outlined">{icon}</span>
      <small>{label}</small>
      <strong>{value}</strong>
    </div>
  );
}
function Toast({ message, tone }) {
  return (
    <div className={`toast ${tone}`} role={tone === "error" ? "alert" : "status"}>
      {message}
    </div>
  );
}

function categoryLabel(category) {
  return CATEGORY_OPTIONS.find((option) => option.value === category)?.label || "Otros";
}
