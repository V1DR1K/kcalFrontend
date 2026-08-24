import React, { useEffect, useState } from "react";
import { InfiniteSentinel } from "../../components/InfiniteSentinel";
import { Icon } from "../../components/Icon";
import { Header, Panel } from "../../components/Layout";
import { CatalogStatus, FoodThumb, NutrientDetails } from "../catalog/CatalogComponents";
import { formatNumber } from "../../utils/format";
import { usePagedCatalog } from "../catalog/usePagedCatalog";
import { EditRecipeModal, SwipeableRecipeCard } from "../foods/FoodComponents";
import { RecipeDetailDialog } from "./dialogs/RecipeDetailDialog";
import { RecipeCreateDialog } from "./dialogs/RecipeCreateDialog";

export function Recipes({ api, setPage, embedded = false }) {
  const [tab, setTab] = useState("mine");
  const [creating, setCreating] = useState(false);
  const [refreshSignal, setRefreshSignal] = useState(0);
  const createAction = (
    <button className="primary pill recipe-create-trigger" onClick={() => setCreating(true)}>
      <Icon name="add" />
      Crear receta
    </button>
  );
  return (
    <section className={`page recipes-page ${embedded ? "register-embedded-page" : ""}`}>
      {embedded ? (
        <div className="recipes-embedded-toolbar">{createAction}</div>
      ) : (
        <Header
          title="Recetas"
          action={<div className="header-actions">{createAction}</div>}
        />
      )}
      <div className="tabs" role="tablist" aria-label="Secciones de recetas">
        <button type="button" role="tab" aria-selected={tab === "mine"} className={tab === "mine" ? "selected" : ""} onClick={() => setTab("mine")}>
          Mis recetas
        </button>
        <button type="button" role="tab" aria-selected={tab === "explore"} className={tab === "explore" ? "selected" : ""} onClick={() => setTab("explore")}>
          Explorar recetas
        </button>
      </div>
      {tab === "mine" ? <MyRecipes api={api} refreshSignal={refreshSignal} /> : <ExploreRecipes api={api} />}
      {creating && <RecipeCreateDialog api={api} onClose={() => setCreating(false)} onDone={() => setRefreshSignal((value) => value + 1)} />}
    </section>
  );
}
function MyRecipes({ api, refreshSignal }) {
  const [editing, setEditing] = useState(null);
  const [deletingId, setDeletingId] = useState(null);
  const [loadingId, setLoadingId] = useState(null);
  const [resetSignal, setResetSignal] = useState(0);
  const catalog = usePagedCatalog({ api, endpoint: "/api/recipes/mine" });

  useEffect(() => {
    if (refreshSignal > 0) catalog.refresh();
  }, [catalog.refresh, refreshSignal]);

  async function edit(recipe) {
    setResetSignal((value) => value + 1);
    setLoadingId(recipe.id);
    try {
      const fullRecipe = await api.runAction(
        { title: "Cargando receta", description: "Estamos preparando los datos para editarla..." },
        () => api.request(`/api/recipes/${recipe.id}`),
      );
      setEditing({ ...fullRecipe, type: "RECIPE" });
    } catch (error) {
      api.notify(error.message || "No se pudo cargar la receta.", "error");
    } finally {
      setLoadingId(null);
    }
  }

  async function remove(recipe) {
    if (deletingId) return;
    const confirmed = await api.confirm({
      title: "¿Borrar receta?",
      description: `${recipe.name} se eliminará de tus recetas.`,
      confirmLabel: "Borrar receta",
    });
    if (!confirmed) {
      setResetSignal((value) => value + 1);
      return;
    }
    setDeletingId(recipe.id);
    try {
      await api.runAction(
        { title: "Borrando receta", description: "Estamos eliminando la receta..." },
        async () => {
          await api.request(`/api/recipes/${recipe.id}`, { method: "DELETE" });
          catalog.removeItem(recipe.id);
          api.notify("Receta borrada.");
        },
        { quiet: true },
      );
    } catch (error) {
      api.notify(error.message || "No se pudo borrar la receta.", "error");
    } finally {
      setDeletingId(null);
      setResetSignal((value) => value + 1);
    }
  }

  return (
    <>
      {catalog.initialLoading && !catalog.items.length && <RecipeLoadingState />}
      {!catalog.initialLoading && catalog.error && (
        <CatalogStatus error>
          {catalog.error}
          <button className="secondary" onClick={catalog.retry}>Reintentar</button>
        </CatalogStatus>
      )}
      {!catalog.initialLoading && !catalog.error && !catalog.items.length && (
        <Panel className="recipe-empty-panel">
          <Icon name="restaurant" />
          <h2>Todavía no tenés recetas</h2>
          <p>Creá una receta desde Registrar para tenerla disponible cada vez que cargues una comida.</p>
        </Panel>
      )}
      {catalog.items.length > 0 && (
        <div className="recipe-list">
          {catalog.items.map((item) => (
              <SwipeableRecipeCard
              key={item.id}
              recipe={{ ...item, type: "RECIPE" }}
              resetSignal={resetSignal}
              disabled={deletingId === item.id || loadingId === item.id}
              onEdit={() => edit(item)}
              onDelete={() => remove(item)}
            />
          ))}
        </div>
      )}
      <InfiniteSentinel enabled={catalog.hasNext && !catalog.initialLoading && !catalog.loadingMore && !catalog.error} onLoad={catalog.loadNext} />
      {editing && <EditRecipeModal api={api} recipe={editing} onClose={() => setEditing(null)} onDone={() => { setEditing(null); catalog.refresh(); }} />}
    </>
  );
}
function RecipeLoadingState() {
  return (
    <div className="recipe-list" aria-hidden="true">
      <div className="skeleton skeleton-recipe-card" />
      <div className="skeleton skeleton-recipe-card" />
      <div className="skeleton skeleton-recipe-card" />
    </div>
  );
}

