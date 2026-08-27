import React, { useId, useRef, useState } from "react";
import { Icon } from "../../components/Icon";
import { exerciseRegistration, moduleLabel, optionLabel, registrationTypeLabel, EQUIPMENT_OPTIONS } from "./training-utils";
import { useTrainingExercises } from "./useTrainingExercises";

const itemId = (item) => String(item?.id ?? "");

export function ExerciseCombobox({ api, module, value, onChange, onExerciseChange, initialItems = [], label = "Ejercicio", disabled = false, className = "" }) {
  const id = useId().replace(/:/g, "");
  const inputRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const selectedIds = value ? [value] : [];
  const catalog = useTrainingExercises(api, { module, q: query, selectedIds, initialItems });
  const selected = catalog.items.find((item) => itemId(item) === String(value));
  const options = catalog.items.filter((item) => item.active !== false && (item.module === module || !item.module));

  function choose(exercise) {
    onChange(itemId(exercise));
    onExerciseChange?.(exercise);
    setQuery("");
    setOpen(false);
  }

  return <div className={`training-combobox ${className}`.trim()} onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false); }}>
    <label className="field" htmlFor={`${id}-input`}><span>{label}</span><input ref={inputRef} id={`${id}-input`} role="combobox" aria-expanded={open} aria-controls={`${id}-listbox`} aria-autocomplete="list" value={open ? query : ""} placeholder={selected?.name || "Buscar ejercicio"} disabled={disabled} onFocus={() => { setOpen(true); setQuery(""); }} onChange={(event) => { setQuery(event.target.value); setOpen(true); }} /></label>
    {selected && <div className="training-combobox-selected"><strong>{selected.name}</strong><span>{selected.category || "Sin categoría"} · {registrationTypeLabel(selected.registrationType, module)}</span><small>{selected.systemExercise || selected.global ? "Base" : "Personal"}{selected.active === false ? " · Inactivo" : " · Activo"}</small></div>}
    {open && <div id={`${id}-listbox`} role="listbox" className="training-combobox-list" aria-label={`${label} disponibles`}>
      {catalog.loading && <div className="training-combobox-state" aria-busy="true">Cargando ejercicios…</div>}
      {!catalog.loading && catalog.error && <div className="training-combobox-state training-combobox-error" role="alert">{catalog.error}<button type="button" className="training-text-button" onMouseDown={(event) => event.preventDefault()} onClick={catalog.reload}>Reintentar</button></div>}
      {!catalog.loading && !catalog.error && !options.length && <div className="training-combobox-state">No hay ejercicios para esta búsqueda.</div>}
      {!catalog.loading && !catalog.error && options.map((exercise) => <button type="button" role="option" aria-selected={itemId(exercise) === String(value)} className={`training-combobox-option ${itemId(exercise) === String(value) ? "is-selected" : ""}`.trim()} key={itemId(exercise)} onMouseDown={(event) => event.preventDefault()} onClick={() => choose(exercise)}><span><strong>{exercise.name}</strong><small>{exercise.category || "Sin categoría"} · {registrationTypeLabel(exercise.registrationType, module)} · {optionLabel(EQUIPMENT_OPTIONS, exercise.equipment, exercise.equipment || "Sin equipamiento")}</small></span><em>{exercise.systemExercise || exercise.global ? "Base" : "Personal"}{exercise.active === false ? " · Inactivo" : ""}</em></button>)}
      {catalog.hasNext && <button type="button" className="training-combobox-more" onMouseDown={(event) => event.preventDefault()} onClick={catalog.loadMore}>Cargar más</button>}
    </div>}
  </div>;
}
