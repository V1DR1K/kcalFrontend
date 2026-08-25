import React, { useEffect, useId, useRef, useState } from "react";
import { CATEGORY_OPTIONS, PREPARATION_OPTIONS } from "../../../config/app";
import { Icon } from "../../../components/Icon";
import { InfiniteSentinel } from "../../../components/InfiniteSentinel";
import { Input, Select } from "../../../components/FormControls";
import { CatalogRowWithImage, CatalogStatus, FoodThumb, NutrientDetails, PreparationBadge, categoryLabel, groupFoodVariants, preparationLabel } from "../../catalog/CatalogComponents";
import { EditFoodLog, FoodLogDialog, FoodLogForm } from "../../foods/FoodComponents";
import { usePagedCatalog } from "../../catalog/usePagedCatalog";
import { readRecents, rememberItem, rememberMeal } from "../../../services/recents";
import { formatNumber, readableDate } from "../../../utils/format";
import { aiEstimateDraft, aiEstimateWithServings, aiProposalFood, aiQuotaReset, createMealLogs, foodPreparationSuffix, formatMealLogAmount, isCopyableMealLog, macroCalories, macroValue, mealLogItem, mealLogName, mealTotals, savedAiEstimate, scaleFoodNutrition } from "../dashboard.utils";
import { MealPhotoContextEditor as MealPhotoContextEditorDialog } from "./MealPhotoDialog";
import { ModalShell } from "../../../components/dialog/ModalShell";
import { compressMealPhoto } from "../../../services/image";

import { AiEstimateEditor } from "./AiEstimateEditor";
export { FoodPicker, AiEstimateEditor };

