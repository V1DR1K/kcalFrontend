import { useCallback, useEffect, useRef, useState } from "react";
import { DEFAULT_MEALS } from "../../../config/app";
import { shiftDate, today } from "../../../utils/format";

export function useDashboardData(api) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [mealTypes, setMealTypes] = useState(DEFAULT_MEALS);
  const [dayPresets, setDayPresets] = useState([]);
  const [selectedDate, setSelectedDate] = useState(today());
  const [dateChanging, setDateChanging] = useState(false);
  const [yesterdayData, setYesterdayData] = useState(null);
  const requestSequence = useRef(0);

  const load = useCallback((date = selectedDate) => {
    const sequence = requestSequence.current + 1;
    requestSequence.current = sequence;
    if (!data) setLoading(true);
    setError("");
    return api.request(`/api/nutrition/dashboard?date=${date}`)
      .then((result) => {
        if (sequence === requestSequence.current) setData(result);
        return result;
      })
      .catch(() => {
        if (sequence !== requestSequence.current) return;
        setError("No pudimos cargar tu día.");
        api.notify("No se pudo cargar el dashboard.", "error");
      })
      .finally(() => {
        if (sequence === requestSequence.current) {
          setLoading(false);
          setDateChanging(false);
        }
      });
  }, [api, data, selectedDate]);

  const changeDate = useCallback((nextDate) => {
    if (nextDate === selectedDate) return;
    setDateChanging(true);
    setSelectedDate(nextDate);
  }, [selectedDate]);

  useEffect(() => {
    load(selectedDate);
  }, [api, selectedDate]);

  useEffect(() => {
    api.request("/api/nutrition/meal-types")
      .then(setMealTypes)
      .catch(() => setMealTypes(DEFAULT_MEALS));
  }, [api]);

  useEffect(() => {
    const refreshPlan = () => load(selectedDate);
    window.addEventListener("scalegrams:plan-updated", refreshPlan);
    return () => window.removeEventListener("scalegrams:plan-updated", refreshPlan);
  }, [load, selectedDate]);

  const loadDayPresets = useCallback(() => api.request("/api/nutrition/day-presets")
    .then(setDayPresets)
    .catch(() => setDayPresets([])), [api]);

  useEffect(() => { loadDayPresets(); }, [loadDayPresets]);

  useEffect(() => {
    let active = true;
    setYesterdayData(null);
    const loadYesterday = () => api.request(`/api/nutrition/dashboard?date=${shiftDate(selectedDate, -1)}`)
      .then((result) => active && setYesterdayData(result))
      .catch(() => active && setYesterdayData(null));
    const schedule = window.requestIdleCallback || ((callback) => window.setTimeout(callback, 1500));
    const cancel = window.cancelIdleCallback || window.clearTimeout;
    const handle = schedule(loadYesterday);
    return () => {
      active = false;
      cancel(handle);
    };
  }, [api, selectedDate]);

  return {
    data,
    setData,
    loading,
    error,
    mealTypes,
    dayPresets,
    setDayPresets,
    selectedDate,
    dateChanging,
    yesterdayData,
    load,
    loadDayPresets,
    changeDate,
  };
}
