import React, { useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { BrowserMultiFormatReader } from "@zxing/browser";
import "./styles.css";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "";
const APP_NAME = "KazaFitness";
const TOKEN_KEY = "kazaFitness.token";
const USER_KEY = "kazaFitness.user";
const DEFAULT_MEALS = [
  { code: "BREAKFAST", label: "Desayuno" },
  { code: "LUNCH", label: "Almuerzo" },
  { code: "AFTERNOON_SNACK", label: "Merienda" },
  { code: "DINNER", label: "Cena" },
];
const navItems = [
  { id: "dashboard", label: "Dashboard", icon: "monitoring" },
  { id: "foods", label: "Alimentos", icon: "nutrition" },
  { id: "create", label: "Crear", icon: "add_box" },
  { id: "history", label: "Historial", icon: "calendar_month" },
  { id: "profile", label: "Perfil", icon: "account_circle" },
  { id: "scanner", label: "Escaner", icon: "qr_code_scanner" },
];
const CATEGORY_OPTIONS = [
  { value: "PROTEIN", label: "Proteinas" },
  { value: "DAIRY", label: "Lacteos" },
  { value: "FRUIT", label: "Frutas" },
  { value: "VEGETABLE", label: "Verduras" },
  { value: "CEREAL", label: "Cereales" },
  { value: "FAT", label: "Grasas" },
  { value: "OTHER", label: "Otros" },
];
const PREPARATION_OPTIONS = [
  { value: "RAW", label: "Crudo/a" },
  { value: "COOKED", label: "Cocido/a" },
  { value: "AS_SOLD", label: "Según envase / como se vende" },
  { value: "UNSPECIFIED", label: "Sin especificar" },
];
const CATEGORY_ART = {
  PROTEIN: "/category-assets/protein.webp",
  DAIRY: "/category-assets/dairy.webp",
  FRUIT: "/category-assets/fruit.webp",
  VEGETABLE: "/category-assets/vegetable.webp",
  CEREAL: "/category-assets/cereal.webp",
  FAT: "/category-assets/fat.webp",
  OTHER: "/category-assets/other.webp",
};
const RECIPE_ART = "/category-assets/recipe.webp";
const UNIT_OPTIONS = [
  { value: "GRAM", label: "Gramos" },
  { value: "MILLILITER", label: "Mililitros" },
  { value: "UNIT", label: "Unidad" },
  { value: "PORTION", label: "Porcion" },
];

function today() {
  return new Date().toISOString().slice(0, 10);
}

function shiftDate(date, days) {
  const value = new Date(`${date}T00:00:00`);
  value.setDate(value.getDate() + days);
  return value.toISOString().slice(0, 10);
}

function readableDate(date) {
  return new Date(`${date}T00:00:00`).toLocaleDateString("es-AR", {
    weekday: "short",
    day: "2-digit",
    month: "short",
  });
}

function formatNumber(value, digits = 0) {
  return Number(value || 0).toLocaleString("es-AR", { maximumFractionDigits: digits, minimumFractionDigits: digits });
}

function macroGrams(calories, percent, caloriesPerGram) {
  return Math.round((Number(calories || 0) * Number(percent || 0)) / 100 / caloriesPerGram);
}

function macroValue(item, key) {
  return Number(item?.[key] ?? item?.[key.replace("Grams", "G")] ?? 0);
}

async function request(path, options = {}) {
  const token = localStorage.getItem(TOKEN_KEY);
  const isFormData = options.body instanceof FormData;
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: {
      Accept: "application/json",
      ...(isFormData ? {} : { "Content-Type": "application/json" }),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    },
  });
  if (!response.ok) {
    const text = await response.text();
    if (response.status === 401 || response.status === 403) {
      window.dispatchEvent(new Event("kazaFitness:session-expired"));
    }
    throw new Error(text || `HTTP ${response.status}`);
  }
  return response.status === 204 ? null : response.json();
}

function getSavedUser() {
  const saved = localStorage.getItem(USER_KEY);
  return saved ? JSON.parse(saved) : null;
}

function recentsKey(user) {
  return `kazaFitness.recents.${user?.id || "guest"}`;
}

function readRecents(user) {
  try {
    return JSON.parse(localStorage.getItem(recentsKey(user))) || { items: [], meals: [] };
  } catch {
    return { items: [], meals: [] };
  }
}

function writeRecents(user, recents) {
  localStorage.setItem(recentsKey(user), JSON.stringify(recents));
}

function rememberItem(user, item) {
  const recents = readRecents(user);
  const key = `${item.type}:${item.id}`;
  recents.items = [item, ...recents.items.filter((saved) => `${saved.type}:${saved.id}` !== key)].slice(0, 20);
  writeRecents(user, recents);
}

function rememberMeal(user, mealType, log) {
  const recents = readRecents(user);
  const item = log.itemType === "RECIPE" ? log.recipe : log.food;
  const entry = {
    id: `${mealType}:${log.itemType}:${item?.id}:${log.quantity}:${Date.now()}`,
    mealType,
    label: item?.name || "Comida",
    itemType: log.itemType,
    itemId: item?.id,
    quantity: log.quantity,
    unit: log.unit,
    lastUsedAt: new Date().toISOString(),
  };
  recents.meals = [entry, ...recents.meals.filter((saved) => saved.itemId !== entry.itemId || saved.itemType !== entry.itemType)].slice(0, 10);
  writeRecents(user, recents);
}

function App() {
  const [page, setPage] = useState(() => (localStorage.getItem(TOKEN_KEY) ? "dashboard" : "login"));
  const [toast, setToast] = useState(null);
  const [user, setUser] = useState(getSavedUser);
  const [selectedFoodId, setSelectedFoodId] = useState(null);
  const [prefillBarcode, setPrefillBarcode] = useState("");

  const api = useMemo(() => ({
    request,
    notify(message, tone = "success") {
      setToast({ message, tone });
      window.setTimeout(() => setToast(null), 3500);
    },
  }), []);

  function saveSession(payload) {
    localStorage.setItem(TOKEN_KEY, payload.token);
    localStorage.setItem(USER_KEY, JSON.stringify(payload.user));
    setUser(payload.user);
    setPage("dashboard");
  }

  function logout() {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    setUser(null);
    setPage("login");
  }

  useEffect(() => {
    const expireSession = () => {
      logout();
      api.notify("Tu sesion vencio. Volve a ingresar.", "error");
    };
    window.addEventListener("kazaFitness:session-expired", expireSession);
    return () => window.removeEventListener("kazaFitness:session-expired", expireSession);
  }, [api]);

  const authenticated = Boolean(localStorage.getItem(TOKEN_KEY));
  return (
    <>
      {authenticated ? (
        <Shell user={user} page={page} setPage={setPage} logout={logout}>
          {page === "dashboard" && <Dashboard api={api} user={user} setPage={setPage} />}
          {page === "foods" && <Foods api={api} user={user} setPage={setPage} setSelectedFoodId={setSelectedFoodId} />}
          {page === "create" && <CreateCatalog api={api} prefillBarcode={prefillBarcode} clearPrefillBarcode={() => setPrefillBarcode("")} />}
          {page === "configure" && <ConfigureFood api={api} setPage={setPage} foodId={selectedFoodId} user={user} />}
          {page === "scanner" && <Scanner api={api} setPage={setPage} setSelectedFoodId={setSelectedFoodId} setPrefillBarcode={setPrefillBarcode} />}
          {page === "history" && <History api={api} />}
          {page === "profile" && <Profile api={api} logout={logout} />}
        </Shell>
      ) : (
        <AuthScreen page={page} setPage={setPage} saveSession={saveSession} notify={api.notify} />
      )}
      {toast && <Toast {...toast} />}
    </>
  );
}

