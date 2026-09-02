import React, { useEffect, useState } from "react";
import { Input, Select } from "../../components/FormControls";
import { ModalShell } from "../../components/dialog/ModalShell";
import { trainingApi } from "./training-api";

export function GlobalExerciseDialog({ api, module, initialName, onClose, onSaved }) {
  const [name, setName] = useState(initialName || "");
  const [categoryId, setCategoryId] = useState("");
  const [categories, setCategories] = useState([]);
  const [loadingCategories, setLoadingCategories] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let current = true;
    trainingApi.categories(api, { module, size: 100 })
      .then((response) => {
        if (!current) return;
        setCategories((response?.items || []).filter((category) => category.system && category.active !== false));
        setLoadingCategories(false);
      })
      .catch((requestError) => {
        if (!current) return;
        setError(requestError?.message || "No se pudieron cargar las categorías base.");
        setLoadingCategories(false);
      });
    return () => { current = false; };
  }, [api, module]);

  async function submit(event) {
    event.preventDefault();
    event.stopPropagation();
    if (!name.trim()) return setError("Escribí el nombre del ejercicio.");
    if (!categoryId) return setError("Elegí una categoría para el ejercicio.");
    setSaving(true);
    setError("");
    try {
      const saved = await api.runAction(
        { title: "Guardando ejercicio global", description: "Estamos sumándolo al catálogo compartido..." },
        () => trainingApi.saveExercise(api, {}, { name: name.trim(), module, categoryId: Number(categoryId), global: true }),
        { quiet: true },
      );
      api.notify("Ejercicio global creado.");
      onSaved(saved);
      onClose();
    } catch (saveError) {
      setError(saveError?.message || "No se pudo guardar el ejercicio global.");
    } finally {
      setSaving(false);
    }
  }

  const categoryOptions = [
    { value: "", label: loadingCategories ? "Cargando categorías..." : "Elegir categoría" },
    ...categories.map((category) => ({ value: String(category.id), label: category.name })),
  ];

  return (
    <ModalShell
      title="Nuevo ejercicio global"
      description="Quedará disponible para todos los usuarios de este módulo."
      onClose={onClose}
      closeDisabled={saving}
      theme="training"
      className="training-exercise-editor"
      backdropClassName="training-session-backdrop"
      footer={<><button type="button" className="training-secondary" onClick={onClose} disabled={saving}>Cancelar</button><button type="submit" form="global-exercise-form" className="training-primary" disabled={saving || loadingCategories}>{saving ? "Guardando…" : "Agregar ejercicio"}</button></>}
    >
      <form id="global-exercise-form" className="training-editor-form" onSubmit={submit}>
        <Input label="Nombre" value={name} maxLength="120" required onChange={(event) => { setName(event.target.value); setError(""); }} autoFocus />
        <Select label="Categoría base" value={categoryId} options={categoryOptions} disabled={loadingCategories} onChange={(event) => { setCategoryId(event.target.value); setError(""); }} />
        {error && <p className="training-form-error" role="alert">{error}</p>}
      </form>
    </ModalShell>
  );
}
