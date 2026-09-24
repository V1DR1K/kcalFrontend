import React, { useEffect, useRef, useState } from "react";
import { InfiniteSentinel } from "../../components/InfiniteSentinel";
import { Icon } from "../../components/Icon";
import { Panel } from "../../components/Layout";
import { CatalogStatus, FoodThumb } from "../catalog/CatalogComponents";
import { formatNumber, formatQuantity } from "../../utils/format";
import { usePagedCatalog } from "../catalog/usePagedCatalog";
import { NutritionCollectionPreview } from "../shared/NutritionCollectionPreview";
import { NutritionSummary } from "../../components/NutritionSummary";
import { SkeletonBlock, SkeletonRows } from "../../components/Loading";
import { cookedRecipeWeight, rawRecipeWeight, recipeYieldPercent } from "../../utils/recipe";
import { RecipeEditorDialog } from "./dialogs/RecipeCreateDialog";
import { useCompactLayout } from "../../components/useCompactLayout";
import { CollectionDetailDialog } from "../shared/CollectionDetailDialog";

function recipeGroups(recipe) {
  return [{
    id: "ingredients", label: "Ingredientes", icon: "restaurant_menu",
    items: (recipe?.ingredients || []).map((ingredient) => {
      const item = ingredient.food || ingredient.recipe || {};
      const isRecipe = Boolean(ingredient.recipe);
      const quantity = Number(ingredient.quantity || 0);
      const base = Number(isRecipe
        ? item.cookedTotalWeightGrams || item.rawTotalWeightGrams
        : item.baseQuantity || 100);
      const factor = base > 0 ? quantity / base : 1;
      return { ...item, type: isRecipe ? "RECIPE" : "FOOD", name: item.name || (isRecipe ? "Receta" : "Alimento"), quantity, unit: ingredient.unit, calories: Math.round(Number(item.calories || 0) * factor), proteinGrams: Number(item.proteinGrams || 0) * factor, carbsGrams: Number(item.carbsGrams || 0) * factor, fatGrams: Number(item.fatGrams || 0) * factor };
    }),
  }];
}

function recipeStatus(recipe) {
  const raw = rawRecipeWeight(recipe); const cooked = cookedRecipeWeight(recipe);
  return `${recipe?.ingredients?.length || 0} ingredientes · ${formatQuantity(raw)} g crudos${cooked > 0 ? ` · ${formatQuantity(cooked)} g cocidos` : ""}`;
}

