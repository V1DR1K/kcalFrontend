import React, { useCallback, useEffect, useState } from "react";
import { DEFAULT_MEALS } from "../../config/app";
import { Icon } from "../../components/Icon";
import { Input, Select } from "../../components/FormControls";
import { Header, Panel } from "../../components/Layout";
import { CatalogStatus, FoodThumb, PreparationBadge, categoryLabel, preparationLabel } from "../catalog/CatalogComponents";
import { rememberItem, rememberMeal } from "../../services/recents";
import { formatNumber, today } from "../../utils/format";

export function ConfigureFood({ api, setPage, foodId, user }) {
  const [activeFoodId, setActiveFoodId] = useState(foodId);
  const [quantity, setQuantity] = useState("150");
  const [unit, setUnit] = useState("GRAM");
  const [mealType, setMealType] = useState("LUNCH");
  const [mealTypes, setMealTypes] = useState(DEFAULT_MEALS);
  const [food, setFood] = useState(null);
  const [preparationOptions, setPreparationOptions] = useState([]);
  const [preview, setPreview] = useState(null);
  const [adding, setAdding] = useState(false);
  const [foodError, setFoodError] = useState("");
  const loadFood = useCallback(
    (id) => {
      if (!id) return;
      setFood(null);
      setFoodError("");
      api
        .runAction(
          { title: "Cargando alimento", description: "Estamos preparando sus datos nutricionales..." },
          () => api.request(`/api/foods/${id}`),
        )
        .then((nextFood) => {
          setFood(nextFood);
          if (nextFood.servingWeightGrams) {
            setQuantity("1");
            setUnit("SERVING");
          } else {
            setQuantity(nextFood.category === "FAT" ? "10" : "100");
            setUnit("GRAM");
          }
        })
        .catch(() => setFoodError("No pudimos cargar este alimento."));
    },
    [api],
  );
  useEffect(() => {
    api
      .request("/api/nutrition/meal-types")
      .then(setMealTypes)
      .catch(() => setMealTypes(DEFAULT_MEALS));
  }, [api]);
  useEffect(() => {
    setActiveFoodId(foodId);
  }, [foodId]);
  useEffect(() => {
    loadFood(activeFoodId);
  }, [activeFoodId, loadFood]);
  useEffect(() => {
    if (foodId)
      api
        .runAction(
          { title: "Cargando opciones", description: "Estamos buscando las presentaciones disponibles..." },
          () => api.request(`/api/foods/${foodId}/preparations`),
        )
        .then(setPreparationOptions)
        .catch(() => setPreparationOptions([]));
  }, [api, foodId]);
  useEffect(() => {
    const numericQuantity = Number(quantity);
    if (!activeFoodId || !Number.isFinite(numericQuantity) || numericQuantity <= 0) {
      setPreview(null);
      return;
    }
    const quantityInGrams = unit === "SERVING" ? numericQuantity * Number(food?.servingWeightGrams || 0) : numericQuantity;
    if (quantityInGrams <= 0) return setPreview(null);
    api
      .request("/api/foods/preview", {
        method: "POST",
        body: JSON.stringify({
          foodId: activeFoodId,
          quantity: quantityInGrams,
          unit: "GRAM",
        }),
      })
      .then(setPreview)
      .catch(() => setPreview(null));
  }, [activeFoodId, api, food, quantity, unit]);
  async function add() {
    const numericQuantity = Number(quantity);
    if (!Number.isFinite(numericQuantity) || numericQuantity <= 0 || adding) return;
    const quantityInGrams = unit === "SERVING" ? numericQuantity * Number(food?.servingWeightGrams || 0) : numericQuantity;
    if (quantityInGrams <= 0) return;
    setAdding(true);
    try {
      const log = await api.runAction(
        { title: "Agregando alimento", description: `Estamos sumando ${food?.name || "el alimento"} a tu dia...` },
        () => api.request("/api/nutrition/meal-logs", {
          method: "POST",
          body: JSON.stringify({
            itemType: "FOOD",
            itemId: activeFoodId,
            mealType,
            quantity: quantityInGrams,
            unit: "GRAM",
            logDate: today(),
          }),
        }),
      );
      if (food) rememberItem(user, { ...food, type: "FOOD" });
      rememberMeal(user, mealType, log);
      api.notify("Alimento agregado.");
      setPage("dashboard");
    } catch {
      api.notify("No se pudo agregar el alimento.", "error");
      setAdding(false);
    }
  }
  const configureUnitOptions = food?.servingWeightGrams
    ? [
        { value: "GRAM", label: "Gramos" },
        {
          value: "SERVING",
          label: `${food.servingName || "Porción"} (${formatNumber(food.servingWeightGrams, 1)} g)`,
        },
      ]
    : [{ value: "GRAM", label: "Gramos" }];
  const preparationSelectOptions = preparationOptions.map((option) => ({
    value: String(option.id),
    label: preparationLabel(option.preparation),
  }));
  if (foodError)
    return (
      <section className="page narrow configure-page">
        <button className="back-button configure-back" onClick={() => setPage("foods")}>
          <Icon name="arrow_back" />Alimentos
        </button>
        <Header title="Configurar alimento" />
        <CatalogStatus error>
          {foodError}
          <button className="secondary" onClick={() => loadFood(activeFoodId)}>
            Reintentar
          </button>
        </CatalogStatus>
      </section>
    );
  return (
    <section className="page narrow configure-page">
      <button className="back-button configure-back" onClick={() => setPage("foods")}>
        <Icon name="arrow_back" />Alimentos
      </button>
      <Header title="Configurar alimento" />
      <Panel className="configure-panel">
        <div className="configure-food-heading">
          <FoodThumb item={{ ...food, type: "FOOD" }} hero />
          <div>
            <span>Porción</span>
            <h2>{food?.name || "Cargando..."}</h2>
            <small>{food?.brand || categoryLabel(food?.category)}</small>
            <PreparationBadge food={food} showUnknown />
          </div>
        </div>
        {preparationSelectOptions.length > 1 && (
          <Select
            label="Peso del alimento"
            value={String(activeFoodId)}
            onChange={(event) => {
              setActiveFoodId(Number(event.target.value));
              setUnit("GRAM");
            }}
            options={preparationSelectOptions}
          />
        )}
        <div className="split configure-fields">
          <Input selectOnFocus label="Cantidad" value={quantity} onChange={(event) => setQuantity(event.target.value)} type="number" inputMode="decimal" min="0.1" step="0.1" />
          <Select label="Unidad" value={unit} onChange={(event) => setUnit(event.target.value)} options={configureUnitOptions} />
        </div>
        <label className="field">
          <span>Comida</span>
          <select value={mealType} onChange={(event) => setMealType(event.target.value)}>
            {mealTypes.map((meal) => (
              <option key={meal.code} value={meal.code}>
                {meal.label}
              </option>
            ))}
          </select>
        </label>
        <div className="preview configure-preview">
          <strong>{formatNumber(preview?.calories)} kcal</strong>
          <small>
            P {formatNumber(preview?.proteinGrams, 1)}g · C {formatNumber(preview?.carbsGrams, 1)}g · G {formatNumber(preview?.fatGrams, 1)}g
          </small>
        </div>
        <button className="primary configure-submit" disabled={adding || !food || !activeFoodId || Number(quantity) <= 0} onClick={add}>
          {adding ? "Agregando…" : "Agregar producto"}
        </button>
      </Panel>
    </section>
  );
}
