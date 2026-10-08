import React from "react";
import { normalizeDecimalInput } from "../utils/decimal";

export function useSelectAllOnFocus(enabled = true) {
  const pointerStartedFocused = React.useRef(false);
  const onPointerDown = React.useCallback((event) => {
    pointerStartedFocused.current = document.activeElement === event.currentTarget;
  }, []);
  const onFocus = React.useCallback((event) => {
    if (!enabled) return;
    const target = event.currentTarget;
    if (typeof target.select !== "function") return;
    window.requestAnimationFrame(() => {
      if (!target.isConnected || document.activeElement !== target) return;
      try { target.select(); } catch { /* Some native input types do not expose a text selection. */ }
    });
  }, [enabled]);
  const onPointerUp = React.useCallback((event) => {
    if (!enabled || pointerStartedFocused.current) return;
    const target = event.currentTarget;
    if (typeof target.select !== "function") return;
    event.preventDefault();
    try { target.select(); } catch { /* Some native input types do not expose a text selection. */ }
  }, [enabled]);
  return { onFocus, onPointerDown, onPointerUp };
}

function hasFractionalStep(step) {
  if (step === "any") return true;
  if (step == null || step === "") return false;
  const value = Number(step);
  return Number.isFinite(value) && !Number.isInteger(value);
}

function numericInputValidityMessage(value, { min, max, step, supportsDecimals, stepBase }) {
  const normalized = normalizeDecimalInput(value).trim();
  if (!normalized) return "";
  const format = supportsDecimals ? /^-?(?:\d+(?:\.\d*)?|\.\d+)$/ : /^-?\d+$/;
  if (!format.test(normalized)) return "Ingresá un número válido.";

  const numericValue = Number(normalized);
  if (!Number.isFinite(numericValue)) return "Ingresá un número válido.";
  if (min != null && numericValue < Number(min)) return `Ingresá un valor igual o mayor a ${min}.`;
  if (max != null && numericValue > Number(max)) return `Ingresá un valor igual o menor a ${max}.`;
  if (step != null && step !== "" && step !== "any") {
    const stepValue = Number(step);
    const base = min != null ? Number(min) : Number(stepBase || 0);
    if (Number.isFinite(stepValue) && stepValue > 0) {
      const remainder = (numericValue - base) / stepValue;
      if (Math.abs(remainder - Math.round(remainder)) > 1e-8) return `Ingresá un valor en incrementos de ${step}.`;
    }
  }
  return "";
}

export function Input({ label, ref: forwardedRef, selectOnFocus, numericOnly = false, decimal = false, error, onFocus, onPointerDown, onPointerUp, ...props }) {
  const errorId = React.useId();
  const isNumeric = numericOnly || decimal || props.type === "number" || props.name === "barcode" || ["numeric", "decimal"].includes(props.inputMode);
  const supportsDecimals = decimal || props.inputMode === "decimal" || hasFractionalStep(props.step);
  // Text inputs support selection on mobile Safari. Native number inputs do not expose
  // a selectable text range, which makes replacing a quantity unnecessarily awkward.
  const effectiveType = isNumeric && props.type === "number" ? "text" : decimal ? "text" : props.type;
  const inputMode = props.inputMode || (props.name === "barcode" ? "numeric" : isNumeric ? (supportsDecimals ? "decimal" : "numeric") : undefined);
  const shouldSelect = selectOnFocus ?? isNumeric;
  const selectionHandlers = useSelectAllOnFocus(shouldSelect && !["file", "checkbox", "radio", "date", "datetime-local", "time", "month", "week", "range", "color"].includes(effectiveType));
  const numericInputRef = React.useRef(null);
  const setInputRef = React.useCallback((target) => {
    numericInputRef.current = target;
    if (typeof forwardedRef === "function") forwardedRef(target);
    else if (forwardedRef) forwardedRef.current = target;
  }, [forwardedRef]);
  const numericStepBase = props.min ?? props.defaultValue ?? props.value ?? 0;
  const updateNumericValidity = (target) => {
    if (!isNumeric || effectiveType !== "text") return;
    target.setCustomValidity(numericInputValidityMessage(target.value, {
      min: props.min,
      max: props.max,
      step: props.step,
      supportsDecimals,
      stepBase: numericStepBase,
    }));
  };
  React.useEffect(() => {
    if (numericInputRef.current) updateNumericValidity(numericInputRef.current);
  }, [isNumeric, effectiveType, props.min, props.max, props.step, props.value, props.defaultValue, supportsDecimals]);
  const selectValue = (event) => {
    onFocus?.(event);
    selectionHandlers.onFocus(event);
  };
  const blockNonNumericKeys = (event) => {
    if (isNumeric && ["e", "E"].includes(event.key)) event.preventDefault();
    props.onKeyDown?.(event);
  };
  const cleanNumericInput = (event) => {
    if (isNumeric && supportsDecimals) {
      event.currentTarget.value = normalizeDecimalInput(event.currentTarget.value);
    }
    updateNumericValidity(event.currentTarget);
    props.onInput?.(event);
  };
  return <label className="field"><span>{label}</span><input {...props} ref={setInputRef} aria-label={props["aria-label"] || label} aria-describedby={[props["aria-describedby"], error ? errorId : null].filter(Boolean).join(" ") || undefined} aria-invalid={Boolean(error)} type={effectiveType} inputMode={inputMode} onFocus={selectValue} onPointerDown={(event) => { selectionHandlers.onPointerDown(event); onPointerDown?.(event); }} onPointerUp={(event) => { selectionHandlers.onPointerUp(event); onPointerUp?.(event); }} onKeyDown={blockNonNumericKeys} onInput={cleanNumericInput} />{error && <span id={errorId} className="form-error" role="alert">{error}</span>}</label>;
}

export function Select({ label, options, error, ...props }) {
  return <label className="field"><span>{label}</span><select {...props} aria-label={props["aria-label"] || label} aria-invalid={Boolean(error)}>{options.map((option) => {
    const value = typeof option === "string" ? option : option.value;
    const optionLabel = typeof option === "string" ? option : option.label;
    return <option key={value} value={value}>{optionLabel}</option>;
  })}</select>{error && <span className="form-error" role="alert">{error}</span>}</label>;
}
