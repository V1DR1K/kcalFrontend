import React, { useEffect, useRef, useState } from "react";
import { InfiniteSentinel } from "../../components/InfiniteSentinel";
import { Icon } from "../../components/Icon";
import { Panel } from "../../components/Layout";
import { CatalogStatus, FoodThumb } from "../catalog/CatalogComponents";
import { formatNumber, formatQuantity } from "../../utils/format";
import { usePagedCatalog } from "../catalog/usePagedCatalog";
import { EditRecipeModal } from "../foods/FoodComponents";
import { NutritionCollectionPreview } from "../shared/NutritionCollectionPreview";
import { NutritionSummary } from "../../components/NutritionSummary";
import { SkeletonBlock, SkeletonRows } from "../../components/Loading";
import { cookedRecipeWeight, rawRecipeWeight, recipeYieldPercent } from "../../utils/recipe";
import { RecipeCreateDialog } from "./dialogs/RecipeCreateDialog";

function recipeGroups(recipe) {
  return [{
    id: "ingredients", label: "Ingredientes", icon: "restaurant_menu",
    items: (recipe?.ingredients || []).map((ingredient) => {
      const food = ingredient.food || {};
      const quantity = Number(ingredient.quantity || 0);
      const base = Number(food.baseQuantity || 100);
      const factor = base > 0 ? quantity / base : 1;
      return { ...food, type: "FOOD", name: food.name || "Alimento", quantity, unit: ingredient.unit, calories: Math.round(Number(food.calories || 0) * factor), proteinGrams: Number(food.proteinGrams || 0) * factor, carbsGrams: Number(food.carbsGrams || 0) * factor, fatGrams: Number(food.fatGrams || 0) * factor };
    }),
  }];
}

function recipeStatus(recipe) {
  const raw = rawRecipeWeight(recipe); const cooked = cookedRecipeWeight(recipe);
  return `${recipe?.ingredients?.length || 0} ingredientes · ${formatQuantity(raw)} g crudos${cooked > 0 ? ` · ${formatQuantity(cooked)} g cocidos` : ""}`;
}

function RecipeCard({ recipe, selected, canEdit, loading, onSelect, onEdit, onDelete, onCopy }) {
  return <article className={`collection-library-card ${selected ? "selected" : ""}`}>
    <button type="button" className="collection-library-select" onClick={onSelect} aria-pressed={selected} disabled={loading}>
      <FoodThumb item={{ ...recipe, type: "RECIPE" }} compact />
      <span><strong>{recipe.name}</strong><small>{recipe.description || "Sin descripción"}</small><em>{recipeStatus(recipe)}</em></span>
      <NutritionSummary nutrition={recipe} />
      <Icon name={selected ? "visibility" : "chevron_right"} />
    </button>
    <div className="collection-library-actions">
      {canEdit ? <><button type="button" className="secondary" onClick={onEdit} disabled={loading}><Icon name="edit" />Editar</button><button type="button" className="icon-button danger-text" onClick={onDelete} disabled={loading} aria-label={`Borrar ${recipe.name}`}><Icon name="delete" /></button></> : <button type="button" className="secondary" onClick={onCopy} disabled={loading}><Icon name="content_copy" />Guardar copia</button>}
    </div>
  </article>;
}

