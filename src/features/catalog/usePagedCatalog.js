import { useCallback, useEffect, useRef, useState } from "react";
import { buildCatalogQuery, mergeCatalogItems } from "./pagination";

const initialState = { items: [], page: -1, hasNext: true, initialLoading: true, loadingMore: false, error: "", failedPage: null };

export function usePagedCatalog({ api, endpoint, query = "", category = "", pageSize = 20, enabled = true, debounceMs = 250 }) {
  const [state, setState] = useState(initialState);
  const requestRef = useRef(null);
  const requestIdRef = useRef(0);

  const fetchPage = useCallback(async (page, replace, options = {}) => {
    if (requestRef.current) {
      if (!replace && !options.force) return;
      requestRef.current.abort();
    }
    const controller = new AbortController();
    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;
    requestRef.current = controller;
    setState((current) => ({ ...current, initialLoading: replace, loadingMore: !replace, error: "", failedPage: null }));
    try {
      const params = buildCatalogQuery({ page, pageSize, query, category });
      const data = await api.runAction(
        { title: replace ? "Cargando catálogo" : "Cargando más resultados", description: "Estamos actualizando la lista..." },
        () => api.request(`${endpoint}?${params}`, { signal: controller.signal }),
        { quiet: replace },
      );
      const incoming = Array.isArray(data) ? data : data?.items || [];
      setState((current) => {
        if (requestId !== requestIdRef.current) return current;
        const unique = mergeCatalogItems(current.items, incoming, replace);
        return { items: unique, page: Array.isArray(data) ? 0 : data?.page ?? page, hasNext: Array.isArray(data) ? false : data?.hasNext ?? page + 1 < Number(data?.totalPages || 0), initialLoading: false, loadingMore: false, error: "", failedPage: null };
      });
    } catch (error) {
      if (error.name !== "AbortError" && requestId === requestIdRef.current) {
        setState((current) => ({ ...current, initialLoading: false, loadingMore: false, error: "No se pudo cargar el catálogo.", failedPage: page }));
      }
    } finally {
      if (requestRef.current === controller) requestRef.current = null;
    }
  }, [api, category, endpoint, pageSize, query]);

  useEffect(() => {
    requestRef.current?.abort();
    requestRef.current = null;
    requestIdRef.current += 1;
    setState(initialState);
    if (!enabled) return undefined;
    const timer = window.setTimeout(() => fetchPage(0, true), debounceMs);
    return () => {
      window.clearTimeout(timer);
      requestRef.current?.abort();
      requestRef.current = null;
      requestIdRef.current += 1;
    };
  }, [debounceMs, enabled, fetchPage]);

  const loadNext = useCallback(() => {
    if (enabled && !state.initialLoading && !state.loadingMore && state.hasNext && !requestRef.current) fetchPage(state.page + 1, false);
  }, [enabled, fetchPage, state.hasNext, state.initialLoading, state.loadingMore, state.page]);

  const removeItem = useCallback((id) => {
    setState((current) => ({ ...current, items: current.items.filter((item) => item.id !== id) }));
  }, []);

  const refresh = useCallback(() => fetchPage(0, true, { force: true }), [fetchPage]);

  return {
    ...state,
    initialLoading: enabled && state.initialLoading,
    hasNext: enabled && state.hasNext,
    loadNext,
    removeItem,
    refresh,
    retry: () => enabled && fetchPage(state.failedPage ?? 0, !state.items.length, { force: true }),
  };
}
