import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { CATEGORY_OPTIONS } from "../../config/app";
import { Icon } from "../../components/Icon";
import { InfiniteSentinel } from "../../components/InfiniteSentinel";
import { Input, Select } from "../../components/FormControls";
import { Header, Panel } from "../../components/Layout";
import { CatalogRowWithImage, CatalogStatus, groupFoodVariants, categoryLabel } from "./CatalogComponents";
import { usePagedCatalog } from "./usePagedCatalog";
import { formatNumber } from "../../utils/format";

function macroCalories(proteinGrams, carbsGrams, fatGrams) {
  return Math.round(Number(proteinGrams || 0) * 4 + Number(carbsGrams || 0) * 4 + Number(fatGrams || 0) * 9);
}

export function CreateCatalog({ api, setPage, prefillBarcode, clearPrefillBarcode }) {
  const [tab, setTab] = useState("FOOD");
  return (
    <section className="page narrow">
      <button className="back-button" onClick={() => setPage("foods")}>
        <Icon name="arrow_back" />Alimentos
      </button>
      <Header title="Crear" eyebrow="Catalogo global" />
      <div className="tabs create-tabs">
        <button className={tab === "FOOD" ? "selected" : ""} onClick={() => setTab("FOOD")}>
          Alimento
        </button>
        <button className={tab === "RECIPE" ? "selected" : ""} onClick={() => setTab("RECIPE")}>
          Receta
        </button>
        <button className={tab === "MINE" ? "selected" : ""} onClick={() => setTab("MINE")}>
          Mis alimentos
        </button>
      </div>
      {tab === "FOOD" && <CreateFoodForm api={api} prefillBarcode={prefillBarcode} clearPrefillBarcode={clearPrefillBarcode} />}
      {tab === "RECIPE" && <CreateRecipeForm api={api} />}
      {tab === "MINE" && <MyFoods api={api} />}
    </section>
  );
}

function CreateFoodForm({ api, prefillBarcode, clearPrefillBarcode }) {
  const [saving, setSaving] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [ocrStatus, setOcrStatus] = useState("");
  const [ocrData, setOcrData] = useState(null);
  const formRef = useRef(null);
  async function submit(event) {
    event.preventDefault();
    if (saving) return;
    const form = event.currentTarget;
    const formData = new FormData(form);
    const data = Object.fromEntries(formData);
    setSaving(true);
    try {
      await api.runAction(
        { title: "Creando alimento", description: "Estamos guardando el alimento en el catalogo..." },
        () => api.request("/api/foods", {
          method: "POST",
          body: JSON.stringify({
            name: data.name,
            brand: data.brand,
            barcode: data.barcode,
            category: data.category,
            baseUnit: "GRAM",
            baseQuantity: Number(data.baseQuantity || 100),
            proteinGrams: Number(data.proteinGrams),
            carbsGrams: Number(data.carbsGrams),
            fatGrams: Number(data.fatGrams),
            preparation: "UNSPECIFIED",
            servingName: null,
            servingWeightGrams: null,
            tags: data.tags
              ? data.tags
                  .split(",")
                  .map((tag) => tag.trim())
                  .filter(Boolean)
              : [],
          }),
        }),
      );
      api.notify("Alimento creado.");
      form.reset();
      setOcrData(null);
      clearPrefillBarcode?.();
    } catch (error) {
      const details = Object.values(error.fields || {}).join(" · ");
      api.notify(details || error.message || "No se pudo crear el alimento. Revisá los datos.", "error");
    } finally {
      setSaving(false);
    }
  }
  function setField(name, value) {
    const input = formRef.current?.querySelector(`[name="${name}"]`);
    if (input && value != null) {
      input.value = value;
      input.dispatchEvent(new Event("input", { bubbles: true }));
    }
  }
  function acceptOcrData() {
    if (!ocrData) return;
    ["proteinGrams", "carbsGrams", "fatGrams"].forEach((field) => setField(field, ocrData[field] ?? 0));
    setOcrData(null);
    setOcrStatus("Valores aplicados al alimento. Podés seguir completando el formulario.");
    api.notify("Valores nutricionales aplicados.");
  }
  async function handleOcrImage(file) {
    if (!file) return;
    setScanning(true);
    setOcrStatus("Procesando imagen con OCR...");
    try {
      const { recognizeNutrition } = await import("../../services/nutritionOcr");
      const data = await recognizeNutrition(file);
      if (data.proteinGrams != null || data.carbsGrams != null || data.fatGrams != null) {
        setOcrData(data);
        setOcrStatus("Revisá los valores detectados antes de aplicarlos.");
      } else {
        setOcrStatus("No se pudieron reconocer los valores. Ingresalos manualmente.");
        api.notify("No se reconoció la tabla nutricional.", "error");
      }
    } catch {
      setOcrStatus("Error al procesar la imagen. Ingresalos manualmente.");
      api.notify("Error al escanear la tabla.", "error");
    } finally {
      setScanning(false);
    }
  }
  return (
    <Panel title="Nuevo alimento">
      <form className="form-grid" ref={formRef} onSubmit={submit}>
        {ocrStatus && (
          <div className={`ocr-status ${ocrData || ocrStatus.startsWith("Valores aplicados") ? "ok" : "bad"}`}>
            {scanning ? <span className="ocr-loading" /> : null}
            <span>{ocrStatus}</span>
          </div>
        )}
        {ocrData && (
          <OcrNutritionPreview
            data={ocrData}
            setData={setOcrData}
            onAccept={acceptOcrData}
            onDiscard={() => {
              setOcrData(null);
              setOcrStatus("");
            }}
          />
        )}
        <div className="ocr-actions">
          <label className="secondary ocr-label">
            <Icon name="document_scanner" />
            Escanear tabla nutricional
            <input
              type="file"
              accept="image/*"
              capture="environment"
              onChange={(event) => {
                setOcrStatus("");
                setOcrData(null);
                handleOcrImage(event.currentTarget.files?.[0]);
              }}
              hidden
              disabled={scanning}
            />
          </label>
        </div>
        <Input name="name" label="Nombre" required />
        <Input name="brand" label="Marca" />
        <Input name="barcode" label="Codigo de barras opcional" defaultValue={prefillBarcode || ""} />
        <Select name="category" label="Categoria" options={CATEGORY_OPTIONS} />
        <Input name="baseQuantity" label="Estos valores corresponden a (gramos)" type="number" defaultValue="100" step="0.1" min="0.1" required />
        <div className="split">
          <Input numericOnly name="proteinGrams" label="Proteinas g" type="number" step="0.1" min="0" required />
          <Input numericOnly name="carbsGrams" label="Carbohidratos g" type="number" step="0.1" min="0" required />
        </div>
        <div className="split">
          <Input numericOnly name="fatGrams" label="Grasas g" type="number" step="0.1" min="0" required />
          <DerivedCaloriesHint />
        </div>
        <Input name="tags" label="Tags separados por coma" />
        <button className="primary" disabled={saving || scanning}>
          {saving ? "Creando…" : "Crear alimento"}
        </button>
      </form>
    </Panel>
  );
}

