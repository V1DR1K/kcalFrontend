import { useCallback, useEffect, useRef, useState } from "react";
import { trainingApi } from "./training-api";

const valueOf = (item) => String(item?.id ?? "");

export function useTrainingExercises(api, { module = "ALL", q = "", filters = {}, selectedIds = [], initialItems = [], size = 24, loadAll = false } = {}) {
  const [items, setItems] = useState(() => initialItems.filter(Boolean));
  const [page, setPage] = useState(0);
  const [hasNext, setHasNext] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const cache = useRef(new Map(initialItems.filter(Boolean).map((item) => [valueOf(item), item])));
  const pageIds = useRef(new Set());
  const resolvedIds = useRef(new Set());
  const requestSequence = useRef(0);
  const selectedKey = selectedIds.map(String).filter(Boolean).sort().join(",");
  const filterKey = JSON.stringify(filters);
  const effectiveQuery = loadAll ? "" : q;

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
    const sequence = requestSequence.current + 1;
    requestSequence.current = sequence;
    setLoading(true); setError("");
    try {
      let currentPage = nextPage;
      let response = null;
      const fetched = [];
      do {
        response = await trainingApi.exercises(api, { module, q: effectiveQuery.trim(), ...filters, page: currentPage, size });
        fetched.push(...(response?.items || []));
        currentPage = (response?.page ?? currentPage) + 1;
      } while (loadAll && response?.hasNext && currentPage < 100);
      if (sequence !== requestSequence.current) return;
      if (!append) pageIds.current = new Set(fetched.map(valueOf));
      else fetched.forEach((item) => pageIds.current.add(valueOf(item)));
      merge(fetched, !append);
      setPage(response?.page ?? nextPage);
      setHasNext(loadAll ? false : Boolean(response?.hasNext ?? (response?.page + 1 < response?.totalPages)));
    } catch (requestError) {
      if (sequence === requestSequence.current) setError(requestError?.message || "No se pudo cargar el catálogo de ejercicios.");
    } finally { if (sequence === requestSequence.current) setLoading(false); }
  }, [api, effectiveQuery, filterKey, loadAll, merge, module, size]);

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
