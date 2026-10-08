import { aiAvailability } from "../../../utils/ai-availability";
import React, { useEffect, useId, useRef, useState } from "react";
import { CATEGORY_OPTIONS, DEFAULT_MEALS, PREPARATION_OPTIONS } from "../../../config/app";
import { Icon } from "../../../components/Icon";
import { InfiniteSentinel } from "../../../components/InfiniteSentinel";
import { Input, Select } from "../../../components/FormControls";
import { CatalogRowWithImage, CatalogStatus, FoodThumb, PreparationBadge, categoryLabel, groupFoodVariants, preparationLabel } from "../../catalog/CatalogComponents";
import { EditFoodLog, FoodLogDialog, FoodLogForm } from "../../foods/FoodComponents";
import { usePagedCatalog } from "../../catalog/usePagedCatalog";
import { readRecents, rememberItem, rememberMeal } from "../../../services/recents";
import { formatNumber, readableDate, today } from "../../../utils/format";
import { scaleNutrition, sumNutrition, nutritionWarning } from "../../../utils/nutrition";
import { decimalNumber } from "../../../utils/decimal";
import { normalizeSearchText } from "../../../utils/search";
import { hasCookedRecipeWeight, recipeServingFactor } from "../../../utils/recipe";
import { aiEstimateDraft, aiEstimateWithServings, aiProposalFood, createMealLogs, formatMealLogAmount, isCopyableMealLog, macroCalories, macroValue, mealLogItem, mealLogName, mealTotals, savedAiEstimate, sortMealLogs } from "../dashboard.utils";
import { sortRecipeIngredients, scaleFoodNutrition, scaleRecipeNutrition } from "../../recipes/recipe.utils";
import { MealPhotoContextEditor as MealPhotoContextEditorDialog } from "./MealPhotoDialog";
import { ModalShell } from "../../../components/dialog/ModalShell";
import { SkeletonRows } from "../../../components/Loading";
import { compressMealPhoto } from "../../../services/image";
import { MealShareDialog } from "./MealShareDialogs";

import { AiEstimateEditor } from "./AiEstimateEditor";
import { RecentMealReviewDialog } from "./RecentMealReviewDialog";
export { FoodPicker, AiEstimateEditor };

