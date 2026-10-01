import React from "react";
import { normalizeDecimalInput } from "../utils/decimal";

export function Input({ label, selectOnFocus = false, numericOnly = false, decimal = false, error, onFocus, ...props }) {
  const errorId = React.useId();
  const isNumeric = numericOnly || decimal || props.type === "number";
  const effectiveType = decimal ? "text" : props.type;
  const inputMode = props.inputMode || (props.name === "barcode" ? "numeric" : isNumeric ? "decimal" : undefined);
  const shouldSelect = selectOnFocus && !["file", "checkbox", "radio", "date", "datetime-local", "time", "month", "week", "range", "color"].includes(effectiveType);
  const selectValue = (event) => {
    onFocus?.(event);
    const target = event.currentTarget;
    if (shouldSelect) requestAnimationFrame(() => target?.select());
  };
  const blockNonNumericKeys = (event) => {
    if (isNumeric && !decimal && ["e", "E"].includes(event.key)) event.preventDefault();
    props.onKeyDown?.(event);
  };
  const cleanNumericInput = (event) => {
    if (decimal) {
      event.currentTarget.value = normalizeDecimalInput(event.currentTarget.value);
    }
    props.onInput?.(event);
  };
  return <label className="field"><span>{label}</span><input {...props} aria-label={props["aria-label"] || label} aria-describedby={[props["aria-describedby"], error ? errorId : null].filter(Boolean).join(" ") || undefined} aria-invalid={Boolean(error)} type={effectiveType} inputMode={inputMode} onFocus={selectValue} onKeyDown={blockNonNumericKeys} onInput={cleanNumericInput} onPointerUp={(event) => { if (shouldSelect) { event.preventDefault(); event.currentTarget.select(); } props.onPointerUp?.(event); }} />{error && <span id={errorId} className="form-error" role="alert">{error}</span>}</label>;
}

export function Select({ label, options, error, ...props }) {
  return <label className="field"><span>{label}</span><select {...props} aria-label={props["aria-label"] || label} aria-invalid={Boolean(error)}>{options.map((option) => {
    const value = typeof option === "string" ? option : option.value;
    const optionLabel = typeof option === "string" ? option : option.label;
    return <option key={value} value={value}>{optionLabel}</option>;
  })}</select>{error && <span className="form-error" role="alert">{error}</span>}</label>;
}
