import React, { useEffect, useMemo, useRef, useState } from "react";
import { CATEGORY_OPTIONS } from "../../../config/app";
import { Icon } from "../../../components/Icon";
import { InfiniteSentinel } from "../../../components/InfiniteSentinel";
import { Input, Select } from "../../../components/FormControls";
import { Panel } from "../../../components/Layout";
import { CatalogStatus, groupFoodVariants, categoryLabel } from "../CatalogComponents";
import { usePagedCatalog } from "../usePagedCatalog";
import { formatNumber } from "../../../utils/format";
import { DerivedCaloriesHint, OcrNutritionPreview } from "./OcrNutritionPreview";
import { OCR_MACRO_FIELDS } from "../utils/catalog.utils";
import { NutritionSummary } from "../../../components/NutritionSummary";

export function CreateFoodForm({ api, prefillBarcode, clearPrefillBarcode, onDirtyChange, onBusyChange }) {
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
    onBusyChange?.(true);
    try {
      await api.runAction(
        { title: "Creando alimento", description: "Estamos guardando el alimento en el catálogo..." },
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
        }, { quiet: true }),
      );
      api.notify("Alimento creado.");
      form.reset();
      setOcrData(null);
      clearPrefillBarcode?.();
      onDirtyChange?.(false);
    } catch (error) {
      const details = Object.values(error.fields || {}).join(" · ");
      api.notify(details || error.message || "No se pudo crear el alimento. Revisá los datos.", "error");
    } finally {
      setSaving(false);
      onBusyChange?.(false);
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
    OCR_MACRO_FIELDS.forEach((field) => setField(field, ocrData[field]));
    setField("baseQuantity", ocrData.baseQuantity);
    setOcrData(null);
    setOcrStatus("Valores aplicados al alimento. Podés seguir completando el formulario.");
    api.notify("Valores nutricionales aplicados.");
  }
  async function handleOcrImage(file) {
    if (!file) return;
    setScanning(true);
    onBusyChange?.(true);
    onDirtyChange?.(true);
    setOcrStatus("Procesando imagen con OCR...");
    try {
      const { recognizeNutrition } = await import("../../../services/nutritionOcr");
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
      onBusyChange?.(false);
    }
  }
  const ocrStatusClass = scanning ? "loading" : ocrData || ocrStatus.startsWith("Valores aplicados") ? "ok" : "bad";
  return (
    <Panel title="Nuevo alimento">
      <form className="form-grid" ref={formRef} onInput={() => onDirtyChange?.(true)} onSubmit={submit}>
        {ocrStatus && (
          <div className={`ocr-status ${ocrStatusClass}`} role="status" aria-live="polite" aria-busy={scanning}>
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
                const file = event.currentTarget.files?.[0];
                event.currentTarget.value = "";
                setOcrStatus("");
                setOcrData(null);
                handleOcrImage(file);
              }}
              hidden
              disabled={scanning}
            />
          </label>
        </div>
        <Input name="name" label="Nombre" required />
        <Input name="brand" label="Marca" />
        <Input name="barcode" label="Código de barras opcional" defaultValue={prefillBarcode || ""} />
        <Select name="category" label="Categoría" options={CATEGORY_OPTIONS} />
        <Input name="baseQuantity" label="Estos valores corresponden a (gramos)" type="number" defaultValue="100" step="0.1" min="0.1" required />
        <div className="split">
          <Input numericOnly name="proteinGrams" label="Proteínas g" type="number" step="0.1" min="0" required />
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


function recipeFieldLabel(field) {
  if (field === "name") return "Nombre";
  if (field === "description") return "Descripción";
  if (field === "totalWeightGrams") return "Peso total";
  if (field?.startsWith("ingredients")) return "Ingredientes";
  return field || "Datos";
}

export function CreateRecipeForm({ api, onDirtyChange, onBusyChange, onDone }) {
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
    enabled: query.trim().length >= 2,
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
    onBusyChange?.(true);
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
             ingredients: normalizedIngredients,
           }),
        }, { quiet: true }),
      );
      api.notify("Receta creada.");
      form.reset();
      setIngredients([]);
      setPreview(null);
      onDirtyChange?.(false);
      onDone?.();
    } catch (error) {
      const fieldDetails = Object.entries(error.fields || {})
        .map(([field, message]) => `${recipeFieldLabel(field)}: ${message}`)
        .join(" ");
      const message = fieldDetails || error.message || "No se pudo crear la receta. Revisá los datos.";
      setFormError(message);
      api.notify(message, "error");
    } finally {
      setSaving(false);
      onBusyChange?.(false);
    }
  }
  return (
    <Panel title="Nueva receta" className="recipe-panel">
      <form className="form-grid recipe-form" onInput={() => onDirtyChange?.(true)} onSubmit={submit}>
        {formError && (
          <div className="form-error recipe-error" role="alert">
            <Icon name="error" />
            <span>{formError}</span>
          </div>
        )}
        <Input name="name" label="Nombre" required />
        <Input name="description" label="Descripción opcional" />
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
        {catalog.initialLoading && <CatalogStatus>Buscando ingredientes…</CatalogStatus>}
        {!catalog.initialLoading && query.trim().length < 2 && <CatalogStatus>Buscá un ingrediente para comenzar.</CatalogStatus>}
        {query.trim().length >= 2 && <div className="picker-results">
          {groupFoodVariants(catalog.items).map((food) => (
            <button
              type="button"
              className="catalog-row ingredient-pick"
              key={food.id}
              onClick={() => {
                setIngredients([
                  ...ingredients,
                  {
                    foodId: food.id,
                    quantity: 100,
                    unit: "GRAM",
                    name: food.name,
                  },
                ]);
                onDirtyChange?.(true);
              }}
            >
              <span>
                <strong>{food.name}</strong>
                <small>{food.calories} kcal / 100g</small>
              </span>
              <em><Icon name="add" />Agregar</em>
            </button>
          ))}
        </div>}
        {!catalog.initialLoading && catalog.error && (
          <CatalogStatus error>
            {catalog.error}
            <button type="button" className="secondary" onClick={catalog.retry}>
              Reintentar
            </button>
          </CatalogStatus>
        )}
        {query.trim().length >= 2 && !catalog.initialLoading && !catalog.error && !catalog.items.length && <CatalogStatus>No encontramos ingredientes.</CatalogStatus>}
        <InfiniteSentinel enabled={query.trim().length >= 2 && !catalog.initialLoading && !catalog.error && catalog.hasNext} onLoad={catalog.loadNext} />
        <div className="ingredient-list">
          {ingredients.map((item, index) => (
            <label className="ingredient-row" key={`${item.foodId}:${index}`}>
              <span className="ingredient-name">{item.name}</span>
              <span className="ingredient-quantity">
                <input aria-label={`Cantidad de ${item.name} en gramos`} type="text" inputMode="decimal" min="0.1" step="0.1" value={item.quantity} onFocus={(event) => event.currentTarget.select()} onPointerUp={(event) => { event.preventDefault(); event.currentTarget.select(); }} onKeyDown={(event) => { if (["e", "E", "+", "-"].includes(event.key)) event.preventDefault(); }} onInput={(event) => { event.currentTarget.value = event.currentTarget.value.replace(",", ".").replace(/[^\d.]/g, ""); }} onChange={(event) => setIngredients(ingredients.map((ingredient, i) => (i === index ? { ...ingredient, quantity: event.target.value } : ingredient)))} />
                <small>g</small>
              </span>
              <button type="button" className="ingredient-remove" onClick={() => { setIngredients(ingredients.filter((_, i) => i !== index)); onDirtyChange?.(true); }}>
                <Icon name="remove" />Quitar
              </button>
            </label>
          ))}
        </div>
        <NutritionSummary nutrition={preview || {}} size="detail" />
        <button className="primary recipe-submit" disabled={!ingredients.length || saving}>
          {saving ? "Creando…" : "Crear receta"}
        </button>
      </form>
    </Panel>
  );
}
