import { useCallback, useEffect, useRef, useState } from "react";

const SWIPE_ACTION_WIDTH = 84;
const LONG_PRESS_DURATION = 500;
const LONG_PRESS_MOVE_TOLERANCE = 18;
const AUTO_SCROLL_EDGE_SIZE = 76;
const AUTO_SCROLL_MAX_STEP = 14;

function clearDropTargets() {
  document.querySelectorAll(".meal-card.drag-over").forEach((card) => card.classList.remove("drag-over"));
}

function targetMealTypeAt(clientX, clientY) {
  clearDropTargets();
  const target = document.elementFromPoint(clientX, clientY)?.closest(".meal-card[data-meal-type]");
  target?.classList.add("drag-over");
  return target?.dataset.mealType || null;
}

export function useMealGesture({ disabled = false, dragData, resetSignal, expanded = false, onMove }) {
  const gestureRef = useRef(null);
  const holdTimerRef = useRef(null);
  const shellRef = useRef(null);
  const offsetRef = useRef(0);
  const suppressClickRef = useRef(false);
  const autoScrollFrameRef = useRef(null);
  const autoScrollDirectionRef = useRef(0);
  const dragPointerRef = useRef(null);
  const [offset, setOffset] = useState(0);
  const [revealed, setRevealed] = useState("");
  const [horizontalDragging, setHorizontalDragging] = useState(false);
  const [interactionMode, setInteractionMode] = useState("idle");
  const [dragPosition, setDragPosition] = useState(null);

  const getScrollTarget = useCallback(() => {
    const content = shellRef.current?.closest(".content");
    if (content && getComputedStyle(content).overflowY !== "visible") return content;
    return window;
  }, []);

  const scrollBy = useCallback((amount) => {
    const target = getScrollTarget();
    if (target === window) window.scrollBy(0, amount);
    else target.scrollTop += amount;
  }, [getScrollTarget]);

  const stopAutoScroll = useCallback(() => {
    autoScrollDirectionRef.current = 0;
    if (autoScrollFrameRef.current !== null) {
      window.cancelAnimationFrame(autoScrollFrameRef.current);
      autoScrollFrameRef.current = null;
    }
  }, []);

  const autoScroll = useCallback(() => {
    const pointer = dragPointerRef.current;
    const direction = autoScrollDirectionRef.current;
    if (!pointer || !direction || gestureRef.current?.mode !== "dragging") {
      autoScrollFrameRef.current = null;
      return;
    }
    const viewportHeight = window.innerHeight;
    const distance = direction < 0 ? pointer.y : viewportHeight - pointer.y;
    const intensity = Math.max(0, Math.min(1, (AUTO_SCROLL_EDGE_SIZE - distance) / AUTO_SCROLL_EDGE_SIZE));
    scrollBy(direction * Math.max(2, Math.round(AUTO_SCROLL_MAX_STEP * intensity)));
    targetMealTypeAt(pointer.x, pointer.y);
    autoScrollFrameRef.current = window.requestAnimationFrame(autoScroll);
  }, [scrollBy]);

  const updateAutoScroll = useCallback((clientY) => {
    const viewportHeight = window.innerHeight;
    const direction = clientY <= AUTO_SCROLL_EDGE_SIZE ? -1 : clientY >= viewportHeight - AUTO_SCROLL_EDGE_SIZE ? 1 : 0;
    autoScrollDirectionRef.current = direction;
    if (direction && autoScrollFrameRef.current === null) {
      autoScrollFrameRef.current = window.requestAnimationFrame(autoScroll);
    }
    if (!direction) stopAutoScroll();
  }, [autoScroll, stopAutoScroll]);

  const setSwipeOffset = useCallback((nextOffset) => {
    offsetRef.current = nextOffset;
    setOffset(nextOffset);
  }, []);

  const close = useCallback(() => {
    const activeGesture = gestureRef.current;
    if (activeGesture && shellRef.current?.hasPointerCapture?.(activeGesture.pointerId)) {
      try { shellRef.current.releasePointerCapture(activeGesture.pointerId); } catch { /* pointer already released */ }
    }
    if (holdTimerRef.current) window.clearTimeout(holdTimerRef.current);
    holdTimerRef.current = null;
    stopAutoScroll();
    dragPointerRef.current = null;
    gestureRef.current = null;
    setHorizontalDragging(false);
    setInteractionMode("idle");
    setDragPosition(null);
    setRevealed("");
    setSwipeOffset(0);
    clearDropTargets();
  }, [setSwipeOffset, stopAutoScroll]);

  const finishSwipe = useCallback(() => {
    const current = gestureRef.current;
    const finalOffset = offsetRef.current;
    if (current?.axis === "x" && finalOffset > SWIPE_ACTION_WIDTH * 0.65) {
      suppressClickRef.current = true;
      setRevealed("edit");
      setSwipeOffset(SWIPE_ACTION_WIDTH);
    } else if (current?.axis === "x" && finalOffset < -SWIPE_ACTION_WIDTH * 0.65) {
      suppressClickRef.current = true;
      setRevealed("delete");
      setSwipeOffset(-SWIPE_ACTION_WIDTH);
    } else {
      if (current?.axis === "x") suppressClickRef.current = true;
      close();
    }
    gestureRef.current = null;
    setHorizontalDragging(false);
    setInteractionMode("idle");
    if (suppressClickRef.current) window.setTimeout(() => { suppressClickRef.current = false; }, 220);
  }, [close, setSwipeOffset]);

  const startLongPress = useCallback(() => {
    if (!gestureRef.current || gestureRef.current.mode !== "holding") return;
    gestureRef.current.mode = "dragging";
    suppressClickRef.current = true;
    setInteractionMode("dragging");
    dragPointerRef.current = { x: gestureRef.current.x, y: gestureRef.current.y };
    setDragPosition({ x: gestureRef.current.x, y: gestureRef.current.y });
  }, []);

  const handlePointerDown = useCallback((event) => {
    if (disabled || !dragData || event.target.closest(".meal-item-detail-actions, .swipe-action")) return;
    if (event.pointerType === "mouse" && event.button !== 0) return;
    try { shellRef.current?.setPointerCapture?.(event.pointerId); } catch { /* pointer capture is unavailable in synthetic environments */ }
    gestureRef.current = {
      pointerId: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      axis: null,
      mode: "holding",
    };
    setInteractionMode("holding");
    holdTimerRef.current = window.setTimeout(startLongPress, LONG_PRESS_DURATION);
  }, [disabled, dragData, startLongPress]);

  const handlePointerMove = useCallback((event) => {
    const current = gestureRef.current;
    if (!current || current.pointerId !== event.pointerId) return;
    if (current.mode === "dragging") {
      if (event.cancelable) event.preventDefault();
      dragPointerRef.current = { x: event.clientX, y: event.clientY };
      setDragPosition({ x: event.clientX, y: event.clientY });
      targetMealTypeAt(event.clientX, event.clientY);
      updateAutoScroll(event.clientY);
      return;
    }
    const dx = event.clientX - current.x;
    const dy = event.clientY - current.y;
    if (!current.axis && Math.max(Math.abs(dx), Math.abs(dy)) > LONG_PRESS_MOVE_TOLERANCE) {
      if (holdTimerRef.current) window.clearTimeout(holdTimerRef.current);
      holdTimerRef.current = null;
      current.axis = Math.abs(dx) > Math.abs(dy) * 1.8 ? "x" : "y";
      current.mode = current.axis === "x" ? "swiping" : "scrolling";
      setInteractionMode(current.mode);
      if (current.axis === "y") {
        setHorizontalDragging(false);
        setSwipeOffset(0);
      }
    }
    if (current.axis === "x") {
      if (event.cancelable) event.preventDefault();
      setHorizontalDragging(true);
      setSwipeOffset(Math.max(-SWIPE_ACTION_WIDTH, Math.min(SWIPE_ACTION_WIDTH, dx)));
    }
  }, [setSwipeOffset, updateAutoScroll]);

  const handlePointerUp = useCallback((event) => {
    const current = gestureRef.current;
    if (!current || current.pointerId !== event.pointerId) return;
    if (current.mode === "dragging") {
      if (event.cancelable) event.preventDefault();
      stopAutoScroll();
      const destination = targetMealTypeAt(event.clientX, event.clientY);
      clearDropTargets();
      onMove?.(dragData, destination);
      close();
      return;
    }
    if (current.axis === "x") {
      finishSwipe();
      return;
    }
    close();
  }, [close, dragData, finishSwipe, onMove, stopAutoScroll]);

  const handlePointerCancel = useCallback((event) => {
    if (!gestureRef.current || gestureRef.current.pointerId !== event.pointerId) return;
    close();
    if (suppressClickRef.current) window.setTimeout(() => { suppressClickRef.current = false; }, 220);
  }, [close]);

  const handleLostPointerCapture = useCallback(() => {
    if (gestureRef.current) close();
  }, [close]);

  const handleClick = useCallback((event) => {
    if (suppressClickRef.current) {
      event.preventDefault();
      event.stopPropagation();
      suppressClickRef.current = false;
      return false;
    }
    return true;
  }, []);

  useEffect(() => close(), [close, resetSignal]);
  useEffect(() => {
    if (expanded && revealed) close();
  }, [close, expanded, revealed]);
  useEffect(() => {
    if (interactionMode !== "dragging") return undefined;
    const preventTouchScroll = (event) => {
      if (event.cancelable) event.preventDefault();
    };
    document.addEventListener("touchmove", preventTouchScroll, { passive: false });
    return () => document.removeEventListener("touchmove", preventTouchScroll);
  }, [interactionMode]);
  useEffect(() => () => close(), [close]);

  return {
    shellRef,
    offset,
    revealed,
    horizontalDragging,
    interactionMode,
    dragPosition,
    close,
    handlePointerDown,
    handlePointerMove,
    handlePointerUp,
    handlePointerCancel,
    handleLostPointerCapture,
    handleClick,
  };
}