function OcrNutritionPreview({ data, setData, onAccept, onDiscard }) {
  const derivedCalories = macroCalories(data.proteinGrams, data.carbsGrams, data.fatGrams);
  const fields = [
    { key: "proteinGrams", label: "Proteínas", unit: "g" },
    { key: "carbsGrams", label: "Carbohidratos", unit: "g" },
    { key: "fatGrams", label: "Grasas", unit: "g" },
  ];
  return (
    <section className="ocr-preview" aria-label="Vista previa nutricional">
      <header>
        <div>
          <span>Vista previa</span>
          <strong>Información detectada</strong>
        </div>
        <Icon name="document_scanner" />
      </header>
      <div className="ocr-preview-grid">
        <span className="derived-calories-card"><small>Kcal calculadas</small><strong>{formatNumber(derivedCalories)}</strong></span>
        {fields.map(({ key, label, unit }) => (
          <label key={key}>
            <span>{label}</span>
            <div>
              <input
                type="number"
                min="0"
                step="0.1"
                value={data[key] ?? ""}
                onChange={(event) =>
                  setData((current) => ({
                    ...current,
                    [key]: event.target.value,
                  }))
                }
              />
              <small>{unit}</small>
            </div>
          </label>
        ))}
      </div>
      <div className="ocr-preview-actions">
        <button type="button" className="secondary" onClick={onDiscard}>
          Descartar
        </button>
        <button type="button" className="primary" onClick={onAccept}>
          <Icon name="check" />Aceptar valores
        </button>
      </div>
    </section>
  );
}

function DerivedCaloriesHint({ values }) {
  return (
    <div className="derived-calories-card">
      <small>Kcal calculadas</small>
      <strong>{values ? formatNumber(macroCalories(values.proteinGrams, values.carbsGrams, values.fatGrams)) : "P*4 + C*4 + G*9"}</strong>
    </div>
  );
}

