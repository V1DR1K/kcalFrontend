import React from "react";

export function Input({ label, selectOnFocus = true, onFocus, ...props }) {
  const inputMode = props.inputMode || (props.name === "barcode" ? "numeric" : props.type === "number" ? "decimal" : undefined);
  const shouldSelect = selectOnFocus && !["file", "checkbox", "radio", "date", "range", "color"].includes(props.type);
  const selectValue = (event) => {
    onFocus?.(event);
    if (shouldSelect) requestAnimationFrame(() => event.currentTarget.select());
  };
  return <label className="field"><span>{label}</span><input {...props} inputMode={inputMode} onFocus={selectValue} onPointerUp={(event) => { if (shouldSelect) { event.preventDefault(); event.currentTarget.select(); } props.onPointerUp?.(event); }} /></label>;
}

export function Select({ label, options, ...props }) {
  return <label className="field"><span>{label}</span><select {...props}>{options.map((option) => {
    const value = typeof option === "string" ? option : option.value;
    const optionLabel = typeof option === "string" ? option : option.label;
    return <option key={value} value={value}>{optionLabel}</option>;
  })}</select></label>;
}
