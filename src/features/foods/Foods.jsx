import React, { useCallback, useEffect, useState } from "react";
import { InfiniteSentinel } from "../../components/InfiniteSentinel";
import { Input, Select } from "../../components/FormControls";
import { Header } from "../../components/Layout";
import { CatalogCard, CatalogStatus, CategoryChips, groupFoodVariants } from "../catalog/CatalogComponents";
import { QuickItems } from "../dashboard/Dashboard";
import { usePagedCatalog } from "../catalog/usePagedCatalog";
import { readRecents } from "../../services/recents";

export function Foods({ api, user, setPage, setSelectedFoodId }) {
  const [tab, setTab] = useState("FOOD");
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("");
  const catalog = usePagedCatalog({
    api,
    endpoint: tab === "FOOD" ? "/api/foods" : "/api/recipes",
    query,
    category: tab === "FOOD" ? category : "",
  });
  return (
    <section className="page">
      <Header
        title="Alimentos"
        action={
          <div className="header-actions">
            <button className="secondary" onClick={() => setPage("create")}>
              Crear
            </button>
            <button className="primary pill" onClick={() => setPage("scanner")}>
              <span className="material-symbols-outlined">barcode_scanner</span>
              Escanear
            </button>
          </div>
        }
      />
      <div className="tabs">
        <button className={tab === "FOOD" ? "selected" : ""} onClick={() => setTab("FOOD")}>
          Alimentos
        </button>
        <button className={tab === "RECIPE" ? "selected" : ""} onClick={() => setTab("RECIPE")}>
          Recetas
        </button>
      </div>
      <div className="search-wrap">
        <span className="material-symbols-outlined">search</span>
        <input className="search" placeholder="Buscar..." value={query} onChange={(event) => setQuery(event.target.value)} />
      </div>
      {tab === "FOOD" && <CategoryChips category={category} setCategory={setCategory} />}
      <QuickItems
        title="Accesos rapidos"
        items={groupFoodVariants(readRecents(user).items.filter((item) => item.type === tab))}
        onPick={(item) => {
          if (item.type === "FOOD") {
            setSelectedFoodId(item.id);
            setPage("configure");
          }
        }}
      />
      <div className="food-grid">
        {groupFoodVariants(catalog.items).map((item) => (
          <CatalogCard
            key={`${tab}:${item.preparationGroup || item.id}`}
            item={{ ...item, type: tab }}
            onAdd={() => {
              if (tab === "FOOD") {
                setSelectedFoodId(item.id);
                setPage("configure");
              }
            }}
          />
        ))}
      </div>
      {catalog.initialLoading && <CatalogStatus>Buscando alimentos…</CatalogStatus>}
      {!catalog.initialLoading && catalog.error && (
        <CatalogStatus error>
          {catalog.error}
          <button className="secondary" onClick={catalog.retry}>
            Reintentar
          </button>
        </CatalogStatus>
      )}
      {!catalog.initialLoading && !catalog.error && !catalog.items.length && <CatalogStatus>No encontramos resultados.</CatalogStatus>}
      {catalog.loadingMore && <CatalogStatus>Cargando más…</CatalogStatus>}
      {!catalog.initialLoading && !catalog.error && catalog.items.length > 0 && !catalog.hasNext && <CatalogStatus>Viste todos los resultados.</CatalogStatus>}
      <InfiniteSentinel enabled={catalog.hasNext && !catalog.initialLoading && !catalog.loadingMore && !catalog.error} onLoad={catalog.loadNext} />
    </section>
  );
}

export function EditFoodLog({ api, log, mealTypes, onClose, onDone }) {
  const [quantity, setQuantity] = useState(String(log.quantity));
  const [mealType, setMealType] = useState(log.mealType);
  const [saving, setSaving] = useState(false);
  const [closing, setClosing] = useState(false);
  const item = log.itemType === "RECIPE" ? log.recipe : log.food;
  const closeWithAnimation = useCallback(() => {
    if (closing || saving) return;
    setClosing(true);
    window.setTimeout(onClose, 180);
  }, [closing, onClose, saving]);
  useEffect(() => {
    const closeOnEscape = (event) => {
      if (event.key === "Escape") closeWithAnimation();
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [closeWithAnimation]);
  async function submit(event) {
    event.preventDefault();
    const numericQuantity = Number(quantity);
    if (!Number.isFinite(numericQuantity) || numericQuantity <= 0 || saving) return;
    setSaving(true);
    try {
      await api.request(`/api/nutrition/food-logs/${log.id}`, {
        method: "PUT",
        body: JSON.stringify({
          mealType,
          quantity: numericQuantity,
          unit: log.unit || "GRAM",
          logDate: log.logDate,
        }),
      });
      api.notify("Registro actualizado.");
      setClosing(true);
      window.setTimeout(onDone, 180);
    } catch {
      api.notify("No se pudo actualizar el registro.", "error");
      setSaving(false);
    }
  }
  return (
    <div className={`modal-backdrop compact-modal ${closing ? "closing" : ""}`} onPointerDown={(event) => { if (event.target === event.currentTarget) closeWithAnimation(); }}>
      <form className="edit-log-modal" role="dialog" aria-modal="true" aria-labelledby="edit-log-title" onPointerDown={(event) => event.stopPropagation()} onSubmit={submit}>
        <header>
          <div>
            <span>Editar registro</span>
            <h2 id="edit-log-title">{item?.name}</h2>
          </div>
          <button type="button" className="icon-button" onClick={closeWithAnimation} aria-label="Cerrar">
            <span className="material-symbols-outlined">close</span>
          </button>
        </header>
        <Input autoFocus selectOnFocus label={log.itemType === "RECIPE" ? "Gramos ingeridos" : "Cantidad en gramos"} type="number" inputMode="decimal" min="0.1" step="0.1" value={quantity} onChange={(event) => setQuantity(event.target.value)} />
        <Select
          label="Comida"
          value={mealType}
          onChange={(event) => setMealType(event.target.value)}
          options={mealTypes.map((meal) => ({
            value: meal.code,
            label: meal.label,
          }))}
        />
        <div className="modal-actions">
          <button type="button" className="secondary" onClick={closeWithAnimation}>
            Cancelar
          </button>
          <button className="primary" disabled={saving || Number(quantity) <= 0}>
            {saving ? "Guardando…" : "Guardar cambios"}
          </button>
        </div>
      </form>
    </div>
  );
}
