import { useEffect, useRef } from "react";

const activeDialogStack = [];

const FOCUSABLE_SELECTOR = [
  "button:not([disabled])",
  "[href]",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "[tabindex]:not([tabindex=\"-1\"])",
].join(",");

export function useDialogLifecycle({ open = true, onClose, initialFocusRef, closeOnEscape = true, trapFocus = true, restoreFocus = true, lockScroll = true }) {
  const dialogRef = useRef(null);
  const previousFocusRef = useRef(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!open) return undefined;
    const dialogToken = {};
    activeDialogStack.push(dialogToken);
    previousFocusRef.current = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    if (lockScroll) document.body.style.overflow = "hidden";

    const focusTarget = initialFocusRef?.current || dialogRef.current?.querySelector(FOCUSABLE_SELECTOR);
    focusTarget?.focus?.();

    function onKeyDown(event) {
      if (activeDialogStack[activeDialogStack.length - 1] !== dialogToken) return;
      if (closeOnEscape && event.key === "Escape") {
        event.preventDefault();
        onCloseRef.current?.();
        return;
      }
      if (!trapFocus || event.key !== "Tab" || !dialogRef.current) return;
      const focusable = [...dialogRef.current.querySelectorAll(FOCUSABLE_SELECTOR)].filter((element) => !element.closest("[hidden]"));
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => {
      const tokenIndex = activeDialogStack.indexOf(dialogToken);
      if (tokenIndex >= 0) activeDialogStack.splice(tokenIndex, 1);
      if (lockScroll) document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
      if (restoreFocus) previousFocusRef.current?.focus?.();
    };
  }, [closeOnEscape, initialFocusRef, lockScroll, open, restoreFocus, trapFocus]);

  function onBackdropPointerDown(event) {
    if (event.target === event.currentTarget) onCloseRef.current?.();
  }

  return { dialogRef, onBackdropPointerDown };
}