function RecipeCard({ recipe, selected, compact, canEdit, loading, onSelect, onEdit, onDelete, onCopy }) {
  return <article className={`collection-library-card ${selected ? "selected" : ""}`}>
    <button type="button" className="collection-library-select" onClick={onSelect} aria-haspopup={compact ? "dialog" : undefined} aria-pressed={compact ? undefined : selected} disabled={loading}>
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
  const compact = useCompactLayout();
  const [selectedRecipe, setSelectedRecipe] = useState(null);
  const [mobileRecipe, setMobileRecipe] = useState(null);
  const [detailError, setDetailError] = useState("");
  const [editing, setEditing] = useState(null);
  const [loadingRecipeId, setLoadingRecipeId] = useState(null);
  const [deletingId, setDeletingId] = useState(null);
  const mobileTriggerRef = useRef(null);
  const requestIdRef = useRef(0);
  const catalog = usePagedCatalog({ api, endpoint });
  useEffect(() => { if (refreshSignal > 0) catalog.refresh(); }, [catalog.refresh, refreshSignal]);
  useEffect(() => { if (!compact) setMobileRecipe(null); }, [compact]);
  useEffect(() => () => { requestIdRef.current += 1; }, []);
  function closeMobileRecipe() { requestIdRef.current += 1; setMobileRecipe(null); setSelectedRecipe(null); setDetailError(""); setLoadingRecipeId(null); }
  async function openRecipe(recipe, event) {
    const requestId = ++requestIdRef.current;
    if (compact) {
      if (event) mobileTriggerRef.current = event.currentTarget;
      setMobileRecipe(recipe);
    }
    setSelectedRecipe(null);
    setDetailError("");
    setLoadingRecipeId(recipe.id);
    try {
      const detail = await api.request(`/api/recipes/${recipe.id}`);
      if (requestId === requestIdRef.current) setSelectedRecipe(detail);
    } catch (error) {
      if (requestId !== requestIdRef.current) return;
      const message = error.message || "No se pudo cargar la receta.";
      if (compact) setDetailError(message);
      else api.notify(message, "error");
    } finally {
      if (requestId === requestIdRef.current) setLoadingRecipeId(null);
    }
  }
  async function edit(recipe) { setLoadingRecipeId(recipe.id); try { const detail = selectedRecipe?.id === recipe.id ? selectedRecipe : await api.request(`/api/recipes/${recipe.id}`); if (mobileRecipe) closeMobileRecipe(); setEditing({ ...detail, type: "RECIPE" }); } catch (error) { api.notify(error.message || "No se pudo cargar la receta.", "error"); } finally { setLoadingRecipeId(null); } }
  async function remove(recipe) { if (deletingId) return; if (!(await api.confirm({ title: "¿Borrar receta?", description: `${recipe.name} se eliminará de tus recetas.`, confirmLabel: "Borrar receta" }))) return; setDeletingId(recipe.id); try { await api.request(`/api/recipes/${recipe.id}`, { method: "DELETE" }); if (mobileRecipe?.id === recipe.id) closeMobileRecipe(); if (selectedRecipe?.id === recipe.id) setSelectedRecipe(null); catalog.removeItem(recipe.id); api.notify("Receta borrada."); } catch (error) { api.notify(error.message || "No se pudo borrar la receta.", "error"); } finally { setDeletingId(null); } }
  async function copy(recipe) { try { await api.request(`/api/recipes/${recipe.id}/copy`, { method: "POST" }); api.notify("Receta guardada en Mis recetas."); catalog.refresh(); } catch (error) { api.notify(error.message || "No se pudo guardar la receta.", "error"); } }
  const detailReady = selectedRecipe && (!mobileRecipe || selectedRecipe.id === mobileRecipe.id);
  const previewProps = detailReady ? { title: selectedRecipe.name, description: selectedRecipe.description, status: recipeStatus(selectedRecipe), heroItems: (selectedRecipe.ingredients || []).map((item) => ({ ...(item.food || item.recipe || {}), type: item.recipe ? "RECIPE" : "FOOD" })), totals: selectedRecipe, groups: recipeGroups(selectedRecipe) } : null;
  return <div className="collection-browser">
    {onBack && <button type="button" className="back-button" onClick={onBack}><Icon name="arrow_back" />{ownerName ? "Usuarios" : "Recetas"}</button>}
    <div className="collection-browser-list">
      <div className="collection-browser-heading"><div><h2>{ownerName ? `Recetas de ${ownerName}` : canEdit ? "Mis recetas" : "Recetas compartidas"}</h2><p>{catalog.items.length ? "Elegí una receta para revisar sus ingredientes." : "Todavía no hay recetas disponibles."}</p></div><span className="abm-count">{catalog.items.length}</span></div>
      {catalog.initialLoading && !catalog.items.length && <div className="recipe-list"><SkeletonBlock className="skeleton-recipe-card" /><SkeletonBlock className="skeleton-recipe-card" /></div>}
      {!catalog.initialLoading && catalog.error && <CatalogStatus error>{catalog.error}<button className="secondary" onClick={catalog.retry}>Reintentar</button></CatalogStatus>}
      {!catalog.initialLoading && !catalog.error && !catalog.items.length && <Panel className="recipe-empty-panel"><Icon name="restaurant" /><h2>No hay recetas para mostrar</h2><p>{canEdit ? "Creá una receta desde Registrar para tenerla disponible cada vez que cargues una comida." : "Este usuario todavía no tiene recetas disponibles."}</p></Panel>}
      {catalog.items.length > 0 && <div className="collection-library-list">{catalog.items.map((recipe) => <RecipeCard key={recipe.id} recipe={recipe} compact={compact} selected={!compact && selectedRecipe?.id === recipe.id} canEdit={canEdit} loading={loadingRecipeId === recipe.id || deletingId === recipe.id} onSelect={(event) => openRecipe(recipe, event)} onEdit={() => edit(recipe)} onDelete={() => remove(recipe)} onCopy={() => copy(recipe)} />)}</div>}
      <InfiniteSentinel enabled={catalog.hasNext && !catalog.initialLoading && !catalog.loadingMore && !catalog.error} onLoad={catalog.loadNext} />
    </div>
    {!compact && <aside className="collection-browser-preview" aria-live="polite">{previewProps ? <NutritionCollectionPreview {...previewProps} actions={!canEdit && <button type="button" className="primary" onClick={() => copy(selectedRecipe)}><Icon name="content_copy" />Guardar en mis recetas</button>} /> : <NutritionCollectionPreview empty />}</aside>}
    {compact && mobileRecipe && <CollectionDetailDialog title={mobileRecipe.name} preview={previewProps || {}} loading={loadingRecipeId === mobileRecipe.id && !detailError} error={detailError} onRetry={() => openRecipe(mobileRecipe)} onClose={closeMobileRecipe} returnFocusRef={mobileTriggerRef} footer={detailReady && (canEdit ? <button type="button" className="primary" onClick={() => edit(selectedRecipe)}>Editar receta</button> : <button type="button" className="primary" onClick={() => copy(selectedRecipe)}><Icon name="content_copy" />Guardar en mis recetas</button>)} actions={detailReady && canEdit && <button type="button" className="secondary danger-text" onClick={() => remove(selectedRecipe)}><Icon name="delete" />Borrar receta</button>} />}
    {editing && <RecipeEditorDialog api={api} recipe={editing} onClose={() => setEditing(null)} onDone={() => { setEditing(null); catalog.refresh(); }} />}
  </div>;
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
  return <section className={`page abm-page recipes-page ${embedded ? "register-embedded-page" : ""}`.trim()}><header className="abm-page-header"><div><h1>Recetas</h1><p>Creá preparaciones propias, revisá sus nutrientes y reutilizalas al registrar una comida.</p></div><button className="primary" type="button" onClick={() => setCreating(true)}><Icon name="add" />Crear receta</button></header><div className="tabs recipes-tabs" role="tablist" aria-label="Secciones de recetas"><button type="button" role="tab" aria-selected={tab === "mine"} className={tab === "mine" ? "selected" : ""} onClick={() => setTab("mine")}>Mis recetas</button><button type="button" role="tab" aria-selected={tab === "explore"} className={tab === "explore" ? "selected" : ""} onClick={() => setTab("explore")}>Explorar recetas</button></div>{tab === "mine" ? <RecipeLibrary api={api} endpoint="/api/recipes/mine" canEdit refreshSignal={refreshSignal} /> : <ExploreRecipes api={api} />}{creating && <RecipeEditorDialog api={api} onClose={() => setCreating(false)} onDone={() => setRefreshSignal((value) => value + 1)} />}</section>;
}
