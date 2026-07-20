import React, { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Header, Panel } from "../../components/Layout";
import { Icon } from "../../components/Icon";
import "../../styles/05-scanner.css";
import "../../styles/06-history.css";
import { CatalogStatus, FoodThumb } from "../catalog/CatalogComponents";
import { formatNumber, readableDate } from "../../utils/format";

export function History({ api }) {
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
          <button ref={closeRef} type="button" className="history-preview-close" onClick={onClose} aria-label="Cerrar detalle"><Icon name="close" /></button>
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
                    <header><div><Icon name="restaurant" /><strong>{meal.label}</strong></div><small>{formatNumber(meal.calories)} kcal</small></header>
                    <div>
                      {meal.items.map((item) => (
                        <div className="history-food" key={item.id}>
                          <FoodThumb compact item={item.itemType === "RECIPE" ? { ...item.recipe, type: "RECIPE" } : item.food} />
                          <p><strong>{item.itemType === "RECIPE" ? item.recipe?.name : item.food?.name}</strong><small>{item.itemType === "RECIPE" ? `${formatNumber(item.quantity, 1)} porcion${Number(item.quantity) === 1 ? "" : "es"}` : `${formatNumber(item.quantity)} ${item.unit === "GRAM" ? "g" : item.unit}`}</small></p>
                          <span>{formatNumber(item.calories)} kcal</span>
                        </div>
                      ))}
                    </div>
                  </article>
                ))}
                {!detail.meals?.some((meal) => meal.items?.length) && <div className="history-empty"><Icon name="no_meals" /><strong>Sin alimentos registrados</strong><small>Este día todavía no tiene comidas cargadas.</small></div>}
              </div>
              <div className="history-water"><Icon name="water_drop" /><p><strong>Hidratación</strong><small>{formatNumber(detail.waterConsumedLiters, 1)} L de {formatNumber(detail.waterGoalLiters, 1)} L</small></p></div>
            </>
          ) : error ? <CatalogStatus error>{error}</CatalogStatus> : <div className="history-preview-loading"><span className="spinner" /><span>Cargando detalle…</span></div>}
        </div>
      </section>
    </div>,
    document.body,
  );
}

function planColor(value) { const palette = ["#4edea3", "#89ceff", "#ffd166", "#c7a6ff", "#ff8fa3"]; const hash = String(value || "plan").split("").reduce((sum, char) => sum + char.charCodeAt(0), 0); return palette[hash % palette.length]; }