function Shell({ children, user, page, setPage, logout }) {
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <span className="material-symbols-outlined fill">vital_signs</span>
          <div><strong>{APP_NAME}</strong><span>{user?.fullName || "Plan diario"}</span></div>
        </div>
        <nav>
          {navItems.map((item) => (
            <button key={item.id} className={page === item.id ? "active" : ""} onClick={() => setPage(item.id)}>
              <span className="material-symbols-outlined">{item.icon}</span>{item.label}
            </button>
          ))}
        </nav>
        <button className="ghost" onClick={logout}><span className="material-symbols-outlined">logout</span>Salir</button>
      </aside>
      <main className="content">{children}</main>
      <nav className="mobile-nav" aria-label="Navegacion principal">
        {navItems.map((item) => (
          <button key={item.id} className={page === item.id ? "active" : ""} onClick={() => setPage(item.id)}>
            <span className="material-symbols-outlined">{item.icon}</span>{item.label}
          </button>
        ))}
      </nav>
    </div>
  );
}

function AuthScreen({ page, setPage, saveSession, notify }) {
  const isRegister = page === "register";
  const [loading, setLoading] = useState(false);
  async function submit(event) {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(event.currentTarget));
    setLoading(true);
    try {
      const payload = await request(isRegister ? "/api/auth/register" : "/api/auth/login", {
        method: "POST",
        body: JSON.stringify(isRegister ? {
          fullName: data.fullName, email: data.email, password: data.password, weightKg: Number(data.weightKg),
          heightCm: Number(data.heightCm), birthDate: data.birthDate, gender: data.gender, goal: data.goal,
          activityLevel: data.activityLevel,
        } : { email: data.email, password: data.password }),
      });
      saveSession(payload);
      notify(isRegister ? "Cuenta creada." : "Sesion iniciada.");
    } catch (error) {
      notify(isRegister ? "No se pudo crear la cuenta." : "No se pudo iniciar sesion.", "error");
      console.error(error);
    } finally {
      setLoading(false);
    }
  }
  return (
    <main className="auth-page">
      <section className="auth-card">
        <div className="brand auth-brand"><span className="material-symbols-outlined fill">vital_signs</span><div><strong>{APP_NAME}</strong><span>{isRegister ? "Crear cuenta" : "Ingreso"}</span></div></div>
        <form onSubmit={submit} className="form-grid">
          {isRegister && <Input name="fullName" label="Nombre completo" required />}
          <Input name="email" label="Email" type="email" defaultValue={isRegister ? "" : "alex@kazadesarrollos.com"} required />
          <Input name="password" label="Password" type="password" defaultValue={isRegister ? "" : "password123"} required />
          {isRegister && (
            <>
              <div className="split"><Input name="weightKg" label="Peso kg" type="number" defaultValue="75" required /><Input name="heightCm" label="Altura cm" type="number" defaultValue="175" required /></div>
              <Input name="birthDate" label="Fecha de nacimiento" type="date" defaultValue="1995-01-01" />
              <div className="split"><Select name="gender" label="Genero" options={["MALE", "FEMALE", "OTHER"]} /><Select name="activityLevel" label="Actividad" options={["SEDENTARY", "LIGHT", "MODERATE", "ACTIVE", "VERY_ACTIVE"]} /></div>
              <Select name="goal" label="Objetivo" options={["LOSE_WEIGHT", "MAINTAIN", "GAIN_MUSCLE"]} />
            </>
          )}
          <button className="primary" disabled={loading}>{loading ? "Procesando..." : isRegister ? "Crear cuenta" : "Ingresar"}</button>
        </form>
        <button className="link-button" onClick={() => setPage(isRegister ? "login" : "register")}>{isRegister ? "Ya tengo cuenta" : "Crear una cuenta nueva"}</button>
      </section>
    </main>
  );
}

function Dashboard({ api, user, setPage }) {
  const [data, setData] = useState(null);
  const [mealTypes, setMealTypes] = useState(DEFAULT_MEALS);
  const [pickerMeal, setPickerMeal] = useState(null);
  const [selectedDate, setSelectedDate] = useState(today());
  const load = (date = selectedDate) => api.request(`/api/nutrition/dashboard?date=${date}`).then(setData).catch((error) => {
    api.notify("No se pudo cargar el dashboard.", "error");
    console.error(error);
  });
  useEffect(() => {
    load(selectedDate);
    api.request("/api/nutrition/meal-types").then(setMealTypes).catch(() => setMealTypes(DEFAULT_MEALS));
  }, [selectedDate]);
  const macros = data?.macros || [];
  const mealByCode = new Map((data?.meals || []).map((meal) => [meal.mealType, meal]));
  return (
    <section className="page">
      <Header title="Dashboard diario" eyebrow={data?.plan?.name || "Plan alimenticio"} action={<DateNavigator date={selectedDate} setDate={setSelectedDate} />} />
      <div className="dashboard-hero dashboard-hero-full">
        <div className="calorie-ring">
          <svg viewBox="0 0 160 160" aria-hidden="true">
            <circle cx="80" cy="80" r="68" />
            <circle className="progress" cx="80" cy="80" r="68" style={{ strokeDashoffset: 427 - 427 * Math.min(1, (data?.caloriesConsumed || 0) / (data?.calorieGoal || 1)) }} />
          </svg>
          <div><span>Restantes</span><strong>{formatNumber(data?.caloriesRemaining)}</strong><small>kcal</small></div>
        </div>
        <div className="balance-copy">
          <h2>Tu balance de hoy</h2>
          <p>{formatNumber(data?.caloriesConsumed)} de {formatNumber(data?.calorieGoal)} kcal consumidas</p>
          {data?.plan && <small>{data.plan.proteinPercent}% proteinas / {data.plan.carbsPercent}% carbs / {data.plan.fatPercent}% grasas</small>}
        </div>
        <div className="macro-strip">
          {macros.map((macro) => <Macro key={macro.key} macro={macro} />)}
        </div>
      </div>
      <div className="meal-grid">
        {mealTypes.map((mealType) => (
          <MealCard key={mealType.code} mealType={mealType} meal={mealByCode.get(mealType.code)} onAdd={() => setPickerMeal(mealType)} onDelete={(log) => {
            if (!window.confirm(`Eliminar ${log.itemType === "RECIPE" ? log.recipe?.name : log.food?.name} del registro?`)) return;
            api.request(`/api/nutrition/food-logs/${log.id}`, { method: "DELETE" }).then(() => {
              api.notify("Registro eliminado.");
              load();
            }).catch(() => api.notify("No se pudo eliminar el registro.", "error"));
          }} />
        ))}
      </div>
      <div className="grid two">
        <Panel title="Agua">
          <p className="big">{formatNumber(data?.waterConsumedLiters, 1)}L / {formatNumber(data?.waterGoalLiters, 1)}L</p>
          <div className="water-actions">
            <button className="secondary" disabled={!Number(data?.waterConsumedLiters)} onClick={() => api.request(`/api/nutrition/water-logs/latest?date=${selectedDate}`, { method: "DELETE" }).then(() => { api.notify("Ultimo registro de agua eliminado."); load(); }).catch(() => api.notify("No hay agua para descontar.", "error"))}>Deshacer</button>
            <button className="secondary" onClick={() => api.request("/api/nutrition/water-logs", { method: "POST", body: JSON.stringify({ liters: 0.5, logDate: selectedDate }) }).then(() => { api.notify("Hidratacion registrada."); load(); })}>Sumar 0.5L</button>
          </div>
        </Panel>
        <Panel title="Accesos rapidos"><RecentMeals user={user} api={api} date={selectedDate} onDone={load} /></Panel>
      </div>
      {pickerMeal && <FoodPicker api={api} user={user} mealType={pickerMeal} selectedDate={selectedDate} onClose={() => setPickerMeal(null)} onDone={() => { setPickerMeal(null); load(); }} setPage={setPage} />}
    </section>
  );
}

