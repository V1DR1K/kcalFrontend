import React, { useState } from "react";
import { Input } from "../../../components/FormControls";
import { ModalShell } from "../../../components/dialog/ModalShell";
import { decimalNumber } from "../../../utils/decimal";
import { formatNumber } from "../../../utils/format";
import { formatMealLogAmount, mealLogName } from "../dashboard.utils";

function quantityLabel(item) {
  if (item.unit === "PORTION") return "Porciones";
  if (item.unit === "MILLILITER") return "Mililitros";
  if (item.unit === "UNIT") return "Unidades";
  return item.itemType === "RECIPE" ? "Gramos cocidos" : "Gramos";
}

export function RecentMealReviewDialog({ title, destination, items, saving, onClose, onConfirm }) {
  const [quantities, setQuantities] = useState(() => items.map((item) => String(item.quantity ?? "")));
  const ready = items.length > 0 && items.every((item, index) => item.itemType === "AI_ESTIMATE"
    || (Number.isFinite(decimalNumber(quantities[index])) && decimalNumber(quantities[index]) > 0));

  function confirm() {
    if (!ready || saving) return;
    onConfirm(items.map((item, index) => {
      if (item.itemType === "AI_ESTIMATE") return item;
      const quantity = decimalNumber(quantities[index]);
      const factor = quantity / Number(item.quantity || 1);
      return {
        ...item,
        quantity,
        calories: Number(item.calories || 0) * factor,
        proteinGrams: Number(item.proteinGrams || 0) * factor,
        carbsGrams: Number(item.carbsGrams || 0) * factor,
        fatGrams: Number(item.fatGrams || 0) * factor,
      };
    }));
  }

  return (
    <ModalShell
      title={`Revisar ${title}`}
      description={`Revisá los alimentos y ajustá sus cantidades antes de agregar a ${destination}.`}
      onClose={onClose}
      closeDisabled={saving}
      className="recent-review-modal app-modal-compact"
      footer={<><button type="button" className="secondary" disabled={saving} onClick={onClose}>Cancelar</button><button type="button" className="primary" disabled={!ready || saving} onClick={confirm}>{saving ? "Agregando…" : `Agregar a ${destination}`}</button></>}
    >
      <div className="recent-review-items">
        {items.map((item, index) => (
          <div className="recent-review-item" key={`${item.itemType}:${item.id || item.itemId || index}:${index}`}>
            <div><strong>{mealLogName(item) || item.label || "Comida estimada"}</strong><small>{formatNumber(item.calories || 0)} kcal registrados</small></div>
            {item.itemType === "AI_ESTIMATE"
              ? <span className="recent-review-fixed">{formatMealLogAmount(item)}</span>
              : <Input label={quantityLabel(item)} type="text" inputMode="decimal" value={quantities[index]} onChange={(event) => setQuantities((current) => current.map((value, itemIndex) => itemIndex === index ? event.target.value : value))} onFocus={(event) => event.currentTarget.select()} />}
          </div>
        ))}
      </div>
    </ModalShell>
  );
}
