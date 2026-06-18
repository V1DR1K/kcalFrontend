import React, { useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:8081";
const TOKEN_KEY = "vitalityPeak.token";
const USER_KEY = "vitalityPeak.user";

const navItems = [
  { id: "dashboard", label: "Dashboard", icon: "monitoring" },
  { id: "foods", label: "Alimentos", icon: "nutrition" },
  { id: "history", label: "Historial", icon: "calendar_month" },
  { id: "profile", label: "Perfil", icon: "account_circle" },
];

function today() {
  return new Date().toISOString().slice(0, 10);
}

function formatNumber(value, digits = 0) {
  return Number(value || 0).toLocaleString("es-AR", {
    maximumFractionDigits: digits,
    minimumFractionDigits: digits,
  });
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

  if (response.status === 204) return null;
  return response.json();
}

function App() {
  const [page, setPage] = useState(() => (localStorage.getItem(TOKEN_KEY) ? "dashboard" : "login"));
  const [toast, setToast] = useState(null);
  const [selectedFoodId, setSelectedFoodId] = useState(null);
  const [user, setUser] = useState(() => {
    const saved = localStorage.getItem(USER_KEY);
    return saved ? JSON.parse(saved) : null;
  });

  function notify(message, tone = "success") {
    setToast({ message, tone });
    window.setTimeout(() => setToast(null), 3500);
  }

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

  const api = useMemo(() => ({ request, notify }), []);
  const authenticated = Boolean(localStorage.getItem(TOKEN_KEY));

  return (
    <>
      {authenticated && (
        <Shell user={user} page={page} setPage={setPage} logout={logout}>
          {page === "dashboard" && <Dashboard api={api} />}
          {page === "foods" && <Foods api={api} setPage={setPage} setSelectedFoodId={setSelectedFoodId} />}
          {page === "configure" && <ConfigureFood api={api} setPage={setPage} foodId={selectedFoodId} />}
          {page === "scanner" && <Scanner api={api} setPage={setPage} setSelectedFoodId={setSelectedFoodId} />}
          {page === "history" && <History api={api} />}
          {page === "profile" && <Profile api={api} />}
        </Shell>
      )}
      {!authenticated && (
        <AuthScreen page={page} setPage={setPage} saveSession={saveSession} notify={notify} />
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
          <div>
            <strong>Vitality Peak</strong>
            <span>{user?.fullName || "Plan diario"}</span>
          </div>
        </div>
        <nav>
          {navItems.map((item) => (
            <button key={item.id} className={page === item.id ? "active" : ""} onClick={() => setPage(item.id)}>
              <span className="material-symbols-outlined">{item.icon}</span>
              {item.label}
            </button>
          ))}
          <button onClick={() => setPage("scanner")}>
            <span className="material-symbols-outlined">qr_code_scanner</span>
            Escaner
          </button>
        </nav>
        <button className="ghost" onClick={logout}>
          <span className="material-symbols-outlined">logout</span>
          Salir
        </button>
      </aside>
      <main className="content">{children}</main>
      <nav className="mobile-nav" aria-label="Navegacion principal">
        {navItems.map((item) => (
          <button key={item.id} className={page === item.id ? "active" : ""} onClick={() => setPage(item.id)}>
            <span className="material-symbols-outlined">{item.icon}</span>
            {item.label}
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
      const payload = isRegister
        ? await request("/api/auth/register", {
            method: "POST",
            body: JSON.stringify({
              fullName: data.fullName,
              email: data.email,
              password: data.password,
              weightKg: Number(data.weightKg),
              heightCm: Number(data.heightCm),
              birthDate: data.birthDate,
              gender: data.gender,
              goal: data.goal,
              activityLevel: data.activityLevel,
            }),
          })
        : await request("/api/auth/login", {
            method: "POST",
            body: JSON.stringify({ email: data.email, password: data.password }),
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
        <div className="brand auth-brand">
          <span className="material-symbols-outlined fill">vital_signs</span>
          <div>
            <strong>Vitality Peak</strong>
            <span>{isRegister ? "Crear cuenta" : "Ingreso"}</span>
          </div>
        </div>
        <form onSubmit={submit} className="form-grid">
          {isRegister && <Input name="fullName" label="Nombre completo" required />}
          <Input name="email" label="Email" type="email" defaultValue={isRegister ? "" : "alex@vitality.com"} required />
          <Input name="password" label="Password" type="password" defaultValue={isRegister ? "" : "password123"} required />
          {isRegister && (
            <>
              <div className="split">
                <Input name="weightKg" label="Peso kg" type="number" defaultValue="75" required />
                <Input name="heightCm" label="Altura cm" type="number" defaultValue="175" required />
              </div>
              <Input name="birthDate" label="Fecha de nacimiento" type="date" defaultValue="1995-01-01" />
              <div className="split">
                <Select name="gender" label="Genero" options={["MALE", "FEMALE", "OTHER"]} />
                <Select name="activityLevel" label="Actividad" options={["SEDENTARY", "LIGHT", "MODERATE", "ACTIVE", "VERY_ACTIVE"]} />
              </div>
              <Select name="goal" label="Objetivo" options={["LOSE_WEIGHT", "MAINTAIN", "GAIN_MUSCLE"]} />
            </>
          )}
          <button className="primary" disabled={loading}>{loading ? "Procesando..." : isRegister ? "Crear cuenta" : "Ingresar"}</button>
        </form>
        <button className="link-button" onClick={() => setPage(isRegister ? "login" : "register")}>
          {isRegister ? "Ya tengo cuenta" : "Crear una cuenta nueva"}
        </button>
      </section>
    </main>
  );
}

function Dashboard({ api }) {
  const [data, setData] = useState(null);
  useEffect(() => {
    api.request(`/api/nutrition/dashboard?date=${today()}`).then(setData).catch((error) => {
      api.notify("No se pudo cargar el dashboard.", "error");
      console.error(error);
    });
  }, [api]);

  const macros = data?.macros || [];
  return (
    <section className="page">
      <Header title="Dashboard diario" eyebrow={today()} />
      <div className="dashboard-hero">
        <div className="calorie-ring">
          <svg viewBox="0 0 160 160" aria-hidden="true">
            <circle cx="80" cy="80" r="68" />
            <circle
              className="progress"
              cx="80"
              cy="80"
              r="68"
              style={{
                strokeDashoffset: 427 - 427 * Math.min(1, (data?.caloriesConsumed || 0) / (data?.calorieGoal || 1)),
              }}
            />
          </svg>
          <div>
            <span>Restantes</span>
            <strong>{formatNumber(data?.caloriesRemaining)}</strong>
            <small>kcal</small>
          </div>
        </div>
        <div>
          <h2>Tu balance de hoy</h2>
          <p>{formatNumber(data?.caloriesConsumed)} de {formatNumber(data?.calorieGoal)} kcal consumidas</p>
          <button className="primary pill" onClick={() => api.notify("Usa Alimentos para sumar una comida.")}>
            <span className="material-symbols-outlined">add</span>
            Registrar comida
          </button>
        </div>
      </div>
      <div className="grid three">
        {macros.map((macro) => <Macro key={macro.key} macro={macro} />)}
      </div>
      <div className="grid two">
        <Panel title="Comidas">
          {(data?.meals || []).map((meal) => (
            <div className="row" key={meal.mealType}><span>{meal.label}</span><strong>{meal.calories} kcal</strong></div>
          ))}
        </Panel>
        <Panel title="Agua">
          <p className="big">{formatNumber(data?.waterConsumedLiters, 1)}L / {formatNumber(data?.waterGoalLiters, 1)}L</p>
          <button className="secondary" onClick={() => api.request("/api/nutrition/water-logs", { method: "POST", body: JSON.stringify({ liters: 0.5, logDate: today() }) }).then(() => api.notify("Hidratacion registrada."))}>Sumar 0.5L</button>
        </Panel>
      </div>
    </section>
  );
}

function Foods({ api, setPage, setSelectedFoodId }) {
  const [foods, setFoods] = useState([]);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("");
  useEffect(() => {
    const id = window.setTimeout(() => {
      const params = new URLSearchParams();
      if (query) params.set("q", query);
      if (category) params.set("category", category);
      api.request(`/api/foods${params.size ? `?${params}` : ""}`).then(setFoods).catch(console.error);
    }, 250);
    return () => window.clearTimeout(id);
  }, [api, query, category]);

  return (
    <section className="page">
      <Header title="Alimentos" action={<button className="primary pill" onClick={() => setPage("scanner")}><span className="material-symbols-outlined">barcode_scanner</span>Escanear codigo</button>} />
      <div className="search-wrap">
        <span className="material-symbols-outlined">search</span>
        <input className="search" placeholder="Buscar alimento..." value={query} onChange={(event) => setQuery(event.target.value)} />
      </div>
      <div className="chips">
        {[
          ["", "Todos"],
          ["PROTEIN", "Proteinas"],
          ["DAIRY", "Lacteos"],
          ["FRUIT", "Frutas"],
          ["VEGETABLE", "Verduras"],
          ["CEREAL", "Cereales"],
        ].map(([value, label]) => (
          <button key={label} className={category === value ? "selected" : ""} onClick={() => setCategory(value)}>
            {label}
          </button>
        ))}
      </div>
      <div className="food-grid">
        {foods.map((food) => (
          <article className="food-card" key={food.id}>
            <div className="food-thumb" style={{ backgroundImage: `url(${food.imageUrl || "/buscador_de_alimentos_modo_noche_vitality_peak/screen.png"})` }} />
            <div>
              <h3>{food.name}</h3>
              <p>{food.brand || food.category}</p>
            </div>
            <strong>{food.calories} kcal</strong>
            <button className="icon-button" onClick={() => { setSelectedFoodId(food.id); setPage("configure"); }}>
              <span className="material-symbols-outlined">add</span>
            </button>
          </article>
        ))}
      </div>
    </section>
  );
}

function ConfigureFood({ api, setPage, foodId }) {
  const [quantity, setQuantity] = useState(150);
  const [unit, setUnit] = useState("GRAM");
  const [mealType, setMealType] = useState("LUNCH");
  const [preview, setPreview] = useState(null);
  useEffect(() => {
    if (!foodId) return;
    api.request("/api/foods/preview", { method: "POST", body: JSON.stringify({ foodId, quantity, unit }) }).then(setPreview).catch(console.error);
  }, [api, foodId, quantity, unit]);

  async function add() {
    await api.request("/api/nutrition/food-logs", { method: "POST", body: JSON.stringify({ foodId, mealType, quantity, unit, logDate: today() }) });
    api.notify("Alimento agregado.");
    setPage("dashboard");
  }

  return (
    <section className="page narrow">
      <Header title="Configurar alimento" />
      <Panel title="Porcion">
        <div className="split">
          <Input label="Cantidad" value={quantity} onChange={(event) => setQuantity(Number(event.target.value))} type="number" />
          <Select label="Unidad" value={unit} onChange={(event) => setUnit(event.target.value)} options={["GRAM", "UNIT"]} />
        </div>
        <Select label="Comida" value={mealType} onChange={(event) => setMealType(event.target.value)} options={["BREAKFAST", "LUNCH", "DINNER", "SNACK"]} />
        <div className="preview">{formatNumber(preview?.calories)} kcal</div>
        <button className="primary" disabled={!foodId} onClick={add}>Agregar al dia</button>
      </Panel>
    </section>
  );
}

function Scanner({ api, setPage, setSelectedFoodId }) {
  const [barcode, setBarcode] = useState("7790000000059");
  const [food, setFood] = useState(null);
  const [cameraOn, setCameraOn] = useState(false);
  const [status, setStatus] = useState("Alinea el codigo dentro del marco");
  const videoRef = useRef(null);
  const streamRef = useRef(null);

  useEffect(() => {
    if (!cameraOn) return undefined;
    let cancelled = false;
    let timer;

    async function startCamera() {
      try {
        if (!navigator.mediaDevices?.getUserMedia) {
          setStatus("Tu navegador no permite usar camara aca. Usa ingreso manual.");
          return;
        }
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }
        setStatus("Escaneando codigo de barras...");
        if (!("BarcodeDetector" in window)) {
          setStatus("Camara activa. Si no detecta automaticamente, ingresa el codigo abajo.");
          return;
        }
        const detector = new window.BarcodeDetector({ formats: ["ean_13", "ean_8", "upc_a", "upc_e", "code_128"] });
        const scan = async () => {
          if (cancelled || !videoRef.current) return;
          try {
            const codes = await detector.detect(videoRef.current);
            if (codes.length) {
              const raw = codes[0].rawValue;
              setBarcode(raw);
              setStatus(`Codigo detectado: ${raw}`);
              setCameraOn(false);
              await search(raw);
              return;
            }
          } catch (error) {
            console.error(error);
          }
          timer = window.setTimeout(scan, 450);
        };
        scan();
      } catch (error) {
        setStatus("No se pudo acceder a la camara. Revisa permisos o usa ingreso manual.");
        console.error(error);
      }
    }

    startCamera();
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    };
  }, [cameraOn]);

  async function search() {
    const code = arguments[0] || barcode;
    try {
      const found = await api.request(`/api/foods/barcode/${code}`);
      setFood(found);
      setStatus("Producto encontrado.");
    } catch (error) {
      setFood(null);
      setStatus("No encontramos ese codigo en el catalogo.");
      api.notify("No encontramos ese codigo.", "error");
      console.error(error);
    }
  }

  return (
    <section className="scanner-page">
      <button className="back-button" onClick={() => setPage("foods")}>
        <span className="material-symbols-outlined">arrow_back</span>
        Alimentos
      </button>
      <div className="scanner-stage">
        <video ref={videoRef} muted playsInline />
        {!cameraOn && <div className="scanner-fallback" />}
        <div className="scan-frame">
          <i />
          <i />
          <i />
          <i />
          <div className="scan-line" />
          <span className="material-symbols-outlined">barcode_scanner</span>
        </div>
        <p>{status}</p>
      </div>
      <section className={`scanner-result ${food ? "show" : ""}`}>
        {food ? (
          <>
            <div>
              <strong>{food.name}</strong>
              <span>{food.calories} kcal / 100g</span>
            </div>
            <button className="primary" onClick={() => { setSelectedFoodId(food.id); setPage("configure"); }}>Agregar</button>
          </>
        ) : (
          <>
            <Input label="Codigo manual" value={barcode} onChange={(event) => setBarcode(event.target.value)} />
            <div className="split">
              <button className="primary" onClick={() => setCameraOn((value) => !value)}>
                {cameraOn ? "Pausar camara" : "Usar camara"}
              </button>
              <button className="secondary" onClick={() => search()}>Buscar codigo</button>
            </div>
          </>
        )}
      </section>
    </section>
  );
}

function History({ api }) {
  const [data, setData] = useState(null);
  useEffect(() => {
    const date = new Date();
    api.request(`/api/nutrition/history?year=${date.getFullYear()}&month=${date.getMonth() + 1}`).then(setData).catch(console.error);
  }, [api]);
  return (
    <section className="page">
      <Header title="Historial" />
      <div className="grid two">
        <Panel title="Promedio"><p className="big">{formatNumber(data?.averageCalories)} kcal</p></Panel>
        <Panel title="Objetivos cumplidos"><p className="big">{data?.completedGoalDays || 0} dias</p></Panel>
      </div>
      <div className="calendar-grid">{(data?.days || []).map((day) => <span key={day.date} className={day.goalReached ? "done" : ""}>{new Date(`${day.date}T00:00:00`).getDate()}</span>)}</div>
    </section>
  );
}

function Profile({ api }) {
  const [profile, setProfile] = useState(null);
  useEffect(() => { api.request("/api/profile").then(setProfile).catch(console.error); }, [api]);
  return (
    <section className="page">
      <Header title="Mi perfil" />
      <Panel title={profile?.fullName || "Perfil"}>
        <div className="grid three">
          <Stat label="Peso" value={`${formatNumber(profile?.weightKg, 1)} kg`} />
          <Stat label="Altura" value={`${formatNumber(profile?.heightCm)} cm`} />
          <Stat label="Meta diaria" value={`${formatNumber(profile?.dailyCalorieGoal)} kcal`} />
        </div>
      </Panel>
    </section>
  );
}

function Header({ title, eyebrow, action }) {
  return <header className="page-header"><div><span>{eyebrow || "Vitality Peak"}</span><h1>{title}</h1></div>{action}</header>;
}

function Panel({ title, children }) {
  return <section className="panel"><h2>{title}</h2>{children}</section>;
}

function Macro({ macro }) {
  const percent = macro.goal ? Math.min(100, Math.round((macro.consumed / macro.goal) * 100)) : 0;
  return <Panel title={macro.label}><p className="big">{formatNumber(macro.consumed)}g</p><div className="bar"><span style={{ width: `${percent}%` }} /></div><small>{formatNumber(macro.goal)}g objetivo</small></Panel>;
}

function Stat({ label, value }) {
  return <div className="stat"><span className="material-symbols-outlined">monitor_weight</span><small>{label}</small><strong>{value}</strong></div>;
}

function Input({ label, ...props }) {
  return <label className="field"><span>{label}</span><input {...props} /></label>;
}

function Select({ label, options, ...props }) {
  return <label className="field"><span>{label}</span><select {...props}>{options.map((option) => <option key={option} value={option}>{option}</option>)}</select></label>;
}

function Toast({ message, tone }) {
  return <div className={`toast ${tone}`}>{message}</div>;
}

createRoot(document.getElementById("root")).render(<App />);
