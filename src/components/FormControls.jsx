import React from "react";

export function Input({ label, selectOnFocus = true, numericOnly = false, error, onFocus, ...props }) {
  const isNumeric = numericOnly || props.type === "number";
  const effectiveType = isNumeric && props.type === "number" ? "text" : props.type;
  const inputMode = props.inputMode || (props.name === "barcode" ? "numeric" : isNumeric ? "decimal" : undefined);
  const shouldSelect = selectOnFocus && !["file", "checkbox", "radio", "date", "range", "color"].includes(effectiveType);
  const selectValue = (event) => {
    onFocus?.(event);
    if (shouldSelect) requestAnimationFrame(() => event.currentTarget.select());
  };
  const blockNonNumericKeys = (event) => {
    if (isNumeric && ["e", "E", "+", "-"].includes(event.key)) event.preventDefault();
    props.onKeyDown?.(event);
  };
  const cleanNumericInput = (event) => {
    if (isNumeric) {
      const cleaned = event.currentTarget.value.replace(",", ".").replace(/[^\d.]/g, "");
      const [whole, ...decimals] = cleaned.split(".");
      event.currentTarget.value = decimals.length ? `${whole}.${decimals.join("")}` : whole;
    }
    props.onInput?.(event);
  };
  return <label className="field"><span>{label}</span><input {...props} aria-invalid={Boolean(error)} type={effectiveType} inputMode={inputMode} onFocus={selectValue} onKeyDown={blockNonNumericKeys} onInput={cleanNumericInput} onPointerUp={(event) => { if (shouldSelect) { event.preventDefault(); event.currentTarget.select(); } props.onPointerUp?.(event); }} />{error && <span className="form-error" role="alert">{error}</span>}</label>;
}

export function Select({ label, options, error, ...props }) {
  return <label className="field"><span>{label}</span><select {...props} aria-invalid={Boolean(error)}>{options.map((option) => {
    const value = typeof option === "string" ? option : option.value;
    const optionLabel = typeof option === "string" ? option : option.label;
    return <option key={value} value={value}>{optionLabel}</option>;
  })}</select>{error && <span className="form-error" role="alert">{error}</span>}</label>;
}