function DateNavigator({ date, setDate }) {
  return (
    <div className="date-nav">
      <button className="icon-button" onClick={() => setDate(shiftDate(date, -1))}><span className="material-symbols-outlined">chevron_left</span></button>
      <label>
        <span>{readableDate(date)}</span>
        <input type="date" value={date} onChange={(event) => setDate(event.target.value)} />
      </label>
      <button className="icon-button" onClick={() => setDate(shiftDate(date, 1))}><span className="material-symbols-outlined">chevron_right</span></button>
      <button className="secondary today-button" onClick={() => setDate(today())}>Hoy</button>
    </div>
  );
}

function MealCard({ mealType, meal, onAdd, onDelete }) {
  const items = meal?.items || [];
  return (
    <article className="meal-card">
      <header><div><span>{mealType.label}</span><strong>{meal?.calories || 0} kcal</strong></div><button className="icon-button" onClick={onAdd}><span className="material-symbols-outlined">add</span></button></header>
      <div className="meal-macros"><small>P {formatNumber(meal?.proteinGrams, 1)}g</small><small>C {formatNumber(meal?.carbsGrams, 1)}g</small><small>G {formatNumber(meal?.fatGrams, 1)}g</small></div>
      {items.length ? items.map((log) => {
        const item = log.itemType === "RECIPE" ? { ...log.recipe, type: "RECIPE" } : { ...log.food, type: "FOOD" };
        return <div className="meal-item" key={log.id}><FoodThumb item={item} compact /><span>{item.name}</span><strong>{log.calories} kcal</strong><button className="remove-log" aria-label="Eliminar registro" title="Eliminar registro" onClick={() => onDelete(log)}><span className="material-symbols-outlined">delete</span></button></div>;
      }) : <p className="empty-state">Todavia no registraste nada.</p>}
    </article>
  );
}

function FoodPicker({ api, user, mealType, selectedDate, onClose, onDone, setPage }) {
  const [tab, setTab] = useState("FOOD");
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("");
  const [results, setResults] = useState([]);
  const [selected, setSelected] = useState(null);
  const [selectedPreparations, setSelectedPreparations] = useState([]);
  const [quantity, setQuantity] = useState("150");
  const [preview, setPreview] = useState(null);
  const recents = readRecents(user);
  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = previousOverflow; };
  }, []);
  useEffect(() => {
    const id = window.setTimeout(async () => {
      const params = new URLSearchParams({ size: "20" });
      if (query) params.set("q", query);
      if (tab === "FOOD" && category) params.set("category", category);
      const data = await api.request(`${tab === "FOOD" ? "/api/foods" : "/api/recipes"}?${params}`);
      setResults(data.items || data);
    }, 250);
    return () => window.clearTimeout(id);
  }, [api, tab, query, category]);
  useEffect(() => {
    if (!selected || selected.type !== "FOOD") return setSelectedPreparations([]);
    api.request(`/api/foods/${selected.id}/preparations`).then(setSelectedPreparations).catch(() => setSelectedPreparations([]));
  }, [api, selected?.id, selected?.type]);
  useEffect(() => {
    const numericQuantity = Number(quantity);
    if (!selected || !Number.isFinite(numericQuantity) || numericQuantity <= 0) return setPreview(null);
    if (selected.type === "FOOD") {
      api.request("/api/foods/preview", { method: "POST", body: JSON.stringify({ foodId: selected.id, quantity: numericQuantity, unit: "GRAM" }) }).then(setPreview).catch(console.error);
    } else {
      const ratio = numericQuantity / Number(selected.totalWeightGrams || 1);
      setPreview({ calories: Math.round(selected.calories * ratio), proteinGrams: selected.proteinGrams * ratio, carbsGrams: selected.carbsGrams * ratio, fatGrams: selected.fatGrams * ratio });
    }
  }, [api, selected, quantity]);
  async function add() {
    const numericQuantity = Number(quantity);
    if (!Number.isFinite(numericQuantity) || numericQuantity <= 0) return;
    const log = await api.request("/api/nutrition/meal-logs", {
      method: "POST",
      body: JSON.stringify({ itemType: selected.type, itemId: selected.id, mealType: mealType.code, quantity: numericQuantity, unit: "GRAM", logDate: selectedDate }),
    });
    rememberItem(user, selected);
    rememberMeal(user, mealType.code, log);
    api.notify(`${selected.name} agregado a ${mealType.label}.`);
    onDone();
  }
  return (
    <div className="modal-backdrop">
      <section className="picker-modal">
        <header><div><span>{mealType.label}</span><h2>Agregar comida</h2></div><button className="icon-button" onClick={onClose}><span className="material-symbols-outlined">close</span></button></header>
        <div className="tabs"><button className={tab === "FOOD" ? "selected" : ""} onClick={() => { setTab("FOOD"); setSelected(null); }}>Alimentos</button><button className={tab === "RECIPE" ? "selected" : ""} onClick={() => { setTab("RECIPE"); setSelected(null); }}>Recetas</button></div>
        <div className="picker-tools">
          <div className="search-wrap"><span className="material-symbols-outlined">search</span><input className="search" placeholder={`Buscar ${tab === "FOOD" ? "alimentos" : "recetas"}...`} value={query} onChange={(event) => setQuery(event.target.value)} /></div>
          {tab === "FOOD" && <CategoryChips category={category} setCategory={setCategory} />}
        </div>
        <div className="picker-scroll">
          <QuickItems title="Usados recientemente" items={groupFoodVariants(recents.items.filter((item) => item.type === tab))} onPick={setSelected} />
          <div className="picker-results">
            {groupFoodVariants(results).map((item) => <CatalogRowWithImage key={`${tab}:${item.preparationGroup || item.id}`} item={{ ...item, type: tab }} onPick={setSelected} />)}
          </div>
        </div>
        {selected && (
          <div className="selected-editor">
            <div className="selected-heading"><FoodThumb item={selected} compact /><div><strong>{selected.name}</strong><PreparationBadge food={selected} /></div></div>
            {selectedPreparations.length > 1 && <Select label="Peso del alimento" value={String(selected.id)} onChange={(event) => { const option = selectedPreparations.find((item) => item.id === Number(event.target.value)); if (option) setSelected({ ...option, type: "FOOD" }); }} options={selectedPreparations.map((item) => ({ value: String(item.id), label: preparationLabel(item.preparation) }))} />}
            <div className="split"><Input label={selected.type === "RECIPE" ? "Gramos ingeridos" : "Gramos"} type="number" inputMode="decimal" min="0" value={quantity} onChange={(event) => setQuantity(event.target.value)} /><div className="preview mini">{formatNumber(preview?.calories)} kcal</div></div>
            <small>P {formatNumber(preview?.proteinGrams, 1)}g · C {formatNumber(preview?.carbsGrams, 1)}g · G {formatNumber(preview?.fatGrams, 1)}g</small>
            <button className="primary" disabled={Number(quantity) <= 0} onClick={add}>Agregar a {mealType.label}</button>
          </div>
        )}
        <footer><button className="secondary" onClick={() => setPage("scanner")}>Escanear</button><button className="secondary" onClick={() => setPage("create")}>Crear nuevo</button></footer>
      </section>
    </div>
  );
}

