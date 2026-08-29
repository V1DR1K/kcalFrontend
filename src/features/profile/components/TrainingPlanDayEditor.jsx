import React, { useId, useRef, useState } from "react";
import { Icon } from "../../../components/Icon";
import { Input, Select } from "../../../components/FormControls";
import { EQUIPMENT_OPTIONS, optionLabel, registrationTypeLabel } from "../../training/training-utils";
import { useTrainingExercises } from "../../training/useTrainingExercises";

const weekdays = [
  { value: "MONDAY", label: "Lunes" }, { value: "TUESDAY", label: "Martes" },
  { value: "WEDNESDAY", label: "Miércoles" }, { value: "THURSDAY", label: "Jueves" },
  { value: "FRIDAY", label: "Viernes" }, { value: "SATURDAY", label: "Sábado" },
  { value: "SUNDAY", label: "Domingo" },
];

function ExercisePicker({ api, module, initialItems, onSelect }) {
  const inputId = useId().replace(/:/g, "");
  const inputRef = useRef(null);
  const [query, setQuery] = useState("");
  const catalog = useTrainingExercises(api, { module, q: query, initialItems, size: 24 });
  const options = catalog.items.filter((item) => item.active !== false && (item.module === module || !item.module));

  function choose(exercise) {
    onSelect(exercise);
    setQuery("");
    requestAnimationFrame(() => inputRef.current?.focus());
  }

  return (
    <section className="training-exercise-picker" aria-labelledby={`${inputId}-title`}>
      <div className="training-exercise-picker-heading">
        <div>
          <span className="training-section-kicker">Sumar al día</span>
          <h3 id={`${inputId}-title`}>Agregar ejercicio</h3>
          <p>Buscá por nombre y elegí una opción del catálogo.</p>
        </div>
        <Icon name="search" aria-hidden="true" />
      </div>
      <label className="field training-exercise-search" htmlFor={`${inputId}-input`}>
        <span>Buscar ejercicio</span>
        <input
          ref={inputRef}
          id={`${inputId}-input`}
          role="combobox"
          aria-expanded="true"
          aria-controls={`${inputId}-listbox`}
          aria-autocomplete="list"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Ej.: Sentadilla, dominadas..."
        />
      </label>
      <div id={`${inputId}-listbox`} className="training-exercise-picker-results" role="listbox" aria-label="Ejercicios disponibles">
        {catalog.loading && <div className="training-exercise-picker-state" aria-busy="true">Cargando ejercicios…</div>}
        {!catalog.loading && catalog.error && <div className="training-exercise-picker-state training-exercise-picker-error" role="alert"><span>{catalog.error}</span><button type="button" className="training-text-button" onClick={catalog.reload}>Reintentar</button></div>}
        {!catalog.loading && !catalog.error && !options.length && <div className="training-exercise-picker-state">No hay ejercicios para esta búsqueda.</div>}
        {!catalog.loading && !catalog.error && options.map((exercise) => (
          <button type="button" role="option" className="training-exercise-option" key={String(exercise.id)} onClick={() => choose(exercise)}>
            <span className="training-exercise-option-index"><Icon name="add" /></span>
            <span className="training-exercise-option-copy">
              <strong>{exercise.name}</strong>
              <small>{exercise.category || "Sin categoría"} · {registrationTypeLabel(exercise.registrationType, module)} · {optionLabel(EQUIPMENT_OPTIONS, exercise.equipment, exercise.equipment || "Sin equipamiento")}</small>
            </span>
            <em>{exercise.systemExercise || exercise.global ? "Base" : "Personal"}</em>
          </button>
        ))}
        {catalog.hasNext && <button type="button" className="training-exercise-picker-more" onClick={catalog.loadMore}>Cargar más ejercicios</button>}
      </div>
    </section>
  );
}

function exerciseLabel(exercise) {
  return exercise.name || "Ejercicio sin seleccionar";
}

