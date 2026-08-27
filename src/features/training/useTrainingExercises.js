import { useCallback, useEffect, useRef, useState } from "react";
import { trainingApi } from "./training-api";

const valueOf = (item) => String(item?.id ?? "");

export function useTrainingExercises(api, { module = "ALL", q = "", filters = {}, selectedIds = [], initialItems = [], size = 24 } = {}) {
  const [items, setItems] = useState(() => initialItems.filter(Boolean));
  const [page, setPage] = useState(0);
  const [hasNext, setHasNext] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const cache = useRef(new Map(initialItems.filter(Boolean).map((item) => [valueOf(item), item])));
  const pageIds = useRef(new Set());
  const resolvedIds = useRef(new Set());
  const selectedKey = selectedIds.map(String).filter(Boolean).sort().join(",");
  const filterKey = JSON.stringify(filters);

  const merge = useCallback((nextItems, replace = false) => {
    nextItems.filter(Boolean).forEach((item) => cache.current.set(valueOf(item), item));
    setItems((current) => {
      const visible = replace ? nextItems : [...current, ...nextItems];
      const unique = new Map(visible.filter(Boolean).map((item) => [valueOf(item), item]));
      selectedIds.forEach((id) => { if (cache.current.has(String(id))) unique.set(String(id), cache.current.get(String(id))); });
      return [...unique.values()];
    });
  }, [selectedKey]);

  const load = useCallback(async (nextPage = 0, append = false) => {
    setLoading(true); setError("");
    try {
      const response = await trainingApi.exercises(api, { module, q: q.trim(), ...filters, page: nextPage, size });
      if (!append) pageIds.current = new Set((response?.items || []).map(valueOf));
      else (response?.items || []).forEach((item) => pageIds.current.add(valueOf(item)));
      merge(response?.items || [], !append);
      setPage(response?.page ?? nextPage);
      setHasNext(Boolean(response?.hasNext ?? (response?.page + 1 < response?.totalPages)));
    } catch (requestError) {
      setError(requestError?.message || "No se pudo cargar el catálogo de ejercicios.");
    } finally { setLoading(false); }
  }, [api, filterKey, merge, module, q, size]);

  useEffect(() => { load(0, false); }, [load]);

  useEffect(() => {
    const missing = selectedIds.map(String).filter((id) => id && !pageIds.current.has(id) && !resolvedIds.current.has(id));
    if (!missing.length) return undefined;
    missing.forEach((id) => resolvedIds.current.add(id));
    let current = true;
    Promise.all(missing.map((id) => trainingApi.exercise(api, id).catch(() => null))).then((resolved) => {
      if (current) merge(resolved.filter(Boolean), false);
    });
    return () => { current = false; };
  }, [api, merge, selectedKey]);

  return { items, loading, error, page, hasNext, reload: () => load(0, false), loadMore: () => hasNext && load(page + 1, true) };
}
