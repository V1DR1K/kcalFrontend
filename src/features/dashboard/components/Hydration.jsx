import React, { useRef, useState } from "react";
import { Input } from "../../../components/FormControls";
import { Icon } from "../../../components/Icon";
import { formatNumber } from "../../../utils/format";

export function Hydration({ api, date, consumed = 0, goal = 0, onSaved, onBusyChange }) {
  const [custom, setCustom] = useState(false);
  const [amount, setAmount] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const saving = useRef(false);
  const ml = /^\d+$/.test(amount) ? Number(amount) : NaN;
  const valid = Number.isInteger(ml) && ml > 0 && ml <= 10000;
  async function save(milliliters) {
    if (saving.current) return;
    saving.current = true; setBusy(true); onBusyChange?.(true); setError("");
    try {
      await api.request(milliliters == null ? `/api/nutrition/water-logs/latest?date=${date}` : "/api/nutrition/water-logs", { method: milliliters == null ? "DELETE" : "POST", ...(milliliters == null ? {} : { body: JSON.stringify({ logDate: date, liters: milliliters / 1000 }) }) });
      setCustom(false); setAmount("");
      api.notify(milliliters == null ? "Último registro de agua eliminado." : `${formatNumber(milliliters)} ml de agua registrados.`);
      await onSaved(date);
    } catch (requestError) { setError(requestError.message || "No se pudo actualizar el agua. Probá de nuevo."); }
    finally { saving.current = false; setBusy(false); onBusyChange?.(false); }
  }
  return <section className="dashboard-water" aria-label="Hidratación" aria-busy={busy}>
    <Icon name="water_drop" /><p><strong>Hidratación</strong><small>{formatNumber(consumed, 2)} L de {formatNumber(goal, 2)} L</small></p>
    <div className="water-actions"><button className="secondary" disabled={busy} onClick={() => save(250)}>+250 ml</button><button className="secondary" disabled={busy} onClick={() => save(500)}>+500 ml</button><button className="secondary" disabled={busy} onClick={() => setCustom(value => !value)} aria-expanded={custom}>Otra cantidad</button><button className="secondary" disabled={busy || !consumed} onClick={() => save(null)} title="Eliminar el último registro de agua de esta fecha">Deshacer</button></div>
    {custom && <form className="water-custom" onSubmit={event => { event.preventDefault(); if (valid) save(ml); }}><Input label="Cantidad de agua (ml)" inputMode="numeric" value={amount} onChange={event => setAmount(event.target.value)} error={amount && !valid ? "Ingresá un número entero entre 1 y 10.000 ml." : ""} /><button className="primary" disabled={busy || !valid}>Registrar agua</button></form>}
    {error && <p role="alert" className="form-error">{error}</p>}
  </section>;
}