function QuickItems({ title, items, onPick }) {
  if (!items.length) return null;
  return <section className="quick-items"><span>{title}</span><div>{items.map((item) => <button key={`${item.type}:${item.id}`} onClick={() => onPick(item)}>{item.name}</button>)}</div></section>;
}

function RecentMeals({ user, api, date, onDone }) {
  const meals = readRecents(user).meals || [];
  async function addRecent(meal) {
    await api.request("/api/nutrition/meal-logs", { method: "POST", body: JSON.stringify({ itemType: meal.itemType, itemId: meal.itemId, mealType: meal.mealType, quantity: meal.quantity, unit: meal.unit, logDate: date }) });
    api.notify("Comida reciente agregada.");
    onDone();
  }
  if (!meals.length) return <p className="empty-state">Tus comidas recientes apareceran aca.</p>;
  return <div className="recent-meals">{meals.map((meal) => <button key={meal.id} onClick={() => addRecent(meal)}><span>{meal.label}</span><small>{meal.quantity}g</small></button>)}</div>;
}

function Foods({ api, user, setPage, setSelectedFoodId }) {
  const [tab, setTab] = useState("FOOD");
  const [foods, setFoods] = useState([]);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("");
  useEffect(() => {
    const id = window.setTimeout(async () => {
      const params = new URLSearchParams({ size: "20" });
      if (query) params.set("q", query);
      if (tab === "FOOD" && category) params.set("category", category);
      const data = await api.request(`${tab === "FOOD" ? "/api/foods" : "/api/recipes"}?${params}`);
      setFoods(data.items || data);
    }, 250);
    return () => window.clearTimeout(id);
  }, [api, query, category, tab]);
  return (
    <section className="page">
      <Header title="Alimentos" action={<div className="header-actions"><button className="secondary" onClick={() => setPage("create")}>Crear</button><button className="primary pill" onClick={() => setPage("scanner")}><span className="material-symbols-outlined">barcode_scanner</span>Escanear codigo</button></div>} />
      <div className="tabs"><button className={tab === "FOOD" ? "selected" : ""} onClick={() => setTab("FOOD")}>Alimentos</button><button className={tab === "RECIPE" ? "selected" : ""} onClick={() => setTab("RECIPE")}>Recetas</button></div>
      <div className="search-wrap"><span className="material-symbols-outlined">search</span><input className="search" placeholder="Buscar..." value={query} onChange={(event) => setQuery(event.target.value)} /></div>
      {tab === "FOOD" && <CategoryChips category={category} setCategory={setCategory} />}
      <QuickItems title="Accesos rapidos" items={groupFoodVariants(readRecents(user).items.filter((item) => item.type === tab))} onPick={(item) => { if (item.type === "FOOD") { setSelectedFoodId(item.id); setPage("configure"); } }} />
      <div className="food-grid">
        {groupFoodVariants(foods).map((item) => <CatalogCard key={`${tab}:${item.preparationGroup || item.id}`} item={{ ...item, type: tab }} onAdd={() => { if (tab === "FOOD") { setSelectedFoodId(item.id); setPage("configure"); } }} />)}
      </div>
    </section>
  );
}

function CategoryChips({ category, setCategory }) {
  return <div className="chips">{[{ value: "", label: "Todos" }, ...CATEGORY_OPTIONS.filter((option) => option.value !== "OTHER")].map(({ value, label }) => <button key={label} className={category === value ? "selected" : ""} onClick={() => setCategory(value)}>{label}</button>)}</div>;
}

function CatalogRow({ item, onPick }) {
  return <button className="catalog-row" onClick={() => onPick(item)}><span>{item.name}</span><PreparationBadge food={item} /><small>{item.calories} kcal · P {formatNumber(item.proteinGrams, 1)}g · C {formatNumber(item.carbsGrams, 1)}g · G {formatNumber(item.fatGrams, 1)}g</small></button>;
}

function groupFoodVariants(items) {
  const grouped = new Map();
  for (const item of items || []) {
    const key = item.preparationGroup ? `preparation:${item.preparationGroup}` : `item:${item.type || "FOOD"}:${item.id}`;
    const current = grouped.get(key);
    if (!current || (item.preparation === "COOKED" && current.preparation !== "COOKED")) grouped.set(key, item);
  }
  return [...grouped.values()];
}

function CatalogCard({ item, onAdd }) {
  return (
    <article className="food-card">
      <FoodThumb item={item} />
      <div><h3>{item.name}</h3><p>{item.type === "RECIPE" ? `${formatNumber(item.totalWeightGrams)}g totales` : item.brand || categoryLabel(item.category)}</p>{item.type === "FOOD" && <PreparationBadge food={item} />}</div>
      <strong>{item.calories} kcal</strong>
      {item.type === "FOOD" && <button className="icon-button add-food" onClick={onAdd} aria-label={`Agregar ${item.name}`}><span className="material-symbols-outlined">add</span></button>}
    </article>
  );
}