export function TrainingPlanDayEditor({ api, day, dayIndex, module, frequencyMode, initialItems, onDayChange, onExerciseMove, onExerciseRemove, onExerciseAdd }) {
  return (
    <div className="training-day-editor">
      <div className="training-day-editor-intro">
        <div className="training-day-editor-index">{String(dayIndex + 1).padStart(2, "0")}</div>
        <div>
          <span className="training-section-kicker">Estructura del día</span>
          <strong>{day.exercises.length ? `${day.exercises.length} ${day.exercises.length === 1 ? "ejercicio" : "ejercicios"}` : "Todavía está vacío"}</strong>
          <span>El orden que definas acá se usará al iniciar la sesión.</span>
        </div>
      </div>

      <section className="training-day-identity" aria-labelledby="training-day-identity-title">
        <div className="training-section-heading">
          <div>
            <h3 id="training-day-identity-title">Identidad del día</h3>
            <span>Nombralo para reconocerlo de un vistazo.</span>
          </div>
        </div>
        <div className="training-plan-day-fields">
          <Input label="Nombre del día" value={day.name} maxLength="120" onChange={(event) => onDayChange({ name: event.target.value })} />
          {frequencyMode === "FIXED" && <Select label="Día de semana" value={day.dayOfWeek} options={[{ value: "", label: "Elegir día" }, ...weekdays]} onChange={(event) => onDayChange({ dayOfWeek: event.target.value })} />}
        </div>
      </section>

      <ExercisePicker api={api} module={module} initialItems={initialItems} onSelect={onExerciseAdd} />

      <section className="training-day-exercises" aria-labelledby="training-day-exercises-title">
        <div className="training-section-heading">
          <div>
            <h3 id="training-day-exercises-title">Ejercicios del día</h3>
            <span>{day.exercises.length ? "Ordená la secuencia y revisá cómo se va a registrar." : "Empezá sumando el primer ejercicio."}</span>
          </div>
          <span className="training-day-count">{day.exercises.length}</span>
        </div>
        {day.exercises.length ? (
          <div className="training-plan-exercise-list">
            {day.exercises.map((exercise, exerciseIndex) => (
              <article className="training-plan-exercise-row" key={exercise.id}>
                <span className="training-plan-exercise-number">{String(exerciseIndex + 1).padStart(2, "0")}</span>
                <div className="training-plan-exercise-copy">
                  <strong>{exerciseLabel(exercise)}</strong>
                  {exercise.exerciseId ? <small>{exercise.category || "Sin categoría"} · {registrationTypeLabel(exercise.registrationType, module)}{exercise.unilateral ? " · unilateral" : ""}</small> : <small className="training-plan-exercise-warning">Elegí un ejercicio para completar este bloque.</small>}
                </div>
                <div className="training-move-controls">
                  <button type="button" className="training-icon-action" aria-label={`Mover ejercicio ${exerciseIndex + 1} hacia arriba`} disabled={exerciseIndex === 0} onClick={() => onExerciseMove(exerciseIndex, exerciseIndex - 1)}><Icon name="keyboard_arrow_up" /></button>
                  <button type="button" className="training-icon-action" aria-label={`Mover ejercicio ${exerciseIndex + 1} hacia abajo`} disabled={exerciseIndex === day.exercises.length - 1} onClick={() => onExerciseMove(exerciseIndex, exerciseIndex + 1)}><Icon name="expand_more" /></button>
                  <button type="button" className="training-icon-action training-delete-control" aria-label={`Quitar ejercicio ${exerciseIndex + 1}`} onClick={() => onExerciseRemove(exerciseIndex)}><Icon name="delete" /></button>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="training-day-empty"><Icon name="fitness_center" /><strong>Este día todavía no tiene ejercicios</strong><span>Usá el buscador para armar la secuencia.</span></div>
        )}
      </section>

    </div>
  );
}
