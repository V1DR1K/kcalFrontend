import React, { useState } from "react";
import { Input } from "../../../components/FormControls";
import { Icon } from "../../../components/Icon";
import { Panel, Stat } from "../../../components/Layout";
import { formatNumber, readableDate, today } from "../../../utils/format";

function latestDelta(entries) {
  const last = entries[entries.length - 1];
  const previous = entries[entries.length - 2];
  if (!last || !previous) return 0;
  return Number(last.weightKg) - Number(previous.weightKg);
}

function dateLabel(value) {
  const parts = String(value || "").split("-");
  return parts.length === 3 ? `${parts[2]}/${parts[1]}` : value;
}

export function WeightPanel({ api, profile, setProfile, entries, setEntries, weight, setWeight, savingWeight, setSavingWeight }) {
  async function record(event) {
    event.preventDefault();
    if (savingWeight) return;
    setSavingWeight(true);
    try {
      const payload = await api.runAction({ title: "Anotando peso", description: "Estamos guardando tu registro..." }, () => api.request("/api/profile/weight-entries", { method: "POST", body: JSON.stringify({ weightKg: Number(weight), entryDate: today() }) }), { quiet: true });
      setEntries((current) => [...current.filter((entry) => entry.entryDate !== payload.entryDate), payload].sort((a, b) => a.entryDate.localeCompare(b.entryDate)));
      setProfile({ ...profile, weightKg: Number(payload.weightKg) });
      setWeight(payload.weightKg);
      api.notify("Peso registrado.");
    } catch { api.notify("No se pudo registrar el peso.", "error"); }
    finally { setSavingWeight(false); }
  }
  async function remove(entry) {
    const confirmed = await api.confirm({ title: "¿Quitar este registro?", description: `Se borrará el peso del ${entry.entryDate} (${formatNumber(entry.weightKg, 1)} kg).`, confirmLabel: "Quitar", tone: "neutral" });
    if (!confirmed) return;
    try { await api.request(`/api/profile/weight-entries/${entry.id}`, { method: "DELETE" }); setEntries((current) => current.filter((item) => item.id !== entry.id)); api.notify("Registro eliminado."); }
    catch { api.notify("No se pudo eliminar el registro.", "error"); }
  }
  const filtered = entries.filter((entry) => entry.entryDate <= today());
  return <Panel title="Peso" className="weight-panel">
    <div className="grid three weight-summary"><Stat icon="monitor_weight" label="Actual" value={`${formatNumber(profile?.weightKg, 1)} kg`} />{entries.length === 0 ? <Stat icon="trending_up" label="Tendencia" value="Sin datos" /> : <Stat icon={latestDelta(entries) >= 0 ? "trending_up" : "trending_down"} label={latestDelta(entries) === 0 ? "Último cambio" : "Cambio últ. registro"} value={`${latestDelta(entries) > 0 ? "+" : ""}${formatNumber(latestDelta(entries), 1)} kg`} />}<Stat icon="flag" label="Meta" value={profile?.targetWeightKg ? `${formatNumber(profile.targetWeightKg, 1)} kg` : "—"} /></div>
    <WeightChart entries={filtered} />
    <form onSubmit={record} className="weight-record-form"><Input label="Peso actual (kg)" type="number" min="20" max="400" step="0.1" inputMode="decimal" value={weight} onChange={(event) => setWeight(event.target.value)} required /><button className="secondary" disabled={savingWeight}>{savingWeight ? "Guardando…" : "Anotar peso"}</button></form>
    {entries.length > 0 && <div className="weight-history">{entries.slice().reverse().map((entry) => <div className="weight-history-row" key={entry.id}><span className="weight-history-date">{readableDate(entry.entryDate)}</span><strong>{formatNumber(entry.weightKg, 1)} kg</strong><button type="button" className="ghost-icon" onClick={() => remove(entry)} aria-label={`Quitar peso del ${entry.entryDate}`}><Icon name="delete" /></button></div>)}</div>}
  </Panel>;
}

