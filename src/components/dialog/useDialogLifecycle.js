import { useEffect, useRef } from "react";

const activeDialogStack = [];
let scrollLockDepth = 0;
let previousBodyOverflow = "";
let previousScrollRootOverflow = "";
let lockedScrollRoot = null;

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
    if (lockScroll) {
      if (scrollLockDepth === 0) previousBodyOverflow = document.body.style.overflow;
      if (scrollLockDepth === 0) {
        lockedScrollRoot = document.querySelector('[data-app-scroll-root="true"]');
        previousScrollRootOverflow = lockedScrollRoot?.style.overflow || "";
        if (lockedScrollRoot) lockedScrollRoot.style.overflow = "hidden";
      }
      scrollLockDepth += 1;
      document.body.style.overflow = "hidden";
    }

    function revealFocusedControl() {
      const target = document.activeElement;
      if (!dialogRef.current?.contains(target)) return;
      window.requestAnimationFrame(() => target.scrollIntoView?.({ block: "nearest", inline: "nearest" }));
    }

    const focusTarget = initialFocusRef?.current || dialogRef.current?.querySelector(FOCUSABLE_SELECTOR);
    try {
      focusTarget?.focus?.({ preventScroll: true });
    } catch {
      focusTarget?.focus?.();
    }
    dialogRef.current?.addEventListener("focusin", revealFocusedControl);
    window.visualViewport?.addEventListener("resize", revealFocusedControl);

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
      const wasTopDialog = activeDialogStack[activeDialogStack.length - 1] === dialogToken;
      const tokenIndex = activeDialogStack.indexOf(dialogToken);
      if (tokenIndex >= 0) activeDialogStack.splice(tokenIndex, 1);
      if (lockScroll) {
        scrollLockDepth = Math.max(0, scrollLockDepth - 1);
        if (scrollLockDepth === 0) {
          document.body.style.overflow = previousBodyOverflow;
          if (lockedScrollRoot?.isConnected) lockedScrollRoot.style.overflow = previousScrollRootOverflow;
          lockedScrollRoot = null;
          previousScrollRootOverflow = "";
        }
      }
      window.removeEventListener("keydown", onKeyDown);
      dialogRef.current?.removeEventListener("focusin", revealFocusedControl);
      window.visualViewport?.removeEventListener("resize", revealFocusedControl);
      if (restoreFocus && wasTopDialog && previousFocusRef.current?.isConnected) previousFocusRef.current.focus?.();
    };
  }, [closeOnEscape, initialFocusRef, lockScroll, open, restoreFocus, trapFocus]);

  function onBackdropPointerDown(event) {
    if (event.target === event.currentTarget) onCloseRef.current?.();
  }

  return { dialogRef, onBackdropPointerDown };
}