function FoodPicker({ api, user, mealType, selectedDate, onClose, onDone, onOptimisticAdd, onOptimisticRollback, draftOnly = false, onDraftAdd }) {
  const pickerTitleId = `${useId().replace(/:/g, "")}-title`;
  const [tab, setTab] = useState("FOOD");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState(null);
  const [selectedPreparations, setSelectedPreparations] = useState([]);
  const [quantity, setQuantity] = useState("150");
  const [unit, setUnit] = useState("GRAM");
  const [preview, setPreview] = useState(null);
  const [adding, setAdding] = useState(false);
  const [recipeDetail, setRecipeDetail] = useState(null);
  const [recipeIngredients, setRecipeIngredients] = useState(null);
  const [aiUsage, setAiUsage] = useState(null);
  const [aiAnalyzing, setAiAnalyzing] = useState(false);
  const [aiEstimate, setAiEstimate] = useState(null);
  const [aiError, setAiError] = useState("");
  const [aiContext, setAiContext] = useState("");
  const [aiEstimatePhoto, setAiEstimatePhoto] = useState(null);
  const [aiCorrection, setAiCorrection] = useState("");
  const [aiRefining, setAiRefining] = useState(false);
  const [aiRefinementError, setAiRefinementError] = useState("");
  const [pendingMealPhoto, setPendingMealPhoto] = useState(null);
  const [pendingMealPhotoUrl, setPendingMealPhotoUrl] = useState("");
  const [audioRecording, setAudioRecording] = useState(false);
  const [audioTranscribing, setAudioTranscribing] = useState(false);
  const galleryInputRef = useRef(null);
  const audioRecorderRef = useRef(null);
  const audioStreamRef = useRef(null);
  const aiQuotaBlocked = Boolean(aiUsage?.blockedUntil && new Date(aiUsage.blockedUntil) > new Date());
  const recentFoods = readRecents(user).items.slice(0, 20).map((item) => ({ ...item, type: "FOOD" }));
  const normalizedQuery = query.trim();
  const foodSearchReady = tab !== "FOOD" || normalizedQuery.length >= 2;
  const catalog = usePagedCatalog({
    api,
    endpoint: tab === "FOOD" ? "/api/foods" : tab === "RECIPE" ? "/api/recipes" : tab === "MINE" ? "/api/foods/mine" : "/api/nutrition/recent-meals",
    query,
    enabled: foodSearchReady,
  });
  useEffect(() => {
    api.request("/api/nutrition/ai-estimates/usage").then(setAiUsage).catch(() => setAiUsage(null));
  }, [api]);
  useEffect(() => () => {
    audioRecorderRef.current?.stop?.();
    audioStreamRef.current?.getTracks().forEach((track) => track.stop());
  }, []);
  useEffect(() => {
    if (!pendingMealPhoto) {
      setPendingMealPhotoUrl("");
      return undefined;
    }
    const source = URL.createObjectURL(pendingMealPhoto);
    setPendingMealPhotoUrl(source);
    return () => URL.revokeObjectURL(source);
  }, [pendingMealPhoto]);
  function selectMealPhoto(file) {
    if (!file || aiAnalyzing) return;
    setAiError("");
    setAiContext("");
    setAiEstimatePhoto(null);
    setAiCorrection("");
    setAiRefinementError("");
    setPendingMealPhoto(file);
  }
  function discardMealPhoto() {
    if (audioRecording) audioRecorderRef.current?.stop();
    setAiError("");
    setAiContext("");
    setAiEstimatePhoto(null);
    setAiCorrection("");
    setAiRefinementError("");
    setPendingMealPhoto(null);
  }
  async function toggleMealNoteRecording() {
    if (audioRecording) return audioRecorderRef.current?.stop();
    if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) {
      setAiError("Tu navegador no permite dictar una descripción. Escribila manualmente.");
      return;
    }
    setAiError("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const preferredType = ["audio/mp4", "audio/webm;codecs=opus", "audio/webm"].find((type) => MediaRecorder.isTypeSupported?.(type));
      const recorder = new MediaRecorder(stream, preferredType ? { mimeType: preferredType } : undefined);
      const chunks = [];
      audioStreamRef.current = stream;
      audioRecorderRef.current = recorder;
      recorder.ondataavailable = (event) => event.data.size && chunks.push(event.data);
      recorder.onstop = async () => {
        stream.getTracks().forEach((track) => track.stop());
        audioStreamRef.current = null;
        audioRecorderRef.current = null;
        setAudioRecording(false);
        if (!chunks.length) return;
        setAudioTranscribing(true);
        try {
          const type = recorder.mimeType || "audio/mp4";
          const extension = type.includes("mp4") ? "m4a" : "webm";
          const form = new FormData();
          form.append("audio", new File([new Blob(chunks, { type })], `descripcion.${extension}`, { type }));
          const result = await api.runAction(
            { title: "Transcribiendo tu descripción", description: "Estamos preparando el contexto para analizar la comida..." },
            () => api.request("/api/nutrition/ai-estimates/transcriptions", { method: "POST", body: form }),
          );
          if (!result?.transcript) throw new Error("No pudimos transcribir la nota. Intentá nuevamente.");
          setAiContext(result.transcript);
        } catch (error) {
          const message = error.message || "No pudimos transcribir la nota. Intentá nuevamente.";
          setAiError(message);
          api.notify(message, "error");
        } finally {
          setAudioTranscribing(false);
        }
      };
      recorder.start();
      setAudioRecording(true);
    } catch {
      setAiError("No pudimos acceder al micrófono. Podés escribir una descripción manualmente.");
    }
  }
  async function analyzeMealPhoto(file) {
    if (!file || aiAnalyzing) return;
    setAiError("");
    setAiAnalyzing(true);
    try {
      const image = await compressMealPhoto(file);
      const form = new FormData();
      form.append("image", image);
      if (aiContext.trim()) form.append("context", aiContext.trim());
      const result = await api.runAction(
        { title: "Analizando tu comida", description: "Estamos estimando los alimentos y las porciones visibles..." },
        () => api.request("/api/nutrition/ai-estimates", { method: "POST", body: form }),
      );
      if (!result?.items?.length) throw new Error("La IA no pudo identificar alimentos en esta foto. Probá con mejor luz.");
      setAiEstimate(aiEstimateWithServings(result));
      setAiUsage(result.usage);
      setAiEstimatePhoto(image);
      setAiCorrection("");
      setAiRefinementError("");
      setPendingMealPhoto(null);
    } catch (error) {
      const message = error.message || "No se pudo analizar la foto.";
      setAiError(message);
      api.notify(message, "error");
    } finally {
      setAiAnalyzing(false);
    }
  }
  async function refineAiEstimate() {
    if (!aiEstimatePhoto || !aiEstimate || !aiCorrection.trim() || aiRefining) return;
    setAiRefinementError("");
    setAiRefining(true);
    try {
      const form = new FormData();
      form.append("image", aiEstimatePhoto);
      if (aiContext.trim()) form.append("context", aiContext.trim());
      form.append("request", new Blob([JSON.stringify({
        currentEstimate: aiEstimateDraft(aiEstimate),
        correction: aiCorrection.trim(),
      })], { type: "application/json" }));
      const result = await api.runAction(
        { title: "Corrigiendo estimación", description: "Estamos revisando la foto, tu observación y los cambios actuales..." },
        () => api.request("/api/nutrition/ai-estimates/refinements", { method: "POST", body: form }),
      );
      if (!result?.items?.length) throw new Error("La IA no pudo corregir esta estimación. Probá con una indicación más precisa.");
      setAiEstimate(aiEstimateWithServings(result));
      setAiUsage(result.usage);
      setAiCorrection("");
    } catch (error) {
      const message = error.message || "No se pudo corregir la estimación.";
      setAiRefinementError(message);
      api.notify(message, "error");
    } finally {
      setAiRefining(false);
    }
  }
  function discardAiEstimate() {
    setAiEstimate(null);
    setAiEstimatePhoto(null);
    setAiContext("");
    setAiCorrection("");
    setAiRefinementError("");
  }
  async function confirmAiEstimate(estimate) {
    if (adding) return;
    if (draftOnly) {
      const nutrition = (estimate.items || []).reduce((sum, item) => {
        const scaled = scaleFoodNutrition(aiProposalFood(item), Number(item.estimatedGrams));
        return {
          proteinGrams: sum.proteinGrams + scaled.proteinGrams,
          carbsGrams: sum.carbsGrams + scaled.carbsGrams,
          fatGrams: sum.fatGrams + scaled.fatGrams,
        };
      }, { proteinGrams: 0, carbsGrams: 0, fatGrams: 0 });
      onDraftAdd?.({
        itemType: "AI_ESTIMATE", itemId: null, mealType: mealType.code, quantity: 1, unit: "PORTION",
        displayName: estimate.name || "Comida estimada", calories: macroCalories(nutrition.proteinGrams, nutrition.carbsGrams, nutrition.fatGrams),
        proteinGrams: nutrition.proteinGrams, carbsGrams: nutrition.carbsGrams, fatGrams: nutrition.fatGrams,
        aiEstimateConfidence: estimate.confidence || 0,
        aiEstimateDetails: JSON.stringify({ description: estimate.description || "", assumptions: estimate.assumptions || [], items: estimate.items || [] }),
      });
      discardAiEstimate();
      onClose();
      return;
    }
    setAdding(true);
    try {
      await api.runAction(
        { title: "Agregando estimación", description: "Estamos sumando los macros revisados a tu comida..." },
        () => api.request("/api/nutrition/ai-estimates/confirm", {
          method: "POST",
          body: JSON.stringify({
            mealType: mealType.code,
            logDate: selectedDate,
            items: estimate.items.map((item) => {
              const servedGrams = Number(item.estimatedGrams);
              const proposal = aiProposalFood(item);
              return {
                servedGrams,
                proposal: {
                  name: proposal.name,
                  category: proposal.category,
                  preparation: proposal.preparation,
                  proteinGrams: proposal.proteinGrams,
                  carbsGrams: proposal.carbsGrams,
                  fatGrams: proposal.fatGrams,
                  nutrients: proposal.nutrients,
                },
              };
            }),
          }),
        }),
      );
      api.notify("Alimentos agregados. Revisá siempre las porciones y salsas.");
      discardAiEstimate();
      onDone();
    } catch (error) {
      api.notify(error.message || "No se pudo guardar la estimación.", "error");
    } finally {
      setAdding(false);
    }
  }
  useEffect(() => {
    if (!selected || selected.type !== "FOOD") return setSelectedPreparations([]);
    api
      .runAction(
        { title: "Cargando opciones", description: "Estamos buscando las presentaciones disponibles..." },
        () => api.request(`/api/foods/${selected.id}/preparations`),
        { quiet: true },
      )
      .then(setSelectedPreparations)
      .catch(() => setSelectedPreparations([]));
  }, [api, selected?.id, selected?.type]);
  useEffect(() => {
    if (!selected) return;
    if (selected.type === "FOOD" && selected.servingWeightGrams) {
      setQuantity("1");
      setUnit("SERVING");
    } else if (selected.type === "RECIPE") {
      setQuantity("1");
      setUnit("PORTION");
    } else {
      setQuantity(selected.category === "FAT" ? "10" : "100");
      setUnit("GRAM");
    }
  }, [selected?.category, selected?.id, selected?.servingWeightGrams, selected?.type]);
  useEffect(() => {
    if (!selected || selected.type !== "RECIPE") {
      setRecipeDetail(null);
      setRecipeIngredients(null);
      return;
    }
    api
      .request(`/api/recipes/${selected.id}`)
      .then((fullRecipe) => {
        setRecipeDetail(fullRecipe);
        setRecipeIngredients((fullRecipe.ingredients || []).map((ing) => ({
          foodId: ing.food?.id,
          name: ing.food?.name || "Alimento",
          quantity: String(ing.quantity ?? ""),
          unit: ing.unit || "GRAM",
        })));
      })
      .catch(() => {
        setRecipeDetail(null);
        setRecipeIngredients(null);
      });
  }, [api, selected?.id, selected?.type]);
  useEffect(() => {
    if (selected?.type === "RECIPE" && unit !== "PORTION") setUnit("PORTION");
    if (selected?.type !== "RECIPE" && !selected?.servingWeightGrams && unit === "SERVING") setUnit("GRAM");
  }, [selected, unit]);
  useEffect(() => {
    const numericQuantity = Number(quantity);
    if (!selected || !Number.isFinite(numericQuantity) || numericQuantity <= 0) return setPreview(null);
    if (selected.type === "FOOD") {
      const quantityInGrams = unit === "SERVING" ? numericQuantity * Number(selected.servingWeightGrams || 0) : numericQuantity;
      if (quantityInGrams <= 0) return setPreview(null);
      api
        .request("/api/foods/preview", {
          method: "POST",
          body: JSON.stringify({
            foodId: selected.id,
            quantity: quantityInGrams,
            unit: "GRAM",
          }),
        })
        .then(setPreview)
        .catch(() => setPreview(null));
    } else if (selected.type === "RECIPE" && recipeIngredients) {
      const nutrition = recipeIngredients.reduce((total, ing) => {
        const food = recipeDetail?.ingredients?.find((entry) => entry.food?.id === ing.foodId)?.food;
        const factor = Number(ing.quantity) / Number(food?.baseQuantity || 100);
        return {
          proteinGrams: total.proteinGrams + Number(food?.proteinGrams || 0) * factor,
          carbsGrams: total.carbsGrams + Number(food?.carbsGrams || 0) * factor,
          fatGrams: total.fatGrams + Number(food?.fatGrams || 0) * factor,
        };
      }, { proteinGrams: 0, carbsGrams: 0, fatGrams: 0 });
      setPreview({
        calories: Math.round((nutrition.proteinGrams * 4 + nutrition.carbsGrams * 4 + nutrition.fatGrams * 9) * numericQuantity),
        proteinGrams: nutrition.proteinGrams * numericQuantity,
        carbsGrams: nutrition.carbsGrams * numericQuantity,
        fatGrams: nutrition.fatGrams * numericQuantity,
      });
    } else {
      setPreview({
        calories: Math.round(selected.calories * numericQuantity),
        proteinGrams: selected.proteinGrams * numericQuantity,
        carbsGrams: selected.carbsGrams * numericQuantity,
        fatGrams: selected.fatGrams * numericQuantity,
      });
    }
  }, [api, recipeDetail, recipeIngredients, selected, quantity, unit]);
  async function add() {
    const numericQuantity = Number(quantity);
    if (!Number.isFinite(numericQuantity) || numericQuantity <= 0 || adding) return;
    const logQuantity = selected.type === "FOOD" && unit === "SERVING" ? numericQuantity * Number(selected.servingWeightGrams || 0) : numericQuantity;
    if (logQuantity <= 0) return;
    if (draftOnly) {
      onDraftAdd?.({
        itemType: selected.type,
        itemId: selected.id,
        mealType: mealType.code,
        quantity: logQuantity,
        unit: selected.type === "RECIPE" ? "PORTION" : "GRAM",
        displayName: selected.name,
        calories: preview?.calories || 0,
        proteinGrams: preview?.proteinGrams || 0,
        carbsGrams: preview?.carbsGrams || 0,
        fatGrams: preview?.fatGrams || 0,
      });
      onClose();
      return;
    }
    setAdding(true);
    const optimisticLogs = onOptimisticAdd([{
      itemType: selected.type,
      food: selected.type === "FOOD" ? selected : null,
      recipe: selected.type === "RECIPE" ? { ...selected, ...recipeDetail } : null,
      quantity: logQuantity,
      unit: selected.type === "RECIPE" ? "PORTION" : "GRAM",
      ...preview,
    }], mealType.code);
    try {
      const log = await api.runAction(
        { title: "Agregando alimento", description: `Estamos sumando ${selected.name} a ${mealType.label.toLowerCase()}...` },
        async () => {
           if (selected.type === "RECIPE" && recipeIngredients && recipeDetail) {
             const baseIngredients = (recipeDetail.ingredients || []).map((ing) => ({
              foodId: ing.food?.id,
              quantity: Number(ing.quantity ?? 0),
              unit: ing.unit || "GRAM",
            }));
            const changed = recipeIngredients.some((ing, i) => {
              const base = baseIngredients[i];
              return !base || Number(ing.quantity) !== Number(base.quantity);
             });
             if (changed) {
               return api.request("/api/nutrition/meal-logs/recipe", {
                 method: "POST",
                 body: JSON.stringify({
                   recipeId: selected.id,
                   mealType: mealType.code,
                   quantity: logQuantity,
                   logDate: selectedDate,
                   ingredients: recipeIngredients.map(({ foodId, quantity: ingQty, unit }) => ({ foodId, quantity: Number(ingQty), unit })),
                 }),
               });
             }
           }
           return api.request("/api/nutrition/meal-logs", {
             method: "POST",
             body: JSON.stringify({
               itemType: selected.type,
               itemId: selected.id,
               mealType: mealType.code,
               quantity: logQuantity,
               unit: selected.type === "RECIPE" ? "PORTION" : "GRAM",
               logDate: selectedDate,
             }),
           });
        },
        { quiet: true },
      );
      rememberItem(user, selected);
      rememberMeal(user, mealType.code, log);
      api.notify(`${selected.name} agregado a ${mealType.label}.`);
      onDone();
    } catch {
      onOptimisticRollback(optimisticLogs);
      api.notify("No se pudo agregar el alimento. Se revirtieron los cambios.", "error");
      setAdding(false);
    }
  }
  const selectedUnitOptions =
    selected?.type === "RECIPE"
      ? [{ value: "PORTION", label: "Porciones" }]
      : selected?.type === "FOOD" && selected?.servingWeightGrams
      ? [
          { value: "GRAM", label: "Gramos" },
          {
            value: "SERVING",
            label: `${selected.servingName || "Porción"} (${formatNumber(selected.servingWeightGrams, 1)} g)`,
          },
        ]
      : [{ value: "GRAM", label: "Gramos" }];
  function changeSelectedUnit(nextUnit) {
    if (nextUnit === unit) return;
    const numericQuantity = Number(quantity);
    const servingGrams = Number(selected?.servingWeightGrams);
    if (Number.isFinite(numericQuantity) && numericQuantity > 0 && Number.isFinite(servingGrams) && servingGrams > 0) {
      const converted = nextUnit === "GRAM" ? numericQuantity * servingGrams : numericQuantity / servingGrams;
      setQuantity(String(Number(converted.toFixed(2))));
    }
    setUnit(nextUnit);
  }
  function changeTab(nextTab) {
    setTab(nextTab);
    setQuery("");
    setSelected(null);
    setPreview(null);
    setRecipeDetail(null);
    setRecipeIngredients(null);
  }
  const localQuery = normalizedQuery.toLocaleLowerCase();
  const addedFoods = catalog.items.filter((item) => !localQuery || `${item.name || ""} ${item.brand || ""}`.toLocaleLowerCase().includes(localQuery));
  const recentBrackets = catalog.items.filter((meal) => {
    const items = Array.isArray(meal?.items) ? meal.items : [];
    if (!items.length) return false;
    return !localQuery || `${meal.label || ""} ${items.map((item) => mealLogName(item)).join(" ")}`.toLocaleLowerCase().includes(localQuery);
  });
  async function addRecentMeal(bracket) {
    if (adding || !bracket?.items?.length) return;
    setAdding(true);
    const optimisticLogs = onOptimisticAdd(bracket.items, mealType.code);
    try {
      await api.runAction(
        { title: "Agregando comida reciente", description: `Estamos sumando ${bracket.label.toLowerCase()} a ${mealType.label.toLowerCase()}...` },
        async () => {
          await createMealLogs(api, bracket.items, mealType.code, selectedDate);
          api.notify(`${bracket.label} agregado a ${mealType.label}.`);
          await onDone();
          onClose();
        },
        { quiet: true },
      );
    } catch {
      onOptimisticRollback(optimisticLogs);
      api.notify("No se pudo agregar la comida reciente.", "error");
    } finally {
      setAdding(false);
    }
  }
  return (
    <ModalShell
      title="Agregar comida"
      onClose={onClose}
      className="picker-modal"
      backdropClassName="modal-backdrop"
      hideHeader
      wrapContent={false}
      labelledBy={pickerTitleId}
    >
        <header>
          <div>
            <span>{mealType.label}</span>
            <h2 id={pickerTitleId}>Agregar comida</h2>
          </div>
          <button className="icon-button" aria-label="Cerrar" onClick={onClose}>
            <Icon name="close" />
          </button>
        </header>
        <div className="tabs picker-tabs" role="tablist" aria-label="Opciones para agregar comida">
          <button
            type="button"
            role="tab"
            aria-selected={tab === "FOOD"}
            aria-controls="picker-panel-food"
            className={tab === "FOOD" ? "selected" : ""}
            onClick={() => changeTab("FOOD")}
          >
            Alimentos
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === "RECIPE"}
            aria-controls="picker-panel-recipe"
            className={tab === "RECIPE" ? "selected" : ""}
            onClick={() => changeTab("RECIPE")}
          >
            Recetas
          </button>
          <button type="button" role="tab" aria-selected={tab === "MINE"} aria-controls="picker-panel-mine" className={tab === "MINE" ? "selected" : ""} onClick={() => changeTab("MINE")}>Agregados</button>
          <button type="button" role="tab" aria-selected={tab === "RECENT"} aria-controls="picker-panel-recent" className={tab === "RECENT" ? "selected" : ""} onClick={() => changeTab("RECENT")}>Recientes</button>
        </div>
        <div className="picker-tools">
          <div className="search-wrap">
            <Icon name="search" />
            <input className="search" placeholder={`Buscar ${tab === "FOOD" ? "alimentos" : tab === "RECIPE" ? "recetas" : tab === "MINE" ? "tus alimentos" : "comidas recientes"}...`} value={query} onFocus={(event) => event.currentTarget.select()} onChange={(event) => setQuery(event.target.value)} />
          </div>
        </div>
        <div className="picker-scroll" id={`picker-panel-${tab.toLowerCase()}`} role="tabpanel" aria-label={tab === "FOOD" ? "Alimentos" : tab === "RECIPE" ? "Recetas" : tab === "MINE" ? "Agregados" : "Recientes"}>
          {tab === "FOOD" && !normalizedQuery && <div className="picker-results">
            {groupFoodVariants(recentFoods).map((item) => (
              <CatalogRowWithImage key={`RECENT_FOOD:${item.preparationGroup || item.id}`} item={item} onPick={setSelected} />
            ))}
          </div>}
          {(tab === "FOOD" && normalizedQuery.length >= 2 || tab === "RECIPE") && <div className="picker-results">
            {groupFoodVariants(catalog.items).map((item) => (
              <CatalogRowWithImage key={`${tab}:${item.preparationGroup || item.id}`} item={{ ...item, type: tab }} onPick={setSelected} />
            ))}
          </div>}
          {tab === "MINE" && <div className="picker-results">
            {groupFoodVariants(addedFoods).map((item) => <CatalogRowWithImage key={`MINE:${item.preparationGroup || item.id}`} item={{ ...item, type: "FOOD" }} onPick={setSelected} />)}
          </div>}
          {tab === "RECENT" && <div className="recent-meals picker-recent-meals">
            {recentBrackets.map((bracket) => <button type="button" className="catalog-row recent-meal-card recent-bracket-card" key={`${bracket.sourceDate}:${bracket.mealType}`} disabled={adding} aria-label={`Agregar ${bracket.label} completo`} onClick={() => addRecentMeal(bracket)}>
              <div className="recent-bracket-heading"><div><strong>{bracket.label}</strong><small>{readableDate(bracket.sourceDate)}</small></div><span className="recent-bracket-total"><strong>{formatNumber(bracket.calories)} kcal</strong><small>P {formatNumber(bracket.proteinGrams, 1)}g · C {formatNumber(bracket.carbsGrams, 1)}g · G {formatNumber(bracket.fatGrams, 1)}g</small></span></div>
              <div className="recent-bracket-items">{(Array.isArray(bracket.items) ? bracket.items : []).map((item) => <span className="recent-bracket-item" key={item.id}><strong>{mealLogName(item)}</strong><small>{formatMealLogAmount(item)} · {formatNumber(item.calories)} kcal · P {formatNumber(item.proteinGrams, 1)}g · C {formatNumber(item.carbsGrams, 1)}g · G {formatNumber(item.fatGrams, 1)}g</small></span>)}</div>
              <Icon name="chevron_right" className="row-action recent-bracket-action" />
            </button>)}
          </div>}
          {tab === "FOOD" && normalizedQuery.length === 1 && <CatalogStatus>Escribí al menos 2 caracteres para buscar.</CatalogStatus>}
          {tab === "FOOD" && !normalizedQuery && !recentFoods.length && <CatalogStatus>Buscá un alimento para empezar.</CatalogStatus>}
          {catalog.initialLoading && <CatalogStatus>Buscando alimentos…</CatalogStatus>}
          {!catalog.initialLoading && catalog.error && (
            <CatalogStatus error>
              {catalog.error}
              <button className="secondary" onClick={catalog.retry}>
                Reintentar
              </button>
            </CatalogStatus>
          )}
          {!catalog.initialLoading && !catalog.error && !catalog.items.length && ((tab === "FOOD" && normalizedQuery.length >= 2) || tab === "MINE" || tab === "RECENT") && <CatalogStatus>{tab === "MINE" ? "Todavía no agregaste alimentos propios." : tab === "RECENT" ? "Tus comidas anteriores aparecerán acá." : "No encontramos resultados."}</CatalogStatus>}
          {!catalog.initialLoading && !catalog.error && catalog.items.length > 0 && ((tab === "MINE" && !addedFoods.length) || (tab === "RECENT" && !recentBrackets.length)) && <CatalogStatus>No encontramos resultados para esa búsqueda.</CatalogStatus>}
          {tab === "FOOD" && normalizedQuery.length >= 2 && catalog.hasNext && !catalog.initialLoading && !catalog.error && (
            <button type="button" className="secondary catalog-load-more" disabled={catalog.loadingMore} onClick={catalog.loadNext}>
              {catalog.loadingMore ? "Cargando…" : "Cargar más"}
            </button>
          )}
          {tab !== "FOOD" && <InfiniteSentinel enabled={catalog.hasNext && !catalog.initialLoading && !catalog.loadingMore && !catalog.error} onLoad={catalog.loadNext} />}
        </div>
        {selected && (
          <FoodLogDialog
            item={selected}
            eyebrow={`Agregar a ${mealType.label}`}
            isRecipe={selected.type === "RECIPE"}
            onClose={() => {
              setSelected(null);
              setPreview(null);
              setRecipeDetail(null);
              setRecipeIngredients(null);
            }}
            onSubmit={(event) => {
              event.preventDefault();
              add();
            }}
            titleId="add-food-log-title"
            footer={
              <footer className="modal-actions">
                <button type="button" className="secondary" disabled={adding} onClick={() => {
                  setSelected(null);
                  setPreview(null);
                  setRecipeDetail(null);
                  setRecipeIngredients(null);
                }}>
                  Cancelar
                </button>
                <button className="primary action-control" data-action-state={adding ? "pending" : "idle"} disabled={adding || Number(quantity) <= 0}>
                  {adding ? "Agregando…" : `Agregar a ${mealType.label}`}
                </button>
              </footer>
            }
          >
              <FoodLogForm
                mode="add"
                isRecipe={selected.type === "RECIPE"}
                quantity={quantity}
                onQuantityChange={(value) => setQuantity(value)}
                unit={unit}
                unitOptions={selectedUnitOptions}
                onUnitChange={changeSelectedUnit}
                preparations={selectedPreparations}
                preparationValue={selected.id}
                onPreparationChange={(id) => {
                  const option = selectedPreparations.find((item) => item.id === id);
                  if (option) {
                    setSelected({ ...option, type: "FOOD" });
                    setUnit("GRAM");
                  }
                }}
                recipeIngredients={selected.type === "RECIPE" ? recipeIngredients : null}
                onRecipeIngredientChange={(index, value) => setRecipeIngredients(recipeIngredients.map((ing, i) => i === index ? { ...ing, quantity: value } : ing))}
                preview={preview}
              />
          </FoodLogDialog>
        )}
        {pendingMealPhoto && <MealPhotoContextEditorDialog photoUrl={pendingMealPhotoUrl} context={aiContext} setContext={setAiContext} error={aiError} recording={audioRecording} transcribing={audioTranscribing} analyzing={aiAnalyzing} onToggleRecording={toggleMealNoteRecording} onDiscard={discardMealPhoto} onChangePhoto={() => galleryInputRef.current?.click()} onAnalyze={() => analyzeMealPhoto(pendingMealPhoto)} />}
        {aiEstimate && <AiEstimateEditor estimate={aiEstimate} setEstimate={setAiEstimate} correction={aiCorrection} setCorrection={setAiCorrection} refining={aiRefining} refinementError={aiRefinementError} onRefine={refineAiEstimate} saving={adding} onDiscard={discardAiEstimate} onConfirm={confirmAiEstimate} />}
        <footer className="picker-photo-actions">
          <label className={`secondary ai-photo-trigger ai-gallery-trigger ${aiAnalyzing || !aiUsage?.available || aiQuotaBlocked ? "disabled" : ""}`}>
            <Icon name="photo_library" />
            Elegir foto
            <input
              ref={galleryInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              disabled={aiAnalyzing || !aiUsage?.available || aiQuotaBlocked}
              onChange={(event) => {
                const file = event.currentTarget.files?.[0];
                event.currentTarget.value = "";
                selectMealPhoto(file);
              }}
              hidden
            />
          </label>
          <label className={`primary ai-photo-trigger ai-camera-trigger ${aiAnalyzing || !aiUsage?.available || aiQuotaBlocked ? "disabled" : ""}`}>
            <Icon name="photo_camera" />
            {aiAnalyzing ? "Analizando comida..." : aiQuotaBlocked ? `Vuelve ${aiQuotaReset(aiUsage)}` : "Tomar foto"}
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              capture="environment"
              disabled={aiAnalyzing || !aiUsage?.available || aiQuotaBlocked}
              onChange={(event) => {
                const file = event.currentTarget.files?.[0];
                event.currentTarget.value = "";
                selectMealPhoto(file);
              }}
              hidden
            />
          </label>
        </footer>
    </ModalShell>
  );
}