export function WeightChart({ entries }) {
  if (entries.length < 2) return <p className="weight-chart-empty">Anotá tu peso dos o más veces para ver la curva.</p>;
  const width = 640; const height = 170; const padX = 34; const padTop = 18; const padBottom = 34;
  const values = entries.map((entry) => Number(entry.weightKg)); const min = Math.min(...values); const max = Math.max(...values); const span = max - min || 1; const plotHeight = height - padTop - padBottom;
  const xFor = (index) => padX + (index / (entries.length - 1)) * (width - padX * 2); const yFor = (value) => padTop + ((max - value) / span) * plotHeight; const points = entries.map((entry, index) => `${xFor(index)},${yFor(Number(entry.weightKg))}`).join(" "); const areaPoints = `${padX},${padTop + plotHeight} ${points} ${xFor(entries.length - 1)},${padTop + plotHeight}`; const midY = yFor((min + max) / 2);
  return <div className="weight-chart"><svg viewBox={`0 0 ${width} ${height}`} className="weight-curve" role="img" aria-label="Curva de peso"><defs><linearGradient id="weightArea" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="var(--primary)" stopOpacity="0.28" /><stop offset="100%" stopColor="var(--primary)" stopOpacity="0" /></linearGradient></defs><line x1={padX} y1={yFor(min)} x2={width - padX} y2={yFor(min)} stroke="var(--outline)" strokeDasharray="3 4" /><line x1={padX} y1={midY} x2={width - padX} y2={midY} stroke="var(--outline)" strokeDasharray="3 4" /><line x1={padX} y1={yFor(max)} x2={width - padX} y2={yFor(max)} stroke="var(--outline)" strokeDasharray="3 4" /><polygon points={areaPoints} fill="url(#weightArea)" /><polyline points={points} fill="none" stroke="var(--primary)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />{entries.map((entry, index) => <circle key={entry.id} cx={xFor(index)} cy={yFor(Number(entry.weightKg))} r="4.5" fill="var(--background)" stroke="var(--primary)" strokeWidth="2.5" />)}<text x={8} y={yFor(max) + 4} fontSize="11" fill="var(--muted)">{formatNumber(max, 1)}</text><text x={8} y={yFor(min) + 4} fontSize="11" fill="var(--muted)">{formatNumber(min, 1)}</text><text x={xFor(0)} y={height - 8} fontSize="11" fill="var(--muted)">{dateLabel(entries[0].entryDate)}</text><text x={xFor(entries.length - 1)} y={height - 8} fontSize="11" fill="var(--muted)" textAnchor="end">{dateLabel(entries[entries.length - 1].entryDate)}</text><text x={(padX + width - padX) / 2} y={12} fontSize="11" fill="var(--muted)" textAnchor="middle">{`${formatNumber(min, 1)} – ${formatNumber(max, 1)} kg`}</text></svg></div>;
}

export function ChangePasswordForm({ api }) {
  const [currentPassword, setCurrentPassword] = useState(""); const [newPassword, setNewPassword] = useState(""); const [confirmPassword, setConfirmPassword] = useState(""); const [saving, setSaving] = useState(false); const [fieldErrors, setFieldErrors] = useState({});
  async function submit(event) { event.preventDefault(); setFieldErrors({}); if (newPassword.length < 8) return setFieldErrors({ newPassword: "La contraseña debe tener al menos 8 caracteres." }); if (newPassword !== confirmPassword) return setFieldErrors({ confirmPassword: "Las contraseñas no coinciden." }); if (saving) return; setSaving(true); try { await api.runAction({ title: "Actualizando contraseña", description: "Creamos una nueva sesión segura..." }, () => api.request("/api/auth/change-password", { method: "PUT", body: JSON.stringify({ currentPassword, newPassword }) }), { quiet: true }); setCurrentPassword(""); setNewPassword(""); setConfirmPassword(""); api.notify("Contraseña actualizada. Tu sesión sigue activa."); } catch (error) { api.notify(error?.message || "No se pudo actualizar la contraseña.", "error"); } finally { setSaving(false); } }
  return <form className="change-password-form" onSubmit={submit}><strong>Cambiar contraseña</strong><Input label="Contraseña actual" type="password" autoComplete="current-password" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} required error={fieldErrors.currentPassword} /><div className="split"><Input label="Nueva contraseña" type="password" autoComplete="new-password" minLength="8" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} required error={fieldErrors.newPassword} /><Input label="Repetir nueva" type="password" autoComplete="new-password" minLength="8" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} required error={fieldErrors.confirmPassword} /></div><button className="secondary" disabled={saving}>{saving ? "Guardando..." : "Cambiar contraseña"}</button></form>;
}

export function MacroControl({ label, description, value, grams, onChange, tone }) { return <label className={`macro-control ${tone}`}><span><strong>{label}</strong>{description && <small className="macro-control-description">{description}</small>}<small className="macro-control-grams">{grams}g por día</small></span><output>{formatNumber(value, 1)}%</output><input type="range" min="0" max="100" step="0.5" value={value} aria-label={`${label} porcentaje`} onChange={(event) => onChange(event.target.value)} /></label>; }

export function NutritionTutorial() { const items = [["Calorías", "Son tu presupuesto diario de energía. Si el objetivo no se sostiene en la vida real, conviene ajustar antes que abandonar."], ["Proteínas", "Ayudan con saciedad y mantenimiento muscular. Pensalas como una base diaria, no como algo solo para deportistas."], ["Carbohidratos", "Son una fuente práctica de energía. Su cantidad puede subir si entrenás más o bajar si preferís comidas más grasas."], ["Grasas", "Son importantes para hormonas, absorción de vitaminas y adherencia. Priorizá fuentes de calidad."], ["Cómo elegir", "Empezá balanceado, medí adherencia y progreso dos semanas, y ajustá de a poco. Si tenés patologías, consultá a un profesional."]]; return <Panel title="Mini guía para pensar tu alimentación"><div className="tutorial-list">{items.map(([title, body]) => <details key={title}><summary>{title}</summary><p>{body}</p></details>)}</div></Panel>; }
