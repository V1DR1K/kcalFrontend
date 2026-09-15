import React, { useCallback, useEffect, useState } from "react";
import { Icon } from "../../../components/Icon";
import { Panel } from "../../../components/Layout";
import { CatalogStatus, categoryLabel, CookedYieldHint, FoodThumb, PreparationBadge } from "../CatalogComponents";
import { NutritionSummary } from "../../../components/NutritionSummary";
import { FoodEditorDialog } from "../../foods/components/FoodEditorDialog";

export function MyFoods({ api, onDirtyChange, onCreateFood, embedded = false }) {
  const [items, setItems] = useState([]);
  const [deletedItems, setDeletedItems] = useState([]);
  const [editing, setEditing] = useState(null);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState(null);
  const [restoringId, setRestoringId] = useState(null);
  const [menuId, setMenuId] = useState(null);
  useEffect(() => {
    if (menuId == null) return undefined;
    function closeOnOutside(event) {
      if (!event.target.closest(`[data-food-menu="${menuId}"]`)) setMenuId(null);
    }
    function closeOnEscape(event) {
      if (event.key === "Escape") setMenuId(null);
    }
    document.addEventListener("pointerdown", closeOnOutside);
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutside);
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [menuId]);
  const load = useCallback(() => {
    setLoading(true);
    return api
      .runAction(
        { title: "Cargando tus alimentos", description: "Estamos preparando tu catálogo personal..." },
        async () => {
          const [active, deleted] = await Promise.all([
            api.request("/api/foods/mine"),
            api.request("/api/foods/mine/deleted"),
          ]);
          return { active, deleted };
        },
      )
      .then(({ active, deleted }) => {
        setItems(active);
        setDeletedItems(deleted);
      })
      .catch((error) => api.notify(error.message || "No se pudieron cargar tus alimentos.", "error"))
      .finally(() => setLoading(false));
  }, [api]);
  useEffect(() => {
    load();
  }, [load]);
  async function remove(item) {
    if (deletingId) return;
    const confirmed = await api.confirm({
      title: "¿Borrar alimento?",
      description: `${item.name} dejará de aparecer en tus búsquedas y selecciones nuevas.`,
      confirmLabel: "Borrar alimento",
    });
    if (!confirmed) return;
    setDeletingId(item.id);
    setMenuId(null);
    try {
      await api.runAction(
        { title: "Borrando alimento", description: "Estamos ocultando el alimento de tu catálogo..." },
        () => api.request(`/api/foods/${item.id}`, { method: "DELETE" }),
        { quiet: true },
      );
      await load();
      api.notify("Alimento borrado.");
    } catch (error) {
      api.notify(error.message || "No se pudo borrar el alimento.", "error");
    } finally {
      setDeletingId(null);
    }
  }
  async function restore(item) {
    if (restoringId) return;
    setRestoringId(item.id);
    try {
      await api.runAction(
        { title: "Reactivando alimento", description: "Estamos devolviendo el alimento a tu catálogo..." },
        () => api.request(`/api/foods/${item.id}/restore`, { method: "POST" }),
        { quiet: true },
      );
      await load();
      api.notify("Alimento reactivado.");
    } catch (error) {
      api.notify(error.message || "No se pudo reactivar el alimento.", "error");
    } finally {
      setRestoringId(null);
    }
  }
  if (loading)
    return (
      <Panel title={embedded ? null : "Alimentos"} className={`my-foods-panel ${embedded ? "my-foods-embedded" : ""}`}>
        <div className="my-foods-loading" aria-busy="true" />
      </Panel>
    );
  return (
      <Panel title={embedded ? null : "Alimentos"} className={`my-foods-panel ${embedded ? "my-foods-embedded" : ""}`}>
      {onCreateFood && <div className="my-foods-toolbar">
        <span>Alimentos de tu catálogo personal</span>
        <button type="button" className="primary" onClick={onCreateFood}><Icon name="add" />Crear alimento</button>
      </div>}
      {!items.length ? (
        <p className="empty-state">{deletedItems.length ? "No tenés alimentos activos." : "Todavía no creaste alimentos."}</p>
      ) : (
        <div className="my-foods-list">
          {items.map((item) => (
            <article className="catalog-row catalog-row-image my-food-row" key={item.id}>
              <FoodThumb item={{ ...item, type: "FOOD" }} compact />
              <span className="catalog-copy">
                <strong>{item.name}</strong>
                <span className="catalog-meta">
                   <em className="food-brand-line">{item.brand || categoryLabel(item.category)}</em>
                   <PreparationBadge food={item} />
                   <CookedYieldHint food={item} />
                </span>
                <NutritionSummary nutrition={item} />
              </span>
              <div className="food-card-menu" data-food-menu={item.id}>
                <button type="button" className="icon-button food-card-menu-trigger" aria-label={`Acciones para ${item.name}`} aria-expanded={menuId === item.id} disabled={deletingId === item.id} onClick={() => setMenuId((current) => current === item.id ? null : item.id)}>
                  <Icon name="more_vert" />
                </button>
                {menuId === item.id && (
                  <div className="food-card-menu-popover" role="menu">
                    <button type="button" role="menuitem" onClick={() => { setMenuId(null); setEditing(item); }}><Icon name="edit" />Editar alimento</button>
                    <button type="button" role="menuitem" className="danger" onClick={() => remove(item)}><Icon name="delete" />Borrar alimento</button>
                  </div>
                )}
              </div>
            </article>
          ))}
        </div>
      )}
      {deletedItems.length > 0 && (
        <section className="deleted-foods-section" aria-labelledby="deleted-foods-title">
          <div className="deleted-foods-heading">
            <h3 id="deleted-foods-title">Alimentos eliminados</h3>
            <p>Estos alimentos no aparecen en búsquedas ni selecciones nuevas. Podés reactivarlos cuando quieras.</p>
          </div>
          <div className="my-foods-list">
            {deletedItems.map((item) => (
              <article className="catalog-row catalog-row-image my-food-row my-food-row-deleted" key={item.id}>
                <FoodThumb item={{ ...item, type: "FOOD" }} compact />
                <span className="catalog-copy">
                  <strong>{item.name}</strong>
                  <span className="catalog-meta">
                     <em className="food-brand-line">{item.brand || categoryLabel(item.category)}</em>
                     <PreparationBadge food={item} />
                     <CookedYieldHint food={item} />
                  </span>
                  <NutritionSummary nutrition={item} />
                </span>
                <button type="button" className="secondary restore-food-button" disabled={restoringId === item.id} onClick={() => restore(item)}>
                  <Icon name="restore" />
                  {restoringId === item.id ? "Reactivando…" : "Reactivar"}
                </button>
              </article>
            ))}
          </div>
        </section>
      )}
       {editing && <FoodEditorDialog api={api} food={editing} onClose={() => setEditing(null)} onDone={load} />}
    </Panel>
  );
}