function MyFoods({ api }) {
  const [items, setItems] = useState([]);
  const [editing, setEditing] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const load = useCallback(() => {
    setLoading(true);
    return api
      .request("/api/foods/mine")
      .then(setItems)
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
        { title: "Guardando alimento", description: "Estamos actualizando los datos del catalogo..." },
        () => api.request(`/api/foods/${editing.id}`, { method: "PUT", body: JSON.stringify({ name: data.name, brand: data.brand, barcode: data.barcode, category: data.category, baseUnit: "GRAM", baseQuantity: Number(data.baseQuantity), proteinGrams: Number(data.proteinGrams), carbsGrams: Number(data.carbsGrams), fatGrams: Number(data.fatGrams), preparation: "UNSPECIFIED", servingName: null, servingWeightGrams: null, tags: [] }) }),
      );
      api.notify("Alimento actualizado.");
      setEditing(null);
      await load();
    } catch (error) {
      api.notify(error.message || "No se pudo actualizar.", "error");
    } finally {
      setSaving(false);
    }
  }
  if (loading)
    return (
      <Panel title="Mis alimentos">
        <CatalogStatus>Cargando tus alimentos…</CatalogStatus>
      </Panel>
    );
  return (
    <Panel title="Mis alimentos" className="my-foods-panel">
      {!items.length ? (
        <p className="empty-state">Todavía no creaste alimentos.</p>
      ) : (
        <div className="my-foods-list">
          {items.map((item) => (
            <button type="button" key={item.id} onClick={() => setEditing(item)}>
              <span>
                <strong>{item.name}</strong>
                <small>{item.brand || categoryLabel(item.category)}</small>
              </span>
              <span>{item.calories} kcal</span>
              <Icon name="edit" />
            </button>
          ))}
        </div>
      )}
      {editing && createPortal(
        <div
          className="edit-food-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setEditing(null);
          }}
        >
          <form className="edit-food-sheet" onSubmit={save}>
            <header>
              <div>
                <span>Editar alimento</span>
                <h2>{editing.name}</h2>
              </div>
              <button type="button" className="icon-button" aria-label="Cerrar" onClick={() => setEditing(null)}>
                <Icon name="close" />
              </button>
            </header>
            <div className="edit-food-fields">
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
          </form>
        </div>,
        document.body,
      )}
    </Panel>
  );
}

function recipeFieldLabel(field) {
  if (field === "name") return "Nombre";
  if (field === "description") return "Descripcion";
  if (field === "totalWeightGrams") return "Peso total";
  if (field?.startsWith("ingredients")) return "Ingredientes";
  return field || "Datos";
}

