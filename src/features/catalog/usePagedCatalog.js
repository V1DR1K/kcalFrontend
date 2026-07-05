import { useCallback, useEffect, useRef, useState } from "react";
import { buildCatalogQuery, mergeCatalogItems } from "./pagination";

const initialState = { items: [], page: -1, hasNext: true, initialLoading: true, loadingMore: false, error: "", failedPage: null };

export function usePagedCatalog({ api, endpoint, query = "", category = "", pageSize = 20 }) {
  const [state, setState] = useState(initialState);
  const requestRef = useRef(null);

  const fetchPage = useCallback(async (page, replace) => {
    if (requestRef.current) return;
    const controller = new AbortController();
    requestRef.current = controller;
    setState((current) => ({ ...current, initialLoading: replace, loadingMore: !replace, error: "", failedPage: null }));
    try {
      const params = buildCatalogQuery({ page, pageSize, query, category });
      const data = await api.request(`${endpoint}?${params}`, { signal: controller.signal });
      const incoming = data?.items || [];
      setState((current) => {
        const unique = mergeCatalogItems(current.items, incoming, replace);
        return { items: unique, page: data?.page ?? page, hasNext: data?.hasNext ?? page + 1 < Number(data?.totalPages || 0), initialLoading: false, loadingMore: false, error: "", failedPage: null };
      });
    } catch (error) {
      if (error.name !== "AbortError") setState((current) => ({ ...current, initialLoading: false, loadingMore: false, error: "No se pudo cargar el catalogo.", failedPage: page }));
    } finally {
      if (requestRef.current === controller) requestRef.current = null;
    }
  }, [api, category, endpoint, pageSize, query]);

  useEffect(() => {
    requestRef.current?.abort();
    requestRef.current = null;
    setState(initialState);
    const timer = window.setTimeout(() => fetchPage(0, true), 250);
    return () => { window.clearTimeout(timer); requestRef.current?.abort(); requestRef.current = null; };
  }, [fetchPage]);

  const loadNext = useCallback(() => {
    if (!state.initialLoading && !state.loadingMore && state.hasNext && !requestRef.current) fetchPage(state.page + 1, false);
  }, [fetchPage, state.hasNext, state.initialLoading, state.loadingMore, state.page]);

  return { ...state, loadNext, retry: () => fetchPage(state.failedPage ?? 0, !state.items.length) };
}
