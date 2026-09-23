import React, { useState } from "react";
import { NutritionSummary } from "../../../components/NutritionSummary";
import { Icon } from "../../../components/Icon";
import { FoodEditorDialog } from "../../foods/components/FoodEditorDialog";
import { usePagedCatalog } from "../usePagedCatalog";
import { CatalogStatus, categoryLabel, CookedYieldHint, FoodThumb, PreparationBadge } from "../CatalogComponents";

export function AdminFoodCatalog({ api }) {
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState(null);
  const [loadingEditId, setLoadingEditId] = useState(null);
  const catalog = usePagedCatalog({ api, endpoint: "/api/foods", query, pageSize: 20 });

  async function edit(item) {
    if (loadingEditId != null) return;
    setLoadingEditId(item.id);
    try {
      setEditing(await api.request(`/api/foods/${item.id}`));
    } catch (error) {
      api.notify(error.message || "No se pudo abrir la ficha del alimento.", "error");
    } finally {
      setLoadingEditId(null);
    }
  }

  return <section className="admin-food-catalog" aria-labelledby="original-food-catalog-title">
    <div className="my-foods-toolbar"><span id="original-food-catalog-title">Buscá y corregí fichas de todo el catálogo.</span></div>
    <label className="field admin-food-catalog-search">
      <span>Buscar alimento</span>
      <input className="search" type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Ej.: cebolla" autoComplete="off" />
    </label>

    {catalog.initialLoading && !catalog.items.length && <div className="my-foods-loading" aria-busy="true" />}
    {!catalog.initialLoading && catalog.error && <CatalogStatus error>{catalog.error} <button type="button" className="secondary" onClick={catalog.retry}>Reintentar</button></CatalogStatus>}
    {!catalog.initialLoading && !catalog.error && !catalog.items.length && <CatalogStatus>{query.trim().length === 1 ? "Escribí al menos 2 caracteres para buscar." : query.trim() ? "No encontramos alimentos con esa búsqueda." : "No hay alimentos disponibles en el catálogo."}</CatalogStatus>}

    {catalog.items.length > 0 && <div className="my-foods-list">
      {catalog.items.map((item) => <article className="catalog-row catalog-row-image my-food-row admin-food-row" key={item.id}>
        <FoodThumb item={{ ...item, type: "FOOD" }} compact />
        <span className="catalog-copy">
          <strong>{item.name}</strong>
          <span className="catalog-meta"><em className="food-brand-line">{item.brand || categoryLabel(item.category)}</em><PreparationBadge food={item} /><CookedYieldHint food={item} /></span>
          <NutritionSummary nutrition={item} />
        </span>
        <button type="button" className="secondary admin-food-edit" disabled={loadingEditId != null} onClick={() => edit(item)} aria-label={`Editar ${item.name}`}>
          <Icon name="edit" />{loadingEditId === item.id ? "Abriendo…" : "Editar"}
        </button>
      </article>)}
    </div>}

    {catalog.loadingMore && <CatalogStatus>Cargando más alimentos…</CatalogStatus>}
    {!catalog.initialLoading && catalog.hasNext && <button type="button" className="secondary catalog-load-more" disabled={catalog.loadingMore} onClick={catalog.loadNext}>{catalog.loadingMore ? "Cargando…" : "Cargar más"}</button>}
    {editing && <FoodEditorDialog api={api} food={editing} onClose={() => setEditing(null)} onDone={catalog.refresh} />}
  </section>;
}
