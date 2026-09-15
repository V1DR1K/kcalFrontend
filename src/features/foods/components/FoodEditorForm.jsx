import React, { useRef, useState } from "react";
import { CATEGORY_OPTIONS } from "../../../config/app";
import { Icon } from "../../../components/Icon";
import { Input, Select } from "../../../components/FormControls";
import { NutritionSummary } from "../../../components/NutritionSummary";
import { DerivedCaloriesHint, OcrNutritionPreview } from "../../catalog/components/OcrNutritionPreview";
import { OCR_MACRO_FIELDS } from "../../catalog/utils/catalog.utils";
import { decimalNumber } from "../../../utils/decimal";

export function FoodEditorForm({ api, food = null, prefillBarcode, clearPrefillBarcode, onDirtyChange, onBusyChange, onDone, id, hideSubmit = false, title = "Nuevo alimento" }) {
  const editing = Boolean(food?.id);
  const formRef = useRef(null);
  const [saving, setSaving] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [ocrStatus, setOcrStatus] = useState("");
  const [ocrData, setOcrData] = useState(null);
  const [form, setForm] = useState(() => ({
    name: food?.name || "",
    brand: food?.brand || "",
    barcode: food?.barcode || prefillBarcode || "",
    category: food?.category || "OTHER",
    baseQuantity: String(food?.baseQuantity || 100),
    proteinGrams: String(food?.proteinGrams ?? ""),
    carbsGrams: String(food?.carbsGrams ?? ""),
    fatGrams: String(food?.fatGrams ?? ""),
    tags: Array.isArray(food?.tags) ? food.tags.join(", ") : food?.tags || "",
  }));

  function setField(name, value) {
    setForm((current) => ({ ...current, [name]: value }));
    onDirtyChange?.(true);
  }

  async function submit(event) {
    event.preventDefault();
    if (saving) return;
    setSaving(true);
    onBusyChange?.(true);
    const payload = {
      name: form.name,
      brand: form.brand,
      barcode: form.barcode,
      category: form.category,
      baseUnit: food?.baseUnit || "GRAM",
      baseQuantity: decimalNumber(form.baseQuantity || 100),
      proteinGrams: decimalNumber(form.proteinGrams),
      carbsGrams: decimalNumber(form.carbsGrams),
      fatGrams: decimalNumber(form.fatGrams),
      preparation: food?.preparation || "UNSPECIFIED",
      servingName: food?.servingName || null,
      servingWeightGrams: food?.servingWeightGrams || null,
      tags: form.tags.split(",").map((tag) => tag.trim()).filter(Boolean),
    };
    try {
      await api.runAction(
        { title: editing ? "Guardando alimento" : "Creando alimento", description: "Estamos actualizando los datos del catálogo..." },
        () => api.request(editing ? `/api/foods/${food.id}` : "/api/foods", { method: editing ? "PUT" : "POST", body: JSON.stringify(payload) }, { quiet: true }),
      );
      api.notify(editing ? "Alimento actualizado." : "Alimento creado.");
      clearPrefillBarcode?.();
      onDirtyChange?.(false);
      onDone?.();
    } catch (error) {
      const details = Object.values(error.fields || {}).join(" · ");
      api.notify(details || error.message || "No se pudo guardar el alimento. Revisá los datos.", "error");
    } finally {
      setSaving(false);
      onBusyChange?.(false);
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
  const formElement = (
    <form id={id} className="form-grid food-editor-form" ref={formRef} onInput={() => onDirtyChange?.(true)} onSubmit={submit}>
      {ocrStatus && <div className={`ocr-status ${ocrStatusClass}`} role="status" aria-live="polite" aria-busy={scanning}>{scanning ? <span className="ocr-loading" /> : null}<span>{ocrStatus}</span></div>}
      {ocrData && <OcrNutritionPreview data={ocrData} setData={setOcrData} onAccept={acceptOcrData} onDiscard={() => { setOcrData(null); setOcrStatus(""); }} />}
      <div className="ocr-actions"><label className="secondary ocr-label"><Icon name="document_scanner" />Escanear tabla nutricional<input type="file" accept="image/*" capture="environment" onChange={(event) => { const file = event.currentTarget.files?.[0]; event.currentTarget.value = ""; setOcrStatus(""); setOcrData(null); handleOcrImage(file); }} hidden disabled={scanning} /></label></div>
      <Input name="name" label="Nombre" value={form.name} onChange={(event) => setField("name", event.target.value)} required />
      <Input name="brand" label="Marca" value={form.brand} onChange={(event) => setField("brand", event.target.value)} />
      <Input name="barcode" label="Código de barras opcional" value={form.barcode} onChange={(event) => setField("barcode", event.target.value)} />
      <Select name="category" label="Categoría" value={form.category} options={CATEGORY_OPTIONS} onChange={(event) => setField("category", event.target.value)} />
      <Input decimal name="baseQuantity" label="Estos valores corresponden a (gramos)" value={form.baseQuantity} onChange={(event) => setField("baseQuantity", event.target.value)} step="0.01" min="0.1" required />
      <div className="split"><Input decimal numericOnly name="proteinGrams" label="Proteínas g" value={form.proteinGrams} onChange={(event) => setField("proteinGrams", event.target.value)} step="0.01" min="0" required /><Input decimal numericOnly name="carbsGrams" label="Carbohidratos g" value={form.carbsGrams} onChange={(event) => setField("carbsGrams", event.target.value)} step="0.01" min="0" required /></div>
      <div className="split"><Input decimal numericOnly name="fatGrams" label="Grasas g" value={form.fatGrams} onChange={(event) => setField("fatGrams", event.target.value)} step="0.01" min="0" required /><DerivedCaloriesHint values={form} /></div>
      <Input name="tags" label="Tags separados por coma" value={form.tags} onChange={(event) => setField("tags", event.target.value)} />
      {!hideSubmit && <button className="primary" disabled={saving || scanning}>{saving ? (editing ? "Guardando…" : "Creando…") : (editing ? "Guardar cambios" : "Crear alimento")}</button>}
    </form>
  );
  return title == null ? formElement : <div className="panel food-editor-panel"><h2>{title}</h2>{formElement}</div>;
}
