import { useCallback, useEffect, useRef, useState } from "react";

const SWIPE_ACTION_WIDTH = 84;
const LONG_PRESS_DURATION = 500;
const LONG_PRESS_MOVE_TOLERANCE = 18;

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
  const [offset, setOffset] = useState(0);
  const [revealed, setRevealed] = useState("");
  const [horizontalDragging, setHorizontalDragging] = useState(false);
  const [interactionMode, setInteractionMode] = useState("idle");
  const [dragPosition, setDragPosition] = useState(null);

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
    gestureRef.current = null;
    setHorizontalDragging(false);
    setInteractionMode("idle");
    setDragPosition(null);
    setRevealed("");
    setSwipeOffset(0);
    clearDropTargets();
  }, [setSwipeOffset]);

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
      setDragPosition({ x: event.clientX, y: event.clientY });
      targetMealTypeAt(event.clientX, event.clientY);
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
  }, [setSwipeOffset]);

  const handlePointerUp = useCallback((event) => {
    const current = gestureRef.current;
    if (!current || current.pointerId !== event.pointerId) return;
    if (current.mode === "dragging") {
      if (event.cancelable) event.preventDefault();
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
  }, [close, dragData, finishSwipe, onMove]);

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
