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
  const [exportOpen, setExportOpen] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [monthOffset, setMonthOffset] = useState(0);
  const currentDate = new Date();
  const viewDate = new Date(currentDate.getFullYear(), currentDate.getMonth() + monthOffset, 1);
  const load = useCallback(() => {
    setLoading(true);
    setError("");
    api
      .runAction(
        { title: "Cargando historial", description: "Estamos preparando tu calendario..." },
        () => api.request(`/api/nutrition/history?year=${viewDate.getFullYear()}&month=${viewDate.getMonth() + 1}`),
      )
      .then(setData)
      .catch(() => setError("No pudimos cargar tu historial."))
      .finally(() => setLoading(false));
  }, [api, viewDate.getFullYear(), viewDate.getMonth()]);
  useEffect(load, [load]);
  if (loading)
    return (
      <section className="page">
        <Header title="Historial" />
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
  const rawMonthLabel = new Intl.DateTimeFormat("es-AR", { month: "long", year: "numeric" }).format(viewDate);
  const monthLabel = rawMonthLabel.charAt(0).toUpperCase() + rawMonthLabel.slice(1);
  const leadingDays = (new Date(viewDate.getFullYear(), viewDate.getMonth(), 1).getDay() + 6) % 7;
  return (
    <section className="page">
      <Header title="Historial" />
      <div className="grid two history-summary">
        <Panel title="Promedio del mes">
          <p className="big">{formatNumber(data?.averageCalories)} kcal</p>
        </Panel>
        <Panel title="Días con objetivo cumplido">
          <p className="big">{data?.completedGoalDays || 0} días</p>
        </Panel>
      </div>
      <div className="history-calendar-toolbar">
        <button className="primary calendar-export" type="button" onClick={() => setExportOpen(true)}><Icon name="download" />Exportar a Excel</button>
      </div>
      <div className="history-calendar-shell">
        <div className="history-calendar-main">
          <div className="calendar-heading">
            <button className="secondary calendar-nav" onClick={() => setMonthOffset((offset) => offset - 1)}><Icon name="chevron_left" />Anterior</button>
            <div><h2>{monthLabel}</h2><span>Tu constancia, día por día</span></div>
            <button className="secondary calendar-nav" onClick={() => setMonthOffset((offset) => offset + 1)} disabled={monthOffset >= 0}><Icon name="chevron_right" />Siguiente</button>
          </div>
          <div className="calendar-weekdays" aria-hidden="true">{["L", "M", "X", "J", "V", "S", "D"].map((day) => <span key={day}>{day}</span>)}</div>
          <div className="calendar-grid">
            {Array.from({ length: leadingDays }, (_, index) => <span className="calendar-spacer" key={`spacer-${index}`} />)}
            {(data?.days || []).map((day) => (
              <button type="button" key={day.date} className={day.goalReached ? "done" : ""} style={{ "--plan-color": planColor(day.planId || day.planName) }} title={`Ver detalle del ${readableDate(day.date)}`} aria-label={`${readableDate(day.date)}, ${day.goalReached ? "objetivo cumplido" : "día registrado"}. Ver detalle`} onClick={() => setSelectedDay(day)}>
                <b>{new Date(`${day.date}T00:00:00`).getDate()}</b><small>{day.planName}</small>{day.goalReached && <Icon name="check_circle" />}
              </button>
            ))}
          </div>
          <div className="plan-legend">{[...new Map((data?.days || []).map((day) => [day.planId || day.planName, day])).values()].map((day) => <span key={day.planId || day.planName}><i style={{ background: planColor(day.planId || day.planName) }} />{day.planName}</span>)}</div>
        </div>
        <aside className="history-calendar-aside">
          <Icon name="calendar_month" />
          <h3>Un día a la vez</h3>
          <p>Elegí cualquier fecha para revisar tus comidas, macros e hidratación con el contexto completo.</p>
          <div><span><i className="history-status-dot complete" />Objetivo cumplido</span><span><i className="history-status-dot recorded" />Día registrado</span></div>
        </aside>
      </div>
      {selectedDay && <HistoryDayPreview api={api} day={selectedDay} onClose={() => setSelectedDay(null)} />}
      {exportOpen && <HistoryExportDialog api={api} monthDate={viewDate} exporting={exporting} setExporting={setExporting} onClose={() => setExportOpen(false)} />}
    </section>
  );
}

