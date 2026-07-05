import React from "react";

export function Input({ label, selectOnFocus = false, onFocus, ...props }) {
  const selectValue = (event) => {
    onFocus?.(event);
    if (selectOnFocus) requestAnimationFrame(() => event.currentTarget.select());
  };
  return <label className="field"><span>{label}</span><input {...props} onFocus={selectValue} onPointerUp={(event) => { if (selectOnFocus) { event.preventDefault(); event.currentTarget.select(); } props.onPointerUp?.(event); }} /></label>;
}

export function Select({ label, options, ...props }) {
  return <label className="field"><span>{label}</span><select {...props}>{options.map((option) => {
    const value = typeof option === "string" ? option : option.value;
    const optionLabel = typeof option === "string" ? option : option.label;
    return <option key={value} value={value}>{optionLabel}</option>;
  })}</select></label>;
}