function CreateCatalog({ api, prefillBarcode, clearPrefillBarcode }) {
  const [tab, setTab] = useState("FOOD");
  return (
    <section className="page narrow">
      <Header title="Crear" eyebrow="Catalogo global" />
      <div className="tabs"><button className={tab === "FOOD" ? "selected" : ""} onClick={() => setTab("FOOD")}>Alimento</button><button className={tab === "RECIPE" ? "selected" : ""} onClick={() => setTab("RECIPE")}>Receta</button></div>
      {tab === "FOOD" ? <CreateFoodForm api={api} prefillBarcode={prefillBarcode} clearPrefillBarcode={clearPrefillBarcode} /> : <CreateRecipeForm api={api} />}
    </section>
  );
}

function CreateFoodForm({ api, prefillBarcode, clearPrefillBarcode }) {
  async function submit(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    const data = Object.fromEntries(formData);
    try {
      const food = await api.request("/api/foods", { method: "POST", body: JSON.stringify({ name: data.name, brand: data.brand, barcode: data.barcode, category: data.category, baseUnit: "GRAM", baseQuantity: Number(data.baseQuantity || 100), calories: Number(data.calories), proteinGrams: Number(data.proteinGrams), carbsGrams: Number(data.carbsGrams), fatGrams: Number(data.fatGrams), preparation: data.preparation, servingName: data.servingName || null, servingWeightGrams: data.servingWeightGrams ? Number(data.servingWeightGrams) : null, tags: data.tags ? data.tags.split(",").map((tag) => tag.trim()).filter(Boolean) : [] }) });
      const image = formData.get("image");
      if (image?.size) {
        const upload = new FormData();
        upload.append("image", image);
        await api.request(`/api/foods/${food.id}/image`, { method: "POST", body: upload });
      }
      api.notify("Alimento creado.");
      form.reset();
      clearPrefillBarcode?.();
    } catch (error) {
      api.notify("No se pudo crear el alimento.", "error");
      console.error(error);
    }
  }
  return <Panel title="Nuevo alimento"><form className="form-grid" onSubmit={submit}><Input name="name" label="Nombre" required /><Input name="brand" label="Marca" /><Input name="barcode" label="Codigo de barras opcional" defaultValue={prefillBarcode || ""} /><Select name="category" label="Categoria" options={CATEGORY_OPTIONS} /><Select name="preparation" label="Estado al medir" options={PREPARATION_OPTIONS} /><Input name="baseQuantity" label="Base nutricional en gramos" type="number" defaultValue="100" required /><div className="split"><Input name="servingName" label="Nombre de unidad (opcional)" placeholder="Ej: galletita, taza" /><Input name="servingWeightGrams" label="Gramos por unidad" type="number" step="0.1" min="0" /></div><div className="split"><Input name="calories" label="Kcal" type="number" required /><Input name="proteinGrams" label="Proteinas g" type="number" step="0.1" required /></div><div className="split"><Input name="carbsGrams" label="Carbohidratos g" type="number" step="0.1" required /><Input name="fatGrams" label="Grasas g" type="number" step="0.1" required /></div><Input name="tags" label="Tags separados por coma" /><Input name="image" label="Foto del producto" type="file" accept="image/jpeg,image/png,image/webp" /><button className="primary">Crear alimento</button></form></Panel>;
}

function CatalogRowWithImage({ item, onPick }) {
  return <button className="catalog-row catalog-row-image" onClick={() => onPick(item)}><FoodThumb item={item} compact /><span className="catalog-copy"><strong>{item.name}</strong><PreparationBadge food={item} /><small>{item.calories} kcal · P {formatNumber(item.proteinGrams, 1)}g · C {formatNumber(item.carbsGrams, 1)}g · G {formatNumber(item.fatGrams, 1)}g</small></span><span className="material-symbols-outlined row-action">chevron_right</span></button>;
}

function FoodThumb({ item, compact = false, hero = false }) {
  const fallback = item?.type === "RECIPE" ? RECIPE_ART : CATEGORY_ART[item?.category] || CATEGORY_ART.OTHER;
  return <div className={`food-thumb ${compact ? "compact" : ""} ${hero ? "hero" : ""}`}><img src={item?.imageUrl || fallback} onError={(event) => { event.currentTarget.onerror = null; event.currentTarget.src = fallback; }} alt="" /></div>;
}

function PreparationBadge({ food, showUnknown = false }) {
  if (!food || food.type === "RECIPE") return null;
  const option = PREPARATION_OPTIONS.find(({ value }) => value === food.preparation);
  if (!option || (!showUnknown && food.preparation === "UNSPECIFIED")) return null;
  return <small className={`preparation-badge preparation-${food.preparation.toLowerCase()}`} title={food.preparationSource || undefined}>{option.label}</small>;
}

function preparationLabel(preparation) {
  return PREPARATION_OPTIONS.find(({ value }) => value === preparation)?.label || "Sin especificar";
}

function CreateRecipeForm({ api }) {
  const [query, setQuery] = useState("");
  const [foods, setFoods] = useState([]);
  const [ingredients, setIngredients] = useState([]);
  const [preview, setPreview] = useState(null);
  useEffect(() => {
    const id = window.setTimeout(() => api.request(`/api/foods?q=${encodeURIComponent(query)}&size=10`).then((data) => setFoods(data.items || [])).catch(console.error), 250);
    return () => window.clearTimeout(id);
  }, [api, query]);
  useEffect(() => {
    const totalWeight = Number(document.querySelector("[name='totalWeightGrams']")?.value || 0);
    if (!ingredients.length || !totalWeight) return setPreview(null);
    api.request("/api/recipes/preview", { method: "POST", body: JSON.stringify({ name: "preview", totalWeightGrams: totalWeight, ingredients }) }).then(setPreview).catch(() => setPreview(null));
  }, [api, ingredients]);
  async function submit(event) {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(event.currentTarget));
    try {
      await api.request("/api/recipes", { method: "POST", body: JSON.stringify({ name: data.name, description: data.description, totalWeightGrams: Number(data.totalWeightGrams), ingredients }) });
      api.notify("Receta creada.");
      event.currentTarget.reset();
      setIngredients([]);
      setPreview(null);
    } catch (error) {
      api.notify("No se pudo crear la receta.", "error");
      console.error(error);
    }
  }
  return (
    <Panel title="Nueva receta" className="recipe-panel">
      <form className="form-grid recipe-form" onSubmit={submit}>
        <Input name="name" label="Nombre" required /><Input name="description" label="Descripcion opcional" /><Input name="totalWeightGrams" label="Peso total en gramos" type="number" required onChange={() => setIngredients([...ingredients])} />
        <div className="search-wrap"><span className="material-symbols-outlined">search</span><input className="search" placeholder="Buscar ingredientes..." value={query} onChange={(event) => setQuery(event.target.value)} /></div>
        <div className="picker-results">{foods.map((food) => <button type="button" className="catalog-row" key={food.id} onClick={() => setIngredients([...ingredients, { foodId: food.id, quantity: 100, unit: "GRAM", name: food.name }])}><span>{food.name}</span><small>{food.calories} kcal / 100g</small></button>)}</div>
        <div className="ingredient-list">{ingredients.map((item, index) => <label className="ingredient-row" key={`${item.foodId}:${index}`}><span>{item.name}</span><input type="number" value={item.quantity} onChange={(event) => setIngredients(ingredients.map((ingredient, i) => i === index ? { ...ingredient, quantity: Number(event.target.value) } : ingredient))} /><button type="button" onClick={() => setIngredients(ingredients.filter((_, i) => i !== index))}>Quitar</button></label>)}</div>
        <div className="preview mini">{formatNumber(preview?.calories)} kcal · P {formatNumber(preview?.proteinGrams, 1)}g · C {formatNumber(preview?.carbsGrams, 1)}g · G {formatNumber(preview?.fatGrams, 1)}g</div>
        <button className="primary recipe-submit" disabled={!ingredients.length}>Crear receta</button>
      </form>
    </Panel>
  );
}