function HistoryExportDialog({ api, monthDate, exporting, setExporting, onClose }) {
  const closeRef = useRef(null);
  const monthLabel = new Intl.DateTimeFormat("es-AR", { month: "long", year: "numeric" }).format(monthDate);

  useEffect(() => {
    closeRef.current?.focus();
    const handleKeyDown = (event) => { if (event.key === "Escape" && !exporting) onClose(); };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [exporting, onClose]);

  async function exportSelection() {
    setExporting(true);
    try {
      const dates = (await api.request(`/api/nutrition/history?year=${monthDate.getFullYear()}&month=${monthDate.getMonth() + 1}`)).days.map((day) => day.date);
      const details = await Promise.all(dates.map((date) => api.request(`/api/nutrition/dashboard?date=${date}`)));
      downloadMealsExcel(details, `scalegrams-comidas-${monthDate.getFullYear()}-${String(monthDate.getMonth() + 1).padStart(2, "0")}`);
      onClose();
      api.notify(`Excel exportado: ${monthLabel}.`);
    } catch {
      api.notify("No se pudo exportar el historial.", "error");
    } finally {
      setExporting(false);
    }
  }

  return createPortal(
    <div className="history-export-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget && !exporting) onClose(); }}>
      <section className="history-export-dialog" role="dialog" aria-modal="true" aria-labelledby="history-export-title">
        <header>
          <div><span className="eyebrow">Historial</span><h2 id="history-export-title">Exportar comidas</h2><p>Descargá un Excel con todos los alimentos, cantidades y macros registrados.</p></div>
          <button ref={closeRef} type="button" className="history-preview-close" onClick={onClose} disabled={exporting} aria-label="Cerrar exportación"><Icon name="close" /></button>
        </header>
        <div className="history-export-options">
          <div className="history-export-option selected"><Icon name="calendar_month" /><span><strong>Mes completo</strong><small>{monthLabel} · todas las comidas registradas</small></span><Icon name="check_circle" /></div>
        </div>
        <footer><button type="button" className="secondary" onClick={onClose} disabled={exporting}>Cancelar</button><button type="button" className="primary" onClick={exportSelection} disabled={exporting}><Icon name="download" />{exporting ? "Preparando Excel…" : "Descargar Excel"}</button></footer>
      </section>
    </div>,
    document.body,
  );
}

function downloadMealsExcel(details, filename) {
  const headers = ["Fecha", "Comida", "Alimento", "Tipo", "Cantidad", "Unidad", "Calorías (kcal)", "Proteínas (g)", "Carbohidratos (g)", "Grasas (g)"];
  const rows = details.flatMap((detail) => (detail.meals || []).flatMap((meal) => (meal.items || []).map((item) => {
    const name = item.itemType === "RECIPE" ? item.recipe?.name : item.itemType === "AI_ESTIMATE" ? item.displayName : item.food?.name;
    return [detail.date, meal.label, name || "Sin nombre", item.itemType === "RECIPE" ? "Receta" : item.itemType === "AI_ESTIMATE" ? "Estimación" : "Alimento", item.quantity ?? "", item.unit === "GRAM" ? "g" : item.unit || "", item.calories ?? 0, item.proteinGrams ?? 0, item.carbsGrams ?? 0, item.fatGrams ?? 0];
  })));
  const table = `<table><thead><tr>${headers.map((header) => `<th>${escapeExcel(header)}</th>`).join("")}</tr></thead><tbody>${rows.map((row) => `<tr>${row.map((cell) => `<td>${escapeExcel(cell)}</td>`).join("")}</tr>`).join("")}</tbody></table>`;
  const html = `<html><head><meta charset="UTF-8"></head><body>${table}</body></html>`;
  const blob = new Blob([`\ufeff${html}`], { type: "application/vnd.ms-excel;charset=utf-8" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `${filename}.xls`;
  link.click();
  URL.revokeObjectURL(link.href);
}

function escapeExcel(value) {
  return String(value ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function HistoryDayPreview({ api, day, onClose }) {
  const [detail, setDetail] = useState(null);
  const [error, setError] = useState("");
  const [exporting, setExporting] = useState(false);
  const closeRef = useRef(null);

  useEffect(() => {
    let active = true;
    api.runAction(
      { title: "Cargando detalle", description: "Estamos preparando el resumen de este día..." },
      () => api.request(`/api/nutrition/dashboard?date=${day.date}`),
    )
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

  function exportDay() {
    if (!detail || exporting) return;
    setExporting(true);
    try {
      downloadMealsExcel([detail], `scalegrams-comidas-${day.date}`);
      api.notify(`Excel exportado: ${readableDate(day.date)}.`);
    } finally {
      setExporting(false);
    }
  }

  return createPortal(
    <div className="history-preview-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section className="history-preview" role="dialog" aria-modal="true" aria-labelledby="history-preview-title">
        <header className="history-preview-header">
          <div>
            <span className="eyebrow">Resumen del día</span>
            <h2 id="history-preview-title">{readableDate(day.date)}</h2>
            <small>{day.planName || detail?.plan?.name}</small>
          </div>
          <div className="history-preview-header-actions">
            <button type="button" className="secondary history-day-export" onClick={exportDay} disabled={!detail || exporting}><Icon name="download" />{exporting ? "Exportando…" : "Exportar día"}</button>
            <button ref={closeRef} type="button" className="history-preview-close" onClick={onClose} aria-label="Cerrar detalle"><Icon name="close" /></button>
          </div>
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
                           <FoodThumb compact item={item.itemType === "RECIPE" ? { ...item.recipe, type: "RECIPE" } : item.itemType === "AI_ESTIMATE" ? { name: item.displayName, category: "OTHER", type: "AI_ESTIMATE" } : item.food} />
                           <p><strong>{item.itemType === "RECIPE" ? item.recipe?.name : item.itemType === "AI_ESTIMATE" ? item.displayName : item.food?.name}</strong><small>{item.itemType === "RECIPE" ? `${formatNumber(item.quantity, 1)} porción${Number(item.quantity) === 1 ? "" : "es"}` : item.itemType === "AI_ESTIMATE" ? "Estimación por foto" : `${formatNumber(item.quantity)} ${item.unit === "GRAM" ? "g" : item.unit}`}</small></p>
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
          ) : error ? <CatalogStatus error>{error}</CatalogStatus> : <div className="history-preview-loading" aria-busy="true" />}
        </div>
      </section>
    </div>,
    document.body,
  );
}

function planColor(value) { const palette = ["#4edea3", "#89ceff", "#ffd166", "#c7a6ff", "#ff8fa3"]; const hash = String(value || "plan").split("").reduce((sum, char) => sum + char.charCodeAt(0), 0); return palette[hash % palette.length]; }