function FoodPicker({ api, user, mealType, selectedDate, onClose, onDone, onOptimisticAdd = () => [], onOptimisticRollback = () => {}, onOptimisticConfirm = () => {}, draftOnly = false, ingredientOnly = false, onDraftAdd, aiOnly = false, mealTypes = DEFAULT_MEALS }) {
  const pickerTitleId = `${useId().replace(/:/g, "")}-title`;
  const [tab, setTab] = useState("FOOD");
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("");
  const [preparation, setPreparation] = useState("");
  const [filtersExpanded, setFiltersExpanded] = useState(false);
  const [selected, setSelected] = useState(null);
  const [selectedPreparations, setSelectedPreparations] = useState([]);
  const [quantity, setQuantity] = useState("150");
  const [unit, setUnit] = useState("GRAM");
  const [preview, setPreview] = useState(null);
  const [previewError, setPreviewError] = useState("");
  const [previewRetry, setPreviewRetry] = useState(0);
  const [adding, setAdding] = useState(false);
  const [recipeDetail, setRecipeDetail] = useState(null);
  const [recipeIngredients, setRecipeIngredients] = useState(null);
  const [aiUsage, setAiUsage] = useState(null);
  const [aiAnalyzing, setAiAnalyzing] = useState(false);
  const [aiEstimate, setAiEstimate] = useState(null);
  const [aiAddToDiary, setAiAddToDiary] = useState(true);
  const [aiRegistrationMealType, setAiRegistrationMealType] = useState(mealType?.code || DEFAULT_MEALS[0].code);
  const [aiRegistrationDate, setAiRegistrationDate] = useState(selectedDate || today());
  const [aiError, setAiError] = useState("");
  const [aiSaveError, setAiSaveError] = useState("");
  const [aiMatchPreview, setAiMatchPreview] = useState(null);
  const [aiMatchChoices, setAiMatchChoices] = useState({});
  const [aiCheckingMatches, setAiCheckingMatches] = useState(false);
  const [aiContext, setAiContext] = useState("");
  const [aiEstimatePhoto, setAiEstimatePhoto] = useState(null);
  const [aiCorrection, setAiCorrection] = useState("");
  const [aiRefining, setAiRefining] = useState(false);
  const [aiRefinementError, setAiRefinementError] = useState("");
  const [pendingMealPhoto, setPendingMealPhoto] = useState(null);
  const [pendingMealPhotoUrl, setPendingMealPhotoUrl] = useState("");
  const [shareBracket, setShareBracket] = useState(null);
  const [reviewingBracket, setReviewingBracket] = useState(null);
  const galleryInputRef = useRef(null);
  const cameraInputRef = useRef(null);
  const addInFlightRef = useRef(false);
  const availability = aiAvailability(aiUsage);
  const recentFoods = readRecents(user).items.slice(0, 20).map((item) => ({ ...item, type: "FOOD" }));
  const normalizedQuery = normalizeSearchText(query);
  const foodSearchReady = tab !== "FOOD" || normalizedQuery.length >= 2;
  const catalog = usePagedCatalog({
    api,
    endpoint: tab === "FOOD" ? "/api/foods" : tab === "RECIPE" ? "/api/recipes" : tab === "MINE" ? "/api/foods/mine" : "/api/nutrition/recent-meals",
    query,
    category: tab === "FOOD" ? category : "",
    enabled: foodSearchReady,
  });
  useEffect(() => {
    if (ingredientOnly) return undefined;
    api.request("/api/nutrition/ai-estimates/usage").then(setAiUsage).catch(() => setAiUsage(null));
    return undefined;
  }, [api, ingredientOnly]);
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
    setAiSaveError("");
    setAiContext("");
    setAiEstimatePhoto(null);
    setAiCorrection("");
    setAiRefinementError("");
    setPendingMealPhoto(file);
  }
  useEffect(() => {
    if (ingredientOnly || aiEstimate || aiAnalyzing) return undefined;
    function handleImagePaste(event) {
      const items = Array.from(event.clipboardData?.items || []);
      const imageItems = items.filter((item) => item.kind === "file" && item.type.startsWith("image/"));
      if (!imageItems.length) return;
      const supported = imageItems.find((item) => ["image/jpeg", "image/png", "image/webp"].includes(item.type));
      if (!supported) {
        event.preventDefault();
        setAiError("La imagen pegada debe ser JPEG, PNG o WebP.");
        return;
      }
      const file = supported.getAsFile();
      if (!file) return;
      event.preventDefault();
      const extension = supported.type === "image/jpeg" ? "jpg" : supported.type === "image/webp" ? "webp" : "png";
      selectMealPhoto(new File([file], `imagen-del-portapapeles.${extension}`, { type: supported.type }));
    }
    document.addEventListener("paste", handleImagePaste);
    return () => document.removeEventListener("paste", handleImagePaste);
  }, [ingredientOnly, aiEstimate, aiAnalyzing]);
  function discardMealPhoto() {
    setAiError("");
    setAiContext("");
    setAiEstimatePhoto(null);
    setAiCorrection("");
    setAiRefinementError("");
    setPendingMealPhoto(null);
  }
  async function analyzeMealPhoto(file) {
    if (!file || aiAnalyzing) return;
    setAiError("");
    setAiAnalyzing(true);
    try {
      const image = await compressMealPhoto(file);
      const form = new FormData();
      form.append("image", image);
      form.append("targetType", "RECIPE");
      if (aiContext.trim()) form.append("context", aiContext.trim());
      const result = await api.runAction(
        { title: "Analizando tu comida", description: "Estamos estimando los alimentos y las porciones visibles..." },
        () => api.request("/api/nutrition/ai-estimates", { method: "POST", body: form }),
      );
      if (!result?.items?.length) throw new Error("La IA no pudo identificar alimentos en esta foto. Probá con mejor luz.");
      const estimate = aiEstimateWithServings(result);
      const target = estimate.items.length > 1 ? "RECIPE" : "FOOD";
      setAiAddToDiary(target === "FOOD");
      setAiEstimate(estimate);
      setAiMatchPreview(null);
      setAiMatchChoices({});
      setAiUsage(result.usage);
      setAiEstimatePhoto(image);
      setAiCorrection("");
      setAiRefinementError("");
      setPendingMealPhoto(null);
    } catch (error) { if (error.cancelled) return;
      const message = `${error.message || "No se pudo analizar la foto."}${error.requestId ? ` Código de soporte: ${error.requestId}` : ""}`;
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
      form.append("targetType", "RECIPE");
      form.append("request", new Blob([JSON.stringify({
        currentEstimate: aiEstimateDraft(aiEstimate),
        correction: aiCorrection.trim(),
      })], { type: "application/json" }));
      const result = await api.runAction(
        { title: "Corrigiendo estimación", description: "Estamos revisando la foto, tu observación y los cambios actuales..." },
        () => api.request("/api/nutrition/ai-estimates/refinements", { method: "POST", body: form }),
      );
      if (!result?.items?.length) throw new Error("La IA no pudo corregir esta estimación. Probá con una indicación más precisa.");
      const estimate = aiEstimateWithServings(result);
      const target = estimate.items.length > 1 ? "RECIPE" : "FOOD";
      const previousTarget = aiEstimate.items.length > 1 ? "RECIPE" : "FOOD";
      setAiAddToDiary((current) => target === "FOOD" && (previousTarget === "FOOD" ? current : true));
      setAiEstimate(estimate);
      setAiMatchPreview(null);
      setAiMatchChoices({});
      setAiUsage(result.usage);
      setAiCorrection("");
    } catch (error) { if (error.cancelled) return;
      const message = `${error.message || "No se pudo corregir la estimación."}${error.requestId ? ` Código de soporte: ${error.requestId}` : ""}`;
      setAiRefinementError(message);
      api.notify(message, "error");
    } finally {
      setAiRefining(false);
    }
  }
  function discardAiEstimate() {
    setAiEstimate(null);
    setAiSaveError("");
    setAiMatchPreview(null);
    setAiMatchChoices({});
    setAiCheckingMatches(false);
    setAiEstimatePhoto(null);
    setAiContext("");
    setAiCorrection("");
    setAiRefinementError("");
  }
  async function confirmAiEstimate(estimate, resolutions) {
    if (adding) return;
    if (draftOnly) {
      const nutrition = (estimate.items || []).reduce((sum, item) => {
        const scaled = scaleFoodNutrition(aiProposalFood(item), decimalNumber(item.estimatedGrams));
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
    const target = estimate.items.length > 1 ? "RECIPE" : "FOOD";
    setAiSaveError("");
    setAdding(true);
    try {
      let selectedResolutions = resolutions;
      if (!aiMatchPreview) {
        setAiCheckingMatches(true);
        const preview = await api.request("/api/nutrition/ai-registrations/matches", {
          method: "POST",
          body: JSON.stringify({ captureId: estimate.captureId, items: aiEstimateDraft(estimate).items }),
        });
        const initialChoices = Object.fromEntries((preview?.items || []).map(({ itemIndex, match }) => [itemIndex,
          match && !match.macrosDiffer ? { choice: "USE_CATALOG", foodId: match.foodId } :
            match ? null : { choice: "KEEP_ESTIMATE", foodId: null }]));
        setAiMatchPreview(preview);
        setAiMatchChoices(initialChoices);
        const hasMacroDifferences = (preview?.items || []).some(({ match }) => match?.macrosDiffer);
        if (hasMacroDifferences) return;
        selectedResolutions = (preview?.items || []).map(({ itemIndex, match }) => match
          ? { itemIndex, choice: "USE_CATALOG", foodId: match.foodId }
          : { itemIndex, choice: "KEEP_ESTIMATE" });
      }
      if (!selectedResolutions) return;
      setAiCheckingMatches(false);
      const saved = await api.runAction(
        { title: "Agregando estimación", description: "Estamos sumando los macros revisados a tu comida..." },
        () => api.request("/api/nutrition/ai-registrations/confirm", {
          method: "POST",
          body: JSON.stringify({
            captureId: estimate.captureId,
            name: estimate.name,
            description: estimate.description || "",
            confidence: Number(estimate.confidence) || 0,
            mealType: target === "FOOD" && !aiAddToDiary ? null : aiRegistrationMealType,
            logDate: aiRegistrationDate,
            addToDiary: target === "FOOD" ? aiAddToDiary : true,
            items: aiEstimateDraft(estimate).items,
            resolutions: selectedResolutions,
          }),
        }),
      );
      const savedLog = saved?.log;
      if (saved?.food) rememberItem(user, { ...saved.food, type: "FOOD" });
      if (saved?.recipe) rememberItem(user, { ...saved.recipe, type: "RECIPE" });
      if (savedLog) rememberMeal(user, aiRegistrationMealType, savedLog);
      api.notify(saved?.targetType === "FOOD"
        ? savedLog ? "Alimento guardado y agregado a tu día." : `${saved.food?.name || "Alimento"} guardado en tu catálogo.`
        : "Receta registrada y agregada como una porción.");
      discardAiEstimate();
      await onDone?.(savedLog, saved);
    } catch (error) { if (error.cancelled) return;
      const message = `${error.message || "No se pudo guardar la estimación."}${error.requestId ? ` Código de soporte: ${error.requestId}` : ""}`;
      setAiSaveError(message);
      api.notify(message, "error");
    } finally {
      setAiCheckingMatches(false);
      setAdding(false);
    }
  }
  useEffect(() => {
    if (!selected || selected.type !== "FOOD") return setSelectedPreparations([]);
    let active = true;
    setSelectedPreparations([]);
    api
      .runAction(
        { title: "Cargando opciones", description: "Estamos buscando las presentaciones disponibles..." },
        () => api.request(`/api/foods/${selected.id}/preparations`),
        { quiet: true },
      )
      .then((items) => { if (active) setSelectedPreparations(items); })
      .catch(() => { if (active) setSelectedPreparations([]); });
    return () => { active = false; };
  }, [api, selected?.id, selected?.type]);
  useEffect(() => {
    if (!selected) return;
    if (selected.type === "FOOD") {
      const baseUnit = selected.baseUnit || "GRAM";
      const servingWeightGrams = Number(selected.servingWeightGrams);
      setQuantity(baseUnit === "GRAM" && Number.isFinite(servingWeightGrams) && servingWeightGrams > 0
        ? String(servingWeightGrams) : selected.category === "FAT" && baseUnit === "GRAM" ? "10" : String(selected.baseQuantity || 100));
      setUnit(baseUnit);
    } else if (selected.type === "RECIPE") {
      const recipeWeight = Number(selected.cookedTotalWeightGrams || selected.rawTotalWeightGrams || selected.totalWeightGrams);
      setQuantity(ingredientOnly && Number.isFinite(recipeWeight) && recipeWeight > 0 ? String(recipeWeight) : "1");
      setUnit(ingredientOnly ? "GRAM" : "PORTION");
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
    let active = true;
    setRecipeDetail(null);
    setRecipeIngredients(null);
    api
      .request(`/api/recipes/${selected.id}`)
      .then((fullRecipe) => {
        if (!active) return;
        setRecipeDetail(fullRecipe);
        setRecipeIngredients(sortRecipeIngredients(fullRecipe.ingredients || []).map((ing) => ({
          foodId: ing.food?.id,
          recipeId: ing.recipe?.id,
          type: ing.recipe ? "RECIPE" : "FOOD",
          name: ing.food?.name || ing.recipe?.name || (ing.recipe ? "Receta" : "Alimento"),
          food: ing.food,
          recipe: ing.recipe,
          quantity: String(ing.quantity ?? ""),
          unit: ing.unit || "GRAM",
        })));
      })
      .catch(() => {
        if (!active) return;
        setRecipeDetail(null);
        setRecipeIngredients(null);
      });
    return () => { active = false; };
  }, [api, selected?.id, selected?.type]);
  useEffect(() => {
    if (selected?.type === "RECIPE" && unit === "GRAM" && !hasCookedRecipeWeight(recipeDetail || selected)) setUnit("PORTION");
    if (selected?.type !== "RECIPE" && !selected?.servingWeightGrams && unit === "SERVING") setUnit("GRAM");
  }, [recipeDetail, selected, unit]);
  useEffect(() => {
    const numericQuantity = decimalNumber(quantity);
    let active = true;
    setPreview(null);
    setPreviewError("");
    if (!selected || !Number.isFinite(numericQuantity) || numericQuantity <= 0) return undefined;
    if (selected.type === "FOOD") {
      const previewQuantity = unit === "SERVING" ? numericQuantity * Number(selected.servingWeightGrams || 0) : numericQuantity;
      const previewUnit = unit === "SERVING" ? "GRAM" : unit;
      if (previewQuantity <= 0) return undefined;
      api
        .request("/api/foods/preview", {
          method: "POST",
          body: JSON.stringify({
            foodId: selected.id,
            quantity: previewQuantity,
            unit: previewUnit,
          }),
        })
        .then((result) => { if (active) { setPreview(result); if (!result) setPreviewError("No pudimos calcular los nutrientes."); } })
        .catch(() => { if (active) setPreviewError("No pudimos calcular los nutrientes."); });
    } else if (selected.type === "RECIPE" && recipeIngredients) {
      const nutrition = sumNutrition(recipeIngredients.map(ing => ing.recipe ? scaleRecipeNutrition(ing.recipe, decimalNumber(ing.quantity)) : scaleFoodNutrition(ing.food, decimalNumber(ing.quantity))));
      const factor = recipeServingFactor(recipeDetail || selected, numericQuantity, unit);
      setPreview(scaleNutrition(nutrition, factor));
    } else if (selected.type === "RECIPE") {
      setPreview(scaleNutrition(recipeDetail || selected, recipeServingFactor(recipeDetail || selected, numericQuantity, unit)));

    } else {
      setPreview({
        calories: Math.round(selected.calories * numericQuantity),
        proteinGrams: selected.proteinGrams * numericQuantity,
        carbsGrams: selected.carbsGrams * numericQuantity,
        fatGrams: selected.fatGrams * numericQuantity,
      });
    }
    return () => { active = false; };
  }, [api, recipeDetail, recipeIngredients, selected, quantity, unit, previewRetry]);
  async function add() {
    const numericQuantity = decimalNumber(quantity);
    if (!selected || !preview || !Number.isFinite(numericQuantity) || numericQuantity <= 0 || addInFlightRef.current) return;
    const logQuantity = selected.type === "FOOD" && unit === "SERVING" ? numericQuantity * Number(selected.servingWeightGrams || 0) : numericQuantity;
    const logUnit = selected.type === "FOOD" ? unit === "SERVING" ? "GRAM" : unit : unit;
    if (logQuantity <= 0) return;
    const warning = nutritionWarning(selected) || nutritionWarning(preview);
    if (warning && !draftOnly) {
      addInFlightRef.current = true;
      setAdding(true);
      const accepted = await api.confirm({ title: "Revisar información nutricional", description: `${warning} Podés registrar igualmente; se mostrarán los datos informados.`, confirmLabel: "Registrar con aviso", tone: "neutral" });
      addInFlightRef.current = false;
      setAdding(false);
      if (!accepted) return;
    }
    if (draftOnly) {
      onDraftAdd?.({
        itemType: selected.type,
        itemId: selected.id,
        foodId: selected.type === "FOOD" ? selected.id : null,
        recipeId: selected.type === "RECIPE" ? selected.id : null,
        food: selected.type === "FOOD" ? selected : null,
        recipe: selected.type === "RECIPE" ? { ...selected, ...recipeDetail } : null,
        mealType: mealType.code,
        quantity: logQuantity,
        unit: logUnit,
        displayName: selected.name,
        imageUrl: selected.imageUrl || null,
        category: selected.category || "OTHER",
        calories: preview?.calories ?? null,
        proteinGrams: preview?.proteinGrams ?? null,
        carbsGrams: preview?.carbsGrams ?? null,
        fatGrams: preview?.fatGrams ?? null,
      });
      onClose();
      return;
    }
    addInFlightRef.current = true;
    setAdding(true);
    const optimisticLogs = onOptimisticAdd([{
      itemType: selected.type,
      food: selected.type === "FOOD" ? selected : null,
      recipe: selected.type === "RECIPE" ? { ...selected, ...recipeDetail } : null,
      quantity: logQuantity,
      unit: logUnit,
      ...preview,
    }], mealType.code);
    try {
      const log = await api.runAction(
        { title: "Agregando alimento", description: `Estamos sumando ${selected.name} a ${mealType.label.toLowerCase()}...` },
        async () => {
          if (selected.type === "RECIPE" && unit === "PORTION" && recipeIngredients && recipeDetail) {
            const baseIngredients = (recipeDetail.ingredients || []).map((ing) => ({
              foodId: ing.food?.id,
              recipeId: ing.recipe?.id,
              quantity: Number(ing.quantity ?? 0),
              unit: ing.unit || "GRAM",
            }));
            const signature = (ingredient) => [ingredient.foodId || "", ingredient.recipeId || "", ingredient.unit || "GRAM", decimalNumber(ingredient.quantity)].join(":");
            const currentIngredients = recipeIngredients.map(signature).sort();
            const originalIngredients = baseIngredients.map(signature).sort();
            const changed = currentIngredients.length !== originalIngredients.length
              || currentIngredients.some((value, index) => value !== originalIngredients[index]);
            if (changed) {
              return api.request("/api/nutrition/meal-logs/recipe", {
                method: "POST",
                body: JSON.stringify({
                  recipeId: selected.id,
                  mealType: mealType.code,
                  quantity: logQuantity,
                  unit,
                  logDate: selectedDate,
                  ingredients: recipeIngredients.map(({ foodId, recipeId, quantity: ingQty, unit }) => ({
                    ...(recipeId ? { recipeId } : { foodId }), quantity: decimalNumber(ingQty), unit,
                  })),
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
              unit: logUnit,
              logDate: selectedDate,
            }),
          });
        },
        { quiet: true },
      );
      rememberItem(user, selected);
      rememberMeal(user, mealType.code, log);
      const confirmed = onOptimisticConfirm(optimisticLogs, [log]);
      api.notify(`${selected.name} agregado a ${mealType.label}.`);
      onClose();
      if (!confirmed) onDone();
    } catch (error) {
      onOptimisticRollback(optimisticLogs);
      if (error.cancelled) return;
      api.notify("No se pudo agregar el alimento. Se revirtieron los cambios.", "error");
    } finally {
      addInFlightRef.current = false;
      setAdding(false);
    }
  }
  const selectedUnitOptions =
    selected?.type === "RECIPE"
      ? [
          ...(ingredientOnly ? [{ value: "GRAM", label: "Gramos" }] : [{ value: "PORTION", label: "Porciones" }, ...(hasCookedRecipeWeight(recipeDetail || selected) ? [{ value: "GRAM", label: "Gramos cocidos" }] : [])]),
        ]
      : selected?.type === "FOOD" && selected?.baseUnit === "MILLILITER"
      ? [{ value: "MILLILITER", label: "Mililitros" }]
      : selected?.type === "FOOD" && selected?.servingWeightGrams && (selected?.baseUnit || "GRAM") === "GRAM"
      ? [
          { value: "GRAM", label: "Gramos" },
          {
            value: "SERVING",
            label: `${selected.servingName || "Porción"} (${formatNumber(selected.servingWeightGrams, 1)} g)`,
          },
        ]
      : [{ value: selected?.baseUnit || "GRAM", label: selected?.baseUnit === "MILLILITER" ? "Mililitros" : selected?.baseUnit === "UNIT" ? "Unidades" : "Gramos" }];
  function changeSelectedUnit(nextUnit) {
    if (nextUnit === unit) return;
    if (selected?.type === "RECIPE") {
      const cookedWeight = Number((recipeDetail || selected)?.cookedTotalWeightGrams);
      const numericQuantity = decimalNumber(quantity);
      if (Number.isFinite(cookedWeight) && cookedWeight > 0 && Number.isFinite(numericQuantity) && numericQuantity > 0) {
        const converted = nextUnit === "GRAM" ? numericQuantity * cookedWeight : numericQuantity / cookedWeight;
        setQuantity(String(Number(converted.toFixed(2))));
      }
      setUnit(nextUnit);
      return;
    }
    const numericQuantity = decimalNumber(quantity);
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
  function reviewFood(item) {
    document.activeElement?.blur?.();
    setSelected(item);
  }
  const localQuery = normalizedQuery;
  const matchesPreparation = item => !preparation || item.preparation === preparation;
  const filteredFoods = catalog.items.filter(matchesPreparation);
  const addedFoods = catalog.items.filter((item) => !localQuery || normalizeSearchText(`${item.name || ""} ${item.brand || ""}`).includes(localQuery));
  const recentBrackets = catalog.items.filter((meal) => {
    const items = Array.isArray(meal?.items) ? meal.items : [];
    if (!items.length) return false;
    return !localQuery || normalizeSearchText(`${meal.label || ""} ${items.map((item) => mealLogName(item)).join(" ")}`).includes(localQuery);
  });
  async function addRecentMeal(bracket, reviewedItems) {
    if (adding || !reviewedItems?.length) return;
    setAdding(true);
    const optimisticLogs = onOptimisticAdd(reviewedItems, mealType.code);
    try {
      await api.runAction(
        { title: "Agregando comida reciente", description: `Estamos sumando ${bracket.label.toLowerCase()} a ${mealType.label.toLowerCase()}...` },
        async () => {
          const savedLogs = await createMealLogs(api, reviewedItems, mealType.code, selectedDate);
          const confirmed = onOptimisticConfirm(optimisticLogs, savedLogs);
          api.notify(`${bracket.label} agregado a ${mealType.label}.`);
          if (!confirmed) await onDone();
        },
        { quiet: true },
      );
      onClose();
    } catch (error) {
      onOptimisticRollback(optimisticLogs);
      if (error.cancelled) return;
      api.notify("No se pudo agregar la comida reciente.", "error");
    } finally {
      setAdding(false);
    }
  }
  return (
    <ModalShell
      title={aiOnly ? "Registrar con IA" : ingredientOnly ? "Agregar ingrediente" : "Agregar comida"}
      onClose={onClose}
      closeDisabled={adding}
      className={`picker-modal ${aiOnly ? "picker-source-sheet" : ""}`}
      backdropClassName="modal-backdrop"
      hideHeader
      wrapContent={false}
      labelledBy={pickerTitleId}
    >
        <header>
          <div>
             <span>{ingredientOnly ? "Catálogo" : mealType.label}{!ingredientOnly && <span className="picker-header-date"> · {readableDate(selectedDate)}</span>}</span>
            <h2 id={pickerTitleId}>{aiOnly ? "Registrar con IA" : ingredientOnly ? "Agregar ingrediente" : "Agregar comida"}</h2>
          </div>
          <button type="button" className="icon-button" aria-label="Cerrar" disabled={adding} onClick={onClose}>
            <Icon name="close" />
          </button>
        </header>
        {!ingredientOnly && <p className="picker-destination">Destino: <strong>{mealType.label}</strong> · {readableDate(selectedDate)}</p>}
        {!aiOnly && <div className="tabs picker-tabs" role="tablist" aria-label="Opciones para agregar comida">
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
          {!ingredientOnly && <button type="button" role="tab" aria-selected={tab === "MINE"} aria-controls="picker-panel-mine" className={tab === "MINE" ? "selected" : ""} onClick={() => changeTab("MINE")}>Agregados</button>}
          {!ingredientOnly && <button type="button" role="tab" aria-selected={tab === "RECENT"} aria-controls="picker-panel-recent" className={tab === "RECENT" ? "selected" : ""} onClick={() => changeTab("RECENT")}>Recientes</button>}
        </div>}
        {!aiOnly && <div className="picker-tools">
          <div className="picker-search-row">
            <div className="search-wrap">
              <Icon name="search" />
              <input className="search" type="search" enterKeyHint="search" aria-label={tab === "FOOD" ? "Buscar alimentos por nombre, marca u otros datos" : `Buscar ${tab === "RECIPE" ? "recetas" : tab === "MINE" ? "tus alimentos" : "comidas recientes"}`} placeholder={tab === "FOOD" ? "Nombre, marca u otro dato..." : `Buscar ${tab === "RECIPE" ? "recetas" : tab === "MINE" ? "tus alimentos" : "comidas recientes"}...`} value={query} onChange={(event) => setQuery(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") event.currentTarget.blur(); }} />
            </div>
            {tab === "FOOD" && (
              <button type="button" className="icon-button picker-filter-toggle" aria-label={`Filtros${category || preparation ? " activos" : ""}`} title="Filtros de alimentos" aria-expanded={filtersExpanded} aria-controls={`${pickerTitleId}-filters`} data-active={Boolean(category || preparation)} onClick={() => setFiltersExpanded((expanded) => !expanded)}>
                <Icon name="tune" />
                {(category || preparation) && <span className="picker-filter-count">{Number(Boolean(category)) + Number(Boolean(preparation))}</span>}
              </button>
            )}
          </div>
          {tab === "FOOD" && <div className="picker-filters" id={`${pickerTitleId}-filters`} data-expanded={filtersExpanded}><Select label="Categoría" value={category} onChange={event => setCategory(event.target.value)} options={[{ value: "", label: "Todas" }, ...CATEGORY_OPTIONS]} /><Select label="Preparación" value={preparation} onChange={event => setPreparation(event.target.value)} options={[{ value: "", label: "Todas" }, ...PREPARATION_OPTIONS]} /></div>}
        </div>}
        {!aiOnly && <div className="picker-scroll" data-dialog-scroll-owner="true" id={`picker-panel-${tab.toLowerCase()}`} role="tabpanel" aria-label={tab === "FOOD" ? "Alimentos" : tab === "RECIPE" ? "Recetas" : tab === "MINE" ? "Agregados" : "Recientes"}>
          {tab === "FOOD" && normalizedQuery.length >= 2 && <p className="picker-search-hint">Coincidencias por nombre, marca y similitud del alimento.</p>}
          {tab === "FOOD" && !normalizedQuery && <div className="picker-results">
            {groupFoodVariants(recentFoods).map((item) => (
              <CatalogRowWithImage key={`RECENT_FOOD:${item.id}`} item={item} onPick={reviewFood} />
            ))}
          </div>}
          {(tab === "FOOD" && normalizedQuery.length >= 2 || tab === "RECIPE") && <div className="picker-results">
            {groupFoodVariants(tab === "FOOD" ? filteredFoods : catalog.items).map((item) => (
              <CatalogRowWithImage key={`${tab}:${item.id}`} item={{ ...item, type: tab }} onPick={reviewFood} />
            ))}
          </div>}
          {tab === "MINE" && <div className="picker-results">
            {groupFoodVariants(addedFoods).map((item) => <CatalogRowWithImage key={`MINE:${item.id}`} item={{ ...item, type: "FOOD" }} onPick={reviewFood} />)}
          </div>}
           {tab === "RECENT" && <div className="recent-meals picker-recent-meals">
             {recentBrackets.map((bracket) => <article className={`catalog-row recent-meal-card recent-bracket-card ${adding ? "adding" : ""}`} key={`${bracket.sourceDate}:${bracket.mealType}`}>
               <button type="button" className="recent-bracket-main" disabled={adding} aria-label={`Revisar ${bracket.label} completo`} onClick={() => setReviewingBracket(bracket)}>
                 <div className="recent-bracket-heading"><div><strong>{bracket.label}</strong><small>{readableDate(bracket.sourceDate)}</small></div><span className="recent-bracket-total"><strong>{formatNumber(bracket.calories)} kcal</strong><small>P {formatNumber(bracket.proteinGrams, 1)} g · C {formatNumber(bracket.carbsGrams, 1)} g · G {formatNumber(bracket.fatGrams, 1)} g</small></span></div>
                  <div className="recent-bracket-items">{sortMealLogs(Array.isArray(bracket.items) ? bracket.items : []).map((item) => <span className="recent-bracket-item" key={item.id}><strong>{mealLogName(item)}</strong><small>{formatMealLogAmount(item)} · {formatNumber(item.calories)} kcal · P {formatNumber(item.proteinGrams, 1)} g · C {formatNumber(item.carbsGrams, 1)} g · G {formatNumber(item.fatGrams, 1)} g</small></span>)}</div>
                 <Icon name="chevron_right" className="row-action recent-bracket-action" />
               </button>
               <div className="recent-bracket-actions"><button type="button" className="secondary recent-bracket-share" aria-label={`Compartir ${bracket.label}`} onClick={() => setShareBracket(bracket)}><Icon name="share" /><span>Compartir</span></button><button type="button" className="primary recent-bracket-add" disabled={adding} onClick={() => setReviewingBracket(bracket)}><Icon name="tune" /><span>Revisar</span></button></div>
             </article>)}
           </div>}
          {tab === "FOOD" && normalizedQuery.length === 1 && <CatalogStatus>Escribí al menos 2 caracteres para buscar.</CatalogStatus>}
          {tab === "FOOD" && !normalizedQuery && !recentFoods.length && <CatalogStatus>Buscá un alimento para empezar.</CatalogStatus>}
          {tab === "FOOD" && preparation && !catalog.initialLoading && catalog.items.length > 0 && !filteredFoods.length && <CatalogStatus>No hay coincidencias con esta preparación.{catalog.hasNext && " Cargá más resultados o cambiá el filtro."}</CatalogStatus>}
          {catalog.initialLoading && <SkeletonRows count={4} className="picker-results-skeleton" label="Buscando alimentos" />}
          {!catalog.initialLoading && catalog.error && (
            <CatalogStatus error>
              {catalog.error}
               <button type="button" className="secondary" onClick={catalog.retry}>
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
        </div>}
        {aiOnly && !pendingMealPhoto && !aiEstimate && <div className="ai-registration-intro" data-dialog-scroll-owner="true">
          <Icon name="nutrition" />
          <div>
            <strong>Elegí una foto de tu comida</strong>
            <p>Un alimento va al catálogo; dos o más crean una receta con una porción. Pegá la foto con Ctrl+V antes de analizar.</p>
          </div>
        </div>}
        {aiError && !pendingMealPhoto && !aiEstimate && <p className="ai-estimate-error" role="alert">{aiError}</p>}
        {shareBracket && <MealShareDialog api={api} bracket={shareBracket} onClose={() => setShareBracket(null)} />}
        {reviewingBracket && <RecentMealReviewDialog title={reviewingBracket.label} destination={mealType.label} items={reviewingBracket.items} saving={adding} onClose={() => setReviewingBracket(null)} onConfirm={(reviewedItems) => addRecentMeal(reviewingBracket, reviewedItems)} />}
        {selected && (
          <FoodLogDialog
            item={selected}
            eyebrow={ingredientOnly ? "Agregar ingrediente" : `Agregar a ${mealType.label}`}
            description={selected.type === "RECIPE" ? (recipeDetail?.description || selected.description) : null}
            isRecipe={selected.type === "RECIPE"}
            closeDisabled={adding}
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
                <button className="primary action-control" data-action-state={adding ? "pending" : "idle"} disabled={adding || !preview || !Number.isFinite(decimalNumber(quantity)) || decimalNumber(quantity) <= 0}>
                  {adding ? "Agregando…" : (!Number.isFinite(decimalNumber(quantity)) || decimalNumber(quantity) <= 0) ? "Revisá la cantidad" : previewError ? "Revisá el cálculo" : !preview ? "Calculando…" : ingredientOnly ? "Agregar ingrediente" : `Agregar a ${mealType.label}`}
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
      setUnit(option.baseUnit || "GRAM");
                  }
                }}
                recipeIngredients={selected.type === "RECIPE" ? recipeIngredients : null}
                onRecipeIngredientChange={(index, value) => setRecipeIngredients(recipeIngredients.map((ing, i) => i === index ? { ...ing, quantity: value } : ing))}
                recipeIngredientsLocked={selected.type === "RECIPE" && unit === "GRAM"}
                preview={preview}
              />
              {previewError && <p className="form-error" role="alert">{previewError} <button type="button" className="secondary" onClick={() => setPreviewRetry((value) => value + 1)}>Reintentar</button></p>}
          </FoodLogDialog>
        )}
        {pendingMealPhoto && <MealPhotoContextEditorDialog photoUrl={pendingMealPhotoUrl} context={aiContext} setContext={setAiContext} error={aiError} analyzing={aiAnalyzing} onDiscard={discardMealPhoto} onChangePhoto={() => galleryInputRef.current?.click()} onAnalyze={() => analyzeMealPhoto(pendingMealPhoto)} />}
        {aiEstimate && <AiEstimateEditor estimate={aiEstimate} setEstimate={setAiEstimate} correction={aiCorrection} setCorrection={setAiCorrection} refining={aiRefining} refinementError={aiRefinementError} saveError={aiSaveError} onRefine={refineAiEstimate} saving={adding} checkingMatches={aiCheckingMatches} matchPreview={aiMatchPreview} matchChoices={aiMatchChoices} setMatchChoices={setAiMatchChoices} onEstimateEdited={() => { setAiMatchPreview(null); setAiMatchChoices({}); }} onDiscard={discardAiEstimate} onConfirm={confirmAiEstimate} targetType={aiEstimate.items.length > 1 ? "RECIPE" : "FOOD"} addToDiary={aiAddToDiary} setAddToDiary={setAiAddToDiary} registrationMealType={aiRegistrationMealType} setRegistrationMealType={setAiRegistrationMealType} registrationDate={aiRegistrationDate} setRegistrationDate={setAiRegistrationDate} mealTypes={mealTypes} />}
        {!ingredientOnly && <footer className="picker-photo-actions">
          {aiOnly && <p className="photo-availability" role="status"><strong>{availability.headline}</strong><span>{availability.detail}</span></p>}
          <button type="button" className="secondary ai-photo-trigger ai-gallery-trigger" disabled={aiAnalyzing || !availability.canCapture} onClick={() => galleryInputRef.current?.click()}>
            <Icon name="photo_library" />
            Elegir foto
          </button>
            <input data-photo-source="gallery"
              ref={galleryInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              disabled={aiAnalyzing || !availability.canCapture}
              onChange={(event) => {
                const file = event.currentTarget.files?.[0];
                event.currentTarget.value = "";
                selectMealPhoto(file);
              }}
              hidden
            />
          <button type="button" className="primary ai-photo-trigger ai-camera-trigger" disabled={aiAnalyzing || !availability.canCapture} onClick={() => cameraInputRef.current?.click()}>
            <Icon name="photo_camera" />
            {aiAnalyzing ? "Analizando..." : "Tomar foto"}
          </button>
            <input ref={cameraInputRef} data-photo-source="camera"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              capture="environment"
              disabled={aiAnalyzing || !availability.canCapture}
              onChange={(event) => {
                const file = event.currentTarget.files?.[0];
                event.currentTarget.value = "";
                selectMealPhoto(file);
              }}
              hidden
            />
          {aiOnly && !availability.canCapture && <button type="button" className="secondary photo-manual-return" onClick={onClose}>Volver al registro manual</button>}
        </footer>}
    </ModalShell>
  );
}