function CreateRecipeForm({ api }) {
  const [query, setQuery] = useState("");
  const [ingredients, setIngredients] = useState([]);
  const [preview, setPreview] = useState(null);
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);
  const totalWeight = useMemo(
    () => ingredients.reduce((total, item) => total + (Number(item.quantity) || 0), 0),
    [ingredients],
  );
  const catalog = usePagedCatalog({
    api,
    endpoint: "/api/foods",
    query,
    pageSize: 10,
  });
  useEffect(() => {
    if (!ingredients.length || totalWeight <= 0) return setPreview(null);
    const normalizedIngredients = ingredients.map((item) => ({
      foodId: item.foodId,
      quantity: Number(item.quantity),
      unit: item.unit,
    }));
    api
      .request("/api/recipes/preview", {
        method: "POST",
        body: JSON.stringify({
          name: "preview",
          ingredients: normalizedIngredients,
        }),
      })
      .then(setPreview)
      .catch(() => setPreview(null));
  }, [api, ingredients, totalWeight]);
  async function submit(event) {
    event.preventDefault();
    if (saving) return;
    const form = event.currentTarget;
    setFormError("");
    const data = Object.fromEntries(new FormData(form));
    if (!String(data.name || "").trim()) {
      setFormError("Poné un nombre para la receta.");
      return;
    }
    if (!ingredients.length) {
      setFormError("Agregá al menos un ingrediente.");
      return;
    }
    if (ingredients.some((item) => !Number.isFinite(Number(item.quantity)) || Number(item.quantity) <= 0)) {
      setFormError("Cada ingrediente debe tener una cantidad mayor a cero.");
      return;
    }
    setSaving(true);
    try {
      const normalizedIngredients = ingredients.map((item) => ({
        foodId: item.foodId,
        quantity: Number(item.quantity),
        unit: item.unit,
      }));
      await api.runAction(
        { title: "Creando receta", description: "Estamos guardando los ingredientes..." },
        () => api.request("/api/recipes", {
          method: "POST",
          body: JSON.stringify({
            name: data.name,
            description: data.description,
            totalWeightGrams: totalWeight,
            ingredients: normalizedIngredients,
          }),
        }),
      );
      api.notify("Receta creada.");
      form.reset();
      setIngredients([]);
      setPreview(null);
    } catch (error) {
      const fieldDetails = Object.entries(error.fields || {})
        .map(([field, message]) => `${recipeFieldLabel(field)}: ${message}`)
        .join(" ");
      const message = fieldDetails || error.message || "No se pudo crear la receta. Revisa los datos.";
      setFormError(message);
      api.notify(message, "error");
    } finally {
      setSaving(false);
    }
  }
  return (
    <Panel title="Nueva receta" className="recipe-panel">
      <form className="form-grid recipe-form" onSubmit={submit}>
        {formError && (
          <div className="form-error recipe-error" role="alert">
            <Icon name="error" />
            <span>{formError}</span>
          </div>
        )}
        <Input name="name" label="Nombre" required />
        <Input name="description" label="Descripcion opcional" />
        <div className="recipe-weight-summary" aria-live="polite">
          <Icon name="scale" />
          <div>
            <small>Peso total calculado</small>
            <strong>{formatNumber(totalWeight, 1)} g</strong>
          </div>
        </div>
        <div className="search-wrap">
          <Icon name="search" />
          <input className="search" placeholder="Buscar ingredientes..." value={query} onChange={(event) => setQuery(event.target.value)} />
        </div>
        <div className="picker-results">
          {groupFoodVariants(catalog.items).map((food) => (
            <button
              type="button"
              className="catalog-row ingredient-pick"
              key={food.id}
              onClick={() =>
                setIngredients([
                  ...ingredients,
                  {
                    foodId: food.id,
                    quantity: 100,
                    unit: "GRAM",
                    name: food.name,
                  },
                ])
              }
            >
              <span>
                <strong>{food.name}</strong>
                <small>{food.calories} kcal / 100g</small>
              </span>
              <em><Icon name="add" />Agregar</em>
            </button>
          ))}
        </div>
        {catalog.initialLoading && <CatalogStatus>Buscando ingredientes…</CatalogStatus>}
        {!catalog.initialLoading && catalog.error && (
          <CatalogStatus error>
            {catalog.error}
            <button type="button" className="secondary" onClick={catalog.retry}>
              Reintentar
            </button>
          </CatalogStatus>
        )}
        {!catalog.initialLoading && !catalog.error && !catalog.items.length && <CatalogStatus>No encontramos ingredientes.</CatalogStatus>}
        <InfiniteSentinel enabled={!catalog.initialLoading && !catalog.error && catalog.hasNext} onLoad={catalog.loadNext} />
        {catalog.loadingMore && <CatalogStatus>Cargando más…</CatalogStatus>}
        <div className="ingredient-list">
          {ingredients.map((item, index) => (
            <label className="ingredient-row" key={`${item.foodId}:${index}`}>
              <span className="ingredient-name">{item.name}</span>
              <span className="ingredient-quantity">
                <input aria-label={`Cantidad de ${item.name} en gramos`} type="number" inputMode="decimal" min="0.1" step="0.1" value={item.quantity} onFocus={(event) => event.currentTarget.select()} onPointerUp={(event) => { event.preventDefault(); event.currentTarget.select(); }} onKeyDown={(event) => { if (["e", "E", "+", "-"].includes(event.key)) event.preventDefault(); }} onInput={(event) => { event.currentTarget.value = event.currentTarget.value.replace(",", ".").replace(/[^\d.]/g, ""); }} onChange={(event) => setIngredients(ingredients.map((ingredient, i) => (i === index ? { ...ingredient, quantity: event.target.value } : ingredient)))} />
                <small>g</small>
              </span>
              <button type="button" className="ingredient-remove" onClick={() => setIngredients(ingredients.filter((_, i) => i !== index))}>
                <Icon name="remove" />Quitar
              </button>
            </label>
          ))}
        </div>
        <div className="recipe-nutrition-summary" aria-label="Resumen nutricional de la receta">
          <span><strong>{formatNumber(preview?.calories)}</strong><small>Kcal</small></span>
          <span><strong>{formatNumber(preview?.proteinGrams, 1)}g</strong><small>Proteinas</small></span>
          <span><strong>{formatNumber(preview?.carbsGrams, 1)}g</strong><small>Carbos</small></span>
          <span><strong>{formatNumber(preview?.fatGrams, 1)}g</strong><small>Grasas</small></span>
          {formatNumber(preview?.calories)} kcal · P {formatNumber(preview?.proteinGrams, 1)}g · C {formatNumber(preview?.carbsGrams, 1)}g · G {formatNumber(preview?.fatGrams, 1)}g
        </div>
        <button className="primary recipe-submit" disabled={!ingredients.length || saving}>
          {saving ? "Creando…" : "Crear receta"}
        </button>
      </form>
    </Panel>
  );
}
