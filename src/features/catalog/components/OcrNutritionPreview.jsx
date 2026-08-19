import React from "react";
import { Icon } from "../../../components/Icon";
import { formatNumber } from "../../../utils/format";
import { macroCalories, normalizeNumericInput, OCR_MACRO_FIELDS } from "../utils/catalog.utils";

export function OcrNutritionPreview({ data, setData, onAccept, onDiscard }) {
  const missingMacros = OCR_MACRO_FIELDS.filter((field) => data[field] == null);
  const hasBaseQuantity = Number(data.baseQuantity) > 0;
  const derivedCalories = missingMacros.length ? null : macroCalories(data.proteinGrams, data.carbsGrams, data.fatGrams);
  const fields = [
    { key: "baseQuantity", label: data.basisAmbiguous ? "Base a confirmar" : "Valores por", unit: "g", min: "0.1" },
    { key: "proteinGrams", label: "Proteínas", unit: "g" },
    { key: "carbsGrams", label: "Carbohidratos", unit: "g" },
    { key: "fatGrams", label: "Grasas", unit: "g" },
  ];

  function updateNumericField(key, value) {
    setData((current) => ({ ...current, [key]: normalizeNumericInput(value) }));
  }

  return (
    <section className="ocr-preview" aria-label="Vista previa nutricional">
      <header><div><span>Vista previa</span><strong>Información detectada{data.baseQuantity ? ` · por ${formatNumber(data.baseQuantity, 1)} g` : ""}</strong></div><Icon name="document_scanner" /></header>
      <div className="ocr-preview-grid">
        {fields.map(({ key, label, unit, min = "0" }) => (
          <label key={key}><span>{label}</span><div><input type="text" inputMode="decimal" min={min} step="0.1" value={data[key] ?? ""} onKeyDown={(event) => { if (["e", "E", "+", "-"].includes(event.key)) event.preventDefault(); }} onChange={(event) => updateNumericField(key, event.target.value)} /><small>{unit}</small></div></label>
        ))}
        <span className="derived-calories-card"><small>{derivedCalories == null ? "Completá los macros" : "Kcal calculadas"}</small><strong>{derivedCalories == null ? "—" : formatNumber(derivedCalories)}</strong></span>
      </div>
      {data.basisAmbiguous && <p className="ocr-preview-note">La etiqueta incluye valores por porción y por 100 g. Indicá la base de los valores detectados antes de aceptar.</p>}
      {!hasBaseQuantity && !data.basisAmbiguous && <p className="ocr-preview-note">No se detectó la base. Indicá los gramos a los que corresponden los valores.</p>}
      {missingMacros.length > 0 && <p className="ocr-preview-note">Completá manualmente los macros que el OCR no pudo leer antes de guardar.</p>}
      <div className="ocr-preview-actions"><button type="button" className="secondary" onClick={onDiscard}>Descartar</button><button type="button" className="primary" onClick={onAccept} disabled={!hasBaseQuantity}><Icon name="check" />Aceptar valores</button></div>
    </section>
  );
}

export function DerivedCaloriesHint({ values }) {
  return <div className="derived-calories-card"><small>Kcal calculadas</small><strong>{values ? formatNumber(macroCalories(values.proteinGrams, values.carbsGrams, values.fatGrams)) : "P*4 + C*4 + G*9"}</strong></div>;
}
