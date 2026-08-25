import React, { useCallback, useEffect, useRef, useState } from "react";
import { CATEGORY_OPTIONS } from "../../../config/app";
import { Icon } from "../../../components/Icon";
import { Input, Select } from "../../../components/FormControls";
import { Panel } from "../../../components/Layout";
import { CatalogStatus, categoryLabel } from "../CatalogComponents";
import { DerivedCaloriesHint } from "./OcrNutritionPreview";
import { ModalShell } from "../../../components/dialog/ModalShell";

export function MyFoods({ api, onDirtyChange }) {
  const [items, setItems] = useState([]);
  const [deletedItems, setDeletedItems] = useState([]);
  const [editing, setEditing] = useState(null);
  const editCloseRef = useRef(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
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
  async function save(event) {
    event.preventDefault();
    if (saving) return;
    setSaving(true);
    const data = Object.fromEntries(new FormData(event.currentTarget));
    try {
      await api.runAction(
        { title: "Guardando alimento", description: "Estamos actualizando los datos del catálogo..." },
         () => api.request(`/api/foods/${editing.id}`, { method: "PUT", body: JSON.stringify({ name: data.name, brand: data.brand, barcode: data.barcode, category: data.category, baseUnit: editing.baseUnit || "GRAM", baseQuantity: Number(data.baseQuantity), proteinGrams: Number(data.proteinGrams), carbsGrams: Number(data.carbsGrams), fatGrams: Number(data.fatGrams), preparation: editing.preparation || "UNSPECIFIED", servingName: editing.servingName || null, servingWeightGrams: editing.servingWeightGrams || null, tags: editing.tags || [] }) }, { quiet: true }),
      );
      api.notify("Alimento actualizado.");
      setEditing(null);
      onDirtyChange?.(false);
      await load();
    } catch (error) {
      api.notify(error.message || "No se pudo actualizar.", "error");
    } finally {
      setSaving(false);
    }
  }
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
      <Panel title="Mis alimentos">
        <div className="my-foods-loading" aria-busy="true" />
      </Panel>
    );
  return (
    <Panel title="Mis alimentos" className="my-foods-panel">
      {!items.length ? (
        <p className="empty-state">{deletedItems.length ? "No tenés alimentos activos." : "Todavía no creaste alimentos."}</p>
      ) : (
        <div className="my-foods-list">
          {items.map((item) => (
            <article className="my-food-row" key={item.id}>
              <span>
                <strong>{item.name}</strong>
                <small>{item.brand || categoryLabel(item.category)}</small>
              </span>
              <span>{item.calories} kcal</span>
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
              <article className="my-food-row my-food-row-deleted" key={item.id}>
                <span>
                  <strong>{item.name}</strong>
                  <small>{item.brand || categoryLabel(item.category)}</small>
                </span>
                <span>{item.calories} kcal</span>
                <button type="button" className="secondary restore-food-button" disabled={restoringId === item.id} onClick={() => restore(item)}>
                  <Icon name="restore" />
                  {restoringId === item.id ? "Reactivando…" : "Reactivar"}
                </button>
              </article>
            ))}
          </div>
        </section>
      )}
       {editing && (
         <ModalShell
           as="form"
           onClose={() => setEditing(null)}
           initialFocusRef={editCloseRef}
           className="app-modal-compact edit-food-sheet"
           backdropClassName="edit-food-backdrop"
           hideHeader
           wrapContent={false}
           labelledBy="edit-food-title"
           dialogProps={{ onInput: () => onDirtyChange?.(true), onSubmit: save }}
         >
            <header>
              <div>
                <span>Editar alimento</span>
                <h2 id="edit-food-title">{editing.name}</h2>
              </div>
              <button ref={editCloseRef} type="button" className="icon-button" aria-label="Cerrar" onClick={() => setEditing(null)}>
                <Icon name="close" />
              </button>
            </header>
            <div className="edit-food-fields" data-dialog-scroll-owner="true">
              <Input name="name" label="Nombre" defaultValue={editing.name} required />
              <Input name="brand" label="Marca" defaultValue={editing.brand || ""} />
              <Input name="barcode" label="Código de barras" defaultValue={editing.barcode || ""} />
              <Select name="category" label="Categoría" defaultValue={editing.category} options={CATEGORY_OPTIONS} />
              <Input name="baseQuantity" label="Estos valores corresponden a (gramos)" type="number" min="0.1" step="0.1" defaultValue={editing.baseQuantity || 100} required />
              <div className="split">
                <Input name="proteinGrams" label="Proteínas g" type="number" min="0" step="0.1" defaultValue={editing.proteinGrams} required />
                <Input name="carbsGrams" label="Carbohidratos g" type="number" min="0" step="0.1" defaultValue={editing.carbsGrams} required />
              </div>
              <div className="split">
                <Input name="fatGrams" label="Grasas g" type="number" min="0" step="0.1" defaultValue={editing.fatGrams} required />
                <DerivedCaloriesHint values={editing} />
              </div>
            </div>
            <footer className="edit-food-actions">
              <button className="primary" disabled={saving}>
                {saving ? "Guardando…" : "Guardar cambios"}
              </button>
            </footer>
         </ModalShell>
       )}
    </Panel>
  );
}
