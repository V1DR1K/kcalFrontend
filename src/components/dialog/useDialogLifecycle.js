import { useEffect, useRef } from "react";

const activeDialogStack = [];
let scrollLockDepth = 0;
let previousBodyOverflow = "";
let previousScrollRootOverflow = "";
let lockedScrollRoot = null;
let touchStartY = 0;
const SCROLL_OWNER_SELECTOR = '[data-dialog-scroll-owner="true"]';

function topDialog() {
  return activeDialogStack[activeDialogStack.length - 1];
}

function scrollOwnersFor(target, dialogRef, scrollOwnerRef) {
  const owners = [];
  let element = target?.nodeType === Node.ELEMENT_NODE ? target : target?.parentElement;
  while (element && element !== document.body) {
    if (element.matches?.(SCROLL_OWNER_SELECTOR) || element.matches?.("textarea")) owners.push(element);
    element = element.parentElement;
  }
  if (!owners.length && scrollOwnerRef?.current?.contains(target)) owners.push(scrollOwnerRef.current);
  if (!owners.length && dialogRef.current?.contains(target)) owners.push(dialogRef.current);
  return owners;
}

function canScrollInDirection(owner, delta) {
  if (!owner || owner.scrollHeight <= owner.clientHeight) return false;
  if (delta > 0) return owner.scrollTop < owner.scrollHeight - owner.clientHeight - 1;
  if (delta < 0) return owner.scrollTop > 0;
  return true;
}

function onTouchStart(event) {
  touchStartY = event.touches?.[0]?.clientY || 0;
}

function onTouchMove(event) {
  const dialog = topDialog();
  const touch = event.touches?.[0];
  if (!dialog || !touch) return;
  const target = event.target;
  const owners = scrollOwnersFor(target, dialog.dialogRef, dialog.scrollOwnerRef);
  if (!dialog.dialogRef.current?.contains(target) && !owners.length) {
    event.preventDefault();
    return;
  }

  if (!owners.length) {
    event.preventDefault();
    return;
  }

  const delta = touchStartY - touch.clientY;
  if (!owners.some((owner) => canScrollInDirection(owner, delta))) event.preventDefault();
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

export function useDialogLifecycle({ open = true, onClose, initialFocusRef, closeOnEscape = true, trapFocus = true, restoreFocus = true, lockScroll = true, scrollOwnerRef, footerRef }) {
  const dialogRef = useRef(null);
  const previousFocusRef = useRef(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!open) return undefined;
    const dialogToken = { dialogRef, scrollOwnerRef };
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
      const dialog = dialogRef.current;
      if (!dialog || !target || !dialog.contains(target)) return;
      window.requestAnimationFrame(() => {
        if (!dialogRef.current?.contains(target)) return;
        const owner = target.closest?.(`${SCROLL_OWNER_SELECTOR}, textarea`) || scrollOwnerRef?.current || dialogRef.current;
        if (!owner) return;
        const targetRect = target.getBoundingClientRect();
        const ownerRect = owner.getBoundingClientRect();
        const footer = footerRef?.current || dialogRef.current?.querySelector(":scope > footer, :scope > .modal-shell-footer");
        const footerRect = footer?.getBoundingClientRect();
        const viewport = window.visualViewport;
        const viewportBottom = viewport ? (viewport.offsetTop || 0) + viewport.height : ownerRect.bottom;
        const ownerBottom = Math.min(ownerRect.bottom, viewportBottom);
        const visibleBottom = footerRect && footerRect.top > ownerRect.top && footerRect.top < ownerBottom ? footerRect.top : ownerBottom;
        const padding = 16;
        if (targetRect.top < ownerRect.top + padding) owner.scrollTop -= ownerRect.top + padding - targetRect.top;
        if (targetRect.bottom > visibleBottom - padding) owner.scrollTop += targetRect.bottom - visibleBottom + padding;
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
    window.visualViewport?.addEventListener("scroll", revealFocusedControl);

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
      window.visualViewport?.removeEventListener("scroll", revealFocusedControl);
      if (restoreFocus && wasTopDialog && previousFocusRef.current?.isConnected) previousFocusRef.current.focus?.();
    };
  }, [closeOnEscape, footerRef, initialFocusRef, lockScroll, open, restoreFocus, scrollOwnerRef, trapFocus]);

  function onBackdropPointerDown(event) {
    if (event.target === event.currentTarget) onCloseRef.current?.();
  }

  return { dialogRef, onBackdropPointerDown };
}