function ConfigureFood({ api, setPage, foodId, user }) {
  const [activeFoodId, setActiveFoodId] = useState(foodId);
  const [quantity, setQuantity] = useState("150");
  const [unit, setUnit] = useState("GRAM");
  const [mealType, setMealType] = useState("LUNCH");
  const [mealTypes, setMealTypes] = useState(DEFAULT_MEALS);
  const [food, setFood] = useState(null);
  const [preview, setPreview] = useState(null);
  useEffect(() => { api.request("/api/nutrition/meal-types").then(setMealTypes).catch(() => setMealTypes(DEFAULT_MEALS)); }, [api]);
  useEffect(() => { setActiveFoodId(foodId); }, [foodId]);
  useEffect(() => { if (activeFoodId) api.request(`/api/foods/${activeFoodId}`).then(setFood).catch(console.error); }, [api, activeFoodId]);
  useEffect(() => { if (foodId) api.request(`/api/foods/${foodId}/preparations`).then(setPreparationOptions).catch(() => setPreparationOptions([])); }, [api, foodId]);
  useEffect(() => {
    const numericQuantity = Number(quantity);
    if (!activeFoodId || !Number.isFinite(numericQuantity) || numericQuantity <= 0) {
      setPreview(null);
      return;
    }
    const quantityInGrams = unit === "SERVING" ? numericQuantity * Number(food?.servingWeightGrams || 0) : numericQuantity;
    if (quantityInGrams <= 0) return setPreview(null);
    api.request("/api/foods/preview", { method: "POST", body: JSON.stringify({ foodId: activeFoodId, quantity: quantityInGrams, unit: "GRAM" }) }).then(setPreview).catch(console.error);
  }, [activeFoodId, api, food, quantity, unit]);
  async function add() {
    const numericQuantity = Number(quantity);
    if (!Number.isFinite(numericQuantity) || numericQuantity <= 0) return;
    const quantityInGrams = unit === "SERVING" ? numericQuantity * Number(food?.servingWeightGrams || 0) : numericQuantity;
    if (quantityInGrams <= 0) return;
    const log = await api.request("/api/nutrition/meal-logs", { method: "POST", body: JSON.stringify({ itemType: "FOOD", itemId: activeFoodId, mealType, quantity: quantityInGrams, unit: "GRAM", logDate: today() }) });
    if (food) rememberItem(user, { ...food, type: "FOOD" });
    rememberMeal(user, mealType, log);
    api.notify("Alimento agregado.");
    setPage("dashboard");
  }
  const configureUnitOptions = food?.servingWeightGrams
    ? [{ value: "GRAM", label: "Gramos" }, { value: "SERVING", label: `${food.servingName || "Porción"} (${formatNumber(food.servingWeightGrams, 1)} g)` }]
    : [{ value: "GRAM", label: "Gramos" }];
  const preparationSelectOptions = preparationOptions.map((option) => ({ value: String(option.id), label: preparationLabel(option.preparation) }));
  return <section className="page narrow configure-page"><button className="back-button configure-back" onClick={() => setPage("foods")}><span className="material-symbols-outlined">arrow_back</span>Alimentos</button><Header title="Configurar alimento" /><Panel className="configure-panel"><div className="configure-food-heading"><FoodThumb item={{ ...food, type: "FOOD" }} hero /><div><span>Porción</span><h2>{food?.name || "Cargando..."}</h2><small>{food?.brand || categoryLabel(food?.category)}</small><PreparationBadge food={food} showUnknown /></div></div>{preparationSelectOptions.length > 1 && <Select label="Peso del alimento" value={String(activeFoodId)} onChange={(event) => { setActiveFoodId(Number(event.target.value)); setUnit("GRAM"); }} options={preparationSelectOptions} />}<div className="split configure-fields"><Input label="Cantidad" value={quantity} onChange={(event) => setQuantity(event.target.value)} type="number" inputMode="decimal" min="0" /><Select label="Unidad" value={unit} onChange={(event) => setUnit(event.target.value)} options={configureUnitOptions} /></div><label className="field"><span>Comida</span><select value={mealType} onChange={(event) => setMealType(event.target.value)}>{mealTypes.map((meal) => <option key={meal.code} value={meal.code}>{meal.label}</option>)}</select></label><div className="preview configure-preview"><strong>{formatNumber(preview?.calories)} kcal</strong><small>P {formatNumber(preview?.proteinGrams, 1)}g · C {formatNumber(preview?.carbsGrams, 1)}g · G {formatNumber(preview?.fatGrams, 1)}g</small></div><button className="primary configure-submit" disabled={!activeFoodId || Number(quantity) <= 0} onClick={add}>Agregar producto</button></Panel></section>;
}

