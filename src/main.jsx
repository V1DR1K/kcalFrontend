import React, { useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
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
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    },
  });
  if (!response.ok) {
    const text = await response.text();
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

  const authenticated = Boolean(localStorage.getItem(TOKEN_KEY));
  return (
    <>
      {authenticated ? (
        <Shell user={user} page={page} setPage={setPage} logout={logout}>
          {page === "dashboard" && <Dashboard api={api} user={user} setPage={setPage} />}
          {page === "foods" && <Foods api={api} user={user} setPage={setPage} setSelectedFoodId={setSelectedFoodId} />}
          {page === "create" && <CreateCatalog api={api} />}
          {page === "configure" && <ConfigureFood api={api} setPage={setPage} foodId={selectedFoodId} user={user} />}
          {page === "scanner" && <Scanner api={api} setPage={setPage} setSelectedFoodId={setSelectedFoodId} />}
          {page === "history" && <History api={api} />}
          {page === "profile" && <Profile api={api} />}
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
          <MealCard key={mealType.code} mealType={mealType} meal={mealByCode.get(mealType.code)} onAdd={() => setPickerMeal(mealType)} />
        ))}
      </div>
      <div className="grid two">
        <Panel title="Agua">
          <p className="big">{formatNumber(data?.waterConsumedLiters, 1)}L / {formatNumber(data?.waterGoalLiters, 1)}L</p>
          <button className="secondary" onClick={() => api.request("/api/nutrition/water-logs", { method: "POST", body: JSON.stringify({ liters: 0.5, logDate: selectedDate }) }).then(() => { api.notify("Hidratacion registrada."); load(); })}>Sumar 0.5L</button>
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

function MealCard({ mealType, meal, onAdd }) {
  const items = meal?.items || [];
  return (
    <article className="meal-card">
      <header><div><span>{mealType.label}</span><strong>{meal?.calories || 0} kcal</strong></div><button className="icon-button" onClick={onAdd}><span className="material-symbols-outlined">add</span></button></header>
      <div className="meal-macros"><small>P {formatNumber(meal?.proteinGrams, 1)}g</small><small>C {formatNumber(meal?.carbsGrams, 1)}g</small><small>G {formatNumber(meal?.fatGrams, 1)}g</small></div>
      {items.length ? items.map((log) => <div className="meal-item" key={log.id}><span>{log.itemType === "RECIPE" ? log.recipe?.name : log.food?.name}</span><strong>{log.calories} kcal</strong></div>) : <p className="empty-state">Todavia no registraste nada.</p>}
    </article>
  );
}

function FoodPicker({ api, user, mealType, selectedDate, onClose, onDone, setPage }) {
  const [tab, setTab] = useState("FOOD");
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("");
  const [results, setResults] = useState([]);
  const [selected, setSelected] = useState(null);
  const [quantity, setQuantity] = useState(150);
  const [preview, setPreview] = useState(null);
  const recents = readRecents(user);
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
    if (!selected) return setPreview(null);
    if (selected.type === "FOOD") {
      api.request("/api/foods/preview", { method: "POST", body: JSON.stringify({ foodId: selected.id, quantity, unit: "GRAM" }) }).then(setPreview).catch(console.error);
    } else {
      const ratio = Number(quantity) / Number(selected.totalWeightGrams || 1);
      setPreview({ calories: Math.round(selected.calories * ratio), proteinGrams: selected.proteinGrams * ratio, carbsGrams: selected.carbsGrams * ratio, fatGrams: selected.fatGrams * ratio });
    }
  }, [api, selected, quantity]);
  async function add() {
    const log = await api.request("/api/nutrition/meal-logs", {
      method: "POST",
      body: JSON.stringify({ itemType: selected.type, itemId: selected.id, mealType: mealType.code, quantity, unit: "GRAM", logDate: selectedDate }),
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
        <div className="search-wrap"><span className="material-symbols-outlined">search</span><input className="search" placeholder={`Buscar ${tab === "FOOD" ? "alimentos" : "recetas"}...`} value={query} onChange={(event) => setQuery(event.target.value)} /></div>
        {tab === "FOOD" && <CategoryChips category={category} setCategory={setCategory} />}
        <QuickItems title="Usados recientemente" items={recents.items.filter((item) => item.type === tab)} onPick={setSelected} />
        <div className="picker-results">
          {results.map((item) => <CatalogRow key={`${tab}:${item.id}`} item={{ ...item, type: tab }} onPick={setSelected} />)}
        </div>
        {selected && (
          <div className="selected-editor">
            <strong>{selected.name}</strong>
            <div className="split"><Input label={selected.type === "RECIPE" ? "Gramos ingeridos" : "Gramos"} type="number" value={quantity} onChange={(event) => setQuantity(Number(event.target.value))} /><div className="preview mini">{formatNumber(preview?.calories)} kcal</div></div>
            <small>P {formatNumber(preview?.proteinGrams, 1)}g · C {formatNumber(preview?.carbsGrams, 1)}g · G {formatNumber(preview?.fatGrams, 1)}g</small>
            <button className="primary" onClick={add}>Agregar a {mealType.label}</button>
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
      <QuickItems title="Accesos rapidos" items={readRecents(user).items.filter((item) => item.type === tab)} onPick={(item) => { if (item.type === "FOOD") { setSelectedFoodId(item.id); setPage("configure"); } }} />
      <div className="food-grid">
        {foods.map((item) => <CatalogCard key={`${tab}:${item.id}`} item={{ ...item, type: tab }} onAdd={() => { if (tab === "FOOD") { setSelectedFoodId(item.id); setPage("configure"); } }} />)}
      </div>
    </section>
  );
}

function CategoryChips({ category, setCategory }) {
  return <div className="chips">{[{ value: "", label: "Todos" }, ...CATEGORY_OPTIONS.filter((option) => option.value !== "OTHER")].map(({ value, label }) => <button key={label} className={category === value ? "selected" : ""} onClick={() => setCategory(value)}>{label}</button>)}</div>;
}

function CatalogRow({ item, onPick }) {
  return <button className="catalog-row" onClick={() => onPick(item)}><span>{item.name}</span><small>{item.calories} kcal · P {formatNumber(item.proteinGrams, 1)}g · C {formatNumber(item.carbsGrams, 1)}g · G {formatNumber(item.fatGrams, 1)}g</small></button>;
}

function CatalogCard({ item, onAdd }) {
  return (
    <article className="food-card">
      <div className="food-thumb"><span className="material-symbols-outlined">{item.type === "RECIPE" ? "restaurant_menu" : "nutrition"}</span></div>
      <div><h3>{item.name}</h3><p>{item.type === "RECIPE" ? `${formatNumber(item.totalWeightGrams)}g totales` : item.brand || categoryLabel(item.category)}</p></div>
      <strong>{item.calories} kcal</strong>
      {item.type === "FOOD" && <button className="icon-button" onClick={onAdd}><span className="material-symbols-outlined">add</span></button>}
    </article>
  );
}

function CreateCatalog({ api }) {
  const [tab, setTab] = useState("FOOD");
  return (
    <section className="page narrow">
      <Header title="Crear" eyebrow="Catalogo global" />
      <div className="tabs"><button className={tab === "FOOD" ? "selected" : ""} onClick={() => setTab("FOOD")}>Alimento</button><button className={tab === "RECIPE" ? "selected" : ""} onClick={() => setTab("RECIPE")}>Receta</button></div>
      {tab === "FOOD" ? <CreateFoodForm api={api} /> : <CreateRecipeForm api={api} />}
    </section>
  );
}

function CreateFoodForm({ api }) {
  async function submit(event) {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(event.currentTarget));
    try {
      await api.request("/api/foods", { method: "POST", body: JSON.stringify({ name: data.name, brand: data.brand, barcode: data.barcode, category: data.category, baseUnit: "GRAM", baseQuantity: Number(data.baseQuantity || 100), calories: Number(data.calories), proteinGrams: Number(data.proteinGrams), carbsGrams: Number(data.carbsGrams), fatGrams: Number(data.fatGrams), tags: data.tags ? data.tags.split(",").map((tag) => tag.trim()).filter(Boolean) : [] }) });
      api.notify("Alimento creado.");
      event.currentTarget.reset();
    } catch (error) {
      api.notify("No se pudo crear el alimento.", "error");
      console.error(error);
    }
  }
  return <Panel title="Nuevo alimento"><form className="form-grid" onSubmit={submit}><Input name="name" label="Nombre" required /><Input name="brand" label="Marca" /><Input name="barcode" label="Codigo de barras opcional" /><Select name="category" label="Categoria" options={CATEGORY_OPTIONS} /><Input name="baseQuantity" label="Base gramos/ml/unidad" type="number" defaultValue="100" required /><div className="split"><Input name="calories" label="Kcal" type="number" required /><Input name="proteinGrams" label="Proteinas g" type="number" step="0.1" required /></div><div className="split"><Input name="carbsGrams" label="Carbohidratos g" type="number" step="0.1" required /><Input name="fatGrams" label="Grasas g" type="number" step="0.1" required /></div><Input name="tags" label="Tags separados por coma" /><button className="primary">Crear alimento</button></form></Panel>;
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
    <Panel title="Nueva receta">
      <form className="form-grid" onSubmit={submit}>
        <Input name="name" label="Nombre" required /><Input name="description" label="Descripcion opcional" /><Input name="totalWeightGrams" label="Peso total en gramos" type="number" required onChange={() => setIngredients([...ingredients])} />
        <div className="search-wrap"><span className="material-symbols-outlined">search</span><input className="search" placeholder="Buscar ingredientes..." value={query} onChange={(event) => setQuery(event.target.value)} /></div>
        <div className="picker-results">{foods.map((food) => <button type="button" className="catalog-row" key={food.id} onClick={() => setIngredients([...ingredients, { foodId: food.id, quantity: 100, unit: "GRAM", name: food.name }])}><span>{food.name}</span><small>{food.calories} kcal / 100g</small></button>)}</div>
        <div className="ingredient-list">{ingredients.map((item, index) => <label className="ingredient-row" key={`${item.foodId}:${index}`}><span>{item.name}</span><input type="number" value={item.quantity} onChange={(event) => setIngredients(ingredients.map((ingredient, i) => i === index ? { ...ingredient, quantity: Number(event.target.value) } : ingredient))} /><button type="button" onClick={() => setIngredients(ingredients.filter((_, i) => i !== index))}>Quitar</button></label>)}</div>
        <div className="preview mini">{formatNumber(preview?.calories)} kcal · P {formatNumber(preview?.proteinGrams, 1)}g · C {formatNumber(preview?.carbsGrams, 1)}g · G {formatNumber(preview?.fatGrams, 1)}g</div>
        <button className="primary">Crear receta</button>
      </form>
    </Panel>
  );
}

function ConfigureFood({ api, setPage, foodId, user }) {
  const [quantity, setQuantity] = useState(150);
  const [unit, setUnit] = useState("GRAM");
  const [mealType, setMealType] = useState("LUNCH");
  const [mealTypes, setMealTypes] = useState(DEFAULT_MEALS);
  const [food, setFood] = useState(null);
  const [preview, setPreview] = useState(null);
  useEffect(() => { api.request("/api/nutrition/meal-types").then(setMealTypes).catch(() => setMealTypes(DEFAULT_MEALS)); }, [api]);
  useEffect(() => { if (foodId) api.request(`/api/foods/${foodId}`).then(setFood).catch(console.error); }, [api, foodId]);
  useEffect(() => { if (foodId) api.request("/api/foods/preview", { method: "POST", body: JSON.stringify({ foodId, quantity, unit }) }).then(setPreview).catch(console.error); }, [api, foodId, quantity, unit]);
  async function add() {
    const log = await api.request("/api/nutrition/meal-logs", { method: "POST", body: JSON.stringify({ itemType: "FOOD", itemId: foodId, mealType, quantity, unit, logDate: today() }) });
    if (food) rememberItem(user, { ...food, type: "FOOD" });
    rememberMeal(user, mealType, log);
    api.notify("Alimento agregado.");
    setPage("dashboard");
  }
  return <section className="page narrow"><Header title="Configurar alimento" /><Panel title={food?.name || "Porcion"}><div className="split"><Input label="Cantidad" value={quantity} onChange={(event) => setQuantity(Number(event.target.value))} type="number" /><Select label="Unidad" value={unit} onChange={(event) => setUnit(event.target.value)} options={UNIT_OPTIONS} /></div><label className="field"><span>Comida</span><select value={mealType} onChange={(event) => setMealType(event.target.value)}>{mealTypes.map((meal) => <option key={meal.code} value={meal.code}>{meal.label}</option>)}</select></label><div className="preview">{formatNumber(preview?.calories)} kcal</div><button className="primary" disabled={!foodId} onClick={add}>Agregar al dia</button></Panel></section>;
}

function Scanner({ api, setPage, setSelectedFoodId }) {
  const [barcode, setBarcode] = useState("7790000000059");
  const [food, setFood] = useState(null);
  const [cameraOn, setCameraOn] = useState(false);
  const [manualOpen, setManualOpen] = useState(false);
  const [status, setStatus] = useState("Alinea el codigo dentro del marco");
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  useEffect(() => {
    if (!cameraOn) return undefined;
    let cancelled = false;
    let timer;
    async function startCamera() {
      try {
        if (!navigator.mediaDevices?.getUserMedia) return setStatus("Tu navegador no permite usar camara aca. Usa ingreso manual.");
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
        streamRef.current = stream;
        if (videoRef.current) { videoRef.current.srcObject = stream; await videoRef.current.play(); }
        setStatus("Escaneando codigo de barras...");
        if (!("BarcodeDetector" in window)) return setStatus("Camara activa. Si no detecta automaticamente, ingresa el codigo abajo.");
        const detector = new window.BarcodeDetector({ formats: ["ean_13", "ean_8", "upc_a", "upc_e", "code_128"] });
        const scan = async () => {
          if (cancelled || !videoRef.current) return;
          const codes = await detector.detect(videoRef.current).catch(() => []);
          if (codes.length) { setBarcode(codes[0].rawValue); setCameraOn(false); await search(codes[0].rawValue); return; }
          timer = window.setTimeout(scan, 450);
        };
        scan();
      } catch (error) {
        setStatus("No se pudo acceder a la camara. Revisa permisos o usa ingreso manual.");
        console.error(error);
      }
    }
    startCamera();
    return () => { cancelled = true; window.clearTimeout(timer); streamRef.current?.getTracks().forEach((track) => track.stop()); };
  }, [cameraOn]);
  async function search(code = barcode) {
    try {
      const found = await api.request(`/api/foods/barcode/${code}`);
      setFood(found);
      setStatus("Producto encontrado.");
    } catch (error) {
      setFood(null);
      setStatus("No encontramos ese codigo en el catalogo.");
      api.notify("No encontramos ese codigo.", "error");
    }
  }
  return <section className="scanner-page"><button className="back-button" onClick={() => setPage("foods")}><span className="material-symbols-outlined">arrow_back</span>Alimentos</button><div className="scanner-stage"><video ref={videoRef} muted playsInline />{!cameraOn && <div className="scanner-fallback" />}<div className="scan-frame"><i /><i /><i /><i /><div className="scan-line" /><span className="material-symbols-outlined">barcode_scanner</span></div><p>{status}</p></div><section className={`scanner-result ${food ? "show" : ""}`}>{food ? <><div><strong>{food.name}</strong><span>{food.calories} kcal / 100g</span></div><button className="primary" onClick={() => { setSelectedFoodId(food.id); setPage("configure"); }}>Agregar</button></> : <><button className="manual-toggle" onClick={() => setManualOpen((value) => !value)}><span>Codigo manual</span><span className="material-symbols-outlined">{manualOpen ? "expand_more" : "chevron_right"}</span></button>{manualOpen && <div className="manual-panel"><input value={barcode} onChange={(event) => setBarcode(event.target.value)} placeholder="Ingresar codigo" /><button className="secondary" onClick={() => search()}>Buscar</button></div>}<button className="primary" onClick={() => setCameraOn((value) => !value)}>{cameraOn ? "Pausar camara" : "Usar camara"}</button></>}</section></section>;
}

function History({ api }) {
  const [data, setData] = useState(null);
  useEffect(() => { const date = new Date(); api.request(`/api/nutrition/history?year=${date.getFullYear()}&month=${date.getMonth() + 1}`).then(setData).catch(console.error); }, [api]);
  return <section className="page"><Header title="Historial" /><div className="grid two"><Panel title="Promedio"><p className="big">{formatNumber(data?.averageCalories)} kcal</p></Panel><Panel title="Objetivos cumplidos"><p className="big">{data?.completedGoalDays || 0} dias</p></Panel></div><div className="calendar-grid">{(data?.days || []).map((day) => <span key={day.date} className={day.goalReached ? "done" : ""}>{new Date(`${day.date}T00:00:00`).getDate()}</span>)}</div></section>;
}

function Profile({ api }) {
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
    </section>
  );
}

