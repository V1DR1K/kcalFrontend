(function () {
  const API_BASE_URL = window.VITALITY_API_BASE_URL || "http://localhost:8081";
  const TOKEN_KEY = "vitalityPeak.token";
  const USER_KEY = "vitalityPeak.user";

  const routes = {
    login: "/iniciar_sesi_n_modo_noche_vitality_peak/code.html",
    register: "/registro_de_usuario_modo_noche_vitality_peak/code.html",
    dashboard: "/dashboard_diario_modo_noche_vitality_peak/code.html",
    foods: "/buscador_de_alimentos_modo_noche_vitality_peak/code.html",
    configure: "/configurar_alimento_modo_noche_vitality_peak/code.html",
    scanner: "/esc_ner_de_c_digo_modo_noche_vitality_peak/code.html",
    history: "/historial_modo_noche_vitality_peak/code.html",
    profile: "/mi_perfil_modo_noche_vitality_peak/code.html"
  };

  const mealMap = {
    desayuno: "BREAKFAST",
    almuerzo: "LUNCH",
    cena: "DINNER",
    snacks: "SNACK",
    snack: "SNACK"
  };

  const goalMap = {
    lose: "LOSE_WEIGHT",
    maintain: "MAINTAIN",
    gain: "GAIN_MUSCLE"
  };

  const categoryMap = {
    "proteinas": "PROTEIN",
    "proteínas": "PROTEIN",
    "lacteos": "DAIRY",
    "lácteos": "DAIRY",
    frutas: "FRUIT",
    verduras: "VEGETABLE",
    cereales: "CEREAL"
  };

  function today() {
    return new Date().toISOString().slice(0, 10);
  }

  function number(value, fallback = 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  function formatNumber(value, digits = 0) {
    return Number(value || 0).toLocaleString("es-AR", {
      maximumFractionDigits: digits,
      minimumFractionDigits: digits
    });
  }

  function token() {
    return localStorage.getItem(TOKEN_KEY);
  }

  function saveSession(payload) {
    const jwt = payload.token || payload.accessToken || payload.jwt;
    if (jwt) localStorage.setItem(TOKEN_KEY, jwt);
    if (payload.user) localStorage.setItem(USER_KEY, JSON.stringify(payload.user));
  }

  async function api(path, options = {}) {
    const headers = {
      "Content-Type": "application/json",
      ...(options.headers || {})
    };
    if (token()) headers.Authorization = `Bearer ${token()}`;

    const response = await fetch(`${API_BASE_URL}${path}`, {
      ...options,
      headers
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(text || `HTTP ${response.status}`);
    }

    if (response.status === 204) return null;
    return response.json();
  }

  function toast(message, isError = false) {
    let container = document.getElementById("toast-container");
    if (!container) {
      container = document.createElement("div");
      container.id = "toast-container";
      container.className = "fixed bottom-lg right-lg z-50";
      document.body.appendChild(container);
    }

    const item = document.createElement("div");
    item.className = `mb-2 rounded-lg px-4 py-3 shadow-lg ${
      isError ? "bg-error text-on-error" : "bg-primary text-on-primary"
    }`;
    item.textContent = message;
    container.appendChild(item);
    setTimeout(() => item.remove(), 3500);
  }

  function setText(selector, value) {
    const element = document.querySelector(selector);
    if (element) element.textContent = value;
  }

  function setTextByContains(selector, contains, value) {
    const element = Array.from(document.querySelectorAll(selector)).find((node) =>
      node.textContent.toLowerCase().includes(contains.toLowerCase())
    );
    if (element) element.textContent = value;
  }

  function go(path) {
    window.location.href = path;
  }

  function selectedGoal() {
    const selected = document.querySelector(".goal-chip.selected");
    const text = selected ? selected.textContent.toLowerCase() : "maintain";
    if (text.includes("bajar")) return "LOSE_WEIGHT";
    if (text.includes("ganar")) return "GAIN_MUSCLE";
    return goalMap[window.selectedGoalValue] || "MAINTAIN";
  }

  function selectedActivity() {
    const value = document.getElementById("activity_level")?.value || "moderate";
    if (value.includes("sedent")) return "SEDENTARY";
    if (value.includes("light")) return "LIGHT";
    if (value.includes("active")) return "ACTIVE";
    if (value.includes("very")) return "VERY_ACTIVE";
    return "MODERATE";
  }

  function selectedGender() {
    const value = document.getElementById("gender")?.value || "MALE";
    if (value.toLowerCase().startsWith("f")) return "FEMALE";
    if (value.toLowerCase().startsWith("o")) return "OTHER";
    return "MALE";
  }

  function initLogin() {
    window.handleLogin = async function handleLogin(event) {
      event.preventDefault();
      const email = document.getElementById("email");
      const password = document.getElementById("password");
      const overlay = document.getElementById("loadingOverlay");

      try {
        overlay?.classList.remove("hidden");
        overlay?.classList.add("flex");
        const payload = await api("/api/auth/login", {
          method: "POST",
          body: JSON.stringify({
            email: email.value,
            password: password.value
          })
        });
        saveSession(payload);
        go(routes.dashboard);
      } catch (error) {
        overlay?.classList.add("hidden");
        overlay?.classList.remove("flex");
        toast("No se pudo iniciar sesion. Revisa email y password.", true);
        console.error(error);
      }
      return false;
    };
  }

  function initRegister() {
    const originalSelectGoal = window.selectGoal;
    window.selectGoal = function selectGoal(goal, element) {
      window.selectedGoalValue = goal;
      if (typeof originalSelectGoal === "function") originalSelectGoal(goal, element);
    };

    const form = document.getElementById("registration-form");
    if (!form) return;

    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      const password = document.getElementById("password")?.value;
      const confirmPassword = document.getElementById("confirm_password")?.value;
      if (password !== confirmPassword) {
        toast("Las contrasenas no coinciden.", true);
        return;
      }

      try {
        const payload = await api("/api/auth/register", {
          method: "POST",
          body: JSON.stringify({
            fullName: document.getElementById("full_name")?.value,
            email: document.getElementById("email")?.value,
            password,
            weightKg: number(document.getElementById("weight")?.value),
            heightCm: number(document.getElementById("height")?.value),
            birthDate: document.getElementById("birth_date")?.value,
            gender: selectedGender(),
            goal: selectedGoal(),
            activityLevel: selectedActivity()
          })
        });
        saveSession(payload);
        toast("Cuenta creada.");
        go(routes.dashboard);
      } catch (error) {
        toast("No se pudo crear la cuenta.", true);
        console.error(error);
      }
    });
  }

  async function initDashboard() {
    try {
      const data = await api(`/api/nutrition/dashboard?date=${today()}`);
      setText("section:nth-of-type(2) .font-display-lg", formatNumber(data.caloriesRemaining));
      setTextByContains("p.font-title-lg", "2,200", formatNumber(data.calorieGoal));
      setTextByContains("p.font-title-lg", "950", formatNumber(data.caloriesConsumed));
      setTextByContains("p", "Has bebido", `Has bebido ${formatNumber(data.waterConsumedLiters, 1)}L de tu meta de ${formatNumber(data.waterGoalLiters, 1)}L`);

      const macros = data.macros || {};
      updateMacro("Prote", macros.protein || macros.proteins);
      updateMacro("Carbo", macros.carbs || macros.carbohydrates);
      updateMacro("Grasas", macros.fat || macros.fats);

      const addWater = Array.from(document.querySelectorAll("button")).find((button) =>
        button.textContent.includes("add") && button.closest(".bg-primary\\/10")
      );
      addWater?.addEventListener("click", async () => {
        await api("/api/nutrition/water-logs", {
          method: "POST",
          body: JSON.stringify({ liters: 0.5, logDate: today() })
        });
        toast("Hidratacion registrada.");
        initDashboard();
      });
    } catch (error) {
      toast("No se pudo cargar el dashboard. Inicia sesion o revisa el backend.", true);
      console.error(error);
    }
  }

  function updateMacro(label, macro) {
    if (!macro) return;
    const blocks = Array.from(document.querySelectorAll(".space-y-xs")).filter((node) =>
      node.textContent.includes(label)
    );
    const block = blocks[0];
    if (!block) return;
    const consumed = macro.consumed ?? macro.current ?? 0;
    const goal = macro.goal ?? macro.target ?? 0;
    const percent = goal ? Math.min(100, Math.round((consumed / goal) * 100)) : 0;
    const labelNode = block.querySelector(".font-label-sm");
    const bar = block.querySelector(".h-full");
    if (labelNode) labelNode.textContent = `${formatNumber(consumed)}g / ${formatNumber(goal)}g`;
    if (bar) bar.style.width = `${percent}%`;
  }

  function foodImage(food) {
    return food.imageUrl || food.image || "screen.png";
  }

  function foodName(food) {
    return food.name || food.displayName || "Alimento";
  }

  function foodCalories(food) {
    return food.kcalPer100g ?? food.caloriesPer100g ?? food.calories ?? 0;
  }

  function renderFoods(foods) {
    const grid = document.querySelector("main section:nth-of-type(3) .grid") || document.querySelector(".grid");
    if (!grid) return;
    grid.innerHTML = foods
      .map(
        (food) => `
          <article class="bg-surface-container-low rounded-xl overflow-hidden border border-outline-variant/30 shadow-sm group hover:border-primary/50 transition-all">
            <div class="h-36 bg-cover bg-center" style="background-image: url('${foodImage(food)}')"></div>
            <div class="p-md flex items-start justify-between gap-md">
              <div>
                <h3 class="font-title-lg text-title-lg text-on-surface">${foodName(food)}</h3>
                <p class="text-on-surface-variant font-label-md">${formatNumber(foodCalories(food))} kcal / 100g</p>
                <p class="text-on-surface-variant text-sm">${food.brand || food.category || ""}</p>
              </div>
              <button data-food-id="${food.id}" class="w-12 h-12 rounded-full bg-surface-container-highest text-primary flex items-center justify-center hover:bg-primary hover:text-on-primary transition-all active:scale-90">
                <span class="material-symbols-outlined">add</span>
              </button>
            </div>
          </article>
        `
      )
      .join("");

    grid.querySelectorAll("[data-food-id]").forEach((button) => {
      button.addEventListener("click", () => {
        localStorage.setItem("vitalityPeak.selectedFoodId", button.dataset.foodId);
        go(`${routes.configure}?foodId=${button.dataset.foodId}`);
      });
    });
  }

  async function loadFoods(params = "") {
    const foods = await api(`/api/foods${params}`);
    renderFoods(Array.isArray(foods) ? foods : foods.content || foods.items || []);
  }

  function initFoods() {
    const input = document.querySelector('input[placeholder*="Buscar"]');
    const scanButton = Array.from(document.querySelectorAll("button")).find((button) =>
      button.textContent.toLowerCase().includes("escan")
    );

    scanButton?.addEventListener("click", () => go(routes.scanner));
    input?.addEventListener("input", debounce(() => {
      const q = input.value.trim();
      loadFoods(q ? `?q=${encodeURIComponent(q)}` : "").catch((error) => {
        toast("No se pudieron cargar alimentos.", true);
        console.error(error);
      });
    }, 300));

    document.querySelectorAll("button").forEach((button) => {
      const category = categoryMap[button.textContent.trim().toLowerCase()];
      if (!category) return;
      button.addEventListener("click", () => loadFoods(`?category=${category}`));
    });

    loadFoods().catch((error) => {
      toast("No se pudieron cargar alimentos.", true);
      console.error(error);
    });
  }

  function debounce(callback, delay) {
    let id;
    return (...args) => {
      clearTimeout(id);
      id = setTimeout(() => callback(...args), delay);
    };
  }

  async function previewFood() {
    const foodId = new URLSearchParams(location.search).get("foodId") || localStorage.getItem("vitalityPeak.selectedFoodId") || "1";
    const quantity = number(document.getElementById("qty-input")?.value, 150);
    const unit = document.getElementById("unit-select")?.value?.toLowerCase().includes("gram") ? "GRAM" : "UNIT";
    const data = await api("/api/foods/preview", {
      method: "POST",
      body: JSON.stringify({ foodId: number(foodId, 1), quantity, unit })
    });
    setText("#kcal-display", formatNumber(data.calories ?? data.kcal));
    setText("#prot-display", `${formatNumber(data.proteinG ?? data.protein)}g`);
    setText("#carb-display", `${formatNumber(data.carbsG ?? data.carbs)}g`);
    setText("#fat-display", `${formatNumber(data.fatG ?? data.fat, 1)}g`);
  }

  function initConfigureFood() {
    const quantity = document.getElementById("qty-input");
    const unit = document.getElementById("unit-select");
    quantity?.addEventListener("input", debounce(() => previewFood().catch(console.error), 250));
    unit?.addEventListener("change", () => previewFood().catch(console.error));

    const addButton = Array.from(document.querySelectorAll("button")).find((button) =>
      button.textContent.toLowerCase().includes("agregar")
    );
    addButton?.addEventListener("click", async () => {
      try {
        const mealLabel = document.getElementById("meal-select")?.value || "Almuerzo";
        const foodId = new URLSearchParams(location.search).get("foodId") || localStorage.getItem("vitalityPeak.selectedFoodId") || "1";
        await api("/api/nutrition/food-logs", {
          method: "POST",
          body: JSON.stringify({
            foodId: number(foodId, 1),
            mealType: mealMap[mealLabel.toLowerCase()] || "LUNCH",
            quantity: number(quantity?.value, 150),
            unit: unit?.value?.toLowerCase().includes("gram") ? "GRAM" : "UNIT",
            logDate: today()
          })
        });
        toast("Alimento agregado.");
        go(routes.dashboard);
      } catch (error) {
        toast("No se pudo guardar el alimento.", true);
        console.error(error);
      }
    });

    previewFood().catch(console.error);
  }

  async function initScanner() {
    try {
      const food = await api("/api/foods/barcode/7790000000059");
      setText("#result-card h3", foodName(food));
      setText("#result-card p", `${formatNumber(foodCalories(food))} kcal / 100g`);
      const addButton = Array.from(document.querySelectorAll("button")).find((button) =>
        button.textContent.toLowerCase().includes("agregar")
      );
      addButton?.addEventListener("click", () => {
        localStorage.setItem("vitalityPeak.selectedFoodId", food.id || 1);
        go(`${routes.configure}?foodId=${food.id || 1}`);
      });
    } catch (error) {
      toast("No se pudo leer el codigo de barras.", true);
      console.error(error);
    }
  }

  async function initHistory() {
    try {
      const date = new Date();
      const data = await api(`/api/nutrition/history?year=${date.getFullYear()}&month=${date.getMonth() + 1}`);
      const days = data.days || data.items || data;
      const reached = Array.isArray(days) ? days.filter((day) => day.goalReached).length : 0;
      setTextByContains("p", "racha", `Racha: ${reached} dias con objetivo cumplido`);
      setTextByContains("p", "adherencia", `Adherencia mensual: ${Array.isArray(days) ? Math.round((reached / days.length) * 100) : 0}%`);
    } catch (error) {
      toast("No se pudo cargar el historial.", true);
      console.error(error);
    }
  }

  async function initProfile() {
    try {
      const profile = await api("/api/profile");
      setText("main h3", profile.fullName || "Perfil");
      setTextByContains("p", "kg", `${formatNumber(profile.weightKg, 1)} kg`);
      setTextByContains("p", "cm", `${formatNumber(profile.heightCm)} cm`);
      setTextByContains("p", "Actividad", profile.activityLevel || "Actividad");
      setTextByContains("p", "Objetivo", profile.goal || "Objetivo");
    } catch (error) {
      toast("No se pudo cargar el perfil.", true);
      console.error(error);
    }
  }

  function boot() {
    const path = window.location.pathname;
    if (path.endsWith(routes.login)) initLogin();
    if (path.endsWith(routes.register)) initRegister();
    if (path.endsWith(routes.dashboard)) initDashboard();
    if (path.endsWith(routes.foods)) initFoods();
    if (path.endsWith(routes.configure)) initConfigureFood();
    if (path.endsWith(routes.scanner)) initScanner();
    if (path.endsWith(routes.history)) initHistory();
    if (path.endsWith(routes.profile)) initProfile();
  }

  window.VitalityApi = { api, routes, API_BASE_URL };
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