function Scanner({ api, setPage, setSelectedFoodId, setPrefillBarcode }) {
  const [barcode, setBarcode] = useState("");
  const [food, setFood] = useState(null);
  const [preparationOptions, setPreparationOptions] = useState([]);
  const [cameraOn, setCameraOn] = useState(false);
  const [manualOpen, setManualOpen] = useState(false);
  const [status, setStatus] = useState("Alinea el codigo dentro del marco");
  const videoRef = useRef(null);
  const scannerControlsRef = useRef(null);
  useEffect(() => {
    if (!cameraOn) return undefined;
    let cancelled = false;
    async function startCamera() {
      try {
        if (!navigator.mediaDevices?.getUserMedia) return setStatus("Tu navegador no permite usar camara aca. Usa ingreso manual.");
        setStatus("Escaneando codigo de barras...");
        const reader = new BrowserMultiFormatReader();
        scannerControlsRef.current = await reader.decodeFromConstraints(
          { video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false },
          videoRef.current,
          async (result, _error, controls) => {
            if (!result || cancelled) return;
            cancelled = true;
            controls.stop();
            const detectedBarcode = result.getText();
            setBarcode(detectedBarcode);
            setStatus("Codigo reconocido. Buscando producto...");
            api.notify("Codigo reconocido. Ya podes dejar de apuntar la camara.");
            navigator.vibrate?.([80, 40, 80]);
            await search(detectedBarcode, true);
          },
        );
      } catch (error) {
        setStatus("No se pudo acceder a la camara. Revisa permisos o usa ingreso manual.");
        console.error(error);
      }
    }
    startCamera();
    return () => {
      cancelled = true;
      scannerControlsRef.current?.stop();
      scannerControlsRef.current = null;
    };
  }, [cameraOn]);
  async function search(code = barcode, scanned = false) {
    const cleanCode = String(code || "").trim();
    if (!cleanCode) {
      setStatus("Ingresa un codigo de barras.");
      return;
    }
    try {
      const found = await api.request(`/api/foods/barcode/${encodeURIComponent(cleanCode)}`);
      setFood(found);
      setStatus("Producto encontrado. Ajusta la porcion antes de agregarlo.");
      setCameraOn(false);
      setSelectedFoodId(found.id);
      api.notify(`${found.name} reconocido. Revisa la porcion antes de agregarlo.`);
      window.setTimeout(() => setPage("configure"), scanned ? 500 : 0);
    } catch (error) {
      setFood(null);
      setCameraOn(false);
      setStatus("No encontramos ese codigo en el catalogo.");
      api.notify("No encontramos ese codigo.", "error");
    }
  }
  return <section className="scanner-page"><button className="back-button" onClick={() => setPage("foods")}><span className="material-symbols-outlined">arrow_back</span>Alimentos</button><div className="scanner-stage"><video ref={videoRef} muted playsInline />{!cameraOn && <div className="scanner-fallback" />}<div className={`scan-frame ${status.startsWith("Codigo reconocido") ? "recognized" : ""}`}><i /><i /><i /><i /><div className="scan-line" /><span className="material-symbols-outlined">{status.startsWith("Codigo reconocido") ? "check_circle" : "barcode_scanner"}</span></div><p aria-live="polite">{status}</p></div><section className={`scanner-result ${food ? "show" : ""}`}>{food ? <><div><strong>{food.name}</strong><span>{food.calories} kcal / 100g</span></div><button className="primary" onClick={() => { setSelectedFoodId(food.id); setPage("configure"); }}>Configurar porcion</button></> : <><button className="manual-toggle" onClick={() => setManualOpen((value) => !value)}><span>Codigo manual</span><span className="material-symbols-outlined">{manualOpen ? "expand_more" : "chevron_right"}</span></button>{manualOpen && <div className="manual-panel"><input inputMode="numeric" value={barcode} onChange={(event) => setBarcode(event.target.value.replace(/\D/g, ""))} placeholder="Ingresar codigo" /><button className="secondary" onClick={() => search()}>Buscar</button></div>}<button className="secondary" onClick={() => { setPrefillBarcode?.(barcode); setPage("create"); }}>Registrar producto</button><button className="primary" onClick={() => setCameraOn((value) => !value)}>{cameraOn ? "Pausar camara" : "Usar camara"}</button></>}</section></section>;
}

function History({ api }) {
  const [data, setData] = useState(null);
  useEffect(() => { const date = new Date(); api.request(`/api/nutrition/history?year=${date.getFullYear()}&month=${date.getMonth() + 1}`).then(setData).catch(console.error); }, [api]);
  return <section className="page"><Header title="Historial" /><div className="grid two"><Panel title="Promedio"><p className="big">{formatNumber(data?.averageCalories)} kcal</p></Panel><Panel title="Objetivos cumplidos"><p className="big">{data?.completedGoalDays || 0} dias</p></Panel></div><div className="calendar-grid">{(data?.days || []).map((day) => <span key={day.date} className={day.goalReached ? "done" : ""}>{new Date(`${day.date}T00:00:00`).getDate()}</span>)}</div></section>;
}

function Profile({ api, logout }) {
  const [profile, setProfile] = useState(null);
  const [plans, setPlans] = useState([]);
  const [presets, setPresets] = useState([]);
  useEffect(() => { api.request("/api/profile").then(setProfile).catch(console.error); }, [api]);
  const loadPlans = () => api.request("/api/profile/nutrition-plans").then(setPlans).catch(console.error);
  useEffect(() => {
    loadPlans();
    api.request("/api/profile/nutrition-plan-presets").then(setPresets).catch(console.error);
  }, [api]);
  return (
    <section className="page">
      <Header title="Mi perfil" />
      <Panel title={profile?.fullName || "Perfil"}>
        <div className="grid three">
          <Stat icon="monitor_weight" label="Peso" value={`${formatNumber(profile?.weightKg, 1)} kg`} />
          <Stat icon="height" label="Altura" value={`${formatNumber(profile?.heightCm)} cm`} />
          <Stat icon="local_fire_department" label="Meta diaria" value={`${formatNumber(profile?.dailyCalorieGoal)} kcal`} />
        </div>
      </Panel>
      <NutritionPlanManager api={api} presets={presets} plans={plans} onChanged={loadPlans} />
      <NutritionTutorial />
      <Panel title="Cuenta" className="account-panel"><p>Podés cerrar tu sesión de forma segura en este dispositivo.</p><button className="danger-button" onClick={() => { if (window.confirm("¿Querés cerrar sesión?")) logout(); }}><span className="material-symbols-outlined">logout</span>Cerrar sesión</button></Panel>
    </section>
  );
}