function NutritionPlanManager({ api, presets, plans, onChanged }) {
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
  function applyPreset(preset) {
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
          <button className="preset-card" key={preset.key} onClick={() => applyPreset(preset)}>
            <strong>{preset.name}</strong>
            <span>{preset.description}</span>
            <small>{preset.proteinPercent}% P / {preset.carbsPercent}% C / {preset.fatPercent}% G</small>
          </button>
        ))}
      </div>
      <form className="form-grid nutrition-plan-form" onSubmit={submit}>
        <Input label="Nombre del plan" value={form.name} onChange={(event) => setField("name", event.target.value)} required />
        <Input label="Calorias diarias" type="number" value={form.dailyCalories} onChange={(event) => setField("dailyCalories", event.target.value)} required />
        <div className="macro-editor">
          <Input label="Proteinas %" type="number" value={form.proteinPercent} onChange={(event) => setField("proteinPercent", event.target.value)} required />
          <Input label="Carbohidratos %" type="number" value={form.carbsPercent} onChange={(event) => setField("carbsPercent", event.target.value)} required />
          <Input label="Grasas %" type="number" value={form.fatPercent} onChange={(event) => setField("fatPercent", event.target.value)} required />
        </div>
        <div className={`macro-total ${Math.round(total * 10) / 10 === 100 ? "ok" : "bad"}`}>
          <strong>Total {formatNumber(total, 1)}%</strong>
          <span>{grams.protein}g proteinas / {grams.carbs}g carbs / {grams.fat}g grasas</span>
        </div>
        <div className="split">
          <Input label="Fecha inicio" type="date" value={form.startDate} onChange={(event) => setField("startDate", event.target.value)} required />
          <Input label="Fecha fin opcional" type="date" value={form.endDate} onChange={(event) => setField("endDate", event.target.value)} />
        </div>
        <button className="primary">Guardar nuevo plan</button>
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
function Panel({ title, children }) { return <section className="panel"><h2>{title}</h2>{children}</section>; }
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
