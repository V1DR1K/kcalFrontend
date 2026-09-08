import React, { useCallback, useEffect, useState } from "react";
import { Header, Panel } from "../../components/Layout";
import { Icon } from "../../components/Icon";
import "../../styles/06-history.css";
import { CatalogStatus } from "../catalog/CatalogComponents";
import { formatNumber, readableDate } from "../../utils/format";
import { HistoryDayPreview, HistoryExportDialog } from "./dialogs/HistoryDialogs";

function nutritionDayHasActivity(day) {
  return Number(day?.caloriesConsumed || 0) > 0;
}

export function History({ api }) {
  const [data, setData] = useState(null); const [loading, setLoading] = useState(true); const [error, setError] = useState(""); const [selectedDay, setSelectedDay] = useState(null); const [exportOpen, setExportOpen] = useState(false); const [exporting, setExporting] = useState(false); const [monthOffset, setMonthOffset] = useState(0);
  const currentDate = new Date(); const viewDate = new Date(currentDate.getFullYear(), currentDate.getMonth() + monthOffset, 1);
  const load = useCallback(() => { setLoading(true); setError(""); api.runAction({ title: "Cargando historial", description: "Estamos preparando tu calendario..." }, () => api.request(`/api/nutrition/history?year=${viewDate.getFullYear()}&month=${viewDate.getMonth() + 1}`)).then(setData).catch(() => setError("No pudimos cargar tu historial.")).finally(() => setLoading(false)); }, [api, viewDate.getFullYear(), viewDate.getMonth()]);
  useEffect(load, [load]);
  if (loading) return <section className="page"><Header title="Historial" /><div className="page-loading-stack" aria-busy="true" aria-label="Cargando historial"><div className="skeleton" /><div className="skeleton" /><div className="skeleton" /></div></section>;
  if (error) return <section className="page"><Header title="Historial" /><CatalogStatus error>{error}<button className="secondary" onClick={load}>Reintentar</button></CatalogStatus></section>;
  const rawMonthLabel = new Intl.DateTimeFormat("es-AR", { month: "long", year: "numeric" }).format(viewDate); const monthLabel = rawMonthLabel.charAt(0).toUpperCase() + rawMonthLabel.slice(1); const leadingDays = (new Date(viewDate.getFullYear(), viewDate.getMonth(), 1).getDay() + 6) % 7; const days = data?.days || []; const activeDays = days.filter(nutritionDayHasActivity).length; const trailingDays = (7 - ((leadingDays + days.length) % 7)) % 7; const plans = [...new Map(days.filter((day) => day.planName).map((day) => [day.planId || day.planName, day])).entries()];
  return (
    <section className="page history-page">
      <Header title="Historial" />
      <div className="grid two history-summary"><Panel title="Promedio del mes"><p className="big">{formatNumber(data?.averageCalories)} kcal</p></Panel><Panel title="Días con objetivo cumplido"><p className="big">{data?.completedGoalDays || 0} días</p></Panel></div>
      <div className="history-calendar-toolbar"><button className="primary calendar-export" type="button" onClick={() => setExportOpen(true)}><Icon name="download" />Exportar a Excel</button></div>
      <section className="history-calendar-surface">
        <div className="history-calendar-heading"><button type="button" className="history-calendar-icon-action" aria-label="Mes anterior" onClick={() => setMonthOffset((offset) => offset - 1)}><Icon name="chevron_left" /></button><div><h2>{monthLabel}</h2><span>{activeDays} {activeDays === 1 ? "día registrado" : "días registrados"}</span></div><button type="button" className="history-calendar-icon-action" aria-label="Mes siguiente" onClick={() => setMonthOffset((offset) => offset + 1)} disabled={monthOffset >= 0}><Icon name="chevron_right" /></button></div>
        <div className="history-calendar-weekdays" aria-hidden="true">{["L", "M", "X", "J", "V", "S", "D"].map((day) => <span key={day}>{day}</span>)}</div>
        <div className="history-calendar-grid">{Array.from({ length: leadingDays }, (_, index) => <span className="history-calendar-spacer" key={`leading-spacer-${index}`} />)}{days.map((day) => { const active = nutritionDayHasActivity(day); const status = day.goalReached ? "objetivo cumplido" : active ? "día registrado" : "sin actividad registrada"; return <button type="button" data-history-date={day.date} key={day.date} className={`history-calendar-day ${active ? "history-calendar-day-active" : ""}`.trim()} style={{ "--plan-color": planColor(day.planId || day.planName) }} title={`Ver detalle del ${readableDate(day.date)}`} aria-label={`${readableDate(day.date)}, ${status}. Ver detalle`} onClick={() => setSelectedDay(day)}><b>{new Date(`${day.date}T00:00:00`).getDate()}</b>{day.planName && <small>{day.planName}</small>}{day.goalReached && <Icon name="check_circle" />}</button>; })}{Array.from({ length: trailingDays }, (_, index) => <span className="history-calendar-spacer" key={`trailing-spacer-${index}`} />)}</div>
        {plans.length > 0 && <div className="history-plan-legend">{plans.map(([key, day]) => <span key={key}><i style={{ background: planColor(day.planId || day.planName) }} />{day.planName}</span>)}</div>}
      </section>
      {selectedDay && <HistoryDayPreview api={api} day={selectedDay} onClose={() => setSelectedDay(null)} />}{exportOpen && <HistoryExportDialog api={api} monthDate={viewDate} exporting={exporting} setExporting={setExporting} onClose={() => setExportOpen(false)} />}
    </section>
  );
}

function planColor(value) { const palette = ["#4edea3", "#89ceff", "#ffd166", "#c7a6ff", "#ff8fa3"]; const hash = String(value || "plan").split("").reduce((sum, char) => sum + char.charCodeAt(0), 0); return palette[hash % palette.length]; }