function NutritionPlanManager({ api, presets, plans, onChanged }) {
  const [selectedPreset, setSelectedPreset] = useState(null);
  const [form, setForm] = useState({
    name: "Plan manual",
    dailyCalories: 2200,
    proteinPercent: 25,
    carbsPercent: 50,
    fatPercent: 25,
    startDate: today(),
    endDate: "",
  });
  const total = Number(form.proteinPercent) + Number(form.carbsPercent) + Number(form.fatPercent);
  const grams = {
    protein: macroGrams(form.dailyCalories, form.proteinPercent, 4),
    carbs: macroGrams(form.dailyCalories, form.carbsPercent, 4),
    fat: macroGrams(form.dailyCalories, form.fatPercent, 9),
  };
  function setField(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }
  function setMacro(field, value) {
    setSelectedPreset(null);
    setForm((current) => {
      const otherFields = ["proteinPercent", "carbsPercent", "fatPercent"].filter((key) => key !== field);
      const remaining = Math.max(0, 100 - otherFields.reduce((sum, key) => sum + Number(current[key] || 0), 0));
      return { ...current, [field]: Math.min(remaining, Math.max(0, Number(value))) };
    });
  }
  function applyPreset(preset) {
    setSelectedPreset(preset.key);
    setForm((current) => ({
      ...current,
      name: preset.name,
      dailyCalories: preset.dailyCalories,
      proteinPercent: preset.proteinPercent,
      carbsPercent: preset.carbsPercent,
      fatPercent: preset.fatPercent,
    }));
  }
  async function submit(event) {
    event.preventDefault();
    if (Math.round(total * 10) / 10 !== 100) {
      api.notify("La suma de macros debe dar 100%.", "error");
      return;
    }
    try {
      await api.request("/api/profile/nutrition-plans", {
        method: "POST",
        body: JSON.stringify({
          ...form,
          dailyCalories: Number(form.dailyCalories),
          proteinPercent: Number(form.proteinPercent),
          carbsPercent: Number(form.carbsPercent),
          fatPercent: Number(form.fatPercent),
          endDate: form.endDate || null,
        }),
      });
      api.notify("Plan alimenticio guardado.");
      onChanged();
    } catch (error) {
      api.notify("No se pudo guardar el plan.", "error");
      console.error(error);
    }
  }
  return (
    <Panel title="Plan alimenticio">
      <div className="preset-grid">
        {presets.map((preset) => (
          <button type="button" className={`preset-card ${selectedPreset === preset.key ? "selected" : ""}`} key={preset.key} onClick={() => applyPreset(preset)}>
            <strong>{preset.name}</strong>
            <span>{preset.description}</span>
            <small>{preset.proteinPercent}% P / {preset.carbsPercent}% C / {preset.fatPercent}% G</small>
          </button>
        ))}
      </div>
      <form className="form-grid nutrition-plan-form" onSubmit={submit}>
        <div className="plan-intro"><strong>Ajustá tu distribución</strong><span>Elegí un objetivo y afiná los porcentajes sin superar el 100%.</span></div>
        <div className="macro-editor">
          <MacroControl label="Proteínas" value={form.proteinPercent} grams={grams.protein} onChange={(value) => setMacro("proteinPercent", value)} tone="protein" />
          <MacroControl label="Carbohidratos" value={form.carbsPercent} grams={grams.carbs} onChange={(value) => setMacro("carbsPercent", value)} tone="carbs" />
          <MacroControl label="Grasas" value={form.fatPercent} grams={grams.fat} onChange={(value) => setMacro("fatPercent", value)} tone="fat" />
        </div>
        <div className="macro-distribution" aria-label="Distribución de macronutrientes"><span className="protein" style={{ width: `${form.proteinPercent}%` }} /><span className="carbs" style={{ width: `${form.carbsPercent}%` }} /><span className="fat" style={{ width: `${form.fatPercent}%` }} /></div>
        <div className={`macro-total ${Math.round(total * 10) / 10 === 100 ? "ok" : "bad"}`}>
          <strong>Total {formatNumber(total, 1)}%</strong>
          <span>{Math.max(0, 100 - total)}% disponible · {grams.protein}g proteínas / {grams.carbs}g carbs / {grams.fat}g grasas</span>
        </div>
        <details className="plan-details"><summary>Detalles del plan</summary><div className="form-grid"><Input label="Nombre del plan" value={form.name} onChange={(event) => setField("name", event.target.value)} required /><Input label="Calorías diarias" type="number" value={form.dailyCalories} onChange={(event) => setField("dailyCalories", event.target.value)} required /><div className="split"><Input label="Fecha inicio" type="date" value={form.startDate} onChange={(event) => setField("startDate", event.target.value)} required /><Input label="Fecha fin opcional" type="date" value={form.endDate} onChange={(event) => setField("endDate", event.target.value)} /></div></div></details>
        <button className="primary" disabled={Math.round(total * 10) / 10 !== 100}>Guardar nuevo plan</button>
      </form>
      <div className="plan-history">
        <h3>Historial de planes</h3>
        {plans.map((plan) => (
          <article key={plan.id || `${plan.name}-${plan.startDate}`}>
            <strong>{plan.name}</strong>
            <span>{plan.startDate} - {plan.endDate || "actual"}</span>
            <small>{plan.dailyCalories} kcal / {plan.proteinPercent}% P / {plan.carbsPercent}% C / {plan.fatPercent}% G</small>
          </article>
        ))}
      </div>
    </Panel>
  );
}

function MacroControl({ label, value, grams, onChange, tone }) {
  return <label className={`macro-control ${tone}`}><span><strong>{label}</strong><small>{grams}g</small></span><output>{formatNumber(value, 1)}%</output><input type="range" min="0" max="100" step="0.5" value={value} onChange={(event) => onChange(event.target.value)} /></label>;
}

function NutritionTutorial() {
  const items = [
    ["Calorias", "Son tu presupuesto diario de energia. Si el objetivo no se sostiene en la vida real, conviene ajustar antes que abandonar."],
    ["Proteinas", "Ayudan con saciedad y mantenimiento muscular. Pensalas como una base diaria, no como algo solo para deportistas."],
    ["Carbohidratos", "Son una fuente practica de energia. Su cantidad puede subir si entrenas mas o bajar si preferis comidas mas grasas."],
    ["Grasas", "Son importantes para hormonas, absorcion de vitaminas y adherencia. Priorizá fuentes de calidad."],
    ["Como elegir", "Empeza balanceado, medí adherencia y progreso dos semanas, y ajustá de a poco. Si tenes patologias, consultá a un profesional."],
  ];
  return (
    <Panel title="Mini guia para pensar tu alimentacion">
      <div className="tutorial-list">
        {items.map(([title, body]) => <details key={title}><summary>{title}</summary><p>{body}</p></details>)}
      </div>
    </Panel>
  );
}

function Header({ title, eyebrow, action }) {
  return <header className="page-header"><div><span>{eyebrow || APP_NAME}</span><h1>{title}</h1></div>{action}</header>;
}
function Panel({ title, children, className = "" }) { return <section className={`panel ${className}`}>{title && <h2>{title}</h2>}{children}</section>; }
function Macro({ macro }) {
  const percent = macro.goal ? Math.min(100, Math.round((macro.consumed / macro.goal) * 100)) : 0;
  return <section className="macro-card"><h3>{macro.label}</h3><p className="big">{formatNumber(macro.consumed)}g</p><div className="bar"><span style={{ width: `${percent}%` }} /></div><small>{formatNumber(macro.goal)}g objetivo</small></section>;
}
function Stat({ icon, label, value }) { return <div className="stat"><span className="material-symbols-outlined">{icon}</span><small>{label}</small><strong>{value}</strong></div>; }
function Input({ label, ...props }) { return <label className="field"><span>{label}</span><input {...props} /></label>; }
function Select({ label, options, ...props }) {
  return <label className="field"><span>{label}</span><select {...props}>{options.map((option) => {
    const value = typeof option === "string" ? option : option.value;
    const optionLabel = typeof option === "string" ? option : option.label;
    return <option key={value} value={value}>{optionLabel}</option>;
  })}</select></label>;
}
function Toast({ message, tone }) { return <div className={`toast ${tone}`}>{message}</div>; }

function categoryLabel(category) {
  return CATEGORY_OPTIONS.find((option) => option.value === category)?.label || "Otros";
}

createRoot(document.getElementById("root")).render(<App />);