function RecipeLibrary({ api, endpoint, canEdit, ownerName, onBack, refreshSignal = 0 }) {
  const [selectedRecipe, setSelectedRecipe] = useState(null); const [editing, setEditing] = useState(null); const [loadingRecipeId, setLoadingRecipeId] = useState(null); const [deletingId, setDeletingId] = useState(null);
  const mobilePreviewRef = useRef(null);
  const catalog = usePagedCatalog({ api, endpoint });
  useEffect(() => { if (refreshSignal > 0) catalog.refresh(); }, [catalog.refresh, refreshSignal]);
  useEffect(() => {
    if (!selectedRecipe) return;
    const frame = window.requestAnimationFrame(() => {
      const previewElement = mobilePreviewRef.current;
      if (!previewElement || window.matchMedia?.("(min-width: 761px)").matches) return;
      previewElement.scrollIntoView({ behavior: window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "start" });
      previewElement.querySelector("h2")?.focus({ preventScroll: true });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [selectedRecipe]);
  async function openRecipe(recipe) { setLoadingRecipeId(recipe.id); try { setSelectedRecipe(await api.request(`/api/recipes/${recipe.id}`)); } catch (error) { api.notify(error.message || "No se pudo cargar la receta.", "error"); } finally { setLoadingRecipeId(null); } }
  async function edit(recipe) { setLoadingRecipeId(recipe.id); try { setEditing({ ...(await api.request(`/api/recipes/${recipe.id}`)), type: "RECIPE" }); } catch (error) { api.notify(error.message || "No se pudo cargar la receta.", "error"); } finally { setLoadingRecipeId(null); } }
  async function remove(recipe) { if (deletingId) return; if (!(await api.confirm({ title: "¿Borrar receta?", description: `${recipe.name} se eliminará de tus recetas.`, confirmLabel: "Borrar receta" }))) return; setDeletingId(recipe.id); try { await api.request(`/api/recipes/${recipe.id}`, { method: "DELETE" }); if (selectedRecipe?.id === recipe.id) setSelectedRecipe(null); catalog.removeItem(recipe.id); api.notify("Receta borrada."); } catch (error) { api.notify(error.message || "No se pudo borrar la receta.", "error"); } finally { setDeletingId(null); } }
  async function copy(recipe) { try { await api.request(`/api/recipes/${recipe.id}/copy`, { method: "POST" }); api.notify("Receta guardada en Mis recetas."); catalog.refresh(); } catch (error) { api.notify(error.message || "No se pudo guardar la receta.", "error"); } }
  const preview = selectedRecipe && <NutritionCollectionPreview title={selectedRecipe.name} description={selectedRecipe.description} status={recipeStatus(selectedRecipe)} heroItems={(selectedRecipe.ingredients || []).map((item) => ({ ...item.food, type: "FOOD" }))} totals={selectedRecipe} groups={recipeGroups(selectedRecipe)} actions={!canEdit && <button type="button" className="primary" onClick={() => copy(selectedRecipe)}><Icon name="content_copy" />Guardar en mis recetas</button>} onBack={() => setSelectedRecipe(null)} backLabel="Volver a recetas" />;
  return <div className="collection-browser">{onBack && <button type="button" className="back-button" onClick={onBack}><Icon name="arrow_back" />{ownerName ? "Usuarios" : "Recetas"}</button>}<div className="collection-browser-list"><div className="collection-browser-heading"><div><h2>{ownerName ? `Recetas de ${ownerName}` : canEdit ? "Mis recetas" : "Recetas compartidas"}</h2><p>{catalog.items.length ? "Seleccioná una card para revisar la preparación." : "Todavía no hay recetas disponibles."}</p></div><span className="abm-count">{catalog.items.length}</span></div>{catalog.initialLoading && !catalog.items.length && <div className="recipe-list"><SkeletonBlock className="skeleton-recipe-card" /><SkeletonBlock className="skeleton-recipe-card" /></div>}{!catalog.initialLoading && catalog.error && <CatalogStatus error>{catalog.error}<button className="secondary" onClick={catalog.retry}>Reintentar</button></CatalogStatus>}{!catalog.initialLoading && !catalog.error && !catalog.items.length && <Panel className="recipe-empty-panel"><Icon name="restaurant" /><h2>No hay recetas para mostrar</h2><p>{canEdit ? "Creá una receta desde Registrar para tenerla disponible cada vez que cargues una comida." : "Este usuario todavía no tiene recetas disponibles."}</p></Panel>}{catalog.items.length > 0 && <div className="collection-library-list">{catalog.items.map((recipe) => <React.Fragment key={recipe.id}><RecipeCard recipe={recipe} selected={selectedRecipe?.id === recipe.id} canEdit={canEdit} loading={loadingRecipeId === recipe.id || deletingId === recipe.id} onSelect={() => openRecipe(recipe)} onEdit={() => edit(recipe)} onDelete={() => remove(recipe)} onCopy={() => copy(recipe)} />{selectedRecipe?.id === recipe.id && <div className="collection-browser-inline-preview" ref={mobilePreviewRef} aria-live="polite">{preview}</div>}</React.Fragment>)}</div>}<InfiniteSentinel enabled={catalog.hasNext && !catalog.initialLoading && !catalog.loadingMore && !catalog.error} onLoad={catalog.loadNext} /></div><aside className="collection-browser-preview" aria-live="polite">{preview || <NutritionCollectionPreview empty />}</aside>{editing && <EditRecipeModal api={api} recipe={editing} onClose={() => setEditing(null)} onDone={() => { setEditing(null); catalog.refresh(); }} />}</div>;
}

function ExploreRecipes({ api }) {
  const [owners, setOwners] = useState([]); const [loading, setLoading] = useState(true); const [error, setError] = useState(""); const [selectedOwner, setSelectedOwner] = useState(null);
  useEffect(() => { let active = true; api.request("/api/recipes/explore/users").then((result) => active && setOwners(result || [])).catch((requestError) => active && setError(requestError.message || "No se pudieron cargar los usuarios.")).finally(() => active && setLoading(false)); return () => { active = false; }; }, [api]);
  if (selectedOwner) return <RecipeLibrary api={api} endpoint={`/api/recipes/explore/users/${selectedOwner.id}`} canEdit={false} ownerName={selectedOwner.fullName} onBack={() => setSelectedOwner(null)} />;
  if (loading) return <SkeletonRows count={3} label="Cargando usuarios con recetas" />;
  if (error) return <CatalogStatus error>{error}</CatalogStatus>;
  if (!owners.length) return <Panel className="recipe-empty-panel"><Icon name="account_circle" /><h2>No hay recetas para explorar</h2><p>Cuando otros usuarios creen recetas, van a aparecer acá.</p></Panel>;
  return <Panel title="Recetas de la comunidad" className="recipe-owners-panel"><p className="section-intro">Elegí un usuario para ver sus recetas.</p><div className="recipe-owner-list">{owners.map((owner) => <button type="button" className="recipe-owner-card" key={owner.id} onClick={() => setSelectedOwner(owner)}><span className="recipe-owner-avatar"><Icon name="account_circle" /></span><span><strong>{owner.fullName}</strong><small>{owner.recipeCount} {owner.recipeCount === 1 ? "receta" : "recetas"}</small></span><Icon name="chevron_right" /></button>)}</div></Panel>;
}

export function Recipes({ api, embedded = false }) {
  const [tab, setTab] = useState("mine"); const [creating, setCreating] = useState(false); const [refreshSignal, setRefreshSignal] = useState(0);
  return <section className={`page abm-page recipes-page ${embedded ? "register-embedded-page" : ""}`.trim()}><header className="abm-page-header"><div><h1>Recetas</h1><p>Creá preparaciones propias, revisá sus nutrientes y reutilizalas al registrar una comida.</p></div><button className="primary" type="button" onClick={() => setCreating(true)}><Icon name="add" />Crear receta</button></header><div className="tabs recipes-tabs" role="tablist" aria-label="Secciones de recetas"><button type="button" role="tab" aria-selected={tab === "mine"} className={tab === "mine" ? "selected" : ""} onClick={() => setTab("mine")}>Mis recetas</button><button type="button" role="tab" aria-selected={tab === "explore"} className={tab === "explore" ? "selected" : ""} onClick={() => setTab("explore")}>Explorar recetas</button></div>{tab === "mine" ? <RecipeLibrary api={api} endpoint="/api/recipes/mine" canEdit refreshSignal={refreshSignal} /> : <ExploreRecipes api={api} />}{creating && <RecipeCreateDialog api={api} onClose={() => setCreating(false)} onDone={() => setRefreshSignal((value) => value + 1)} />}</section>;
}
