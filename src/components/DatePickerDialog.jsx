import React, { useId, useRef, useState } from "react";
import { Icon } from "./Icon";
import { ModalShell } from "./dialog/ModalShell";

const WEEKDAYS = ["L", "M", "X", "J", "V", "S", "D"];

function dateValue(year, month, day) {
  return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function asLocalDate(value) {
  return new Date(`${value}T00:00:00`);
}

export function DatePickerDialog({ value, onSelect, onClose, className = "", backdropClassName = "" }) {
  const selected = asLocalDate(value);
  const [month, setMonth] = useState(() => new Date(selected.getFullYear(), selected.getMonth(), 1));
  const closeRef = useRef(null);
  const titleId = `${useId().replace(/:/g, "")}-title`;
  const today = dateValue(new Date().getFullYear(), new Date().getMonth(), new Date().getDate());
  const leadingDays = (month.getDay() + 6) % 7;
  const daysInMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const monthLabel = new Intl.DateTimeFormat("es-AR", { month: "long", year: "numeric" }).format(month);

  return (
    <ModalShell onClose={onClose} initialFocusRef={closeRef} hideHeader labelledBy={titleId} className={`app-modal-compact date-picker-dialog ${className}`.trim()} backdropClassName={`date-picker-backdrop ${backdropClassName}`.trim()}>
        <header>
          <div>
            <span>Elegir fecha</span>
            <h2 id={titleId}>{monthLabel}</h2>
          </div>
          <button ref={closeRef} type="button" className="icon-button" aria-label="Cerrar calendario" onClick={onClose}><Icon name="close" /></button>
        </header>
        <div className="date-picker-month-actions">
          <button type="button" className="secondary" onClick={() => setMonth((current) => new Date(current.getFullYear(), current.getMonth() - 1, 1))}><Icon name="chevron_left" />Anterior</button>
          <button type="button" className="secondary" onClick={() => setMonth(new Date(selected.getFullYear(), selected.getMonth(), 1))}>Mes elegido</button>
          <button type="button" className="secondary" onClick={() => setMonth((current) => new Date(current.getFullYear(), current.getMonth() + 1, 1))}>Siguiente<Icon name="chevron_right" /></button>
        </div>
        <div className="date-picker-weekdays" aria-hidden="true">{WEEKDAYS.map((day) => <span key={day}>{day}</span>)}</div>
        <div className="date-picker-grid">
          {Array.from({ length: leadingDays }, (_, index) => <span key={`empty-${index}`} />)}
          {Array.from({ length: daysInMonth }, (_, index) => {
            const day = index + 1;
            const nextValue = dateValue(month.getFullYear(), month.getMonth(), day);
            const isSelected = nextValue === value;
            return <button type="button" key={nextValue} className={`${isSelected ? "selected" : ""} ${nextValue === today ? "today" : ""}`.trim()} aria-pressed={isSelected} aria-label={new Intl.DateTimeFormat("es-AR", { dateStyle: "full" }).format(asLocalDate(nextValue))} onClick={() => { onSelect(nextValue); onClose(); }}>{day}</button>;
          })}
        </div>
        <footer><button type="button" className="primary" onClick={() => { onSelect(today); onClose(); }}><Icon name="today" />Ir a hoy</button></footer>
    </ModalShell>
  );
}
