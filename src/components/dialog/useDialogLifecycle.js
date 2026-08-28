import { useEffect, useRef } from "react";

const activeDialogStack = [];
let scrollLockDepth = 0;
let previousBodyOverflow = "";
let previousScrollRootOverflow = "";
let lockedScrollRoot = null;
let touchStartY = 0;
const SCROLL_OWNER_SELECTOR = '[data-dialog-scroll-owner="true"], .history-preview-scroll, .nutrient-editor-fields, .app-modal-surface.date-picker-dialog, .app-modal-surface.history-export-dialog';

function topDialog() {
  return activeDialogStack[activeDialogStack.length - 1];
}

function onTouchStart(event) {
  touchStartY = event.touches?.[0]?.clientY || 0;
}

function onTouchMove(event) {
  const dialog = topDialog();
  const touch = event.touches?.[0];
  if (!dialog || !touch) return;
  const target = event.target;
  const owner = target.closest?.(SCROLL_OWNER_SELECTOR);
  if (!dialog.dialogRef.current?.contains(target) && !owner) {
    event.preventDefault();
    return;
  }

  if (!owner) {
    event.preventDefault();
    return;
  }

  const delta = touchStartY - touch.clientY;
  const atTop = owner.scrollTop <= 0;
  const atBottom = owner.scrollTop + owner.clientHeight >= owner.scrollHeight - 1;
  if (!owner.scrollHeight || (atTop && delta < 0) || (atBottom && delta > 0)) event.preventDefault();
}

function setTouchLock(locked) {
  if (locked) {
    document.addEventListener("touchstart", onTouchStart, { passive: true, capture: true });
    document.addEventListener("touchmove", onTouchMove, { passive: false, capture: true });
  } else {
    document.removeEventListener("touchstart", onTouchStart, true);
    document.removeEventListener("touchmove", onTouchMove, true);
  }
}

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
    const dialogToken = { dialogRef };
    activeDialogStack.push(dialogToken);
    previousFocusRef.current = document.activeElement;
    if (lockScroll) {
      if (scrollLockDepth === 0) previousBodyOverflow = document.body.style.overflow;
      if (scrollLockDepth === 0) {
        lockedScrollRoot = document.querySelector('[data-app-scroll-root="true"]');
        previousScrollRootOverflow = lockedScrollRoot?.style.overflow || "";
        if (lockedScrollRoot) lockedScrollRoot.style.overflow = "hidden";
        setTouchLock(true);
      }
      scrollLockDepth += 1;
      document.body.style.overflow = "hidden";
    }

    function revealFocusedControl() {
      const target = document.activeElement;
      if (!dialogRef.current?.contains(target)) return;
      window.requestAnimationFrame(() => {
        const owner = target.closest?.(SCROLL_OWNER_SELECTOR) || dialogRef.current;
        const targetRect = target.getBoundingClientRect();
        const ownerRect = owner.getBoundingClientRect();
        const padding = 16;
        if (targetRect.top < ownerRect.top + padding) owner.scrollTop -= ownerRect.top + padding - targetRect.top;
        if (targetRect.bottom > ownerRect.bottom - padding) owner.scrollTop += targetRect.bottom - ownerRect.bottom + padding;
      });
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
          setTouchLock(false);
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
