import React, { useId, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Icon } from "../../components/Icon";
import { exerciseRegistration, moduleLabel, optionLabel, registrationTypeLabel, EQUIPMENT_OPTIONS } from "./training-utils";
import { useTrainingExercises } from "./useTrainingExercises";

const itemId = (item) => String(item?.id ?? "");

export function ExerciseCombobox({ api, module, value, onChange, onExerciseChange, initialItems = [], label = "Ejercicio", disabled = false, className = "" }) {
  const id = useId().replace(/:/g, "");
  const inputRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [popupStyle, setPopupStyle] = useState(null);
  const selectedIds = value ? [value] : [];
  const catalog = useTrainingExercises(api, { module, q: query, selectedIds, initialItems });
  const selected = catalog.items.find((item) => itemId(item) === String(value));
  const options = catalog.items.filter((item) => item.active !== false && (item.module === module || !item.module));

  function updatePopupPosition() {
    const input = inputRef.current;
    if (!input) return;
    const rect = input.getBoundingClientRect();
    const viewport = window.visualViewport;
    const viewportTop = viewport?.offsetTop || 0;
    const viewportBottom = viewportTop + (viewport?.height || window.innerHeight);
    const gap = 8;
    const below = Math.max(0, viewportBottom - rect.bottom - gap);
    const above = Math.max(0, rect.top - viewportTop - gap);
    const placeBelow = below >= 180 || below >= above;
    const available = Math.min(300, Math.max(1, placeBelow ? below : above));
    const top = placeBelow ? rect.bottom + gap : rect.top - gap - available;
    const clampedTop = Math.max(viewportTop + 4, Math.min(top, viewportBottom - available - 4));
    setPopupStyle({
      top: `${clampedTop}px`,
      left: `${Math.max(8, rect.left)}px`,
      width: `${Math.min(rect.width, window.innerWidth - Math.max(8, rect.left) - 8)}px`,
      maxHeight: `${available}px`,
    });
  }

  useLayoutEffect(() => {
    if (!open) {
      setPopupStyle(null);
      return undefined;
    }
    updatePopupPosition();
    const onViewportChange = () => updatePopupPosition();
    window.addEventListener("resize", onViewportChange, { passive: true });
    window.addEventListener("scroll", onViewportChange, { passive: true, capture: true });
    window.visualViewport?.addEventListener("resize", onViewportChange);
    window.visualViewport?.addEventListener("scroll", onViewportChange);
    return () => {
      window.removeEventListener("resize", onViewportChange);
      window.removeEventListener("scroll", onViewportChange, true);
      window.visualViewport?.removeEventListener("resize", onViewportChange);
      window.visualViewport?.removeEventListener("scroll", onViewportChange);
    };
  }, [catalog.hasNext, catalog.loading, open, options.length]);

  function choose(exercise) {
    onChange(itemId(exercise));
    onExerciseChange?.(exercise);
    setQuery("");
    setOpen(false);
  }

  return <div className={`training-combobox ${className}`.trim()} onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false); }}>
    <label className="field" htmlFor={`${id}-input`}><span>{label}</span><input ref={inputRef} id={`${id}-input`} role="combobox" aria-expanded={open} aria-controls={`${id}-listbox`} aria-autocomplete="list" value={open ? query : ""} placeholder={selected?.name || "Buscar ejercicio"} disabled={disabled} onFocus={() => { setOpen(true); setQuery(""); }} onChange={(event) => { setQuery(event.target.value); setOpen(true); }} /></label>
    {selected && <div className="training-combobox-selected"><strong>{selected.name}</strong><span>{selected.category || "Sin categoría"} · {registrationTypeLabel(selected.registrationType, module)}</span><small>{selected.systemExercise || selected.global ? "Base" : "Personal"}{selected.active === false ? " · Inactivo" : " · Activo"}</small></div>}
    {open && createPortal(<div id={`${id}-listbox`} role="listbox" className="training-combobox-list training-combobox-list-floating" aria-label={`${label} disponibles`} style={popupStyle || { visibility: "hidden" }} data-dialog-scroll-owner="true">
       {catalog.loading && <div className="training-combobox-state" aria-busy="true">Cargando ejercicios…</div>}
       {!catalog.loading && catalog.error && <div className="training-combobox-state training-combobox-error" role="alert">{catalog.error}<button type="button" className="training-text-button" onMouseDown={(event) => event.preventDefault()} onClick={catalog.reload}>Reintentar</button></div>}
       {!catalog.loading && !catalog.error && !options.length && <div className="training-combobox-state">No hay ejercicios para esta búsqueda.</div>}
       {!catalog.loading && !catalog.error && options.map((exercise) => <button type="button" role="option" aria-selected={itemId(exercise) === String(value)} className={`training-combobox-option ${itemId(exercise) === String(value) ? "is-selected" : ""}`.trim()} key={itemId(exercise)} onMouseDown={(event) => event.preventDefault()} onClick={() => choose(exercise)}><span><strong>{exercise.name}</strong><small>{exercise.category || "Sin categoría"} · {registrationTypeLabel(exercise.registrationType, module)} · {optionLabel(EQUIPMENT_OPTIONS, exercise.equipment, exercise.equipment || "Sin equipamiento")}</small></span><em>{exercise.systemExercise || exercise.global ? "Base" : "Personal"}{exercise.active === false ? " · Inactivo" : ""}</em></button>)}
       {catalog.hasNext && <button type="button" className="training-combobox-more" onMouseDown={(event) => event.preventDefault()} onClick={catalog.loadMore}>Cargar más</button>}
     </div>, document.body)}
  </div>;
}
