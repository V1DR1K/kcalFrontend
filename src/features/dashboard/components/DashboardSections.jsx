import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { DatePickerDialog } from "../../../components/DatePickerDialog";
import { Input } from "../../../components/FormControls";
import { Icon } from "../../../components/Icon";
import { CatalogRowWithImage, CatalogStatus, FoodThumb, NutrientDetails, PreparationBadge, categoryLabel, groupFoodVariants, preparationLabel } from "../../catalog/CatalogComponents";
import { EditFoodLog, FoodLogDialog, FoodLogForm } from "../../foods/FoodComponents";
import { readRecents, rememberItem, rememberMeal } from "../../../services/recents";
import { formatNumber, readableDate, shiftDate, today } from "../../../utils/format";
import { createMealLogs, foodPreparationSuffix, formatMealLogAmount, isCopyableMealLog, macroCalories, macroValue, mealCopyErrorMessage, mealLogItem, mealLogName, mealTotals, scaleFoodNutrition } from "../dashboard.utils";
import { Header, Macro, Panel } from "../../../components/Layout";
import { NutritionSummary } from "../../../components/NutritionSummary";

export { NutritionPills, CompactBalanceBar, DateNavigator, PastMealsPreview,  };

function NutritionPills({ nutrition }) {
  return (
    <>
      <NutritionSummary nutrition={nutrition} size="detail" />
      {nutrition?.nutrients?.length > 0 && <NutrientDetails nutrients={nutrition.nutrients} label="Más nutrientes" defaultOpen />}
    </>
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

function DateNavigator({ date, setDate, changing = false }) {
  const [pickerOpen, setPickerOpen] = useState(false);
  return (
    <div className={`date-nav action-surface ${changing ? "date-changing" : ""}`} data-action-state={changing ? "pending" : "idle"}>
      <button className="icon-button action-control" aria-label="Día anterior" disabled={changing} onClick={() => setDate(shiftDate(date, -1))}>
        <Icon name="chevron_left" />
      </button>
      <button type="button" className="date-picker-trigger action-control" aria-haspopup="dialog" disabled={changing} onClick={() => setPickerOpen(true)}><Icon name="calendar_month" /><span>{readableDate(date)}</span></button>
      <button className="icon-button action-control" aria-label="Día siguiente" disabled={changing} onClick={() => setDate(shiftDate(date, 1))}>
        <Icon name="chevron_right" />
      </button>
      <button className="secondary today-button action-control" aria-label="Ir a hoy" disabled={changing} onClick={() => setDate(today())}>
        <Icon name="today" /><span className="today-label">Hoy</span>
      </button>
      {pickerOpen && !changing && <DatePickerDialog value={date} onSelect={setDate} onClose={() => setPickerOpen(false)} />}
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
    } catch (error) {
      onOptimisticRollback(optimisticLogs);
      setStatus((current) => ({ ...current, [mealType]: "error" }));
      api.notify(mealCopyErrorMessage(error, "No se pudo copiar la comida completa."), "error");
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
            const copyableItems = items.filter(isCopyableMealLog);
            const state = status[type.code];
            if (!items.length || state === "dismissed") return null;
            return (
              <article className={`ghost-meal action-surface ${state || ""}`} data-action-state={state || "idle"} key={type.code}>
                <header>
                  <div>
                    <span>
                      {type.label} · {readableDate(sourceDate)}
                    </span>
                    <strong>{meal.calories} kcal</strong>
                  </div>
                  <div className="ghost-actions">
                    <button className="copy-accept" disabled={!copyableItems.length || state === "copying" || state === "copied"} aria-label={`Aplicar ${type.label}`} onClick={() => copyMeal(type.code, copyableItems)}>
                      <Icon name={state === "copied" ? "check_circle" : "check"} />
                      <span>{state === "copying" ? "Aplicando…" : state === "copied" ? "Aplicado" : "Aplicar"}</span>
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