function ExploreRecipes({ api }) {
  const [owners, setOwners] = useState([]);
  const [selectedOwner, setSelectedOwner] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    setLoading(true);
    api.request("/api/recipes/explore/users")
      .then((result) => active && setOwners(result || []))
      .catch((requestError) => active && setError(requestError.message || "No se pudieron cargar los usuarios."))
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, [api]);

  if (selectedOwner) {
    return <ExploreOwnerRecipes api={api} owner={selectedOwner} onBack={() => setSelectedOwner(null)} />;
  }
  if (loading) return <CatalogStatus>Buscando usuarios con recetas...</CatalogStatus>;
  if (error) return <CatalogStatus error>{error}</CatalogStatus>;
  if (!owners.length) {
    return (
      <Panel className="recipe-empty-panel">
        <Icon name="account_circle" />
        <h2>No hay recetas para explorar</h2>
        <p>Cuando otros usuarios creen recetas, van a aparecer acá.</p>
      </Panel>
    );
  }
  return (
    <Panel title="Recetas de la comunidad" className="recipe-owners-panel">
      <p className="section-intro">Elegí un usuario para ver las recetas que compartió.</p>
      <div className="recipe-owner-list">
        {owners.map((owner) => (
          <button type="button" className="recipe-owner-card" key={owner.id} onClick={() => setSelectedOwner(owner)}>
            <span className="recipe-owner-avatar"><Icon name="account_circle" /></span>
            <span><strong>{owner.fullName}</strong><small>{owner.recipeCount} {owner.recipeCount === 1 ? "receta" : "recetas"}</small></span>
            <Icon name="chevron_right" />
          </button>
        ))}
      </div>
    </Panel>
  );
}

function ExploreOwnerRecipes({ api, owner, onBack }) {
  const [selectedRecipe, setSelectedRecipe] = useState(null);
  const [loadingRecipeId, setLoadingRecipeId] = useState(null);
  const catalog = usePagedCatalog({ api, endpoint: `/api/recipes/explore/users/${owner.id}` });

  async function openRecipe(recipe) {
    setLoadingRecipeId(recipe.id);
    try {
      const detail = await api.runAction(
        { title: "Cargando receta", description: "Estamos preparando sus ingredientes..." },
        () => api.request(`/api/recipes/${recipe.id}`),
      );
      setSelectedRecipe(detail);
    } catch (error) {
      api.notify(error.message || "No se pudo cargar la receta.", "error");
    } finally {
      setLoadingRecipeId(null);
    }
  }

  return (
    <>
      <button type="button" className="back-button" onClick={onBack}><Icon name="arrow_back" />Usuarios</button>
      <div className="recipe-owner-heading">
        <span className="recipe-owner-avatar"><Icon name="account_circle" /></span>
        <div><span>Recetas compartidas por</span><h2>{owner.fullName}</h2></div>
      </div>
      {catalog.initialLoading && !catalog.items.length && <RecipeLoadingState />}
      {!catalog.initialLoading && catalog.error && <CatalogStatus error>{catalog.error}<button className="secondary" onClick={catalog.retry}>Reintentar</button></CatalogStatus>}
      {!catalog.initialLoading && !catalog.error && !catalog.items.length && <CatalogStatus>Este usuario todavía no tiene recetas disponibles.</CatalogStatus>}
      {catalog.items.length > 0 && (
        <div className="recipe-list">
          {catalog.items.map((recipe) => (
            <button type="button" className={`explore-recipe-card ${loadingRecipeId === recipe.id ? "loading" : ""}`} key={recipe.id} onClick={() => openRecipe(recipe)} disabled={Boolean(loadingRecipeId)}>
              <FoodThumb item={{ ...recipe, type: "RECIPE" }} compact />
              <span><strong>{recipe.name}</strong><small>{recipe.description || "Receta completa"}</small></span>
              <b>{recipe.calories} kcal</b>
              <Icon name="chevron_right" />
            </button>
          ))}
        </div>
      )}
      <InfiniteSentinel enabled={catalog.hasNext && !catalog.initialLoading && !catalog.loadingMore && !catalog.error} onLoad={catalog.loadNext} />
      {selectedRecipe && <RecipeDetailDialog api={api} recipe={selectedRecipe} onClose={() => setSelectedRecipe(null)} />}
    </>
  );
}
// End of Recipes screen.
